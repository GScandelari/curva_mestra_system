import { test, expect, Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import {
  TEST_PASSWORD,
  TEST_TENANTS,
  TEST_USERS,
  TEST_LEGAL_DOCUMENTS,
} from './fixtures/seed-data';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Cobertura retroativa (Modo B) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-04-fazer-login-com-redirecionamento-por-papel.md (v1.1.5)
 *
 * Cobre: Fluxo Principal (system_admin, clinic_admin, clinic_user, clinic_consultant
 * -- passos 1-10), Fluxo Alternativo 7a (usuário já autenticado acessa /login, incluindo
 * a nuance descrita no passo 7a.2 -- só `requirePasswordChange` é reavaliado, não
 * role/active/clínica), Fluxo Alternativo 7c (alerta de timeout), Fluxos de Exceção 8a
 * (credenciais inválidas, RN-06), 8b (sem role/inativo, incluindo a diferenciação de
 * mensagem do RN-10), 8c (senha temporária pendente, RN-02) e 8d/8e (clínica
 * inativa/suspensa, diferenciada por role -- RN-03/RN-04).
 *
 * 7b NÃO é uma seção separada de testes: é uma nota histórica de um bug já corrigido
 * (commit `53df743`) e hoje é apenas o comportamento normal do passo 9 do Fluxo
 * Principal -- coberto ali (cenário "clinic_consultant"), sem necessidade de um
 * describe próprio.
 *
 * Assunções assumidas nesta rodada (Modo B, passo 3 do guia do agente -- confirmar
 * com o revisor humano):
 *
 * 1. `scripts/seed-emulator.ts` só grava aceite dos dois documentos legais
 *    (`user_document_acceptances`) para `systemAdmin` e `clinicAdminA` -- de propósito,
 *    conforme o próprio comentário do script. Qualquer outro usuário semeado
 *    (`clinicUserA`, `clinicAdminB`, `consultant`) tem termos pendentes, o que faz
 *    `TermsInterceptor` (`src/components/auth/ClientProviders.tsx`) redirecioná-lo para
 *    `/accept-terms` assim que ele chega a qualquer rota fora de `PUBLIC_ROUTES` --
 *    inclusive `/consultant/dashboard`, `/clinic/dashboard` e `/clinic/my-clinic`, que
 *    são justamente os destinos que este UC precisa verificar como estado final.
 *    Em vez de inventar um usuário novo fora do seed, os testes que precisam de um
 *    destino final estável para `clinicUserA`/`consultant` concedem aceite temporário
 *    (via Admin SDK, mesmo formato exato gravado pelo seed) só durante o teste e o
 *    revogam depois (`withTemporaryTermsAcceptance`) -- não altera o seed nem cria
 *    nenhum principal novo, só grava/apaga documentos `user_document_acceptances` para
 *    um UID que já existe em `TEST_USERS`. Sinalizado aqui para o revisor confirmar que
 *    essa técnica é aceitável; a alternativa seria estender `scripts/seed-emulator.ts`
 *    para conceder aceite completo a todos os usuários semeados, o que mudaria o
 *    comportamento de outros specs (ex.: cobertura futura de `/accept-terms`).
 * 2. `scripts/seed-emulator.ts` sempre cria `tenants/test-clinic-a` e
 *    `tenants/test-clinic-b` com `active: true` -- não existe um tenant permanentemente
 *    suspenso no seed. Os testes de 8d/8e alternam `active` de `test-clinic-a` via Admin
 *    SDK (`withTenantActive`) apenas durante o teste, restaurando o valor original no
 *    `finally` -- reaproveita o tenant e os usuários já existentes no fixture (não cria
 *    um tenant "C" nem um usuário novo).
 * 3. Pelo mesmo motivo (nenhum usuário semeado tem `requirePasswordChange: true` ou
 *    claims que resultem em `!role || !active`), os testes de 8b/8c/7a(nuance) alternam
 *    as custom claims de um usuário já existente via Admin SDK
 *    (`getEmulatorAdminAuth().setCustomUserClaims`), sempre restaurando o valor
 *    original em `finally`.
 * 4. RN-07 (timeout configurável via `system_settings/global.session_timeout_minutes`)
 *    e RN-09 (checagem de `requirePasswordChange` em `ProtectedRoute.tsx` para
 *    navegação direta a rotas protegidas, sem passar por `/login`) ficam fora do escopo
 *    -- a primeira pertence a UC-35 (só referenciada aqui) e a segunda tem como gatilho
 *    a navegação direta a uma rota protegida, não a submissão do formulário `/login`
 *    (gatilho deste UC). O Fluxo Alternativo 7c aqui testado cobre só o alerta visual e
 *    o parâmetro `?timeout=true`, não o valor configurável do timeout em si.
 */

async function submitLoginForm(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Troca temporariamente as custom claims de um UID já semeado, restaurando ao final. */
async function withTemporaryClaims<T>(
  uid: string,
  originalClaims: Record<string, unknown>,
  tempClaims: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const authAdmin = getEmulatorAdminAuth();
  await authAdmin.setCustomUserClaims(uid, tempClaims);
  try {
    return await fn();
  } finally {
    await authAdmin.setCustomUserClaims(uid, originalClaims);
  }
}

/** Alterna `tenants/{tenantId}.active` temporariamente, restaurando o valor original. */
async function withTenantActive<T>(
  tenantId: string,
  active: boolean,
  fn: () => Promise<T>
): Promise<T> {
  const db = getEmulatorAdminFirestore();
  const ref = db.doc(`tenants/${tenantId}`);
  const original = (await ref.get()).data()?.active;
  await ref.update({ active });
  try {
    return await fn();
  } finally {
    await ref.update({ active: original });
  }
}

/**
 * Concede aceite temporário dos dois documentos legais do seed a um UID já existente
 * em TEST_USERS, no mesmo formato exato gravado por scripts/seed-emulator.ts, e revoga
 * ao final -- evita que TermsInterceptor desvie o teste para /accept-terms antes que a
 * asserção de destino final (objeto deste UC) rode.
 */
async function withTemporaryTermsAcceptance<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  const db = getEmulatorAdminFirestore();
  const now = Timestamp.now();
  const refs = Object.values(TEST_LEGAL_DOCUMENTS).map((legalDoc) =>
    db.collection('user_document_acceptances').doc(`${uid}_${legalDoc.id}`)
  );
  for (let i = 0; i < refs.length; i++) {
    const legalDoc = Object.values(TEST_LEGAL_DOCUMENTS)[i];
    await refs[i].set({
      user_id: uid,
      document_id: legalDoc.id,
      document_version: '1.0',
      accepted_at: now,
    });
  }
  try {
    return await fn();
  } finally {
    for (const ref of refs) await ref.delete();
  }
}

test.describe('UC-04 — Fazer Login com Redirecionamento por Papel', () => {
  test.describe('Fluxo Principal', () => {
    test('system_admin loga e é redirecionado direto para /admin/dashboard (passos 1-10)', async ({
      page,
    }) => {
      await page.goto('/login');

      // Passo 2: formulário exibido, com os links esperados.
      await expect(page.getByRole('heading', { name: 'Curva Mestra' })).toBeVisible();
      await expect(
        page.getByText('Entre com suas credenciais para acessar o sistema')
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Esqueceu a senha?' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Registrar-se' })).toBeVisible();

      // Passos 3-9: submete, autentica, refresh de claims (RNF-01) e redireciona.
      await submitLoginForm(page, TEST_USERS.systemAdmin.email, TEST_PASSWORD);
      await expect(page).toHaveURL(/\/admin\/dashboard/);

      // Esperado (Firebase Auth / Custom Claims): claims usadas pelo redirect batem
      // com o que está gravado no Auth emulado.
      const authAdmin = getEmulatorAdminAuth();
      const user = await authAdmin.getUser(TEST_USERS.systemAdmin.uid);
      expect(user.customClaims?.is_system_admin).toBe(true);
      expect(user.customClaims?.role).toBe('system_admin');
      expect(user.customClaims?.active).toBe(true);
      expect(user.customClaims?.requirePasswordChange ?? false).toBe(false);
    });

    test('clinic_admin loga e é redirecionado direto para /clinic/dashboard', async ({ page }) => {
      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );

      const authAdmin = getEmulatorAdminAuth();
      const user = await authAdmin.getUser(TEST_USERS.clinicAdminA.uid);
      expect(user.customClaims?.role).toBe('clinic_admin');
      expect(user.customClaims?.tenant_id).toBe(TEST_TENANTS.clinicA.tenant_id);
      expect(user.customClaims?.active).toBe(true);
    });

    test('clinic_user loga e é redirecionado direto para /clinic/dashboard (mesmo branch de clinic_admin)', async ({
      page,
    }) => {
      // clinicUserA não tem aceite de termos no seed (de propósito -- ver nota 1 no
      // topo do arquivo); concede aceite só para este teste, para que o destino final
      // observável seja /clinic/dashboard e não /accept-terms.
      await withTemporaryTermsAcceptance(TEST_USERS.clinicUserA.uid, async () => {
        await submitLoginForm(page, TEST_USERS.clinicUserA.email, TEST_PASSWORD);
        await expect(page).toHaveURL(/\/clinic\/dashboard/);
      });

      const authAdmin = getEmulatorAdminAuth();
      const user = await authAdmin.getUser(TEST_USERS.clinicUserA.uid);
      expect(user.customClaims?.role).toBe('clinic_user');
      expect(user.customClaims?.tenant_id).toBe(TEST_TENANTS.clinicA.tenant_id);
      expect(user.customClaims?.active).toBe(true);
    });

    test('clinic_consultant loga e é redirecionado direto para /consultant/dashboard, sem passar por /dashboard (RN-08)', async ({
      page,
    }) => {
      // consultant também não tem aceite de termos no seed -- mesmo motivo/técnica do
      // teste acima.
      await withTemporaryTermsAcceptance(TEST_USERS.consultant.uid, async () => {
        await submitLoginForm(page, TEST_USERS.consultant.email, TEST_PASSWORD);
        // redirectByRole (login/page.tsx, linhas 87-97) usa router.push direto para
        // /consultant/dashboard desde o commit 53df743 -- o destino final observável já
        // é suficiente para detectar uma regressão para o `else` genérico (voltaria a
        // /dashboard e ficaria lá, pois /dashboard não tem branch de segundo salto para
        // um usuário sem is_system_admin/clinic_admin/clinic_user).
        await expect(page).toHaveURL(/\/consultant\/dashboard/);
      });

      // Esperado (Custom Claims): tenant_id null + authorized_tenants -- RN-03 (consultor
      // não passa pela checagem de clínica ativa porque tenant_id é null).
      const authAdmin = getEmulatorAdminAuth();
      const user = await authAdmin.getUser(TEST_USERS.consultant.uid);
      expect(user.customClaims?.role).toBe('clinic_consultant');
      expect(user.customClaims?.tenant_id).toBeNull();
      expect(user.customClaims?.authorized_tenants).toContain(TEST_TENANTS.clinicA.tenant_id);
    });
  });

  test.describe('Fluxo Alternativo 7a — usuário já autenticado acessa /login diretamente', () => {
    test('sessão ativa redireciona automaticamente para o dashboard do role, sem exibir o formulário', async ({
      page,
    }) => {
      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );

      await page.goto('/login');

      await expect(page).toHaveURL(/\/clinic\/dashboard/);
      // "Curva Mestra" não serve para confirmar que o formulário sumiu -- é a
      // mesma marca exibida no header de todo layout /clinic/* (ClinicLayout.tsx),
      // inclusive no próprio dashboard. O campo de e-mail do formulário de login
      // é exclusivo dessa tela.
      await expect(page.locator('#email')).toHaveCount(0);
    });

    test('nuance do passo 7a.2 — sessão já autenticada só reavalia requirePasswordChange, ignorando role/active/clínica já validados no login original', async ({
      page,
    }) => {
      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );

      const authAdmin = getEmulatorAdminAuth();
      const original = TEST_USERS.clinicAdminA.claims;
      await authAdmin.setCustomUserClaims(TEST_USERS.clinicAdminA.uid, {
        ...original,
        requirePasswordChange: true,
      });
      try {
        // Navegação completa (não router.push) -- faz onAuthStateChanged rodar de novo
        // e forçar getIdToken(true) (RNF-01), única forma de uma sessão já em curso
        // enxergar uma claim alterada no meio da sessão via Admin SDK.
        await page.goto('/login');

        await expect(page).toHaveURL(/\/change-password/);
        await expect(page.getByRole('heading', { name: 'Trocar Senha' })).toBeVisible();
      } finally {
        await authAdmin.setCustomUserClaims(TEST_USERS.clinicAdminA.uid, original);
      }
    });
  });

  test.describe('Fluxo Alternativo 7c — alerta de sessão expirada por timeout', () => {
    test('usuário chega via /login?timeout=true e vê o alerta informativo, com o formulário normal ainda utilizável', async ({
      page,
    }) => {
      await page.goto('/login?timeout=true');

      await expect(
        page.getByText('Sua sessão expirou por inatividade. Por favor, faça login novamente.')
      ).toBeVisible();

      // Retorna ao passo 2 do Fluxo Principal: formulário exibido normalmente.
      await expect(page.locator('#email')).toBeEditable();
      await expect(page.locator('#password')).toBeEditable();
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    });
  });

  test.describe('Fluxo de Exceção 8a — credenciais inválidas ou erro do Firebase Auth (RN-06)', () => {
    test('senha incorreta exibe mensagem traduzida e não redireciona', async ({ page }) => {
      await submitLoginForm(page, TEST_USERS.clinicAdminA.email, 'SenhaErrada@123');

      await expect(page.getByText('Email ou senha incorretos')).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('#email')).toHaveValue(TEST_USERS.clinicAdminA.email);
    });

    test('email não cadastrado exibe mensagem traduzida e não redireciona', async ({ page }) => {
      await submitLoginForm(page, 'nao-existe-uc04@curvamestra.test', 'QualquerSenha@123');

      await expect(page.getByText('Usuário não encontrado')).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Fluxo de Exceção 8b — usuário sem role definida ou inativo (RN-01, RN-10)', () => {
    test('active: false redireciona para /waiting-approval com a mensagem de "Conta Desativada" (RN-10)', async ({
      page,
    }) => {
      const original = TEST_USERS.clinicAdminA.claims;
      await withTemporaryClaims(
        TEST_USERS.clinicAdminA.uid,
        original,
        { ...original, active: false },
        async () => {
          await submitLoginForm(page, TEST_USERS.clinicAdminA.email, TEST_PASSWORD);

          await expect(page).toHaveURL(/\/waiting-approval/);
          await expect(page.getByRole('heading', { name: 'Conta Desativada' })).toBeVisible();
          await expect(page.getByText('Acesso suspenso pelo administrador')).toBeVisible();
          await expect(
            page.getByText('Sua conta foi desativada por um administrador do sistema.')
          ).toBeVisible();
        }
      );

      // Esperado (Firebase Auth): a conta permanece um usuário válido do Auth emulado
      // (não foi desabilitada via Admin SDK) -- "desativado" aqui é só uma claim de
      // app, não um bloqueio nativo do Firebase Auth.
      const authAdmin = getEmulatorAdminAuth();
      const user = await authAdmin.getUser(TEST_USERS.clinicAdminA.uid);
      expect(user.disabled).toBe(false);
      expect(user.customClaims?.active).toBe(true); // claim restaurada após o teste
    });

    test('usuário nunca aprovado (sem role) redireciona para /waiting-approval com a mensagem de "Conta Criada com Sucesso"', async ({
      page,
    }) => {
      const original = TEST_USERS.clinicAdminA.claims;
      await withTemporaryClaims(TEST_USERS.clinicAdminA.uid, original, {}, async () => {
        await submitLoginForm(page, TEST_USERS.clinicAdminA.email, TEST_PASSWORD);

        await expect(page).toHaveURL(/\/waiting-approval/);
        await expect(page.getByRole('heading', { name: 'Conta Criada com Sucesso' })).toBeVisible();
        await expect(page.getByText('Aguardando aprovação do administrador')).toBeVisible();
      });
    });
  });

  test.describe('Fluxo de Exceção 8c — senha temporária pendente de troca (RN-02, RN-05)', () => {
    test('requirePasswordChange: true redireciona para /change-password, mesmo com role/active válidos', async ({
      page,
    }) => {
      const original = TEST_USERS.systemAdmin.claims;
      await withTemporaryClaims(
        TEST_USERS.systemAdmin.uid,
        original,
        { ...original, requirePasswordChange: true },
        async () => {
          await submitLoginForm(page, TEST_USERS.systemAdmin.email, TEST_PASSWORD);

          await expect(page).toHaveURL(/\/change-password/);
          await expect(page.getByRole('heading', { name: 'Trocar Senha' })).toBeVisible();
          await expect(
            page.getByText(
              'Você está usando uma senha temporária. Por segurança, defina uma nova senha.'
            )
          ).toBeVisible();
        }
      );

      const authAdmin = getEmulatorAdminAuth();
      const user = await authAdmin.getUser(TEST_USERS.systemAdmin.uid);
      // claim restaurada -- TEST_USERS.systemAdmin.claims (seed-data.ts) nunca
      // definiu requirePasswordChange, então o valor original é undefined, não false.
      expect(user.customClaims?.requirePasswordChange).toBeUndefined();
    });
  });

  test.describe('Fluxo de Exceção 8d — clínica inativa/suspensa, role clinic_user (RN-03, RN-04)', () => {
    // ACHADO REAL (não é bug de teste): investigação empírica contra o emulador
    // mostrou que o card "Sistema Indisponível" nunca chega a aparecer -- o
    // screenshot salvo em falha mostra o formulário de login vazio/resetado, não
    // o card. Hipótese: em src/app/(auth)/login/page.tsx, o useEffect reativo que
    // redireciona qualquer usuário autenticado ("Redirecionar se já estiver
    // autenticado") corre em paralelo com a checagem manual de tenant.active
    // dentro de handleSubmit/checkClinicStatus. Se o efeito reativo disparar
    // primeiro (via onAuthStateChanged), o usuário é levado para /clinic/dashboard
    // antes do handleInactiveClinic() do handleSubmit rodar; o signOut() desse
    // último então força volta a /login com uma instância NOVA do componente,
    // cujo estado local `clinicInactiveMessage` nasce em false -- explicando o
    // formulário vazio observado. Não corrigido aqui por decisão do usuário
    // (mexe em fluxo real de autenticação) -- registrado no mapa de bugs para
    // avaliação numa task dedicada.
    test.fixme(
      true,
      'Race condition real entre o redirect reativo e a checagem manual de tenant.active em login/page.tsx -- ver comentário acima. Registrado no _MAPA-DE-BUGS-E-MELHORIAS.md.'
    );
    test('tenant.active === false desconecta o clinic_user e mostra o card "Sistema Indisponível" em /login', async ({
      page,
    }) => {
      await withTenantActive(TEST_TENANTS.clinicA.tenant_id, false, async () => {
        await submitLoginForm(page, TEST_USERS.clinicUserA.email, TEST_PASSWORD);

        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole('heading', { name: 'Sistema Indisponível' })).toBeVisible();
        await expect(
          page.getByText(
            'O sistema encontra-se indisponível no momento. Procure o administrador da clínica ou entre em contato com o suporte técnico Curva Mestra.'
          )
        ).toBeVisible();
        await expect(page.getByRole('link', { name: 'suporte@curvamestra.com.br' })).toBeVisible();

        // Passo 3 do Fluxo de Exceção 8d: "Voltar ao login" limpa o estado e reexibe o
        // formulário normal (retorna ao passo 2 do Fluxo Principal).
        await page.getByRole('button', { name: 'Voltar ao login' }).click();
        await expect(page.getByRole('heading', { name: 'Curva Mestra' })).toBeVisible();
        await expect(page.locator('#email')).toHaveValue('');
      });

      // Esperado (Firebase Auth / Firestore): o usuário foi desconectado (signOut()),
      // mas a conta em si e a claim `active` do USUÁRIO (distinta de tenant.active)
      // permanecem intactas -- é a clínica que está suspensa, não o usuário.
      const authAdmin = getEmulatorAdminAuth();
      const user = await authAdmin.getUser(TEST_USERS.clinicUserA.uid);
      expect(user.disabled).toBe(false);
      expect(user.customClaims?.active).toBe(true);

      const db = getEmulatorAdminFirestore();
      const tenantSnap = await db.doc(`tenants/${TEST_TENANTS.clinicA.tenant_id}`).get();
      expect(tenantSnap.data()?.active).toBe(true); // restaurado após o teste
    });
  });

  test.describe('Fluxo de Exceção 8e — clínica inativa/suspensa, role clinic_admin (RN-03, RN-04)', () => {
    test('tenant.active === false redireciona o clinic_admin para /clinic/my-clinic, sem signOut', async ({
      page,
    }) => {
      await withTenantActive(TEST_TENANTS.clinicA.tenant_id, false, async () => {
        await submitLoginForm(page, TEST_USERS.clinicAdminA.email, TEST_PASSWORD);

        await expect(page).toHaveURL(/\/clinic\/my-clinic/);
      });

      // Esperado (Firebase Auth): diferente do clinic_user (8d), a sessão do
      // clinic_admin permanece ativa -- não há signOut() neste caminho.
      const authAdmin = getEmulatorAdminAuth();
      const user = await authAdmin.getUser(TEST_USERS.clinicAdminA.uid);
      expect(user.disabled).toBe(false);
      expect(user.customClaims?.active).toBe(true);

      const db = getEmulatorAdminFirestore();
      const tenantSnap = await db.doc(`tenants/${TEST_TENANTS.clinicA.tenant_id}`).get();
      expect(tenantSnap.data()?.active).toBe(true); // restaurado após o teste
    });
  });
});
