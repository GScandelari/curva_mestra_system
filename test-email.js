/**
 * Script simples para testar envio de e-mail via Zoho SMTP
 * Uso: node test-email.js destinatario@email.com
 */

const nodemailer = require('nodemailer');

// Configuração SMTP do Zoho
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 587,
  secure: false, // true para 465, false para outros ports
  auth: {
    user: 'scandelari.guilherme@curvamestra.com.br',
    pass: '$I6479647z'
  }
});

// E-mail de destino (usa argumento da linha de comando ou padrão)
const destinatario = process.argv[2] || 'scandelari.guilherme@curvamestra.com.br';

// Configurações do e-mail
const mailOptions = {
  from: '"Curva Mestra - Teste" <scandelari.guilherme@curvamestra.com.br>',
  to: destinatario,
  subject: '✅ Teste de E-mail - Curva Mestra',
  html: `
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
          .success-box {
            background: #d1fae5;
            border: 2px solid #10b981;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
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
          <h1>✅ Sistema de E-mail Funcionando!</h1>
        </div>
        <div class="content">
          <div class="success-box">
            <p><strong>🎉 Sucesso!</strong></p>
            <p>O serviço de e-mail do Curva Mestra está configurado e funcionando corretamente.</p>
          </div>

          <p><strong>Informações do Teste:</strong></p>
          <div class="info-box">
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
            <p><strong>Servidor SMTP:</strong> smtp.zoho.com</p>
            <p><strong>Porta:</strong> 587 (STARTTLS)</p>
            <p><strong>Remetente:</strong> scandelari.guilherme@curvamestra.com.br</p>
            <p><strong>Destinatário:</strong> ${destinatario}</p>
          </div>

          <p>Este é um e-mail de teste automático gerado para verificar a configuração do serviço de envio de e-mails transacionais.</p>

          <p><strong>Próximos passos:</strong></p>
          <ul>
            <li>✅ Configuração SMTP verificada</li>
            <li>✅ Conectividade com Zoho Mail confirmada</li>
            <li>✅ Template HTML renderizado corretamente</li>
            <li>🔜 Integrar com Firebase Functions</li>
            <li>🔜 Implementar envios automáticos (boas-vindas, notificações, etc.)</li>
          </ul>

          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p>Sistema SaaS Multi-Tenant para Clínicas de Harmonização Facial e Corporal</p>
        </div>
      </body>
    </html>
  `
};

console.log('📧 Iniciando envio de e-mail de teste...');
console.log(`   Para: ${destinatario}`);
console.log('   Servidor: smtp.zoho.com:587\n');

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ Erro ao enviar e-mail:');
    console.error(error);
    process.exit(1);
  }

  console.log('✅ E-mail enviado com sucesso!');
  console.log(`   Message ID: ${info.messageId}`);
  console.log(`   Response: ${info.response}`);
  console.log('\n🎉 Teste concluído! Verifique a caixa de entrada de:', destinatario);
});
