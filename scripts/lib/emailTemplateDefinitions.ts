/**
 * Conteúdo padrão dos 13 templates de `email_templates/{tipo}` (UC-55) no
 * layout novo (`layout_version: 1`): só o miolo (`content`). Banner, rodapé
 * e texto legal vêm de `buildEmailLayout` (src/lib/emailLayout.ts).
 *
 * Fonte única para `seed-email-templates.ts` (emulador/ambientes novos) e
 * `migrate-email-templates-layout.ts` (ambientes já seedados).
 * Ver ONLY_FOR_DEVS/TO_DO/FEAT-padronizacao-emails-e-links-de-senha.md (STEP 8).
 *
 * Regras do miolo: sem <html>/<head>/<body>/<style>, sem título (já está no
 * banner), estilos inline, botões via `renderEmailButton` e links do sistema
 * via `{{appUrl}}` (variável de sistema, resolvida por ambiente).
 */

import type { EmailTemplateCategory, EmailTemplateVariable } from '../../src/types';
import { EMAIL_BRAND_DARK, EMAIL_BRAND_GOLD, renderEmailButton } from '../../src/lib/emailLayout';

export interface EmailTemplateDefinition {
  tipo: string;
  label: string;
  category: EmailTemplateCategory;
  related_uc: string;
  subject: string;
  content: string;
  variables: EmailTemplateVariable[];
}

function v(key: string, label: string, required: boolean, sample: string): EmailTemplateVariable {
  return { key, label, required, sample };
}

const SAMPLE_PASSWORD_LINK = 'https://curvamestra.com.br/reset-password/exemplo';

function p(html: string, style = ''): string {
  return `<p style="margin:0 0 16px;${style}">${html}</p>`;
}

function small(html: string): string {
  return p(html, 'font-size:13px;line-height:1.5;color:#6b7280;');
}

function list(items: string[], ordered = false): string {
  const tag = ordered ? 'ol' : 'ul';
  const lis = items.map((item) => `<li style="margin:0 0 6px;">${item}</li>`).join('');
  return `<${tag} style="margin:0 0 16px;padding-left:24px;">${lis}</${tag}>`;
}

function link(href: string, label: string): string {
  return `<a href="${href}" target="_blank" style="color:${EMAIL_BRAND_DARK};">${label}</a>`;
}

/** Caixa de destaque com faixa dourada à esquerda. */
function callout(html: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">` +
    `<tr><td style="background:#fdf8ec;border-left:4px solid ${EMAIL_BRAND_GOLD};padding:16px;font-size:15px;line-height:1.5;color:#1f2937;">` +
    html +
    `</td></tr></table>`
  );
}

/** Tabela de dados "rótulo: valor". */
function infoTable(rows: [string, string][]): string {
  const trs = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-weight:bold;white-space:nowrap;vertical-align:top;">${label}</td>` +
        `<td style="padding:6px 0;color:#111827;">${value}</td></tr>`
    )
    .join('');
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;background:#f9fafb;border-left:4px solid ${EMAIL_BRAND_GOLD};">` +
    `<tr><td style="padding:12px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.5;">${trs}</table></td></tr></table>`
  );
}

const SIGNATURE = p('Atenciosamente,<br><strong>Equipe Curva Mestra</strong>', 'margin:24px 0 0;');

const FORGOT_PASSWORD_HINT = `Se ele expirar, acesse ${link('{{appUrl}}/forgot-password', 'Esqueci minha senha')} e solicite uma nova senha.`;

