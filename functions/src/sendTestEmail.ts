/**
 * Função simples para testar envio de e-mail via Zoho SMTP
 */

import {onRequest} from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";

export const sendTestEmail = onRequest(
  {
    cors: true,
    region: "southamerica-east1",
  },
  async (req, res) => {
    const {email, smtpUser, smtpPass} = req.body;

    if (!email || !smtpUser || !smtpPass) {
      res.status(400).json({error: "E-mail, smtpUser e smtpPass são obrigatórios"});
      return;
    }

    try {
      // Configurar transporter
      const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 587,
        secure: false,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Enviar e-mail de teste
      const info = await transporter.sendMail({
        from: '"Curva Mestra" <scandelari.guilherme@curvamestra.com.br>',
        to: email,
        subject: "🧪 Teste de E-mail - Curva Mestra",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Teste de E-mail Funcionou!</h1>
                </div>
                <div class="content">
                  <p>Parabéns! O sistema de e-mail do <strong>Curva Mestra</strong> está configurado corretamente.</p>
                  <p><strong>Detalhes do teste:</strong></p>
                  <ul>
                    <li>Servidor SMTP: smtp.zoho.com</li>
                    <li>Porta: 587 (TLS)</li>
                    <li>Data/Hora: ${new Date().toLocaleString("pt-BR")}</li>
                  </ul>
                  <p>Você está pronto para começar a enviar e-mails transacionais!</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      console.log("✅ E-mail enviado:", info.messageId);

      res.json({
        success: true,
        message: "E-mail de teste enviado com sucesso!",
        messageId: info.messageId,
        to: email,
      });
    } catch (error) {
      console.error("❌ Erro ao enviar e-mail:", error);
      res.status(500).json({
        error: "Erro ao enviar e-mail",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);
