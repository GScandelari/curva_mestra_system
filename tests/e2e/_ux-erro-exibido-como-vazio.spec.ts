import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_TENANTS, TEST_USERS } from './fixtures/seed-data';

/**
 * Caderno transversal (Modo A, D3) de:
 * `ONLY_FOR_DEVS/TO_DO/BUGFIX-ux-erro-exibido-como-vazio.md` (v1.1): §6.3 (textos), §8.2 (tabela
 * de 12 cenários, princípio e notas de viabilidade) e STEP 7 (ações 1-5).
 *
 * Princípio (§8.2): falha de carregamento nunca aparece como lista/estado vazio nem como `0`.
 * Nenhuma resposta de dados é fabricada: a falha é injetada na rede (`route.abort()`) e o
 * emulador continua real. Única exceção: `route.fulfill` com status de erro e corpo mínimo
 * `{ error }` nos cenários 5, 11 e 12 (D4; precedentes UC-06/UC-07).
 *
 * Mapeamento cenário → UX → UC (tabela da §8.2):
 * |  # | Tela                                   | UX            | UC              | Usuário        |
 * |----|----------------------------------------|---------------|-----------------|----------------|
 * |  1 | /clinic/requests (falha na lista)      | UX-038        | UC-16..UC-19    | clinicAdminA   |
 * |  2 | /clinic/requests (recuperação)         | UX-038        | UC-16..UC-19    | clinicAdminA   |
 * |  3 | /consultant/transfer-requests (abort)  | UX-053        | UC-26/27/54     | consultantB    |
 * |  4 | /consultant/transfer-requests (recup.) | UX-053        | UC-26/27/54     | consultantB    |
 * |  5 | /consultant/transfer-requests (500)    | UX-053 (D4)   | UC-26/27/54     | consultantB    |
 * |  6 | /consultant/clinics (abort + recup.)   | UX-050        | UC-48           | consultantB    |
 * |  7 | /clinic/dashboard (4 blocos)           | UX-025/UX-026 | UC-53           | clinicAdminA   |
 * |  8 | /admin/users (abort + recup.)          | UX-047        | UC-36           | systemAdmin    |
 * |  9 | /consultant/dashboard (clínicas)       | UX-051        | UC-48/UC-52     | consultantB    |
 * | 10 | /consultant/dashboard (perfil)         | UX-051        | UC-48           | consultantB    |
 * | 11 | /consultant/clinics (500)              | UX-050 (D4)   | UC-48           | consultantB    |
 * | 12 | /consultant/dashboard (403)            | UX-051 (D4)   | UC-48           | consultantB    |
 *
 * Técnicas de falha (STEP 7, ação 2):
 * - Firestore direto (cenários 1, 2, 7, 8): `page.route(FIRESTORE_GLOB, abort)`, mesma técnica
 *   do UC-35. Cobre `Listen/channel` e `Write/channel` do WebChannel do SDK client; o Admin SDK
 *   roda no processo do teste e não passa pela rota.
 * - API routes (cenários 3, 4, 6, 9, 10): `page.route('**\/api/consultants/...', abort)`, padrão
 *   do UC-59. A rota é instalada DEPOIS do login e ANTES da navegação completa (`goto`/`reload`).
 * - Em todos os casos de `abort`, o teste espera o `requestfailed` da URL interceptada antes das
 *   asserções, para que um glob errado falhe de forma explícita em vez de mascarar o cenário.
 *
 * REGRA (STEP 7, ação 4): se a interceptação não funcionar (o `requestfailed` nunca chega, ou a
 * tela não entra em erro com a rede bloqueada), PARAR e consultar o usuário. Não trocar de
 * técnica por conta própria (nada de mexer em rules, seed ou código da app para forçar a falha).
 *
 * Somente leitura: nenhum cenário grava no emulador (o Admin SDK só lê, para conferir
 * pré-condições). Sem `afterEach` de limpeza; cada teste tem contexto novo do Playwright e as
 * rotas são removidas com `unroute` quando o cenário exige recuperação.
 *
 * Usuários: `clinicAdminA`, `systemAdmin` e `consultantB` (todos com aceite de termos no seed,
 * `scripts/seed-emulator.ts:166-171`). `TEST_USERS.consultant` e `clinicUserA` NÃO são usados:
 * ficam de propósito sem aceite e cairiam em `/accept-terms`.
 *
 * Assunções (a confirmar na revisão humana):
 * 1. Os globs pegam o transporte real (assunção 1 do UC-35). Se falhar, conferir as URLs no
 *    trace e ajustar o glob — ver REGRA acima.
 * 2. Cenários 2 e 8 (recuperação via Firestore) dependem do backoff de reconexão do SDK; por
 *    isso `toPass` com 30 s e cliques repetidos em "Tentar novamente", como no UC-35 cenário 2.
 * 3. Cenário 1/2: o tenant `test-clinic-a` não tem solicitações no seed. UC-51/UC-52/UC-58 criam
 *    e apagam as suas; a pré-condição é conferida via Admin SDK (só leitura) e o teste falha com
 *    mensagem explícita se sobrar resíduo de outro spec.
 * 4. Cenários 6 e 10 (recuperação/bloco normal das clínicas do consultor): a §8.2 assume
 *    `consultantB` com `authorized_tenants: []`, mas o UC-56 (que roda antes na suíte completa,
 *    `workers: 1`) vincula clínicas a `consultantB` e não desfaz o vínculo. Para não depender da
 *    ordem dos specs, o resultado esperado é derivado do emulador (Admin SDK, só leitura):
 *    sem vínculos → vazio legítimo ("Nenhuma clínica vinculada" / "Você ainda não possui
 *    clínicas vinculadas"); com vínculos → nome da primeira clínica visível. A tabela da §8.2
 *    pede o vazio incondicional — confirmar esta adaptação na revisão.
 * 5. Cenário 7 (dashboard da clínica) foi implementado como teste normal. Análise do código:
 *    `ProtectedRoute.tsx:66` (`getDoc(system_settings/global)` sem `catch`) gera rejeição não
 *    tratada sem redirecionar (o `throw` interrompe `checkAccess` antes de qualquer
 *    `router.push`); `usePendingTerms` tem `catch` e não redireciona; `SuspensionInterceptor`
 *    mostra "Verificando acesso..." até o SDK declarar offline (por isso o primeiro `expect` tem
 *    timeout maior). Um eventual overlay do `next dev` não remove o DOM, e o cenário não clica
 *    em nada. SE, ao rodar, o overlay ou um redirecionamento impedirem as asserções: trocar
 *    `test(` por `test.fixme(` neste cenário, registrar o motivo aqui e no PR, e deixar a
 *    cobertura para a validação manual (STEP 8) — SEM alterar `ProtectedRoute` (§8.2).
 * 6. Textos esperados copiados literalmente da §6.3 e de `src/lib/loadErrors.ts`
 *    (`LOAD_ERROR_MESSAGES`) — não importados do código da app, para que uma troca acidental de
 *    texto seja detectada aqui.
 * 7. Premissa da D1 (STEP 7, ação 6 — `getDocs` × `getDocsFromServer` no cenário 1): CONFIRMADA
 *    — resultado (a), em 23/10/2026. Com `listSolicitacoes` trocado temporariamente para `getDocs`
 *    e o Firestore abortado, a tela mostrou "Procedimentos (0)" / "Nenhum procedimento
 *    encontrado" / "Crie seu primeiro procedimento" (o bug original) em vez do erro. Só
 *    `getDocsFromServer` faz a falha de rede virar erro. Troca revertida e conferida com `git diff`.
 */

