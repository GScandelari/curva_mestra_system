/**
 * Firebase Functions - Curva Mestra
 *
 * NOTA: Algumas functions estão temporariamente desabilitadas
 * para permitir o deploy inicial. Serão habilitadas após
 * configuração dos secrets SMTP.
 */

// Função de teste de e-mail
export {sendTestEmail} from "./sendTestEmail";

// Triggers automáticos de e-mail
// export {onUserCreated} from "./onUserCreated";
// export {onTenantCreated} from "./onTenantCreated";

// Scheduled Functions - Licenças
export { checkLicenseExpiration } from "./checkLicenseExpiration";

// PagBank Integration
export { createPagBankSubscription } from "./createPagBankSubscription";
export { pagbankWebhook } from "./pagbankWebhook";

// Callable Functions - E-mails personalizados
export { sendCustomEmail } from "./sendCustomEmail";

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
