# UC-51: Gerar Relatórios Gerenciais Avançados e Custeio por Procedimento

**Projeto:** Curva Mestra
**Data de Criação:** 20/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Relatórios
**Versão:** 1.1

> **Feature nova, ainda não implementada.** Um Clinic Admin gera, na tela de Relatórios, um conjunto de relatórios gerenciais adicionais aos três já existentes (UC-47): Custo por Procedimento (com custo médio ponderado quando múltiplos lotes do mesmo produto foram consumidos no período), Histórico do Lote (cross-reference de quais Procedimentos consumiram um lote específico), Fechamento Executivo Mensal e Mix de Produtos por Trimestre (ambos exportáveis em PDF). Este UC fecha uma lacuna entre o que a landing page comercial promete ("Módulo 03 — Investimentos & ROI" e "Módulo 04 — Relatórios gerenciais", `public/landing/sections-product.jsx`) e o que o sistema real entrega hoje — nenhum destes relatórios existe em código. **Não inclui margem nem ticket médio comercial** (decisão de produto: não existe, e não será criado agora, nenhum campo de valor cobrado do paciente/valor de tabela do procedimento — ver RN-04). Este UC também absorve, pela segunda vez consecutiva neste mapa (`_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.1, v3.9 e v3.10), um motor de cálculo ("custeio FIFO ponderado") que foi cogitado como UC-51 próprio duas vezes e descartado nas duas por não ter ator, gatilho ou tela independentes — a primeira vez foi o "Módulo Procedimentos" (absorvido em UC-19/RN-08), a segunda foi "Investimentos & ROI" (absorvido aqui, como parte do motor de custeio deste próprio UC de Relatórios). **Decisões de negócio já validadas com o usuário** (ver Seção 14 para o histórico de confirmação): método de custeio (RN-02), localização de UI (Seção 5) e escopo do Histórico do Lote (RN-05). Único ponto ainda em aberto, não bloqueante: a ferramenta técnica de geração de PDF (RNF-01), deliberadamente adiada para a fase de implementação.

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
3. Sistema exibe uma tabela cronológica: data do procedimento, identificador do Procedimento (ver UC-19/RN-08 — identificador de sessão `SES-XXXXXX`, quando implementado), quantidade consumida naquele evento, e saldo restante do lote após aquele evento.
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
| RN-01 | Quando um produto tem apenas um lote consumido no período, o custo do período é a soma direta de `quantidade × valor_unitario` de cada `ProdutoSolicitado` — o mesmo valor que já é somado hoje por `generateConsumptionReport` (UC-47). Este UC não recalcula nada nesse caso; apenas reapresenta o dado sob um recorte por procedimento/produto. | Confirmado por leitura de `solicitacaoService.ts` (`ProdutoSolicitado.valor_unitario` já é o custo real do lote debitado no momento do consumo) e `reportService.ts` (`generateConsumptionReport`). |
| RN-02 | Quando um produto tem mais de um lote consumido no mesmo período, o custo unitário médio exibido é a média ponderada pela quantidade **real** consumida de cada lote fisicamente debitado (não uma média aritmética simples entre os valores unitários dos lotes, e não um motor de custeio contábil por camadas de entrada cronológicas independente do lote efetivamente debitado): `custo_unitario_médio = Σ(quantidade_lote_i × valor_unitario_lote_i) ÷ Σ(quantidade_lote_i)`. Os lotes são listados em ordem cronológica de entrada (`InventoryItem.dt_entrada`, campo opcional já existente) apenas para fins de exibição/detalhamento — a ordenação não altera o valor do custo médio ponderado. **[Confirmado com o usuário, exemplo numérico]**: lote A entrou com 10 unidades a R$ 5,00, lote B entrou com 10 unidades a R$ 8,00; se no período foram fisicamente consumidas as 10 unidades do lote A + 2 unidades do lote B (conforme os registros reais de `ProdutoSolicitado`, 12 unidades no total), o custo total é `10×5 + 2×8 = R$ 66,00` e o custo médio ponderado é `R$ 66,00 ÷ 12 = R$ 5,50` — sempre a partir da combinação real de lotes efetivamente debitada nas Solicitações, nunca assumindo uma ordem de depleção teórica separada da operação real. | Decisão do usuário nesta elicitação ("custo médio ponderado por ordem de entrada — FIFO real"), **confirmada com exemplo numérico**: é a média ponderada por consumo real, não a leitura contábil alternativa de camadas de entrada independentes do lote fisicamente debitado. |
| RN-03 | "Ticket médio de custo" por linha de produto = custo total do produto no período ÷ número de Procedimentos (Solicitações concluídas) que consumiram aquele produto no período — **não** é dividido pela quantidade de unidades (isso seria "custo unitário médio", RN-02), e **não** é um valor de venda/faturamento (RN-04). | Interpretação de "ticket médio por linha de produto" (bullet da landing, `sections-product.jsx`, Módulo 03) decidida com o usuário nesta elicitação: métrica de custo/consumo, não de venda. |
| RN-04 | **[Fora de escopo, decisão explícita]** Margem por categoria (HA, toxina, bioestimulador…) **não é implementada** neste UC. Não existe, em nenhum lugar do sistema (`InventoryItem`, `ProdutoMaster`, `Solicitacao`/`ProdutoSolicitado`, `Protocolo`), nenhum campo de valor cobrado do paciente ou valor de tabela do procedimento — margem pressupõe conhecer esse dado, que o produto hoje não coleta. A promessa correspondente da landing (`sections-product.jsx`, Módulo 03, bullet "Margem por categoria") foi registrada para correção de texto em `_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.2. | Confirmado por leitura de `src/types/index.ts` (`InventoryItem`, `Solicitacao`, `ProdutoSolicitado`), `src/types/masterProduct.ts` (`MasterProduct`) e `protocoloService.ts`/`Protocolo` — nenhum tem campo de preço de venda/valor de tabela. Decisão de produto tomada nesta elicitação. |
| RN-05 | O painel "Histórico do Lote" (fluxo 7a) é um cross-reference de `ProdutoSolicitado.inventory_item_id` contra a coleção `solicitacoes`, considerando **apenas Solicitações com `status === 'concluida'`** — mesmo critério usado pelo motor de custeio (RN-01/RN-02/RN-03) e por UC-47/RN-03. Solicitações `agendada`/`efetuada` (reserva ainda não efetivada) **não** entram neste histórico. Mostra, para um lote específico, todos os Procedimentos concluídos que o consumiram, em ordem cronológica, com o saldo remanescente do lote após cada evento. | Escopo herdado do primeiro "UC-51" descartado (Módulo Procedimentos, v3.9 do mapa) — ver UC-19, Seção 12. Filtro por `status === 'concluida'` **confirmado com o usuário nesta elicitação** (decisão que restringiu a proposta inicial deste documento, que sugeria "qualquer status"). Nenhum código equivalente existe hoje (busca por "histórico do lote"/cross-reference de lote em `src/` não retornou nenhuma implementação). |
| RN-06 | O motor de custeio (RN-01/RN-02/RN-03) não introduz nenhuma tela, ator ou gatilho próprios — é consumido inteiramente pelos relatórios já descritos neste UC (Custo por Procedimento, Fechamento Executivo, Mix Trimestral). Foi cogitado como UC próprio duas vezes nesta base de conhecimento (`_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.1, v3.9 e v3.10) e descartado nas duas por não passar no critério de "ator com objetivo observável" (Cockburn) — decisão de julgamento profissional tomada em conjunto com o usuário nesta elicitação. | Decisão registrada em `_MAPA-DE-BUGS-E-MELHORIAS.md` v3.10 (nota da atualização) e nesta conversa de elicitação. |
| RN-07 | Todos os relatórios deste UC são calculados client-side a partir das mesmas coleções já usadas por UC-47 (`tenants/{tenantId}/inventory`, `tenants/{tenantId}/solicitacoes`) — nenhuma nova coleção Firestore é necessária. A segurança/isolamento multi-tenant depende da mesma regra genérica já usada por UC-47 (`tenants/{tenantId}/{document=**}`). | Extrapolado do padrão já confirmado em UC-47/RN-06, aplicável aqui por reaproveitar as mesmas fontes de dado — nenhuma nova regra Firestore é necessária, mas isso só será verificado de fato na implementação. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[Decisão técnica deliberadamente adiada pelo usuário, não bloqueante para aprovação deste UC]** Nenhuma biblioteca de geração de PDF existe hoje no projeto (`package.json` não lista `jspdf`, `pdfmake`, `react-pdf`, `pdf-lib`; `functions/src/` não tem geração de PDF server-side). A implementação do Fechamento Executivo e do Mix Trimestral (fluxos 7b/7c) depende de uma escolha técnica (client-side vs. server-side/Cloud Function) a ser feita pelo `dev-task-manager` na fase de planejamento de implementação. | Viabilidade técnica |
| RNF-02 | Sem paginação/limite: o Custo por Procedimento e o Histórico do Lote, assim como os relatórios já existentes de UC-47, devem lidar com o volume de `solicitacoes`/`inventory` do tenant sem filtro incremental — pode ficar lento para tenants com grande volume histórico (mesmo risco já registrado em UC-47/RNF-02). | Escalabilidade |
| RNF-03 | Multi-tenant: todas as leituras devem ser escopadas por `tenants/{tenantId}/...`, mesmo padrão de todo o restante do sistema. | Multi-tenant |

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
- `src/lib/services/reportService.ts` — arquivo existente a ser estendido; os três relatórios atuais (`generateStockValueReport`, `generateExpirationReport`, `generateConsumptionReport`) servem de base/padrão de implementação. Nomes de novas funções (ex.: `generateProcedureCostReport`, `generateLotHistoryReport`, `generateMonthlyExecutiveReport`, `generateQuarterlyMixReport`) são **propostas deste documento**, não código existente.
- `src/lib/services/solicitacaoService.ts` (`Solicitacao`, `ProdutoSolicitado` — fonte de dado do custeio).
- `src/lib/services/inventoryService.ts` (`InventoryItem.dt_entrada`, `InventoryItem.category` — usados para ordenação cronológica e agrupamento por categoria).
- `src/types/index.ts` (`InventoryItem`, `Solicitacao`, `ProdutoSolicitado`).
- `src/types/masterProduct.ts` (`MASTER_PRODUCT_CATEGORIES`).
- `src/components/reports/ReportsView.tsx` e `src/app/(clinic)/clinic/reports/page.tsx` — tela a ser estendida (confirmado com o usuário).
- `public/landing/sections-product.jsx` (Módulo 03 "Investimentos & ROI" e Módulo 04 "Relatórios gerenciais") — origem da promessa comercial que motivou este UC.
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 7.1, v3.9 e v3.10) — histórico completo da dupla reserva/descarte do número "UC-51".
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-47-gerar-relatorios-de-estoque-vencimento-e-consumo.md` — UC irmão, mesma família de funcionalidade.
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-19-concluir-ou-cancelar-procedimento-agendado.md` — referencia este UC (Seção 12, v1.1.2) quanto ao painel Histórico do Lote.

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Todos os itens bloqueantes desta seção foram resolvidos. Mantidos aqui para rastreabilidade (incluindo os já resolvidos, conforme padrão já usado em outros UCs deste projeto) e para a única pendência técnica remanescente (item 3, não bloqueante).

1. **[Resolvido]** Ambiguidade técnica em RN-02 — confirmada com o usuário, com exemplo numérico (lote A: 10 un a R$ 5; lote B: 10 un a R$ 8; 12 un consumidas no período → custo total R$ 66,00, custo médio ponderado R$ 5,50). É a média ponderada pelo consumo real de cada lote fisicamente debitado — **não** um motor de custeio contábil por camadas de entrada independente do lote debitado na operação real (UC-16/UC-17).
2. **[Resolvido]** Localização de UI — confirmado: estender a mesma tela `/clinic/reports` (UC-47) com os novos cards, exatamente como proposto na v1.0 deste documento.
3. **[Pendência técnica não bloqueante, mantida — decisão deliberadamente adiada pelo usuário]** RNF-01 — não existe biblioteca de geração de PDF no projeto hoje. A escolha técnica (client-side vs. server-side/Cloud Function) fica para o `dev-task-manager`, na fase de planejamento de implementação, e não impede a aprovação deste UC.
4. **[Resolvido — mudança de escopo em relação à v1.0]** Histórico do Lote (RN-05) — confirmado: considera apenas Solicitações com `status === 'concluida'`, mesmo critério do motor de custeio e de UC-47/RN-03 (a v1.0 deste documento havia proposto "qualquer status" como ponto de partida; corrigido nesta versão).
5. **[Observação, não bloqueante]** Seção 11 (Frequência de Uso) é uma estimativa não confirmada, já que a funcionalidade não existe ainda.
6. **[Observação, não bloqueante]** Este UC agrupa quatro capacidades relativamente distintas (custeio por procedimento, histórico do lote, fechamento mensal, mix trimestral) em um único documento, seguindo a decisão já consolidada em `_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.9/v3.10) de tratá-las como um único UC reservado. Se o `dev-task-manager`, ao planejar a implementação, considerar o escopo grande demais para uma única entrega, pode fatiar em múltiplas tasks/PRs sem que isso exija dividir este UC em documentos separados.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 20/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Versão inicial. Primeiro UC deste projeto a documentar uma feature **ainda não implementada** (gap confirmado entre a landing page comercial e o sistema real). Incorpora as decisões desta elicitação: motor de custeio com custo médio ponderado por lote quando múltiplos lotes do mesmo produto são consumidos no período (RN-02, com ambiguidade técnica registrada na Seção 14, item 1); "ticket médio de custo" por linha de produto, sem envolver faturamento (RN-03); margem por categoria explicitamente fora de escopo, por ausência de dado de valor cobrado do paciente em todo o sistema (RN-04); painel Histórico do Lote herdado do primeiro "UC-51" descartado (RN-05); motor de custeio absorvido neste UC de Relatórios por não ter ator/gatilho/tela próprios, após ser cogitado como UC independente duas vezes (RN-06); ator único `clinic_admin` (decisão explícita, diferente de UC-47). Corrigida referência cruzada em UC-19 (v1.1.2) para apontar para este UC-51. Status: Rascunho, com 4 pendências na Seção 14 (RN-02, UI, PDF, Histórico do Lote). |
| 1.1 | 20/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Resolvidas 3 das 4 pendências da v1.0, após validação do usuário: **(1)** RN-02 confirmada com exemplo numérico (média ponderada pelo consumo real, não motor de camadas cronológicas) — flag de ambiguidade removida; **(2)** localização de UI confirmada (estender `/clinic/reports`) — flag removida da Seção 5/13; **(4)** RN-05 (Histórico do Lote) corrigida — passa a considerar apenas Solicitações `status === 'concluida'` (mudança de escopo em relação à proposta inicial "qualquer status" da v1.0); fluxo 7a (passo 2) e pré-condição (Seção 3) atualizados de acordo. Item 3 (RNF-01, ferramenta de geração de PDF) permanece como pendência técnica não bloqueante, deliberadamente adiada pelo usuário para a fase de implementação. Sem mais pendências bloqueantes, **Status alterado de "Rascunho" para "Aprovado"** — mesmo critério já usado em UC-19 (Aprovado, com RN-08 registrada como "decisão tomada, implementação pendente"): este documento representa decisões de design finalizadas, ainda que o código em si não exista (a existência de código corresponderia ao status "Implementado", não usado aqui). |

