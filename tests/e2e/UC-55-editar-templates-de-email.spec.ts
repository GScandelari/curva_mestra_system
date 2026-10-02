import { test, expect, type Page } from '@playwright/test';
import type { DocumentReference, DocumentData } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura (Modo B) de:
 * `ONLY_FOR_DEVS/PO_BA_Docs/UC-55-editar-templates-de-email.md` (v1.1)
 *
 * Cenários (numeração conforme solicitada pelo dev-task-manager ao preparar a
 * branch `feature/uc55-caderno-playwright`):
 * 1. Lista (`/admin/email-templates`) — 13 gatilhos agrupados por categoria;
 *    os 12 migrados são clicáveis; o #9 (`tenants/create`, RN-14) aparece
 *    como linha informativa não clicável.
 * 2. Carregar editor — assunto/corpo atuais + painel de variáveis permitidas
 *    com obrigatórias destacadas (`welcome_approval`).
 * 3. Preview em tempo real (RF-03) — layout dividido (corpo à esquerda,
 *    iframe à direita), sem precisar de nenhum botão "Pré-visualizar"
 *    (`password_reset`).
 * 4. Envio de teste (RF-04) — diálogo de destino → callable
 *    `sendTemplateTestEmail` → não persiste em `email_templates`
 *    (`consultant_welcome`).
 * 5. Salvar com validação (RF-05/RF-06, Fluxo 8b) — caminho feliz + variável
 *    fora da lista + variável obrigatória removida (`consultant_transfer_request`).
 * 6. Histórico e reversão (RF-07, Fluxo 7c) — duas edições, histórico com
 *    autor/data, reversão gera nova entrada (`consultant_invite_created`).
 * 7. Bloqueio de acesso (RF-08, Fluxo 8a) — `clinic_admin` redirecionado.
 * 8. Amostra representativa dos dois mecanismos de leitura (RF-09):
 *    `password_reset` via `email_queue` (fluxo real UC-08) coberto
 *    integralmente; `generic_user_welcome` via Cloud Function `onUserCreated`
 *    marcado como `test.fixme` — ver nota de infraestrutura abaixo.
 *
 * Assunções e lacunas de infraestrutura (a confirmar/resolver na revisão humana):
 *
 * 1. `npm run test:e2e` roda `firebase emulators:exec --only auth,firestore,storage`
 *    — o emulador de Functions (porta 5001, já configurado em `firebase.json`)
 *    NÃO é iniciado por essa suíte hoje. Duas consequências:
 *    a) O Cenário 4 (RF-04, "Enviar e-mail de teste") não consegue invocar a
 *       Cloud Function callable `sendTemplateTestEmail` de verdade. O teste
 *       intercepta a requisição HTTP que o SDK do cliente faz para o emulador
 *       de Functions (`page.route('**\/sendTemplateTestEmail', ...)`) e
 *       responde com um stub no formato do protocolo callable do Firebase,
 *       validando o payload enviado (destinatário, assunto e corpo já
 *       renderizados com os valores de exemplo) e a reação da UI (toast de
 *       sucesso). A adição do prefixo `[TESTE]` ao assunto e o envio real via
 *       Zoho SMTP acontecem DENTRO da própria Cloud Function
 *       (`functions/src/sendTemplateTestEmail.ts`) — não são, e não podem ser,
 *       verificados por este teste sem o emulador de Functions de pé.
 *    b) O Cenário 8 (RF-09) só consegue cobrir de ponta a ponta o mecanismo
 *       `email_queue` (`password_reset`, enfileirado diretamente pela API
 *       route via Admin SDK, sem depender de nenhuma Cloud Function). O
 *       mecanismo "Cloud Function trigger" (`generic_user_welcome`, disparado
 *       por `onUserCreated`, um `onDocumentCreated` em `users/{uid}`) está
 *       marcado como `test.fixme` — nenhum trigger de Firestore dispara sem o
 *       emulador de Functions rodando. Habilitar esse cenário exigiria (i)
 *       adicionar `functions` ao `--only` do script `test:e2e` (e garantir que
 *       `functions/lib` esteja compilado antes), e (ii) decidir o que fazer com
 *       os secrets `SMTP_USER`/`SMTP_PASS` (indisponíveis no emulador) — por
 *       exemplo, mockar `sendEmail` dentro da function. Isso é infraestrutura
 *       nova, fora do escopo deste spec — sinalizado aqui para avaliação do
 *       dev/orquestrador, não resolvido por este agente.
 * 2. Os testes que editam e salvam um template usam `withTemplateRestore`
 *    (helper local) para devolver o documento ao conteúdo original e apagar
 *    quaisquer `versions` criadas durante o teste, no `finally` — garante
 *    isolamento entre os testes deste arquivo e com o restante da suíte
 *    (nenhum outro spec hoje lê/escreve `email_templates`, conferido por
 *    busca em `tests/e2e/`).
 * 3. O Cenário 8 (`password_reset`) reaproveita o fluxo real de UC-08 (botão
 *    "Enviar Link de Reset" em `/admin/users`) sobre `TEST_USERS.clinicUserA`
 *    — os documentos criados em `email_queue`/`password_reset_tokens` durante
 *    o teste são apagados no `finally` (não a senha do usuário, que essa rota
 *    nunca altera — só a continuação self-service de UC-08 altera senha, não
 *    exercitada aqui).
 * 4. Nenhuma validação client-side de variáveis foi encontrada em
 *    `src/app/(admin)/admin/email-templates/[tipo]/page.tsx` (só
 *    `renderTemplate`, usado no preview) — `validateTemplateVariables`
 *    (RNF-05, "tanto client quanto server") só é chamada no server
 *    (`src/lib/services/emailTemplateAdmin.ts`, via a rota `PUT`). O Cenário 5
 *    testa o comportamento real observado (erro só aparece após a chamada à
 *    API) — não a dupla camada descrita em RNF-05, que não parece implementada
 *    hoje. Sinalizado para o revisor humano confirmar se é uma lacuna real ou
 *    um achado a registrar.
 */

