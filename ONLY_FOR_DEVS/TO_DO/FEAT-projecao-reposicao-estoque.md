# Feature Specification: Consultar Projeção de Reposição de Estoque (UC-52)

**Projeto:** Curva Mestra
**Data:** 22/09/2026
**Autor:** Doc Writer (Claude)
**Status:** Em execução
**Tipo:** Feature
**Branch sugerida:** `feat/uc52-projecao-reposicao-estoque` (já existe e está com checkout ativo — ver nota na Seção 0 sobre o prefixo `feat/` divergir do padrão documentado `feature/`)
**Prioridade:** Média
**Versão:** 1.2

> Implementa o UC-52 (`ONLY_FOR_DEVS/PO_BA_Docs/UC-52-consultar-projecao-de-reposicao-de-estoque.md`, v1.0, Aprovado): uma tela e um card de Dashboard que projetam, por `codigo_produto`, a data estimada em que o estoque vai zerar, calculada 100% client-side a partir do consumo histórico real (`Solicitacao concluida`), sem nenhum cron ou API route nova. Consultor Rennova vinculado vê a mesma projeção completa das clínicas vinculadas, sem mudança de `firestore.rules`. As duas pendências de decisão do UC-52 (critério de suficiência de dados e destino do card agregado do Consultor) foram respondidas explicitamente pelo usuário — ver Seção 14.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`
- **Branch da task:** `feat/uc52-projecao-reposicao-estoque` — já existe localmente e é a branch atualmente com checkout ativo (`git status` no início desta sessão). O padrão documentado em `GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` usa o prefixo `feature/`, não `feat/`; como a branch já foi criada e nenhuma outra task depende do nome, a recomendação é **continuar nela** em vez de recriar — é um desvio cosmético, não bloqueante, mas fica registrado aqui para não repetir no futuro.
- Fluxo de PR obrigatório: `feat/uc52-projecao-reposicao-estoque` → PR → `gscandelari_setup` (validação no Firebase pessoal) → PR → `develop`. **Nunca** abrir PR direto para `master`.

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 1 | `feat` | `inventory` | `add pure replenishment projection calculation functions` |
| 2 | `test` | `inventory` | `add unit tests for replenishment projection functions` |
| 3 | `feat` | `inventory` | `add firestore loader for replenishment projections` |
| 4 | `feat` | `inventory` | `add ProjectionsView table component` |
| 5 | `feat` | `inventory` | `add projections page and entry point for clinic` |
| 6 | `feat` | `inventory` | `add projections page and entry points for consultant portal` |
| 7 | `feat` | `dashboard` | `add replenishment projection card to clinic dashboard` |
| 8 | `feat` | `dashboard` | `add replenishment projection card to consultant dashboard` |
| 9 | `test` | `inventory` | `add UC-52 Playwright spec (qa-agent, revisado)` |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

Hoje não existe nenhum motor de previsão de reposição no sistema. O que existe:

- **`src/lib/services/alertTriggers.ts`** (`checkLowStock`) compara o estoque **atual** contra `stock_limits`/`limite_estoque_baixo` (UC-15) e dispara notificação quando já está baixo — é um alerta de **estado presente**, não uma projeção de data futura.
- **`src/lib/services/reportService.ts`** (`generateConsumptionReport`) já lê `tenants/{tenantId}/solicitacoes` com `status == 'concluida'` num período informado e agrega consumo por `codigo_produto` — é a mesma fonte de dado que este UC precisa, mas hoje só existe como relatório sob demanda de período livre (sem cálculo de taxa diária nem de esgotamento).
- **`src/lib/inventoryUtils.ts`** (`agruparProdutosPorCodigo`, `getStatusEstoque`) já define a convenção de agregação por `codigo_produto` reaproveitada por `InventoryView.tsx` e por `stock_limits` (UC-15) — mesma convenção que este UC deve seguir (RN-05).
- **`src/components/inventory/InventoryView.tsx`** já é compartilhado entre `/clinic/inventory` (`readOnly=false`) e `/consultant/clinics/{tenantId}/inventory` (`readOnly`, `onlyBrand="Rennova"`, `backUrl`) — mesmo padrão de componente único reaproveitado que este UC deve seguir para a nova tela de projeções.
- **`src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx`** já implementa o guard de acesso do Consultor (`authorizedTenants.includes(tenantId)`, redirect para `/consultant/clinics` se não autorizado) — mesmo guard exigido pelo Fluxo Alternativo 7c do UC-52.
- **`firestore.rules`** (linhas 58-67) já concede ao Consultor leitura read-only de **qualquer** subcoleção de um tenant autorizado (`match /tenants/{tenantId}/{document=**} { allow read: if consultantHasAccess(tenantId); }`) — confirmado por leitura direta do arquivo: nenhuma regra mais restritiva dedicada a `solicitacoes` existe. RN-08 do UC-52 está correta; **nenhuma mudança em `firestore.rules` é necessária**.
- **`firestore.indexes.json`** já contém um índice composto `solicitacoes`: `status ASC + dt_procedimento ASC` (linhas 110-121), o mesmo usado por `generateConsumptionReport`. A query que este UC precisa (`status == 'concluida'` + `dt_procedimento >= X`) é coberta por esse índice existente — **nenhum índice novo é necessário**.
- **`src/app/(clinic)/clinic/dashboard/page.tsx`** e **`src/app/(consultant)/consultant/dashboard/page.tsx`** já existem com blocos de cards carregados sob demanda ao montar a tela (sem nenhum cron), mesmo padrão de gatilho que este UC usa (RN-07).
- **`src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx`** já tem um único Quick Action (`Ver Estoque` → `/consultant/clinics/{tenantId}/inventory`) — precisa de um segundo (`Ver Projeções`).

### 1.2 Problema identificado

O sistema hoje só informa "o estoque **já está** baixo" (UC-15/UC-42). Não existe nenhuma resposta para "**quando** este produto vai faltar", que é justamente a promessa feita na landing page (Módulo 03 "Investimentos & ROI" — "Projeção de necessidade de reposição"; Módulo 05 — "Sugestão de reposição calculada pelo sistema", parcialmente) e hoje não cumprida pelo sistema real — gap já mapeado e aprovado como UC-52 na Seção 7.1 de `_MAPA-DE-BUGS-E-MELHORIAS.md`.

### 1.3 Motivação estratégica

Fechar um dos 3 gaps landing-vs-sistema já priorizados nessa leva (UC-51/UC-52/UC-53), entregando valor tanto para a clínica (planejamento de compra) quanto para o Consultor Rennova (visibilidade proativa das clínicas vinculadas, reforçando o vínculo comercial).

---

## 2. Objetivos

1. Calcular, por `codigo_produto` ativo de um tenant, a data estimada de esgotamento de estoque a partir da taxa de consumo histórico real (`Solicitacao concluida`).
2. Expor essa projeção em uma nova tela "Projeções Gerais" (`/clinic/inventory/projections` e `/consultant/clinics/{tenantId}/projections`).
3. Expor um resumo (contagem de produtos com projeção nos próximos 30 dias) em um novo card no Dashboard da clínica e no Dashboard do Consultor.
4. Garantir que produtos com dados insuficientes de consumo nunca exibam uma data inventada — sempre marcados explicitamente como "Dados insuficientes".
5. Garantir que o Consultor Rennova vinculado veja exatamente a mesma informação completa que a clínica veria, sem versão resumida.
6. Não introduzir nenhuma Cloud Scheduled Function, API route ou mudança de `firestore.rules`/índices — cálculo 100% client-side, sob demanda.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Sistema calcula, sob demanda (ao carregar a tela), a projeção de esgotamento para cada `codigo_produto` ativo do tenant | clinic_admin / clinic_user / Consultor | Must |
| RF-02 | Sistema exibe card "Projeção de Reposição" em `/clinic/dashboard` com a contagem de produtos cuja data estimada cai nos próximos 30 dias e um link para a tela detalhada | clinic_admin / clinic_user | Must |
| RF-03 | Sistema exibe card "Projeção de Reposição" em `/consultant/dashboard`, agregando a contagem de produtos em risco de todas as clínicas vinculadas ativas | Consultor | Must |
| RF-04 | Sistema exibe a tela "Projeções Gerais" com tabela: código, nome, quantidade total disponível, taxa de consumo diária, data estimada de esgotamento (ordenada da mais próxima para a mais distante) e a janela de histórico usada em cada linha | clinic_admin / clinic_user | Must |
| RF-05 | Sistema expõe a mesma tela de projeções para o Consultor, filtrada para a clínica vinculada acessada, com o mesmo nível de detalhe (RN-09) | Consultor | Must |
| RF-06 | Sistema marca explicitamente como "Dados insuficientes para projeção" qualquer produto cuja nenhuma das 3 janelas (90/60/30 dias) atinja o critério de suficiência — nunca exibe uma data inventada | clinic_admin / clinic_user / Consultor | Must |
| RF-07 | Sistema exibe, de forma sempre visível, um aviso de que a projeção é uma estimativa baseada em histórico, indicando a janela usada | clinic_admin / clinic_user / Consultor | Must |
| RF-08 | Sistema adiciona pontos de entrada de navegação reais para "Projeções Gerais": botão em `InventoryView` (clínica e Consultor) e Quick Action na tela de detalhe da clínica do Consultor (`/consultant/clinics/{tenantId}`) | clinic_admin / clinic_user / Consultor | Must |
| RF-09 | Sistema exibe erro visível (toast) e permite nova tentativa se a leitura de `inventory` ou `solicitacoes` falhar, sem exibir dado parcial como se fosse válido | clinic_admin / clinic_user / Consultor | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Nenhuma API route dedicada nem Cloud Scheduled Function nova — cálculo 100% client-side a partir de `inventory` e `solicitacoes`, reaproveitando as regras e índices já existentes do Firestore | Arquitetura |
| RNF-02 | O card do Dashboard do Consultor precisa calcular a projeção para cada clínica vinculada ativa (N tenants), exigindo N leituras de `inventory` + N leituras de `solicitacoes` a cada carregamento, sem cache. Aceito como MVP (mesmo precedente de UC-47, RNF-02); otimização (cache, agregação server-side) fica para uma iteração futura se necessário | Desempenho / Escalabilidade |
| RNF-03 | Multi-tenant e isolamento por clínica garantidos inteiramente pela regra genérica já existente do Firestore (RN-08) — nenhuma superfície nova de risco de vazamento entre tenants | Multi-tenant / Segurança |
| RNF-04 | Toda falha de cálculo (leitura de `inventory`/`solicitacoes`) deve ser comunicada via `toast` (`useToast`, `@/hooks/use-toast`) — nunca falha silenciosa (`console.error` sem aviso ao ator) | Usabilidade / Consistência |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | Taxa de consumo diária = soma de `quantidade` de `ProdutoSolicitado` (dentro de `Solicitacao` com `status == 'concluida'`) que contenham aquele `produto_codigo`, dentro da janela usada, dividida pelo número de dias da janela | UC-52 RN-01; mesma fonte de dado de `generateConsumptionReport` (UC-47) |
| RN-02 | Data estimada de esgotamento = hoje + ceil(quantidade_disponivel_total ÷ taxa_consumo_diária). Se a taxa calculada for zero, nenhuma data é projetada (cai em RN-03/dados insuficientes) | UC-52 RN-02 |
| RN-03 | Critério de "dados suficientes" por janela: pelo menos `MIN_DISTINCT_CONSUMPTION_DATES = 2` `Solicitacao` distintas com `status == 'concluida'`, envolvendo o mesmo `produto_codigo`, em datas de calendário diferentes, dentro da janela avaliada (cascata **30→60→90 dias**, mais recente primeiro — ver correção na Seção 14, item 3). Sem dado suficiente em nenhuma das 3 janelas, o produto fica sem projeção (RF-06/7a) — nunca quebra a tela | UC-52 RN-03 v1.1; critério de suficiência (2 datas) confirmado pelo usuário em 22/09/2026 exatamente como proposto (Seção 14, item 1); ordem da cascata corrigida em 22/09/2026 durante a implementação (Seção 14, item 3) |
| RN-04 | Toda data estimada exibida (card ou tela) deve indicar visivelmente a janela usada (90/60/30) e o caráter estimado — nunca como fato garantido | UC-52 RN-04 |
| RN-05 | Projeção calculada por `codigo_produto` agregado, somando todos os lotes ativos — mesma convenção de `stock_limits` (UC-15) e `checkLowStock` (`alertTriggers.ts`) | UC-52 RN-05 |
| RN-06 | Evento-alvo é a data em que `quantidade_disponivel` total chega a zero — não a data de cruzar `limite_estoque_baixo` (UC-15). Os dois mecanismos são independentes | UC-52 RN-06 |
| RN-07 | Cálculo 100% client-side, sob demanda, disparado pelo carregamento da tela — sem Cloud Scheduled Function nova, sem persistência do resultado | UC-52 RN-07 |
| RN-08 | Extensão de leitura do Consultor a `solicitacoes` não exige mudança em `firestore.rules` — confirmado por leitura literal do arquivo (regra genérica de subcoleção já cobre) | UC-52 RN-08 |
| RN-09 | Consultor vê a mesma visão completa que a clínica veria (produto, quantidade, taxa, data, janela) — não uma versão resumida | UC-52 RN-09 |
| RN-10 | Fora de escopo desta versão: sugestão de quantidade a pedir | UC-52 RN-10 |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

- **Módulo de cálculo 100% puro** em `src/lib/services/projectionService.ts`: todas as funções de cálculo (seleção de janela em cascata, taxa de consumo, data estimada) recebem dados já carregados (arrays de eventos de consumo, `Date` de "hoje" como parâmetro explícito) e não tocam Firestore — mesmo padrão de `src/lib/inventoryUtils.ts` (`computeInventoryStats` recebe `cutoffDate` como parâmetro, não usa `new Date()` internamente), o que torna as funções 100% testáveis sem mocks. Uma única função orquestradora assíncrona (`getReplenishmentProjections`) faz a leitura real do Firestore e delega o cálculo às funções puras — mesmo padrão de separação já usado implicitamente em `reportService.ts` (embora lá tudo esteja numa função só; aqui a extração é deliberada para habilitar teste unitário de alta prioridade, conforme CLAUDE.md item 8).
- **Componente de tela único reaproveitado** (`ProjectionsView.tsx`), no mesmo espírito de `InventoryView.tsx`, usado tanto por `/clinic/inventory/projections` quanto por `/consultant/clinics/{tenantId}/projections` — evita duas implementações divergentes da mesma tabela (RN-09 exige que sejam idênticas).
- **Novo prop `onViewProjections`** em `InventoryView.tsx`, no mesmo padrão de `onAddProducts` — mas, diferente de `onAddProducts` (restrito a `isAdmin`), visível para qualquer usuário com acesso à tela (clinic_admin, clinic_user e Consultor, conforme Seção 2.1 do UC-52, que dá o mesmo acesso a `clinic_user`).
- **Card do Dashboard do Consultor navega para `/consultant/clinics`** (lista de clínicas vinculadas já existente), em vez de linkar para uma clínica específica ou para uma tela agregada nova — decisão confirmada pelo usuário (Seção 14, item 2), evitando expandir o escopo de UI do UC-52 sem passar antes pelo `uml-use-case-writer`.

### 4.2 Alternativas descartadas

- **Persistir a projeção calculada em uma subcoleção** (ex. `tenants/{tenantId}/projections`): descartada porque RN-07 exige explicitamente "sem persistência do resultado calculado — recalculado do zero a cada carregamento", mesma decisão já tomada para UC-15/UC-42/UC-47.
- **Criar uma tela agregada "Todas as Clínicas" no Portal do Consultor**: cogitada como possível destino do card do Dashboard do Consultor (opção (d) apresentada ao usuário), mas descartada — o usuário confirmou a opção (a), card linkando para `/consultant/clinics` (Seção 14). Criar uma tela agregada nova expandiria o escopo de UI do UC-52 além do que ele fecha hoje, exigindo primeiro uma atualização do UC pelo `uml-use-case-writer`.

### 4.3 Trade-offs aceitos

- RNF-02 aceita explicitamente que o card do Dashboard do Consultor seja O(N tenants) sem cache — mais simples de implementar agora, ao custo de possível lentidão para consultores com muitas clínicas vinculadas (mesmo trade-off já aceito em UC-47 RNF-02).
- O critério de suficiência de dados (RN-03) é implementado como constante nomeada e exportada (`MIN_DISTINCT_CONSUMPTION_DATES = 2`), confirmada pelo usuário exatamente como proposta pelo UC-52 — facilmente ajustável no futuro caso a heurística se mostre inadequada em produção, sem precisar reescrever a lógica de seleção de janela.
- A ordem de avaliação da cascata é **30→60→90 dias** (mais estreita primeiro), não 90→60→30 como a v1.0/v1.1 deste documento e o UC-52 v1.0 originalmente descreviam — corrigido em 22/09/2026 durante a implementação (Seção 14, item 3). Como todas as janelas terminam em "hoje", uma janela mais estreita é sempre um subconjunto de uma mais larga; avaliar da mais larga primeiro tornaria o fallback para janelas menores matematicamente inalcançável.
- O card do Dashboard do Consultor não leva diretamente à clínica com a projeção mais urgente (opção (b), descartada) — o Consultor precisa de um clique adicional em `/consultant/clinics` para escolher a clínica. Trade-off aceito em troca de não expandir o escopo do UC-52 nesta versão (opção (d), também descartada).

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `src/lib/services/projectionService.ts` | Serviço | Funções puras de cálculo (RN-01 a RN-06) + orquestrador `getReplenishmentProjections(tenantId)` que lê Firestore |
| `src/__tests__/projectionService.test.ts` | Teste unitário | Cobertura das funções puras (prioridade alta, ver Seção 8) |
| `src/components/inventory/ProjectionsView.tsx` | Componente UI | Tabela "Projeções Gerais", reaproveitada por clínica e Consultor |
| `src/app/(clinic)/clinic/inventory/projections/page.tsx` | Página | Rota `/clinic/inventory/projections` |
| `src/app/(consultant)/consultant/clinics/[tenantId]/projections/page.tsx` | Página | Rota `/consultant/clinics/{tenantId}/projections`, com guard de `authorizedTenants` (mesmo padrão de `inventory/page.tsx` do Consultor) |
| `tests/e2e/UC-52-consultar-projecao-de-reposicao-de-estoque.spec.ts` | Teste E2E | Gerado pelo `qa-agent` a partir deste documento (Step 9) — revisão humana obrigatória antes de virar gate de CI (CLAUDE.md item 8) |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/components/inventory/InventoryView.tsx` | Novo prop opcional `onViewProjections?: () => void`; novo botão "Ver Projeções" ao lado de "Exportar Excel", visível sempre que o prop for passado (sem restrição `isAdmin`) |
| `src/app/(clinic)/clinic/inventory/page.tsx` | Passa `onViewProjections={() => router.push('/clinic/inventory/projections')}` para `InventoryView` |
| `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx` | Passa `onViewProjections={() => router.push('/consultant/clinics/${tenantId}/projections')}` para `InventoryView` |
| `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx` | Novo segundo Quick Action "Ver Projeções" ao lado de "Ver Estoque" |
| `src/app/(clinic)/clinic/dashboard/page.tsx` | Novo card "Projeção de Reposição" (RF-02), carregado via `getReplenishmentProjections(tenantId)` |
| `src/app/(consultant)/consultant/dashboard/page.tsx` | Novo card "Projeção de Reposição" agregando clínicas vinculadas ativas (RF-03), com clique navegando para `/consultant/clinics` (decisão confirmada, Seção 14) |

