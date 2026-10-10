# UC-51: Gerar Relatórios Gerenciais Avançados e Custeio por Procedimento

**Projeto:** Curva Mestra
**Data de Criação:** 20/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Implementado
**Módulo/Contexto:** Relatórios
**Versão:** 1.2.1

> **Feature implementada.** Um Clinic Admin gera, na tela de Relatórios (`/clinic/reports`), um conjunto de relatórios gerenciais adicionais aos três já existentes (UC-47): Custo por Procedimento (com custo médio ponderado quando múltiplos lotes do mesmo produto foram consumidos no período), Histórico do Lote (cross-reference de quais Procedimentos consumiram um lote específico), Fechamento Executivo Mensal e Mix de Produtos por Trimestre (ambos exportáveis em PDF). Implementado via PRs #288 (Custo por Procedimento + Histórico do Lote) e #289 (Fechamento Executivo Mensal + Mix de Produtos por Trimestre), ambos mergeados em `gscandelari_setup` e deployados em `dev-gscandelari.web.app` — motor de custeio em `src/lib/services/costingService.ts`, funções de composição em `src/lib/services/reportService.ts` (`generateProcedureCostReport`, `generateLotHistoryReport`, `generateMonthlyExecutiveReport`, `generateQuarterlyMixReport`) e UI em `src/components/reports/ReportsView.tsx`, tela `/clinic/reports`. Este UC fechou uma lacuna entre o que a landing page comercial promete ("Módulo 03 — Investimentos & ROI" e "Módulo 04 — Relatórios gerenciais", `public/landing/sections-product.jsx`) e o que o sistema real entregava até então. **Não inclui margem nem ticket médio comercial** (decisão de produto mantida na implementação: não existe, e não foi criado, nenhum campo de valor cobrado do paciente/valor de tabela do procedimento — ver RN-04). Este UC também absorveu, pela segunda vez consecutiva neste mapa (`_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.1, v3.9 e v3.10), um motor de cálculo ("custeio FIFO ponderado") que foi cogitado como UC-51 próprio duas vezes e descartado nas duas por não ter ator, gatilho ou tela independentes — a primeira vez foi o "Módulo Procedimentos" (absorvido em UC-19/RN-08), a segunda foi "Investimentos & ROI" (absorvido aqui, como parte do motor de custeio deste próprio UC de Relatórios). **Decisões de negócio validadas com o usuário e confirmadas na implementação** (ver Seção 14 para o histórico completo): método de custeio (RN-02), localização de UI (Seção 5) e escopo do Histórico do Lote (RN-05). A única pendência que restava (a ferramenta técnica de geração de PDF, RNF-01) foi resolvida na spec de implementação (`jspdf` + `jspdf-autotable`, client-side) — ver `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-relatorios-gerenciais-custeio-procedimento.md` (v1.1, Concluído) para o plano completo e as decisões finais de implementação.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])

    subgraph Sistema["Curva Mestra"]
        UC47(("UC-47\nGerar Relatórios de Estoque,\nVencimento e Consumo"))
        UC51(("UC-51\nGerar Relatórios Gerenciais\nAvançados e Custeio"))
        UC16(("UC-16/17\nRegistrar Procedimento\n(Programado/Efetuado)"))
        UC19(("UC-19\nConcluir ou Cancelar\nProcedimento Agendado"))
    end

    Firestore[(🗄️ Firestore\ntenants/{tenantId}/inventory\ntenants/{tenantId}/solicitacoes)]
    PDF[/Export PDF\n(biblioteca a definir)/]

    ClinicAdmin --> UC51
    UC51 -->|"<<extend>>\nmesma tela de Relatórios"| UC47
    UC16 -.->|dado-fonte:\nprodutos_solicitados consumidos| UC51
    UC19 -.->|marca Solicitação como\n\"concluida\" — só estas entram no custeio| UC51
    UC51 -.->|lê, somente leitura| Firestore
    UC51 -->|gera| PDF
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** apenas — decisão explícita do usuário nesta elicitação (diferente de UC-47, onde `clinic_admin` e `clinic_user` têm acesso idêntico à tela de Relatórios). A justificativa é que os dados aqui expostos são de natureza financeira/gerencial (custo de aquisição por procedimento, fechamento executivo), distintos dos relatórios operacionais já existentes.

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo confirmado. A geração de PDF exigirá alguma biblioteca/mecanismo ainda não presente no projeto — não há `jspdf`, `pdfmake`, `react-pdf`, `pdf-lib` nem geração server-side de PDF em `package.json`/`functions/src/` hoje. Decisão de qual usar foi deliberadamente adiada para a fase de implementação (ver Seção 14, item 3).

