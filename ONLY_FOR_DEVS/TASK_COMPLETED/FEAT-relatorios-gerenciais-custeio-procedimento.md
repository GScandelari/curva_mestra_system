# Feature Specification: Relatórios Gerenciais Avançados e Custeio por Procedimento (UC-51)

**Projeto:** Curva Mestra
**Data:** 23/09/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Stanke Scandelari
**Data de Conclusão:** 23/09/2026
**Tipo:** Feature
**Branch sugerida:** duas branches sequenciais a partir de `develop` (ver Seção 0 — escopo fatiado conforme autorizado por UC-51, Seção 14, item 6):
- `feature/uc51-custeio-procedimento-historico-lote`
- `feature/uc51-fechamento-executivo-mix-trimestral`
**Prioridade:** Média
**Versão:** 1.1

> Implementa o UC-51 (`ONLY_FOR_DEVS/PO_BA_Docs/UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.md`, v1.1, Aprovado): um motor de custeio client-side (custo médio ponderado por lote fisicamente debitado) e quatro novos cards na tela `/clinic/reports` (Custo por Procedimento, Histórico do Lote, Fechamento Executivo Mensal em PDF, Mix de Produtos por Trimestre em PDF), restritos a `clinic_admin`. Nenhuma nova coleção/regra/índice Firestore. A única pendência técnica deixada em aberto pelo UC-51 (biblioteca de geração de PDF) é resolvida nesta spec como decisão de design já tomada (Seção 4.1) — jsPDF + jspdf-autotable, client-side, sem dependência nova de infraestrutura.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`
- **Fatiamento em duas branches sequenciais**, autorizado explicitamente por UC-51 Seção 14, item 6 ("se o `dev-task-manager` considerar o escopo grande demais para uma única entrega, pode fatiar em múltiplas tasks/PRs sem dividir o UC"). Motivo do corte: as duas primeiras capacidades (Custo por Procedimento, Histórico do Lote) não dependem de nenhuma biblioteca nova e exportam apenas para Excel (mesmo padrão já existente); as duas últimas (Fechamento Executivo, Mix Trimestral) dependem da escolha/instalação de uma biblioteca de PDF (Seção 4.1) e reaproveitam o motor de custeio construído na primeira branch. Cortar exatamente nessa fronteira técnica minimiza o tamanho de cada PR (Seção 7.2 do `GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — recomenda no máximo ~400 linhas de diff por PR) sem introduzir nenhuma dependência entre elas além de "Branch B parte do `develop` só depois que a Branch A for mergeada", para evitar dois PRs conflitantes tocando `reportService.ts`/`ReportsView.tsx` ao mesmo tempo.
- Fluxo de PR obrigatório para cada branch: `feature/uc51-*` → PR → `gscandelari_setup` (validação no Firebase pessoal) → PR → `develop`. **Nunca** abrir PR direto para `master`.

### Branch A — `feature/uc51-custeio-procedimento-historico-lote`

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 1 | `feat` | `reports` | `add pure costing engine functions (weighted average cost)` |
| 2 | `test` | `reports` | `add unit tests for costing engine functions` |
| 3 | `feat` | `reports` | `add firestore loaders for consumption records and product metadata` |
| 4 | `feat` | `reports` | `add generateProcedureCostReport and generateLotHistoryReport` |
| 5 | `feat` | `reports` | `add Custo por Procedimento and Histórico do Lote cards to ReportsView` |
| 6 | `feat` | `reports` | `add lot history entry point from inventory item detail page` |
| 7 | `test` | `reports` | `add UC-51 Playwright spec (fluxo principal e 7a, qa-agent, revisado)` |

### Branch B — `feature/uc51-fechamento-executivo-mix-trimestral` (a partir de `develop`, após merge da Branch A)

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 8 | `chore` | `deps` | `add jspdf and jspdf-autotable for client-side PDF export` |
| 9 | `feat` | `reports` | `add generateMonthlyExecutiveReport and generateQuarterlyMixReport` |
| 10 | `feat` | `reports` | `add Fechamento Executivo and Mix Trimestral cards with PDF export` |
| 11 | `test` | `reports` | `extend UC-51 Playwright spec with fluxos 7b e 7c (qa-agent, revisado)` |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

- **`src/lib/services/reportService.ts`** já implementa 3 relatórios: `generateStockValueReport`, `generateExpirationReport`, `generateConsumptionReport` — todos client-side, somente leitura, com `try/catch` relançando erro tratável, e um utilitário `exportToExcel` (import dinâmico de `xlsx`) já reaproveitável por este UC. `generateConsumptionReport` já lê `tenants/{tenantId}/solicitacoes` com `status == 'concluida'` num período, agrupando `produtos_solicitados` por `produto.produto_codigo`/`produto.produto_nome` — **estes são os nomes de campo corretos** (`ProdutoSolicitado.produto_codigo`/`produto_nome`, `src/types/index.ts` linhas 204-212), já corrigidos no commit `1ac45ab` (branch `fix/uc47-consumption-report-produto-codigo-field`, mergeada em `gscandelari_setup`). Qualquer código novo deste UC que agrupe `produtos_solicitados` usa esses mesmos nomes desde o início.
- **`src/components/reports/ReportsView.tsx`** (548 linhas) é a tela única `/clinic/reports`, hoje com 3 cards numa grid `md:grid-cols-3`, sem nenhuma distinção de papel — `clinic_admin` e `clinic_user` veem os 3 cards de forma idêntica. `src/app/(clinic)/clinic/reports/page.tsx` só passa `tenantId`, sem `readOnly`/gating de papel.
- **Duas interfaces `InventoryItem` distintas e não relacionadas coexistem no projeto** (achado desta investigação, não documentado anteriormente): `src/types/index.ts` (linhas 140-162) — usada por `generateStockValueReport`/`generateExpirationReport` — **não tem** campo `category`; e `src/lib/services/inventoryService.ts` (linhas 24-51) — usada por `getInventoryItem`/`getInventoryItemsByCodigo`/`InventoryView.tsx` — **tem** `category?: string` e `dt_entrada: Date` (já convertido de `Timestamp`). O campo `category` existe de fato nos documentos Firestore de `inventory` (denormalizado do `MasterProduct` no momento da entrada — `inventoryService.ts` linha 44), mas só a segunda interface o declara. `dashboardService.ts` (linhas 31-49) já lê `category` direto do doc bruto (`data.category as string | undefined`) sem depender de nenhuma das duas interfaces — é o padrão que este UC segue para não se prender a nenhuma das duas.
- **`src/lib/services/inventoryService.ts`** já expõe `getInventoryItem(tenantId, itemId): Promise<InventoryItem | null>` (leitura de um doc único, já usada por `/clinic/inventory/[id]/page.tsx`) e `getInventoryItemsByCodigo(tenantId, codigo): Promise<InventoryItem[]>` (query `where('codigo_produto', '==', codigo) + where('active', '==', true)`) — a segunda **filtra por `active`**, o que não serve integralmente às necessidades deste UC (Seção 6.2 explica por quê).
- **`src/app/(clinic)/clinic/inventory/[id]/page.tsx`** já é a tela de detalhe de um item de inventário, com `isAdmin` calculado (`claims?.role === 'clinic_admin'`) e botões condicionais — é o ponto de entrada natural para "Histórico do Lote" (UC-51, Fluxo 7a, passo 1 — "acessa a partir do detalhe de um item de inventário já existente").
- **`firestore.indexes.json`** (linhas 109-121, ambas as ordens ASC/DESC) já tem o índice composto `solicitacoes`: `status ASC + dt_procedimento ASC/DESC` — usado por `generateConsumptionReport` e reaproveitado por este UC sem nenhum índice novo. Uma query nova introduzida por este UC, `where('status', '==', 'concluida')` sozinha (sem filtro de data, usada pelo Histórico do Lote — RN-05 do UC-51 não define recorte de período), **não exige índice composto** — é uma igualdade de campo único, automaticamente indexada pelo Firestore.
- **`package.json`** não lista `jspdf`, `pdfmake`, `react-pdf`, `pdf-lib` nem nenhuma geração de PDF em `functions/src/` — confirmado nesta investigação (grep direto no arquivo), reafirmando o que o UC-51 (Seção 2.2/RNF-01) já registrava em 20/07/2026: a pendência técnica continua real.
- Não existe hoje nenhuma página `/consultant/.../reports` — `ReportsView` só é usada por `src/app/(clinic)/clinic/reports/page.tsx`. Isso confirma, por ausência de código, que o Portal do Consultor nunca teve acesso a relatórios (nem os 3 de UC-47) — não há nenhum caminho do Consultor a desabilitar ou restringir para este UC.