### 5.3 Arquivos a REMOVER

N/A — feature aditiva, nada é removido.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `tenants/{tenantId}/inventory` | Leitura (nenhuma mudança) | `where('active', '==', true)`, mesma query já usada por `InventoryView`/`reportService` |
| `tenants/{tenantId}/solicitacoes` | Leitura (nenhuma mudança) | `where('status', '==', 'concluida')` + `where('dt_procedimento', '>=', <90 dias atrás>)` — coberta pelo índice composto já existente (`status ASC + dt_procedimento ASC`, `firestore.indexes.json` linhas 110-121). Nenhum índice novo necessário |
| `firestore.rules` | Nenhuma mudança | RN-08 confirmado por leitura literal do arquivo — regra genérica de subcoleção já cobre a leitura do Consultor |

### 5.5 O que NÃO muda

- `firestore.rules` e `firestore.indexes.json` — nenhuma linha alterada.
- `src/lib/services/alertTriggers.ts` (UC-15/UC-42) — mecanismo de "estoque já baixo" permanece intacto e independente (RN-06).
- `src/lib/services/reportService.ts` — reaproveitado como referência de convenção, não alterado.
- `src/lib/services/inventoryService.ts`, `src/lib/inventoryUtils.ts` — não alterados; `agruparProdutosPorCodigo`/`getStatusEstoque` continuam servindo exclusivamente à tela de inventário.
- Nenhuma API route nova ou alterada (RNF-01).
- Nenhuma Cloud Scheduled Function nova (RN-07).

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