export const EMAIL_TEMPLATE_DEFINITIONS: EmailTemplateDefinition[] = [
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
        'Link de primeiro acesso (uso único, válido por 72 horas)',
        true,
        SAMPLE_PASSWORD_LINK
      ),
    ],
    content: [
      p('Olá <strong>{{displayName}}</strong>,'),
      p(
        'Sua solicitação de acesso ao <strong>Curva Mestra</strong> foi aprovada! O acesso ao sistema está liberado.'
      ),
      callout(
        '<strong>Conta ativada com sucesso!</strong><br>Clique no botão abaixo para definir sua senha e acessar o sistema.'
      ),
      p('<strong>Seu e-mail de acesso:</strong> {{email}}'),
      renderEmailButton('{{passwordResetLink}}', 'Definir minha senha'),
      small(`Este link é de uso único e válido por 72 horas. ${FORGOT_PASSWORD_HINT}`),
      p('<strong>Próximos passos após definir a senha:</strong>', 'margin:0 0 8px;'),
      list(
        [
          `Faça login com seu e-mail em ${link('{{appUrl}}/login', '{{appUrl}}/login')}`,
          'Configure o perfil da clínica',
          'Importe seu primeiro inventário',
        ],
        true
      ),
      p('Se você tiver alguma dúvida, entre em contato conosco.'),
      SIGNATURE,
    ].join(''),
  },
  {
    tipo: 'password_reset',
    label: 'Redefinição de Senha',
    category: 'email',
    related_uc: 'UC-07 / UC-08 / UC-30',
    subject: 'Redefinição de Senha - Curva Mestra',
    variables: [
      v('displayName', 'Nome de exibição do usuário', true, 'Maria Oliveira'),
      v(
        'resetLink',
        'Link de definição de nova senha (válido por 30 minutos)',
        true,
        SAMPLE_PASSWORD_LINK
      ),
    ],
    content: [
      p('Olá <strong>{{displayName}}</strong>,'),
      p('Foi solicitada a redefinição da sua senha no <strong>Curva Mestra</strong>.'),
      p('Clique no botão abaixo para definir uma nova senha:'),
      renderEmailButton('{{resetLink}}', 'Definir nova senha'),
      callout(
        '<strong>Importante:</strong>' +
          list([
            'Este link é válido por <strong>30 minutos</strong>',
            'Ele pode ser aberto até você concluir a troca da senha',
            'Se você não solicitou esta alteração, ignore este e-mail',
          ]).replace('margin:0 0 16px;', 'margin:8px 0 0;')
      ),
      SIGNATURE,
    ].join(''),
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
      v(
        'firstAccessLink',
        'Link de primeiro acesso (uso único, válido por 72 horas)',
        true,
        SAMPLE_PASSWORD_LINK
      ),
    ],
    content: [
      p('Olá <strong>{{name}}</strong>,'),
      p('Sua conta de consultor foi criada com sucesso no <strong>Curva Mestra</strong>.'),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">` +
        `<tr><td align="center" style="background:#f9fafb;border:1px solid #e5e7eb;padding:20px;">` +
        `<p style="margin:0;font-size:14px;color:#6b7280;">Seu código de consultor:</p>` +
        `<p style="margin:8px 0 0;font-size:32px;font-weight:bold;letter-spacing:4px;color:${EMAIL_BRAND_DARK};">{{code}}</p>` +
        `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Use este código para se vincular às clínicas</p>` +
        `</td></tr></table>`,
      p('<strong>Seu e-mail de acesso:</strong> {{email}}'),
      p('Para começar, defina a sua senha:'),
      renderEmailButton('{{firstAccessLink}}', 'Definir minha senha'),
      small(`Este link é de uso único e válido por 72 horas. ${FORGOT_PASSWORD_HINT}`),
      p('<strong>O que você pode fazer:</strong>', 'margin:0 0 8px;'),
      list([
        'Visualizar dados das clínicas vinculadas (read-only)',
        'Acompanhar estoque e procedimentos',
        'Gerar relatórios consolidados',
      ]),
      p('Se você tiver alguma dúvida, entre em contato conosco.'),
      SIGNATURE,
    ].join(''),
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
    content: [
      p('Olá {{name}},'),
      p(
        'O e-mail de acesso da sua conta de consultor no Curva Mestra foi alterado de <strong>{{previousEmail}}</strong> para <strong>{{newEmail}}</strong>.'
      ),
      p(
        'A partir de agora, use o novo e-mail para fazer login. Se você não reconhece esta alteração, entre em contato com o suporte.'
      ),
      renderEmailButton('{{appUrl}}/login', 'Fazer login'),
      SIGNATURE,
    ].join(''),
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
    content: [
      p('Olá {{currentConsultantName}},'),
      p(
        'O consultor <strong>{{requestingConsultantName}} ({{requestingConsultantCode}})</strong> solicitou assumir a consultoria da clínica <strong>{{tenantName}}</strong>, atualmente vinculada a você.'
      ),
      p('Acesse o Portal do Consultor para aprovar ou rejeitar este pedido.'),
      renderEmailButton('{{appUrl}}/consultant/transfer-requests', 'Ver pedido'),
      SIGNATURE,
    ].join(''),
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
    content: [
      p('Olá {{consultantName}},'),
      p(
        'A clínica <strong>{{tenantName}}</strong> convidou você para ser o consultor vinculado a ela.'
      ),
      p('Acesse o Portal do Consultor para aceitar ou recusar este convite.'),
      renderEmailButton('{{appUrl}}/login', 'Acessar o Portal do Consultor'),
      SIGNATURE,
    ].join(''),
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
    content: [
      p('Olá {{requestingConsultantName}},'),
      p(
        'Sua solicitação de transferência para a clínica <strong>{{tenantName}}</strong> foi aprovada!'
      ),
      p('Você já pode acessar os dados da clínica no Portal do Consultor.'),
      renderEmailButton('{{appUrl}}/login', 'Acessar o Portal do Consultor'),
      SIGNATURE,
    ].join(''),
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
    content: [
      p('Olá {{requestingConsultantName}},'),
      p(
        'Seu pedido de transferência para a clínica <strong>{{tenantName}}</strong> não foi aprovado pelo consultor atual.'
      ),
      '{{motivoBlock}}',
      SIGNATURE,
    ].join(''),
  },
  {
    tipo: 'consultant_pending_access_requests_digest',
    label: 'Lembrete Diário: Solicitações de Acesso Pendentes',
    category: 'email',
    related_uc: 'UC-57',
    subject: 'Você tem {{pendingCount}} solicitação(ões) de acesso pendente(s) - Curva Mestra',
    variables: [
      v('consultantName', 'Nome do consultor (destinatário)', true, 'João Pereira'),
      v('pendingCount', 'Quantidade de solicitações pendentes vinculadas', true, '2'),
      v(
        'pendingRequestsBlock',
        'Lista HTML das solicitações pendentes (montada pela Scheduled Function)',
        true,
        '<ul><li><strong>Maria Oliveira</strong> — Clínica Exemplo (enviada em 07/10/2026, 09:00)</li></ul>'
      ),
    ],
    content: [
      p('Olá {{consultantName}},'),
      p(
        'Existem <strong>{{pendingCount}}</strong> solicitação(ões) de acesso pendente(s) vinculada(s) ao seu código de consultor:'
      ),
      '{{pendingRequestsBlock}}',
      p('Acesse o Portal do Consultor para revisar e aprovar:'),
      renderEmailButton('{{appUrl}}/consultant/access-requests', 'Ver solicitações'),
      small(
        'Este lembrete é enviado diariamente enquanto houver solicitações pendentes vinculadas ao seu código.'
      ),
      SIGNATURE,
    ].join(''),
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
    content: [
      p('Olá <strong>{{displayName}}</strong>,'),
      p('Agradecemos seu interesse no <strong>Curva Mestra</strong>.'),
      infoTable([
        ['Status da Solicitação:', 'Não Aprovada'],
        ['Clínica:', '{{businessName}}'],
      ]),
      '{{motivoBlock}}',
      p('Infelizmente, sua solicitação de acesso antecipado não pôde ser aprovada no momento.'),
      p('<strong>O que você pode fazer:</strong>', 'margin:0 0 8px;'),
      list([
        'Entrar em contato conosco para mais informações',
        'Enviar uma nova solicitação com informações atualizadas',
        'Aguardar o lançamento oficial do sistema',
      ]),
      renderEmailButton('{{appUrl}}/register', 'Nova solicitação'),
      p('Se você tiver alguma dúvida ou acredita que houve um erro, entre em contato conosco.'),
      SIGNATURE,
    ].join(''),
  },
  {
    tipo: 'generic_user_welcome',
    label: 'Boas-vindas Genérico de Novo Usuário',
    category: 'email',
    related_uc: 'UC-02 / UC-21 / UC-28',
    subject: 'Bem-vindo ao Curva Mestra!',
    variables: [
      v('displayName', 'Nome de exibição do usuário', true, 'Maria Oliveira'),
      v(
        'role',
        'Nome legível do perfil (já resolvido pelo chamador)',
        true,
        'Administrador da Clínica'
      ),
      v('email', 'E-mail de acesso do usuário', true, 'maria@clinicaexemplo.com.br'),
      v(
        'firstAccessLink',
        'Link de primeiro acesso (uso único, válido por 72 horas)',
        true,
        SAMPLE_PASSWORD_LINK
      ),
    ],
    content: [
      p('Olá <strong>{{displayName}}</strong>,'),
      p(
        'Sua conta foi criada com sucesso no <strong>Curva Mestra</strong>, o sistema completo de gestão de estoque para clínicas de harmonização facial e corporal.'
      ),
      infoTable([
        ['Perfil:', '{{role}}'],
        ['E-mail de acesso:', '{{email}}'],
      ]),
      p('Para começar, defina a sua senha:'),
      renderEmailButton('{{firstAccessLink}}', 'Definir minha senha'),
      small(`Este link é de uso único e válido por 72 horas. ${FORGOT_PASSWORD_HINT}`),
      p('<strong>O que você pode fazer depois:</strong>', 'margin:0 0 8px;'),
      list([
        `Acessar o sistema com seu e-mail e senha em ${link('{{appUrl}}/login', '{{appUrl}}/login')}`,
        'Gerenciar estoque de produtos Rennova',
        'Controlar lotes e validades',
        'Criar solicitações de produtos',
      ]),
      SIGNATURE,
    ].join(''),
  },
  {
    tipo: 'new_tenant_notification',
    label: 'Notificação Interna: Nova Clínica',
    category: 'internal_notification',
    related_uc: 'UC-02 / UC-21',
    subject: 'Nova Clínica: {{tenantName}}',
    variables: [
      v('tenantName', 'Nome da clínica criada', true, 'Clínica Exemplo'),
      v('tenantEmail', 'E-mail de contato da clínica', true, 'contato@clinicaexemplo.com.br'),
      v(
        'tipoCadastro',
        'Classificação do cadastro (já resolvida pelo chamador a partir de document_type)',
        true,
        'Pessoa Jurídica'
      ),
    ],
    content: [
      p('Uma nova clínica foi cadastrada no sistema:'),
      infoTable([
        ['Nome:', '{{tenantName}}'],
        ['E-mail:', '{{tenantEmail}}'],
        ['Tipo de Cadastro:', '{{tipoCadastro}}'],
      ]),
      p('A clínica já está ativa e pode começar a usar o sistema.'),
      renderEmailButton('{{appUrl}}/admin/tenants', 'Ver clínicas'),
    ].join(''),
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
    content: [
      p('Uma nova solicitação de acesso foi recebida no <strong>Curva Mestra</strong>.'),
      infoTable([
        ['Tipo:', '{{documentType}}'],
        ['Documento:', '<strong>{{documentNumber}}</strong>'],
        ['Nome:', '{{fullName}}'],
        ['E-mail:', '{{email}}'],
        ['Empresa:', '{{businessName}}'],
        ['Status:', 'Pendente'],
      ]),
      p('Acesse o painel administrativo para revisar e aprovar/rejeitar esta solicitação.'),
      renderEmailButton('{{appUrl}}/admin/access-requests', 'Ver solicitações'),
    ].join(''),
  },
];
