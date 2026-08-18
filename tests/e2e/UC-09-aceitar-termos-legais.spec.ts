import { test, expect, Page } from '@playwright/test';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_LEGAL_DOCUMENTS, TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura retroativa (Modo B) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-09-aceitar-termos-legais.md (v1.4.1)
 *
 * Cobre:
 * - Fluxo Principal, Variante A (/accept-terms — usuário existente): passos 1-12
 *   (aceite de ambos os documentos pendentes).
 * - Fluxo Principal, Variante B (/clinic/setup/terms — onboarding): passos 1-12
 *   (aceite sem nunca abrir o Dialog de leitura completa — RN-06) e verificação
 *   isolada do próprio Dialog "Ler ... Completo" (conteúdo integral + versão).
 * - Fluxo Alternativo 7a (usuário sem termos pendentes navega normalmente, sem
 *   interceptação).
 * - Fluxo de Exceção 8c (nem todos os documentos marcados — botão permanece
 *   desabilitado, RN-04, garantia mínima de falha: nenhum aceite é gravado).
 * - Fluxo de Exceção 8d (usuário não autenticado é redirecionado para /login em
 *   ambas as variantes).
 *
 * ASSUNÇÃO (Modo B, passo 3 do agente): `loginAs` (tests/e2e/helpers/auth.ts) só
 * aceita '/admin/dashboard' | '/clinic/dashboard' como destino esperado, porque foi
 * desenhado para logins sem pendência de termos. Como o próprio objeto deste UC é
 * validar redirecionamentos para '/accept-terms' e '/clinic/setup/terms', este spec
 * define um login local (`submitLoginForm`) que replica exatamente os mesmos passos
 * de UI (`#email`, `#password`, botão "Entrar") sem embutir a asserção de destino —
 * a asserção de URL de cada teste fica explícita no próprio `test()`. Nenhum usuário
 * novo foi inventado: todos os cenários abaixo usam apenas contas já existentes em
 * tests/e2e/fixtures/seed-data.ts.
 *
 * ACHADO EMPÍRICO (validado contra o Firebase Emulator Suite real, não só listagem
 * estática): qualquer `page.goto()` para uma rota protegida, feito logo após um
 * login via UI na mesma sessão do browser, pode fazer a página recarregar antes de
 * `onAuthStateChanged`/`getIdToken(true)` (src/hooks/useAuth.ts) resolverem, e
 * flashear uma passagem por "/login" antes de assentar no destino correto — mais
 * visível em `/accept-terms` (Variante A não tem guard de `authLoading`, só o
 * check síncrono `if (!auth.currentUser)`) do que em `/clinic/setup/terms`
 * (Variante B, guard defensivo do commit `c3f18d4`), mas observado em ambas.
 * `gotoAfterSignIn` (abaixo) reforça a navegação com até 3 tentativas de
 * `page.goto()` até a URL esperada assentar, para não deixar o spec flaky por causa
 * dessa característica de timing do app (não é um bug deste UC — não é corrigido
 * aqui, só contornado na automação). Vale a pena o revisor humano estar ciente
 * desse comportamento ao revisar este spec.
 *
 * ORDEM DOS TESTES IMPORTA (fullyParallel: false, workers: 1, playwright.config.ts):
 * o seed (scripts/seed-emulator.ts) só roda uma vez para toda a suíte, e cada conta
 * clinic_admin/clinic_user sem aceite prévio (clinicUserA, clinicAdminB) só serve
 * para exercitar um fluxo que efetivamente grava os aceites (main flow) — por isso a
 * verificação do Dialog "Ler ... Completo" da Variante B (que não pode consumir a
 * pendência) roda ANTES do teste de fluxo principal que usa a mesma conta
 * (clinicAdminB) e a consome. Não altere a ordem dos `test()` abaixo sem revisar essa
 * dependência.
 *
 * NÃO cobertos nesta rodada (limitação de seed/infraestrutura, não do UC em si):
 * - Passo 6 de ambas as variantes (usuário já com todos os aceites em dia navega
 *   direto para a URL da tela de aceite e é redirecionado de volta sozinho): tentar
 *   reproduzir isso via `page.goto()` direto colide exatamente com o achado empírico
 *   descrito acima — o `auth.currentUser` synchronous check da Variante A entra em
 *   corrida com a resolução assíncrona do Firebase Auth após o reload e redireciona
 *   para /login antes mesmo do critério de "sem pendências" ser avaliado, produzindo
 *   um resultado final não determinístico (às vezes /login → dashboard, nunca
 *   chegando a exercitar de fato o passo 6). Como esse caminho normalmente só é
 *   alcançado via navegação client-side (TermsInterceptor), não por reload de URL, a
 *   automação via Playwright não tem hoje um jeito não-flaky de forçar esse cenário
 *   específico sem tocar código de produção.
 * - 8a e 8b (loops de redirecionamento históricos, já corrigidos no commit `16877f1`):
 *   o critério atual (RN-01/02/03) já é exercitado indiretamente pelos testes de
 *   Fluxo Principal acima (Map<document_id, document_version> + união dos filtros
 *   required_for_*), mas reproduzir os cenários históricos exatos exigiria (a) mudar
 *   a versão ou os flags required_for_* de um documento já semeado — arriscando
 *   efeitos colaterais em outros specs que dependem do estado atual de
 *   `qa-legal-doc-accepted`/`qa-legal-doc-pending` (ex.: tests/e2e/_infra-smoke.spec.ts
 *   espera systemAdmin/clinicAdminA sem nenhuma pendência) — ou (b) um terceiro
 *   documento legal semeado com `required_for_registration`/`required_for_existing_users`
 *   divergentes, que hoje não existe em tests/e2e/fixtures/seed-data.ts. Sinalizado
 *   como possível extensão de seed para o revisor decidir.
 * - 8e (erro ao carregar/salvar via Firestore): exigiria derrubar ou injetar falha no
 *   Firestore do emulador no meio do teste, sem mecanismo disponível hoje nesta
 *   suíte (mesma limitação já documentada no spec de UC-01 para seu 8c).
 * - 8f (documento excluído permanentemente pelo System Admin, só possível se nunca
 *   aceito): os dois documentos semeados (`qa-legal-doc-accepted`,
 *   `qa-legal-doc-pending`) já têm aceites de systemAdmin/clinicAdminA — a exclusão
 *   seria sempre bloqueada por UC-34/RN-03 para eles. Testar o caminho de sucesso
 *   exigiria um terceiro documento legal semeado sem nenhum aceite, hoje inexistente
 *   em seed-data.ts.
 */