Novas interfaces, todas locais a `src/lib/services/projectionService.ts` (mesmo padrão de `reportService.ts`, que define `StockValueReport`/`ExpirationReport`/`ConsumptionReport` localmente em vez de em `src/types/index.ts`):

```ts
// Antes: não existe.

// Depois:
// Ordem 30→60→90 (mais estreita/recente primeiro) — corrigido em 22/09/2026
// durante a implementação. Ver Seção 14, item 3.
export const HISTORY_WINDOWS_DAYS = [30, 60, 90] as const;
export type HistoryWindowDays = (typeof HISTORY_WINDOWS_DAYS)[number];

// Critério de suficiência de dados (RN-03), confirmado pelo usuário em 22/09/2026 — ver Seção 14.
export const MIN_DISTINCT_CONSUMPTION_DATES = 2;

export interface ConsumptionEvent {
  quantidade: number;
  dt_procedimento: Date;
}

export interface ProductProjectionInput {
  codigo_produto: string;
  nome_produto: string;
  quantidade_disponivel_total: number;
  eventosConsumo: ConsumptionEvent[];
}

export interface ProductProjection {
  codigo_produto: string;
  nome_produto: string;
  quantidade_disponivel_total: number;
  taxa_consumo_diaria: number | null; // null quando dados_insuficientes
  data_estimada_esgotamento: Date | null; // null quando dados_insuficientes
  janela_usada_dias: HistoryWindowDays | null; // null quando dados_insuficientes
  dados_insuficientes: boolean;
}
```

