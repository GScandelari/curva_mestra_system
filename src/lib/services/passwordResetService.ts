/**
 * Serviço de Tokens de Reset de Senha
 * Gerencia tokens de uso único para reset de senha seguro
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const PASSWORD_RESET_TOKENS_COLLECTION = 'password_reset_tokens';
const TOKEN_EXPIRY_MINUTES = 30;

/**
 * Interface interna para dados de token (usa tipos Admin SDK)
 */
interface PasswordResetTokenData {
  token_hash: string;
  user_id: string;
  user_email: string;
  tenant_id?: string;
  expires_at: Timestamp;
  created_at: Timestamp | ReturnType<typeof FieldValue.serverTimestamp>;
  created_by: string;
  used_at?: Timestamp;
  invalidated_at?: Timestamp;
}

/**
 * Gera um token seguro de 32 bytes (64 caracteres hex)
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Cria hash SHA-256 do token para armazenamento seguro
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Mascara email para exibição (ex: j***@gmail.com)
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;

  const maskedLocal =
    localPart.length <= 2
      ? localPart[0] + '***'
      : localPart[0] + '***' + localPart[localPart.length - 1];

  return `${maskedLocal}@${domain}`;
}

/**
 * Cria um novo token de reset de senha no Firestore
 */
export async function createPasswordResetToken(
  userId: string,
  userEmail: string,
  createdBy: string,
  tenantId?: string
): Promise<{ token: string; expiresAt: Date }> {
  // Invalidar tokens anteriores do usuário
  await invalidateUserTokens(userId);

  // Gerar novo token
  const rawToken = generateResetToken();
  const tokenHash = hashToken(rawToken);

  // Calcular expiração (30 minutos)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + TOKEN_EXPIRY_MINUTES);

  // Criar documento no Firestore
  const tokenData: Omit<PasswordResetTokenData, 'used_at' | 'invalidated_at'> = {
    token_hash: tokenHash,
    user_id: userId,
    user_email: userEmail,
    created_by: createdBy,
    expires_at: Timestamp.fromDate(expiresAt),
    created_at: FieldValue.serverTimestamp(),
    ...(tenantId && { tenant_id: tenantId }),
  };

  await adminDb.collection(PASSWORD_RESET_TOKENS_COLLECTION).add(tokenData);

  return {
    token: rawToken,
    expiresAt,
  };
}

/**
 * Valida um token sem consumi-lo
 * Retorna informações sobre o token ou erro
 */
export async function validateToken(rawToken: string): Promise<{
  valid: boolean;
  userId?: string;
  userEmail?: string;
  emailMasked?: string;
  error?: string;
}> {
  try {
    const tokenHash = hashToken(rawToken);

    // Buscar token pelo hash
    const snapshot = await adminDb
      .collection(PASSWORD_RESET_TOKENS_COLLECTION)
      .where('token_hash', '==', tokenHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { valid: false, error: 'Token inválido ou expirado' };
    }

    const tokenDoc = snapshot.docs[0];
    const tokenData = tokenDoc.data() as PasswordResetTokenData;

    // Verificar se já foi usado
    if (tokenData.used_at) {
      return {
        valid: false,
        error: 'Este link já foi utilizado. Solicite um novo reset de senha.',
      };
    }

    // Verificar se foi invalidado
    if (tokenData.invalidated_at) {
      return { valid: false, error: 'Este link foi invalidado. Solicite um novo reset de senha.' };
    }

    // Verificar expiração
    const expiresAt = tokenData.expires_at.toDate();
    if (new Date() > expiresAt) {
      return { valid: false, error: 'Este link expirou. Solicite um novo reset de senha.' };
    }

    return {
      valid: true,
      userId: tokenData.user_id,
      userEmail: tokenData.user_email,
      emailMasked: maskEmail(tokenData.user_email),
    };
  } catch (error) {
    console.error('Erro ao validar token:', error);
    return { valid: false, error: 'Erro ao validar token. Tente novamente.' };
  }
}

/**
 * Consome um token (marca como usado) e retorna informações do usuário
 * Deve ser chamado APÓS validar o token e ANTES de atualizar a senha
 */
export async function consumeToken(rawToken: string): Promise<{
  success: boolean;
  userId?: string;
  userEmail?: string;
  error?: string;
}> {
  try {
    const tokenHash = hashToken(rawToken);

    // Buscar token pelo hash
    const snapshot = await adminDb
      .collection(PASSWORD_RESET_TOKENS_COLLECTION)
      .where('token_hash', '==', tokenHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: false, error: 'Token inválido ou expirado' };
    }

    const tokenDoc = snapshot.docs[0];
    const tokenData = tokenDoc.data() as PasswordResetTokenData;

    // Verificar se já foi usado
    if (tokenData.used_at) {
      return { success: false, error: 'Este link já foi utilizado' };
    }

    // Verificar se foi invalidado
    if (tokenData.invalidated_at) {
      return { success: false, error: 'Este link foi invalidado' };
    }

    // Verificar expiração
    const expiresAt = tokenData.expires_at.toDate();
    if (new Date() > expiresAt) {
      return { success: false, error: 'Este link expirou' };
    }

    // Marcar como usado
    await tokenDoc.ref.update({
      used_at: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      userId: tokenData.user_id,
      userEmail: tokenData.user_email,
    };
  } catch (error) {
    console.error('Erro ao consumir token:', error);
    return { success: false, error: 'Erro ao processar token. Tente novamente.' };
  }
}

/**
 * Invalida todos os tokens pendentes de um usuário
 * Chamado quando um novo token é criado ou quando a senha é alterada
 */
export async function invalidateUserTokens(userId: string): Promise<void> {
  try {
    const snapshot = await adminDb
      .collection(PASSWORD_RESET_TOKENS_COLLECTION)
      .where('user_id', '==', userId)
      .where('used_at', '==', null)
      .get();

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        invalidated_at: FieldValue.serverTimestamp(),
      });
    });

    if (!snapshot.empty) {
      await batch.commit();
    }
  } catch (error) {
    console.error('Erro ao invalidar tokens do usuário:', error);
    // Não lançar erro - invalidação é operação de limpeza
  }
}

/**
 * Gera o link completo de reset de senha
 */
export function generateResetLink(token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://curvamestra.com.br';
  return `${base}/reset-password/${token}`;
}

/**
 * Gera o HTML do email de reset de senha
 */
export function generateResetPasswordEmailHtml(displayName: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Redefinição de Senha</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>${displayName}</strong>,</p>
          <p>Foi solicitada a redefinição da sua senha no <strong>Curva Mestra</strong>.</p>
          <p>Clique no botão abaixo para definir uma nova senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 14px 35px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Definir Nova Senha</a>
          </div>
          <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Importante:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400e;">
              <li>Este link expira em <strong>30 minutos</strong></li>
              <li>O link só pode ser usado <strong>uma vez</strong></li>
              <li>Se você não solicitou esta alteração, ignore este email</li>
            </ul>
          </div>
          <p style="font-size: 12px; color: #6b7280;">
            Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br>
            <span style="word-break: break-all; color: #667eea;">${resetLink}</span>
          </p>
          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>&copy; ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p><strong>IMPORTANTE:</strong> Nunca compartilhe este link com terceiros.</p>
        </div>
      </body>
    </html>
  `;
}
