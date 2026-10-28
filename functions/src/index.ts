/**
 * Firebase Functions - Curva Mestra
 *
 * IMPORTANTE: Para deploy das funções de email, configure os secrets primeiro:
 * firebase functions:secrets:set SMTP_USER
 * firebase functions:secrets:set SMTP_PASS
 */

// Função de teste de e-mail
export { sendTestEmail } from './sendTestEmail';

// Triggers automáticos de e-mail
export { onTenantCreated } from './onTenantCreated';
export { onAccessRequestCreated } from './onAccessRequestCreated';

// Callable Functions - E-mails personalizados
export { sendCustomEmail } from './sendCustomEmail';
export { sendTempPasswordEmail } from './sendTemporaryPasswordEmail';
export { sendAccessRejectionEmail } from './sendRejectionEmail';
export { sendTemplateTestEmail } from './sendTemplateTestEmail';

// Firestore Triggers - Fila de E-mails
export { processEmailQueue } from './processEmailQueue';

// Scheduled Functions - Verificação Automática de Alertas
export { checkAlertsScheduled } from './checkAlertsScheduled';

// Scheduled + Callable Functions - Verificação de Integridade de Custom Claims
export { checkClaimsIntegrityScheduled } from './checkClaimsIntegrityScheduled';
export { checkClaimsIntegrityOnDemand } from './checkClaimsIntegrityOnDemand';

// Scheduled Function - Lembrete diário de solicitações de acesso pendentes (UC-57)
export { checkConsultantPendingAccessRequestsScheduled } from './checkConsultantPendingAccessRequestsScheduled';

// Firestore Trigger + Callable - Incorporação automática de produtos pendentes de NF-e
export { onMasterProductWritten } from './onMasterProductWritten';
export { reprocessPendingMasterProducts } from './reprocessPendingMasterProducts';

// Function placeholder para evitar erro de "no functions"
import { onRequest } from 'firebase-functions/v2/https';

export const placeholder = onRequest({ region: 'southamerica-east1' }, (req, res) => {
  res.json({ message: 'Firebase Functions configuradas com sucesso' });
});