Nenhuma interface existente (`InventoryItem`, `Solicitacao`, `ProdutoSolicitado` em `src/types/index.ts`) é alterada — a leitura Firestore usa `docSnap.data()` bruto e monta `ConsumptionEvent`/agregados manualmente, mesmo padrão já usado em `reportService.ts` (que também não tipa fortemente os `snapshot.forEach` com as interfaces de `@/types`).

### 6.2 Mudanças em serviços

Todas as assinaturas abaixo são **novas** (arquivo novo):

```ts
// Funções puras — prioridade alta de teste (CLAUDE.md item 8)
export function isWindowDataSufficient(events: ConsumptionEvent[]): boolean;

export function filterEventsWithinWindow(
  events: ConsumptionEvent[],
  today: Date,
  windowDays: number
): ConsumptionEvent[];

export function calculateDailyConsumptionRate(
  events: ConsumptionEvent[],
  windowDays: number
): number;

export interface WindowSelectionResult {
  windowDays: HistoryWindowDays;
  taxaConsumoDiaria: number;
}

export function selectConsumptionWindow(
  allEvents: ConsumptionEvent[],
  today: Date
): WindowSelectionResult | null; // null = nenhuma janela suficiente (RN-03/7a)

export function calculateEstimatedDepletionDate(
  quantidadeDisponivelTotal: number,
  taxaConsumoDiaria: number,
  today: Date
): Date | null; // null se taxaConsumoDiaria <= 0 (RN-02)

export function calculateProductProjection(
  input: ProductProjectionInput,
  today: Date
): ProductProjection;

export function countProjectionsWithinHorizon(
  projections: ProductProjection[],
  today: Date,
  horizonDays?: number // default 30
): number; // usado pelos cards de Dashboard (RF-02/RF-03)

// Orquestrador — não testado unitariamente (mesmo precedente de reportService.ts,
// que também não tem teste dedicado; lógica de negócio já coberta pelas funções puras acima)
export async function getReplenishmentProjections(tenantId: string): Promise<ProductProjection[]>;
```

Lógica de `calculateProductProjection`: chama `selectConsumptionWindow`; se `null`, retorna projeção com `dados_insuficientes: true` e os três campos calculados como `null` (RF-06/7a); senão, calcula `calculateEstimatedDepletionDate` e retorna a projeção completa.

Lógica de `getReplenishmentProjections`: lê `inventory` (`active == true`) agregando `quantidade_disponivel` por `codigo_produto` (RN-05); lê `solicitacoes` (`status == 'concluida'`, `dt_procedimento >= hoje - 90 dias` — a maior janela da cascata) agrupando `quantidade` de `produtos_solicitados` por `produto_codigo`; para cada `codigo_produto` presente no inventário, chama `calculateProductProjection`; ordena o resultado por `data_estimada_esgotamento` ascendente (produtos com `null` por último).

### 6.3 Mudanças na UI

**`InventoryView.tsx`** (estado atual → novo): hoje o header tem "Adicionar Produtos" (só `isAdmin`) + "Exportar Excel". Passa a ter, entre os dois, um botão condicional "Ver Projeções" (ícone `TrendingDown` ou `Calendar`, `lucide-react`), renderizado sempre que `onViewProjections` for passado — sem checar `isAdmin`, pois `clinic_user` e Consultor também devem ver (Seção 2.1 do UC-52).

**`/clinic/inventory/projections` e `/consultant/clinics/{tenantId}/projections`** (novas telas): ambas renderizam `<ProjectionsView tenantId={tenantId} backUrl={...} />`. A versão do Consultor replica o guard já existente em `inventory/page.tsx` (`if (claims && !authorizedTenants.includes(tenantId)) router.push('/consultant/clinics')` — Fluxo Alternativo 7c).

