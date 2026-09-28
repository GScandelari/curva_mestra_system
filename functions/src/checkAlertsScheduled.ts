/**
 * Cloud Function: Check Alerts Scheduled
 * Roda diariamente e executa as verificações de alerta (vencimento,
 * vencido, estoque baixo) para todos os tenants ativos — fecha o débito
 * técnico de UC-15-RN-05/UC-42-RN-05 (dependia 100% de acionamento manual).
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { runChecksForAllTenants } from './alertChecks';

export const checkAlertsScheduled = functions.scheduler.onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    // admin.initializeApp() nunca é chamado em nenhum outro lugar do projeto --
    // ao contrário de onDocumentCreated/callables (que parecem inicializar o app
    // como efeito colateral de declarar `secrets`, comportamento não documentado
    // e não confiável), onSchedule não faz isso. Sem esta chamada, admin.firestore()
    // lança "The default Firebase app does not exist" -- confirmado em produção e
    // dev via `gcloud functions logs read` após forçar a execução do job.
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    // admin.firestore() é acessado aqui dentro (lazy), e não no topo do módulo --
    // mesmo motivo de processEmailQueue.ts.
    const db = admin.firestore();
    console.log('🔍 Iniciando verificação diária agendada de alertas...');
    const results = await runChecksForAllTenants(db);
    console.log(
      `✅ Verificação diária concluída: ${results.tenantsProcessed} tenants processados, ${results.totalNotifications} notificações criadas`
    );
    if (Object.keys(results.errors).length > 0) {
      console.error('⚠️ Tenants com erros:', JSON.stringify(results.errors));
    }
  }
);
