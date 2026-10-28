/**
 * Serviço de Tokens de Senha (redefinição e primeiro acesso)
 * Gerencia tokens de uso único; as regras de estado ficam em passwordTokenRules.
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { resolveAppBaseUrl } from '@/lib/emailLayout';
import {
  computeTokenExpiry,
  evaluatePasswordToken,
  tokenPurpose,
  tokenStateMessage,
  type PasswordTokenPurpose,
  type TokenSnapshot,
  type TokenState,
} from '@/lib/passwordTokenRules';

const PASSWORD_RESET_TOKENS_COLLECTION = 'password_reset_tokens';

/**
 * Interface interna para dados de token (usa tipos Admin SDK)
 */
interface PasswordResetTokenData {
  token_hash: string;
  // Ausente em tokens antigos: tratados como password_reset.
  purpose?: PasswordTokenPurpose;
  user_id: string;
  user_email: string;
  tenant_id?: string;
  expires_at: Timestamp;
  created_at: Timestamp | ReturnType<typeof FieldValue.serverTimestamp>;
  created_by: string;
  // Gravados como null na criação; docs antigos podem não ter os campos.
  used_at?: Timestamp | null;
  invalidated_at?: Timestamp | null;
  opened_at?: Timestamp | null;
  session_hash?: string | null;
  session_expires_at?: Timestamp | null;
}

function toSnapshot(data: PasswordResetTokenData): TokenSnapshot {
  return {
    purpose: data.purpose,
    expires_at: data.expires_at.toDate(),
    used_at: data.used_at?.toDate() ?? null,
    invalidated_at: data.invalidated_at?.toDate() ?? null,
    opened_at: data.opened_at?.toDate() ?? null,
    session_hash: data.session_hash ?? null,
    session_expires_at: data.session_expires_at?.toDate() ?? null,
  };
}

async function findTokenDoc(rawToken: string) {
  const snapshot = await adminDb
    .collection(PASSWORD_RESET_TOKENS_COLLECTION)
    .where('token_hash', '==', hashToken(rawToken))
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
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
 * Cria um token de senha. `password_reset` vale 30 min; `first_access`
 * vale 72 h e é de uso único no clique (ver openFirstAccessToken).
 * Tokens pendentes anteriores do usuário são invalidados.
 */
export async function createPasswordToken(params: {
  userId: string;
  userEmail: string;
  createdBy: string;
  purpose: PasswordTokenPurpose;
  tenantId?: string;
}): Promise<{ token: string; expiresAt: Date }> {
  await invalidateUserTokens(params.userId);

  const rawToken = generateResetToken();
  const expiresAt = computeTokenExpiry(params.purpose, new Date());

  const tokenData: PasswordResetTokenData = {
    token_hash: hashToken(rawToken),
    purpose: params.purpose,
    user_id: params.userId,
    user_email: params.userEmail,
    created_by: params.createdBy,
    expires_at: Timestamp.fromDate(expiresAt),
    created_at: FieldValue.serverTimestamp(),
    used_at: null,
    invalidated_at: null,
    ...(params.tenantId && { tenant_id: params.tenantId }),
  };

  await adminDb.collection(PASSWORD_RESET_TOKENS_COLLECTION).add(tokenData);

  return { token: rawToken, expiresAt };
}

/**
 * Cria um token de redefinição de senha (30 min)
 */
export async function createPasswordResetToken(
  userId: string,
  userEmail: string,
  createdBy: string,
  tenantId?: string
): Promise<{ token: string; expiresAt: Date }> {
  return createPasswordToken({
    userId,
    userEmail,
    createdBy,
    tenantId,
    purpose: 'password_reset',
  });
}

/**
 * Valida um token sem alterá-lo (nunca marca abertura nem uso)
 */
export async function validateToken(rawToken: string): Promise<{
  valid: boolean;
  purpose?: PasswordTokenPurpose;
  reason?: TokenState | 'not_found';
  userId?: string;
  userEmail?: string;
  emailMasked?: string;
  error?: string;
}> {
  try {
    const tokenDoc = await findTokenDoc(rawToken);
    if (!tokenDoc) {
      return { valid: false, reason: 'not_found', error: 'Link inválido ou expirado.' };
    }

    const tokenData = tokenDoc.data() as PasswordResetTokenData;
    const state = evaluatePasswordToken(toSnapshot(tokenData), new Date(), 'inspect');
    if (state !== 'valid') {
      return {
        valid: false,
        purpose: tokenPurpose(tokenData),
        reason: state,
        error: tokenStateMessage(state),
      };
    }

    return {
      valid: true,
      purpose: tokenPurpose(tokenData),
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
    // Filtra os pendentes em memória: `where('used_at','==',null)` não
    // encontra docs sem o campo (todos os tokens antigos eram gravados assim),
    // então nenhum token era invalidado.
    const snapshot = await adminDb
      .collection(PASSWORD_RESET_TOKENS_COLLECTION)
      .where('user_id', '==', userId)
      .get();

    const pending = snapshot.docs.filter((doc) => {
      const data = doc.data() as PasswordResetTokenData;
      return !data.used_at && !data.invalidated_at;
    });

    const batch = adminDb.batch();
    pending.forEach((doc) => {
      batch.update(doc.ref, {
        invalidated_at: FieldValue.serverTimestamp(),
      });
    });

    if (pending.length > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error('Erro ao invalidar tokens do usuário:', error);
    // Não lançar erro - invalidação é operação de limpeza
  }
}

/**
 * URL base do ambiente para links e imagens de e-mail (nunca do header Host)
 */
export function getAppBaseUrl(): string {
  return resolveAppBaseUrl({
    explicitBaseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    fallbackLocalUrl: process.env.PLAYWRIGHT_BASE_URL,
  });
}

/**
 * Gera o link completo de senha (redefinição ou primeiro acesso)
 */
export function generateResetLink(token: string, baseUrl?: string): string {
  return `${baseUrl || getAppBaseUrl()}/reset-password/${token}`;
}
