# Inventário de Relatórios — Curva Mestra

**Projeto:** Curva Mestra
**Data de Criação:** 03/10/2026
**Última Atualização:** 03/10/2026
**Autor:** Claude (pedido direto do usuário)
**Fonte:** leitura direta do código em `develop` (`a8a98fd`) — sem execução da aplicação
**Versão:** 1.0
**Status:** Aguardando priorização do PO

> Levantamento de todos os relatórios e saídas de dados que o sistema gera hoje, por perfil (Clínica, Consultor e System Admin), seguido dos pontos de melhoria identificados e dos candidatos a novos relatórios. Serve como base para o PO decidir o que alterar, o que unificar e o que criar. Os itens de roadmap da Seção 5 também estão registrados em [`_MAPA-DE-BUGS-E-MELHORIAS.md`](_MAPA-DE-BUGS-E-MELHORIAS.md), Seção 8.4.

---

## 1. Como ler este documento

- **"Relatório"** aqui inclui qualquer tela que consolida dados para consulta ou exportação: relatórios formais, painéis (dashboards), projeção, trilha de auditoria e exportações de listagem.
- **Exporta** indica o formato disponível hoje. "—" significa que a tela não exporta.
- Toda a lógica de geração dos relatórios formais está em `src/lib/services/reportService.ts`; a UI está em `src/components/reports/ReportsView.tsx`.
- Nenhum relatório é gerado no servidor: todos são calculados no client, lendo o Firestore com o SDK do usuário logado (sujeitos às regras de `firestore.rules`).

---

## 2. Clínica (`clinic_admin` / `clinic_user`)

### 2.1 Tela "Relatórios" — `/clinic/reports`

| # | Relatório | UC | Perfil | Conteúdo | Filtro | Exporta | Função |
|---|---|---|---|---|---|---|---|
| C-01 | **Valor do Estoque** | [UC-47](UC-47-gerar-relatorios-de-estoque-vencimento-e-consumo.md) | admin + user | Total de produtos, total de itens e valor total em R$; detalhamento por produto (quantidade, valor unitário, valor total, nº de lotes), ordenado por valor | — | Excel | `generateStockValueReport` |
| C-02 | **Produtos Vencendo** | [UC-47](UC-47-gerar-relatorios-de-estoque-vencimento-e-consumo.md) | admin + user | Lotes vencidos e a vencer nos próximos X dias, com dias para vencer, valor em risco e aviso de itens com validade ilegível (`itens_ignorados`) | Dias de antecedência | Excel | `generateExpirationReport` |
| C-03 | **Consumo por Período** | [UC-47](UC-47-gerar-relatorios-de-estoque-vencimento-e-consumo.md) | admin + user | Procedimentos concluídos no intervalo; quantidade e valor consumidos por produto | Data início / fim | Excel | `generateConsumptionReport` |
| C-04 | **Custo por Procedimento** | [UC-51](UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.md) | só admin | Custo total do período, ticket médio de custo e custo médio ponderado por produto (quando há vários lotes) | Data início / fim | Excel | `generateProcedureCostReport` |
| C-05 | **Histórico do Lote** | [UC-51](UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.md) | só admin | Linha do tempo de consumo de um lote, com saldo remanescente após cada procedimento | Produto + lote | Excel | `generateLotHistoryReport` |
| C-06 | **Fechamento Executivo Mensal** | [UC-51](UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.md) | só admin | Valor em estoque, custo consumido no mês, procedimentos concluídos e top 5 produtos por custo | Mês / ano | PDF | `generateMonthlyExecutiveReport` |
| C-07 | **Mix de Produtos por Trimestre** | [UC-51](UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.md) | só admin | Participação percentual de cada produto no custo total do trimestre | Trimestre / ano | PDF | `generateQuarterlyMixReport` |

### 2.2 Outras telas da Clínica

| # | Relatório | UC | Rota | Perfil | Conteúdo | Exporta |
|---|---|---|---|---|---|---|
| C-08 | **Inventário** | [UC-50](UC-50-consultar-inventario-e-detalhe-do-item-de-estoque.md) | `/clinic/inventory` | admin + user | Lista de lotes filtrada: código, produto, lote, quantidade total/reservada/disponível, validade, valor unitário, NF | Excel |
| C-09 | **Projeção de Reposição** | [UC-52](UC-52-consultar-projecao-de-reposicao-de-estoque.md) | `/clinic/inventory/projections` | admin + user | Por produto: quantidade disponível, taxa de consumo diária, data estimada de ruptura, janela de cálculo usada | — |
| C-10 | **Trilha de Auditoria** | [UC-53](UC-53-consultar-e-exportar-trilha-de-auditoria.md) | `/clinic/audit-log` | só admin | Eventos auditados do próprio tenant, com filtros | CSV + PDF |
| C-11 | **Painel (Dashboard)** | — | `/clinic/dashboard` | admin + user | Cards: Estoque, Procedimentos, Alertas, Projeção de Reposição, Próximos Procedimentos, Atividade Recente, Produtos a Vencer | — |