---

## 3. Pré-condições
- Usuário autenticado com `claims.tenant_id` definido e `claims.role === 'clinic_admin'`.
- Para o relatório de Custo por Procedimento e para o Fechamento Executivo/Mix Trimestral: deve existir ao menos uma Solicitação com `status === 'concluida'` no período consultado para haver dado a exibir (na ausência, o relatório deve exibir totais zerados, mesmo padrão já usado pelos três relatórios de UC-47 — não é uma pré-condição bloqueante, é apenas o caso vazio).
- Para o Histórico do Lote: deve existir ao menos uma Solicitação com `status === 'concluida'` que tenha consumido o item de inventário (`InventoryItem`) do produto/lote consultado (RN-05).

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Nenhum dado é alterado em `tenants/{tenantId}/inventory` ou `tenants/{tenantId}/solicitacoes` — todos os relatórios deste UC são somente leitura/cálculo, mesmo padrão de UC-47 (RN-06 daquele UC).
- O relatório solicitado é exibido em preview na tela (cards de totais + tabela detalhada).
- Quando aplicável (Custo por Procedimento, Histórico do Lote): exportação para Excel (.xlsx), reaproveitando `exportToExcel` já existente em `reportService.ts`.
- Quando aplicável (Fechamento Executivo Mensal, Mix de Produtos por Trimestre): exportação para PDF.

### 4.2 Falha (Garantias Mínimas)
- Nenhuma alteração é feita; toast de erro é exibido, mesmo padrão de UC-47 (RNF-01 daquele UC — toast, não `alert()`).

---

## 5. Gatilho (Trigger)
Clinic Admin navega até a tela de Relatórios (`/clinic/reports`, mesma tela do UC-47, estendida com novos cards — **confirmado com o usuário nesta elicitação**) e clica em "Gerar Relatório" em um dos quatro novos tipos: Custo por Procedimento, Histórico do Lote, Fechamento Executivo Mensal ou Mix de Produtos por Trimestre.

---

## 6. Fluxo Principal (Basic Flow) — Gerar Relatório de Custo por Procedimento

1. Clinic Admin acessa a tela de Relatórios e seleciona o novo card "Custo por Procedimento".
2. Clinic Admin informa o período (Data Início / Data Fim), mesmo padrão de campo já usado no Relatório de Consumo (UC-47, fluxo 7b).
3. Clinic Admin clica em "Gerar Relatório".
4. Sistema busca todas as Solicitações com `status === 'concluida'` e `dt_procedimento` dentro do período informado (mesma fonte de dados e mesmo filtro de status já usados por `generateConsumptionReport`, UC-47/RN-03).
5. Sistema agrupa os itens de `produtos_solicitados` de todas essas Solicitações por `codigo_produto`.
6. Para cada produto, sistema identifica quantos lotes distintos (`inventory_item_id`) diferentes aparecem nos registros de consumo do período.
7. Se apenas um lote foi consumido para aquele produto no período: o custo total do produto no período é a soma direta de `quantidade × valor_unitario` de cada ocorrência (RN-01).
8. Se mais de um lote do mesmo produto foi consumido no período: sistema calcula o custo unitário médio ponderado pela quantidade real de cada lote fisicamente debitado, listando os lotes em ordem cronológica de entrada (`InventoryItem.dt_entrada`) apenas para fins de exibição (RN-02).
9. Sistema calcula, por produto: custo total do período, quantidade total consumida, número de Procedimentos distintos que usaram aquele produto, e "ticket médio de custo" (RN-03).
10. Sistema exibe cards de totais (Custo Total do Período, Ticket Médio de Custo Geral, Total de Procedimentos no Período) e uma tabela por produto (código, nome, categoria, quantidade consumida, número de lotes distintos, custo total, ticket médio de custo), ordenada por custo total decrescente (mesmo padrão de ordenação já usado em UC-47).
11. Clinic Admin pode clicar em "Exportar Excel" (mesma função `exportToExcel` já usada em UC-47) ou "Fechar".
12. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Consultar Histórico do Lote (variação do gatilho)
1. Clinic Admin seleciona o card "Histórico do Lote" e informa um produto e/ou lote específico (ou acessa a partir do detalhe de um item de inventário já existente — `/clinic/inventory/{id}`).
2. Sistema busca todas as Solicitações com `status === 'concluida'` (RN-05 — apenas concluídas, mesmo critério do motor de custeio e de UC-47/RN-03) cujo `produtos_solicitados` contenha aquele `inventory_item_id`.
3. Sistema exibe uma tabela cronológica: data do procedimento (**[v1.2.1]** formatada por `formatarDataProcedimento` — RN-08), identificador do Procedimento (ver UC-19/RN-08 — identificador de sessão `SES-XXXXXX`, quando implementado), quantidade consumida naquele evento, e saldo restante do lote após aquele evento.
4. Clinic Admin pode exportar para Excel ou fechar.