### 1.2 Problema identificado

O sistema hoje só responde "quanto tenho em estoque" (UC-47/`generateStockValueReport`), "o que está vencendo" (UC-47/`generateExpirationReport`) e "quanto foi consumido, sem discriminar custo por produto de forma financeira" (UC-47/`generateConsumptionReport` já soma valor, mas não calcula custo médio ponderado por lote nem "ticket médio de custo"). Não existe nenhuma resposta a "quanto custou, por produto, cada Procedimento realizado" nem "quais Procedimentos consumiram um lote específico" — lacunas que a landing comercial promete (Módulo 03/04, `public/landing/sections-product.jsx`) e o sistema real não cumpre.

### 1.3 Motivação estratégica

Fechar, junto com UC-52 (já implementado nesta mesma sessão, projeção de reposição), mais um dos 3 gaps landing-vs-sistema priorizados (UC-51/UC-52/UC-53), entregando ao `clinic_admin` visibilidade financeira de custo real por procedimento/produto — informação estratégica para precificação e negociação com a Rennova, mesmo sem envolver dado de faturamento (RN-04, fora de escopo por decisão de produto).

---

## 2. Objetivos

1. Implementar um motor de custeio client-side reaproveitável (custo médio ponderado por lote fisicamente debitado, RN-01/RN-02/RN-03 do UC-51) como módulo de funções puras testáveis.
2. Expor "Custo por Procedimento": custo total do período por produto, com detalhamento de lotes quando mais de um lote foi consumido.
3. Expor "Histórico do Lote": cross-reference cronológico de quais Procedimentos concluídos consumiram um lote específico, com saldo remanescente após cada evento.
4. Expor "Fechamento Executivo Mensal" e "Mix de Produtos por Trimestre", ambos exportáveis em PDF, reaproveitando o motor de custeio e `generateStockValueReport` já existente.
5. Restringir as 4 novas capacidades a `clinic_admin` (diferente das 3 já existentes de UC-47, que continuam abertas a `clinic_user`) — sem alterar `firestore.rules` (gating de UI apenas, RN-07).
6. Resolver a pendência técnica de biblioteca de PDF deixada em aberto pelo UC-51 (RNF-01), documentando a escolha como decisão de design definitiva.
7. Não introduzir nenhuma nova coleção, regra ou índice Firestore.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Sistema calcula, sob demanda, o custo por produto de todas as Solicitações `concluida` num período informado, com custo médio ponderado quando mais de um lote foi consumido | clinic_admin | Must |
| RF-02 | Sistema exibe cards de totais (Custo Total do Período, Ticket Médio de Custo Geral, Total de Procedimentos no Período) e uma tabela por produto (código, nome, categoria, quantidade consumida, lotes distintos, custo total, ticket médio de custo), ordenada por custo total decrescente | clinic_admin | Must |
| RF-03 | Sistema permite expandir, por produto com mais de um lote consumido, o detalhamento por lote (lote, quantidade, valor unitário, data de entrada), em ordem cronológica de `dt_entrada` — apenas exibição (RN-02 do UC-51) | clinic_admin | Should |
| RF-04 | Sistema exporta o relatório de Custo por Procedimento para Excel (`exportToExcel`, já existente) | clinic_admin | Must |
| RF-05 | Sistema exibe o painel "Histórico do Lote" para um produto + lote específico (`inventory_item_id`), com tabela cronológica (data, identificador do procedimento, quantidade consumida, saldo restante) considerando apenas Solicitações `concluida` | clinic_admin | Must |
| RF-06 | Sistema oferece um ponto de entrada para "Histórico do Lote" a partir do detalhe de um item de inventário (`/clinic/inventory/{id}`), pré-preenchendo produto e lote | clinic_admin | Must |
| RF-07 | Sistema exporta o relatório de Histórico do Lote para Excel | clinic_admin | Must |
| RF-08 | Sistema exibe o "Fechamento Executivo Mensal" (valor total de estoque, custo total consumido no mês, total de Procedimentos concluídos no mês, top 5 produtos por custo) para um mês/ano informado, exportável em PDF de página única | clinic_admin | Must |
| RF-09 | Sistema exibe "Mix de Produtos por Trimestre" (participação percentual de cada produto no custo total consumido no trimestre) para um trimestre/ano informado, exportável em PDF | clinic_admin | Must |
| RF-10 | Sistema restringe a exibição dos 4 novos cards a `clinic_admin` — `clinic_user` continua vendo apenas os 3 cards já existentes de UC-47, sem nenhuma mudança de comportamento para esse papel | clinic_admin / clinic_user | Must |
| RF-11 | Sistema exibe erro visível (toast) e não trava a tela em nenhum dos 4 relatórios se a leitura do Firestore falhar | clinic_admin | Must |
| RF-12 | Sistema exibe totais zerados/tabela vazia (não erro) quando não há Solicitação `concluida` no período/mês/trimestre informado | clinic_admin | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[Decisão tomada nesta spec — Seção 4.1]** Geração de PDF client-side via `jspdf` + `jspdf-autotable`, import dinâmico (mesmo padrão de `exportToExcel`/`xlsx`) — sem Cloud Function, sem servidor de renderização | Arquitetura |
| RNF-02 | Sem paginação/limite: os 4 novos relatórios lidam com o volume de `solicitacoes`/`inventory` do tenant sem filtro incremental, mesmo risco já aceito em UC-47/RNF-02 e UC-52/RNF-02 | Escalabilidade |
| RNF-03 | Multi-tenant: todas as leituras são escopadas por `tenants/{tenantId}/...`, mesmo padrão do restante do sistema | Multi-tenant |
| RNF-04 | A restrição a `clinic_admin` (RF-10) é apenas de UI — não há mudança em `firestore.rules`, mesmo padrão já usado por outras telas `isAdmin`-gated do projeto (`add-products`, `settings`, `setup`), nenhuma das quais tem uma regra Firestore dedicada correspondente | Segurança / Consistência |
| RNF-05 | Toda falha de cálculo deve ser comunicada via `toast` (`useToast`, `@/hooks/use-toast`) — nunca falha silenciosa | Usabilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | Quando um produto tem apenas um lote consumido no período, o custo do período é a soma direta de `quantidade × valor_unitario` de cada `ProdutoSolicitado` | UC-51 RN-01 |
| RN-02 | Quando um produto tem mais de um lote consumido no período, o custo unitário médio é `Σ(quantidade_lote_i × valor_unitario_lote_i) ÷ Σ(quantidade_lote_i)` — matematicamente equivalente a `custo_total ÷ quantidade_total`, sempre a partir da combinação real de lotes efetivamente debitada (nunca uma ordem de depleção teórica). Exemplo confirmado no UC-51: lote A (10un a R$5) + lote B (2 de 10un a R$8) = custo total R$66, custo médio R$5,50 | UC-51 RN-02, com exemplo numérico confirmado |
| RN-03 | "Ticket médio de custo" por produto = custo total do produto no período ÷ número de Procedimentos (Solicitações `concluida` distintas) que consumiram aquele produto — não é dividido por unidades (isso é RN-02) e não é valor de venda (RN-04) | UC-51 RN-03 |
| RN-04 | **[Fora de escopo, decisão de produto do UC-51]** Nenhum campo de valor cobrado do paciente/valor de tabela é criado. Margem por categoria não é implementada | UC-51 RN-04 |
| RN-05 | O Histórico do Lote considera apenas Solicitações `concluida` cujo `produtos_solicitados` contenha o `inventory_item_id` do lote consultado — sem recorte de período (todo o histórico do lote) | UC-51 RN-05 |
| RN-06 | O motor de custeio (`src/lib/services/costingService.ts`) é um módulo único reaproveitado pelos 3 relatórios que dependem de custo (Custo por Procedimento, Fechamento Executivo, Mix Trimestral) — não há 3 implementações divergentes do mesmo cálculo | UC-51 RN-06 |
| RN-07 | Todos os relatórios são calculados client-side a partir de `tenants/{tenantId}/inventory` e `tenants/{tenantId}/solicitacoes`, já usados por UC-47/UC-52 — nenhuma nova coleção, regra ou índice Firestore | UC-51 RN-07; confirmado por leitura de `firestore.rules`/`firestore.indexes.json` nesta investigação |
| RN-08 | Produto sem `category` denormalizado (ou cujos lotes consultados não retornam nenhum documento — ex.: todos os lotes daquele código foram desativados) exibe "Sem Categoria", mesma string literal usada em `dashboardService.ts` | UC-51 RN-08 (numerada como 8c no UC de origem, ver Fluxo de Exceção 8c) |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

