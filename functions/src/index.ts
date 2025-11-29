/**
 * Firebase Functions - Curva Mestra
 *
 * NOTA: Algumas functions estão temporariamente desabilitadas
 * para permitir o deploy inicial. Serão habilitadas após
 * configuração dos secrets SMTP.
 */

// Função de teste de e-mail
// export {sendTestEmail} from "./sendTestEmail";

// Triggers automáticos de e-mail
// export {onUserCreated} from "./onUserCreated";
// export {onTenantCreated} from "./onTenantCreated";

// Scheduled Functions - Licenças
export { checkLicenseExpiration } from "./checkLicenseExpiration";

// Function placeholder para evitar erro de "no functions"
import {onRequest} from "firebase-functions/v2/https";

export const placeholder = onRequest((req, res) => {
  res.json({message: "Firebase Functions configuradas com sucesso"});
});