const FIRESTORE_GLOB = '**/google.firestore.v1.Firestore/**';
const TRANSFER_REQUESTS_PATH = '/api/consultants/transfer-requests';
const MY_CLINICS_PATH = '/api/consultants/me/clinics';
const CONSULTANT_B_PROFILE_PATH = `/api/consultants/${TEST_USERS.consultantB.uid}`;

/** `LOAD_ERROR_MESSAGES` de `src/lib/loadErrors.ts` (cópia literal, assunção 6). */
const MSG_NETWORK =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
const MSG_SERVER = 'O servidor não conseguiu responder agora. Tente novamente em instantes.';

/** Corpo do 500 fabricado (D4): nunca pode aparecer na tela (RF-04). */
const RAW_SERVER_ERROR = 'Internal error (teste)';

async function loginClinicAdminA(page: Page) {
  await loginAs(
    page,
    { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
    '/clinic/dashboard'
  );
}

async function loginSystemAdmin(page: Page) {
  await loginAs(
    page,
    { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
    '/admin/dashboard'
  );
}

/** Login do consultantB via UI, mesmo padrão de `loginAsConsultantB` do UC-56 (l. 98-104). */
async function loginConsultantB(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(TEST_USERS.consultantB.email);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/consultant\/dashboard/);
}

/**
 * Espera da interceptação embrulhada em objeto: uma `async function` que devolvesse a Promise
 * direto a "achataria", e o `await` do helper esperaria o evento antes da navegação.
 */
interface Interception {
  happened: Promise<unknown>;
}

/** Aborta na rede as chamadas do navegador que terminam em `path` e devolve a espera do `requestfailed`. */
async function abortApiRoute(page: Page, path: string): Promise<Interception> {
  await page.route(`**${path}`, (route) => route.abort());
  return {
    happened: page.waitForEvent('requestfailed', (req) => new URL(req.url()).pathname === path),
  };
}

/** Aborta o transporte do SDK client do Firestore e devolve a espera do `requestfailed`. */
async function abortFirestore(page: Page): Promise<Interception> {
  await page.route(FIRESTORE_GLOB, (route) => route.abort());
  return {
    happened: page.waitForEvent('requestfailed', (req) =>
      req.url().includes('google.firestore.v1.Firestore')
    ),
  };
}

/** Responde `path` com status de erro e corpo mínimo `{ error }` (D4) e devolve a espera da resposta. */
async function fulfillApiError(
  page: Page,
  path: string,
  status: number,
  error: string
): Promise<Interception> {
  await page.route(`**${path}`, (route: Route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error }),
    })
  );
  return {
    happened: page.waitForResponse(
      (res) => new URL(res.url()).pathname === path && res.status() === status
    ),
  };
}