- **Módulo de custeio 100% puro em `src/lib/services/costingService.ts`**, mesmo padrão já usado em `src/lib/services/projectionService.ts` (UC-52): funções puras de cálculo (`groupConsumptionByProduct`, `calculateTicketMedioCusto`, `buildLotHistory`, `calculateMixPercentages`) recebem dados já carregados e não tocam Firestore — testáveis sem mocks. Duas funções orquestradoras assíncronas (`getConsumptionRecords`, `getProductCostMetadata`) fazem a leitura real do Firestore no mesmo arquivo, seguindo o precedente de `getReplenishmentProjections` (não testadas unitariamente, cobertas depois pelo caderno Playwright).
- **`reportService.ts` ganha 4 novas funções** (`generateProcedureCostReport`, `generateLotHistoryReport`, `generateMonthlyExecutiveReport`, `generateQuarterlyMixReport`) que **importam** as funções de `costingService.ts` para montar os objetos de relatório finais — RN-06 exige reaproveitamento, não duplicação. `generateMonthlyExecutiveReport` também importa `generateStockValueReport` já existente (RN-06 do UC-51, Fluxo 7b passo 2).
- **Metadados de produto (categoria + `dt_entrada` por lote) via query por `codigo_produto`, sem filtro `active`**: diferente de `getInventoryItemsByCodigo` (que filtra `active == true`), `costingService.ts` define sua própria query `where('codigo_produto', '==', codigo)` (sem `active`) para capturar também lotes já desativados (ex.: totalmente consumidos) — importante porque um produto pode ter sido 100% consumido no período (todos os lotes desativados) e ainda assim precisar aparecer no relatório com sua categoria correta. Query de igualdade de campo único, sem necessidade de índice composto novo (RN-07).
- **`getInventoryItem` (já existente em `inventoryService.ts`) é reaproveitado diretamente pelo Histórico do Lote** para buscar `quantidade_inicial`, `lote`, `nome_produto` do item consultado — única função deste UC que importa de `inventoryService.ts` em vez de reimplementar a leitura; decisão deliberada de não duplicar uma função já testada em produção (usada por `/clinic/inventory/[id]/page.tsx`).
- **Identificador de Procedimento no Histórico do Lote**: o UC-51 (Fluxo 7a, passo 3) referencia um identificador de sessão `SES-XXXXXX` "quando implementado" (UC-19/RN-08) — confirmado nesta investigação que esse identificador **não existe em nenhum lugar do código hoje** (busca por `SES-`/`sessao_id` no projeto não retornou nenhum resultado). Fallback adotado: `solicitacao.descricao` quando preenchida, senão `` `SOL-${solicitacao.id.slice(0, 8).toUpperCase()}` ``. Quando UC-19/RN-08 implementar o identificador real, este UC pode trocar o fallback numa task futura sem mudança de contrato de dados (o campo já se chama `identificador_procedimento`, genérico o suficiente).
- **Seleção "produto e/ou lote" do Histórico do Lote (Fluxo 7a, passo 1) implementada em dois selects em cascata**: primeiro um select de `codigo_produto` (produtos ativos do tenant), depois um select de lote (populado via `getInventoryItemsByCodigo`, já existente) — reconcilia a redação do gatilho ("produto e/ou lote específico") com RN-05, que exige escopo por um `inventory_item_id` específico (não um produto inteiro). "Gerar Relatório" só habilita após os dois selects preenchidos, exceto quando a tela chega via query string (RF-06).
- **Ponto de entrada a partir do inventário (RF-06)**: botão "Ver Histórico do Lote" em `/clinic/inventory/[id]/page.tsx` (visível apenas para `isAdmin`, mesmo padrão de outros botões condicionais dessa tela), navegando para `` `/clinic/reports?report=lot-history&inventoryItemId=${item.id}` ``. `ReportsView.tsx` lê `useSearchParams` (padrão já usado em `clinic/requests/new/page.tsx`) e, se presente, pré-seleciona o card "Histórico do Lote", pré-preenche produto/lote e dispara a geração automaticamente.
- **Gating de UI por papel em `ReportsView.tsx`**: novo prop `isAdmin: boolean`, passado por `src/app/(clinic)/clinic/reports/page.tsx` (`claims?.role === 'clinic_admin'`, mesmo padrão de `isAdmin` já usado em 10+ páginas do projeto — `add-products`, `settings`, `inventory`, etc.). Os 3 cards de UC-47 continuam renderizando incondicionalmente; os 4 novos só renderizam quando `isAdmin === true`. Nenhuma mudança em `firestore.rules` (RNF-04) — mesmo padrão de todas as outras telas `isAdmin`-gated do projeto, nenhuma delas com enforcement adicional no Firestore.
- **Biblioteca de PDF: `jspdf` + `jspdf-autotable`**, import dinâmico client-side (`import('jspdf')`), mesmo padrão já usado por `exportToExcel` com `xlsx`. Justificativa: (1) API imperativa simples o suficiente para as duas necessidades reais deste UC — um resumo de KPIs de página única (Fechamento Executivo) e uma tabela com barras de participação percentual desenhadas via `doc.rect()` (Mix Trimestral, satisfazendo "tabela/gráfico" do UC-51 sem precisar de biblioteca de gráficos); (2) mesma filosofia "Zero DevOps"/client-side do `CLAUDE.md` — sem Cloud Function nova; (3) `jspdf-autotable` cobre tabelas formatadas sem esforço de posicionamento manual de texto; (4) footprint pequeno (~250KB combinado) e carregado sob demanda (dynamic import), sem impacto no bundle inicial.

### 4.2 Alternativas descartadas

- **`pdfmake`**: documento declarativo (JSON), também viável e com suporte a tabelas, mas exige embutir `vfs_fonts` (fontes base64) para funcionar client-side, aumentando o bundle sem necessidade real (o projeto não precisa de tipografia customizada). Descartado por trazer mais peso do que o jsPDF para o mesmo resultado.
- **`@react-pdf/renderer`**: produz PDFs a partir de árvores de componentes React, tipografia superior, mas é uma mudança de paradigma maior (documento como JSX, renderização assíncrona via worker) para apenas 2 relatórios relativamente simples deste UC. Descartado por desproporção entre a complexidade da ferramenta e a necessidade real (KISS).
- **`pdf-lib`**: manipulação de PDF de baixo nível, sem layout de tabela embutido — exigiria posicionar cada célula manualmente. Descartado por exigir mais código para o mesmo resultado que `jspdf-autotable` já resolve pronto.
- **Geração de PDF server-side (Cloud Function)**: descartada explicitamente pelo UC-51 (RNF-01, "Zero DevOps"/mesma filosofia client-side já usada em todo o projeto) e pela ausência de qualquer geração de PDF em `functions/src/` hoje.
- **Ler toda a coleção `inventory` (sem filtro) para montar o mapa de categoria/`dt_entrada`**: cogitada, descartada em favor de queries por `codigo_produto` (um por produto distinto consumido no período) — evita ler documentos irrelevantes de produtos nunca consumidos, mais alinhado ao volume real de cada relatório.

### 4.3 Trade-offs aceitos