---

## 3. Consultor Rennova (`consultant`)

| # | Relatório | UC | Rota | Conteúdo | Exporta |
|---|---|---|---|---|---|
| R-01 | **Estoque da Clínica** (somente leitura) | [UC-48](UC-48-consultar-clinicas-vinculadas-e-estoque.md) | `/consultant/clinics/[tenantId]/inventory` | Mesmo `InventoryView` da clínica, em modo `readOnly` | Excel (com Valor Unitário e NF — ver REL-06) |
| R-02 | **Projeção de Reposição por Clínica** | [UC-52](UC-52-consultar-projecao-de-reposicao-de-estoque.md) | `/consultant/clinics/[tenantId]/projections` | Mesmo `ProjectionsView` da clínica | — |
| R-03 | **Painel (Dashboard)** | — | `/consultant/dashboard` | Clínicas vinculadas, busca de clínicas e projeção de reposição consolidada de todas as clínicas | — |
| R-04 | **Tela "Relatórios"** | — | `/consultant/reports` | **Placeholder "Em Desenvolvimento".** Mostra apenas o seletor de clínica e 3 cards desabilitados: *Consolidado de Estoque*, *Consumo por Período* e *Alertas Consolidados* | — |

> Observação técnica: `ReportsView` já aceita as props `readOnly` e `backUrl`, pensadas para reuso no portal do consultor, mas nenhuma rota do consultor usa o componente hoje.

---

## 4. System Admin (`system_admin`)

| # | Relatório | UC | Rota | Conteúdo | Exporta |
|---|---|---|---|---|---|
| A-01 | **Trilha de Auditoria entre clínicas** | [UC-53](UC-53-consultar-e-exportar-trilha-de-auditoria.md) | `/admin/audit-log` | Eventos auditados de todos os tenants, com filtro por clínica | CSV + PDF |
| A-02 | **Painel (Dashboard)** | — | `/admin/dashboard` | Total de clínicas, clínicas ativas, total de usuários, usuários ativos, atividade recente | — |

O System Admin **não tem nenhum relatório gerencial de negócio** (uso por clínica, importações de NF-e, produtos pendentes, consultores, acessos).

### 4.1 Saídas automáticas (sem tela de relatório)

| # | Saída | Onde | O que faz |
|---|---|---|---|
| S-01 | **Verificação diária de alertas** | `functions/src/checkAlertsScheduled.ts` (todo dia às 06:00) | Gera notificações de vencimento e estoque baixo por tenant. Não envia resumo/relatório por e-mail. |

---

## 5. Roadmap — Melhorias e Novos Relatórios

Todos os itens abaixo estão com status **Aberto / aguardando decisão do PO**. Nenhuma correção ou implementação foi feita. Severidade/prioridade não foi atribuída — cabe ao PO.

### 5.1 Melhorias em relatórios existentes

| ID | Item | Afeta | Descrição |
|---|---|---|---|
| REL-01 | **Padronizar formatos de exportação** | C-01 a C-07, C-10, A-01 | C-01 a C-05 exportam só Excel; C-06 e C-07 só PDF; a Trilha de Auditoria usa `exportToCSV`, marcado como `@deprecated` em `reportService.ts` em favor de `exportToExcel`. Decidir um padrão (ex.: Excel + PDF em todos) e remover o CSV legado. |
| REL-02 | **Exportação da Projeção de Reposição** | C-09, R-02 | A projeção não exporta em nenhum perfil. É o insumo natural para o pedido de compra da clínica e para a visita do consultor. |
| REL-03 | **Sobreposição Consumo por Período × Custo por Procedimento** | C-03, C-04 | Os dois leem as mesmas solicitações concluídas e o mesmo `valor_unitario` gravado em cada item, chegando ao mesmo valor total. A diferença é que C-04 traz ticket médio e custo ponderado por lote, mas é só para admin. Decidir se unificam, se C-03 vira a "versão resumida" para `clinic_user` ou se ficam como estão. |
| REL-04 | **Nome "Produtos Vencendo" inclui vencidos** | C-02 | Já registrado como `UC-47-RN-01` (Baixa, Aberto) no mapa. Listado aqui só para consolidar o roadmap de relatórios. |
| REL-05 | **Dashboards sem exportação nem recorte de período** | C-11, R-03, A-02 | Os painéis mostram só o estado atual. Avaliar se algum indicador deve ganhar histórico ou exportação, ou se isso fica a cargo dos relatórios formais. |
| REL-06 | **Exportação de inventário do consultor inclui dados financeiros/fiscais** | R-01 | O Excel exportado pelo consultor traz `Valor Unitário` e `NF`. Precisa ser alinhado com o requisito de consentimento do `clinic_admin` para compartilhar dados fiscais com o consultor (mapa, Seção 8.3), que diz que por padrão esse acesso é restrito ao `clinic_admin`. |

