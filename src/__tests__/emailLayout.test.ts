import * as web from '@/lib/emailLayout';
import * as mirror from '../../functions/src/emailLayout';
import { EMAIL_TEMPLATE_DEFINITIONS } from '../../scripts/lib/emailTemplateDefinitions';

const {
  EMAIL_BANNERS,
  EMAIL_BRAND_DARK,
  EMAIL_BRAND_GOLD,
  EMAIL_FOOTER_LEGAL_LINES,
  buildEmailLayout,
  emailAssetUrl,
  htmlToPlainText,
  renderEmailButton,
  renderStoredEmailTemplate,
  resolveAppBaseUrl,
} = web;

describe('resolveAppBaseUrl', () => {
  it('URL explícita do ambiente tem prioridade', () => {
    expect(
      resolveAppBaseUrl({ explicitBaseUrl: 'https://outro.example', projectId: 'curva-mestra' })
    ).toBe('https://outro.example');
  });

  it('mapeia produção e dev pelo projeto Firebase', () => {
    expect(resolveAppBaseUrl({ projectId: 'curva-mestra' })).toBe('https://curvamestra.com.br');
    expect(resolveAppBaseUrl({ projectId: 'curva-mestra-dev' })).toBe(
      'https://dev-gscandelari.web.app'
    );
  });

  it('usa a URL local quando o projeto não é conhecido (emulador/E2E)', () => {
    expect(
      resolveAppBaseUrl({
        projectId: 'demo-curva-mestra-e2e',
        fallbackLocalUrl: 'http://localhost:3100',
      })
    ).toBe('http://localhost:3100');
  });

  it('lança quando nada resolve', () => {
    expect(() => resolveAppBaseUrl({ projectId: 'desconhecido' })).toThrow();
  });

  it('remove a barra final', () => {
    expect(resolveAppBaseUrl({ explicitBaseUrl: 'https://x.example//' })).toBe('https://x.example');
  });
});

describe('EMAIL_BANNERS', () => {
  it('todos os 13 tipos do seed têm banner', () => {
    for (const def of EMAIL_TEMPLATE_DEFINITIONS) {
      expect(EMAIL_BANNERS[def.tipo]).toBeDefined();
    }
    expect(Object.keys(EMAIL_BANNERS)).toHaveLength(13);
  });

  it('nenhum banner usa a arte genérica "Heading" (1.png)', () => {
    for (const banner of Object.values(EMAIL_BANNERS)) {
      expect(banner.file).toMatch(/^banner-[a-z-]+\.png$/);
      expect(banner.alt).not.toMatch(/heading/i);
    }
  });
});

