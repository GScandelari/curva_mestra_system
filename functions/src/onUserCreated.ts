/**
 * Trigger: Envia e-mail de boas-vindas quando um novo usuário é criado
 * Trigger: firestore document created em tenants/{tenantId}/users/{userId}
 */

import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {sendWelcomeEmail} from "./services/emailService";

export const onUserCreated = onDocumentCreated(
  {
    document: "tenants/{tenantId}/users/{userId}",
    region: "southamerica-east1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const userData = snapshot.data();
    const {email, displayName, role} = userData;

    if (!email || !displayName) {
      console.log("Usuário sem e-mail ou nome, pulando envio");
      return;
    }

    try {
      console.log(`📧 Enviando e-mail de boas-vindas para ${email}...`);

      await sendWelcomeEmail(email, displayName, role);

      console.log(`✅ E-mail enviado com sucesso para ${email}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail para ${email}:`, error);
      // Não vamos lançar erro para não quebrar o fluxo de criação do usuário
    }
  }
);
