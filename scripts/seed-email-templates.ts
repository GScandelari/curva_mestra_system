/**
 * Popula `email_templates/{tipo}` (UC-55) com os 12 gatilhos migrados —
 * conteúdo extraído literalmente do HTML hoje hardcoded em produção (Seção
 * 1.1/1.3 de FEAT-editor-templates-de-email.md), mais a elevação visual
 * mecânica (RN-13 do UC) para os 5 templates simples (#4-#8) que hoje não
 * têm nenhum wrapper visual. Nenhuma frase foi reescrita — só a estrutura
 * visual mudou para esses 5, e duas simplificações mecânicas foram feitas
 * para caber no contrato de variáveis fixo (RN-02 desta spec, "definida no
 * seed"):
 *   1. `access_request_created` (#13): o badge colorido CPF/CNPJ e a linha
 *      "Data:" (calculada no momento do envio) foram removidos — a lista de
 *      variáveis fixa aqui (Seção 6.2 da spec) não inclui esses dois dados
 *      resolvidos; nenhuma informação de negócio foi perdida (tipo/documento/
 *      nome/e-mail/empresa continuam, sem o estilo condicional).
 *   2. Toda ocorrência de `${new Date().getFullYear()}`/`.toLocaleString()`
 *      no HTML de origem foi congelada no valor calculado no momento em que
 *      este script roda (YEAR/SEEDED_AT abaixo) — não existe no motor de
 *      template (`renderTemplate`) um equivalente a "agora()"; RN-06 desta
 *      spec só cobre blocos condicionais pré-resolvidos pelo chamador, não
 *      valores dependentes do tempo. Risco aceito, documentado aqui.
 *
 * Gatilho #9 (`tenants/create`, corpo 100% livre por criação de clínica) é
 * propositalmente EXCLUÍDO deste seed — RN-14 do UC-55 (Seção 1.1.1 da spec).
 *
 * Idempotente: só cria um `tipo` se o documento ainda não existir. Passe
 * `--force` para sobrescrever os que já existem (útil para reaplicar uma
 * correção de conteúdo do seed em um ambiente já seedado).
 *
 * Uso:
 *   # Contra o Firebase Emulator (requer FIRESTORE_EMULATOR_HOST/
 *   # FIREBASE_AUTH_EMULATOR_HOST setados, ex.: via `firebase emulators:exec`):
 *   npx tsx scripts/seed-email-templates.ts
 *
 *   # Contra um projeto real (gscandelari_setup ou produção):
 *   npx tsx scripts/seed-email-templates.ts <caminho-para-service-account.json>
 *
 *   # Sobrescrevendo templates já existentes, em qualquer um dos dois modos:
 *   npx tsx scripts/seed-email-templates.ts [<service-account.json>] --force
 */

import type { EmailTemplateCategory, EmailTemplateVariable } from '../src/types';

const YEAR = new Date().getFullYear();
const SEEDED_AT = new Date().toLocaleString('pt-BR');

interface SeedTemplate {
  tipo: string;
  label: string;
  category: EmailTemplateCategory;
  related_uc: string;
  subject: string;
  body: string;
  variables: EmailTemplateVariable[];
}

function v(key: string, label: string, required: boolean, sample: string): EmailTemplateVariable {
  return { key, label, required, sample };
}

