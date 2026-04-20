/**
 * Cloud Function: Check License Expiration
 * Executa diariamente às 00:00 para verificar licenças expiradas
 * e enviar alertas para licenças próximas da expiração
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// Inicializar Firebase Admin se ainda não foi inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const checkLicenseExpiration = functions.scheduler.onSchedule(
  {
    schedule: '0 0 * * *', // Todos os dias às 00:00 UTC
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (event) => {
    console.log('🕐 Iniciando verificação de licenças...');

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Buscar licenças ativas que já expiraram
      const expiredQuery = await db
        .collection('licenses')
        .where('status', '==', 'ativa')
        .where('end_date', '<', now)
        .get();

      console.log(`📋 Encontradas ${expiredQuery.size} licenças expiradas`);

      // Marcar como expiradas
      const expiredBatch = db.batch();
      expiredQuery.docs.forEach((doc) => {
        expiredBatch.update(doc.ref, {
          status: 'expirada',
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`❌ Licença ${doc.id} marcada como expirada`);
      });

      await expiredBatch.commit();

      // 2. Buscar licenças que expiram em 15 dias
      const fifteenDaysFromNow = new Date();
      fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

      const expiringSoonQuery = await db
        .collection('licenses')
        .where('status', '==', 'ativa')
        .where('end_date', '<=', admin.firestore.Timestamp.fromDate(fifteenDaysFromNow))
        .where('end_date', '>=', now)
        .get();

      console.log(`⚠️ Encontradas ${expiringSoonQuery.size} licenças expirando em breve`);

      // Criar notificações para licenças expirando
      const notificationPromises = expiringSoonQuery.docs.map(async (doc) => {
        const license = doc.data();
        const daysRemaining = Math.ceil(
          (license.end_date.toDate().getTime() - now.toDate().getTime()) / (1000 * 60 * 60 * 24)
        );

        // Criar notificação no tenant
        const notificationRef = db
          .collection('tenants')
          .doc(license.tenant_id)
          .collection('notifications');

        await notificationRef.add({
          tipo: 'licenca_expirando',
          titulo: '⚠️ Licença Expirando em Breve',
          mensagem: `Sua licença expira em ${daysRemaining} dias. Renove para manter o acesso ao sistema.`,
          lida: false,
          priority: daysRemaining <= 7 ? 'high' : 'medium',
          data: {
            license_id: doc.id,
            days_remaining: daysRemaining,
            end_date: license.end_date,
          },
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `📧 Notificação criada para tenant ${license.tenant_id} (${daysRemaining} dias)`
        );
      });

      await Promise.all(notificationPromises);

      // 3. Processar renovações automáticas
      const autoRenewQuery = await db
        .collection('licenses')
        .where('status', '==', 'ativa')
        .where('auto_renew', '==', true)
        .where('end_date', '<=', admin.firestore.Timestamp.fromDate(fifteenDaysFromNow))
        .get();

      console.log(`🔄 Encontradas ${autoRenewQuery.size} licenças para renovação automática`);

      const renewBatch = db.batch();
      autoRenewQuery.docs.forEach((doc) => {
        const license = doc.data();
        const currentEndDate = license.end_date.toDate();
        const newEndDate = new Date(currentEndDate);

        // Adicionar 1 ano
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);

        renewBatch.update(doc.ref, {
          end_date: admin.firestore.Timestamp.fromDate(newEndDate),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Licença ${doc.id} renovada até ${newEndDate.toLocaleDateString('pt-BR')}`);
      });

      await renewBatch.commit();

      console.log('✅ Verificação de licenças concluída com sucesso!');
      console.log(
        `📊 Resumo: ${expiredQuery.size} expiradas, ${expiringSoonQuery.size} expirando, ${autoRenewQuery.size} renovadas`
      );
    } catch (error) {
      console.error('❌ Erro ao verificar licenças:', error);
      throw error;
    }
  }
);
