import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { expectNoNewA11yViolations, measureHorizontalOverflow, scanA11y } from './helpers/a11y';
import { A11Y_ROUTES, type A11yRoute } from './fixtures/a11y-routes';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Spec de infraestrutura (prefixo `_`, não vinculado a nenhum UC) — caderno de
 * acessibilidade (axe-core, WCAG 2.1 AA com baseline por regra) e de perfil
 * mobile (projeto `mobile-chromium`, Pixel 7). Gerado a partir da Seção
 * "STEP 4 — Validação Manual" (cenários 1 a 4) de
 * ONLY_FOR_DEVS/TO_DO/FEAT-agente-ux-reviewer.md (ver também §6.4 e §6.5).
 *
 * Todos os testes têm tag `@mobile` e rodam nos dois projetos (`chromium` e
 * `mobile-chromium`), exceto o cenário 4, pulado fora do `mobile-chromium`.
 * Somente leitura: nenhum teste escreve no Firestore/Auth do emulador — por
 * isso é seguro rodar no projeto mobile depois da suíte completa ter mutado o
 * estado semeado.
 */

const SYNTHETIC_BROKEN_HTML =
  '<html lang="pt-BR"><head><title>a11y</title></head><body><main><button></button><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main></body></html>';

const SYNTHETIC_CLEAN_HTML =
  '<html lang="pt-BR"><head><title>a11y</title></head><body><main><h1>Estoque</h1><button>Salvar</button></main></body></html>';

/**
 * Abre uma rota de A11Y_ROUTES como o cenário 3 descreve: loga (se a rota
 * exigir usuário), navega até o path se ainda não estiver nele e aguarda o
 * heading de "tela pronta". Nunca usa `networkidle` (listeners realtime do
 * Firestore mantêm conexão aberta — §6.4).
 */
async function openRoute(page: Page, route: A11yRoute): Promise<void> {
  if (route.user !== null) {
    await loginAs(
      page,
      { email: TEST_USERS[route.user].email, password: TEST_PASSWORD },
      route.loginRedirect!
    );
  }

  const currentPath = page.url().startsWith('http') ? new URL(page.url()).pathname : '';
  if (currentPath !== route.path) {
    await page.goto(route.path);
  }

  await expect(page.getByRole('heading', { name: route.readyHeading }).first()).toBeVisible();
}

test.describe(
  'Infraestrutura de QA — acessibilidade (axe) e perfil mobile',
  { tag: '@mobile' },
  () => {
    // Cenário 1 — FEAT-agente-ux-reviewer, STEP 4
    test('cenário 1: helper detecta violações conhecidas em conteúdo sintético', async ({
      page,
    }, testInfo) => {
      await page.setContent(SYNTHETIC_BROKEN_HTML);

      const results = await scanA11y(page, testInfo, { routeKey: 'synthetic-broken' });

      const ruleIds = results.violations.map((v) => v.id);
      expect(ruleIds).toContain('button-name');
      expect(ruleIds).toContain('image-alt');

      const jsonPath = path.join(
        testInfo.project.outputDir,
        'a11y',
        testInfo.project.name,
        'synthetic-broken.json'
      );
      expect(fs.existsSync(jsonPath), `JSON de resultado esperado em ${jsonPath}`).toBe(true);
    });

    // Cenário 2 — FEAT-agente-ux-reviewer, STEP 4
    test('cenário 2: helper não acusa violações em conteúdo sintético acessível', async ({
      page,
    }, testInfo) => {
      await page.setContent(SYNTHETIC_CLEAN_HTML);

      const results = await scanA11y(page, testInfo, { routeKey: 'synthetic-clean' });

      expect(results.violations).toEqual([]);
    });

    // Cenário 3 — FEAT-agente-ux-reviewer, STEP 4: um teste por rota de A11Y_ROUTES
    for (const route of A11Y_ROUTES) {
      test(`cenário 3: tela semeada "${route.key}" (${route.path}) sem nova violação WCAG 2.1 AA fora do baseline`, async ({
        page,
      }, testInfo) => {
        await openRoute(page, route);

        await expectNoNewA11yViolations(page, testInfo, { routeKey: route.key });
      });
    }

    // Cenário 4 — FEAT-agente-ux-reviewer, STEP 4 (só mobile-chromium)
    test.describe('cenário 4: perfil mobile efetivo e reflow', () => {
      test.beforeEach(async ({}, testInfo) => {
        test.skip(
          testInfo.project.name !== 'mobile-chromium',
          'Cenário 4 roda só no projeto mobile-chromium (FEAT-agente-ux-reviewer §6.5)'
        );
      });

      test('cenário 4: /login usa viewport mobile (412px) e não tem overflow horizontal', async ({
        page,
      }, testInfo) => {
        await page.goto('/login');
        const loginRoute = A11Y_ROUTES.find((r) => r.key === 'login');
        if (loginRoute) {
          await expect(
            page.getByRole('heading', { name: loginRoute.readyHeading }).first()
          ).toBeVisible();
        }

        expect(page.viewportSize()?.width).toBe(412);

        const { overflow, scrollWidth, deviceWidth } = await measureHorizontalOverflow(
          page,
          testInfo,
          'login'
        );
        expect(
          overflow,
          `Overflow horizontal em /login: scrollWidth=${scrollWidth} > deviceWidth=${deviceWidth}`
        ).toBe(false);
      });

      // Demais rotas: apenas anotar overflow (dívida desconhecida, insumo do ux-reviewer) — não falha.
      for (const route of A11Y_ROUTES.filter((r) => r.key !== 'login')) {
        test(`cenário 4: reflow de "${route.key}" (${route.path}) é anotado sem falhar`, async ({
          page,
        }, testInfo) => {
          await openRoute(page, route);

          const { overflow, scrollWidth, deviceWidth } = await measureHorizontalOverflow(
            page,
            testInfo,
            route.key
          );
          if (overflow) {
            testInfo.annotations.push({
              type: 'reflow',
              description: `${testInfo.project.name}|${route.key}: scrollWidth=${scrollWidth} > deviceWidth=${deviceWidth}`,
            });
          }
        });
      }
    });
  }
);