- RNF-02 aceita explicitamente que os 4 relatórios sejam O(volume total de `solicitacoes`/`inventory`) sem cache, mesmo trade-off já aceito por UC-47/UC-52.
- RNF-04: a restrição a `clinic_admin` é só de UI. Um `clinic_user` com acesso ao DevTools do navegador tecnicamente ainda consegue chamar as novas funções de `reportService.ts` via console, já que `firestore.rules` não diferencia os dois papéis para leitura de `inventory`/`solicitacoes`. Aceito porque é exatamente o mesmo padrão de todas as outras telas `isAdmin`-gated do projeto (nenhuma tem reforço adicional em `firestore.rules`) — não é uma regressão de segurança introduzida por este UC, é a convenção já estabelecida.
- O fallback de identificador de Procedimento (`SOL-XXXXXXXX`) no Histórico do Lote é reconhecidamente provisório — quando UC-19/RN-08 implementar `SES-XXXXXX`, uma task futura troca a fonte do campo `identificador_procedimento` sem mudar o contrato de dados deste relatório.
- Categoria "Sem Categoria" pode aparecer tanto para produtos sem `category` real quanto para produtos cujos lotes foram todos desativados — duas causas diferentes com o mesmo texto de fallback. Aceito por simplicidade; RN-08 do UC-51 já permite esse texto genérico.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito | Branch |
|---------|------|-----------|--------|
| `src/lib/services/costingService.ts` | Serviço | Funções puras de custeio (RN-01/RN-02/RN-03) + orquestradores Firestore (`getConsumptionRecords`, `getProductCostMetadata`) + `buildLotHistory`/`calculateMixPercentages` | A |
| `src/__tests__/costingService.test.ts` | Teste unitário | Cobertura das funções puras (prioridade alta) | A |
| `tests/e2e/UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.spec.ts` | Teste E2E | Gerado pelo `qa-agent`, revisão humana obrigatória (CLAUDE.md item 8) — criado na Branch A (fluxo principal + 7a), estendido na Branch B (7b/7c) | A + B |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança | Branch |
|---------|---------------------|--------|
| `src/lib/services/reportService.ts` | + `generateProcedureCostReport`, `generateLotHistoryReport` (Branch A); + `generateMonthlyExecutiveReport`, `generateQuarterlyMixReport` (Branch B); + `exportToPdf` helper (Branch B) | A + B |
| `src/components/reports/ReportsView.tsx` | + prop `isAdmin`; + `useSearchParams` para prefill do Histórico do Lote; + 2 novos cards e painéis de resultado (Custo por Procedimento, Histórico do Lote) na Branch A; + 2 novos cards e painéis (Fechamento Executivo, Mix Trimestral) na Branch B | A + B |
| `src/app/(clinic)/clinic/reports/page.tsx` | Passa `isAdmin={claims?.role === 'clinic_admin'}` para `ReportsView` | A |
| `src/app/(clinic)/clinic/inventory/[id]/page.tsx` | + botão "Ver Histórico do Lote" (visível apenas se `isAdmin`), navega para `/clinic/reports?report=lot-history&inventoryItemId={id}` | A |
| `package.json` | + `jspdf`, `jspdf-autotable` em `dependencies` | B |

### 5.3 Arquivos a REMOVER

N/A — feature aditiva, nada é removido.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `tenants/{tenantId}/solicitacoes` | Leitura (nenhuma mudança de regra/índice) | `where('status','==','concluida') + where('dt_procedimento', ...)` para Custo por Procedimento/Fechamento/Mix (índice composto já existente, `firestore.indexes.json` linhas 109-121); `where('status','==','concluida')` sozinho para Histórico do Lote (igualdade de campo único, sem índice composto necessário) |
| `tenants/{tenantId}/inventory` | Leitura (nenhuma mudança de regra/índice) | `where('codigo_produto','==', codigo)` por produto distinto consumido no período (sem filtro `active`, igualdade de campo único); `getDoc` direto por `inventory_item_id` no Histórico do Lote (reaproveitando `getInventoryItem`) |
| `firestore.rules` | Nenhuma mudança | RN-07/RNF-04 confirmados — regra genérica de subcoleção já cobre; restrição a `clinic_admin` é só de UI |

### 5.5 O que NÃO muda

- `firestore.rules` e `firestore.indexes.json` — nenhuma linha alterada.
- `src/lib/services/reportService.ts` — as 3 funções já existentes (`generateStockValueReport`, `generateExpirationReport`, `generateConsumptionReport`) permanecem intocadas, apenas reaproveitadas por composição (`generateMonthlyExecutiveReport` chama `generateStockValueReport`).
- `src/lib/services/projectionService.ts` (UC-52) — não reaproveitado por este UC (RN-06 do UC-51 deixa explícito que são motores de natureza distinta: quantidade vs. custo).
- Acesso de `clinic_user` aos 3 relatórios já existentes de UC-47 — nenhuma mudança de comportamento (RF-10).
- Nenhuma tela/rota do Portal do Consultor — este UC não estende relatórios ao Consultor (ator único `clinic_admin`, diferente de UC-52).
- `src/lib/inventoryUtils.ts`, `src/lib/services/inventoryService.ts` — `getInventoryItem`/`getInventoryItemsByCodigo` são reaproveitadas, não alteradas.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

Novas interfaces, locais a `src/lib/services/costingService.ts` (padrão já usado por `reportService.ts`/`projectionService.ts` — interfaces de relatório não entram em `src/types/index.ts`):

```ts
// costingService.ts — Antes: não existe. Depois:

export interface ConsumptionRecord {
  codigo_produto: string;
  nome_produto: string;
  inventory_item_id: string;
  lote: string;
  quantidade: number;
  valor_unitario: number;
  solicitacao_id: string;
  dt_procedimento: Date;
}

export interface LoteDetalhe {
  inventory_item_id: string;
  lote: string;
  quantidade: number;
  valor_unitario: number;
  dt_entrada: Date | null; // null se InventoryItem.dt_entrada ausente (campo opcional)
}

export interface ProductCostSummary {
  codigo_produto: string;
  nome_produto: string;
  categoria: string; // 'Sem Categoria' quando ausente (RN-08)
  quantidade_consumida: number;
  custo_total: number;
  custo_unitario_medio: number; // RN-01/RN-02 — sempre custo_total / quantidade_consumida
  lotes_distintos: number;
  numero_procedimentos: number; // Solicitações distintas que consumiram este produto
  ticket_medio_custo: number; // RN-03
  lotes_detalhe: LoteDetalhe[]; // ordenado por dt_entrada asc (nulls por último)
}

export interface ProductCostMetadata {
  categoria: string;
  dtEntradaByInventoryItemId: Map<string, Date | null>;
}

export interface LotHistoryEvent {
  solicitacao_id: string;
  identificador_procedimento: string; // fallback ver Seção 4.1; troca futura para SES-XXXXXX (UC-19/RN-08)
  dt_procedimento: Date;
  quantidade_consumida: number;
}

export interface LotHistoryEntry extends LotHistoryEvent {
  saldo_apos_evento: number;
}
```

```ts
// reportService.ts — novas interfaces de relatório (mesmo padrão de StockValueReport/ExpirationReport/ConsumptionReport)

export interface ProcedureCostReport {
  periodo: { inicio: Date; fim: Date };
  custo_total_periodo: number;
  ticket_medio_custo_geral: number; // custo_total_periodo / total_procedimentos_periodo (0 se período vazio)
  total_procedimentos_periodo: number; // Solicitações concluida distintas no período (qualquer produto)
  por_produto: ProductCostSummary[]; // ordenado por custo_total desc
  gerado_em: Date;
}

export interface LotHistoryReport {
  inventory_item_id: string;
  codigo_produto: string;
  nome_produto: string;
  lote: string;
  quantidade_inicial: number;
  eventos: LotHistoryEntry[]; // ordenado cronologicamente asc
  gerado_em: Date;
}

export interface MonthlyExecutiveReport {
  mes: number; // 1-12
  ano: number;
  valor_total_estoque: number; // generateStockValueReport(tenantId).valor_total
  custo_total_consumido_mes: number;
  total_procedimentos_concluidos_mes: number;
  top_5_produtos_custo: { codigo: string; nome: string; custo_total: number }[];
  gerado_em: Date;
}

export interface QuarterlyMixReport {
  trimestre: 1 | 2 | 3 | 4;
  ano: number;
  custo_total_trimestre: number;
  por_produto: { codigo: string; nome: string; custo_total: number; percentual: number }[]; // ordenado por percentual desc
  gerado_em: Date;
}
```

