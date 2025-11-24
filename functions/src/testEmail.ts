/**
 * Cloud Function para testar envio de e-mail
 * Endpoint: POST /testEmail
 */

import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {sendWelcomeEmail} from "./services/emailService";

// Definir secrets localmente
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");

export const testEmail = onRequest(
  {
    secrets: [SMTP_USER, SMTP_PASS],
    cors: true,
  },
  async (req, res) => {
    // Apenas permitir em desenvolvimento/teste
    const allowedEmails = [
      "scandelari.guilherme@curvamestra.com.br",
      "guilherme@exemplo.com", // Seu e-mail pessoal para teste
    ];

    const {type, email} = req.body;

    if (!allowedEmails.includes(email)) {
      res.status(403).json({
        error: "E-mail não autorizado para teste",
      });
      return;
    }

    try {
      if (type === "welcome") {
        await sendWelcomeEmail(
          email,
          "Guilherme Scandelari",
          "system_admin"
        );
      } else {
        res.status(400).json({
          error: "Tipo de e-mail inválido. Use 'welcome'",
        });
        return;
      }

      res.json({
        success: true,
        message: `E-mail de teste '${type}' enviado para ${email}`,
      });
    } catch (error) {
      console.error("Erro ao enviar e-mail de teste:", error);
      res.status(500).json({
        error: "Erro ao enviar e-mail de teste",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);