const TEMPLATES: SeedTemplate[] = [
  {
    tipo: 'welcome_approval',
    label: 'Aprovação de Solicitação de Acesso',
    category: 'email',
    related_uc: 'UC-02',
    subject: 'Sua Solicitação foi Aprovada - Curva Mestra',
    variables: [
      v('displayName', 'Nome de exibição do usuário', true, 'Maria Oliveira'),
      v('email', 'E-mail de acesso do usuário', true, 'maria@clinicaexemplo.com.br'),
      v(
        'businessName',
        'Nome da clínica (não usado no texto atual, disponível para uso futuro)',
        false,
        'Clínica Exemplo'
      ),
      v(
        'passwordResetLink',
        'Link de definição de senha (uso único, expira em 24h)',
        true,
        'https://curvamestra.com.br/reset-password?token=exemplo'
      ),
    ],
    body: `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #c9a24a 0%, #8a6b22 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Sua Solicitação foi Aprovada!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>{{displayName}}</strong>,</p>

          <p>Sua solicitação de acesso ao <strong>Curva Mestra</strong> foi aprovada! O acesso ao sistema está liberado.</p>

          <div style="background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #065f46;"><strong>Conta Ativada com Sucesso!</strong></p>
            <p style="margin: 10px 0 0 0; color: #065f46;">Clique no botão abaixo para definir sua senha e acessar o sistema.</p>
          </div>

          <p><strong>Seu e-mail de acesso:</strong> {{email}}</p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="{{passwordResetLink}}" style="display: inline-block; padding: 14px 34px; background: #c9a24a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Definir minha senha →</a>
          </div>

          <p style="font-size: 13px; color: #6b7280;">Este link é de uso único e expira em 24 horas. Se precisar de um novo link, acesse <a href="https://curvamestra.com.br/login">curvamestra.com.br/login</a> e clique em "Esqueci a senha".</p>

          <p><strong>Próximos passos após definir a senha:</strong></p>
          <ol>
            <li>Faça login com seu e-mail em <a href="https://curvamestra.com.br/login">curvamestra.com.br/login</a></li>
            <li>Configure o perfil da clínica</li>
            <li>Importe seu primeiro inventário</li>
          </ol>

          <p>Se você tiver alguma dúvida, entre em contato conosco.</p>

          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>&copy; ${YEAR} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p><strong>IMPORTANTE:</strong> Nunca compartilhe sua senha com terceiros.</p>
        </div>
      </body>
    </html>
  `,
  },
  {
    tipo: 'password_reset',
    label: 'Redefinição de Senha',
    category: 'email',
    related_uc: 'UC-08 / UC-30',
    subject: 'Redefinição de Senha - Curva Mestra',
    variables: [
      v('displayName', 'Nome de exibição do usuário', true, 'Maria Oliveira'),
      v(
        'resetLink',
        'Link de definição de nova senha (uso único, expira em 30min)',
        true,
        'https://curvamestra.com.br/reset-password?token=exemplo'
      ),
    ],
    body: `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Redefinição de Senha</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>{{displayName}}</strong>,</p>
          <p>Foi solicitada a redefinição da sua senha no <strong>Curva Mestra</strong>.</p>
          <p>Clique no botão abaixo para definir uma nova senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetLink}}" style="display: inline-block; padding: 14px 35px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Definir Nova Senha</a>
          </div>
          <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Importante:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400e;">
              <li>Este link expira em <strong>30 minutos</strong></li>
              <li>O link só pode ser usado <strong>uma vez</strong></li>
              <li>Se você não solicitou esta alteração, ignore este email</li>
            </ul>
          </div>
          <p style="font-size: 12px; color: #6b7280;">
            Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br>
            <span style="word-break: break-all; color: #667eea;">{{resetLink}}</span>
          </p>
          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>&copy; ${YEAR} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p><strong>IMPORTANTE:</strong> Nunca compartilhe este link com terceiros.</p>
        </div>
      </body>
    </html>
  `,
  },
  {
    tipo: 'consultant_welcome',
    label: 'Boas-vindas ao Consultor',
    category: 'email',
    related_uc: 'UC-28',
    subject: 'Bem-vindo ao Curva Mestra - Portal do Consultor',
    variables: [
      v('name', 'Nome do consultor', true, 'João Pereira'),
      v('email', 'E-mail de acesso do consultor', true, 'joao@consultor.com.br'),
      v('code', 'Código de consultor', true, 'CONS-4821'),
    ],
    body: `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Bem-vindo ao Curva Mestra!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Portal do Consultor</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>{{name}}</strong>,</p>

          <p>Sua conta de consultor foi criada com sucesso no <strong>Curva Mestra</strong>.</p>

          <div style="background: #dbeafe; border: 1px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">Seu código de consultor:</p>
            <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 4px;">{{code}}</p>
            <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 12px;">Use este código para se vincular às clínicas</p>
          </div>

          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Dados de acesso:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400e;">
              <li><strong>E-mail:</strong> {{email}}</li>
            </ul>
            <p style="margin: 10px 0 0 0; color: #92400e; font-size: 12px;">Sua senha de acesso não é enviada por e-mail. Você será solicitado a defini-la/trocá-la no primeiro acesso.</p>
          </div>

          <div style="text-align: center;">
            <a href="https://curvamestra.com.br/login" style="display: inline-block; padding: 12px 30px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Fazer Login</a>
          </div>

          <p><strong>O que você pode fazer:</strong></p>
          <ul>
            <li>Visualizar dados das clínicas vinculadas (read-only)</li>
            <li>Acompanhar estoque e procedimentos</li>
            <li>Gerar relatórios consolidados</li>
          </ul>

          <p>Se você tiver alguma dúvida, entre em contato conosco.</p>

          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>&copy; ${YEAR} Curva Mestra - Gestão Inteligente de Estoque</p>
        </div>
      </body>
    </html>
  `,
  },
  {
    tipo: 'consultant_email_changed',
    label: 'Alteração de E-mail de Acesso do Consultor',
    category: 'email',
    related_uc: 'UC-29',
    subject: 'Seu e-mail de acesso foi alterado - Curva Mestra',
    variables: [
      v('name', 'Nome do consultor', true, 'João Pereira'),
      v('previousEmail', 'E-mail de acesso anterior', true, 'joao.antigo@consultor.com.br'),
      v('newEmail', 'Novo e-mail de acesso', true, 'joao.novo@consultor.com.br'),
    ],
    body: wrapSimpleEmail(
      'Alteração de E-mail de Acesso',
      `
          <p>Olá {{name}},</p>
          <p>O e-mail de acesso da sua conta de consultor no Curva Mestra foi alterado de <strong>{{previousEmail}}</strong> para <strong>{{newEmail}}</strong>.</p>
          <p>A partir de agora, use o novo e-mail para fazer login. Se você não reconhece esta alteração, entre em contato com o suporte.</p>
          <p>Atenciosamente,<br>Equipe Curva Mestra</p>
        `
    ),
  },
  {
    tipo: 'consultant_transfer_request',
    label: 'Pedido de Transferência de Clínica',
    category: 'email',
    related_uc: 'UC-25',
    subject: 'Pedido de transferência de clínica - Curva Mestra',
    variables: [
      v('currentConsultantName', 'Nome do consultor atual (destinatário)', true, 'Ana Costa'),
      v('requestingConsultantName', 'Nome do consultor solicitante', true, 'João Pereira'),
      v('requestingConsultantCode', 'Código do consultor solicitante', true, 'CONS-4821'),
      v('tenantName', 'Nome da clínica', true, 'Clínica Exemplo'),
    ],
    body: wrapSimpleEmail(
      'Pedido de Transferência de Clínica',
      `
          <p>Olá {{currentConsultantName}},</p>
          <p>O consultor <strong>{{requestingConsultantName}} ({{requestingConsultantCode}})</strong> solicitou assumir a consultoria da clínica <strong>{{tenantName}}</strong>, atualmente vinculada a você.</p>
          <p>Acesse o Portal do Consultor para aprovar ou rejeitar este pedido.</p>
          <p>Atenciosamente,<br>Equipe Curva Mestra</p>
        `
    ),
  },
  {
    tipo: 'consultant_invite_created',
    label: 'Convite de Vínculo com Clínica',
    category: 'email',
    related_uc: 'UC-23',
    subject: 'Convite de vínculo com clínica - Curva Mestra',
    variables: [
      v('consultantName', 'Nome do consultor convidado', true, 'João Pereira'),
      v('tenantName', 'Nome da clínica convidante', true, 'Clínica Exemplo'),
    ],
    body: wrapSimpleEmail(
      'Convite de Vínculo com Clínica',
      `
          <p>Olá {{consultantName}},</p>
          <p>A clínica <strong>{{tenantName}}</strong> convidou você para ser o consultor vinculado a ela.</p>
          <p>Acesse o Portal do Consultor para aceitar ou recusar este convite.</p>
          <p>Atenciosamente,<br>Equipe Curva Mestra</p>
        `
    ),
  },
  {
    tipo: 'consultant_transfer_approved',
    label: 'Transferência de Clínica Aprovada',
    category: 'email',
    related_uc: 'UC-26',
    subject: 'Transferência aprovada - Curva Mestra',
    variables: [
      v('requestingConsultantName', 'Nome do consultor solicitante', true, 'João Pereira'),
      v('tenantName', 'Nome da clínica', true, 'Clínica Exemplo'),
    ],
    body: wrapSimpleEmail(
      'Transferência Aprovada',
      `
          <p>Olá {{requestingConsultantName}},</p>
          <p>Sua solicitação de transferência para a clínica <strong>{{tenantName}}</strong> foi aprovada!</p>
          <p>Você já pode acessar os dados da clínica no Portal do Consultor.</p>
          <p>Atenciosamente,<br>Equipe Curva Mestra</p>
        `
    ),
  },
  {
    tipo: 'consultant_transfer_rejected',
    label: 'Transferência de Clínica Não Aprovada',
    category: 'email',
    related_uc: 'UC-27',
    subject: 'Pedido de transferência não aprovado - Curva Mestra',
    variables: [
      v('requestingConsultantName', 'Nome do consultor solicitante', true, 'João Pereira'),
      v('tenantName', 'Nome da clínica', true, 'Clínica Exemplo'),
      v(
        'motivoBlock',
        'Bloco HTML com o motivo da rejeição (vazio se não informado)',
        false,
        '<p><strong>Motivo:</strong> Consultor já vinculado a outra clínica prioritária.</p>'
      ),
    ],
    body: wrapSimpleEmail(
      'Pedido de Transferência Não Aprovado',
      `
          <p>Olá {{requestingConsultantName}},</p>
          <p>Seu pedido de transferência para a clínica <strong>{{tenantName}}</strong> não foi aprovado pelo consultor atual.</p>
          {{motivoBlock}}
          <p>Atenciosamente,<br>Equipe Curva Mestra</p>
        `
    ),
  },
  {
    tipo: 'access_request_rejected',
    label: 'Solicitação de Acesso Não Aprovada',
    category: 'email',
    related_uc: 'UC-03',
    subject: 'Atualização sobre sua Solicitação - Curva Mestra',
    variables: [
      v('displayName', 'Nome de exibição do solicitante', true, 'Maria Oliveira'),
      v('businessName', 'Nome da clínica informado na solicitação', true, 'Clínica Exemplo'),
      v(
        'motivoBlock',
        'Bloco HTML com o motivo da rejeição (vazio se não informado)',
        false,
        '<p><strong>Motivo:</strong></p><p>Dados cadastrais incompletos.</p>'
      ),
    ],
    body: `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .alert-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Solicitação Não Aprovada</h1>
        </div>
        <div class="content">
          <p>Olá <strong>{{displayName}}</strong>,</p>

          <p>Agradecemos seu interesse no <strong>Curva Mestra</strong>.</p>

          <div class="alert-box">
            <p><strong>Status da Solicitação:</strong> Não Aprovada</p>
            <p><strong>Clínica:</strong> {{businessName}}</p>
          </div>

          {{motivoBlock}}

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
          <p>© ${YEAR} Curva Mestra - Gestão Inteligente de Estoque</p>
        </div>
      </body>
    </html>
  `,
  },
  {
    tipo: 'generic_user_welcome',
    label: 'Boas-vindas Genérico de Novo Usuário',
    category: 'email',
    related_uc: 'UC-02 / UC-21 / UC-28',
    subject: '🎉 Bem-vindo ao Curva Mestra!',
    variables: [
      v('displayName', 'Nome de exibição do usuário', true, 'Maria Oliveira'),
      v(
        'role',
        'Nome legível do perfil (já resolvido pelo chamador)',
        true,
        'Administrador da Clínica'
      ),
    ],
    body: `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .role-badge { display: inline-block; padding: 4px 12px; background: #f3f4f6; border-radius: 4px; font-size: 14px; color: #374151; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Bem-vindo ao Curva Mestra!</h1>
        </div>
        <div class="content">
          <p>Olá <strong>{{displayName}}</strong>,</p>

          <p>Sua conta foi criada com sucesso no <strong>Curva Mestra</strong>, o sistema completo de gestão de estoque para clínicas de harmonização facial e corporal.</p>

          <p>Seu perfil: <span class="role-badge">{{role}}</span></p>

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
          <p>© ${YEAR} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p>Este é um e-mail automático, por favor não responda.</p>
        </div>
      </body>
    </html>
  `,
  },
  {
    tipo: 'new_tenant_notification',
    label: 'Notificação Interna: Nova Clínica',
    category: 'internal_notification',
    related_uc: 'UC-02 / UC-21',
    subject: '🎊 Nova Clínica: {{tenantName}}',
    variables: [
      v('tenantName', 'Nome da clínica criada', true, 'Clínica Exemplo'),
      v('tenantEmail', 'E-mail de contato da clínica', true, 'contato@clinicaexemplo.com.br'),
      v('planName', 'Nome legível do plano (já resolvido pelo chamador)', true, 'Profissional'),
    ],
    body: `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .info-box { background: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎊 Nova Clínica Cadastrada!</h1>
        </div>
        <div class="content">
          <p>Uma nova clínica foi cadastrada no sistema:</p>

          <div class="info-box">
            <p><strong>Nome:</strong> {{tenantName}}</p>
            <p><strong>E-mail:</strong> {{tenantEmail}}</p>
            <p><strong>Plano:</strong> {{planName}}</p>
            <p><strong>Data:</strong> ${SEEDED_AT}</p>
          </div>

          <p>A clínica já está ativa e pode começar a usar o sistema.</p>
        </div>
        <div class="footer">
          <p>© ${YEAR} Curva Mestra - Gestão Inteligente de Estoque</p>
        </div>
      </body>
    </html>
  `,
  },
  {
    tipo: 'access_request_created',
    label: 'Notificação Interna: Nova Solicitação de Acesso',
    category: 'internal_notification',
    related_uc: 'UC-01',
    subject: 'Solicitação de Acesso - {{documentNumber}}',
    variables: [
      v('documentNumber', 'CPF/CNPJ formatado', true, '123.456.789-00'),
      v('documentType', 'Tipo de documento (cpf ou cnpj)', true, 'cpf'),
      v('fullName', 'Nome completo do solicitante', true, 'Maria Oliveira'),
      v('email', 'E-mail informado na solicitação', true, 'maria@clinicaexemplo.com.br'),
      v('businessName', 'Nome da clínica informado na solicitação', true, 'Clínica Exemplo'),
    ],
    body: `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .info-box { background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0; }
          .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: 600; color: #6b7280; width: 140px; flex-shrink: 0; }
          .info-value { color: #111827; }
          .badge-pending { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: #fef3c7; color: #b45309; }
          .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Nova Solicitação de Acesso</h1>
        </div>
        <div class="content">
          <p>Uma nova solicitação de acesso foi recebida no <strong>Curva Mestra</strong>.</p>

          <div class="info-box">
            <div class="info-row">
              <span class="info-label">Tipo:</span>
              <span class="info-value">{{documentType}}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Documento:</span>
              <span class="info-value"><strong>{{documentNumber}}</strong></span>
            </div>
            <div class="info-row">
              <span class="info-label">Nome:</span>
              <span class="info-value">{{fullName}}</span>
            </div>
            <div class="info-row">
              <span class="info-label">E-mail:</span>
              <span class="info-value">{{email}}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Empresa:</span>
              <span class="info-value">{{businessName}}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value"><span class="badge-pending">Pendente</span></span>
            </div>
          </div>

          <p>Acesse o painel administrativo para revisar e aprovar/rejeitar esta solicitação.</p>

          <div style="text-align: center;">
            <a href="https://curva-mestra.web.app/admin/access-requests" class="button">
              Ver Solicitações
            </a>
          </div>
        </div>
        <div class="footer">
          <p>© ${YEAR} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p>Este é um e-mail automático do sistema.</p>
        </div>
      </body>
    </html>
  `,
  },
];