Nenhuma interface existente (`InventoryItem` em `src/types/index.ts` ou em `inventoryService.ts`, `Solicitacao`, `ProdutoSolicitado`) é alterada.

### 6.2 Mudanças em serviços

```ts
// costingService.ts — funções puras (prioridade alta de teste, CLAUDE.md item 8)

export function groupConsumptionByProduct(
  records: ConsumptionRecord[],
  metadataByCodigo: Map<string, ProductCostMetadata>
): ProductCostSummary[];

export function calculateTicketMedioCusto(
  custoTotal: number,
  numeroProcedimentos: number
): number; // 0 quando numeroProcedimentos === 0

export function buildLotHistory(
  events: LotHistoryEvent[],
  quantidadeInicial: number
): LotHistoryEntry[]; // ordena por dt_procedimento asc; saldo = quantidadeInicial - soma acumulada

export function calculateMixPercentages(
  summaries: { codigo_produto: string; nome_produto: string; custo_total: number }[]
): { codigo: string; nome: string; custo_total: number; percentual: number }[]; // percentual = custo_total / Σcusto_total * 100; 0 se soma total for 0

// Orquestradores — não testados unitariamente (mesmo precedente de reportService.ts/projectionService.ts)

export async function getConsumptionRecords(
  tenantId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<ConsumptionRecord[]>; // sem filtro de data quando dataInicio/dataFim omitidos (Histórico do Lote, RN-05)

export async function getProductCostMetadata(
  tenantId: string,
  codigosProduto: string[]
): Promise<Map<string, ProductCostMetadata>>; // uma query where('codigo_produto','==',codigo) por código distinto, Promise.all
```

Lógica de `groupConsumptionByProduct`: agrupa `records` por `codigo_produto`; por grupo, `quantidade_consumida = Σquantidade`, `custo_total = Σ(quantidade × valor_unitario)`, `custo_unitario_medio = custo_total / quantidade_consumida` (RN-01/RN-02 — a mesma fórmula cobre os dois casos, já que RN-01 é RN-02 com um único lote), `lotes_distintos = new Set(records.map(r => r.inventory_item_id)).size`, `numero_procedimentos = new Set(records.map(r => r.solicitacao_id)).size`, `ticket_medio_custo = calculateTicketMedioCusto(custo_total, numero_procedimentos)`, `categoria`/`lotes_detalhe` a partir de `metadataByCodigo.get(codigo_produto)` (fallback `'Sem Categoria'`/`[]` — RN-08).

Lógica de `getConsumptionRecords`: query `solicitacoes` (`status == 'concluida'`, mais `dt_procedimento` no intervalo quando informado); para cada doc, `produtos_solicitados.forEach` montando um `ConsumptionRecord` por item (campos `produto.produto_codigo`/`produto.produto_nome` — nomes corretos, ver Seção 1.1).

Lógica de `getProductCostMetadata`: `Promise.all` de uma query `where('codigo_produto', '==', codigo)` (sem `active`) por código distinto em `codigosProduto`; para cada resultado, `categoria = primeiro doc com data.category truthy, senão 'Sem Categoria'`; `dtEntradaByInventoryItemId` populado com `doc.id → (data.dt_entrada instanceof Timestamp ? data.dt_entrada.toDate() : null)` para todos os docs retornados.

```ts
// reportService.ts — novas funções

export async function generateProcedureCostReport(
  tenantId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<ProcedureCostReport>;

export async function generateLotHistoryReport(
  tenantId: string,
  inventoryItemId: string
): Promise<LotHistoryReport>;

export async function generateMonthlyExecutiveReport(
  tenantId: string,
  mes: number,
  ano: number
): Promise<MonthlyExecutiveReport>;

export async function generateQuarterlyMixReport(
  tenantId: string,
  trimestre: 1 | 2 | 3 | 4,
  ano: number
): Promise<QuarterlyMixReport>;

// Utilitário novo (Branch B), mesmo padrão de exportToExcel (import dinâmico client-side)
export function exportToPdf(
  buildDocument: (doc: import('jspdf').jsPDF) => void,
  filename: string
): void;
```

Lógica de `generateProcedureCostReport`: chama `getConsumptionRecords(tenantId, dataInicio, dataFim)`; extrai códigos distintos; chama `getProductCostMetadata`; chama `groupConsumptionByProduct`; ordena por `custo_total` desc; `total_procedimentos_periodo = new Set(records.map(r => r.solicitacao_id)).size`; `custo_total_periodo = Σ custo_total de por_produto`; `ticket_medio_custo_geral = calculateTicketMedioCusto(custo_total_periodo, total_procedimentos_periodo)`.

Lógica de `generateLotHistoryReport`: chama `getInventoryItem(tenantId, inventoryItemId)` (import de `inventoryService.ts`) — se `null`, lança erro tratável; chama `getConsumptionRecords(tenantId)` (sem datas, RN-05) filtrando client-side `records.filter(r => r.inventory_item_id === inventoryItemId)`; monta `LotHistoryEvent[]` com `identificador_procedimento` (Seção 4.1); chama `buildLotHistory(eventos, item.quantidade_inicial)`.

Lógica de `generateMonthlyExecutiveReport`: `Promise.all([generateStockValueReport(tenantId), generateProcedureCostReport(tenantId, startOfMonth(...), endOfMonth(...))])` (`date-fns`, já dependência do projeto); `top_5_produtos_custo = por_produto.slice(0, 5)`.

Lógica de `generateQuarterlyMixReport`: calcula `dataInicio`/`dataFim` do trimestre (`date-fns`, sem `startOfQuarter` direto se a versão não suportar — cálculo manual `new Date(ano, (trimestre - 1) * 3, 1)` até o fim do 3º mês, testado no Step de implementação); chama `generateProcedureCostReport` no intervalo; chama `calculateMixPercentages(report.por_produto)`.

### 6.3 Mudanças na UI

**`src/app/(clinic)/clinic/reports/page.tsx`** (estado atual → novo): hoje só passa `tenantId`. Passa a calcular `isAdmin = claims?.role === 'clinic_admin'` e passar `isAdmin` para `ReportsView`.

**`ReportsView.tsx`** (estado atual → novo): grid de cards passa de `md:grid-cols-3` fixo para renderizar os 3 cards de UC-47 sempre, e os 4 novos cards apenas se `isAdmin`. Cada novo card segue exatamente o padrão visual já existente (ícone + título + descrição + inputs de filtro + botão "Gerar Relatório"), com painel de resultado abaixo (cards de totais + tabela), reaproveitando `formatCurrency`/`formatDecimalBR`/`exportToExcel` já importados. Novo `useSearchParams()` lê `report`/`inventoryItemId`; se `report === 'lot-history'` e `inventoryItemId` presentes, pré-seleciona o card Histórico do Lote e dispara `handleGenerateLotHistoryReport` automaticamente ao montar.

- **Custo por Procedimento**: inputs Data Início/Data Fim (mesmo padrão de Consumo, UC-47); cards de totais (Custo Total do Período, Ticket Médio de Custo Geral, Total de Procedimentos); tabela (Código, Produto, Categoria, Qtd. Consumida, Lotes Distintos, Custo Total, Ticket Médio de Custo), ordenada por custo total desc; linha expansível (ícone chevron) quando `lotes_distintos > 1`, mostrando `lotes_detalhe` (Lote, Quantidade, Valor Unitário, Data de Entrada).
- **Histórico do Lote**: dois `<select>` em cascata (produto → lote, este populado via `getInventoryItemsByCodigo` ao selecionar o produto); tabela cronológica (Data, Procedimento, Quantidade Consumida, Saldo Após Evento); estado vazio quando não há evento algum (RF-12).
- **Fechamento Executivo Mensal**: input `type="month"` (mês/ano); preview de página única com os 4 indicadores + tabela top 5; botão "Exportar PDF" (em vez de "Exportar Excel").
- **Mix de Produtos por Trimestre**: select de trimestre (Q1-Q4) + input de ano; tabela (Código, Produto, Custo Total, % Participação) com uma barra horizontal proporcional (`<div style={{width: `${percentual}%`}}>`, CSS puro, sem biblioteca de gráfico) ao lado do percentual; botão "Exportar PDF" desenha a mesma barra via `doc.rect()` do jsPDF.