describe('buildEmailLayout', () => {
  const base = 'https://dev-gscandelari.web.app';

  it('usa o banner do tipo com alt e dimensões, e URLs absolutas', () => {
    const html = buildEmailLayout({
      tipo: 'password_reset',
      contentHtml: '<p>x</p>',
      baseUrl: base,
    });
    expect(html).toContain(
      `<img src="${base}/email/v1/banner-password-reset.png" width="600" height="100" alt="Redefinição de Senha — Curva Mestra"`
    );
    expect(html).toContain(`${base}/email/v1/rodape.png`);
    expect(html).not.toMatch(/src="\//);
  });

  it('insere o miolo sem escapar', () => {
    const html = buildEmailLayout({
      tipo: 'password_reset',
      contentHtml: '<p><strong>Olá</strong></p>',
      baseUrl: base,
    });
    expect(html).toContain('<p><strong>Olá</strong></p>');
  });

  it('inclui rodapé em imagem e as duas linhas legais, sem background-image', () => {
    const html = buildEmailLayout({ tipo: 'password_reset', contentHtml: '', baseUrl: base });
    for (const line of EMAIL_FOOTER_LEGAL_LINES) {
      expect(html).toContain(line);
    }
    expect(html).not.toContain('background-image');
  });

  it('tipo sem banner sai sem imagem de banner e com o título em texto', () => {
    const html = buildEmailLayout({
      tipo: 'tipo_sem_banner',
      contentHtml: '',
      baseUrl: base,
      fallbackTitle: 'Título <Teste>',
    });
    expect(html).not.toContain('/email/v1/banner-');
    expect(html).toContain('<h1');
    expect(html).toContain('Título &lt;Teste&gt;');
  });

  it('preheader fica oculto e escapado', () => {
    const html = buildEmailLayout({
      tipo: 'password_reset',
      contentHtml: '',
      baseUrl: base,
      preheader: 'a & b',
    });
    expect(html).toMatch(/display:none[^>]*>a &amp; b<\/div>/);
  });
});

describe('renderEmailButton', () => {
  it('monta botão em tabela com fundo escuro, texto dourado e link de fallback', () => {
    const html = renderEmailButton('{{resetLink}}', 'Definir nova senha');
    expect(html).toContain('<table role="presentation"');
    expect(html).toContain(`bgcolor="${EMAIL_BRAND_DARK}"`);
    expect(html).toContain(`color:${EMAIL_BRAND_GOLD}`);
    expect(html).toContain('href="{{resetLink}}"');
    expect(html).toContain('>Definir nova senha</a>');
    expect(html).toContain('Se o botão não funcionar');
  });
});

describe('emailAssetUrl', () => {
  it('monta a URL da pasta versionada sem barra dupla', () => {
    expect(emailAssetUrl('https://x.example/', 'rodape.png')).toBe(
      'https://x.example/email/v1/rodape.png'
    );
  });
});

describe('htmlToPlainText', () => {
  it('descarta head/style e mantém o endereço dos links', () => {
    const text = htmlToPlainText(
      '<html><head><style>p{color:red}</style><title>T</title></head><body>' +
        '<p>Olá</p><p><a href="https://x.example/a">Clique</a></p></body></html>'
    );
    expect(text).toBe('Olá\nClique (https://x.example/a)');
  });

  it('converte <br> e decodifica entidades', () => {
    expect(htmlToPlainText('&copy; 2026<br>A &amp; B')).toBe('© 2026\nA & B');
  });

  it('link cujo texto é a própria URL aparece uma vez', () => {
    expect(htmlToPlainText('<a href="https://x.example">https://x.example</a>')).toBe(
      'https://x.example'
    );
  });
});

describe('renderStoredEmailTemplate', () => {
  const getBaseUrl = jest.fn(() => 'https://curvamestra.com.br');
  const now = new Date('2026-10-28T12:00:00Z');

  beforeEach(() => getBaseUrl.mockClear());

  it('com content: envolve o miolo no layout e injeta appUrl/currentYear', () => {
    const { subject, html } = renderStoredEmailTemplate({
      tipo: 'password_reset',
      template: {
        subject: 'Olá {{displayName}}',
        content: '<p>{{appUrl}}/login {{currentYear}}</p>',
        body: '<p>legado</p>',
      },
      variables: { displayName: 'Maria' },
      getBaseUrl,
      now,
    });
    expect(subject).toBe('Olá Maria');
    expect(html).toContain('<p>https://curvamestra.com.br/login 2026</p>');
    expect(html).toContain('banner-password-reset.png');
    expect(html).not.toContain('legado');
  });

  it('sem content: usa o body legado como está e não resolve a URL base', () => {
    const { html } = renderStoredEmailTemplate({
      tipo: 'password_reset',
      template: { subject: 's', body: '<p>legado {{displayName}}</p>' },
      variables: { displayName: 'Maria' },
      getBaseUrl,
    });
    expect(html).toBe('<p>legado Maria</p>');
    expect(getBaseUrl).not.toHaveBeenCalled();
  });

  it('legado que usa {{appUrl}} resolve a URL base', () => {
    const { html } = renderStoredEmailTemplate({
      tipo: 'password_reset',
      template: { subject: 's', body: '{{appUrl}}' },
      variables: {},
      getBaseUrl,
    });
    expect(html).toBe('https://curvamestra.com.br');
  });
});

// O espelho em functions/src precisa se comportar exatamente igual
describe('paridade com functions/src/emailLayout', () => {
  const layoutInput = {
    tipo: 'generic_user_welcome',
    contentHtml: '<p>Olá</p>',
    baseUrl: 'https://curvamestra.com.br',
    preheader: 'pré',
    fallbackTitle: 'T',
  };

  it('constantes iguais', () => {
    expect(mirror.EMAIL_BANNERS).toEqual(web.EMAIL_BANNERS);
    expect(mirror.EMAIL_FOOTER).toEqual(web.EMAIL_FOOTER);
    expect(mirror.EMAIL_FOOTER_LEGAL_LINES).toEqual(web.EMAIL_FOOTER_LEGAL_LINES);
    expect(mirror.SYSTEM_TEMPLATE_VARIABLES).toEqual(web.SYSTEM_TEMPLATE_VARIABLES);
  });

  it('mesmas saídas para as mesmas entradas', () => {
    expect(mirror.buildEmailLayout(layoutInput)).toBe(web.buildEmailLayout(layoutInput));
    expect(mirror.buildEmailLayout({ ...layoutInput, tipo: 'x' })).toBe(
      web.buildEmailLayout({ ...layoutInput, tipo: 'x' })
    );
    expect(mirror.renderEmailButton('h', 'l')).toBe(web.renderEmailButton('h', 'l'));
    expect(mirror.resolveAppBaseUrl({ projectId: 'curva-mestra-dev' })).toBe(
      web.resolveAppBaseUrl({ projectId: 'curva-mestra-dev' })
    );
    const html = web.buildEmailLayout(layoutInput);
    expect(mirror.htmlToPlainText(html)).toBe(web.htmlToPlainText(html));

    const stored = {
      tipo: 'password_reset',
      template: { subject: 's {{a}}', content: '<p>{{a}} {{appUrl}}</p>' },
      variables: { a: '1' },
      getBaseUrl: () => 'https://curvamestra.com.br',
      now: new Date('2026-01-01T00:00:00Z'),
    };
    expect(mirror.renderStoredEmailTemplate(stored)).toEqual(web.renderStoredEmailTemplate(stored));
  });
});