### 5.2 Novos relatórios — Consultor

| ID | Item | Descrição |
|---|---|---|
| REL-07 | **Tela de Relatórios do Consultor** | Substituir o placeholder de `/consultant/reports` (R-04). Os 3 relatórios já anunciados na tela são: **Consolidado de Estoque** (todas as clínicas vinculadas), **Consumo por Período** e **Alertas Consolidados** (vencimento/estoque baixo em todas as clínicas). Precisa de decisão sobre quais dados financeiros o consultor pode ver (ver REL-06 e mapa 8.3). |
| REL-08 | **Sugestão de Pedido Rennova** | Spec já existente: [`FEAT-sugestao-pedido-consultor.md`](../TO_DO/FEAT-sugestao-pedido-consultor.md) (Planejamento, 08/05/2026). Tem sobreposição com a Projeção de Reposição (UC-52, já implementada) — o spec precisa ser revisto antes da execução para reaproveitar `projectionService`. |
| REL-09 | **Curva ABC de Consumo** | Spec já existente: [`FEAT-relatorio-curva-abc.md`](../TO_DO/FEAT-relatorio-curva-abc.md) (Planejamento, 08/05/2026). Prevê acesso para clínica (todos os produtos) e consultor (só Rennova, somente leitura). Não implementado. |

### 5.3 Novos relatórios — Clínica

| ID | Item | Descrição |
|---|---|---|
| REL-10 | **Custo por tipo de procedimento** | Spec existente: [`FEAT-relatorio-custo-por-procedimento.md`](../TO_DO/FEAT-relatorio-custo-por-procedimento.md) (Planejamento, 08/05/2026). **Parcialmente coberto pelo UC-51**: o C-04 agrupa custo **por produto**, mas o spec pede agrupamento **por tipo de procedimento** (template ou `descricao`) com detalhamento de materiais. Revisar o spec para cobrir só o que falta. |

### 5.4 Novos relatórios — System Admin

| ID | Item | Descrição |
|---|---|---|
| REL-11 | **Relatórios gerenciais do System Admin** | Não existe nenhum hoje. Candidatos levantados (a validar com o PO): uso por clínica (procedimentos, importações, usuários ativos), importações de NF-e por status (`success`/`error`/`novo_produto_pendente`), fila de produtos pendentes de cadastro, consultores × clínicas vinculadas, e acessos/logins por período. Nenhum UC cobre isso. |

### 5.5 Novas saídas automáticas

| ID | Item | Descrição |
|---|---|---|
| REL-12 | **Resumo periódico por e-mail** | Hoje a verificação diária (S-01) só gera notificações no sistema. Avaliar um resumo semanal/mensal por e-mail (ex.: vencimentos da semana, fechamento do mês) para `clinic_admin` e consultor, reaproveitando a infraestrutura de templates de e-mail (UC-55). |

### 5.6 Arrumação de documentação

| ID | Item | Descrição |
|---|---|---|
| REL-13 | **Spec duplicado entre TO_DO e TASK_COMPLETED** | `FEAT-reformulacao-dashboard-clinica.md` existe nas duas pastas (`TO_DO` com status "Aguardando execução"). Confirmar qual é o vigente e remover a cópia obsoleta. |
| REL-14 | **UCs de relatórios ainda em Rascunho** | UC-47 (v1.0.3) e UC-48 (v1.0.1) seguem com status "Rascunho", enquanto UC-51, UC-52 e UC-53 já estão "Implementado". |

---

## 6. Próximos passos sugeridos

1. O PO revisa a Seção 5 e marca, item a item, **implementar / alterar / descartar** e a prioridade.
2. Para cada item aprovado que mude comportamento: `uml-use-case-writer` atualiza ou cria o UC → `doc-writer` gera o spec em `ONLY_FOR_DEVS/TO_DO/` → `dev-task-manager` cria a branch a partir de `develop`.
3. Todo relatório novo ou alterado precisa do caderno de teste Playwright correspondente (CLAUDE.md, §8), gerado pelo `qa-agent`.
4. Conforme os itens forem decididos ou concluídos, atualizar este documento e a Seção 8.4 do mapa.

---

## 7. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 03/10/2026 | Claude (pedido direto do usuário) | Levantamento inicial: 11 relatórios/saídas da Clínica, 4 do Consultor (1 placeholder), 2 do System Admin e 1 saída automática; 14 itens de roadmap (REL-01 a REL-14). |