### 7b. Gerar Fechamento Executivo Mensal, PDF (variação do gatilho)
1. Clinic Admin seleciona o card "Fechamento Executivo Mensal" e informa o mês/ano de referência.
2. Sistema agrega, para o mês informado: valor total de estoque (reaproveitando `generateStockValueReport`, UC-47), custo total consumido no mês (reaproveitando o cálculo de Custo por Procedimento deste UC), total de Procedimentos concluídos no mês, e produtos com maior custo total (top 5).
3. Sistema exibe um preview de página única com esses indicadores.
4. Clinic Admin clica em "Exportar PDF" — sistema gera um arquivo PDF de 1 página (mecanismo de geração ainda a definir — ver Seção 14, item 3).
5. Caso de uso é concluído com sucesso.

### 7c. Gerar Mix de Produtos por Trimestre, PDF (variação do gatilho)
1. Clinic Admin seleciona o card "Mix de Produtos por Trimestre" e informa o trimestre/ano de referência.
2. Sistema calcula, para os 3 meses do trimestre, a participação percentual de cada produto no custo total consumido no período (mesmo agrupamento por `codigo_produto` do fluxo principal).
3. Sistema exibe o preview (tabela/gráfico de participação percentual por produto).
4. Clinic Admin clica em "Exportar PDF".
5. Caso de uso é concluído com sucesso.

---

## 8. Fluxos de Exceção

### 8a. Nenhuma Solicitação concluída no período (a partir do passo 4 do Fluxo Principal, ou equivalente nos fluxos 7b/7c)
1. A consulta não retorna nenhuma Solicitação com `status === 'concluida'` no período/mês/trimestre informado.
2. Sistema exibe o relatório com todos os totais zerados e tabela vazia — mesmo padrão de UC-47 (não é tratado como erro).

### 8b. Falha ao consultar o Firestore (a partir de qualquer passo de busca de dados)
1. A consulta lança exceção (rede, permissão).
2. Sistema exibe toast destrutivo "Erro ao gerar relatório", mesmo padrão de UC-47/RNF-01 (não usa `alert()`).

