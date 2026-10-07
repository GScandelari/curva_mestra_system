/**
 * Callable Function: Check Claims Integrity On Demand
 * Permite que o system_admin dispare, a qualquer momento pelo painel
 * (`/admin/settings`), a mesma verificação de integridade de claims rodada
 * diariamente por checkClaimsIntegrityScheduled.ts -- reaproveita a mesma
 * função de orquestração (claimsIntegrityCheck.ts), ponto único de lógica.
 * Mesmo padrão de autenticação/autorização de sendTemplateTestEmail.ts.
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { runClaimsIntegrityCheck } from './claimsIntegrityCheck';

export const checkClaimsIntegrityOnDemand = functions.https.onCall(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const isSystemAdmin = request.auth.token.is_system_admin === true;
    if (!isSystemAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Apenas administradores do sistema podem executar esta verificação'
      );
    }

    // Mesmo guard de checkAlertsScheduled.ts/claimsIntegrityCheck.ts.
    try {
      admin.app();
    } catch {
      admin.initializeApp();
    }

    const db = admin.firestore();
    const authAdmin = admin.auth();

    try {
      console.log(
        `🔍 Verificação de integridade de claims disparada sob demanda por ${request.auth.uid}`
      );
      const result = await runClaimsIntegrityCheck(db, authAdmin);
      console.log(
        `✅ Verificação sob demanda concluída: ${result.checked} usuários verificados, ${result.mismatches.length} divergência(s) encontrada(s)`
      );

      return {
        checked: result.checked,
        mismatches: result.mismatches,
      };
    } catch (error: unknown) {
      console.error('❌ Erro ao executar verificação de integridade de claims:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new functions.https.HttpsError('internal', `Falha ao verificar claims: ${message}`);
    }
  }
);
