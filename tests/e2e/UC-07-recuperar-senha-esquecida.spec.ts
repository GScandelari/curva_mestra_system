import { test, expect, Page, Route } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { EMULATOR_PROJECT_ID } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura retroativa (Modo B) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-07-recuperar-senha-esquecida.md (v1.2)
 *
 * Cobre: Fluxo Principal (passos 1-7, incluindo a checagem de RN-01 — nenhuma
 * API route própria do Curva Mestra é chamada — e a confirmação, via a REST
 * API de debug do próprio Auth Emulator, de que o Firebase Auth de fato gerou
 * um oobCode de PASSWORD_RESET), Fluxo Alternativo 7a (usuário já autenticado
 * é redirecionado sem ver o formulário) e Fluxos de Exceção 8a ([CORRIGIDO]
 * e-mail não cadastrado — mesma tela de sucesso, RN-03), 8b (e-mail
 * inválido), 8c (muitas tentativas), 8d (erro de rede) e 8e (erro genérico
 * não mapeado).
 *
 * O passo 8 do Fluxo Principal ("Fora do controle do Curva Mestra") e o
 * comportamento histórico pré-correção (RN-03/RN-04, ver seção 7a/8a do UC)
 * não são exercitados aqui — não fazem parte do comportamento atual do
 * sistema.
 *
 * Suposições assumidas nesta rodada (Modo B, a confirmar pelo revisor humano):
 * - Este UC não grava nenhum documento em Firestore (RN-01 do próprio UC:
 *   fluxo 100% nativo do Firebase Auth) — por isso não há nenhuma asserção
 *   via `getEmulatorAdminFirestore()` neste spec, diferente da maioria das
 *   demais suítes desta pasta.
 * - "Esperado (Firebase Auth)" aqui é verificado via a REST API de debug do
 *   próprio Auth Emulator (`GET /emulator/v1/projects/{projectId}/oobCodes`),
 *   não via `getEmulatorAdminAuth()` (Admin SDK) — o Admin SDK não expõe
 *   nenhuma forma de consultar oobCodes pendentes; esta rota REST é um
 *   recurso de depuração documentado do próprio Firebase Local Emulator
 *   Suite, exclusivo do ambiente emulado (não existe equivalente em
 *   produção), e foi validada manualmente contra uma instância real do Auth
 *   Emulator antes deste spec ser escrito.
 * - Fluxos 8b (e-mail inválido), 8c (muitas tentativas) e 8e (erro genérico):
 *   confirmado empiricamente, durante a escrita deste spec, que o Auth
 *   Emulator NÃO reproduz esses três cenários genuinamente hoje —
 *   (1) nenhum formato de e-mail testado (incluindo formatos que já passam
 *   pela validação nativa HTML5 do `<input type="email">`, ex.: "a@b") faz o
 *   endpoint `accounts:sendOobCode` do emulador retornar outro erro que não
 *   `EMAIL_NOT_FOUND` — logo `auth/invalid-email` nunca é alcançável por uma
 *   submissão real via UI contra o emulador, apenas contra o Firebase real;
 *   (2) 30 chamadas consecutivas de `sendOobCode` para o mesmo e-mail
 *   retornaram 200 em todas, confirmando que o emulador não implementa
 *   rate-limiting (RNF-01 do UC já registra isso como delegado ao Firebase
 *   real). Por isso estes três testes usam `page.route(...).fulfill(...)`
 *   para simular a resposta HTTP exata que o Firebase Auth (real, fora do
 *   emulador) retornaria nesses códigos de erro documentados — isolando e
 *   confirmando apenas a lógica de tradução do frontend
 *   (`translateFirebaseError`, `forgot-password/page.tsx`), não o
 *   comportamento do Auth Emulator em si. Já o Fluxo 8d (erro de rede) É
 *   genuinamente reproduzível sem nenhum mock de conteúdo — basta abortar a
 *   conexão real com `route.abort()`, o que faz o SDK do Firebase lançar
 *   `auth/network-request-failed` por conta própria (comportamento
 *   confirmado manualmente antes deste spec, sem simular nenhum corpo de
 *   resposta). Revisor deve confirmar se o nível de cobertura via mock HTTP
 *   para 8b/8c/8e é aceitável ou se preferem documentá-los como não
 *   cobertos, seguindo o precedente do spec de UC-01 para cenários
 *   inalcançáveis pela infraestrutura de testes atual.
 */

