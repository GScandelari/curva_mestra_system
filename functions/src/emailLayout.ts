/**
 * Layout padrão dos e-mails do Curva Mestra (UC-55) — ESPELHO MANUAL de
 * src/lib/emailLayout.ts. O deploy de functions/ empacota só functions/src,
 * então functions/src não pode importar de src/lib. Qualquer mudança em
 * src/lib/emailLayout.ts precisa ser replicada aqui; o teste de paridade em
 * src/__tests__/emailLayout.test.ts compara as duas versões.
 */

/** Pasta pública versionada (public/email/v1). Nunca apagar: e-mails enviados apontam para ela. */
export const EMAIL_ASSET_VERSION = 'v1';

/** Cores de marca extraídas do banner (fundo escuro e dourado do título) — DN-06. */
export const EMAIL_BRAND_DARK = '#121112';
export const EMAIL_BRAND_GOLD = '#E3A200';

/** Banner por tipo de template; o título está embutido na imagem, por isso o alt o repete. */
export const EMAIL_BANNERS: Record<string, { file: string; alt: string }> = {
  access_request_created: {
    file: 'banner-access-request-created.png',
    alt: 'Nova Solicitação de Acesso',
  },
  new_tenant_notification: {
    file: 'banner-new-tenant-notification.png',
    alt: 'Nova Clínica Cadastrada',
  },
  access_request_rejected: {
    file: 'banner-access-request-rejected.png',
    alt: 'Solicitação de Acesso Não Aprovada',
  },
  consultant_email_changed: {
    file: 'banner-consultant-email-changed.png',
    alt: 'Alteração de E-mail de Acesso do Consultor',
  },
  consultant_invite_created: {
    file: 'banner-consultant-invite-created.png',
    alt: 'Convite de Vínculo com Clínica',
  },
  consultant_pending_access_requests_digest: {
    file: 'banner-consultant-pending-access-requests-digest.png',
    alt: 'Solicitações de Acesso Pendentes',
  },
  consultant_transfer_approved: {
    file: 'banner-consultant-transfer-approved.png',
    alt: 'Transferência de Clínica Aprovada',
  },
  consultant_transfer_rejected: {
    file: 'banner-consultant-transfer-rejected.png',
    alt: 'Transferência de Clínica Não Aprovada',
  },
  consultant_transfer_request: {
    file: 'banner-consultant-transfer-request.png',
    alt: 'Pedido de Transferência de Clínica',
  },
  consultant_welcome: {
    file: 'banner-consultant-welcome.png',
    alt: 'Bem-vindo ao Curva Mestra! — Portal do Consultor',
  },
  generic_user_welcome: {
    file: 'banner-generic-user-welcome.png',
    alt: 'Bem-vindo ao Curva Mestra! — Portal da Clínica',
  },
  password_reset: {
    file: 'banner-password-reset.png',
    alt: 'Redefinição de Senha — Curva Mestra',
  },
  welcome_approval: {
    file: 'banner-welcome-approval.png',
    alt: 'Aprovação de Solicitação de Acesso',
  },
};

export const EMAIL_FOOTER = {
  file: 'rodape.png',
  alt: '© Curva Mestra — Gestão Inteligente de Estoque',
  width: 600,
  height: 50,
};

/** Texto legal em HTML abaixo do rodapé (DN-05). */
export const EMAIL_FOOTER_LEGAL_LINES = [
  'Este é um e-mail automático do Curva Mestra. Por favor, não responda.',
  'Nunca compartilhe sua senha ou links de acesso.',
];

const PROJECT_BASE_URLS: Record<string, string> = {
  'curva-mestra': 'https://curvamestra.com.br',
  'curva-mestra-dev': 'https://dev-gscandelari.web.app',
};

/**
 * URL base do ambiente para links e imagens. Nunca vem do header da
 * requisição (evita injeção de host em link de senha). Ordem: URL explícita
 * do ambiente → mapeamento pelo projeto Firebase → URL local (emulador/E2E).
 */