**`ProjectionsView.tsx`** (novo componente): ao montar, chama `getReplenishmentProjections(tenantId)`; enquanto carrega, skeleton; em erro, `toast` (RNF-04) + estado de erro com botão "Tentar novamente"; tabela com colunas Código | Produto | Qtd. Disponível | Taxa de Consumo Diária | Data Estimada | Janela Usada, ordenada por data mais próxima; produtos com `dados_insuficientes: true` exibem "Dados insuficientes para projeção" na coluna de data, sem ordenação relevante (ficam ao final); aviso fixo no topo da tabela (RN-04/RF-07): "Estimativa baseada no histórico de consumo real — não é uma garantia."

**`/clinic/dashboard`** (estado atual → novo): hoje tem 3 cards na primeira linha (Estoque, Procedimentos, Alertas). Passa a ter um 4º card "Projeção de Reposição" (não entra na mesma grid de 3 colunas — para não redimensionar os 3 cards existentes sem necessidade, é adicionado como um card independente logo abaixo dessa linha, antes da seção "Próximos Procedimentos"/"Atividade Recente"). Estados: carregando (skeleton); com produtos em risco (contagem + botão "Ver Projeções" → `/clinic/inventory/projections`); sem produtos em risco (Fluxo Alternativo 7b: "Nenhum produto com previsão de reposição próxima", sem contagem em destaque); erro (toast, RNF-04).

**`/consultant/dashboard`** (estado atual → novo): hoje tem 2 cards (Clínicas Vinculadas, Buscar Clínicas) + "Minhas Clínicas". Passa a ter um 3º card "Projeção de Reposição" agregando a contagem de produtos em risco somada de todas as `clinics.filter(c => c.active)`; o clique no card navega para `/consultant/clinics` (opção (a) confirmada pelo usuário — Seção 14), deixando o Consultor escolher manualmente qual clínica vinculada investigar em detalhe, já que não existe uma tela agregada de projeções de todas as clínicas nesta versão.

### 6.4 Mudanças em API Routes

N/A — nenhuma rota nova ou alterada (RNF-01). Toda leitura é direta via Firestore client SDK, protegida pelas regras já existentes (RN-08).

---

## 7. Plano de Implementação

### STEP 1 — Funções puras de cálculo de projeção

**Objetivo:** Implementar RN-01 a RN-06 como funções puras testáveis, sem tocar Firestore.

**Arquivos afetados:**
- `src/lib/services/projectionService.ts` — criar com as interfaces e funções da Seção 6.1/6.2 (exceto `getReplenishmentProjections`)

**Ações:**
1. Definir `HISTORY_WINDOWS_DAYS`, `MIN_DISTINCT_CONSUMPTION_DATES = 2` (RN-03, confirmado — Seção 14), `ConsumptionEvent`, `ProductProjectionInput`, `ProductProjection`.
2. Implementar `isWindowDataSufficient`, `filterEventsWithinWindow`, `calculateDailyConsumptionRate`, `selectConsumptionWindow`, `calculateEstimatedDepletionDate`, `calculateProductProjection`, `countProjectionsWithinHorizon`.

**Validação:** `npm run type-check` sem erros; funções exportadas e importáveis por outro arquivo.

**Commit:** `feat(inventory): add pure replenishment projection calculation functions`

---

### STEP 2 — Testes unitários das funções puras

**Objetivo:** Cobrir RN-01 a RN-06 com testes determinísticos (prioridade alta, CLAUDE.md item 8).

**Arquivos afetados:**
- `src/__tests__/projectionService.test.ts` — criar, seguindo o padrão de `src/__tests__/inventoryUtils.test.ts` (fixtures simples, sem mock de Firestore)

**Ações:**
1. `isWindowDataSufficient`: datas distintas suficientes → `true`; mesma data repetida → `false`; array vazio → `false`.
2. `filterEventsWithinWindow`: evento dentro da janela incluído; fora da janela excluído; evento exatamente no limite incluído.
3. `calculateDailyConsumptionRate`: soma correta ÷ dias; array vazio → 0.
4. `selectConsumptionWindow`: cascata **30→60→90** — janela de 30 dias insuficiente mas 60 suficiente retorna 60; 30 e 60 insuficientes mas 90 suficiente retorna 90; nenhuma janela suficiente retorna `null`; 30 dias já suficiente não avalia 60/90 (a primeira janela suficiente vence, mesmo que uma janela mais larga desse uma taxa diferente).
5. `calculateEstimatedDepletionDate`: taxa > 0 retorna data futura correta (arredondamento para cima, RN-02); taxa == 0 retorna `null`; taxa negativa (não deveria ocorrer, mas testar defensivamente) retorna `null`.
6. `calculateProductProjection`: caso com dados suficientes retorna projeção completa; caso sem dados suficientes retorna `dados_insuficientes: true` com os 3 campos `null` (RF-06).
7. `countProjectionsWithinHorizon`: produto dentro do horizonte contado; fora do horizonte não contado; `data_estimada_esgotamento: null` nunca contado; horizonte customizado respeitado.

**Validação:** `npm run test -- projectionService` com 100% dos cenários acima passando.

**Commit:** `test(inventory): add unit tests for replenishment projection functions`

---

### STEP 3 — Orquestrador de leitura Firestore

**Objetivo:** Implementar `getReplenishmentProjections(tenantId)` lendo `inventory` + `solicitacoes` e delegando às funções puras.

**Arquivos afetados:**
- `src/lib/services/projectionService.ts` — adicionar `getReplenishmentProjections`

**Ações:**
1. Query `inventory`: `where('active', '==', true)`; agregar `quantidade_disponivel` por `codigo_produto` (RN-05), preservando `nome_produto`.
2. Query `solicitacoes`: `where('status', '==', 'concluida')` + `where('dt_procedimento', '>=', Timestamp.fromDate(hoje - 90 dias))`; agrupar `produtos_solicitados[].quantidade` por `produto_codigo`, convertendo `dt_procedimento` (Timestamp) para `Date`.
3. Para cada `codigo_produto` do inventário, montar `ProductProjectionInput` e chamar `calculateProductProjection(input, today)`.
4. Ordenar resultado (mais próximo primeiro, `null` por último).
5. Envolver tudo em `try/catch` relançando erro tratável pela UI (RNF-04) — mesmo padrão de `try { ... } catch (error) { console.error(...); throw new Error(...); }` de `reportService.ts`.

**Validação:** Testar manualmente contra o Firebase Emulator com dados seedados (`scripts/seed-emulator.ts`, se aplicável) ou contra o ambiente `gscandelari_setup`; conferir que a contagem/datas batem com um cálculo manual de conferência para ao menos 2 produtos.