/**
 * Esqueleto visual reaproveitado dos templates #1-#3 (gradiente azul, já
 * usado em `consultant_welcome`) — RN-13 do UC-55: eleva visualmente os 5
 * templates que hoje são só parágrafos sem nenhum wrapper. `innerHtml` já
 * inclui a assinatura "Atenciosamente..." (copiada verbatim da origem), por
 * isso não é repetida aqui.
 */
function wrapSimpleEmail(title: string, innerHtml: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">${title}</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          ${innerHtml}
        </div>
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>&copy; ${YEAR} Curva Mestra - Gestão Inteligente de Estoque</p>
        </div>
      </body>
    </html>
  `;
}

const KNOWN_REAL_PROJECT_IDS = ['curva-mestra-dev', 'curva-mestra'];

async function resolveFirestore(credPath: string | undefined) {
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const { getEmulatorAdminFirestore } = await import('./lib/emulatorAdmin');
    console.log('[seed-email-templates] rodando contra o Firebase Emulator');
    return getEmulatorAdminFirestore();
  }

  if (!credPath) {
    console.error(
      'Uso: npx tsx scripts/seed-email-templates.ts [<caminho-para-service-account.json>] [--force]\n' +
        'Sem FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST setados, é obrigatório informar a credencial.'
    );
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const serviceAccount = require(credPath);
  if (!KNOWN_REAL_PROJECT_IDS.includes(serviceAccount.project_id)) {
    console.error(
      `❌ ABORTADO: a credencial aponta para "${serviceAccount.project_id}", esperado um de ` +
        `${KNOWN_REAL_PROJECT_IDS.join(', ')}. Isso evita escrever no projeto errado.`
    );
    process.exit(1);
  }

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  console.log(
    `[seed-email-templates] rodando contra o projeto real "${serviceAccount.project_id}"`
  );
  return getFirestore(app);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const credPath = args.find((a) => a !== '--force');

  const db = await resolveFirestore(credPath);
  const { FieldValue } = await import('firebase-admin/firestore');

  let created = 0;
  let skipped = 0;
  let overwritten = 0;

  for (const template of TEMPLATES) {
    const ref = db.collection('email_templates').doc(template.tipo);
    const snap = await ref.get();

    if (snap.exists && !force) {
      console.log(`[seed-email-templates] "${template.tipo}" já existe — mantido (sem --force)`);
      skipped++;
      continue;
    }

    await ref.set({
      tipo: template.tipo,
      label: template.label,
      category: template.category,
      related_uc: template.related_uc,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: 'seed-script',
      updated_by_name: 'Seed automático (UC-55)',
    });

    if (snap.exists) {
      console.log(`[seed-email-templates] "${template.tipo}" sobrescrito (--force)`);
      overwritten++;
    } else {
      console.log(`[seed-email-templates] "${template.tipo}" criado`);
      created++;
    }
  }

  console.log(
    `[seed-email-templates] concluído — ${created} criado(s), ${overwritten} sobrescrito(s), ${skipped} mantido(s) de ${TEMPLATES.length} templates.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[seed-email-templates] erro:', error);
    process.exit(1);
  });
