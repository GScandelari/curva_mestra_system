import { test, expect } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_TENANTS, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura retroativa (Modo B) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-05-aprovar-solicitacao-de-acesso-pela-propria-clinica.md (v2.2)
 *
 * IMPORTANTE — natureza deste UC: o próprio documento-fonte reclassifica este
 * fluxo (blockquote "Reclassificação v2.0") como candidato à descontinuação —
 * o `clinic_admin` não usa esta tela para adicionar usuários hoje; o caminho
 * real e válido é a criação direta de usuário (UC-40, "Criar Usuário para a
 * Própria Clínica", `clinic/users/page.tsx` + `POST /api/users/create`). Este
 * spec não endossa o fluxo nem valida um comportamento desejável — ele fixa
 * em teste automatizado as evidências técnicas (RN-02 a RN-04, seção 8) que
 * sustentam a hipótese de que o botão "Aprovar" desta tela nunca funcionou.
 * Serve de trava de regressão para a decisão de produto ainda pendente
 * (seção 14: remover vs. implementar de fato) — se um dia RN-02/RN-03/RN-04
 * forem corrigidas (opção "b") ou a tela for removida (opção "a"), este spec
 * deve quebrar de forma visível e proposital, sinalizando ao revisor humano
 * que a decisão finalmente aconteceu.
 *
 * Cobre:
 * - Fluxo Principal, passos 1-3 + Fluxo Alternativo 7a (estado padrão/quase
 *   permanente da tela: lista vazia, sem nenhuma ação prévia — RN-03/8c) e os
 *   três cards de contagem, incluindo a evidência de RN-04/8b (bug de
 *   contagem: `current_users` sempre 0 mesmo com usuários reais ativos).
 * - Fluxo Principal, passo 4 (cenário hipotético descrito no UC: solicitação
 *   pendente semeada diretamente via Admin SDK, já que nenhuma tela viva do
 *   sistema cria esse documento vinculado a um tenant existente — RN-03/8c)
 *   + Fluxo de Exceção 8a/RN-02 (clicar "Aprovar" aciona
 *   `approveAccessRequest()`, depreciada, sempre retorna `success: false`).
 *
 * NÃO coberto nesta rodada:
 * - Fluxo Alternativo 7b (sem vagas disponíveis): o próprio UC documenta que
 *   este caminho nunca é alcançado na prática hoje, exatamente por causa do
 *   bug RN-04 fixado abaixo — `available_slots` nunca chega a `<= 0` através
 *   de nenhuma sequência de ações reais na UI, porque `getTenantLimits()`
 *   sempre conta usuários em `tenants/{tenantId}/users`, subcoleção onde
 *   nenhum fluxo do sistema jamais escreve. Forçar esse estado exigiria
 *   gravar documentos diretamente nesse caminho morto do Firestore só para
 *   simular um bug que nunca ocorre na prática — decidiu-se não fazer isso; a
 *   evidência da causa-raiz já está fixada pelo teste de RN-04 abaixo.
 * - Rejeição de solicitação (botão "Rejeitar", mesma tela): já documentada
 *   como funcional em UC-03 (fora do escopo deste UC-05, que trata apenas da
 *   aprovação).
 */

function uniqueEmail(scenario: string): string {
  return `qa-uc05-${scenario}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

test.describe('UC-05 — "Aprovar Solicitação de Acesso" pela Própria Clínica (Clinic Admin)', () => {
  test.describe('Fluxo Principal (passos 1-3) + Fluxo Alternativo 7a — estado padrão da tela', () => {
    test('sem nenhuma access_request vinculada ao tenant, a lista aparece vazia e os cards evidenciam RN-04 (bug de contagem)', async ({
      page,
    }) => {
      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );

      // Passo 1.
      await page.goto('/clinic/access-requests');
      await expect(page.getByRole('heading', { name: 'Solicitações de Acesso' })).toBeVisible();

      // Passos 2-3 + Fluxo Alternativo 7a: nenhuma tela viva do sistema cria
      // uma access_request já vinculada a um tenant existente (RN-03/8c) — o
      // seed desta suíte (scripts/seed-emulator.ts) não grava nenhuma, então
      // a lista já nasce vazia, sem precisar de nenhuma ação prévia deste
      // teste.
      await expect(
        page.getByRole('heading', { name: 'Nenhuma solicitação pendente' })
      ).toBeVisible();
      await expect(page.getByText('Não há pedidos de acesso no momento')).toBeVisible();

      // Cards de contagem, na ordem fixa em que aparecem no grid
      // (src/app/(clinic)/clinic/access-requests/page.tsx): Pendentes, Vagas
      // Disponíveis, Usuários Ativos.
      const statsCards = page.locator('div.grid.gap-4.md\\:grid-cols-3 > div');
      const pendentesCard = statsCards.nth(0);
      const vagasCard = statsCards.nth(1);
      const usuariosCard = statsCards.nth(2);

      await expect(pendentesCard.getByText('Pendentes')).toBeVisible();
      await expect(pendentesCard.locator('.text-2xl.font-bold')).toHaveText('0');

      // tenants/test-clinic-a tem max_users: 5 (scripts/seed-emulator.ts).
      await expect(vagasCard.getByText('Vagas Disponíveis')).toBeVisible();
      await expect(vagasCard.locator('.text-2xl.font-bold')).toHaveText('5');
      await expect(vagasCard.getByText('de 5 usuários')).toBeVisible();

      // RN-04/8b: getTenantLimits() conta usuários ativos na subcoleção
      // `tenants/{tenantId}/users`, onde NENHUM fluxo real do sistema escreve
      // (usuários reais ficam na coleção raiz `users`, filtrada por
      // `tenant_id` — clinicUserService.ts). Por isso este card mostra "0"
      // mesmo com 2 usuários reais ativos na clínica A hoje
      // (TEST_USERS.clinicAdminA + TEST_USERS.clinicUserA, seed-data.ts) — o
      // bug documentado na seção 8b/RN-04 do UC-05.
      await expect(usuariosCard.getByText('Usuários Ativos')).toBeVisible();
      await expect(usuariosCard.locator('.text-2xl.font-bold')).toHaveText('0');
    });
  });

  test.describe('Fluxo Principal (passo 4, cenário hipotético) + Fluxo de Exceção 8a — solicitação pendente semeada via Admin SDK', () => {
    test('clicar em "Aprovar" aciona approveAccessRequest(), depreciada, e não aprova nada (RN-02)', async ({
      page,
    }) => {
      // 8c: nenhuma tela viva do sistema cria uma access_request já vinculada
      // a um tenant existente — para exercitar o passo 4 do Fluxo Principal
      // (cenário hipotético descrito no próprio UC), a única forma de colocar
      // uma solicitação pendente nesta lista é escrever o documento
      // diretamente via Admin SDK, contornando a UI. Isso replica de propósito
      // a ausência de um caminho real (RN-03), não simula um caminho que
      // exista de fato hoje.
      const email = uniqueEmail('aprovar');
      const db = getEmulatorAdminFirestore();
      const now = Timestamp.now();
      const requestRef = await db.collection('access_requests').add({
        role: 'especialista',
        type: 'clinica',
        full_name: 'Fernanda Lopes',
        email,
        phone: '11999998888',
        council_number: 'CRM-SP 200100',
        business_name: TEST_TENANTS.clinicA.name,
        status: 'pendente',
        tenant_id: TEST_TENANTS.clinicA.tenant_id,
        created_at: now,
        updated_at: now,
      });

      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );
      await page.goto('/clinic/access-requests');

      const row = page.getByRole('row', { name: new RegExp(email) });
      await expect(row).toBeVisible();
      await expect(row.getByText('Fernanda Lopes')).toBeVisible();

      // Passo 4: clica em "Aprovar" na linha da solicitação pendente.
      await row.getByRole('button', { name: 'Aprovar' }).click();

      // 8a/RN-02: approveAccessRequest() está marcada DEPRECATED no
      // código-fonte (accessRequestService.ts, linhas ~199-211) e sempre
      // retorna { success: false }, com esta mensagem literal —
      // independentemente da solicitação, do tenant ou de qualquer outro
      // dado. Nenhum caminho de código leva ao sucesso.
      await expect(
        page.getByText(
          'Esta função foi depreciada. Use a API route /api/access-requests/[id]/approve'
        )
      ).toBeVisible();

      // Pós-condição de "falha" (seção 4.2 do UC): nenhum usuário é criado; a
      // solicitação permanece "pendente", sem approved_by/approved_at.
      const snap = await requestRef.get();
      const data = snap.data();
      expect(data?.status).toBe('pendente');
      expect(data?.approved_by).toBeUndefined();
      expect(data?.approved_at).toBeUndefined();

      // Garantia mínima de falha via Firebase Auth (Admin SDK): nenhum
      // usuário foi criado para este e-mail — mesmo critério de asserção via
      // Admin SDK usado em UC-02 para o caminho de aprovação que de fato
      // funciona (rota /api/access-requests/[id]/approve).
      const auth = getEmulatorAdminAuth();
      await expect(auth.getUserByEmail(email)).rejects.toThrow();
    });
  });
});
