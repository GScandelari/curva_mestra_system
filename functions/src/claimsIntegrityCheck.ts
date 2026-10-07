/**
 * Claims Integrity Check (Admin SDK) — verificação proativa de consistência
 * entre o Firestore (`users/{uid}`, fonte de verdade) e os custom claims
 * reais do Firebase Auth, para usuários `clinic_admin`/`clinic_user`.
 *
 * Motivação: um bug real em produção (corrigido em
 * `src/app/api/tenants/create/route.ts`) deixava um usuário com custom
 * claims vazios quando `setCustomUserClaims` falhava e o erro era apenas
 * logado, sem rollback -- quebrando todo o acesso ao Firestore escopado por
 * tenant (toda regra depende de `request.auth.token.tenant_id`). Esta
 * verificação é a rede de segurança para falhas desse tipo (conhecidas ou
 * ainda não descobertas), chamada tanto pela Scheduled Function
 * (`checkClaimsIntegrityScheduled.ts`) quanto pela Callable Function sob
 * demanda (`checkClaimsIntegrityOnDemand.ts`).
 *
 * Mesmo padrão arquitetural de alertChecks.ts/checkAlertsScheduled.ts:
 * lógica pura de comparação em claimsIntegrityRules.ts (espelho de
 * src/lib/claimsIntegrityRules.ts), orquestração com Firestore/Auth aqui.
 */

import * as admin from 'firebase-admin';
import { defineString } from 'firebase-functions/params';
import { diffClaims, ExpectedClaims } from './claimsIntegrityRules';
import { sendEmail } from './services/emailService';

// Mesmo parâmetro/mesmo padrão de onAccessRequestCreated.ts -- reaproveitado
// aqui para o alerta interno de integridade de claims.
const SYSTEM_ADMIN_EMAIL = defineString('SYSTEM_ADMIN_EMAIL', {
  default: 'scandelari.guilherme@curvamestra.com.br',
  description: 'E-mail do system_admin para receber alertas internos (integridade de claims etc.)',
});

const CLINIC_ROLES = ['clinic_admin', 'clinic_user'] as const;

export interface ClaimsMismatch {
  uid: string;
  email: string;
  tenant_id: string;
  role: string;
  issues: string[];
}

export interface ClaimsIntegrityResult {
  checked: number;
  mismatches: ClaimsMismatch[];
}

/**
 * Lista todos os usuários `clinic_admin`/`clinic_user` no Firestore e
 * compara os custom claims reais (Firebase Auth) contra o esperado
 * (`tenant_id`/`role`/`active` do próprio documento Firestore).
 */
export async function checkClaimsIntegrity(
  db: admin.firestore.Firestore,
  authAdmin: admin.auth.Auth
): Promise<ClaimsIntegrityResult> {
  const result: ClaimsIntegrityResult = { checked: 0, mismatches: [] };

  const usersSnap = await db.collection('users').where('role', 'in', CLINIC_ROLES).get();
  result.checked = usersSnap.size;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();

    const expected: ExpectedClaims = {
      tenant_id: data.tenant_id,
      role: data.role,
      active: data.active === true,
    };

    try {
      const userRecord = await authAdmin.getUser(uid);
      const issues = diffClaims(expected, userRecord.customClaims as ExpectedClaims | undefined);

      if (issues.length > 0) {
        result.mismatches.push({
          uid,
          email: data.email || userRecord.email || '(sem e-mail)',
          tenant_id: expected.tenant_id,
          role: expected.role,
          issues,
        });
      }
    } catch (error: any) {
      // Usuário existe no Firestore mas não foi possível lê-lo no Auth
      // (ex.: deletado diretamente no Auth, ou outra falha de leitura) --
      // também é uma divergência de integridade que merece alerta.
      result.mismatches.push({
        uid,
        email: data.email || '(sem e-mail)',
        tenant_id: expected.tenant_id,
        role: expected.role,
        issues: [
          `Não foi possível ler o usuário no Firebase Auth: ${error.message || 'erro desconhecido'}`,
        ],
      });
    }
  }

  return result;
}

function buildAlertEmailHtml(mismatches: ClaimsMismatch[]): string {
  const rows = mismatches
    .map(
      (m) => `
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;">${m.email}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${m.uid}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${m.tenant_id}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${m.role}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${m.issues.join('<br>')}</td>
        </tr>`
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
        <h2 style="color:#b91c1c;">⚠️ Divergência de custom claims detectada</h2>
        <p>A verificação de integridade de claims encontrou <strong>${mismatches.length}</strong>
        usuário(s) cujos custom claims (Firebase Auth) não batem com o documento
        Firestore correspondente (<code>users/{uid}</code>, fonte de verdade).</p>
        <p>Isso pode quebrar o acesso do usuário a dados escopados por tenant.
        Corrija manualmente no painel de administração.</p>
        <table style="border-collapse: collapse; width: 100%; margin-top: 16px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">E-mail</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">UID</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Tenant</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Role</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Divergências</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

/** Envia o e-mail de alerta ao system_admin com a lista de divergências encontradas. */
export async function sendClaimsIntegrityAlertEmail(mismatches: ClaimsMismatch[]): Promise<void> {
  await sendEmail({
    to: SYSTEM_ADMIN_EMAIL.value(),
    subject: `⚠️ Divergência de custom claims detectada (${mismatches.length})`,
    html: buildAlertEmailHtml(mismatches),
  });
}

/**
 * Executa a verificação completa e, se houver divergências, envia o alerta
 * por e-mail. Usado tanto pela Scheduled Function quanto pela Callable
 * Function sob demanda -- ponto único de orquestração.
 */
export async function runClaimsIntegrityCheck(
  db: admin.firestore.Firestore,
  authAdmin: admin.auth.Auth
): Promise<ClaimsIntegrityResult> {
  const result = await checkClaimsIntegrity(db, authAdmin);

  if (result.mismatches.length > 0) {
    try {
      await sendClaimsIntegrityAlertEmail(result.mismatches);
    } catch (emailError) {
      console.error('❌ Erro ao enviar e-mail de alerta de integridade de claims:', emailError);
      // Não falhar a verificação por isso -- o resultado já foi calculado
      // e será retornado/logado mesmo que o e-mail não saia.
    }
  }

  return result;
}