/** Card do shadcn (`div.rounded-lg.border`) identificado pelo `CardTitle` (h3). */
function cardByTitle(page: Page, title: string): Locator {
  return page
    .locator('div.rounded-lg.border')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

/**
 * Nomes das clínicas vinculadas a consultantB HOJE no emulador (só leitura), na mesma ordem e
 * com o mesmo filtro (tenant existente) de `GET /api/consultants/me/clinics` (assunção 4).
 */
async function linkedClinicNamesOfConsultantB(): Promise<string[]> {
  const db = getEmulatorAdminFirestore();
  const consultant = await db.collection('consultants').doc(TEST_USERS.consultantB.uid).get();
  const tenantIds = (consultant.data()?.authorized_tenants ?? []) as string[];
  const names: string[] = [];
  for (const tenantId of tenantIds) {
    const tenant = await db.collection('tenants').doc(tenantId).get();
    if (tenant.exists) names.push(String(tenant.data()?.name ?? ''));
  }
  return names;
}

async function countSolicitacoesClinicA(): Promise<number> {
  const snap = await getEmulatorAdminFirestore()
    .collection(`tenants/${TEST_TENANTS.clinicA.tenant_id}/solicitacoes`)
    .get();
  return snap.size;
}

test.describe('Lote "erro exibido como vazio" — falha de carregamento nunca vira estado vazio', () => {
  // Next dev compila cada rota sob demanda e os cenários de Firestore incluem backoff de reconexão.
  test.setTimeout(120_000);

  test.describe('Procedimentos — /clinic/requests (UX-038; UC-16..UC-19)', () => {
    test('cenários 1 e 2: falha na troca de filtro mostra erro (não "Crie seu primeiro procedimento") e "Tentar novamente" recupera (RN-01)', async ({
      page,
    }) => {
      // Pré-condição (assunção 3): o vazio exibido online é legítimo.
      expect(
        await countSolicitacoesClinicA(),
        'tenants/test-clinic-a/solicitacoes deveria estar vazio (resíduo de outro spec?)'
      ).toBe(0);

      await loginClinicAdminA(page);
      await page.goto('/clinic/requests');

      // Online: vazio legítimo atual, intacto (texto e CTA idênticos aos de antes).
      await expect(page.getByText('Crie seu primeiro procedimento')).toBeVisible();
      await expect(page.getByText('Procedimentos (0)')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Novo Procedimento' })).toHaveCount(2);

      // Cenário 1 — a falha é provocada DEPOIS do carregamento (troca de filtro), §8.2.
      const firestoreBlocked = await abortFirestore(page);
      await cardByTitle(page, 'Filtros').getByRole('combobox').click();
      await page.getByRole('option', { name: 'Agendada', exact: true }).click();
      await firestoreBlocked.happened;

      await expect(page.getByText('Não foi possível carregar os procedimentos')).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByText(
          'Seus procedimentos registrados não foram afetados; a lista só não pôde ser lida agora. Antes de registrar um novo, tente carregar de novo para evitar duplicidade.'
        )
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
      await expect(page.getByText('Crie seu primeiro procedimento')).toHaveCount(0);
      await expect(page.getByText('Nenhum procedimento encontrado')).toHaveCount(0);
      // Só o botão do cabeçalho (clinic_admin) sobra; o CTA do vazio sumiu.
      await expect(page.getByRole('button', { name: 'Novo Procedimento' })).toHaveCount(1);
      // Título do card sem contagem: nunca "(0)" durante o erro.
      await expect(page.getByText(/^Procedimentos \(\d+\)$/)).toHaveCount(0);

      // Cenário 2 — a rede volta; "Tentar novamente" pode exigir mais de um clique (backoff).
      await page.unroute(FIRESTORE_GLOB);
      const emptyState = page.getByText('Crie seu primeiro procedimento');
      await expect(async () => {
        const retry = page.getByRole('button', { name: 'Tentar novamente' });
        if (await retry.isVisible()) {
          await retry.click({ timeout: 5_000 });
        }
        await expect(emptyState).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 30_000 });

      await expect(page.getByText('Não foi possível carregar os procedimentos')).toHaveCount(0);
      await expect(page.getByText('Procedimentos (0)')).toBeVisible();
    });
  });

  test.describe('Pedidos de Transferência — /consultant/transfer-requests (UX-053; UC-26/27/54)', () => {
    test('cenários 3 e 4: rota bloqueada substitui as abas pelo erro (não "Nenhum pedido pendente") e "Tentar novamente" recupera (RF-06)', async ({
      page,
    }) => {
      await loginConsultantB(page);

      // Cenário 3 — rota abortada antes da navegação completa.
      const blocked = await abortApiRoute(page, TRANSFER_REQUESTS_PATH);
      await page.goto('/consultant/transfer-requests');
      await blocked.happened;

      await expect(
        page.getByText('Não foi possível carregar os pedidos de transferência')
      ).toBeVisible();
      await expect(
        page.getByText(
          'Os pedidos pendentes continuam valendo e têm prazo de resposta. Tente novamente para vê-los.'
        )
      ).toBeVisible();
      // fetch abortado → TypeError → mensagem de rede (describeLoadError).
      await expect(page.getByText(MSG_NETWORK)).toBeVisible();
      await expect(page.getByRole('tab', { name: /Pendentes/ })).toHaveCount(0);
      await expect(page.getByText('Nenhum pedido de transferência pendente')).toHaveCount(0);

      // Cenário 4 — a rota volta; API route não tem backoff, um clique basta.
      await page.unroute(`**${TRANSFER_REQUESTS_PATH}`);
      await page.getByRole('button', { name: 'Tentar novamente' }).click();

      await expect(page.getByRole('tab', { name: /Pendentes/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Histórico' })).toBeVisible();
      await expect(
        page.getByText('Não foi possível carregar os pedidos de transferência')
      ).toHaveCount(0);
      // NÃO asserir vazio: outros specs (UC-54) podem deixar convites para consultantB (§8.2).
    });

    test('cenário 5: resposta 500 mostra erro com texto fixo de servidor e nunca o corpo cru (D4, RF-04)', async ({
      page,
    }) => {
      await loginConsultantB(page);

      const answered = await fulfillApiError(page, TRANSFER_REQUESTS_PATH, 500, RAW_SERVER_ERROR);
      await page.goto('/consultant/transfer-requests');
      await answered.happened;

      await expect(
        page.getByText('Não foi possível carregar os pedidos de transferência')
      ).toBeVisible();
      await expect(page.getByText(MSG_SERVER)).toBeVisible();
      await expect(page.getByText(RAW_SERVER_ERROR)).toHaveCount(0);
      await expect(page.getByRole('tab', { name: /Pendentes/ })).toHaveCount(0);
      await expect(page.getByText('Nenhum pedido de transferência pendente')).toHaveCount(0);
    });
  });

  test.describe('Minhas Clínicas — /consultant/clinics (UX-050; UC-48)', () => {
    test('cenário 6: rota bloqueada mostra erro (não "Nenhuma clínica vinculada") e "Tentar novamente" volta ao estado real (RN-01)', async ({
      page,
    }) => {
      await loginConsultantB(page);

      const blocked = await abortApiRoute(page, MY_CLINICS_PATH);
      await page.goto('/consultant/clinics');
      await blocked.happened;

      await expect(page.getByText('Não foi possível carregar suas clínicas')).toBeVisible();
      await expect(
        page.getByText(
          'Seus vínculos não foram alterados. Tente novamente antes de buscar ou pedir vínculo com uma clínica.'
        )
      ).toBeVisible();
      await expect(page.getByText(MSG_NETWORK)).toBeVisible();
      await expect(page.getByText('Nenhuma clínica vinculada')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Buscar Clínicas', exact: true })).toHaveCount(
        0
      );

      // Recuperação: estado esperado derivado do emulador (assunção 4).
      const linkedNames = await linkedClinicNamesOfConsultantB();
      await page.unroute(`**${MY_CLINICS_PATH}`);
      await page.getByRole('button', { name: 'Tentar novamente' }).click();

      await expect(page.getByText('Não foi possível carregar suas clínicas')).toHaveCount(0);
      if (linkedNames.length === 0) {
        await expect(page.getByText('Nenhuma clínica vinculada')).toBeVisible();
      } else {
        await expect(page.getByText(linkedNames[0], { exact: true }).first()).toBeVisible();
        await expect(page.getByText('Nenhuma clínica vinculada')).toHaveCount(0);
      }
    });

    test('cenário 11: resposta 500 mostra erro com texto fixo de servidor e nunca o corpo cru (D4, RF-04)', async ({
      page,
    }) => {
      await loginConsultantB(page);

      const answered = await fulfillApiError(page, MY_CLINICS_PATH, 500, RAW_SERVER_ERROR);
      await page.goto('/consultant/clinics');
      await answered.happened;

      await expect(page.getByText('Não foi possível carregar suas clínicas')).toBeVisible();
      await expect(page.getByText(MSG_SERVER)).toBeVisible();
      await expect(page.getByText(RAW_SERVER_ERROR)).toHaveCount(0);
      await expect(page.getByText('Nenhuma clínica vinculada')).toHaveCount(0);
    });
  });

  test.describe('Dashboard da clínica — /clinic/dashboard (UX-025 e UX-026; UC-53)', () => {
    // Cenário "se viável" (§8.2, nota de viabilidade). Ver assunção 5 antes de alterar.
    test('cenário 7: com o Firestore bloqueado, os 4 blocos mostram o próprio erro e nenhum vazio (RF-08)', async ({
      page,
    }) => {
      await loginClinicAdminA(page);

      const firestoreBlocked = await abortFirestore(page);
      await page.reload();
      await firestoreBlocked.happened;

      // Timeout maior: SuspensionInterceptor só libera depois que o SDK se declara offline.
      await expect(
        page.getByText('Não foi possível carregar os próximos procedimentos')
      ).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText('Não foi possível carregar a atividade recente')).toBeVisible();
      await expect(page.getByText('Não foi possível carregar o resumo do estoque')).toBeVisible();
      await expect(
        page.getByText('Não foi possível carregar os procedimentos do mês')
      ).toBeVisible();
      // Cada bloco com o próprio "Tentar novamente".
      await expect(page.getByRole('button', { name: 'Tentar novamente' })).toHaveCount(4);

      await expect(
        page.getByText('Nenhum procedimento agendado nas próximas 2 semanas')
      ).toHaveCount(0);
      await expect(page.getByText('Nenhuma movimentação recente')).toHaveCount(0);
      await expect(page.getByText('Nenhum produto em estoque')).toHaveCount(0);
      await expect(page.getByText('Sem dados de procedimentos')).toHaveCount(0);
      await expect(page.getByText('Erro ao carregar dados do dashboard')).toHaveCount(0);
    });
  });

  test.describe('Usuários — /admin/users (UX-047; UC-36)', () => {
    test('cenário 8: falha de leitura mostra erro e "Indisponível" nos contadores (não "Nenhum usuário cadastrado") e "Tentar novamente" recupera (RN-03)', async ({
      page,
    }) => {
      await loginSystemAdmin(page);

      // Mesma ordem do UC-35: rota depois do login e antes da navegação completa.
      const firestoreBlocked = await abortFirestore(page);
      await page.goto('/admin/users');
      await firestoreBlocked.happened;

      await expect(page.getByText('Não foi possível carregar os usuários')).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText('Nenhum usuário cadastrado')).toHaveCount(0);
      await expect(cardByTitle(page, 'Total de Usuários')).toContainText('Indisponível');
      await expect(cardByTitle(page, 'Usuários Ativos')).toContainText('Indisponível');
      await expect(cardByTitle(page, 'Administradores')).toContainText('Indisponível');
      await expect(cardByTitle(page, 'Clínicas')).toContainText('Indisponível');

      // Recuperação: backoff do SDK, mesmo padrão do UC-35 cenário 2.
      await page.unroute(FIRESTORE_GLOB);
      const clinicAdminRow = page
        .getByRole('row')
        .filter({ hasText: TEST_USERS.clinicAdminA.email });
      await expect(async () => {
        const retry = page.getByRole('button', { name: 'Tentar novamente' });
        if (await retry.isVisible()) {
          await retry.click({ timeout: 5_000 });
        }
        await expect(clinicAdminRow).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 30_000 });

      await expect(page.getByText('Não foi possível carregar os usuários')).toHaveCount(0);
      await expect(cardByTitle(page, 'Total de Usuários')).not.toContainText('Indisponível');
    });
  });

  test.describe('Dashboard do consultor — /consultant/dashboard (UX-051; UC-48/UC-52)', () => {
    test('cenário 9: falha nas clínicas mostra erro no bloco e "Indisponível" nos cards; o código do consultor continua visível', async ({
      page,
    }) => {
      await loginConsultantB(page);

      const blocked = await abortApiRoute(page, MY_CLINICS_PATH);
      await page.goto('/consultant/dashboard');
      await blocked.happened;

      await expect(page.getByText('Não foi possível carregar suas clínicas')).toBeVisible();
      await expect(page.getByText('Você ainda não possui clínicas vinculadas')).toHaveCount(0);
      await expect(cardByTitle(page, 'Clínicas Vinculadas')).toContainText('Indisponível');
      await expect(cardByTitle(page, 'Projeção de Reposição')).toContainText('Indisponível');
      // A falha das clínicas não derruba o perfil (§6.3.6).
      await expect(page.getByText(TEST_USERS.consultantB.code, { exact: true })).toBeVisible();
      await expect(page.getByText('Não foi possível carregar seu código de consultor')).toHaveCount(
        0
      );
    });

    test('cenário 10: falha no perfil mostra erro no lugar do cartão do código; saudação sem vírgula; bloco de clínicas normal', async ({
      page,
    }) => {
      await loginConsultantB(page);

      const linkedNames = await linkedClinicNamesOfConsultantB();
      const blocked = await abortApiRoute(page, CONSULTANT_B_PROFILE_PATH);
      await page.goto('/consultant/dashboard');
      await blocked.happened;

      await expect(
        page.getByText('Não foi possível carregar seu código de consultor')
      ).toBeVisible();
      await expect(page.getByText('Seu código de consultor', { exact: true })).toHaveCount(0);
      await expect(page.getByText(TEST_USERS.consultantB.code, { exact: true })).toHaveCount(0);
      // Sem nome do perfil: saudação sem vírgula final (§6.3.6).
      await expect(
        page.getByText('Bem-vindo ao Portal do Consultor', { exact: true })
      ).toBeVisible();
      await expect(page.getByText(/^Bem-vindo ao Portal do Consultor,/)).toHaveCount(0);

      // A falha do perfil não impede a leitura das clínicas (assunção 4 para o estado esperado).
      await expect(page.getByText('Não foi possível carregar suas clínicas')).toHaveCount(0);
      await expect(cardByTitle(page, 'Clínicas Vinculadas')).not.toContainText('Indisponível');
      if (linkedNames.length === 0) {
        await expect(page.getByText('Você ainda não possui clínicas vinculadas')).toBeVisible();
      } else {
        await expect(page.getByText(linkedNames[0], { exact: true }).first()).toBeVisible();
      }
    });

    test('cenário 12: resposta 403 das clínicas mostra a mensagem 4xx do servidor como detalhe (D4, RF-04)', async ({
      page,
    }) => {
      await loginConsultantB(page);

      const answered = await fulfillApiError(
        page,
        MY_CLINICS_PATH,
        403,
        'Acesso restrito a consultores'
      );
      await page.goto('/consultant/dashboard');
      await answered.happened;

      await expect(page.getByText('Não foi possível carregar suas clínicas')).toBeVisible();
      await expect(page.getByText('Acesso restrito a consultores')).toBeVisible();
      await expect(page.getByText('Você ainda não possui clínicas vinculadas')).toHaveCount(0);
      await expect(cardByTitle(page, 'Clínicas Vinculadas')).toContainText('Indisponível');
    });
  });
});
