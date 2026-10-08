/**
 * Cloud Function: Check Consultant Pending Access Requests Scheduled (UC-57)
 * Roda diariamente às 08:00 (America/Sao_Paulo) e envia, a cada consultor
 * ATIVO com uma ou mais solicitações de acesso `pendente` vinculadas ao seu
 * `consultant_id` (UC-01 RN-08), UM único e-mail consolidando todas elas
 * (RN-01/RN-02). O critério é só "existe pendência vinculada" — independe de a
 * janela de exclusividade de 48h de UC-56 ainda valer (RN-03). Consultores sem
 * pendências não recebem nada. Somente leitura sobre access_requests/
 * consultants; a única escrita é em `email_queue` (consumida por
 * processEmailQueue).
 *
 * Cadência: offset de 1h em relação a checkAlertsScheduled (06:00) e
 * checkClaimsIntegrityScheduled (07:00), mesmo padrão arquitetural (RN-05/RN-06).
 *
 * LACUNA DE TESTE CONHECIDA: `npm run test:e2e` sobe só auth/firestore/storage
 * no Emulator Suite (não `functions`), então este agendamento, as queries e a
 * escrita em email_queue não têm cobertura automatizada. Só a parte pura (montagem
 * do e-mail, consultantPendingRequestsDigest.ts) é testada, via Jest, na sua
 * fonte canônica em src/lib.
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { getRenderedEmailTemplate } from './services/emailTemplateService';
import {
  buildConsultantDigestVariables,
  type PendingRequestDigestItem,
} from './consultantPendingRequestsDigest';

const DIGEST_TEMPLATE = 'consultant_pending_access_requests_digest';

function toDateOrNull(value: unknown): Date | null {
  const v = value as { toDate?: () => Date } | undefined;
  return v?.toDate ? v.toDate() : null;
}

export const checkConsultantPendingAccessRequestsScheduled = functions.scheduler.onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    // Mesmo guard de checkAlertsScheduled.ts -- onSchedule não garante
    // admin.initializeApp() (UC-42/RN-11); checar o app "[DEFAULT]" via admin.app().
    try {
      admin.app();
    } catch {
      admin.initializeApp();
    }

    // Lazy (dentro do handler), mesmo motivo de processEmailQueue.ts.
    const db = admin.firestore();
    console.log('🔍 Iniciando lembrete diário de solicitações pendentes para consultores...');

    // Falha aqui (8c) derruba a execução inteira: registrada em log, próxima
    // tentativa é a execução do dia seguinte.
    const consultantsSnap = await db
      .collection('consultants')
      .where('status', '==', 'active')
      .get();

    let processed = 0;
    let emailsQueued = 0;
    let failures = 0;

    for (const consultantDoc of consultantsSnap.docs) {
      processed++;
      const consultant = consultantDoc.data();
      try {
        const pendingSnap = await db
          .collection('access_requests')
          .where('consultant_id', '==', consultantDoc.id)
          .where('status', '==', 'pendente')
          .get();

        if (pendingSnap.empty) continue;

        if (!consultant.email) {
          console.warn(`⚠️ Consultor ${consultantDoc.id} sem e-mail — lembrete não enviado`);
          continue;
        }

        const items: PendingRequestDigestItem[] = pendingSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            full_name: data.full_name || '',
            business_name: data.business_name || '',
            created_at: toDateOrNull(data.created_at),
          };
        });

        const { subject, html } = await getRenderedEmailTemplate(
          DIGEST_TEMPLATE,
          buildConsultantDigestVariables(consultant.name || '', items)
        );

        await db.collection('email_queue').add({
          to: consultant.email,
          subject,
          body: html,
          status: 'pending',
          type: DIGEST_TEMPLATE,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          metadata: { consultant_id: consultantDoc.id, pending_count: items.length },
        });
        emailsQueued++;
      } catch (error) {
        // RN-04: falha isolada por consultor não interrompe os demais.
        failures++;
        console.error(`❌ Falha ao processar consultor ${consultantDoc.id}:`, error);
      }
    }

    console.log(
      `✅ Lembrete diário concluído: ${processed} consultor(es) ativo(s) processado(s), ${emailsQueued} e-mail(s) enfileirado(s), ${failures} falha(s)`
    );
  }
);
