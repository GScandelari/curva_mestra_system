/**
 * Serviço de envio de e-mails usando SMTP do Zoho Mail
 */

import * as nodemailer from "nodemailer";

/**
 * Configuração do transporter Nodemailer
 * SMTP credentials são passados via variáveis de ambiente pelo Cloud Functions
 */
function getEmailTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP credentials not configured. Set SMTP_USER and SMTP_PASS secrets.");
  }

  return nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 587,
    secure: false, // true para 465, false para outros ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

/**
 * Interface para opções de envio de e-mail
 */
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Envia um e-mail usando SMTP do Zoho
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const transporter = getEmailTransporter();

  const mailOptions = {
    from: options.from || `"Curva Mestra" <scandelari.guilherme@curvamestra.com.br>`,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ""), // Fallback text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ E-mail enviado com sucesso:", info.messageId);
    console.log("   Para:", mailOptions.to);
    console.log("   Assunto:", mailOptions.subject);
  } catch (error) {
    console.error("❌ Erro ao enviar e-mail:", error);
    throw new Error("Falha ao enviar e-mail");
  }
}

/**
 * Envia e-mail de boas-vindas para novo usuário
 */
export async function sendWelcomeEmail(
  email: string,
  displayName: string,
  role: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .role-badge {
            display: inline-block;
            padding: 4px 12px;
            background: #f3f4f6;
            border-radius: 4px;
            font-size: 14px;
            color: #374151;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Bem-vindo ao Curva Mestra!</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${displayName}</strong>,</p>

          <p>Sua conta foi criada com sucesso no <strong>Curva Mestra</strong>, o sistema completo de gestão de estoque para clínicas de harmonização facial e corporal.</p>

          <p>Seu perfil: <span class="role-badge">${getRoleName(role)}</span></p>

          <p><strong>O que você pode fazer agora:</strong></p>
          <ul>
            <li>Acessar o sistema com seu e-mail e senha</li>
            <li>Gerenciar estoque de produtos Rennova</li>
            <li>Controlar lotes e validades</li>
            <li>Criar solicitações de produtos</li>
          </ul>

          <div style="text-align: center;">
            <a href="https://curva-mestra.web.app/login" class="button">Acessar o Sistema</a>
          </div>

          <p>Se você tiver alguma dúvida, entre em contato conosco respondendo este e-mail.</p>

          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p>Este é um e-mail automático, por favor não responda.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "🎉 Bem-vindo ao Curva Mestra!",
    html,
  });
}

/**
 * Envia e-mail com senha temporária para novo usuário aprovado
 */
export async function sendTemporaryPasswordEmail(
  email: string,
  displayName: string,
  temporaryPassword: string,
  businessName: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .password-box {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            margin: 20px 0;
            text-align: center;
          }
          .password {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
          }
          .alert-box {
            background: #fef3c7;
            border: 1px solid #fbbf24;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Sua Solicitação foi Aprovada!</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${displayName}</strong>,</p>

          <p>Sua solicitação de acesso ao <strong>Curva Mestra</strong> foi aprovada! A clínica <strong>${businessName}</strong> já está ativa no sistema.</p>

          <div class="alert-box">
            <p><strong>⚠️ Importante: Senha Temporária</strong></p>
            <p>Por segurança, geramos uma senha temporária para seu primeiro acesso. Você deverá alterá-la após o primeiro login.</p>
          </div>

          <div class="password-box">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Sua senha temporária:</p>
            <p class="password">${temporaryPassword}</p>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">
              Esta senha é válida apenas para o primeiro acesso
            </p>
          </div>

          <p><strong>Seus dados de acesso:</strong></p>
          <ul>
            <li><strong>E-mail:</strong> ${email}</li>
            <li><strong>Senha:</strong> (veja acima)</li>
          </ul>

          <div style="text-align: center;">
            <a href="https://curva-mestra.web.app/login" class="button">Fazer Login</a>
          </div>

          <p><strong>Próximos passos:</strong></p>
          <ol>
            <li>Faça login com seu e-mail e senha temporária</li>
            <li>Altere sua senha no primeiro acesso</li>
            <li>Complete o processo de onboarding</li>
            <li>Selecione seu plano de assinatura</li>
            <li>Comece a usar o sistema!</li>
          </ol>

          <p>Se você tiver alguma dúvida, entre em contato conosco respondendo este e-mail.</p>

          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p><strong>IMPORTANTE:</strong> Nunca compartilhe sua senha com terceiros.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "🎉 Sua Solicitação foi Aprovada - Senha Temporária",
    html,
  });
}