export function resolveAppBaseUrl(env: {
  explicitBaseUrl?: string;
  projectId?: string;
  fallbackLocalUrl?: string;
}): string {
  const fromProject = env.projectId ? PROJECT_BASE_URLS[env.projectId] : undefined;
  const url = env.explicitBaseUrl || fromProject || env.fallbackLocalUrl;
  if (!url) {
    throw new Error('URL base do ambiente não configurada para links de e-mail');
  }
  return url.replace(/\/+$/, '');
}

export function emailAssetUrl(baseUrl: string, file: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/email/${EMAIL_ASSET_VERSION}/${file}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT_STACK = 'Arial, Helvetica, sans-serif';

/**
 * Botão "bulletproof" (tabela + link) com fundo escuro e texto dourado,
 * seguido do link em texto para quando o botão não funcionar.
 * `href` pode ser uma variável de template (ex.: "{{resetLink}}").
 */
export function renderEmailButton(href: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">` +
    `<tr><td bgcolor="${EMAIL_BRAND_DARK}" style="border-radius:6px;background:${EMAIL_BRAND_DARK};">` +
    `<a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT_STACK};font-size:16px;font-weight:bold;line-height:1.2;text-decoration:none;color:${EMAIL_BRAND_GOLD};border-radius:6px;">${label}</a>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#6b7280;">Se o botão não funcionar, copie e cole este endereço no navegador:<br>` +
    `<a href="${href}" target="_blank" style="color:${EMAIL_BRAND_DARK};word-break:break-all;">${href}</a></p>`
  );
}

function imageRow(src: string, alt: string, width: number, height: number): string {
  return (
    `<tr><td style="padding:0;line-height:0;font-size:0;">` +
    `<img src="${src}" width="${width}" height="${height}" alt="${escapeHtml(alt)}" ` +
    `style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;">` +
    `</td></tr>`
  );
}

/**
 * Documento completo do e-mail. Tipo sem banner mapeado sai sem imagem de
 * banner e com o título em texto (DN-04) — o banner genérico "Heading"
 * nunca é usado.
 */
export function buildEmailLayout(p: {
  tipo: string;
  contentHtml: string;
  baseUrl: string;
  preheader?: string;
  fallbackTitle?: string;
}): string {
  const banner = EMAIL_BANNERS[p.tipo];
  const title = banner?.alt ?? p.fallbackTitle ?? 'Curva Mestra';

  const preheader = p.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(p.preheader)}</div>`
    : '';

  const header = banner
    ? imageRow(emailAssetUrl(p.baseUrl, banner.file), banner.alt, 600, 100)
    : `<tr><td style="padding:32px 32px 0;font-family:${FONT_STACK};">` +
      `<h1 style="margin:0;font-size:22px;line-height:1.3;color:${EMAIL_BRAND_DARK};">${escapeHtml(title)}</h1>` +
      `</td></tr>`;

  const legal = EMAIL_FOOTER_LEGAL_LINES.map(escapeHtml).join('<br>');

  return (
    `<!DOCTYPE html>` +
    `<html lang="pt-BR"><head>` +
    `<meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">` +
    `<meta name="x-apple-disable-message-reformatting">` +
    `<title>${escapeHtml(title)}</title>` +
    `</head>` +
    `<body style="margin:0;padding:0;background:#f4f4f5;">` +
    preheader +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">` +
    `<tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;">` +
    header +
    `<tr><td style="padding:32px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#1f2937;">` +
    p.contentHtml +
    `</td></tr>` +
    imageRow(
      emailAssetUrl(p.baseUrl, EMAIL_FOOTER.file),
      EMAIL_FOOTER.alt,
      EMAIL_FOOTER.width,
      EMAIL_FOOTER.height
    ) +
    `<tr><td style="padding:16px 32px;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">` +
    legal +
    `</td></tr>` +
    `</table>` +
    `</td></tr></table>` +
    `</body></html>`
  );
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  copy: '©',
  reg: '®',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Versão texto determinística do e-mail: descarta <head>/<style>/<script>,
 * mantém o endereço dos links ("texto (URL)") e converte blocos em quebras.
 */
export function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  text = text.replace(
    /<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const label = decodeEntities(inner.replace(/<[^>]+>/g, '')).trim();
      const url = decodeEntities(href).trim();
      if (!label || label === url) return url;
      return `${label} (${url})`;
    }
  );

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|tr|h[1-6]|li|table|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
