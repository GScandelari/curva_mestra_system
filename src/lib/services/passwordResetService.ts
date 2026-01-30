/**
 * Serviço de Tokens de Reset de Senha
 * Gerencia tokens de uso único para reset de senha seguro
 */

import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const PASSWORD_RESET_TOKENS_COLLECTION = "password_reset_tokens";
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
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Cria hash SHA-256 do token para armazenamento seguro
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Mascara email para exibição (ex: j***@gmail.com)
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;

  const maskedLocal = localPart.length <= 2
    ? localPart[0] + "***"
    : localPart[0] + "***" + localPart[localPart.length - 1];

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
  const tokenData: Omit<PasswordResetTokenData, "used_at" | "invalidated_at"> = {
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
      .where("token_hash", "==", tokenHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { valid: false, error: "Token inválido ou expirado" };
    }

    const tokenDoc = snapshot.docs[0];
    const tokenData = tokenDoc.data() as PasswordResetTokenData;

    // Verificar se já foi usado
    if (tokenData.used_at) {
      return { valid: false, error: "Este link já foi utilizado. Solicite um novo reset de senha." };
    }

    // Verificar se foi invalidado
    if (tokenData.invalidated_at) {
      return { valid: false, error: "Este link foi invalidado. Solicite um novo reset de senha." };
    }

    // Verificar expiração
    const expiresAt = tokenData.expires_at.toDate();
    if (new Date() > expiresAt) {
      return { valid: false, error: "Este link expirou. Solicite um novo reset de senha." };
    }

    return {
      valid: true,
      userId: tokenData.user_id,
      userEmail: tokenData.user_email,
      emailMasked: maskEmail(tokenData.user_email),
    };
  } catch (error) {
    console.error("Erro ao validar token:", error);
    return { valid: false, error: "Erro ao validar token. Tente novamente." };
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
      .where("token_hash", "==", tokenHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: false, error: "Token inválido ou expirado" };
    }

    const tokenDoc = snapshot.docs[0];
    const tokenData = tokenDoc.data() as PasswordResetTokenData;

    // Verificar se já foi usado
    if (tokenData.used_at) {
      return { success: false, error: "Este link já foi utilizado" };
    }

    // Verificar se foi invalidado
    if (tokenData.invalidated_at) {
      return { success: false, error: "Este link foi invalidado" };
    }

    // Verificar expiração
    const expiresAt = tokenData.expires_at.toDate();
    if (new Date() > expiresAt) {
      return { success: false, error: "Este link expirou" };
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
    console.error("Erro ao consumir token:", error);
    return { success: false, error: "Erro ao processar token. Tente novamente." };
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
      .where("user_id", "==", userId)
      .where("used_at", "==", null)
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
    console.error("Erro ao invalidar tokens do usuário:", error);
    // Não lançar erro - invalidação é operação de limpeza
  }
}

/**
 * Gera o link completo de reset de senha
 */
export function generateResetLink(token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "https://curvamestra.com.br";
  return `${base}/reset-password/${token}`;
}