/** Intercepta apenas a chamada `accounts:sendOobCode` do Auth Emulator, deixando todo o resto (incluindo outras chamadas identitytoolkit) passar normalmente. */
async function interceptSendOobCode(
  page: Page,
  handler: (route: Route) => Promise<void> | void
): Promise<void> {
  await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
    if (route.request().url().includes('sendOobCode')) {
      await handler(route);
      return;
    }
    await route.continue();
  });
}

function fulfillSendOobCodeError(message: string) {
  return (route: Route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 400, message, errors: [{ message }] } }),
    });
}

type OobCode = { email: string; requestType: string; oobLink: string };

/**
 * Consulta a REST API de debug do Auth Emulator (recurso exclusivo do
 * emulador, sem equivalente em produção) para confirmar que o Firebase Auth
 * de fato gerou um oobCode de redefinição de senha para o e-mail informado —
 * a evidência mais forte disponível de que o passo 5 do Fluxo Principal
 * (`sendPasswordResetEmail` gerando o link de ação) realmente aconteceu.
 */
async function getPasswordResetOobCodesForEmail(email: string): Promise<OobCode[]> {
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!authEmulatorHost) {
    throw new Error(
      'FIREBASE_AUTH_EMULATOR_HOST não definido — este spec só roda via `firebase emulators:exec` ' +
        '(npm run test:e2e), igual às demais suítes desta pasta.'
    );
  }
  const response = await fetch(
    `http://${authEmulatorHost}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/oobCodes`
  );
  const data = (await response.json()) as { oobCodes: OobCode[] };
  return data.oobCodes.filter((c) => c.email === email && c.requestType === 'PASSWORD_RESET');
}

function uniqueUnknownEmail(scenario: string): string {
  return `qa-uc07-nao-cadastrado-${scenario}-${Date.now()}-${Math.floor(
    Math.random() * 100000
  )}@example.com`;
}