**Commit:** `feat(inventory): add firestore loader for replenishment projections`

---

### STEP 4 — Componente `ProjectionsView`

**Objetivo:** Tabela reaproveitável de "Projeções Gerais" (RF-04/RF-05/RF-06/RF-07).

**Arquivos afetados:**
- `src/components/inventory/ProjectionsView.tsx` — criar

**Ações:**
1. Props: `{ tenantId: string; backUrl?: string }`.
2. Ao montar, chamar `getReplenishmentProjections(tenantId)`; estados de loading/erro (toast via `useToast`, RNF-04)/dados.
3. Renderizar tabela com as colunas da Seção 6.3; linha com "Dados insuficientes para projeção" quando `dados_insuficientes`.
4. Aviso fixo (RN-04/RF-07) sempre visível no topo da tabela.
5. Se `backUrl` informado, botão "Voltar" no topo (mesmo padrão de `InventoryView`/`audit/page.tsx`).

**Validação:** Renderizar manualmente com dados mockados (produto com dados suficientes, produto com dados insuficientes, tenant sem nenhum produto) e conferir os 3 estados visualmente.

**Commit:** `feat(inventory): add ProjectionsView table component`

---

### STEP 5 — Tela e entrada de navegação para a clínica

**Objetivo:** Expor `/clinic/inventory/projections` com ponto de entrada real a partir de "Gerenciar Estoque" (RF-08).

**Arquivos afetados:**
- `src/app/(clinic)/clinic/inventory/projections/page.tsx` — criar
- `src/components/inventory/InventoryView.tsx` — adicionar prop `onViewProjections` e botão
- `src/app/(clinic)/clinic/inventory/page.tsx` — passar `onViewProjections`

**Ações:**
1. Nova página lê `tenantId` de `claims.tenant_id` (mesmo padrão de `inventory/page.tsx`) e renderiza `<ProjectionsView tenantId={tenantId} backUrl="/clinic/inventory" />`.
2. Em `InventoryView.tsx`, adicionar botão "Ver Projeções" ao lado de "Exportar Excel", visível sempre que `onViewProjections` for passado.
3. Em `clinic/inventory/page.tsx`, passar `onViewProjections={() => router.push('/clinic/inventory/projections')}`.

**Validação:** Navegar `/clinic/inventory` → clicar "Ver Projeções" → chegar em `/clinic/inventory/projections` → "Voltar" retorna a `/clinic/inventory`.

**Commit:** `feat(inventory): add projections page and entry point for clinic`

---

### STEP 6 — Tela e entradas de navegação para o Consultor

**Objetivo:** Expor `/consultant/clinics/{tenantId}/projections` com os dois pontos de entrada previstos (RF-08, Fluxo Principal passo 5 e Fluxo Alternativo 7c).

**Arquivos afetados:**
- `src/app/(consultant)/consultant/clinics/[tenantId]/projections/page.tsx` — criar
- `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx` — passar `onViewProjections`
- `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx` — novo Quick Action "Ver Projeções"

**Ações:**
1. Nova página replica o guard de `inventory/page.tsx` do Consultor (`authorizedTenants.includes(tenantId)`, redirect para `/consultant/clinics` se não autorizado — Fluxo Alternativo 7c) e renderiza `<ProjectionsView tenantId={tenantId} backUrl={`/consultant/clinics/${tenantId}`} />`.
2. Em `consultant/clinics/[tenantId]/inventory/page.tsx`, passar `onViewProjections={() => router.push('/consultant/clinics/${tenantId}/projections')}` ao `InventoryView`.
3. Em `consultant/clinics/[tenantId]/page.tsx`, adicionar um segundo botão de Quick Action "Ver Projeções" ao lado de "Ver Estoque", navegando para `/consultant/clinics/{tenantId}/projections`.

**Validação:** Logado como Consultor vinculado a uma clínica, acessar `/consultant/clinics/{tenantId}` → clicar "Ver Projeções" → chegar na tabela completa (RN-09: mesma informação que a clínica veria); tentar acessar `/consultant/clinics/{outroTenantIdNaoAutorizado}/projections` diretamente pela URL → redirecionado para `/consultant/clinics`.

**Commit:** `feat(inventory): add projections page and entry points for consultant portal`

---

### STEP 7 — Card no Dashboard da clínica

