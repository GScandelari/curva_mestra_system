import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';
import type { AxeResults } from 'axe-core';

/**
 * Varredura de acessibilidade (axe-core) com baseline por regra ("catraca").
 * Ver ONLY_FOR_DEVS/TO_DO/FEAT-agente-ux-reviewer.md §4.1 e §6.4.
 *
 * - A11Y_MODE=report      → nunca falha; só anota regras novas (uso do ux-reviewer).
 * - qualquer outro valor  → enforce: falha se surgir regra fora do baseline (CI).
 * - A11Y_UPDATE_BASELINE=1 → regrava a entrada do baseline (só local; lança em CI).
 */

export const WCAG21AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

export type A11yMode = 'enforce' | 'report';

export interface A11yScanOptions {
  /** Chave da rota (A11yRoute.key) ou chave ad-hoc para conteúdo sintético. */
  routeKey: string;
  include?: string[];
  exclude?: string[];
  /** Tags extras (ex.: 'best-practice') — só usadas quando mode = 'report'. */
  extraTags?: string[];
}

interface A11yBaseline {
  version: 1;
  axeCore: string;
  entries: Record<string, string[]>;
}

const BASELINE_PATH = path.join(__dirname, '..', 'fixtures', 'a11y-baseline.json');

export function getA11yMode(): A11yMode {
  return process.env.A11Y_MODE === 'report' ? 'report' : 'enforce';
}

function resultsDir(testInfo: TestInfo): string {
  const dir = path.join(testInfo.project.outputDir, 'a11y', testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readBaseline(): A11yBaseline {
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as A11yBaseline;
}

function writeBaseline(baseline: A11yBaseline): void {
  // Chaves e ruleIds ordenados para o diff do PR ser estável.
  const entries = Object.fromEntries(
    Object.keys(baseline.entries)
      .sort()
      .map((key) => [key, [...baseline.entries[key]].sort()])
  );
  fs.writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ ...baseline, entries }, null, 2)}\n`,
    'utf-8'
  );
}

/** Roda o axe com WCAG21AA_TAGS, grava test-results/a11y/<projeto>/<routeKey>.json e anexa ao testInfo. */
export async function scanA11y(
  page: Page,
  testInfo: TestInfo,
  opts: A11yScanOptions
): Promise<AxeResults> {
  const tags = [...WCAG21AA_TAGS, ...(getA11yMode() === 'report' ? (opts.extraTags ?? []) : [])];
  let builder = new AxeBuilder({ page }).withTags(tags);
  for (const selector of opts.include ?? []) builder = builder.include(selector);
  for (const selector of opts.exclude ?? []) builder = builder.exclude(selector);

  const results = await builder.analyze();

  const body = JSON.stringify(results, null, 2);
  fs.writeFileSync(path.join(resultsDir(testInfo), `${opts.routeKey}.json`), body, 'utf-8');
  await testInfo.attach(`axe-${opts.routeKey}`, { body, contentType: 'application/json' });

  return results;
}

/**
 * Compara os ruleIds violados com a entrada `${testInfo.project.name}|${routeKey}` do baseline.
 * - mode 'enforce' (padrão): falha se houver ruleId fora do baseline.
 * - mode 'report' (A11Y_MODE=report): nunca falha; anota ruleIds novos.
 * - Em ambos: anota `baseline-shrinkable` para ruleIds do baseline que não ocorreram.
 * - A11Y_UPDATE_BASELINE=1: regrava a entrada no JSON; lança erro se process.env.CI.
 * - Se a versão de axe-core instalada ≠ baseline.axeCore: anotação de aviso (regras podem mudar).
 */
export async function expectNoNewA11yViolations(
  page: Page,
  testInfo: TestInfo,
  opts: A11yScanOptions
): Promise<void> {
  const results = await scanA11y(page, testInfo, opts);
  const baseline = readBaseline();
  const key = `${testInfo.project.name}|${opts.routeKey}`;
  const known = baseline.entries[key] ?? [];
  const violated = [...new Set(results.violations.map((v) => v.id))].sort();

  if (results.testEngine.version !== baseline.axeCore) {
    testInfo.annotations.push({
      type: 'axe-version-mismatch',
      description: `axe-core ${results.testEngine.version} instalado, baseline gravado com ${baseline.axeCore} — regras podem ter mudado`,
    });
  }

  if (process.env.A11Y_UPDATE_BASELINE === '1') {
    if (process.env.CI) {
      throw new Error(
        'A11Y_UPDATE_BASELINE não pode ser usado em CI — regrave o baseline localmente.'
      );
    }
    writeBaseline({
      ...baseline,
      axeCore: results.testEngine.version,
      entries: { ...baseline.entries, [key]: violated },
    });
    testInfo.annotations.push({
      type: 'baseline-updated',
      description: `${key}: [${violated.join(', ')}]`,
    });
    return;
  }

  const newRules = violated.filter((id) => !known.includes(id));
  const shrinkable = known.filter((id) => !violated.includes(id));

  if (shrinkable.length > 0) {
    testInfo.annotations.push({
      type: 'baseline-shrinkable',
      description: `${key}: regra(s) do baseline que não ocorreram — ${shrinkable.join(', ')}`,
    });
  }

  if (getA11yMode() === 'report') {
    if (newRules.length > 0) {
      testInfo.annotations.push({
        type: 'a11y-new-violations',
        description: `${key}: ${newRules.join(', ')}`,
      });
    }
    return;
  }

  expect(
    newRules,
    `Novas violações WCAG 2.1 AA em ${key} (fora do baseline tests/e2e/fixtures/a11y-baseline.json). ` +
      `Detalhes em test-results/a11y/${testInfo.project.name}/${opts.routeKey}.json`
  ).toEqual([]);
}

/** Mede overflow horizontal (reflow) e grava test-results/a11y/<projeto>/<routeKey>.overflow.json. */
export async function measureHorizontalOverflow(
  page: Page,
  testInfo: TestInfo,
  routeKey: string
): Promise<{ scrollWidth: number; innerWidth: number; deviceWidth: number; overflow: boolean }> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  // Em perfil mobile (isMobile), o Chrome alarga o layout viewport até caber o
  // conteúdo — innerWidth acompanha o scrollWidth e esconderia o overflow.
  // Compara-se então com a largura do dispositivo configurada no projeto.
  const deviceWidth = page.viewportSize()?.width ?? innerWidth;
  const result = { scrollWidth, innerWidth, deviceWidth, overflow: scrollWidth > deviceWidth };
  fs.writeFileSync(
    path.join(resultsDir(testInfo), `${routeKey}.overflow.json`),
    JSON.stringify(result, null, 2),
    'utf-8'
  );
  return result;
}