test.describe('UC-07 — Recuperar Senha Esquecida', () => {
  test.describe('Fluxo Principal', () => {
    test('e-mail de uma conta existente aciona sendPasswordResetEmail nativo, sem nenhuma API route do Curva Mestra (passos 1-7, RN-01)', async ({
      page,
    }) => {
      const target = TEST_USERS.clinicUserA;

      let apiRouteCalled = false;
      await page.route('**/api/**', (route) => {
        apiRouteCalled = true;
        return route.continue();
      });

      // Passo 1: a partir de /login, clica em "Esqueceu a senha?".
      await page.goto('/login');
      await page.getByRole('link', { name: 'Esqueceu a senha?' }).click();

      // Passo 2: navega para /forgot-password, formulário com único campo de e-mail.
      await expect(page).toHaveURL(/\/forgot-password/);
      await expect(page.getByRole('heading', { name: 'Recuperar Senha' })).toBeVisible();
      await expect(
        page.getByText('Digite seu email para receber o link de recuperação')
      ).toBeVisible();

      // Passo 3.
      await page.locator('#email').fill(target.email);
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();

      // Passo 6: mensagem de sucesso completa.
      await expect(page.getByText('Email enviado com sucesso!')).toBeVisible();
      await expect(
        page.getByText(
          'Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.'
        )
      ).toBeVisible();
      await expect(page.getByText('Não se esqueça de verificar a pasta de spam.')).toBeVisible();

      // Passo 4/RN-01: nenhuma API route própria do Curva Mestra foi chamada —
      // a chamada foi inteiramente client-side, direto ao Firebase Auth.
      expect(apiRouteCalled).toBe(false);

      // Passo 5 (Esperado Firebase Auth, via REST de debug do emulador):
      // exatamente um oobCode de PASSWORD_RESET foi gerado para este e-mail,
      // com continueUrl apontando para /login.
      const oobCodes = await getPasswordResetOobCodesForEmail(target.email);
      expect(oobCodes.length).toBe(1);
      expect(decodeURIComponent(oobCodes[0].oobLink)).toContain('/login');
    });
  });

  test.describe('Fluxo Alternativo 7a — usuário já autenticado acessa /forgot-password', () => {
    test('sessão ativa redireciona automaticamente para fora de /forgot-password, sem exibir o formulário', async ({
      page,
    }) => {
      // Mesmo padrão de UC-01 (Fluxo Alternativo 7a): o destino final
      // observável para um usuário com claims configuradas é o resultado do
      // segundo redirect de /dashboard, não o passo intermediário.
      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );

      await page.goto('/forgot-password');

      await expect(page).toHaveURL(/\/clinic\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Recuperar Senha' })).toHaveCount(0);
    });
  });

  test.describe('Fluxos de Exceção', () => {
    test('8a — [CORRIGIDO] e-mail não corresponde a nenhuma conta exibe a MESMA tela de sucesso, sem enumerar contas (RN-03)', async ({
      page,
    }) => {
      const email = uniqueUnknownEmail('8a');

      await page.goto('/forgot-password');
      await page.locator('#email').fill(email);
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();

      // Mesma tela de sucesso do Fluxo Principal — nada distingue este caso.
      await expect(page.getByText('Email enviado com sucesso!')).toBeVisible();
      await expect(page.getByText('Usuário não encontrado')).toHaveCount(0);

      // Garantia mínima: nenhum oobCode foi de fato gerado para este e-mail —
      // a tela é idêntica, mas nenhum e-mail foi realmente enviado.
      const oobCodes = await getPasswordResetOobCodesForEmail(email);
      expect(oobCodes.length).toBe(0);
    });

    test('8b — e-mail inválido exibe "Email inválido" e retorna ao formulário (auth/invalid-email)', async ({
      page,
    }) => {
      await interceptSendOobCode(page, fulfillSendOobCodeError('INVALID_IDENTIFIER'));

      await page.goto('/forgot-password');
      const email = 'destinatario@dominio-valido.com';
      await page.locator('#email').fill(email);
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();

      await expect(page.getByText('Email inválido')).toBeVisible();
      await expect(page.getByText('Email enviado com sucesso!')).toHaveCount(0);

      // Passo 4 do Fluxo 8b: retorna ao passo 3 — formulário ainda visível,
      // e-mail digitado permanece no campo.
      await expect(page.locator('#email')).toHaveValue(email);
      await expect(page.getByRole('button', { name: 'Enviar link de recuperação' })).toBeVisible();
    });

    test('8c — muitas tentativas exibe "Muitas tentativas. Tente novamente mais tarde" (auth/too-many-requests)', async ({
      page,
    }) => {
      await interceptSendOobCode(page, fulfillSendOobCodeError('RESET_PASSWORD_EXCEED_LIMIT'));

      await page.goto('/forgot-password');
      await page.locator('#email').fill('destinatario@dominio-valido.com');
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();

      await expect(page.getByText('Muitas tentativas. Tente novamente mais tarde')).toBeVisible();
      await expect(page.getByText('Email enviado com sucesso!')).toHaveCount(0);
    });

    test('8d — erro de rede exibe "Erro de conexão. Verifique sua internet" (auth/network-request-failed)', async ({
      page,
    }) => {
      // Diferente de 8b/8c/8e, este cenário não simula nenhum corpo de
      // resposta — apenas aborta a conexão real, deixando o próprio SDK do
      // Firebase mapear a falha de rede para auth/network-request-failed.
      await interceptSendOobCode(page, (route) => route.abort('failed'));

      await page.goto('/forgot-password');
      await page.locator('#email').fill('destinatario@dominio-valido.com');
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();

      await expect(page.getByText('Erro de conexão. Verifique sua internet')).toBeVisible();
      await expect(page.getByText('Email enviado com sucesso!')).toHaveCount(0);
    });

    test('8e — erro genérico não mapeado exibe "Erro ao enviar email. Tente novamente"', async ({
      page,
    }) => {
      await interceptSendOobCode(page, fulfillSendOobCodeError('ALGUM_ERRO_NAO_MAPEADO'));

      await page.goto('/forgot-password');
      await page.locator('#email').fill('destinatario@dominio-valido.com');
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();

      await expect(page.getByText('Erro ao enviar email. Tente novamente')).toBeVisible();
      await expect(page.getByText('Email enviado com sucesso!')).toHaveCount(0);
    });
  });
});