**Objetivo:** RF-02 / Fluxo Principal passos 2-4 / Fluxo Alternativo 7b.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/dashboard/page.tsx` — novo estado + novo card

**Ações:**
1. Novo estado `projections: ProductProjection[] | null`; carregar via `getReplenishmentProjections(tenantId)`, separado do `Promise.all` existente (para não acoplar a falha desta feature nova às demais seções do Dashboard) e reportando erro via `toast` (RNF-04), não via o `setError` genérico existente.
2. Calcular contagem com `countProjectionsWithinHorizon(projections, new Date(), 30)`.
3. Renderizar card "Projeção de Reposição": contagem + botão "Ver Projeções" (`router.push('/clinic/inventory/projections')`) quando `count > 0`; estado vazio (7b) quando `count === 0` e não há erro.

**Validação:** Com um tenant de teste com produto cuja projeção cai em menos de 30 dias, o card mostra a contagem correta e o link funciona; com um tenant sem nenhuma solicitação `concluida`, o card mostra o estado vazio.

**Commit:** `feat(dashboard): add replenishment projection card to clinic dashboard`

---

### STEP 8 — Card no Dashboard do Consultor

**Objetivo:** RF-03, agregando clínicas vinculadas ativas (RNF-02).

**Arquivos afetados:**
- `src/app/(consultant)/consultant/dashboard/page.tsx` — novo estado + novo card

**Ações:**
1. Após `clinics` carregado, para cada `clinics.filter(c => c.active)`, chamar `getReplenishmentProjections(clinic.id)` via `Promise.all` (RNF-02 — aceito como MVP sem cache).
2. Somar `countProjectionsWithinHorizon(...)` de cada clínica.
3. Renderizar card "Projeção de Reposição" com a soma; clique navega para `/consultant/clinics` (opção (a) confirmada pelo usuário — Seção 14), sem tentar levar a uma clínica específica.
4. Erros de leitura de clínicas individuais não devem quebrar o card inteiro — logar/`toast` e seguir somando as demais (falha parcial tolerável, já que é um resumo).

**Validação:** Consultor com 2+ clínicas vinculadas ativas, cada uma com ao menos um produto em risco, vê a soma correta no card; clicar no card leva a `/consultant/clinics`.

**Commit:** `feat(dashboard): add replenishment projection card to consultant dashboard`

---

### STEP 9 — Caderno de teste automatizado (qa-agent)

**Objetivo:** Cumprir CLAUDE.md item 8 — toda feature nova precisa de caderno Playwright antes de ser considerada concluída.

**Ações:**
1. Acionar o agente `qa-agent` (não implementar o spec Playwright manualmente/ad-hoc) passando este documento (Seção 6/7 como referência de comportamento esperado) e o UC-52.
2. `qa-agent` gera `tests/e2e/UC-52-consultar-projecao-de-reposicao-de-estoque.spec.ts`, seguindo a convenção de nomenclatura já usada pelos specs existentes (`tests/e2e/UC-0N-*.spec.ts`).
3. **Revisão humana obrigatória** do spec gerado antes de virar gate de CI (CLAUDE.md item 8) — não confiar cegamente no teste gerado por IA.

**Validação:** `npm run test:e2e` local (Firebase Emulator) passa com o novo spec incluído; spec revisado manualmente e aprovado.

**Commit:** `test(inventory): add UC-52 Playwright spec (qa-agent, revisado)`

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-------------------|------------------------|
| `isWindowDataSufficient` | `src/__tests__/projectionService.test.ts` | Datas distintas suficientes; datas repetidas insuficientes; array vazio |
| `filterEventsWithinWindow` | idem | Evento dentro/fora/no limite exato da janela |
| `calculateDailyConsumptionRate` | idem | Soma correta; array vazio → 0 |
| `selectConsumptionWindow` | idem | Cascata 90→60→30; nenhuma janela suficiente → `null`; primeira janela suficiente vence sobre uma menor |
| `calculateEstimatedDepletionDate` | idem | Taxa > 0 (arredondamento RN-02); taxa == 0 → `null`; taxa negativa → `null` |
| `calculateProductProjection` | idem | Dados suficientes (projeção completa); dados insuficientes (`dados_insuficientes: true`, campos `null`) |
| `countProjectionsWithinHorizon` | idem | Dentro/fora do horizonte; `null` nunca contado; horizonte customizado |
| `getReplenishmentProjections` | — (não testado unitariamente) | Lógica de negócio já coberta pelas funções puras acima; leitura Firestore segue o mesmo precedente de `reportService.ts` (sem teste dedicado) |
| `ProjectionsView`, páginas, cards de Dashboard | — (não testado no MVP) | Componentes React/pages — cobertos pelo caderno Playwright (Step 9), não por teste unitário (CLAUDE.md item 8) |

Regra aplicada: funções puras de cálculo são prioridade alta de teste unitário (mesmo padrão de `computeInventoryStats`/`inventoryUtils.test.ts`); orquestrador Firestore e UI ficam cobertos pelo caderno E2E, não por unit test.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — todos os testes passando, incluindo projectionService.test.ts
[ ] Multi-tenant: todas as queries Firestore (inventory, solicitacoes) filtram por tenantId via caminho da subcoleção
[ ] Segurança: nenhum secret ou credencial no código; nenhuma mudança em firestore.rules (RN-08 confirmado)
[ ] Branch pessoal: task branch mergeada em gscandelari_setup para validação no Firebase
[ ] PR: aberto para develop com template preenchido
[ ] Card do Dashboard da clínica testado manualmente com produto em risco e com estado vazio (7b)
[ ] Card do Dashboard do Consultor testado manualmente com 2+ clínicas vinculadas ativas e clique leva a /consultant/clinics
[ ] Tela "Projeções Gerais" testada manualmente para clínica e para Consultor (mesma informação, RN-09)
[ ] Acesso do Consultor a tenant não autorizado bloqueado (redirect, Fluxo Alternativo 7c) — testado manualmente
[ ] Caderno Playwright (tests/e2e/UC-52-*.spec.ts) gerado pelo qa-agent e revisado por humano antes de virar gate de CI
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Critério de suficiência de dados (RN-03) se mostrar inadequado em produção mesmo após confirmação | Baixa | Médio | Constante `MIN_DISTINCT_CONSUMPTION_DATES` nomeada e isolada — ajuste pontual, sem reescrever lógica |
| Dashboard do Consultor lento com muitas clínicas vinculadas (RNF-02) | Média | Médio | Aceito como MVP; se virar problema real, otimizar com cache/agregação server-side em iteração futura |
| Falha parcial de uma clínica quebrar o card agregado do Consultor | Baixa | Médio | Step 8 trata falha por-clínica isoladamente, sem interromper a soma das demais |
| Confusão do usuário entre este card e o alerta de "estoque baixo" já existente (UC-15/UC-42) | Média | Baixo | RN-04/RF-07 exigem aviso visível explicando a natureza estimada; nomenclatura distinta ("Projeção de Reposição" vs. "Estoque baixo") |
| Caderno Playwright gerado pelo qa-agent não cobrir os 2 fluxos alternativos (7a/7b/7c) | Média | Médio | Revisão humana obrigatória do spec antes de virar gate de CI (Step 9) |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Janela de histórico | Período retroativo (90, 60 ou 30 dias) usado para calcular a taxa de consumo diária de um produto |
| Cascata de janelas | Estratégia de tentar 30 dias primeiro, depois 60, depois 90, ampliando a janela apenas quando os dados mais recentes forem insuficientes (RN-03) |
| Taxa de consumo diária | Quantidade total consumida (solicitações concluídas) dividida pelo número de dias da janela usada |
| Data estimada de esgotamento | Data projetada em que `quantidade_disponivel` total de um produto chegaria a zero, dada a taxa de consumo diária (RN-02) |
| Horizonte de destaque | Janela de 30 dias à frente usada para decidir quais produtos entram na contagem resumo dos cards de Dashboard |
| Dados insuficientes | Estado de um produto cuja nenhuma das 3 janelas atinge o critério de suficiência — nunca recebe uma data projetada (RF-06) |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/UC-52-consultar-projecao-de-reposicao-de-estoque.md` (v1.1, Aprovado) — UC de origem
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 7.1) — reserva original do UC-52
- `CLAUDE.md` (item 8) — obrigatoriedade de caderno de teste Playwright para toda feature
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Git Flow, Conventional Commits, fluxo de PR
- `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md` (v2.0, Aprovado) — arquitetura do `qa-agent`/Playwright/Emulator
- `src/lib/services/reportService.ts` (`generateConsumptionReport`) — fonte de dado de consumo reaproveitada (RN-01)
- `src/lib/services/alertTriggers.ts` (`checkLowStock`, `runAllChecks`) — mecanismo irmão de "estoque já baixo" (RN-06), confirma ausência de cron ativo (RN-07)
- `src/lib/inventoryUtils.ts` / `src/__tests__/inventoryUtils.test.ts` — convenção de agregação por `codigo_produto` (RN-05) e padrão de teste unitário de função pura seguido por este documento
- `src/components/inventory/InventoryView.tsx` — componente reaproveitado clínica/Consultor, base do novo botão "Ver Projeções"
- `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx` — padrão de guard de acesso do Consultor (`authorizedTenants`) replicado na nova tela de projeções
- `firestore.rules` (linhas 58-67) — base da confirmação de RN-08 (nenhuma mudança de regra necessária)
- `firestore.indexes.json` (linhas 110-121) — índice composto `solicitacoes` já existente, reaproveitado sem alteração

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 22/09/2026 | Doc Writer (Claude) | Versão inicial. Spec de implementação derivada do UC-52 (v1.0, Aprovado). Investigado o código real (`reportService.ts`, `alertTriggers.ts`, `inventoryUtils.ts`, `InventoryView.tsx`, páginas de Dashboard e do Portal do Consultor, `firestore.rules`, `firestore.indexes.json`) para confirmar que nenhuma mudança de regra/índice é necessária e para desenhar o módulo de cálculo puro (`projectionService.ts`) e a reutilização de componentes (`ProjectionsView.tsx` espelhando `InventoryView.tsx`). Duas pendências marcadas como `⚠️ Decisão necessária` e documento mantido em Status "Aguardando decisão": (1) critério exato de suficiência de dados herdado como pendência técnica não bloqueante do próprio UC-52 (RN-03/Seção 14); (2) destino do clique no card agregado do Dashboard do Consultor, já que o UC-52 não descreve nenhuma tela "todas as clínicas" de projeções. |
| 1.1 | 22/09/2026 | Doc Writer (Claude), decisões respondidas pelo usuário (Guilherme Scandelari) | Resolvidas as 2 pendências da v1.0. (1) RN-03 confirmado exatamente como proposto: critério de suficiência = ≥2 `Solicitacao concluida` em datas de calendário distintas, dentro da janela avaliada; sem dado suficiente, o produto fica sem projeção, sem quebrar a tela — `MIN_DISTINCT_CONSUMPTION_DATES = 2` deixa de ser "provisório" e passa a ser valor definitivo (Seções 3.3, 4.3, 6.1, Step 1). (2) Destino do card do Dashboard do Consultor confirmado como opção (a): navega para `/consultant/clinics` (lista existente), Consultor escolhe manualmente a clínica — opções (b)/(c)/(d) descartadas e registradas na Seção 4.2 (Seções 4.1, 5.2, 6.3, Step 8). `**Status:**` alterado de "Aguardando decisão" para "Planejamento" — documento pronto para o `dev-task-manager`. |
| 1.2 | 22/09/2026 | Implementação (Claude), correção confirmada pelo usuário (Guilherme Scandelari) durante o Step 2 | Corrigida a ordem de avaliação da cascata de RN-03: de 90→60→30 para **30→60→90 dias** (mais estreita/recente primeiro). Motivo: como todas as janelas terminam em "hoje", uma janela mais estreita é sempre um subconjunto de uma mais larga (30⊆60⊆90) — avaliando 90 primeiro, o fallback para 60/30 era matematicamente inalcançável (suficiência em janela menor sempre implica suficiência na maior que a contém), tornando o resultado sempre "90 dias ou dados insuficientes" e contradizendo a intenção documentada da cascata. Descoberto ao escrever os testes unitários de `selectConsumptionWindow` (Step 2); usuário confirmou a inversão de ordem como correção (ver Seção 14, item 3). Critério de suficiência em si (2 datas distintas) não mudou. UC-52 corrigido em paralelo pelo `uml-use-case-writer` (v1.0→v1.1). `**Status:**` alterado para "Em execução" — implementação em andamento na branch `feat/uc52-projecao-reposicao-estoque` (commits `06017e8` a `cd4b125` já refletem a correção). |