const EDITOR_PATH = (tipo: string) => `/admin/email-templates/${tipo}`;
const USERS_SEARCH_PLACEHOLDER = 'Buscar por nome, email ou clínica...';
const FREE_BODY_TRIGGER_LABEL = 'Envio de E-mail de Boas-Vindas por Clínica';

const MIGRATED_TEMPLATES: Array<{ tipo: string; label: string }> = [
  { tipo: 'welcome_approval', label: 'Aprovação de Solicitação de Acesso' },
  { tipo: 'password_reset', label: 'Redefinição de Senha' },
  { tipo: 'consultant_welcome', label: 'Boas-vindas ao Consultor' },
  { tipo: 'consultant_email_changed', label: 'Alteração de E-mail de Acesso do Consultor' },
  { tipo: 'consultant_transfer_request', label: 'Pedido de Transferência de Clínica' },
  { tipo: 'consultant_invite_created', label: 'Convite de Vínculo com Clínica' },
  { tipo: 'consultant_transfer_approved', label: 'Transferência de Clínica Aprovada' },
  { tipo: 'consultant_transfer_rejected', label: 'Transferência de Clínica Não Aprovada' },
  { tipo: 'access_request_rejected', label: 'Solicitação de Acesso Não Aprovada' },
  { tipo: 'generic_user_welcome', label: 'Boas-vindas Genérico de Novo Usuário' },
  { tipo: 'new_tenant_notification', label: 'Notificação Interna: Nova Clínica' },
  { tipo: 'access_request_created', label: 'Notificação Interna: Nova Solicitação de Acesso' },
];