**`/clinic/inventory/[id]/page.tsx`** (estado atual → novo): novo botão "Ver Histórico do Lote" (ícone `History`, `lucide-react`), visível apenas quando `isAdmin`, ao lado dos botões já condicionais existentes, navegando para `` `/clinic/reports?report=lot-history&inventoryItemId=${item.id}` ``.

### 6.4 Mudanças em API Routes

N/A — nenhuma rota nova ou alterada (RNF-01/RN-07). Toda leitura é direta via Firestore client SDK.

---

## 7. Plano de Implementação

### Branch A — `feature/uc51-custeio-procedimento-historico-lote`

#### STEP 1 — Funções puras do motor de custeio

**Objetivo:** Implementar RN-01/RN-02/RN-03 como funções puras testáveis.

**Arquivos afetados:**
- `src/lib/services/costingService.ts` — criar com `ConsumptionRecord`, `LoteDetalhe`, `ProductCostSummary`, `ProductCostMetadata`, `LotHistoryEvent`, `LotHistoryEntry`, `groupConsumptionByProduct`, `calculateTicketMedioCusto`, `buildLotHistory`, `calculateMixPercentages`.

**Ações:**
1. Definir as interfaces da Seção 6.1.
2. Implementar `groupConsumptionByProduct` (lógica descrita na Seção 6.2), `calculateTicketMedioCusto`, `buildLotHistory` (ordena por `dt_procedimento` asc, calcula saldo acumulado), `calculateMixPercentages`.

**Validação:** `npm run type-check` sem erros; funções exportadas e importáveis.

**Commit:** `feat(reports): add pure costing engine functions (weighted average cost)`

---

#### STEP 2 — Testes unitários do motor de custeio

**Objetivo:** Cobrir RN-01/RN-02/RN-03 com testes determinísticos (CLAUDE.md item 8).

**Arquivos afetados:**
- `src/__tests__/costingService.test.ts` — criar, seguindo o padrão de `src/__tests__/projectionService.test.ts`

**Ações:**
1. `groupConsumptionByProduct`: um único lote (RN-01, custo = soma direta); múltiplos lotes (RN-02, **reproduzir o exemplo numérico exato do UC-51**: lote A 10un R$5 + lote B 2un R$8 → custo total R$66, custo médio R$5,50); `lotes_distintos`/`numero_procedimentos` contam corretamente quando o mesmo `inventory_item_id`/`solicitacao_id` aparece em múltiplos registros; produto sem metadata (`metadataByCodigo` sem entrada) retorna `categoria: 'Sem Categoria'`, `lotes_detalhe: []`.
2. `calculateTicketMedioCusto`: divisão correta; `numeroProcedimentos === 0` retorna 0 (não `Infinity`/`NaN`).
3. `buildLotHistory`: saldo decrescente correto evento a evento; eventos fora de ordem cronológica na entrada são reordenados antes do cálculo; saldo pode ficar negativo se os dados de origem forem inconsistentes (não deve lançar erro, apenas refletir o dado).
4. `calculateMixPercentages`: percentuais somam ~100% (tolerância de arredondamento); soma total zero retorna todos os percentuais como 0 (não `NaN`); ordenação por percentual desc.

**Validação:** `npm run test -- costingService` com 100% dos cenários acima passando.

**Commit:** `test(reports): add unit tests for costing engine functions`

---

#### STEP 3 — Orquestradores de leitura Firestore

**Objetivo:** Implementar `getConsumptionRecords` e `getProductCostMetadata`.

**Arquivos afetados:**
- `src/lib/services/costingService.ts` — adicionar as duas funções orquestradoras

**Ações:**
1. `getConsumptionRecords`: query `solicitacoes` (`status == 'concluida'`, mais `dt_procedimento >= dataInicio`/`<= dataFim` quando ambos informados); mapear cada `produtos_solicitados[]` para `ConsumptionRecord`, usando `produto.produto_codigo`/`produto.produto_nome` (Seção 1.1 — não repetir o engano de `codigo_produto`/`nome_produto`).
2. `getProductCostMetadata`: `Promise.all` de `where('codigo_produto', '==', codigo)` por código distinto (sem `active`); construir `Map<string, ProductCostMetadata>`.
3. `try/catch` relançando erro tratável pela UI (RNF-05), mesmo padrão de `reportService.ts`.

**Validação:** Testar manualmente contra o Firebase Emulator ou `gscandelari_setup` com dados reais; conferir contra um cálculo manual de conferência para ao menos 2 produtos com múltiplos lotes.

**Commit:** `feat(reports): add firestore loaders for consumption records and product metadata`

---

#### STEP 4 — `generateProcedureCostReport` e `generateLotHistoryReport`

**Objetivo:** Compor os dois primeiros relatórios em `reportService.ts`.

**Arquivos afetados:**
- `src/lib/services/reportService.ts` — adicionar `ProcedureCostReport`, `LotHistoryReport`, `generateProcedureCostReport`, `generateLotHistoryReport`
- Import de `getInventoryItem` de `inventoryService.ts` (novo cross-import, ver Seção 4.1)

**Ações:**
1. Implementar `generateProcedureCostReport` (lógica da Seção 6.2).
2. Implementar `generateLotHistoryReport`, incluindo o fallback de `identificador_procedimento` (Seção 4.1).
3. Tratar caso `getInventoryItem` retornar `null` (item de inventário não encontrado) com erro claro.

**Validação:** `npm run type-check` sem erros; teste manual contra dados reais reproduzindo o exemplo do UC-51 (RN-02).

**Commit:** `feat(reports): add generateProcedureCostReport and generateLotHistoryReport`

---

#### STEP 5 — Cards "Custo por Procedimento" e "Histórico do Lote" em `ReportsView`

**Objetivo:** RF-01 a RF-05, RF-10 (gating), RF-12 (estado vazio).

**Arquivos afetados:**
- `src/components/reports/ReportsView.tsx` — novo prop `isAdmin`; 2 novos cards + painéis de resultado
- `src/app/(clinic)/clinic/reports/page.tsx` — passar `isAdmin`

**Ações:**
1. Adicionar prop `isAdmin?: boolean` (default `false`) a `ReportsViewProps`.
2. Envolver os 4 novos cards (2 nesta Branch, 2 na Branch B) num fragmento condicional `{isAdmin && (...)}`.
3. Implementar o card + painel de Custo por Procedimento (inputs de período, cards de totais, tabela expansível — Seção 6.3).
4. Implementar o card + painel de Histórico do Lote (selects em cascata produto→lote, tabela cronológica).
5. `clinic/reports/page.tsx` passa `isAdmin={claims?.role === 'clinic_admin'}`.

**Validação:** Logado como `clinic_admin`, os 5 cards aparecem (3 existentes + 2 novos); logado como `clinic_user`, apenas os 3 de UC-47 aparecem — testado manualmente com os dois papéis.

**Commit:** `feat(reports): add Custo por Procedimento and Histórico do Lote cards to ReportsView`

---

#### STEP 6 — Ponto de entrada a partir do detalhe do item de inventário

