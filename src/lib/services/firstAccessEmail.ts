/**
 * Envio do e-mail de boas-vindas com link de primeiro acesso (72 h, uso
 * único). Usado por todos os pontos de criação de usuário.
 * Ver ONLY_FOR_DEVS/TO_DO/FEAT-padronizacao-emails-e-links-de-senha.md (§6.2).
 */

import { createPasswordToken, generateResetLink } from '@/lib/services/passwordResetService';
import { enqueueTemplatedEmail } from '@/lib/services/emailTemplateAdmin';

export async function sendFirstAccessEmail(params: {
  tipo: 'generic_user_welcome' | 'consultant_welcome' | 'welcome_approval';
  userId: string;
  email: string;
  createdBy: string;
  tenantId?: string;
  /** Recebe o link e devolve as variáveis do template. */
  variables: (firstAccessLink: string) => Record<string, string>;
}): Promise<boolean> {
  // Falha aqui não desfaz a criação do usuário: ele recupera o acesso
  // por "Esqueci minha senha".
  try {
    const { token, expiresAt } = await createPasswordToken({
      userId: params.userId,
      userEmail: params.email,
      createdBy: params.createdBy,
      purpose: 'first_access',
      tenantId: params.tenantId,
    });

    await enqueueTemplatedEmail(
      params.tipo,
      params.email,
      params.variables(generateResetLink(token)),
      {
        metadata: {
          user_id: params.userId,
          ...(params.tenantId && { tenant_id: params.tenantId }),
          expires_at: expiresAt.toISOString(),
          origin: 'first_access',
        },
      }
    );
    return true;
  } catch (error) {
    console.warn(
      `Falha ao enviar link de primeiro acesso (${params.tipo}) para ${params.email}:`,
      error
    );
    return false;
  }
}