const ACCEPT_TERMS_URL = /\/accept-terms/;
const CLINIC_SETUP_TERMS_URL = /\/clinic\/setup\/terms/;

async function submitLoginForm(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/**
 * `page.goto()` para uma rota protegida logo após login via UI — ver "ACHADO
 * EMPÍRICO" no cabeçalho do arquivo. Tenta a navegação até 3 vezes até a URL
 * assentar no padrão esperado, em vez de depender de uma única tentativa que pode
 * flashear "/login" e nunca se recuperar dentro da janela de retry do `expect()`.
 */
async function gotoAfterSignIn(
  page: Page,
  url: string,
  expectedUrlPattern: RegExp,
  attempts = 3
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await page.goto(url);
    try {
      await expect(page).toHaveURL(expectedUrlPattern, { timeout: 6000 });
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }
}

function acceptanceCheckbox(page: Page, documentId: string) {
  return page.locator(`#accept-${documentId}`);
}

async function getAcceptance(userId: string, documentId: string) {
  const db = getEmulatorAdminFirestore();
  const snap = await db
    .collection('user_document_acceptances')
    .where('user_id', '==', userId)
    .where('document_id', '==', documentId)
    .get();
  return snap;
}

test.describe('UC-09 — Aceitar Termos Legais', () => {
  test.describe('Fluxo Principal — Variante A (usuário existente, /accept-terms)', () => {
    test('usuário existente sem nenhum aceite vê os dois documentos pendentes, aceita ambos e é redirecionado para "/" (passos 1-12)', async ({
      page,
    }) => {
      // Passo 1: TermsInterceptor detecta pendência assim que clinicUserA (role
      // clinic_user, sem nenhum registro em user_document_acceptances no seed)
      // tenta navegar para qualquer rota protegida após o login (redirectByRole
      // manda para /clinic/dashboard primeiro; como o path não começa com
      // /clinic/setup, cai no ramo "usuário de clínica já fez onboarding" →
      // /accept-terms). Toda essa cadeia é client-side (router.push), sem nenhum
      // page.goto/reload no meio — por isso não sofre a corrida descrita no
      // "ACHADO EMPÍRICO" do cabeçalho.
      await submitLoginForm(page, {
        email: TEST_USERS.clinicUserA.email,
        password: TEST_PASSWORD,
      });
      await expect(page).toHaveURL(ACCEPT_TERMS_URL);

      // Passo 2 (implícito): a página não redirecionou para /login — usuário
      // autenticado é reconhecido por auth.currentUser.
      await expect(page.getByRole('heading', { name: 'Aceite os Termos' })).toBeVisible();

      // Passos 3-5: os dois documentos ativos e obrigatórios do seed aparecem como
      // pendentes (nenhum aceite existente para clinicUserA), com conteúdo
      // completo (sem truncamento — diferença da Variante B, RN-06).
      const acceptedCheckbox = acceptanceCheckbox(page, TEST_LEGAL_DOCUMENTS.withAcceptance.id);
      const pendingCheckbox = acceptanceCheckbox(page, TEST_LEGAL_DOCUMENTS.withoutAcceptance.id);
      // .first(): o título de cada documento aparece 2x na tela (CardTitle da
      // seção + heading "# {título}" do Markdown renderizado) — presença de
      // qualquer um dos dois já confirma que o documento está listado.
      await expect(page.getByText(TEST_LEGAL_DOCUMENTS.withAcceptance.title).first()).toBeVisible();
      await expect(
        page.getByText(TEST_LEGAL_DOCUMENTS.withoutAcceptance.title).first()
      ).toBeVisible();
      await expect(page.getByText('Versão 1.0')).toHaveCount(2);
      await expect(acceptedCheckbox).toBeVisible();
      await expect(pendingCheckbox).toBeVisible();

      // Passos 7-8: marca os dois checkboxes ("Li e aceito {título}").
      await acceptedCheckbox.click();
      await pendingCheckbox.click();

      // Passo 9: botão "Aceitar Todos os Documentos" habilitado só quando todos
      // estão marcados (RN-04).
      const submitButton = page.getByRole('button', { name: 'Aceitar Todos os Documentos' });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // Passo 11: toast de sucesso.
      await expect(page.getByText('Termos aceitos com sucesso')).toBeVisible();

      // Passo 11: redireciona para "/".
      await expect(page).toHaveURL(/\/$/, { timeout: 15000 });

      // Pós-condição de sucesso (Seção 4.1): um documento novo em
      // user_document_acceptances por documento aceito, com document_version da
      // versão atual do documento, accepted_at preenchido, ip_address sempre null
      // (RN-07) e user_agent do navegador.
      for (const doc of Object.values(TEST_LEGAL_DOCUMENTS)) {
        const snap = await getAcceptance(TEST_USERS.clinicUserA.uid, doc.id);
        expect(snap.size).toBe(1);
        const acceptance = snap.docs[0].data();
        expect(acceptance.document_version).toBe('1.0');
        expect(acceptance.accepted_at).toBeTruthy();
        expect(acceptance.ip_address).toBeNull();
        expect(typeof acceptance.user_agent).toBe('string');
        expect(acceptance.user_agent.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Fluxo Principal — Variante B (onboarding, /clinic/setup/terms)', () => {
    // IMPORTANTE: este teste roda ANTES do teste de fluxo principal abaixo (que usa
    // a mesma conta, clinicAdminB, e consome sua pendência) — ver nota de ordenação
    // no cabeçalho do arquivo.
    test('botão "Ler ... Completo" abre um Dialog com o conteúdo integral e a versão do documento (RN-06)', async ({
      page,
    }) => {
      await submitLoginForm(page, {
        email: TEST_USERS.clinicAdminB.email,
        password: TEST_PASSWORD,
      });
      await gotoAfterSignIn(page, '/clinic/setup', CLINIC_SETUP_TERMS_URL);

      const doc = TEST_LEGAL_DOCUMENTS.withAcceptance;
      await page.getByRole('button', { name: `Ler ${doc.title} Completo` }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(doc.title);
      await expect(dialog).toContainText('Versão 1.0');

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();

      // Fechar o Dialog sem marcar nada não grava nenhum aceite — a leitura
      // completa é só uma etapa opcional (RN-06), não obrigatória.
      const snap = await getAcceptance(TEST_USERS.clinicAdminB.uid, doc.id);
      expect(snap.empty).toBe(true);
    });

    test('clinic_admin em onboarding com termos pendentes é redirecionado para /clinic/setup/terms, aceita sem nunca abrir o Dialog de leitura completa (RN-06) e é redirecionado para /clinic/setup (passos 1-12)', async ({
      page,
    }) => {
      // Passo 1: clinicAdminB (role clinic_admin, sem nenhum aceite no seed)
      // navega para uma rota que já começa com /clinic/setup → TermsInterceptor
      // manda para a variante de onboarding, não para /accept-terms.
      await submitLoginForm(page, {
        email: TEST_USERS.clinicAdminB.email,
        password: TEST_PASSWORD,
      });
      await gotoAfterSignIn(page, '/clinic/setup', CLINIC_SETUP_TERMS_URL);

      // Passo 2 (guard defensivo, commit `c3f18d4` — Fluxo de Exceção 8d): a
      // página não redirecionou para /login porque o usuário está autenticado.
      await expect(page.getByRole('heading', { name: 'Bem-vindo ao Curva Mestra!' })).toBeVisible();

      // Passo 7: preview truncado (500 caracteres + "...") — diferente da
      // Variante A, que mostra o conteúdo completo inline.
      await expect(page.locator('body')).toContainText('...');

      const acceptedCheckbox = acceptanceCheckbox(page, TEST_LEGAL_DOCUMENTS.withAcceptance.id);
      const pendingCheckbox = acceptanceCheckbox(page, TEST_LEGAL_DOCUMENTS.withoutAcceptance.id);
      await expect(acceptedCheckbox).toBeVisible();
      await expect(pendingCheckbox).toBeVisible();

      // Passo 8 / RN-06: marca os dois checkboxes SEM nunca clicar em nenhum
      // botão "Ler ... Completo" — a leitura integral não é obrigatória.
      await acceptedCheckbox.click();
      await pendingCheckbox.click();

      // Passo 9.
      const submitButton = page.getByRole('button', { name: 'Aceitar e Continuar' });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // Passo 11: toast de sucesso e redireciona para /clinic/setup (não "/",
      // diferença em relação à Variante A).
      await expect(page.getByText('Termos aceitos com sucesso')).toBeVisible();
      await expect(page).toHaveURL(/\/clinic\/setup(?!\/terms)/, { timeout: 15000 });

      // Pós-condição de sucesso: mesma estrutura de gravação da Variante A.
      for (const doc of Object.values(TEST_LEGAL_DOCUMENTS)) {
        const snap = await getAcceptance(TEST_USERS.clinicAdminB.uid, doc.id);
        expect(snap.size).toBe(1);
        const acceptance = snap.docs[0].data();
        expect(acceptance.document_version).toBe('1.0');
        expect(acceptance.ip_address).toBeNull();
      }
    });
  });

  test.describe('Fluxo Alternativo 7a — usuário sem termos pendentes navega normalmente', () => {
    test('clinicAdminA (todos os aceites em dia) permanece em /clinic/dashboard, sem ser interceptado', async ({
      page,
    }) => {
      await submitLoginForm(page, {
        email: TEST_USERS.clinicAdminA.email,
        password: TEST_PASSWORD,
      });

      // Passos 1-3 do Fluxo 7a: hasPendingTerms === false → TermsInterceptor não
      // faz nada, a navegação para o dashboard prossegue normalmente.
      await expect(page).toHaveURL(/\/clinic\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Aceite os Termos' })).toHaveCount(0);
    });
  });

  test.describe('Fluxo de Exceção 8c — nem todos os documentos marcados', () => {
    test('marcar só um dos dois documentos mantém o botão desabilitado e nenhum aceite é gravado (RN-04)', async ({
      page,
    }) => {
      // Consultor (role clinic_consultant, sem nenhum aceite no seed) cai no ramo
      // "outros tipos de usuário" do TermsInterceptor → /accept-terms.
      await submitLoginForm(page, {
        email: TEST_USERS.consultant.email,
        password: TEST_PASSWORD,
      });
      await expect(page).toHaveURL(ACCEPT_TERMS_URL);

      const acceptedCheckbox = acceptanceCheckbox(page, TEST_LEGAL_DOCUMENTS.withAcceptance.id);
      const pendingCheckbox = acceptanceCheckbox(page, TEST_LEGAL_DOCUMENTS.withoutAcceptance.id);
      const submitButton = page.getByRole('button', { name: 'Aceitar Todos os Documentos' });

      // Nenhum documento marcado: desabilitado.
      await expect(submitButton).toBeDisabled();

      // Passo 1: marca só um dos dois — o botão continua desabilitado (o aceite é
      // tudo-ou-nada por tela, RN-04).
      await acceptedCheckbox.click();
      await expect(submitButton).toBeDisabled();

      // Marcando o segundo, o botão habilita (confirma que a trava é
      // especificamente "nem todos marcados", não um bug de habilitação).
      await pendingCheckbox.click();
      await expect(submitButton).toBeEnabled();

      // Garantia mínima de falha (Seção 4.2): como o formulário nunca foi
      // efetivamente confirmado nesta rodada de asserções (a trava foi
      // verificada antes de clicar), nenhum registro de aceite existe ainda para
      // o consultor.
      for (const doc of Object.values(TEST_LEGAL_DOCUMENTS)) {
        const snap = await getAcceptance(TEST_USERS.consultant.uid, doc.id);
        expect(snap.empty).toBe(true);
      }
    });
  });

  test.describe('Fluxo de Exceção 8d — usuário não autenticado', () => {
    test('Variante A: acessar /accept-terms deslogado redireciona para /login', async ({
      page,
    }) => {
      await page.goto('/accept-terms');
      await expect(page).toHaveURL(/\/login/);
    });

    test('Variante B: acessar /clinic/setup/terms deslogado redireciona para /login (guard defensivo, commit `c3f18d4`)', async ({
      page,
    }) => {
      await page.goto('/clinic/setup/terms');
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
