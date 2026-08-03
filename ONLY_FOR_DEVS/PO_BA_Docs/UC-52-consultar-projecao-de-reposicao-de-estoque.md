# UC-52: Consultar Projeção de Reposição de Estoque

**Projeto:** Curva Mestra
**Data de Criação:** 21/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário / Portal do Consultor
**Versão:** 1.0

> Feature nova, ainda não implementada — reservada como **UC-52** em `_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 7.1, "Motor de Recomendação/Projeção de Reposição"), atendendo à promessa da landing page (Módulo 03 "Investimentos & ROI" — "Projeção de necessidade de reposição"; Módulo 05 "Linha direta com o consultor" — "Sugestão de reposição calculada pelo sistema", parcialmente). Um `clinic_admin`/`clinic_user` (na própria clínica) ou um Consultor Rennova vinculado (nas clínicas vinculadas a ele) consultam, para cada produto do estoque, uma **data estimada de esgotamento** (`quantidade_disponivel` chegando a zero), calculada a partir da taxa de consumo histórico real (`Solicitacao` com `status == 'concluida'`). É puramente uma tela de **projeção** ("quando vai faltar") — a "sugestão de quantidade a pedir" fica fora de escopo desta versão (ver Seção 14). Assim como o UC-51, este documento fecha o desenho (decisões de produto já tomadas com o usuário) antes de o código ser implementado.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    ClinicUser([👤 Clinic User])
    Consultor([👤 Consultor Rennova\nvinculado à clínica])

    subgraph Sistema["Curva Mestra"]
        UC52(("UC-52\nConsultar Projeção de\nReposição de Estoque"))
        UC48(("UC-48\nConsultar Clínicas\nVinculadas e Estoque"))
        UC47(("UC-47\nGerar Relatórios de Estoque,\nVencimento e Consumo"))
        UC15(("UC-15\nConfigurar Limite de\nEstoque Baixo por Produto"))
    end

    ClinicAdmin --> UC52
    ClinicUser --> UC52
    Consultor -.->|"<<extend>>\nrequer extensão de acesso\n(RN-08), ver UC-48"| UC52
    UC48 -.->|clínicas vinculadas\naqui aparecem em| UC52
    UC52 -.->|mesma fonte de dado\n(Solicitacao concluída)| UC47
    UC52 -.->|mesma convenção de\nagregação por código de produto| UC15
    UC52 -.->|GET, somente leitura| Firestore[(Firestore\ninventory + solicitacoes)]
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** e **Clinic User** — consultam a projeção da própria clínica, dentro de "Gerenciar Estoque" (`/clinic/inventory`). Por ser uma tela somente-leitura de visualização de estoque (mesma natureza de `/clinic/inventory`, UC-13), não há restrição adicional de role: ambos os papéis têm o mesmo acesso, seguindo o padrão já usado no restante do módulo de Inventário (diferente de UC-15, que é exclusivo de `clinic_admin` por envolver configuração, não apenas consulta).

**Consultor Rennova vinculado** — consulta a mesma projeção, com a mesma visão completa (produto, data prevista, quantidade), mas apenas para as clínicas vinculadas à sua conta (`authorized_tenants`). Esta é uma **extensão de escopo deliberada**: hoje (UC-48) o consultor só lê o inventário (`quantidade_disponivel`/`dt_validade`) de cada clínica vinculada — nunca dados de consumo/procedimentos (`Solicitacao`). Este UC estende essa consulta para incluir a leitura de `Solicitacao` (necessária para calcular a taxa de consumo), sem abrir nenhum outro tipo de dado além do já lido por UC-48 mais o histórico de consumo agregado usado apenas para o cálculo da projeção (ver RN-08/RN-09).

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo. Os dados usados são os mesmos já geridos pelos módulos de Inventário (`tenants/{tenantId}/inventory`, UC-10 a UC-14) e de Procedimentos (`tenants/{tenantId}/solicitacoes`, UC-16 a UC-19), sem nenhuma cópia/denormalização própria — a projeção é sempre recalculada a partir desses dados no momento da consulta.

---

## 3. Pré-condições
- Usuário autenticado com `tenant_id` definido (Clinic Admin/Clinic User) **ou** `is_consultant === true` e `authorized_tenants` contendo o `tenantId` consultado (Consultor).
- Existe pelo menos um item de inventário ativo (`active == true`) no tenant — senão não há nenhum produto para projetar.
- Para o card no Dashboard exibir uma contagem "próxima", pelo menos um produto precisa ter dados de consumo suficientes (RN-03) dentro de uma das três janelas avaliadas (90/60/30 dias); caso contrário, o card exibe o estado vazio (Fluxo Alternativo 7b).

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Nenhum dado é alterado em nenhuma das telas deste UC — é inteiramente uma consulta/cálculo, sem escrita no Firestore.
- **Card no Dashboard** (`/clinic/dashboard` e `/consultant/dashboard`): exibe a contagem de produtos cuja data estimada de esgotamento cai dentro de um horizonte de destaque (próximos 30 dias), com um link para a tela detalhada.
- **Tela "Projeções Gerais"** (`/clinic/inventory/projections` e `/consultant/clinics/{tenantId}/projections`): exibe, para cada `codigo_produto` ativo do tenant, a quantidade total disponível, a taxa de consumo diária calculada, a data estimada de esgotamento e a janela de histórico efetivamente usada (90, 60 ou 30 dias) — sempre com um aviso visível de que é uma estimativa baseada em histórico (RN-04). Produtos com dados insuficientes aparecem explicitamente marcados como tal, nunca com uma data inventada.
- O Consultor vê exatamente a mesma informação (produto, data prevista, quantidade, janela usada) que a clínica veria para o mesmo tenant — sem nenhuma versão resumida ou agregada (RN-09).

### 4.2 Falha (Garantias Mínimas)
- Nenhuma alteração é feita. Se o cálculo falhar (erro de rede/permissão ao ler `inventory` ou `solicitacoes`), a tela deve exibir um erro visível ao ator (toast), permitindo nova tentativa — ver RNF-04 (recomendação de design para não repetir o padrão de falha silenciosa já encontrado em outras telas do sistema, ex. UC-48 RNF-01).

---

## 5. Gatilho (Trigger)
Automático do ponto de vista do ator — a projeção é calculada **ao carregar a tela** (Dashboard da clínica, Dashboard do Consultor, ou a tela "Projeções Gerais"/"Projeções" correspondente), sem exigir nenhum clique em um botão do tipo "Executar Verificações" (diferente do padrão manual de UC-42). Tecnicamente, continua sendo um cálculo **sob demanda** (client-side, a cada carregamento de tela) — não há nenhuma Cloud Scheduled Function nova envolvida; mantém o mesmo padrão de "tudo calculado sob demanda" já observado em todo o sistema (UC-15, UC-42, UC-47), apenas com o gatilho sendo "abrir a tela" em vez de "clicar em um botão explícito".

---

## 6. Fluxo Principal (Basic Flow)

1. Clinic Admin ou Clinic User acessa `/clinic/dashboard` (ou o Consultor acessa `/consultant/dashboard`).
2. Ao carregar a tela, o sistema calcula, em paralelo e por `codigo_produto` (agregando todos os lotes ativos, mesma convenção de UC-15):
   a. a quantidade total disponível (`quantidade_disponivel` somada de `tenants/{tenantId}/inventory`, `active == true`);
   b. a taxa de consumo diária, a partir de `tenants/{tenantId}/solicitacoes` com `status == 'concluida'`, usando a janela de histórico mais recente que tiver dados suficientes (cascata 90 → 60 → 30 dias — RN-03);
   c. a data estimada de esgotamento: hoje + (quantidade total disponível ÷ taxa de consumo diária) — RN-01/RN-02/RN-06.
3. Sistema filtra os produtos cuja data estimada caia dentro do horizonte de destaque (próximos 30 dias) e exibe um card "Projeção de Reposição" no Dashboard, com a contagem desses produtos e um botão/link para a tela detalhada.
4. Ator clica no link do card.
5. Sistema navega para a tela detalhada: `/clinic/inventory/projections` ("Projeções Gerais", nova subpágina dentro de "Gerenciar Estoque") no caso da clínica, ou `/consultant/clinics/{tenantId}/projections` no caso do Consultor (a partir da tela de detalhe de uma clínica vinculada, `/consultant/clinics/{tenantId}`, UC-48).
6. Sistema exibe uma tabela com todos os produtos ativos do tenant: código, nome, quantidade total disponível, taxa de consumo diária, data estimada de esgotamento (ordenada da mais próxima para a mais distante) e um aviso fixo indicando a janela de histórico usada em cada linha (ex.: "Estimativa baseada nos últimos 90 dias de consumo").
7. Caso de uso é concluído a qualquer momento em que o ator navega para fora dessas telas — nenhuma ação de escrita é realizada.

---

## 7. Fluxos Alternativos

### 7a. Produto com dados insuficientes mesmo na janela mais curta (a partir do passo 2b/6)
1. Nenhuma das três janelas (90/60/30 dias) atinge o critério mínimo de dados suficientes (RN-03) para aquele `codigo_produto`.
2. Sistema não calcula nenhuma data estimada para esse produto; a linha correspondente exibe "Dados insuficientes para projeção" em vez de uma data.
3. Esse produto não é contado na contagem do card resumo do Dashboard (passo 3 do fluxo principal).

### 7b. Nenhum produto com projeção próxima (a partir do passo 3)
1. Nenhum produto tem data estimada dentro do horizonte de destaque (30 dias) — seja porque a data está mais distante, seja porque não há dados suficientes para nenhum produto.
2. Sistema exibe o card do Dashboard em estado vazio: "Nenhum produto com previsão de reposição próxima", sem contagem em destaque.

### 7c. Consultor acessa a tela de projeções de uma clínica vinculada (a partir do passo 5)
1. Consultor navega para `/consultant/clinics/{tenantId}/projections`.
2. Sistema verifica `authorizedTenants.includes(tenantId)` — mesma verificação já usada em UC-48; se o `tenantId` não estiver autorizado, o Consultor é redirecionado para `/consultant/clinics`, sem carregar nenhum dado da clínica solicitada.

---

## 8. Fluxos de Exceção

### 8a. Falha ao calcular a projeção (a partir do passo 2 do fluxo principal, em qualquer tela)
1. A leitura de `inventory` ou de `solicitacoes` lança exceção (rede, permissão).
2. Sistema exibe um erro visível (toast, seguindo o padrão já adotado no restante do sistema — ver RNF-04) e permite nova tentativa; nenhum dado parcial ou desatualizado é exibido como se fosse uma projeção válida.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A taxa de consumo diária de um produto é calculada somando `quantidade` de `ProdutoSolicitado` (dentro de `Solicitacao` com `status == 'concluida'`) que contenham aquele `produto_codigo`, dentro da janela de histórico usada, dividido pelo número de dias da janela. Mesma fonte de dado já usada pelo Relatório de Consumo (UC-47, `generateConsumptionReport`), mas agregada por produto (não por procedimento) para fins de taxa. | Decisão do usuário (item 1/5 do repasse de decisões); consistente com a definição de "consumo real" já usada em UC-47 (RN-03, apenas solicitações `concluida`). |
| RN-02 | A data estimada de esgotamento é `hoje + (quantidade_disponivel_total_do_produto ÷ taxa_de_consumo_diária)`, arredondada para cima em dias. Se a taxa de consumo diária calculada for zero (nenhum consumo na janela usada), nenhuma data é projetada — cai no caso de "dados insuficientes" (RN-03). | Decisão do usuário (item 4): evento-alvo é a data prevista de **zerar** o estoque, não a data de cruzar o limite de estoque baixo (`stock_limits`/UC-15). |
| RN-03 | **[Proposto pelo uml-use-case-writer — ver Seção 14]** Critério de "dados suficientes" para uma janela ser considerada válida: existirem pelo menos **2 `Solicitacao` distintas com `status == 'concluida'`**, envolvendo o mesmo `produto_codigo`, com `dt_procedimento` em **datas de calendário diferentes**, dentro da janela avaliada. Cascata: tenta 90 dias primeiro; se não satisfizer o critério, tenta 60; se não satisfizer, tenta 30; se mesmo em 30 dias o critério não for satisfeito, o produto entra no Fluxo Alternativo 7a ("dados insuficientes"). | Decisão do usuário (item 5): "pelo menos 2 eventos de consumo em datas diferentes" foi o critério sugerido no repasse como exemplo objetivo; adotado como proposta a validar tecnicamente antes da implementação (não bloqueia a aprovação deste UC). |
| RN-04 | Toda vez que uma data estimada é exibida (card do Dashboard ou tela "Projeções"), o sistema deve indicar de forma visível qual janela foi efetivamente usada (90, 60 ou 30 dias) e que se trata de uma estimativa baseada em histórico — nunca apresentada como um fato garantido. | Decisão explícita do usuário (item 5), para evitar que uma projeção pouco confiável (calculada com poucos dados) seja lida como uma certeza pelo ator. |
| RN-05 | A projeção é calculada por **`codigo_produto` agregado**, somando todos os lotes ativos daquele código — não há projeção por lote/validade individual. Mesma convenção de agregação já usada em `stock_limits` (UC-15) e no gatilho de notificação de estoque baixo (`checkLowStock`, `alertTriggers.ts`). | Decisão do usuário (item 6), para manter consistência com o único outro mecanismo de "quantidade mínima por produto" já existente no sistema (UC-15). |
| RN-06 | O evento-alvo da projeção é a data em que a **quantidade total disponível chegaria a zero** — não a data em que o produto cruzaria o `limite_estoque_baixo` configurado em UC-15. Os dois mecanismos permanecem independentes: um alerta quando o estoque **já está** baixo (UC-15/UC-42, comparação de estado atual); este UC projeta **quando** o estoque vai **zerar** (comparação de uma taxa de consumo contra uma data futura). | Decisão do usuário (item 4). |
| RN-07 | O cálculo roda inteiramente client-side, sob demanda, disparado pelo carregamento da tela (Dashboard da clínica, Dashboard do Consultor, ou as telas "Projeções") — sem nenhuma Cloud Scheduled Function nova e sem persistência do resultado calculado (recalculado do zero a cada carregamento). Mesmo padrão arquitetural já usado por UC-15/UC-42/UC-47 (nenhum cron ativo hoje no sistema para nenhum desses mecanismos). | Decisão do usuário (item 3); confirmado por investigação de código que não existe nenhuma Cloud Scheduled Function ativa hoje para `checkLowStock`/`runAllChecks` (UC-15, RN-05) nem para nenhum relatório (UC-47). |
| RN-08 | **[Achado de segurança/arquitetura — decisão de design]** Estender o acesso do Consultor para incluir a leitura de `tenants/{tenantId}/solicitacoes` (necessária para calcular a taxa de consumo) **não exige nenhuma alteração em `firestore.rules`**. A regra genérica já existente, `match /tenants/{tenantId}/{document=**} { allow read: if consultantHasAccess(tenantId); }`, já concede ao Consultor leitura **read-only de qualquer subcoleção** de um tenant autorizado — incluindo `solicitacoes`, hoje simplesmente nunca consultada por nenhuma tela do Portal do Consultor. A "expansão de acesso" deste UC é puramente uma expansão de **aplicação** (uma nova tela/serviço no Portal do Consultor passa a consultar `solicitacoes`, além de `inventory` já consultado por UC-48) — não uma expansão de permissão de segurança. | Confirmado por leitura literal de `firestore.rules` (linhas 58-67) — não há nenhuma regra mais restritiva dedicada a `solicitacoes` que precise ser flexibilizada. Mesmo padrão já registrado em UC-48 (RN-06): a regra genérica de subcoleção é, por natureza, ampla o suficiente para cobrir esta extensão sem mudança de código de segurança. |
| RN-09 | O Consultor vê a **mesma visão completa** que a clínica veria (produto, quantidade disponível, taxa de consumo, data estimada, janela usada) — não uma versão resumida/anonimizada. Isso é diferente do padrão de "resumo" sugerido pelo mock da landing ("Sinais da semana"), mas é a decisão de escopo confirmada pelo usuário para esta versão. | Decisão explícita do usuário (item 2). |
| RN-10 | **[Fora de escopo desta versão]** A "sugestão de quantidade a pedir" (Módulo 05 da landing, "Sugestão de reposição calculada pelo sistema") não é coberta por este UC — apenas a projeção de data ("quando vai faltar"). Segue o mesmo precedente já usado no UC-51 para o motor de custeio: registrado como nota de escopo futuro (Seção 14), sem detalhamento de Regra de Negócio nesta versão. | Decisão explícita do usuário (item 1). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Nenhuma API route dedicada nem Cloud Scheduled Function nova — cálculo 100% client-side a partir de `inventory` e `solicitacoes`, usando as regras já existentes do Firestore (RN-07/RN-08). Mesmo padrão arquitetural de UC-15/UC-47. | Arquitetura |
| RNF-02 | **[Ponto de atenção, não bloqueante]** No Dashboard do Consultor, o card resumo precisa calcular a projeção para **cada clínica vinculada** (N tenants), exigindo N leituras de `inventory` + N leituras de `solicitacoes` a cada carregamento — sem paginação nem cache. Para consultores com muitas clínicas vinculadas, isso pode ficar lento. Mesmo tipo de achado já registrado em UC-47 (RNF-02) para relatórios sem paginação. | Desempenho / Escalabilidade |
| RNF-03 | Multi-tenant e isolamento por clínica garantidos inteiramente pela regra genérica já existente do Firestore (RN-08) — nenhuma superfície nova de risco de vazamento entre tenants, já que a extensão de acesso do Consultor não é uma mudança de regra, apenas uma nova consulta dentro do que já era permitido. | Multi-tenant / Segurança |
| RNF-04 | **[Recomendação de design para esta feature nova]** Diferente do padrão de falha silenciosa (`console.error` sem aviso ao usuário) já encontrado em outras telas mais antigas do sistema (ex. UC-48, RNF-01), recomenda-se que esta feature nova, desde a primeira versão, use o padrão de `toast` (`useToast`) já adotado em correções recentes (ex. UC-47, RNF-01) para comunicar falhas de cálculo ao ator. | Usabilidade / Consistência |

---

## 11. Frequência de Uso
Provavelmente alta no que diz respeito ao card do Dashboard (calculado automaticamente toda vez que a tela carrega, para todo usuário que abre o Dashboard); a tela detalhada ("Projeções Gerais"/"Projeções") tende a ser consultada com menor frequência, quando o ator quer decidir especificamente sobre reposição de um ou mais produtos.

---

## 12. Casos de Uso Relacionados
- **UC-15 (Configurar Limite de Estoque Baixo por Produto)** — mesma convenção de agregação por `codigo_produto` (RN-05); mecanismo conceitualmente irmão ("estoque já baixo" vs. "quando vai zerar"), mas os dois permanecem independentes (RN-06).
- **UC-16 a UC-19 (Procedimentos)** — fonte de origem de `Solicitacao` com `status == 'concluida'`, usada para calcular a taxa de consumo (RN-01).
- **UC-42 (Executar Verificações de Alertas Manualmente)** — mesmo espírito de "verificação sob demanda, sem cron", mas lá o gatilho é um clique explícito; aqui é o carregamento da tela (RN-07).
- **UC-47 (Gerar Relatórios de Estoque, Vencimento e Consumo)** — mesma fonte de dado de consumo (`generateConsumptionReport`, RN-03 daquele UC: apenas `concluida`); este UC reaproveita o mesmo critério de "consumo real".
- **UC-48 (Consultar Clínicas Vinculadas e Estoque)** — ponto de entrada do Consultor para uma clínica vinculada (`/consultant/clinics/{tenantId}`); este UC estende o acesso de leitura do Consultor, hoje restrito a `inventory`, para também incluir `solicitacoes` (RN-08), sem exigir mudança de regra do Firestore.
- **UC-51 (Expansão de Relatórios Gerenciais e Custeio por Procedimento)** — mesmo padrão de "UC escrito e aprovado, aguardando priorização/planejamento de implementação"; mesmo precedente de registrar escopo futuro (sugestão de quantidade a pedir, RN-10) sem detalhar Regra de Negócio agora.

---

## 13. Referências

**Código investigado (estado atual, base para o desenho):**
- `src/lib/services/alertTriggers.ts` (`checkLowStock`, `runAllChecks` — confirma ausência de cron ativo, RN-07)
- `src/components/clinic/StockLimitsTab.tsx` e `src/lib/services/inventoryService.ts` (`getStockLimitsMap`, `updateStockLimit`, `listInventory` — convenção de agregação por `codigo_produto`, RN-05)
- `src/lib/services/reportService.ts` (`generateConsumptionReport` — mesma fonte de dado de consumo, RN-01/RN-03)
- `src/lib/services/dashboardService.ts` (`getDashboardEstoqueStats`, `getDashboardProcedimentosStats` — padrão de agregação já usado no Dashboard da clínica)
- `src/types/index.ts` (`InventoryItem`, `Solicitacao`, `ProdutoSolicitado`, `SolicitacaoStatus`)
- `firestore.rules` (linhas 32-36, `consultantHasAccess`; linhas 58-67, regra genérica de subcoleção — base da RN-08)
- `src/components/clinic/ClinicLayout.tsx` (`navLinks` — rótulo real do menu é "Gerenciar Estoque", `/clinic/inventory`)
- `src/app/(clinic)/clinic/inventory/page.tsx`, `src/app/(clinic)/clinic/inventory/audit/page.tsx` (padrão de subpáginas dentro de "Gerenciar Estoque")
- `src/app/(clinic)/clinic/dashboard/page.tsx` (estrutura de cards do Dashboard da clínica)
- `src/app/(consultant)/consultant/dashboard/page.tsx`, `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx`, `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx` (estrutura de navegação do Portal do Consultor)
- `public/landing/sections-product.jsx` (Módulo 03), `public/landing/sections-personas.jsx` (Módulo 05, mock "Sinais da semana")
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 7.1 — reserva original do UC-52)

**Superfícies novas propostas (ainda não implementadas — desenho fechado por este UC):**
- `/clinic/inventory/projections` — nova subpágina "Projeções Gerais" dentro de "Gerenciar Estoque", acessível por um link/botão a partir de `/clinic/inventory` (diferente do padrão órfão de `/clinic/inventory/audit`, UC-14 — este UC exige um ponto de entrada real na navegação).
- `/consultant/clinics/{tenantId}/projections` — nova subpágina irmã de `/consultant/clinics/{tenantId}/inventory`, acessível a partir da tela de detalhe da clínica (`/consultant/clinics/{tenantId}`, UC-48).
- Novo card "Projeção de Reposição" em `/clinic/dashboard` e em `/consultant/dashboard` (este último agregando as clínicas vinculadas — RNF-02).
- Novo serviço proposto (ex. `src/lib/services/projectionService.ts`), responsável pelo cálculo descrito nas RN-01 a RN-06, reaproveitado tanto pelas telas da clínica quanto pelas do Consultor.

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Nenhum item abaixo bloqueia a aprovação deste UC — mesmo padrão já usado em UC-51 (pendências técnicas não bloqueantes registradas, mas com Status "Aprovado").

1. **[Proposta técnica a validar, não bloqueante]** RN-03 — o critério de "dados suficientes" (pelo menos 2 `Solicitacao concluida` em datas diferentes, por janela) foi proposto pelo `uml-use-case-writer` a partir do exemplo dado no repasse do usuário. Vale confirmar esse número exato (2) antes da implementação, ou ajustar para outro critério (ex.: 3 eventos, ou um volume mínimo de quantidade consumida)?
2. **[Nota de escopo futuro, não bloqueante]** RN-10 — a "sugestão de quantidade a pedir" (Módulo 05 da landing) fica fora desta versão; quando for priorizada, deverá provavelmente estender este mesmo UC (nova versão) ou nascer como um UC próprio dedicado — decisão a tomar quando essa parte for de fato priorizada.
3. **[Ponto de atenção de performance, não bloqueante]** RNF-02 — o card do Dashboard do Consultor precisa agregar dados de todas as clínicas vinculadas (N leituras); para consultores com muitas clínicas, isso pode exigir otimização (cache, agregação server-side) quando o `dev-task-manager` planejar a implementação.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 21/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Versão inicial. Investigado o estado atual do código (`alertTriggers.ts`, `stock_limits`/UC-15, `reportService.ts`/UC-47, `firestore.rules`, navegação de "Gerenciar Estoque" e do Portal do Consultor) para confirmar que nenhum motor de previsão existe hoje e que a extensão de acesso do Consultor a dados de consumo (`solicitacoes`) não exige mudança de regra do Firestore (RN-08, achado relevante). Documento fechado com todas as decisões de escopo já tomadas pelo usuário: MVP restrito à projeção de data de esgotamento (RN-10, sugestão de quantidade fora de escopo); Consultor Rennova vinculado com a mesma visão completa da clínica (RN-09); gatilho automático ao carregar a tela, sem cron novo (RN-07); evento-alvo é a data de zerar o estoque, não o limite de estoque baixo (RN-06); cascata de janelas de histórico 90→60→30 dias com critério de suficiência proposto a validar (RN-03, não bloqueante); agregação por código de produto (RN-05). Novas superfícies de UI propostas: card no Dashboard (clínica e Consultor) e nova subpágina "Projeções Gerais" em `/clinic/inventory/projections` e `/consultant/clinics/{tenantId}/projections`. |