---

## 14. Decisões Registradas (Resolvidas em 22/09/2026)

As duas pendências abaixo foram levantadas na v1.0 deste documento como `⚠️ Decisão necessária` (bloqueantes para implementação, diferente da Seção 14 do UC-52, que as havia marcado como não-bloqueantes apenas para a **aprovação do UC**). Ambas foram respondidas explicitamente pelo usuário e incorporadas ao restante do documento (ver Seção 13, v1.1) — mantidas aqui apenas como registro de rastreabilidade.

1. **RN-03 — critério de suficiência de dados.** Pergunta: o critério fica exatamente "≥2 datas de calendário distintas com solicitação concluída, dentro da janela avaliada", como proposto pelo UC-52 (Seção 14, item 1), ou deveria ser outro número/outra métrica?
   **Resposta do usuário:** confirmado exatamente como proposto — `MIN_DISTINCT_CONSUMPTION_DATES = 2`, aplicado em cascata às janelas 90/60/30 dias. Sem dado suficiente em nenhuma das três janelas, o produto fica sem projeção (RF-06/Fluxo Alternativo 7a) — nunca quebra a tela.

2. **Destino do card "Projeção de Reposição" no Dashboard do Consultor.** Pergunta: como o card agrega N clínicas vinculadas e não existe uma tela "todas as projeções", qual das opções (a) `/consultant/clinics`, (b) clínica mais urgente, (c) card não clicável, ou (d) nova tela agregada deveria ser o destino do clique?
   **Resposta do usuário:** opção **(a)** — o card navega para `/consultant/clinics` (lista de clínicas vinculadas já existente), deixando o Consultor escolher manualmente qual clínica investigar em detalhe.

3. **Ordem da cascata de janelas (RN-03), encontrada durante o Step 2 (22/09/2026).** Ao escrever os testes unitários de `selectConsumptionWindow`, identificou-se que a ordem original (90→60→30, mais larga primeiro) tornava o fallback para janelas menores matematicamente inalcançável: como todas as janelas terminam em "hoje", uma janela mais estreita é sempre um subconjunto de uma mais larga (30⊆60⊆90), então suficiência de dados em uma janela menor sempre implica suficiência na janela maior que a contém — avaliando 90 primeiro, o resultado seria sempre "90 dias" (se suficiente) ou "dados insuficientes", nunca "60" ou "30". Pergunta: (a) inverter a ordem para 30→60→90 (mais recente primeiro, tornando o fallback real), (b) manter 90→60→30 aceitando que 60/30 nunca disparam na prática, ou (c) pausar e revisar formalmente com `uml-use-case-writer`/`doc-writer` antes de prosseguir?
   **Resposta do usuário:** opção **(a)** — inverter a ordem para 30→60→90 dias. `HISTORY_WINDOWS_DAYS` alterado de `[90, 60, 30]` para `[30, 60, 90]` em `src/lib/services/projectionService.ts`; UC-52 corrigido correspondentemente pelo `uml-use-case-writer` (v1.0→v1.1).