### 8c. Produto sem categoria cadastrada (a partir do passo 10 do Fluxo Principal)
1. O `codigo_produto` consumido não tem `category` denormalizado no item de inventário (produto cadastrado sem categoria — `ProdutoMaster.category` é opcional).
2. Sistema exibe "Sem Categoria" na coluna correspondente, mesmo padrão já usado em `dashboardService.ts` (agrupamento de estoque por categoria no dashboard).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | Quando um produto tem apenas um lote consumido no período, o custo do período é a soma direta de `quantidade × valor_unitario` de cada `ProdutoSolicitado` — o mesmo valor que já é somado hoje por `generateConsumptionReport` (UC-47). Este UC não recalcula nada nesse caso; apenas reapresenta o dado sob um recorte por procedimento/produto. | Confirmado por leitura de `solicitacaoService.ts` (`ProdutoSolicitado.valor_unitario` já é o custo real do lote debitado no momento do consumo) e `reportService.ts` (`generateConsumptionReport`). **[Implementado conforme desenhado — PR #288]** confirmado em `src/lib/services/costingService.ts` (`groupConsumptionByProduct`). |
| RN-02 | Quando um produto tem mais de um lote consumido no mesmo período, o custo unitário médio exibido é a média ponderada pela quantidade **real** consumida de cada lote fisicamente debitado (não uma média aritmética simples entre os valores unitários dos lotes, e não um motor de custeio contábil por camadas de entrada cronológicas independente do lote efetivamente debitado): `custo_unitario_médio = Σ(quantidade_lote_i × valor_unitario_lote_i) ÷ Σ(quantidade_lote_i)`. Os lotes são listados em ordem cronológica de entrada (`InventoryItem.dt_entrada`, campo opcional já existente) apenas para fins de exibição/detalhamento — a ordenação não altera o valor do custo médio ponderado. **[Confirmado com o usuário, exemplo numérico]**: lote A entrou com 10 unidades a R$ 5,00, lote B entrou com 10 unidades a R$ 8,00; se no período foram fisicamente consumidas as 10 unidades do lote A + 2 unidades do lote B (conforme os registros reais de `ProdutoSolicitado`, 12 unidades no total), o custo total é `10×5 + 2×8 = R$ 66,00` e o custo médio ponderado é `R$ 66,00 ÷ 12 = R$ 5,50` — sempre a partir da combinação real de lotes efetivamente debitada nas Solicitações, nunca assumindo uma ordem de depleção teórica separada da operação real. | Decisão do usuário nesta elicitação ("custo médio ponderado por ordem de entrada — FIFO real"), **confirmada com exemplo numérico**: é a média ponderada por consumo real, não a leitura contábil alternativa de camadas de entrada independentes do lote fisicamente debitado. **[Implementado conforme desenhado — PR #288]** confirmado em `costingService.ts`/`groupConsumptionByProduct` e nos 14 testes unitários de `src/__tests__/costingService.test.ts`, reproduzindo o exemplo numérico exato (R$66,00 / R$5,50). Achado do `qa-agent` durante a geração do caderno Playwright, corrigido antes do merge: `custo_unitario_medio` era calculado corretamente mas não estava sendo exibido na UI nem no export Excel — corrigida com uma nova coluna "Custo Unitário Médio" (ver Seção 14, item 7). |
| RN-03 | "Ticket médio de custo" por linha de produto = custo total do produto no período ÷ número de Procedimentos (Solicitações concluídas) que consumiram aquele produto no período — **não** é dividido pela quantidade de unidades (isso seria "custo unitário médio", RN-02), e **não** é um valor de venda/faturamento (RN-04). | Interpretação de "ticket médio por linha de produto" (bullet da landing, `sections-product.jsx`, Módulo 03) decidida com o usuário nesta elicitação: métrica de custo/consumo, não de venda. **[Implementado conforme desenhado — PR #288]** |
| RN-04 | **[Fora de escopo, decisão explícita]** Margem por categoria (HA, toxina, bioestimulador…) **não é implementada** neste UC. Não existe, em nenhum lugar do sistema (`InventoryItem`, `ProdutoMaster`, `Solicitacao`/`ProdutoSolicitado`, `Protocolo`), nenhum campo de valor cobrado do paciente ou valor de tabela do procedimento — margem pressupõe conhecer esse dado, que o produto hoje não coleta. A promessa correspondente da landing (`sections-product.jsx`, Módulo 03, bullet "Margem por categoria") foi registrada para correção de texto em `_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.2. | Confirmado por leitura de `src/types/index.ts` (`InventoryItem`, `Solicitacao`, `ProdutoSolicitado`), `src/types/masterProduct.ts` (`MasterProduct`) e `protocoloService.ts`/`Protocolo` — nenhum tem campo de preço de venda/valor de tabela. Decisão de produto tomada nesta elicitação. **[Confirmado na implementação]** nenhum campo de valor de venda foi criado. |
| RN-05 | O painel "Histórico do Lote" (fluxo 7a) é um cross-reference de `ProdutoSolicitado.inventory_item_id` contra a coleção `solicitacoes`, considerando **apenas Solicitações com `status === 'concluida'`** — mesmo critério usado pelo motor de custeio (RN-01/RN-02/RN-03) e por UC-47/RN-03. Solicitações `agendada`/`efetuada` (reserva ainda não efetivada) **não** entram neste histórico. Mostra, para um lote específico, todos os Procedimentos concluídos que o consumiram, em ordem cronológica, com o saldo remanescente do lote após cada evento. | Escopo herdado do primeiro "UC-51" descartado (Módulo Procedimentos, v3.9 do mapa) — ver UC-19, Seção 12. Filtro por `status === 'concluida'` **confirmado com o usuário nesta elicitação** (decisão que restringiu a proposta inicial deste documento, que sugeria "qualquer status"). Nenhum código equivalente existe hoje (busca por "histórico do lote"/cross-reference de lote em `src/` não retornou nenhuma implementação). **[Implementado conforme desenhado — PR #288]** painel "Histórico do Lote" com ponto de entrada a partir de `/clinic/inventory/[id]` ("Ver Histórico do Lote", visível só para `clinic_admin`), confirmado em produção (`dev-gscandelari.web.app`). |
| RN-06 | O motor de custeio (RN-01/RN-02/RN-03) não introduz nenhuma tela, ator ou gatilho próprios — é consumido inteiramente pelos relatórios já descritos neste UC (Custo por Procedimento, Fechamento Executivo, Mix Trimestral). Foi cogitado como UC próprio duas vezes nesta base de conhecimento (`_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.1, v3.9 e v3.10) e descartado nas duas por não passar no critério de "ator com objetivo observável" (Cockburn) — decisão de julgamento profissional tomada em conjunto com o usuário nesta elicitação. | Decisão registrada em `_MAPA-DE-BUGS-E-MELHORIAS.md` v3.10 (nota da atualização) e nesta conversa de elicitação. **[Implementado conforme desenhado]** motor de custeio centralizado em `src/lib/services/costingService.ts`, reaproveitado pelos três relatórios que dependem de custo, sem duplicação. |
| RN-07 | Todos os relatórios deste UC são calculados client-side a partir das mesmas coleções já usadas por UC-47 (`tenants/{tenantId}/inventory`, `tenants/{tenantId}/solicitacoes`) — nenhuma nova coleção Firestore é necessária. A segurança/isolamento multi-tenant depende da mesma regra genérica já usada por UC-47 (`tenants/{tenantId}/{document=**}`). | Extrapolado do padrão já confirmado em UC-47/RN-06, aplicável aqui por reaproveitar as mesmas fontes de dado — nenhuma nova regra Firestore é necessária, mas isso só será verificado de fato na implementação. **[Confirmado na implementação]** nenhuma coleção/regra/índice Firestore nova foi necessária nos PRs #288/#289. |
| RN-08 | **[CORRIGIDO — commits `34a4c73` e `50a8a69`]** A data do procedimento no Histórico do Lote (tela e exportação Excel, `ReportsView.tsx`) é exibida por `formatarDataProcedimento` (`src/lib/precificacao.ts`), que usa a função pura `dataCalendarioDoProcedimento` (`src/lib/precificacao.ts`): data gravada **exatamente à meia-noite UTC** (cadastro/edição — `new Date('YYYY-MM-DD')`) é lida em UTC; qualquer outro horário (ex.: `Timestamp.now()` gravado na conclusão antecipada, UC-19 RN-07) é lido no fuso `America/Sao_Paulo`. Antes, a formatação no fuso do navegador mostrava o **dia anterior** para procedimentos cadastrados (data gravada à meia-noite UTC); uma correção intermediária (`34a4c73`, sempre UTC) fazia procedimentos concluídos antecipadamente entre 21:00 e 23:59 (Brasília) aparecerem com o dia seguinte. Mesma regra da lista e do detalhe de procedimentos (UC-19 RN-10). | Confirmado pelos diffs dos commits `34a4c73` e `50a8a69` em `src/components/reports/ReportsView.tsx` (`handleExportLotHistoryReport` e tabela do painel). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[Resolvido na implementação]** Geração de PDF via `jspdf` + `jspdf-autotable` (client-side, import dinâmico, mesmo padrão de `exportToExcel`), adicionadas como dependências no PR #289 (`feature/uc51-fechamento-executivo-mix-trimestral`). Sem Cloud Function, sem servidor de renderização. Decisão e alternativas descartadas (`pdfmake`, `@react-pdf/renderer`, `pdf-lib`, geração server-side) documentadas em `FEAT-relatorios-gerenciais-custeio-procedimento.md` (Seção 4). | Viabilidade técnica |
| RNF-02 | Sem paginação/limite: o Custo por Procedimento e o Histórico do Lote, assim como os relatórios já existentes de UC-47, devem lidar com o volume de `solicitacoes`/`inventory` do tenant sem filtro incremental — pode ficar lento para tenants com grande volume histórico (mesmo risco já registrado em UC-47/RNF-02). **[Aceito como trade-off na implementação]** — ver `FEAT-relatorios-gerenciais-custeio-procedimento.md`, Seção 4.3. | Escalabilidade |
| RNF-03 | Multi-tenant: todas as leituras devem ser escopadas por `tenants/{tenantId}/...`, mesmo padrão de todo o restante do sistema. **[Confirmado na implementação]** — nenhuma nova coleção/regra Firestore criada. | Multi-tenant |

---

## 11. Frequência de Uso
Não determinável — funcionalidade ainda não implementada. Presume-se uso mensal (Fechamento Executivo) e trimestral (Mix de Produtos) pela própria natureza dos relatórios, e uso mais esporádico/sob demanda para Custo por Procedimento e Histórico do Lote — mas isso é uma estimativa, não uma confirmação do usuário (ver Seção 14, item 5).

---

## 12. Casos de Uso Relacionados
- **UC-47 (Gerar Relatórios de Estoque, Vencimento e Consumo)** — os três relatórios já existentes; este UC estende a mesma família de funcionalidade (mesma tela, `/clinic/reports` — confirmado), sem duplicar nenhum dos três relatórios já cobertos lá.
- **UC-16/UC-17 (Registrar Procedimento Programado/Efetuado)** — fonte primária dos dados de consumo (`produtos_solicitados`) usados pelo motor de custeio deste UC.
- **UC-19 (Concluir ou Cancelar Procedimento Agendado)** — é quem efetivamente leva uma Solicitação a `status === 'concluida'`, o único status considerado pelo motor de custeio e pelo Histórico do Lote deste UC (RN-05, mesmo critério de UC-47/RN-03). UC-19 já referenciava este UC (como "UC-52"/"UC-53" em versões anteriores, corrigido para UC-51 na v1.1.2) quanto ao painel "Histórico do Lote".
- **UC-31/UC-32 (Cadastrar/Editar Produto no Catálogo Master)** — fonte do campo `category` (`MASTER_PRODUCT_CATEGORIES`) usado para agrupamento visual neste UC (RN-04 deixa explícito que a categoria em si não é o gap — é a ausência de preço de venda).
- **UC-52 (ex-UC-53, Motor de Recomendação/Projeção de Reposição, reservado)** — trata de projeção de quantidade a repor com base em consumo histórico; não reutiliza o motor de custeio financeiro deste UC (naturezas de cálculo distintas: quantidade vs. custo).

---

## 13. Referências
- `src/lib/services/reportService.ts` — estendido com `generateProcedureCostReport`, `generateLotHistoryReport`, `generateMonthlyExecutiveReport`, `generateQuarterlyMixReport` e o utilitário `exportToPdf` (implementados nos PRs #288/#289) — os três relatórios já existentes (`generateStockValueReport`, `generateExpirationReport`, `generateConsumptionReport`) permanecem intocados, apenas reaproveitados por composição.
- `src/lib/services/costingService.ts` — **novo**, motor de custeio puro (`groupConsumptionByProduct`, `calculateTicketMedioCusto`, `buildLotHistory`, `calculateMixPercentages`) + orquestradores Firestore (`getConsumptionRecords`, `getProductCostMetadata`).
- `src/__tests__/costingService.test.ts` — testes unitários do motor de custeio.
- `tests/e2e/UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.spec.ts` — caderno Playwright (10 cenários, gerado pelo `qa-agent` e revisado por humano).
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-relatorios-gerenciais-custeio-procedimento.md` (v1.1, Concluído) — spec de implementação derivada deste UC, com o plano completo, decisões de design e histórico de execução.
- `src/lib/services/solicitacaoService.ts` (`Solicitacao`, `ProdutoSolicitado` — fonte de dado do custeio).
- `src/lib/services/inventoryService.ts` (`InventoryItem.dt_entrada`, `InventoryItem.category` — usados para ordenação cronológica e agrupamento por categoria).
- `src/types/index.ts` (`InventoryItem`, `Solicitacao`, `ProdutoSolicitado`).
- `src/types/masterProduct.ts` (`MASTER_PRODUCT_CATEGORIES`).
- `src/components/reports/ReportsView.tsx` e `src/app/(clinic)/clinic/reports/page.tsx` — tela a ser estendida (confirmado com o usuário). **[v1.2.1]** Datas do Histórico do Lote via `formatarDataProcedimento`/`dataCalendarioDoProcedimento` (`src/lib/precificacao.ts`) — RN-08, commits `34a4c73` e `50a8a69`.
- `public/landing/sections-product.jsx` (Módulo 03 "Investimentos & ROI" e Módulo 04 "Relatórios gerenciais") — origem da promessa comercial que motivou este UC.
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 7.1, v3.9 e v3.10) — histórico completo da dupla reserva/descarte do número "UC-51".
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-47-gerar-relatorios-de-estoque-vencimento-e-consumo.md` — UC irmão, mesma família de funcionalidade.
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-19-concluir-ou-cancelar-procedimento-agendado.md` — referencia este UC (Seção 12, v1.1.2) quanto ao painel Histórico do Lote.

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Feature implementada (PRs #288/#289) — todos os itens desta seção estão resolvidos, incluindo o item 3 (biblioteca de PDF), a única pendência técnica não bloqueante que restava na v1.1. Mantidos aqui para rastreabilidade, conforme padrão já usado em outros UCs deste projeto.

1. **[Resolvido]** Ambiguidade técnica em RN-02 — confirmada com o usuário, com exemplo numérico (lote A: 10 un a R$ 5; lote B: 10 un a R$ 8; 12 un consumidas no período → custo total R$ 66,00, custo médio ponderado R$ 5,50). É a média ponderada pelo consumo real de cada lote fisicamente debitado — **não** um motor de custeio contábil por camadas de entrada independente do lote debitado na operação real (UC-16/UC-17).
2. **[Resolvido]** Localização de UI — confirmado: estender a mesma tela `/clinic/reports` (UC-47) com os novos cards, exatamente como proposto na v1.0 deste documento.
3. **[Resolvido na implementação]** RNF-01 — biblioteca de geração de PDF definida e implementada: `jspdf` + `jspdf-autotable`, client-side (import dinâmico, mesmo padrão de `exportToExcel`), sem Cloud Function nova. Decisão e alternativas descartadas (`pdfmake`, `@react-pdf/renderer`, `pdf-lib`, geração server-side) documentadas em `FEAT-relatorios-gerenciais-custeio-procedimento.md` (Seção 4).
4. **[Resolvido — mudança de escopo em relação à v1.0]** Histórico do Lote (RN-05) — confirmado: considera apenas Solicitações com `status === 'concluida'`, mesmo critério do motor de custeio e de UC-47/RN-03 (a v1.0 deste documento havia proposto "qualquer status" como ponto de partida; corrigido nesta versão).
5. **[Observação, não bloqueante]** Seção 11 (Frequência de Uso) é uma estimativa não confirmada, já que a funcionalidade não existe ainda.
6. **[Confirmado na implementação]** Este UC agrupa quatro capacidades relativamente distintas (custeio por procedimento, histórico do lote, fechamento mensal, mix trimestral) em um único documento, seguindo a decisão já consolidada em `_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.9/v3.10) de tratá-las como um único UC reservado. Na implementação, o `dev-task-manager` de fato fatiou o escopo em duas branches sequenciais (`feature/uc51-custeio-procedimento-historico-lote` e `feature/uc51-fechamento-executivo-mix-trimestral`, PRs #288/#289), sem dividir este UC em documentos separados — exatamente como autorizado aqui.
7. **[Achado do `qa-agent`, resolvido antes do merge, não bloqueante]** Durante a geração do caderno Playwright da Branch A (PR #288), constatou-se que `custo_unitario_medio` (RN-02) era calculado corretamente pelo motor de custeio mas não estava sendo exibido nem na UI nem no export Excel do relatório de Custo por Procedimento — corrigido com uma nova coluna "Custo Unitário Médio" antes do merge. Não altera a regra de negócio; registrado aqui apenas como achado de implementação.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 20/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Versão inicial. Primeiro UC deste projeto a documentar uma feature **ainda não implementada** (gap confirmado entre a landing page comercial e o sistema real). Incorpora as decisões desta elicitação: motor de custeio com custo médio ponderado por lote quando múltiplos lotes do mesmo produto são consumidos no período (RN-02, com ambiguidade técnica registrada na Seção 14, item 1); "ticket médio de custo" por linha de produto, sem envolver faturamento (RN-03); margem por categoria explicitamente fora de escopo, por ausência de dado de valor cobrado do paciente em todo o sistema (RN-04); painel Histórico do Lote herdado do primeiro "UC-51" descartado (RN-05); motor de custeio absorvido neste UC de Relatórios por não ter ator/gatilho/tela próprios, após ser cogitado como UC independente duas vezes (RN-06); ator único `clinic_admin` (decisão explícita, diferente de UC-47). Corrigida referência cruzada em UC-19 (v1.1.2) para apontar para este UC-51. Status: Rascunho, com 4 pendências na Seção 14 (RN-02, UI, PDF, Histórico do Lote). |
| 1.1 | 20/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Resolvidas 3 das 4 pendências da v1.0, após validação do usuário: **(1)** RN-02 confirmada com exemplo numérico (média ponderada pelo consumo real, não motor de camadas cronológicas) — flag de ambiguidade removida; **(2)** localização de UI confirmada (estender `/clinic/reports`) — flag removida da Seção 5/13; **(4)** RN-05 (Histórico do Lote) corrigida — passa a considerar apenas Solicitações `status === 'concluida'` (mudança de escopo em relação à proposta inicial "qualquer status" da v1.0); fluxo 7a (passo 2) e pré-condição (Seção 3) atualizados de acordo. Item 3 (RNF-01, ferramenta de geração de PDF) permanece como pendência técnica não bloqueante, deliberadamente adiada pelo usuário para a fase de implementação. Sem mais pendências bloqueantes, **Status alterado de "Rascunho" para "Aprovado"** — mesmo critério já usado em UC-19 (Aprovado, com RN-08 registrada como "decisão tomada, implementação pendente"): este documento representa decisões de design finalizadas, ainda que o código em si não exista (a existência de código corresponderia ao status "Implementado", não usado aqui). |
| 1.2 | 27/09/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Atualização de as-is: feature implementada e deployada.** Sinalizado pelo `uc-issues-tracker` (notas v3.34/v3.35 do `_MAPA-DE-BUGS-E-MELHORIAS.md`) que este UC ainda descrevia a feature como "não implementada" apesar do código já mergeado (PRs #288/#289, `gscandelari_setup`, `dev-gscandelari.web.app`). Introdução reescrita para refletir a implementação real; Seção 9 (RN-01 a RN-07) e Seção 10 (RNF-01 a RNF-03) anotadas confirmando implementação conforme desenhado — nenhuma RN precisou de ajuste de escopo na implementação; RNF-01 (biblioteca de PDF), a única pendência técnica não bloqueante restante da v1.1, resolvida com `jspdf`+`jspdf-autotable`; Seção 13 atualizada com os arquivos reais (`costingService.ts`, testes unitários, caderno Playwright) e referência à spec de implementação (`FEAT-relatorios-gerenciais-custeio-procedimento.md`, v1.1, Concluído); Seção 14 fecha o item 3 (PDF) e registra, como novo item 7, um achado do `qa-agent` (custo unitário médio calculado mas não exibido, corrigido antes do merge do PR #288) — não altera nenhuma regra de negócio. `**Status:**` alterado de "Aprovado" para "Implementado". |
| 1.2.1 | 10/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Correção de exibição de data no Histórico do Lote (as-is).** Nova RN-08 `[CORRIGIDO]`: a data do procedimento (tela e exportação Excel) passou a ser formatada por `formatarDataProcedimento` — `dataCalendarioDoProcedimento` lê em UTC a data gravada exatamente à meia-noite UTC (cadastro/edição) e no fuso `America/Sao_Paulo` qualquer outro horário (conclusão antecipada, UC-19 RN-07). Corrige o "dia anterior" das datas de cadastro (commit `34a4c73`) e o "dia seguinte" das conclusões antecipadas entre 21:00 e 23:59 (commit `50a8a69`, feature de precificação — UC-58). Fluxo Alternativo 7a (passo 3) e Referências atualizados. |