/**
 * Envia e-mail de rejeição de solicitação de acesso
 */
export async function sendRejectionEmail(
  email: string,
  displayName: string,
  businessName: string,
  rejectionReason?: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .alert-box {
            background: #fef2f2;
            border: 1px solid #fecaca;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Solicitação Não Aprovada</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${displayName}</strong>,</p>

          <p>Agradecemos seu interesse no <strong>Curva Mestra</strong>.</p>

          <div class="alert-box">
            <p><strong>Status da Solicitação:</strong> Não Aprovada</p>
            <p><strong>Clínica:</strong> ${businessName}</p>
          </div>

          ${
  rejectionReason
    ? `
          <p><strong>Motivo:</strong></p>
          <p>${rejectionReason}</p>
          `
    : ""
}

          <p>Infelizmente, sua solicitação de acesso antecipado não pôde ser aprovada no momento.</p>

          <p><strong>O que você pode fazer:</strong></p>
          <ul>
            <li>Entrar em contato conosco para mais informações</li>
            <li>Enviar uma nova solicitação com informações atualizadas</li>
            <li>Aguardar o lançamento oficial do sistema</li>
          </ul>

          <div style="text-align: center;">
            <a href="https://curva-mestra.web.app/early-access" class="button">Nova Solicitação</a>
          </div>

          <p>Se você tiver alguma dúvida ou acredita que houve um erro, entre em contato conosco respondendo este e-mail.</p>

          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Atualização sobre sua Solicitação - Curva Mestra",
    html,
  });
}

/**
 * NOTA: sendMagicLinkEmail foi removido
 * Magic Link foi removido por questões de segurança
 * Sistema usa apenas login tradicional com e-mail e senha
 */

/**
 * Envia e-mail de notificação de nova clínica criada
 */
export async function sendNewTenantNotification(
  tenantName: string,
  tenantEmail: string,
  planId: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .info-box {
            background: #f9fafb;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎊 Nova Clínica Cadastrada!</h1>
        </div>
        <div class="content">
          <p>Uma nova clínica foi cadastrada no sistema:</p>

          <div class="info-box">
            <p><strong>Nome:</strong> ${tenantName}</p>
            <p><strong>E-mail:</strong> ${tenantEmail}</p>
            <p><strong>Plano:</strong> ${getPlanName(planId)}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleString("pt-BR")}</p>
          </div>

          <p>A clínica já está ativa e pode começar a usar o sistema.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: "scandelari.guilherme@curvamestra.com.br", // Notificação para admin
    subject: `🎊 Nova Clínica: ${tenantName}`,
    html,
  });
}

/**
 * Helper para obter nome legível da role
 */
function getRoleName(role: string): string {
  const roles: Record<string, string> = {
    "system_admin": "Administrador do Sistema",
    "clinic_admin": "Administrador da Clínica",
    "clinic_user": "Usuário da Clínica",
  };
  return roles[role] || role;
}

/**
 * Helper para obter nome legível do plano
 */
function getPlanName(planId: string): string {
  const plans: Record<string, string> = {
    "semestral": "Plano Semestral (R$ 59,90/mês)",
    "anual": "Plano Anual (R$ 59,90/mês)",
  };
  return plans[planId] || planId;
}
