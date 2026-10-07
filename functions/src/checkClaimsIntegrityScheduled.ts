/**
 * Cloud Function: Check Claims Integrity Scheduled
 * Roda diariamente e verifica, para todo usuário `clinic_admin`/
 * `clinic_user`, se os custom claims reais (Firebase Auth) batem com o
 * documento Firestore correspondente (`users/{uid}`, fonte de verdade).
 * Rede de segurança permanente para a classe de bug corrigida em
 * `src/app/api/tenants/create/route.ts` (claims podiam ficar vazios/
 * divergentes silenciosamente). Ver claimsIntegrityCheck.ts.
 *
 * Cadência diária (1h depois de checkAlertsScheduled, que roda às 06:00):
 * claims só mudam em eventos raros (criação/edição de conta), então esta
 * é uma rede de segurança, não precisa de granularidade maior que diária;
 * o offset de 1h evita duas Scheduled Functions competindo por recursos
 * no mesmo horário.
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { runClaimsIntegrityCheck } from './claimsIntegrityCheck';

export const checkClaimsIntegrityScheduled = functions.scheduler.onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    // Mesmo guard de checkAlertsScheduled.ts -- onSchedule não garante
    // admin.initializeApp() ter sido chamado em nenhum outro lugar.
    try {
      admin.app();
    } catch {
      admin.initializeApp();
    }

    const db = admin.firestore();
    const authAdmin = admin.auth();

    console.log('🔍 Iniciando verificação diária agendada de integridade de claims...');
    const result = await runClaimsIntegrityCheck(db, authAdmin);
    console.log(
      `✅ Verificação diária de claims concluída: ${result.checked} usuários verificados, ${result.mismatches.length} divergência(s) encontrada(s)`
    );
    if (result.mismatches.length > 0) {
      console.error('⚠️ Divergências de claims encontradas:', JSON.stringify(result.mismatches));
    }
  }
);
