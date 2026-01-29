/**
 * Firebase Functions - Curva Mestra
 *
 * IMPORTANTE: Para deploy das funções de email, configure os secrets primeiro:
 * firebase functions:secrets:set SMTP_USER
 * firebase functions:secrets:set SMTP_PASS
 */

// Função de teste de e-mail
export {sendTestEmail} from "./sendTestEmail";

// Triggers automáticos de e-mail
export {onUserCreated} from "./onUserCreated";
export {onTenantCreated} from "./onTenantCreated";
export {onAccessRequestCreated} from "./onAccessRequestCreated";

// Scheduled Functions - Licenças
export { checkLicenseExpiration } from "./checkLicenseExpiration";

// PagBank Integration
export { createPagBankSubscription } from "./createPagBankSubscription";
export { pagbankWebhook } from "./pagbankWebhook";

// Callable Functions - E-mails personalizados
export { sendCustomEmail } from "./sendCustomEmail";
export { sendTempPasswordEmail } from "./sendTemporaryPasswordEmail";
export { sendAccessRejectionEmail } from "./sendRejectionEmail";

// Firestore Triggers - Fila de E-mails
export { processEmailQueue } from "./processEmailQueue";

// Function placeholder para evitar erro de "no functions"
import {onRequest} from "firebase-functions/v2/https";

export const placeholder = onRequest(
  {region: "southamerica-east1"},
  (req, res) => {
    res.json({message: "Firebase Functions configuradas com sucesso"});
  }
);
