import { test, expect, Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura retroativa (Modo B) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-01-solicitar-acesso-ao-sistema.md (v2.1.1)
 *
 * Cobre: Fluxo Principal (perfil especialista e consultor), Fluxo Alternativo
 * 7a (usuário já autenticado), 7b (troca de perfil mantém campos
 * compartilhados) e Fluxos de Exceção 8a (nome sem sobrenome, RN-04) e 8d
 * (duplicidade de e-mail pendente, RN-09).
 *
 * NÃO cobertos nesta rodada (limitação da infraestrutura de testes atual,
 * não do UC em si):
 * - 8b (falha de validação no backend): desde o commit `1254abb`, o
 *   frontend usa exatamente as mesmas funções compartilhadas
 *   (validateFullName/validateEmail/validatePhone) do backend — não há
 *   caminho alcançável por uma submissão normal via UI que reprove no
 *   backend sem já ter sido barrado antes no frontend. Cobrir isso exigiria
 *   chamar `POST /api/access-requests` diretamente (fora do formulário),
 *   fora do escopo de um spec de UI E2E.
 * - 8c (erro 500 do Firestore): exigiria derrubar o Firestore do emulador
 *   (ou injetar uma falha) no meio do teste, sem mecanismo disponível hoje
 *   nesta suíte.
 *
 * RN-10 (gate de `system_settings/global.registration_enabled`) não é
 * exercitada aqui — não faz parte do Fluxo Principal/Alternativos/Exceção
 * deste UC pedido para cobertura, e o seed atual (scripts/seed-emulator.ts)
 * não grava `system_settings/global`, então `settingsSnap.exists` é sempre
 * `false` e o gate nunca bloqueia estes testes.
 */

const API_PATH = '/api/access-requests';

function uniqueEmail(scenario: string): string {
  return `qa-uc01-${scenario}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

type SharedFields = {
  fullName: string;
  councilNumber: string;
  email: string;
  phone: string;
  businessName: string;
};

async function fillSharedFields(page: Page, fields: SharedFields): Promise<void> {
  await page.locator('#fullName').fill(fields.fullName);
  await page.locator('#councilNumber').fill(fields.councilNumber);
  await page.locator('#email').fill(fields.email);
  await page.locator('#phone').fill(fields.phone);
  await page.locator('#businessName').fill(fields.businessName);
}

test.describe('UC-01 — Solicitar Acesso ao Sistema', () => {
  test.describe('Fluxo Principal', () => {
    test('especialista preenche e envia o formulário com sucesso (passos 1-20)', async ({
      page,
    }) => {
      const email = uniqueEmail('especialista');

      await page.goto('/register');

      // Passo 2: formulário "Solicitar Acesso" visível, sem sessão ativa.
      await expect(page.getByRole('heading', { name: 'Solicitar Acesso' })).toBeVisible();
      await expect(
        page.getByText('Distribuição fechada — cada pedido é avaliado em até 2 dias úteis')
      ).toBeVisible();

      // Passo 3: perfil "Especialista HOF" já vem pré-selecionado por padrão.
      // Passo 4: campos exclusivos de especialista visíveis.
      await expect(page.locator('#consultantReference')).toBeVisible();
      await expect(page.getByText('Volume de procedimentos por mês')).toBeVisible();

      // Passos 5-6.
      await fillSharedFields(page, {
        fullName: 'Helena Vidal',
        councilNumber: 'CRM-SP 142337',
        email,
        phone: '11987654321',
        businessName: 'Clínica Cíngulo',
      });
      await page.locator('#consultantReference').fill('João Souza');
      // "30–80" já é o volume pré-selecionado por padrão — mantém.

      // Passo 9: intercepta o POST para inspecionar o body exatamente como enviado.
      const requestBodyPromise = page
        .waitForRequest((req) => req.url().includes(API_PATH) && req.method() === 'POST')
        .then((req) => req.postDataJSON());

      // Passo 7.
      await page.getByRole('button', { name: 'Solicitar acesso à Curva Mestra' }).click();

      const requestBody = await requestBodyPromise;
      expect(requestBody.role).toBe('especialista');
      expect(requestBody.consultant_reference).toBe('João Souza');
      expect(requestBody.volume).toBe('30–80');

      // Passo 18: mensagem de sucesso + campos de texto limpos.
      await expect(page.getByRole('alert')).toContainText('Solicitação enviada com sucesso!');
      await expect(page.locator('#fullName')).toHaveValue('');
      await expect(page.locator('#email')).toHaveValue('');

      // Pós-condição de sucesso: documento criado em access_requests com
      // status "pendente", email normalizado, e os campos exclusivos de
      // especialista gravados.
      const db = getEmulatorAdminFirestore();
      const snap = await db
        .collection('access_requests')
        .where('email', '==', email)
        .where('status', '==', 'pendente')
        .limit(1)
        .get();
      expect(snap.empty).toBe(false);
      const doc = snap.docs[0].data();
      expect(doc.role).toBe('especialista');
      expect(doc.type).toBe('clinica'); // campo legado derivado de role
      expect(doc.full_name).toBe('Helena Vidal');
      expect(doc.council_number).toBe('CRM-SP 142337');
      expect(doc.business_name).toBe('Clínica Cíngulo');
      expect(doc.consultant_reference).toBe('João Souza');
      expect(doc.volume).toBe('30–80');

      // Passo 19: após 4s, redireciona para /login. O timeout de expect()
      // (15s, playwright.config.ts) cobre a espera do setTimeout do app.
      await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
    });

    test('consultor preenche e envia o formulário com sucesso, sem campos exclusivos de especialista', async ({
      page,
    }) => {
      const email = uniqueEmail('consultor');

      await page.goto('/register');

      // Passo 3: troca para o perfil "Consultor Rennova".
      await page.getByRole('button', { name: 'Consultor Rennova' }).click();

      // Passo 4: rótulos ajustados e campos exclusivos de especialista ocultos.
      await expect(page.getByText('ID Rennova *')).toBeVisible();
      await expect(page.getByText('Região / carteira *')).toBeVisible();
      await expect(page.locator('#consultantReference')).toHaveCount(0);
      await expect(page.getByText('Volume de procedimentos por mês')).toHaveCount(0);

      // Passo 5 (consultor não tem passo 6 — campos exclusivos não existem).
      await fillSharedFields(page, {
        fullName: 'Ricardo Prado',
        councilNumber: 'RNV-CR-0427',
        email,
        phone: '11912345678',
        businessName: 'Sudeste 2',
      });

      const requestBodyPromise = page
        .waitForRequest((req) => req.url().includes(API_PATH) && req.method() === 'POST')
        .then((req) => req.postDataJSON());

      await page.getByRole('button', { name: 'Solicitar acesso à Curva Mestra' }).click();

      const requestBody = await requestBodyPromise;
      expect(requestBody.role).toBe('consultor');
      // Campos exclusivos de especialista nunca fazem parte do body do consultor.
      expect(requestBody.consultant_reference).toBeUndefined();
      expect(requestBody.volume).toBeUndefined();

      await expect(page.getByRole('alert')).toContainText('Solicitação enviada com sucesso!');

      const db = getEmulatorAdminFirestore();
      const snap = await db
        .collection('access_requests')
        .where('email', '==', email)
        .where('status', '==', 'pendente')
        .limit(1)
        .get();
      expect(snap.empty).toBe(false);
      const doc = snap.docs[0].data();
      expect(doc.role).toBe('consultor');
      expect(doc.type).toBe('autonomo'); // campo legado derivado de role
      expect(doc.council_number).toBe('RNV-CR-0427');
      expect(doc.business_name).toBe('Sudeste 2');
      // API grava `consultant_reference`/`volume` como null quando ausentes do body.
      expect(doc.consultant_reference).toBeNull();
      expect(doc.volume).toBeNull();
    });
  });

  test.describe('Fluxo Alternativo 7a — usuário já autenticado acessa /register', () => {
    test('sessão ativa redireciona automaticamente para fora de /register, sem exibir o formulário', async ({
      page,
    }) => {
      // O UC descreve "redireciona para /dashboard" (passo 2 do 7a), mas
      // /dashboard (src/app/dashboard/page.tsx) é, na prática, uma página de
      // debug que faz um SEGUNDO redirect síncrono assim que `claims`
      // resolve: is_system_admin → /admin/dashboard; role clinic_admin/
      // clinic_user → /clinic/dashboard; role clinic_consultant →
      // /consultant/dashboard. O comportamento observável correto para um
      // usuário com claims configuradas (como os seeds desta suíte) é o
      // destino FINAL, não o passo intermediário /dashboard — por isso a
      // asserção abaixo mira direto em /clinic/dashboard.
      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );

      await page.goto('/register');

      await expect(page).toHaveURL(/\/clinic\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Solicitar Acesso' })).toHaveCount(0);
    });
  });

  test.describe('Fluxo Alternativo 7b — troca de perfil durante o preenchimento', () => {
    test('troca de especialista para consultor mantém campos compartilhados e remove campos exclusivos do POST', async ({
      page,
    }) => {
      const email = uniqueEmail('troca-perfil');

      await page.goto('/register');

      // Passo 1: preenche campos compartilhados e exclusivos de especialista
      // (perfil padrão ao carregar a página).
      await fillSharedFields(page, {
        fullName: 'Marina Torres',
        councilNumber: 'CRM-SP 55521',
        email,
        phone: '11955557777',
        businessName: 'Clínica Torres',
      });
      await page.locator('#consultantReference').fill('João Souza');

      // Passo 2: troca para "consultor".
      await page.getByRole('button', { name: 'Consultor Rennova' }).click();

      // Passo 3: rótulos ajustados, campo exclusivo oculto...
      await expect(page.getByText('ID Rennova *')).toBeVisible();
      await expect(page.getByText('Região / carteira *')).toBeVisible();
      await expect(page.locator('#consultantReference')).toHaveCount(0);

      // ...mas os valores dos campos compartilhados permanecem intactos.
      await expect(page.locator('#fullName')).toHaveValue('Marina Torres');
      await expect(page.locator('#councilNumber')).toHaveValue('CRM-SP 55521');
      await expect(page.locator('#email')).toHaveValue(email);
      await expect(page.locator('#businessName')).toHaveValue('Clínica Torres');

      // Envia como consultor: mesmo com `consultantReference` ainda presente
      // no estado interno da tela, ele não deve ser enviado no POST.
      const requestBodyPromise = page
        .waitForRequest((req) => req.url().includes(API_PATH) && req.method() === 'POST')
        .then((req) => req.postDataJSON());

      await page.getByRole('button', { name: 'Solicitar acesso à Curva Mestra' }).click();

      const requestBody = await requestBodyPromise;
      expect(requestBody.role).toBe('consultor');
      expect(requestBody.consultant_reference).toBeUndefined();
      expect(requestBody.volume).toBeUndefined();

      await expect(page.getByRole('alert')).toContainText('Solicitação enviada com sucesso!');
    });
  });

  test.describe('Fluxo de Exceção 8a — falha de validação no frontend', () => {
    test('nome sem sobrenome é reprovado no frontend e a requisição nunca é enviada (RN-04)', async ({
      page,
    }) => {
      const email = uniqueEmail('nome-invalido');
      let apiCalled = false;
      await page.route(`**${API_PATH}`, (route) => {
        apiCalled = true;
        return route.continue();
      });

      await page.goto('/register');

      // Demais campos válidos — apenas o nome viola RN-04 (nome de uma
      // palavra só), a violação mais determinística entre as cobertas por
      // `validateFullName`. Os outros campos precisam estar preenchidos
      // porque `fullName`/`councilNumber`/`email`/`phone`/`businessName` têm
      // o atributo HTML `required`; deixá-los vazios acionaria a validação
      // nativa do navegador antes mesmo do handler JS rodar.
      await fillSharedFields(page, {
        fullName: 'Helena',
        councilNumber: 'CRM-SP 142337',
        email,
        phone: '11987654321',
        businessName: 'Clínica Cíngulo',
      });

      await page.getByRole('button', { name: 'Solicitar acesso à Curva Mestra' }).click();

      // validateFullName (src/lib/validations/serverValidations.ts) retorna
      // exatamente esta mensagem quando `parts.length < 2`.
      await expect(page.getByRole('alert')).toContainText('Informe nome e sobrenome');

      // Passo 3: a requisição não é enviada à API.
      expect(apiCalled).toBe(false);

      // Passo 4: campos permanecem preenchidos.
      await expect(page.locator('#fullName')).toHaveValue('Helena');
      await expect(page.locator('#email')).toHaveValue(email);

      // Garantia mínima de falha: nenhuma solicitação criada para este e-mail.
      const db = getEmulatorAdminFirestore();
      const snap = await db.collection('access_requests').where('email', '==', email).get();
      expect(snap.empty).toBe(true);
    });
  });

  test.describe('Fluxo de Exceção 8d — solicitação pendente já existe para o mesmo e-mail', () => {
    test('segunda submissão com o mesmo e-mail é bloqueada com 409 e nenhum documento extra é criado (RN-09)', async ({
      page,
    }) => {
      const email = uniqueEmail('duplicado');

      // Primeira submissão: sucesso.
      await page.goto('/register');
      await fillSharedFields(page, {
        fullName: 'Camila Duarte',
        councilNumber: 'CRM-SP 998877',
        email,
        phone: '11988887777',
        businessName: 'Clínica Duarte',
      });
      await page.getByRole('button', { name: 'Solicitar acesso à Curva Mestra' }).click();
      await expect(page.getByRole('alert')).toContainText('Solicitação enviada com sucesso!');

      // Segunda submissão, mesmo e-mail: navega de novo para /register (em
      // vez de reaproveitar o formulário já montado) para não competir com o
      // setTimeout de 4s de redirecionamento da primeira submissão.
      await page.goto('/register');
      await fillSharedFields(page, {
        fullName: 'Camila Duarte Silva',
        councilNumber: 'CRM-SP 998877',
        email,
        phone: '11988887777',
        businessName: 'Clínica Duarte',
      });

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes(API_PATH) && res.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Solicitar acesso à Curva Mestra' }).click();
      const response = await responsePromise;

      expect(response.status()).toBe(409);
      await expect(page.getByRole('alert')).toContainText(
        'Já existe uma solicitação pendente para este e-mail'
      );

      // Campos permanecem preenchidos (garantia mínima de falha).
      await expect(page.locator('#fullName')).toHaveValue('Camila Duarte Silva');

      // Garantia de sucesso original preservada: exatamente 1 solicitação
      // pendente para este e-mail, não 2.
      const db = getEmulatorAdminFirestore();
      const snap = await db
        .collection('access_requests')
        .where('email', '==', email)
        .where('status', '==', 'pendente')
        .get();
      expect(snap.size).toBe(1);
    });
  });
});