async function loginSystemAdmin(page: Page): Promise<void> {
  await loginAs(
    page,
    { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
    '/admin/dashboard'
  );
}

function subjectInputOf(page: Page) {
  return page.locator('input').first();
}

function bodyTextareaOf(page: Page) {
  return page.locator('textarea').first();
}

function historyDialogOf(page: Page) {
  return page.getByRole('dialog').filter({ hasText: 'Histórico de versões' });
}

/**
 * Executa `run` e, independentemente do resultado, restaura `email_templates/{tipo}`
 * ao conteúdo que existia antes do teste e apaga qualquer `versions` criada
 * durante a execução — ver Assunção 2 (cabeçalho do arquivo).
 */
async function withTemplateRestore(tipo: string, run: () => Promise<void>): Promise<void> {
  const db = getEmulatorAdminFirestore();
  const templateRef = db.collection('email_templates').doc(tipo);
  const originalSnap = await templateRef.get();
  const original = originalSnap.data();
  try {
    await run();
  } finally {
    if (original) {
      await templateRef.set(original);
    }
    const versionsSnap = await templateRef.collection('versions').get();
    await Promise.all(versionsSnap.docs.map((d) => d.ref.delete()));
  }
}

test.describe('UC-55 — Editar Templates de E-mail', () => {
  test.describe('Cenário 1 — lista agrupada por categoria (Fluxo Principal, passo 2 / RN-02 / RN-12 / RN-14)', () => {
    test('exibe os 13 gatilhos; os 12 migrados são clicáveis e o #9 (tenants/create) aparece como linha informativa não editável', async ({
      page,
    }) => {
      await loginSystemAdmin(page);
      await page.goto('/admin/email-templates');

      await expect(page.getByRole('heading', { name: 'Templates de E-mail' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'E-mail', level: 2 })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Notificação Interna', level: 2 })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Mecanismo Próprio', level: 2 })
      ).toBeVisible();

      for (const { tipo, label } of MIGRATED_TEMPLATES) {
        const link = page.getByRole('link', { name: label });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', EDITOR_PATH(tipo));
      }

      // Gatilho #9 (RN-14): informativo, sem link, com badge "Não editável aqui".
      await expect(page.getByText(FREE_BODY_TRIGGER_LABEL)).toBeVisible();
      await expect(page.getByText('Não editável aqui', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: FREE_BODY_TRIGGER_LABEL })).toHaveCount(0);
    });
  });

  test.describe('Cenário 2 — carregar editor (Fluxo Principal, passo 4)', () => {
    test('assunto/corpo atuais carregam e o painel de variáveis permitidas destaca as obrigatórias (welcome_approval)', async ({
      page,
    }) => {
      await loginSystemAdmin(page);
      await page.goto(EDITOR_PATH('welcome_approval'));

      await expect(
        page.getByRole('heading', { name: 'Aprovação de Solicitação de Acesso' })
      ).toBeVisible();
      await expect(page.getByText('UC-02', { exact: true })).toBeVisible();

      await expect(subjectInputOf(page)).toHaveValue('Sua Solicitação foi Aprovada - Curva Mestra');
      await expect(bodyTextareaOf(page)).toHaveValue(/\{\{displayName\}\}/);
      await expect(bodyTextareaOf(page)).toHaveValue(/\{\{passwordResetLink\}\}/);

      // Obrigatórias com "*"; a opcional (businessName) sem asterisco.
      await expect(page.getByText('{{displayName}} *', { exact: true })).toBeVisible();
      await expect(page.getByText('{{email}} *', { exact: true })).toBeVisible();
      await expect(page.getByText('{{passwordResetLink}} *', { exact: true })).toBeVisible();
      await expect(page.getByText('{{businessName}}', { exact: true })).toBeVisible();
    });
  });

  test.describe('Cenário 3 — preview em tempo real (RF-03, layout dividido)', () => {
    test('a pré-visualização ao lado do corpo reflete os valores de exemplo e atualiza ao digitar, sem nenhum botão "Pré-visualizar" (password_reset)', async ({
      page,
    }) => {
      await loginSystemAdmin(page);
      await page.goto(EDITOR_PATH('password_reset'));

      await expect(page.getByRole('button', { name: 'Pré-visualizar' })).toHaveCount(0);
      await expect(
        page.getByText('Pré-visualização: Redefinição de Senha - Curva Mestra')
      ).toBeVisible();

      const previewFrame = page.frameLocator('iframe[title="Pré-visualização do corpo do e-mail"]');
      await expect(previewFrame.getByText('Maria Oliveira')).toBeVisible();
      await expect(previewFrame.locator('body')).not.toContainText('{{displayName}}');

      // Edita o assunto -- a pré-visualização textual acompanha em tempo real.
      await subjectInputOf(page).fill('Redefinição de Senha - Curva Mestra QA-UC55-LIVE');
      await expect(
        page.getByText('Pré-visualização: Redefinição de Senha - Curva Mestra QA-UC55-LIVE')
      ).toBeVisible();

      // Edita o corpo -- o iframe ao lado reflete a mudança, sem clicar em nada.
      await bodyTextareaOf(page).fill('<p>Teste QA-UC55 {{displayName}}</p>');
      await expect(previewFrame.getByText('Teste QA-UC55 Maria Oliveira')).toBeVisible();
    });
  });

  test.describe('Cenário 4 — envio de e-mail de teste (RF-04, Fluxo 7b)', () => {
    test('abre o diálogo, envia o conteúdo em edição (com valores de exemplo) para o destino informado e não persiste nada em email_templates (consultant_welcome)', async ({
      page,
    }) => {
      const db = getEmulatorAdminFirestore();
      const templateRef = db.collection('email_templates').doc('consultant_welcome');
      const beforeSnap = await templateRef.get();
      const beforeData = beforeSnap.data();

      let capturedPayload: { to?: string; subject?: string; html?: string } | undefined;
      await page.route('**/sendTemplateTestEmail', async (route) => {
        const raw = route.request().postData() ?? '{}';
        const parsed = JSON.parse(raw) as {
          data?: { to?: string; subject?: string; html?: string };
        };
        capturedPayload = parsed.data;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            result: {
              success: true,
              message: 'E-mail de teste enviado com sucesso',
              sentTo: parsed.data?.to,
            },
          }),
        });
      });

      await loginSystemAdmin(page);
      await page.goto(EDITOR_PATH('consultant_welcome'));

      const testEmail = 'qa.uc55.teste@example.com';
      await page.getByRole('button', { name: 'Enviar teste' }).click();
      await expect(page.getByRole('dialog').getByText('Enviar e-mail de teste')).toBeVisible();
      await page.getByLabel('E-mail de destino').fill(testEmail);
      await page.getByRole('button', { name: 'Enviar' }).click();

      await expect(page.getByText('E-mail de teste enviado', { exact: true })).toBeVisible();
      await expect(page.getByText(`Enviado para ${testEmail}`, { exact: true })).toBeVisible();

      // Payload enviado ao callable: destinatário informado + conteúdo
      // renderizado com os valores de exemplo (não o literal {{chave}}).
      expect(capturedPayload?.to).toBe(testEmail);
      expect(capturedPayload?.subject).toBe('Bem-vindo ao Curva Mestra - Portal do Consultor');
      expect(capturedPayload?.html).toContain('João Pereira');
      expect(capturedPayload?.html).toContain('CONS-4821');
      expect(capturedPayload?.html).not.toContain('{{name}}');

      // Nada persistido em email_templates por este fluxo (Fluxo 7b, passo 4).
      const afterSnap = await templateRef.get();
      expect(afterSnap.data()).toEqual(beforeData);
      const versionsSnap = await templateRef.collection('versions').get();
      expect(versionsSnap.empty).toBe(true);
    });
  });

  test.describe('Cenário 5 — salvar com validação (RF-05/RF-06, Fluxo 8b)', () => {
    test('caminho feliz salva nova versão; variável fora da lista e remoção de variável obrigatória são bloqueadas com mensagem específica (consultant_transfer_request)', async ({
      page,
    }) => {
      await withTemplateRestore('consultant_transfer_request', async () => {
        const db = getEmulatorAdminFirestore();
        const templateRef = db.collection('email_templates').doc('consultant_transfer_request');

        await loginSystemAdmin(page);
        await page.goto(EDITOR_PATH('consultant_transfer_request'));

        const originalBody = await bodyTextareaOf(page).inputValue();
        expect(originalBody).toContain('{{tenantName}}');

        // Caminho feliz: edita texto livre, mantendo todas as variáveis.
        const editedBody = originalBody.replace(
          'Atenciosamente,<br>Equipe Curva Mestra',
          'Atenciosamente,<br>Equipe Curva Mestra QA-UC55-OK'
        );
        await bodyTextareaOf(page).fill(editedBody);
        await page.getByRole('button', { name: 'Salvar' }).click();
        await expect(page.getByText('Template salvo com sucesso', { exact: true })).toBeVisible();

        const afterHappyPath = await templateRef.get();
        expect(afterHappyPath.data()?.body).toContain('QA-UC55-OK');
        const versionsAfterHappyPath = await templateRef.collection('versions').get();
        expect(versionsAfterHappyPath.size).toBe(1);
        expect(versionsAfterHappyPath.docs[0].data().body).toBe(originalBody);

        // Fluxo 8b, passo 1a: variável fora da lista permitida.
        await bodyTextareaOf(page).fill(`${editedBody} {{naoPermitida}}`);
        await page.getByRole('button', { name: 'Salvar' }).click();
        await expect(
          page.getByText('Variável {{naoPermitida}} não é permitida para este template', {
            exact: true,
          })
        ).toBeVisible();
        // Fluxo 8b, passo 2: formulário mantém o conteúdo digitado.
        await expect(bodyTextareaOf(page)).toHaveValue(`${editedBody} {{naoPermitida}}`);
        // Garantia mínima de falha: Firestore não mudou desde o caminho feliz.
        const afterError1 = await templateRef.get();
        expect(afterError1.data()?.body).toBe(editedBody);

        // Fluxo 8b, passo 1b: remoção de uma variável obrigatória.
        const bodyMissingRequired = editedBody.replace(
          '{{tenantName}}',
          'uma clínica sem variável'
        );
        await bodyTextareaOf(page).fill(bodyMissingRequired);
        await page.getByRole('button', { name: 'Salvar' }).click();
        await expect(
          page.getByText('Variável obrigatória {{tenantName}} foi removida', { exact: true })
        ).toBeVisible();
        const afterError2 = await templateRef.get();
        expect(afterError2.data()?.body).toBe(editedBody);
      });
    });
  });

  test.describe('Cenário 6 — histórico e reversão (RF-07, Fluxo 7c)', () => {
    test('duas edições geram duas entradas no histórico (autor/data); reverter aplica a versão anterior e gera uma nova entrada (consultant_invite_created)', async ({
      page,
    }) => {
      await withTemplateRestore('consultant_invite_created', async () => {
        const db = getEmulatorAdminFirestore();
        const templateRef = db.collection('email_templates').doc('consultant_invite_created');
        const original = (await templateRef.get()).data()!;
        const originalSubject = original.subject as string;

        await loginSystemAdmin(page);
        await page.goto(EDITOR_PATH('consultant_invite_created'));

        // Estado inicial: nenhuma versão salva ainda.
        await page.getByRole('button', { name: 'Histórico' }).click();
        await expect(
          historyDialogOf(page).getByText('Nenhuma versão anterior salva.')
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);

        const subjectV1 = `${originalSubject} QA-UC55-V1`;
        const subjectV2 = `${originalSubject} QA-UC55-V2`;

        // Edição 1.
        await subjectInputOf(page).fill(subjectV1);
        await page.getByRole('button', { name: 'Salvar' }).click();
        await expect(page.getByText('Template salvo com sucesso', { exact: true })).toBeVisible();

        // Edição 2.
        await subjectInputOf(page).fill(subjectV2);
        await page.getByRole('button', { name: 'Salvar' }).click();
        await expect(page.getByText('Template salvo com sucesso', { exact: true })).toBeVisible();

        // Histórico: 2 entradas -- a mais recente guarda o snapshot da V1
        // (conteúdo ativo imediatamente antes da 2ª gravação), a mais antiga
        // guarda o snapshot original (ativo antes da 1ª gravação).
        await page.getByRole('button', { name: 'Histórico' }).click();
        const dialog = historyDialogOf(page);
        await expect(dialog.getByText(subjectV1, { exact: true })).toBeVisible();
        await expect(dialog.getByText(originalSubject, { exact: true })).toBeVisible();
        await expect(dialog.getByText(TEST_USERS.systemAdmin.name).first()).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Reverter' })).toHaveCount(2);

        // Reverte para a versão mais antiga (conteúdo original). `hasText` faz
        // substring match -- subjectV1 contém originalSubject como substring,
        // então filtra pelo descendente com texto EXATO para achar só a linha certa.
        const originalRow = dialog.locator('div.border.rounded.p-3').filter({
          has: page.getByText(originalSubject, { exact: true }),
        });
        await originalRow.getByRole('button', { name: 'Reverter' }).click();
        await expect(
          page.getByText('Template revertido com sucesso', { exact: true })
        ).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);

        // Formulário principal reflete o conteúdo revertido.
        await expect(subjectInputOf(page)).toHaveValue(originalSubject);

        // A própria reversão gera uma nova entrada -- agora 3 no histórico, a
        // mais nova guardando o snapshot da V2 (ativo antes da reversão).
        await page.getByRole('button', { name: 'Histórico' }).click();
        const dialogAfterRevert = historyDialogOf(page);
        await expect(dialogAfterRevert.getByRole('button', { name: 'Reverter' })).toHaveCount(3);
        await expect(dialogAfterRevert.getByText(subjectV2, { exact: true })).toBeVisible();
        await expect(dialogAfterRevert.getByText(subjectV1, { exact: true })).toBeVisible();
        await expect(dialogAfterRevert.getByText(originalSubject, { exact: true })).toBeVisible();
      });
    });
  });

  test.describe('Cenário 7 — bloqueio de acesso (RF-08, Fluxo 8a)', () => {
    test('clinic_admin é redirecionado para /clinic/dashboard ao acessar a lista e o editor direto pela URL', async ({
      page,
    }) => {
      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );

      await page.goto('/admin/email-templates');
      await expect(page).toHaveURL(/\/clinic\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Templates de E-mail' })).toHaveCount(0);

      await page.goto(EDITOR_PATH('welcome_approval'));
      await expect(page).toHaveURL(/\/clinic\/dashboard/);
      await expect(
        page.getByRole('heading', { name: 'Aprovação de Solicitação de Acesso' })
      ).toHaveCount(0);
    });
  });

  test.describe('Cenário 8 — gatilhos migrados leem de Firestore, não HTML hardcoded (RF-09)', () => {
    test('password_reset editado é refletido no e-mail enfileirado em email_queue ao disparar o fluxo real de UC-08 (mecanismo email_queue)', async ({
      page,
    }) => {
      const db = getEmulatorAdminFirestore();
      const target = TEST_USERS.clinicUserA;
      const createdEmailQueueRefs: DocumentReference<DocumentData>[] = [];
      const createdTokenRefs: DocumentReference<DocumentData>[] = [];

      await withTemplateRestore('password_reset', async () => {
        const marker = `QA-UC55-PWRESET-${Date.now()}`;

        await loginSystemAdmin(page);
        await page.goto(EDITOR_PATH('password_reset'));

        const originalBody = await bodyTextareaOf(page).inputValue();
        const editedBody = originalBody.replace(
          'Foi solicitada a redefinição da sua senha',
          `Foi solicitada a redefinição da sua senha [${marker}]`
        );
        await bodyTextareaOf(page).fill(editedBody);
        await page.getByRole('button', { name: 'Salvar' }).click();
        await expect(page.getByText('Template salvo com sucesso', { exact: true })).toBeVisible();

        try {
          // Dispara o fluxo real de UC-08 (admin envia link de redefinição de senha).
          await page.goto('/admin/users');
          await page.getByPlaceholder(USERS_SEARCH_PLACEHOLDER).fill(target.email);
          const row = page.locator('tr').filter({ hasText: target.email });
          await row.getByRole('button', { name: 'Editar' }).click();
          await expect(page.getByRole('dialog')).toBeVisible();
          await page.getByRole('button', { name: 'Enviar Link de Reset' }).click();
          await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar' }).click();
          await expect(page.getByText('Email enviado com sucesso!', { exact: true })).toBeVisible();

          const emailSnap = await db
            .collection('email_queue')
            .where('metadata.user_id', '==', target.uid)
            .where('type', '==', 'password_reset')
            .get();
          emailSnap.docs.forEach((d) => createdEmailQueueRefs.push(d.ref));
          expect(emailSnap.empty).toBe(false);
          const docs = emailSnap.docs.sort(
            (a, b) =>
              (b.data().created_at?.toMillis?.() ?? 0) - (a.data().created_at?.toMillis?.() ?? 0)
          );
          const latestBody = docs[0].data().body as string;
          expect(latestBody).toContain(marker);
          // Variáveis já renderizadas -- nenhum placeholder literal sobra no
          // corpo enfileirado (prova de que não é mais HTML hardcoded).
          expect(latestBody).not.toContain('{{displayName}}');
          expect(latestBody).not.toContain('{{resetLink}}');

          const tokenSnap = await db
            .collection('password_reset_tokens')
            .where('user_id', '==', target.uid)
            .get();
          tokenSnap.docs.forEach((d) => createdTokenRefs.push(d.ref));
        } finally {
          await Promise.all(
            createdEmailQueueRefs.map((ref) => ref.delete().catch(() => undefined))
          );
          await Promise.all(createdTokenRefs.map((ref) => ref.delete().catch(() => undefined)));
        }
      });
    });

    test.fixme(
      true,
      'generic_user_welcome (#11) só é enviado pelo trigger onUserCreated ' +
        '(Cloud Function onDocumentCreated em users/{uid}, functions/src/onUserCreated.ts). ' +
        '`npm run test:e2e` roda `firebase emulators:exec --only auth,firestore,storage` -- o ' +
        'emulador de Functions (porta 5001, já configurado em firebase.json) não é iniciado por ' +
        'essa suíte hoje, então nenhum trigger de Cloud Functions dispara aqui. Habilitar este ' +
        'cenário exige (1) adicionar `functions` ao --only do script test:e2e (e compilar ' +
        'functions/lib antes) e (2) decidir o que fazer com os secrets SMTP_USER/SMTP_PASS ' +
        '(indisponíveis no emulador) -- por exemplo, mockar sendEmail dentro da function. ' +
        'Infraestrutura nova, fora do escopo deste spec -- sinalizado para o dev/orquestrador.'
    );
    test('generic_user_welcome editado é refletido no e-mail enviado pelo trigger onUserCreated ao criar um users/{uid} direto (mecanismo Cloud Function trigger)', async () => {
      // Intencionalmente não implementado -- ver test.fixme acima. Quando o
      // emulador de Functions estiver disponível nesta suíte, o esqueleto é:
      // 1. Editar generic_user_welcome (marcador no body) e salvar via UI.
      // 2. Criar `users/{uid}` via Admin SDK (sem `skip_welcome_email`).
      // 3. Aguardar o trigger onUserCreated processar e confirmar, via algum
      //    stub/captura de sendEmail, que o corpo enviado contém o marcador.
    });
  });
});