**Objetivo:** RF-06.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/inventory/[id]/page.tsx` — novo botão condicional
- `src/components/reports/ReportsView.tsx` — leitura de `useSearchParams` para prefill

**Ações:**
1. Em `inventory/[id]/page.tsx`, adicionar botão "Ver Histórico do Lote" (visível só se `isAdmin`), navegando para `` `/clinic/reports?report=lot-history&inventoryItemId=${item.id}` ``.
2. Em `ReportsView.tsx`, ler `useSearchParams()`; se `report === 'lot-history'` e `inventoryItemId` presentes, pré-selecionar produto/lote correspondentes e chamar `handleGenerateLotHistoryReport` automaticamente ao montar.

**Validação:** A partir de `/clinic/inventory/{id}`, clicar "Ver Histórico do Lote" leva a `/clinic/reports` com o painel de Histórico do Lote já carregado para aquele item, sem clique adicional.

**Commit:** `feat(reports): add lot history entry point from inventory item detail page`

---

#### STEP 7 — Caderno de teste automatizado (qa-agent), Branch A

**Objetivo:** Cobrir o Fluxo Principal e o Fluxo 7a (CLAUDE.md item 8).

**Ações:**
1. Acionar o `qa-agent` passando este documento (Seções 6/7) e o UC-51 como referência.
2. `qa-agent` gera `tests/e2e/UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.spec.ts`, cobrindo: geração de Custo por Procedimento (RN-01 caso simples e RN-02 caso multi-lote), Histórico do Lote (via seleção manual e via ponto de entrada do inventário), gating `clinic_admin` vs. `clinic_user` (RF-10), estado vazio (RF-12).
3. **Revisão humana obrigatória** antes de virar gate de CI.

**Validação:** `npm run test:e2e` local passa com o novo spec; revisado e aprovado manualmente.

**Commit:** `test(reports): add UC-51 Playwright spec (fluxo principal e 7a, qa-agent, revisado)`

---

### Branch B — `feature/uc51-fechamento-executivo-mix-trimestral`

> Criada a partir de `develop` **após** o merge da Branch A.

#### STEP 8 — Dependência de geração de PDF

**Objetivo:** RNF-01 — instalar e validar `jspdf` + `jspdf-autotable`.

**Arquivos afetados:**
- `package.json` — adicionar dependências

**Ações:**
1. `npm install jspdf jspdf-autotable`.
2. Confirmar `npm run build` sem erros de tipos (`@types` embutidos nos próprios pacotes desde versões recentes — validar durante o step).

**Validação:** `npm run type-check` e `npm run build` sem erros após a instalação.

**Commit:** `chore(deps): add jspdf and jspdf-autotable for client-side PDF export`

---

#### STEP 9 — `generateMonthlyExecutiveReport` e `generateQuarterlyMixReport`

**Objetivo:** Compor os dois relatórios restantes, reaproveitando `costingService.ts` e `generateStockValueReport`.

**Arquivos afetados:**
- `src/lib/services/reportService.ts` — adicionar `MonthlyExecutiveReport`, `QuarterlyMixReport`, `generateMonthlyExecutiveReport`, `generateQuarterlyMixReport`, `exportToPdf`

**Ações:**
1. Implementar `generateMonthlyExecutiveReport` (Seção 6.2) via `Promise.all` com `generateStockValueReport` + `generateProcedureCostReport`.
2. Implementar `generateQuarterlyMixReport` via `generateProcedureCostReport` + `calculateMixPercentages`.
3. Implementar `exportToPdf` (import dinâmico de `jspdf`/`jspdf-autotable`, mesmo padrão de `exportToExcel`).

**Validação:** `npm run type-check` sem erros; teste manual com dados de um mês/trimestre reais.

**Commit:** `feat(reports): add generateMonthlyExecutiveReport and generateQuarterlyMixReport`

---

#### STEP 10 — Cards "Fechamento Executivo Mensal" e "Mix de Produtos por Trimestre"

**Objetivo:** RF-08, RF-09.

**Arquivos afetados:**
- `src/components/reports/ReportsView.tsx` — 2 novos cards + painéis + exportação PDF

**Ações:**
1. Implementar o card + preview de Fechamento Executivo Mensal (input `type="month"`, 4 indicadores, tabela top 5, botão "Exportar PDF").
2. Implementar o card + preview de Mix de Produtos por Trimestre (select trimestre + input ano, tabela com barra percentual CSS, botão "Exportar PDF" desenhando a mesma barra via `jspdf-autotable`/`doc.rect()`).

**Validação:** Gerar os dois PDFs manualmente e abrir os arquivos resultantes, conferindo que os números batem com o preview em tela.

**Commit:** `feat(reports): add Fechamento Executivo and Mix Trimestral cards with PDF export`

---

#### STEP 11 — Extensão do caderno de teste automatizado (qa-agent), Branch B

**Objetivo:** Cobrir os Fluxos 7b e 7c.

**Ações:**
1. Acionar o `qa-agent` para **estender** `tests/e2e/UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.spec.ts` (criado na Branch A) com os cenários de Fechamento Executivo e Mix Trimestral, incluindo o download/geração do PDF.
2. **Revisão humana obrigatória** antes de virar gate de CI.

**Validação:** `npm run test:e2e` local passa com o spec estendido; revisado e aprovado manualmente.

**Commit:** `test(reports): extend UC-51 Playwright spec with fluxos 7b e 7c (qa-agent, revisado)`

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-------------------|------------------------|
| `groupConsumptionByProduct` | `src/__tests__/costingService.test.ts` | Lote único (RN-01); múltiplos lotes reproduzindo o exemplo numérico do UC-51 (RN-02, R$66/R$5,50); contagem de `lotes_distintos`/`numero_procedimentos`; produto sem metadata → `'Sem Categoria'` |
| `calculateTicketMedioCusto` | idem | Divisão correta; `numeroProcedimentos === 0` → 0 |
| `buildLotHistory` | idem | Saldo decrescente correto; reordenação cronológica de entrada fora de ordem; saldo negativo não lança erro |
| `calculateMixPercentages` | idem | Percentuais somam ~100%; soma total 0 → todos 0 (não `NaN`); ordenação desc |
| `getConsumptionRecords`, `getProductCostMetadata` | — (não testados unitariamente) | Lógica de negócio já coberta pelas funções puras acima; leitura Firestore segue o precedente de `reportService.ts`/`projectionService.ts` |
| `generateProcedureCostReport`, `generateLotHistoryReport`, `generateMonthlyExecutiveReport`, `generateQuarterlyMixReport`, `exportToPdf` | — (não testados unitariamente) | Idem — orquestração/composição, sem lógica de cálculo própria além do que já está coberto |
| `ReportsView`, `reports/page.tsx`, `inventory/[id]/page.tsx` | — (não testado no MVP) | Componentes React/pages — cobertos pelo caderno Playwright (Steps 7 e 11), não por teste unitário (CLAUDE.md item 8) |

Regra aplicada: funções puras de cálculo (mesmo padrão de `projectionService.ts`/`inventoryUtils.ts`) são prioridade alta de teste unitário; orquestrador Firestore e UI ficam cobertos pelo caderno E2E via `qa-agent`.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — todos os testes passando, incluindo costingService.test.ts
[ ] Multi-tenant: todas as queries Firestore (inventory, solicitacoes) filtram por tenantId via caminho da subcoleção
[ ] Segurança: nenhum secret ou credencial no código; nenhuma mudança em firestore.rules (RN-07/RNF-04 confirmados)
[ ] Branch pessoal: cada task branch mergeada em gscandelari_setup para validação no Firebase, antes do PR para develop
[ ] PR: aberto para develop com template preenchido, em cada branch
[ ] Exemplo numérico de RN-02 do UC-51 (lote A 10un R$5 + lote B 2un R$8 = R$66/R$5,50) validado manualmente contra dado real ou seed de teste
[ ] Card "Custo por Procedimento" testado manualmente com produto de lote único e produto de múltiplos lotes
[ ] Card "Histórico do Lote" testado manualmente via seleção direta e via ponto de entrada do inventário
[ ] Cards restritos a clinic_admin — testado manualmente logado como clinic_user (não devem aparecer) e como clinic_admin (devem aparecer)
[ ] PDF de Fechamento Executivo e de Mix Trimestral gerados e abertos manualmente, conferindo números contra o preview em tela
[ ] Caderno Playwright (tests/e2e/UC-51-*.spec.ts) gerado/estendido pelo qa-agent e revisado por humano antes de virar gate de CI, em cada branch
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Categoria "Sem Categoria" aparecer para produto com categoria real, só porque todos os lotes daquele código foram desativados | Baixa | Baixo | Aceito como trade-off documentado (Seção 4.3); RN-08 do UC-51 já permite esse texto genérico como fallback |
| `jspdf`/`jspdf-autotable` trazerem incompatibilidade de tipos com TypeScript 5.7/Next 15 | Baixa | Médio | Step 8 valida `type-check`/`build` isoladamente antes de qualquer código de negócio depender da lib |
| Restrição `clinic_admin` ser apenas de UI (RNF-04) gerar expectativa equivocada de que os dados estão protegidos por regra Firestore | Média | Baixo | Documentado explicitamente na Seção 4.3 como convenção já estabelecida no projeto, não uma lacuna nova |
| Volume de `solicitacoes`/`inventory` grande deixar os 4 relatórios lentos (RNF-02) | Média | Médio | Aceito como MVP, mesmo precedente de UC-47/UC-52; otimização futura se necessário |
| PDF do Mix Trimestral (barra desenhada via `doc.rect()`) ficar visualmente pobre comparado a um gráfico de verdade | Média | Baixo | Aceito conscientemente (Seção 4.1) para não introduzir biblioteca de gráficos só para 1 dos 4 relatórios; pode evoluir numa iteração futura se o usuário achar insuficiente |
| Caderno Playwright não cobrir adequadamente os 4 fluxos (principal + 7a/7b/7c) | Média | Médio | Revisão humana obrigatória do spec em cada branch (Steps 7 e 11) |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Custo médio ponderado | Custo unitário médio de um produto quando mais de um lote foi consumido no período, ponderado pela quantidade real de cada lote fisicamente debitado (RN-02) |
| Ticket médio de custo | Custo total de um produto no período dividido pelo número de Procedimentos distintos que o consumiram (RN-03) — métrica de custo/consumo, não de venda |
| Lotes distintos | Número de `inventory_item_id` diferentes consumidos para um mesmo `codigo_produto` dentro do período avaliado |
| Histórico do Lote | Cross-reference cronológico de todos os Procedimentos concluídos que consumiram um `inventory_item_id` específico, com saldo remanescente após cada evento (RN-05) |
| Fechamento Executivo Mensal | Resumo de indicadores (estoque, custo consumido, procedimentos, top 5 produtos) de um mês, exportável em PDF de página única |
| Mix de Produtos por Trimestre | Participação percentual de cada produto no custo total consumido em um trimestre |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.md` (v1.1, Aprovado) — UC de origem
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-projecao-reposicao-estoque.md` (v1.3) — UC-52, usada como referência de formato/qualidade desta spec e de precedente de arquitetura (módulo de funções puras + orquestrador no mesmo arquivo)
- `CLAUDE.md` (item 8) — obrigatoriedade de caderno de teste Playwright para toda feature
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Git Flow, Conventional Commits, fluxo de PR
- `src/lib/services/reportService.ts` — base de convenção e reaproveitamento direto (`generateStockValueReport`, `generateConsumptionReport`, `exportToExcel`)
- `src/lib/services/projectionService.ts` (UC-52) — precedente arquitetural de módulo de cálculo puro + orquestrador testável
- `src/lib/services/inventoryService.ts` (`getInventoryItem`, `getInventoryItemsByCodigo`, interface local `InventoryItem` com `category`/`dt_entrada`) — reaproveitado pelo Histórico do Lote e pelas queries de metadata
- `src/types/index.ts` (`InventoryItem`, `Solicitacao`, `ProdutoSolicitado`) — confirmação dos nomes corretos de campo (`produto_codigo`/`produto_nome`)
- `src/types/masterProduct.ts` (`MASTER_PRODUCT_CATEGORIES`)
- `src/components/reports/ReportsView.tsx`, `src/app/(clinic)/clinic/reports/page.tsx` — tela a estender
- `src/app/(clinic)/clinic/inventory/[id]/page.tsx` — novo ponto de entrada do Histórico do Lote
- `firestore.indexes.json` (linhas 109-121) — índice composto `solicitacoes` já existente, reaproveitado sem alteração
- `firestore.rules` — base da confirmação de RN-07/RNF-04 (nenhuma mudança de regra necessária)
- Commit `1ac45ab` (branch `fix/uc47-consumption-report-produto-codigo-field`) — correção do nome de campo que este UC evita repetir desde o início

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.1 | 23/09/2026 | Guilherme Stanke Scandelari | Task concluída — movida para TASK_COMPLETED. Entrega completa das duas branches sequenciais autorizadas na Seção 0: Branch A (feature/uc51-custeio-procedimento-historico-lote, Steps 1-7, mergeada em gscandelari_setup via PR #288) entregou o motor de custeio puro (costingService.ts), 14 cenários de teste unitário reproduzindo o exemplo numérico exato de RN-02 (lote A 10un R$5 + lote B 2un R$8 = custo total R$66 / custo médio R$5,50), os orquestradores Firestore, generateProcedureCostReport/generateLotHistoryReport, os cards Custo por Procedimento/Histórico do Lote em /clinic/reports (restritos a clinic_admin), o ponto de entrada a partir do inventário e o caderno Playwright inicial (7 testes, fluxo principal + 7a). Durante essa branch o qa-agent, ao gerar o caderno, encontrou que custo_unitario_medio (RN-02, a métrica central do UC-51) era calculado corretamente pelo motor de custeio mas nunca chegava a ser exibido nem na UI nem no export Excel — corrigido com uma nova coluna Custo Unitário Médio na tabela de Custo por Procedimento. Branch B (feature/uc51-fechamento-executivo-mix-trimestral, Steps 8-11, criada a partir de gscandelari_setup como exceção documentada ao padrão normal de branch a partir de develop — develop ainda não tinha o código da Branch A no momento da criação) entregou jspdf+jspdf-autotable como dependência de PDF client-side, generateMonthlyExecutiveReport/generateQuarterlyMixReport, os cards Fechamento Executivo Mensal/Mix de Produtos por Trimestre com exportação em PDF, e a extensão do caderno Playwright para os fluxos 7b/7c (10 testes no total). Achado técnico do qa-agent durante a Branch B: jspdf-autotable exporta autoTable como função nomeada (import autoTable from jspdf-autotable; autoTable(doc, {...})), não como método de instância doc.autoTable(...) — confusão comum entre versões da biblioteca, documentada aqui para não repetir o engano numa task futura. Validação executada e verde no estado final da Branch B: npm run lint (0 erros), npm run type-check (0 erros), npm run build (OK), npm run test:coverage (151/151 testes unitários), caderno Playwright (10/10 passando contra o Firebase Emulator Suite, ~1.6min). Validação manual do DoD (cards restritos a clinic_admin testados com os dois papéis, PDFs de Fechamento Executivo e Mix Trimestral conferidos manualmente, exemplo numérico de RN-02 validado contra dado real) fica pendente para depois que esta branch subir para gscandelari_setup, conforme o fluxo normal de Git Flow do projeto. |
| 1.0 | 23/09/2026 | Doc Writer (Claude) | Versão inicial. Spec de implementação derivada do UC-51 (v1.1, Aprovado). Investigado o código real (`reportService.ts`, `ReportsView.tsx`, `inventoryService.ts`, `src/types/index.ts`, `dashboardService.ts`, `firestore.indexes.json`, `package.json`) — achado relevante não documentado antes: duas interfaces `InventoryItem` distintas coexistem no projeto (`types/index.ts` sem `category`; `inventoryService.ts` com `category`/`dt_entrada`), resolvido reaproveitando a convenção já usada por `dashboardService.ts` (leitura direta de `data.category`) e por consultas próprias em `costingService.ts`. Resolvida nesta spec, como decisão de design já tomada (não como pendência), a única pendência técnica não bloqueante deixada em aberto pelo UC-51 (RNF-01, biblioteca de PDF): `jspdf` + `jspdf-autotable`, client-side, com justificativa e alternativas descartadas documentadas (Seção 4). Proposto fatiamento em 2 branches sequenciais (`feature/uc51-custeio-procedimento-historico-lote` e `feature/uc51-fechamento-executivo-mix-trimestral`), autorizado explicitamente por UC-51 Seção 14, item 6, cortado na fronteira técnica exata onde a dependência de PDF começa a ser necessária. Nenhum `⚠️ Decisão necessária` restante — documento sai direto em `Status: Planejamento`, pronto para o `dev-task-manager`. |

