# Bugfix: Falha de carregamento exibida como lista ou estado vazio em 6 telas (UX-025, UX-038, UX-047, UX-050, UX-051, UX-053; + UX-026)

**Projeto:** Curva Mestra
**Data:** 22/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Stanke Scandelari
**Data de Conclusão:** 23/10/2026
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/ux-erro-exibido-como-vazio` (já criada a partir de `develop` `f4d516a`)
**Prioridade:** Alta
**Versão:** 1.2

> Em seis telas, uma falha ao carregar dados termina em `console.error` (ou é engolida no serviço) e a tela cai no ramo de "nenhum item": "Crie seu primeiro procedimento", "Nenhum pedido de transferência pendente", "Nenhuma clínica vinculada", "Nenhum usuário cadastrado", contadores em `0`. O usuário conclui que não há dados quando o sistema falhou. Em Procedimentos isso pode gerar registro em duplicidade. Em Pedidos de Transferência, o consultor pode perder o prazo de resposta. A correção cria **um padrão único de estado de erro**: helpers puros em `src/lib/loadErrors.ts`, extensão compatível do hook `useAsyncState` e o componente `LoadErrorAlert`. Esse estado é distinto do vazio, fica no próprio bloco, tem mensagem em pt-BR e botão "Tentar novamente", e o detalhe técnico vai só para o `console.error`. A correção também trata `response.ok === false` nas chamadas a API routes e faz `getRecentActivity` propagar a falha em vez de devolver `[]`. As leituras diretas do Firestore desses blocos passam a vir do servidor (`getDocsFromServer`). Os cards "Estoque" e "Procedimentos" do Dashboard da clínica (UX-026) entram no mesmo lote. O estado vazio legítimo continua igual.

---

## Decisões resolvidas

As quatro decisões abertas na v1.0 foram respondidas explicitamente pelo usuário em 22/10/2026 (pergunta estruturada). O documento está pronto para o `dev-task-manager`.

| # | Decisão | Resposta do usuário (e justificativa da recomendação aceita) | Onde impacta |
|---|---------|--------------------------------------------------------------|--------------|
| D1 | As leituras diretas do Firestore que alimentam os blocos corrigidos passam a usar `getDocsFromServer` em vez de `getDocs`? | **Sim.** Um resultado vindo só do cache local passa a contar como falha. Funções afetadas: `listSolicitacoes`, `getDashboardProcedimentosStats`, `getDashboardEstoqueStats`, `getUpcomingProcedures`, `getRecentActivity`, a query de `users` e o `getDoc(tenants/{id})` de `loadAllUsers` (este como `getDocFromServer`). É o mesmo raciocínio do `getDocFromServer` adotado no UX-046. **Premissa a confirmar:** "com a rede caída, `getDocs` resolve com o cache local (vazio, com cache em memória) em vez de rejeitar" vem da **documentação do SDK**, e não foi observada no emulador. Ela será confirmada no E2E (STEP 7, ação 6). | §4.1(c), §5.2, §5.4, STEPs 2, 4, 5 e 7, §8.2, §10 |
| D2 | Incluir neste lote o **UX-026** (cards "Estoque" e "Procedimentos" do Dashboard da clínica com `Alert` genérico + mensagem de vazio, e `error: string` compartilhado com o listener)? | **Sim.** Mesmo arquivo, mesmo `useEffect` e mesmo padrão: evita dois padrões de erro na mesma tela. **O UX-027 (listener `onSnapshot` de alertas) fica fora.** | §2, §3.1 RF-08, §6.3.3, STEP 4, §8.2 cenário 7, §12.1 |
| D3 | Onde fica o caderno Playwright? | **Um arquivo transversal: `tests/e2e/_ux-erro-exibido-como-vazio.spec.ts`**, com um `describe` por tela e um cabeçalho que liga cada cenário ao UX e ao UC. Não serão criados cadernos parciais de UC-16, UC-26, UC-36 e UC-48. Quando os cadernos completos desses UCs forem gerados (retroativo, regra 8), eles podem absorver estes cenários. | §5.1, STEP 7, §8.2, §12.1 |
| D4 | Cobrir o ramo `response.ok === false` no E2E com `page.route(...).fulfill(...)`? | **Sim, com status 500/403 e corpo mínimo `{ error }`.** É a única técnica que fabrica resposta neste caderno. Há precedente aceito: `tests/e2e/UC-06-...spec.ts:161` e `UC-07-...spec.ts:48-62`. O Jest cobre a lógica (`readApiData`/`describeLoadError`), e o E2E confirma que a tela usa essa lógica. | STEP 7, §8.2 (cenários 5, 11 e 12) |

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop` (a branch da task já foi criada a partir de `develop` `f4d516a`; antes do primeiro commit, conferir se `develop` local está em sync com `origin/develop` e com `master`).
**Branch da task:** `bugfix/ux-erro-exibido-como-vazio`

Fluxo obrigatório (`ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`):
`bugfix/ux-erro-exibido-como-vazio` → PR → `gscandelari_setup` → validação em `dev-gscandelari.web.app` → PR `gscandelari_setup` → `develop`.

**PR nunca vai para `master`.** O merge é feito pelo usuário, via PR.

Um commit por tela, na ordem de severidade do mapa (Alta primeiro). As duas telas do consultor que compartilham a mesma rota (`/api/consultants/me/clinics`) ficam num commit só.

| Step | Tipo | Escopo | Mensagem de commit planejada | Condição |
|------|------|--------|------------------------------|----------|
| STEP 1 | `fix` | `ui` | `fix(ui): add shared load error helpers, alert and async state guard` | Sempre |
| STEP 2 | `fix` | `clinic` | `fix(clinic): show load error instead of empty state in procedures list` | Sempre (UX-038) |
| STEP 3 | `fix` | `consultant` | `fix(consultant): show load error instead of empty state in transfer requests` | Sempre (UX-053) |
| STEP 4 | `fix` | `clinic` | `fix(clinic): show per-block load errors in clinic dashboard` | Sempre (UX-025 + UX-026, D2) |
| STEP 5 | `fix` | `admin` | `fix(admin): show load error instead of empty state in users list` | Sempre (UX-047) |
| STEP 6 | `fix` | `consultant` | `fix(consultant): show load errors in my clinics and consultant dashboard` | Sempre (UX-050, UX-051) |
| STEP 7 | `test` | `e2e` | `test(e2e): cover load failure states shown as empty (UX-038, UX-053 and others)` | Sempre (arquivo transversal, D3; `fulfill` de status de erro, D4) |
| STEP 8 | — | — | Validação manual, sem commit | Sempre |

Firestore rules e índices **não mudam** (§5.4). Por isso não há comando de deploy de rules ou indexes a passar ao usuário antes do merge em `master`.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

Base: código em `develop` `f4d516a`. As linhas citadas são deste commit.

**UX-038 — Clínica › Procedimentos** (`src/app/(clinic)/clinic/requests/page.tsx`)
- `loadSolicitacoes` (l. 109-125): no `catch`, só `console.error('Erro ao carregar procedimentos:', error)`. `solicitacoes` continua `[]`, e o `finally` desliga o `loading`.
- Render (l. 314-334): `filteredSolicitacoes.length === 0` mostra "Nenhum procedimento encontrado", "Crie seu primeiro procedimento" e o botão "Novo Procedimento". O título do card mostra "Procedimentos (0)".
- `loadStats` (l. 127-140): no `catch`, só `console.error`. Os três cards (l. 203-271) mostram `—` sem explicação.
- O efeito depende de `[tenantId, statusFilter]`. Uma troca rápida de filtro pode fazer uma resposta antiga sobrescrever a nova (corrida sem guarda).
- Serviços: `listSolicitacoes` (`src/lib/services/solicitacaoService.ts:1006-1052`) e `getDashboardProcedimentosStats` (`src/lib/services/dashboardService.ts:84-146`) **já propagam** o erro (`throw`). O problema está só na página.
- Precificação (l. 95-104): `Promise.all(...).catch(console.error)`. As colunas de custo ficam em `—`. **Fora do escopo** (não faz parte do UX-038, ver §5.5).

**UX-053 — Consultor › Pedidos de Transferência** (`src/app/(consultant)/consultant/transfer-requests/page.tsx`)
- `loadRequests` (l. 41-55): `const data = await res.json(); if (res.ok) setRequests(data.data || [])`. Um `!res.ok` é **ignorado em silêncio**, e o `catch` só faz `console.error`.
- Render (l. 216-271): as abas "Pendentes" e "Histórico" mostram "Nenhum pedido de transferência pendente" / "Nenhum pedido no histórico".
- `handleApprove`/`handleRejectConfirm` (l. 57-101) chamam `loadRequests()` depois do sucesso (l. 71, l. 95). Se essa releitura falhar, a lista antiga continua na tela, **inclusive com o pedido recém-aprovado ainda como "Pendente"**.
- Rota: `GET /api/consultants/transfer-requests` (`src/app/api/consultants/transfer-requests/route.ts`). Ela devolve 401/403 com `{ error }` em pt-BR e 500 com `{ error: error.message || ... }` (l. 92-96), ou seja, **mensagem crua do Admin SDK, em inglês**.

**UX-025 — Clínica › Dashboard** (`src/app/(clinic)/clinic/dashboard/page.tsx`)
- Detalhes (l. 154-160): `Promise.all([getRecentActivity(tenantId, 5), getUpcomingProcedures(tenantId, 5)]).then(...).catch(() => {})`. A falha some sem nenhum log.
- `getRecentActivity` (`src/lib/services/inventoryService.ts:213-246`): o `catch` faz `console.error` e **`return []`**, com o comentário "Retornar array vazio se a coleção não existir ainda". Esse comentário está errado: uma consulta sobre uma subcoleção inexistente devolve snapshot vazio, sem erro. O `return []` só serve para esconder falha real (rede, permissão, índice). **Único chamador:** o próprio Dashboard (conferido por `grep`).
- `getUpcomingProcedures` (`solicitacaoService.ts:1144-1175`) já propaga o erro. **Único chamador:** o Dashboard.
- Render: "Nenhum procedimento agendado nas próximas 2 semanas" (l. 512-518) e "Nenhuma movimentação recente" (l. 579-583).
- Incluído neste lote (UX-026, D2): o `Promise.all` das estatísticas (l. 146-152) faz `setError('Erro ao carregar dados do dashboard')` no `Alert` genérico do topo (l. 291-297). Ao mesmo tempo, os cards caem em "Nenhum produto em estoque" (l. 313-316) e "Sem dados de procedimentos" (l. 357-360). O mesmo `error` é escrito pelo listener de alertas (l. 132).
- Projeção de Reposição (l. 163-179, l. 447-488): já tem estado de erro distinto (exceção justificada em `_PADRAO-UX.md` §7.6). **Não muda.**

**UX-047 — Admin › Usuários** (`src/app/(admin)/admin/users/page.tsx`)
- `loadAllUsers` (l. 117-169): `getDocs(query(collection(db,'users'), orderBy('created_at','desc')))` e, para cada usuário, `getDoc(tenants/{id})`. No `catch` externo, só `console.error`.
- Render: "Nenhum usuário cadastrado" (l. 509-512). Os quatro cards (l. 440-485) mostram `0` ("Total de Usuários", "Usuários Ativos", "Administradores", "Clínicas").
- Falha na leitura do nome da clínica de um usuário (l. 139-146): o nome fica em **"Sem clínica"**, uma informação falsa (o usuário tem clínica, só não foi possível ler o nome).
- `handleSaveUser` chama `loadAllUsers()` depois de salvar (l. 370).
- A coluna "Último acesso" (`useLastAccess`) falha em silêncio de propósito: exceção justificada, UC-59 RN-07. **Não muda.**

**UX-050 — Consultor › Minhas Clínicas** (`src/app/(consultant)/consultant/clinics/page.tsx`)
- `loadClinics` (l. 35-57): `if (response.ok) { setClinics(...); await refreshClaims(); }`. Um `!ok` é ignorado e o `catch` só faz `console.error`. O `refreshClaims()` fica dentro do mesmo `try`, então uma falha dele também cairia no `catch` silencioso.
- Render (l. 109-127): "Nenhuma clínica vinculada — Busque clínicas por CNPJ/CPF para solicitar vínculo" + "Buscar Clínicas". O consultor pode pedir vínculo ou transferência de clínicas que já são dele.
- Rota: `GET /api/consultants/me/clinics` (`src/app/api/consultants/me/clinics/route.ts`). Devolve 401/403/404 com `{ error }` em pt-BR e 500 com `error.message` cru (l. 71-76).

**UX-051 — Consultor › Dashboard** (`src/app/(consultant)/consultant/dashboard/page.tsx`)
- `loadDashboardData` (l. 33-66): busca, **em sequência e no mesmo `try`**, o perfil (`GET /api/consultants/{consultantId}`) e as clínicas (`GET /api/consultants/me/clinics`). Os dois `!ok` são ignorados. Se a busca do perfil lançar exceção, as clínicas nem são buscadas.
- Em falha:
  - o cartão do código (l. 142-162) fica **sem código**;
  - a saudação vira "Bem-vindo ao Portal do Consultor, " (l. 137);
  - "Clínicas Vinculadas" mostra `0` (l. 172);
  - "Minhas Clínicas" diz "Você ainda não possui clínicas vinculadas" (l. 236-249);
  - o card "Projeção de Reposição" mostra `0`, porque com `clinics = []` o efeito das l. 77-83 define `projectionsCount = null` e a l. 207 exibe `projectionsCount ?? 0`.
- A página inteira fica num spinner até as duas leituras terminarem (l. 117-125).

**Hook existente** (`src/hooks/useAsyncState.ts`): modela só `loading` e `error: string`. A função `run(action, errorLogLabel, fallbackMessage)` faz `console.error` + `setError(fallbackMessage)`. Não tem guarda contra corrida (uma execução antiga pode desligar o `loading` da nova) e não expõe o motivo da falha. Hoje é usado em `src/app/(clinic)/clinic/profile/page.tsx`, `src/app/(consultant)/consultant/profile/page.tsx` e `src/hooks/useLinkedConsultant.ts`.

**Referência de padrão já entregue (UX-046):** `src/app/(admin)/admin/settings/page.tsx:212-227`: `Alert variant="destructive"`, título fixo, texto acionável, `translateFirestoreError(code)` como detalhe e botão `outline` "Tentar novamente" com `RefreshCw`. O detalhe técnico fica só no `console.error` (l. 81-82). Spec: `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-admin-settings-sobrescrita-falha-leitura.md`.

### 1.2 Problema identificado

1. **Erro exibido como vazio ou zero** nas 6 telas. Isso viola `_PADRAO-UX.md` §2, regra 1 ("Um erro de carregamento nunca pode aparecer como 'nenhum item' ou como contagem `0`").
2. **`response.ok === false` ignorado** nas três telas que leem por API route (UX-050, UX-051, UX-053). Viola a §2, regra 3.
3. **Serviço que engole a falha:** `getRecentActivity` devolve `[]` em qualquer erro.
4. **Telas com vários blocos sem erro por bloco** (Dashboards). Viola a §2, regra 2.
5. **Riscos concretos** (mapa §8.6, severidade Alta):
   - UX-038: a clínica pode criar um procedimento em duplicidade, porque a tela convida a "criar o primeiro";
   - UX-053: o consultor pode perder o prazo de decisão de pedidos e convites (`isRequestExpired`, `src/lib/consultantRequests.ts`).

### 1.3 Motivação estratégica

- Lote 1 da `_PADRAO-UX.md` §8(c): "P0 'erro como vazio' (um padrão, várias telas)". Escopo decidido pelo usuário em 22/10/2026: as 6 telas P0.
- Produção tem cliente real desde 16/10/2026. Uma falha transitória de rede hoje leva a decisões erradas (duplicar procedimento, pedir vínculo de novo, perder prazo).
- Criar o padrão uma vez, com componente e helpers testados, reduz o custo do lote 4 (P1 de estado: UX-026/027/036/040/041/045/049/052), que pode reaproveitá-lo.

---

## 2. Objetivos

1. **Garantir** que, nas 6 telas, uma falha de carregamento nunca seja exibida como lista vazia, estado vazio com CTA ou contador `0`.
2. **Expor** um estado de erro único e reutilizável (`LoadErrorAlert`): no próprio bloco, com mensagem em pt-BR acionável e "Tentar novamente". O detalhe técnico fica só no `console.error`.
3. **Tratar** `response.ok === false` como erro em todas as leituras por API route das telas do escopo, e não só o `catch`.
4. **Propagar** a falha em `getRecentActivity`, em vez de devolvê-la como `[]`.
5. **Isolar** o erro por bloco nos dois Dashboards: a falha de um bloco não esconde nem contamina os outros.
6. **Preservar** o comportamento do estado vazio legítimo (mesmos textos, mesmos CTAs, mesmas condições).
7. **Estender** `useAsyncState` de forma retrocompatível (guarda contra corrida e motivo legível), sem quebrar os três chamadores atuais.
8. **Criar** o caderno Playwright com falha simulada para as 2 telas Alta (obrigatório) e para as demais (onde viável), conforme a regra 8 do `CLAUDE.md`.
9. **Corrigir** o UX-026 junto (D2): erro próprio nos cards "Estoque" e "Procedimentos" do Dashboard da clínica.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Toda leitura de dados que alimenta um bloco do escopo tem três estados de exibição distintos e excludentes: carregando, erro e conteúdo. O conteúdo inclui o vazio legítimo. A precedência é **carregando > erro > vazio > dados**, definida pela função pura `resolveLoadView` (§6.2). | Todos | Must |
| RF-02 | O estado de erro é o componente `LoadErrorAlert`: `Alert variant="destructive"` (`role="alert"`), título fixo do bloco, texto opcional de orientação, detalhe vindo de `describeLoadError` e botão `outline` "Tentar novamente", que repete **só a leitura daquele bloco**. | Todos | Must |
| RF-03 | Nas leituras por API route, `response.ok === false` lança `ApiLoadError` (status + mensagem do servidor) por meio de `readApiData`. Uma resposta 2xx com corpo não JSON também é erro. | clinic_consultant | Must |
| RF-04 | `describeLoadError` só exibe a mensagem do servidor (`data.error`) para respostas **4xx diferentes de 401**. Para 401, mostra uma mensagem fixa de sessão. Para 5xx, mostra uma mensagem fixa, porque as rotas do escopo devolvem `error.message` cru do Admin SDK no 500. Erros do Firestore usam `translateFirestoreError(code)`. Falha de rede usa uma mensagem fixa de conexão. | Todos | Must |
| RF-05 | **Procedimentos (UX-038):** em erro, o card da lista mostra o `LoadErrorAlert` no lugar da lista ou do vazio. O título fica "Procedimentos", sem "(0)". O botão "Novo Procedimento" do estado vazio **não** aparece. Os três cards de estatística mostram "Indisponível" e, abaixo da grade, um `LoadErrorAlert` próprio das estatísticas. Uma resposta antiga (troca de filtro) nunca sobrescreve a mais recente. | clinic_admin, clinic_user | Must |
| RF-06 | **Pedidos de Transferência (UX-053):** em erro, o `LoadErrorAlert` substitui as abas (as duas dependem da mesma leitura). Não há badge de contagem. Se a releitura feita depois de aprovar ou rejeitar falhar, a tela vai para o estado de erro: a lista antiga não continua visível. | clinic_consultant | Must |
| RF-07 | **Dashboard da clínica (UX-025):** "Próximos Procedimentos" e "Atividade Recente" passam a ser carregados de forma independente, cada um com loading, erro e "Tentar novamente" próprios. `getRecentActivity` propaga a falha. | clinic_admin, clinic_user | Must |
| RF-08 | **Dashboard da clínica (UX-026, D2):** "Estoque" e "Procedimentos" (cards de resumo) são carregados de forma independente, cada um com erro próprio. As estatísticas deixam de escrever no `Alert` genérico do topo, que fica só com o erro do listener de alertas (UX-027, fora do escopo). | clinic_admin, clinic_user | Must |
| RF-09 | **Usuários (UX-047):** em erro, o `LoadErrorAlert` substitui o conteúdo da tabela e os quatro cards mostram "Indisponível". A falha ao ler o nome da clínica de **um** usuário mostra "Clínica indisponível" (e não "Sem clínica") nessa linha, sem derrubar a lista. | system_admin | Must |
| RF-10 | **Minhas Clínicas (UX-050):** em erro (rede ou `!ok`), o `LoadErrorAlert` substitui a grade e o estado vazio. Uma falha de `refreshClaims()` **não** vira estado de erro (as clínicas foram lidas): só `console.error`. | clinic_consultant | Must |
| RF-11 | **Dashboard do consultor (UX-051):** o perfil (cartão do código + saudação) e as clínicas (card "Clínicas Vinculadas", card "Projeção de Reposição" e bloco "Minhas Clínicas") são carregados de forma independente. Em erro do perfil, o cartão do código mostra o erro e a saudação fica "Bem-vindo ao Portal do Consultor", sem vírgula e sem nome. Em erro das clínicas, os dois cards mostram "Indisponível", o bloco mostra o `LoadErrorAlert` e a projeção **não** é calculada. | clinic_consultant | Must |
| RF-12 | Os textos, CTAs e condições do estado vazio legítimo das 6 telas continuam **idênticos** aos atuais. | Todos | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Nenhuma alteração em `firestore.rules`, `firestore.indexes.json` ou nas API routes. | Segurança / Manutenibilidade |
| RNF-02 | Nenhuma query nova. As leituras mantêm exatamente os mesmos caminhos (`tenants/{tenantId}/...`, `users`) e filtros. Só muda a origem da leitura (servidor em vez de cache, D1). | Segurança (multi-tenant) |
| RNF-03 | A lógica de decisão (`readApiData`, `describeLoadError`, `resolveLoadView`) fica em funções puras testadas com Jest, sem import de `firebase/*`. | Manutenibilidade |
| RNF-04 | `useAsyncState` continua retrocompatível: os três chamadores atuais funcionam sem alteração, e a mesma assinatura de `run(action, errorLogLabel, fallbackMessage)` é aceita. | Manutenibilidade |
| RNF-05 | O texto visível segue `_PADRAO-UX.md` §5: acentuação completa, sem jargão ("Firestore", "API", "token") e sem `error.message` cru. | Usabilidade |
| RNF-06 | O estado de erro é anunciado ao leitor de tela (`role="alert"` do `Alert` do projeto, `src/components/ui/alert.tsx:30`). | Acessibilidade |
| RNF-07 | Um "Tentar novamente" repete só a leitura do bloco, sem recarregar a página. | Performance / Usabilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | Vazio só é exibido depois de uma leitura bem-sucedida que retornou zero itens. Falha, ou resultado só de cache (D1), nunca é vazio. | `_PADRAO-UX.md` §2, regra 1. |
| RN-02 | Em erro, nenhum CTA que pressuponha ausência de dados ("Crie seu primeiro procedimento", "Buscar Clínicas", "Novo Procedimento" do vazio) é exibido. | Evita duplicidade (UX-038) e pedido de vínculo para clínica já vinculada (UX-050). |
| RN-03 | Em erro, contadores e números derivados da leitura que falhou mostram "Indisponível", nunca `0` nem `—`. | §2, regra 1 ("ou como contagem `0`"). |
| RN-04 | A falha de um bloco não altera o que os outros blocos exibem. | §2, regra 2. |
| RN-05 | Uma mensagem vinda da API só é exibida quando é uma mensagem de negócio em pt-BR: resposta 4xx com `error` string, exceto 401. | §5: "mensagens vindas das rotas `/api/*` (`data.error`, já em pt-BR) podem ser exibidas"; as rotas do escopo devolvem `error.message` cru no 500. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

**(a) Um padrão, três peças compartilhadas (criadas no STEP 1):**

1. **`src/lib/loadErrors.ts` (lib pura, a criar):** `ApiLoadError`, `readApiData`, `describeLoadError` e `resolveLoadView` (§6.2). Concentra a decisão "o que é erro" e "o que mostrar" num único lugar testável.
2. **`useAsyncState` estendido (`src/hooks/useAsyncState.ts`):**
   - novo estado `errorDetail` (preenchido por `describeLoadError(err)`);
   - guarda de sequência: só a execução mais recente de `run` altera `loading`/`error`/`errorDetail`;
   - a `action` passa a receber `{ isCurrent }`, para que o chamador descarte dados de uma execução superada.

   **Recomendação: estender o hook, em vez de criar outro.** O `_PADRAO-UX.md` §8(c) sugere reaproveitá-lo, e ele já é o padrão de três telas. Ele não foi usado no UX-046 porque aquela tela precisava de `missing`/`stale`. Aqui, os 6 casos são exatamente `loading`/`error`/conteúdo.
3. **`src/components/ui/load-error-alert.tsx` (componente, a criar):** `LoadErrorAlert`, que encapsula o markup do UX-046 (`admin/settings/page.tsx:212-227`). Ele fica em `components/ui/` pelo precedente de `confirm-dialog.tsx`, que também é um composto do projeto sobre primitivos.

   **Recomendação: componente compartilhado, e não markup repetido.** São pelo menos 9 blocos neste lote, e o lote 4 terá outros 8.

**(b) Erro por bloco, e não por tela inteira.** Regra: **um estado de erro por leitura independente**.
- Telas com uma leitura (Procedimentos-lista, Pedidos de Transferência, Usuários, Minhas Clínicas): o erro substitui a área de conteúdo daquela leitura. Cabeçalho, filtros e navegação continuam visíveis.
- Dashboards: cada bloco com fonte própria tem `useAsyncState` próprio. Hoje, `Promise.all` acopla blocos (Dashboard da clínica) e a busca sequencial também (Dashboard do consultor). Os dois são desfeitos.
- Os cards derivados de uma leitura que falhou mostram "Indisponível". O `LoadErrorAlert` fica uma vez por leitura, no bloco principal, e não repetido em cada card.

**(c) Onde a falha é propagada em vez de virar `[]`:**

| Serviço | Hoje | Depois | Outros chamadores (impacto) |
|---|---|---|---|
| `getRecentActivity` (`inventoryService.ts:213`) | `catch` → `console.error` + `return []` | `catch` → `console.error` + `throw error` (mesmo padrão de `getExpiringProducts`, l. 204-207). Comentário errado removido | **Nenhum** além do Dashboard (conferido por `grep` em `src/`). Sem teste Jest existente da função. |
| `getUpcomingProcedures`, `listSolicitacoes`, `getDashboardProcedimentosStats`, `getDashboardEstoqueStats` | já fazem `throw` | `throw` mantido; `getDocs` → `getDocsFromServer` (D1) | `getDashboardProcedimentosStats` também é usado em `clinic/requests` (mesma correção, mesmo benefício). Os demais têm só um chamador. |
| `loadAllUsers` (na página) | `getDocs` direto na página | idem, com `getDocsFromServer` / `getDocFromServer` (D1) | — |
| API routes (`/api/consultants/...`) | já devolvem `!ok` | inalterado. A correção é no cliente (`readApiData`) | — |

**Decisão D1 (resolvida pelo usuário em 22/10/2026): leitura do servidor (`getDocsFromServer`) nos blocos do escopo.**
- O `db` usa cache em memória (`src/lib/firebase.ts:42`, `getFirestore` sem persistência).
- Pela documentação do SDK, `getDocs` "may return cached data or fail if you are offline": quando o cliente fica offline, ele tende a **resolver** com o que houver no cache. Com cache em memória, isso costuma ser vazio ou parcial. Consequência: com a rede caída, a lista resolveria `[]` **sem lançar erro**, e o estado de erro novo nunca apareceria.
- `getDocsFromServer` rejeita (`unavailable`) quando não alcança o servidor. É a mesma escolha do UX-046 (`getDocFromServer`, spec §4.1(b)).
- Aplicação: `listSolicitacoes`, `getDashboardProcedimentosStats`, `getDashboardEstoqueStats`, `getUpcomingProcedures`, `getRecentActivity`, a query de `users` (`getDocsFromServer`) e `getDoc(tenants/{id})` (`getDocFromServer`) de `loadAllUsers`.
- **Premissa ainda não verificada:** o comportamento do `getDocs` offline descrito acima vem da documentação. Ele será confirmado no E2E (STEP 7, ação 6), e o resultado será registrado no cabeçalho do caderno e no PR. Se o `getDocs` se mostrar rejeitando por conta própria, a decisão D1 **continua válida**: `getDocsFromServer` segue correto e explícito. Nesse caso só muda a justificativa, que deve ser atualizada aqui e no UC.

**(d) `response.ok === false` (RF-03/RF-04).** As três leituras por API route passam a usar `const data = await readApiData<T>(response)`. A função lê o corpo com tolerância a não-JSON e lança `ApiLoadError(status, serverMessage)` quando `!ok`. Mensagem exibida:
- 4xx (exceto 401) com `error` string: a mensagem do servidor (pt-BR por convenção das rotas, ex.: "Acesso restrito a consultores");
- 401: "Sua sessão expirou. Faça login novamente." (mesmo texto de `translateFirestoreError('unauthenticated')`);
- 5xx: "O servidor não conseguiu responder agora. Tente novamente em instantes." (o corpo 500 dessas rotas traz `error.message` cru, l. 71-76 e l. 92-96).

**(e) Estado vazio legítimo intocado.** Os ramos de vazio continuam com os mesmos textos e condições. A única diferença é que eles passam a ser alcançados só por `resolveLoadView(...) === 'empty'`. UX-039 (mensagem de vazio que ignora o filtro de status; CTA para `clinic_user`) **não** é corrigido aqui, por decisão de não mexer no vazio.

**(f) Multi-tenant e rules.** Nenhuma query nova. As leituras de clínica continuam em `tenants/{tenantId}/solicitacoes|inventory|inventory_activity`, com `tenantId = claims.tenant_id`. A leitura de `users` continua cross-tenant, só para `system_admin` (comportamento atual e intencional do UC-36). As do consultor continuam via API routes com Admin SDK (UC-54 RNF-01). `getDocsFromServer` é avaliado pelas **mesmas** rules de `getDocs`. **`firestore.rules` e `firestore.indexes.json` ficam inalterados.**

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Toast de erro mantendo o estado vazio | É o desvio documentado em UX-040/UX-041: o toast some e o vazio com CTA continua. Viola a §2, regra 1. |
| Um `Alert` único no topo da tela, para todos os blocos | Viola a §2, regra 2 (UX-026: uma mensagem sobrescreve a outra) e a regra 4 (o banner convive com "Nenhum..." abaixo, UX-049). |
| Hook novo (`useLoadState`) com máquina de estados completa | Duplicaria `useAsyncState` sem ganho: os 6 casos não têm `missing`/`stale`. Estender o hook mantém um só padrão (`_PADRAO-UX.md` §8(c)). |
| Adotar TanStack Query (previsto na stack do `CLAUDE.md`) nestas telas | Mudança de arquitetura de data-fetching maior que o bug. Fica para decisão própria. |
| `getRecentActivity` devolver `{ data, error }` em vez de lançar | Inconsistente com os outros serviços (`getExpiringProducts`, `listSolicitacoes`), que lançam. |
| Mostrar `data.error` da API sempre | O 500 das rotas do escopo devolve `error.message` cru (inglês, técnico). Viola a §5. |
| Corrigir as rotas para devolver mensagem genérica no 500 | É a correção certa no servidor (mesmo padrão do `UC-37-RN-06`), mas está fora do escopo de UX e mexe em 3 rotas. `describeLoadError` já protege o cliente. Registrado na §10 como sinalização. |
| Manter o spinner de página inteira no Dashboard do consultor | Acopla os dois blocos: um bloco lento ou com falha segura a tela toda. Skeleton por bloco é o padrão da §2. |

### 4.3 Trade-offs aceitos

- **Com `getDocsFromServer` (D1), a tela mostra erro offline em vez de dado em cache.** Com cache em memória, o "dado em cache" já é quase sempre vazio. Mostrar "não foi possível carregar" é mais honesto.
- **"Tentar novamente" pode falhar logo após a rede voltar** (backoff de reconexão do SDK). A mensagem de `unavailable` já diz "Tente novamente em instantes". Não há retentativa automática (igual ao UX-046).
- **Os dados antigos não são exibidos durante o erro** (ex.: releitura após aprovar um pedido). É o comportamento seguro: mostrar a lista antiga como atual é o que gera a decisão errada.
- **Mais leituras paralelas no Dashboard da clínica**: os `Promise.all` viram leituras independentes. O número de leituras é o mesmo; só muda o acoplamento.
- **O N+1 de `loadAllUsers`** (um `getDoc` por usuário) continua. Desempenho fora do escopo.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `src/lib/loadErrors.ts` | Lib pura | `ApiLoadError`, `readApiData`, `describeLoadError`, `resolveLoadView`, `LOAD_ERROR_MESSAGES` |
| `src/__tests__/loadErrors.test.ts` | Teste Jest | Cobertura das funções puras (§8.1) |
| `src/components/ui/load-error-alert.tsx` | Componente | `LoadErrorAlert` (padrão do UX-046, reutilizável) |
| `tests/e2e/_ux-erro-exibido-como-vazio.spec.ts` | Caderno Playwright | Cenários de falha das 6 telas + UX-026, num arquivo transversal (D3) |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/hooks/useAsyncState.ts` | `errorDetail`, guarda de sequência e `action({ isCurrent })`. Retrocompatível |
| `src/app/(clinic)/clinic/requests/page.tsx` | Lista e estatísticas com `useAsyncState` próprio, `LoadErrorAlert`, "Indisponível" nos cards e guarda contra corrida do filtro (UX-038) |
| `src/app/(consultant)/consultant/transfer-requests/page.tsx` | `loadRequests` com `useAsyncState` + `readApiData`; erro no lugar das abas (UX-053) |
| `src/app/(clinic)/clinic/dashboard/page.tsx` | Blocos de detalhe (UX-025) e cards de resumo "Estoque"/"Procedimentos" (UX-026, D2) independentes, com erro por bloco |
| `src/lib/services/inventoryService.ts` | `getRecentActivity` propaga o erro e usa `getDocsFromServer` (D1) |
| `src/lib/services/solicitacaoService.ts` | `listSolicitacoes` e `getUpcomingProcedures` usam `getDocsFromServer` (D1) |
| `src/lib/services/dashboardService.ts` | `getDashboardProcedimentosStats` e `getDashboardEstoqueStats` usam `getDocsFromServer` (D1, D2) |
| `src/app/(admin)/admin/users/page.tsx` | `loadAllUsers` com `useAsyncState`, erro no lugar da tabela, cards "Indisponível", "Clínica indisponível" na linha; `getDocsFromServer`/`getDocFromServer` (D1) (UX-047) |
| `src/app/(consultant)/consultant/clinics/page.tsx` | `loadClinics` com `useAsyncState` + `readApiData`; `refreshClaims` fora do caminho de erro (UX-050) |
| `src/app/(consultant)/consultant/dashboard/page.tsx` | Perfil e clínicas independentes, skeleton por bloco, erro por bloco, projeção bloqueada se as clínicas falharem, saudação sem vírgula (UX-051) |

### 5.3 Arquivos a REMOVER

N/A.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `tenants/{tenantId}/solicitacoes`, `inventory`, `inventory_activity` | Só leitura; origem muda (D1) | Mesmas queries e filtros. `getDocsFromServer` em vez de `getDocs` |
| `users`, `tenants/{id}` (leitura pelo system_admin) | Só leitura; origem muda (D1) | Mesmas queries |
| `consultant_transfer_requests`, `consultants`, `tenants` (via API) | Nenhuma | API routes inalteradas |
| `firestore.rules` | **Sem alteração** | As mesmas regras avaliam `getDocs` e `getDocsFromServer` |
| `firestore.indexes.json` | **Sem alteração** | Nenhuma query nova |

Multi-tenant: nenhuma query nova sem `tenant_id`. As leituras de clínica continuam presas a `tenants/{claims.tenant_id}/...`, e as cross-tenant continuam restritas a `system_admin` (Admin › Usuários) ou ao servidor (rotas do consultor), como hoje.

### 5.5 O que NÃO muda

- Textos, CTAs e condições do estado vazio legítimo das 6 telas (RF-12). UX-039 continua aberto.
- API routes `src/app/api/consultants/**` (inclusive o `error.message` cru no 500; ver §10).
- `src/lib/firestoreErrors.ts` (só é reutilizado), `src/components/ui/alert.tsx`.
- Os chamadores atuais de `useAsyncState`: `clinic/profile`, `consultant/profile`, `useLinkedConsultant` (sem alteração de código).
- Dashboard da clínica: o listener de alertas (`onSnapshot`, UX-027), o bloco "Produtos a Vencer" e o bloco "Projeção de Reposição" (exceção justificada §7.6).
- Dashboard do consultor: a soma parcial da projeção com `Promise.allSettled` + toast quando **uma** clínica falha (UC-52 RF-03/RNF-02). O UX-054 (cards com `onClick`) e a parte de `clipboard` do UX-056 continuam abertos.
- Procedimentos: o carregamento da precificação (colunas de custo, `listPrecificacoesProcedimentos`/`getCustoHoraConfig`) continua silencioso. Registrado para o `ux-reviewer` (§12.1).
- Admin › Usuários: a coluna "Último acesso" (UC-59 RN-07); `alert()`/`confirm()` do diálogo de edição (UX-048).
- `consultant/clinics/[tenantId]` (UX-052) e as demais telas do lote 4.
- Seed do emulador (`scripts/seed-emulator.ts`, `tests/e2e/fixtures/seed-data.ts`).

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

Nenhuma interface de domínio (`src/types/index.ts`) muda. Tipos novos ficam em `src/lib/loadErrors.ts`:

```ts
export type LoadView = 'loading' | 'error' | 'empty' | 'ready';

export class ApiLoadError extends Error {
  readonly status: number;
  /** `body.error` quando for string; undefined caso contrário. */
  readonly serverMessage?: string;
  constructor(status: number, serverMessage?: string);
}
```

### 6.2 Funções puras e hook

**`src/lib/loadErrors.ts` (a criar, sem import de `firebase/*`):**

```ts
export const LOAD_ERROR_MESSAGES = {
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  session: 'Sua sessão expirou. Faça login novamente.',
  server: 'O servidor não conseguiu responder agora. Tente novamente em instantes.',
} as const;

export async function readApiData<T>(response: Response): Promise<T>;
```
- Lê o corpo com `response.json()` dentro de `try`. Se falhar, `body = null`.
- Se `!response.ok`: lança `new ApiLoadError(response.status, typeof body?.error === 'string' ? body.error : undefined)`.
- Se `ok`, mas `body` for `null` ou não for objeto: lança `new ApiLoadError(response.status)`. Uma resposta 2xx ilegível é falha, não vazio.
- Retorna `body.data as T`. O chamador continua fazendo `?? []` onde já fazia.

```ts
export function describeLoadError(error: unknown): string;
```
Ordem de avaliação:
1. `ApiLoadError`:
   - `status === 401` → `LOAD_ERROR_MESSAGES.session`;
   - `400 <= status < 500` com `serverMessage` → `serverMessage`;
   - demais → `LOAD_ERROR_MESSAGES.server`.
2. `TypeError` (falha de `fetch` por rede no navegador) → `LOAD_ERROR_MESSAGES.network`.
3. Objeto com `code` string:
   - `code === 'auth/network-request-failed'` (vindo de `getIdToken`) → `LOAD_ERROR_MESSAGES.network`;
   - `code` iniciando com `auth/` → `LOAD_ERROR_MESSAGES.session`;
   - demais → `translateFirestoreError(code)` (Firestore: `permission-denied`, `unavailable` etc.).
4. Qualquer outra coisa → `translateFirestoreError(undefined)` ("Ocorreu um erro inesperado. Tente novamente.").

> `translateFirestoreError` é importado de `src/lib/firestoreErrors.ts`, que é puro, então a lib continua sem `firebase/*`.

```ts
export function resolveLoadView(state: {
  loading: boolean;
  error: boolean;
  isEmpty: boolean;
}): LoadView;
```
- `loading` → `'loading'`; senão `error` → `'error'`; senão `isEmpty` → `'empty'`; senão `'ready'`.
- É o ponto único que garante a RN-01: um bloco nunca chega a `'empty'` com `error === true`.

**`src/hooks/useAsyncState.ts` (modificar, retrocompatível):**

```ts
export interface AsyncRunContext { isCurrent: () => boolean }

export function useAsyncState(initialLoading = true): {
  loading: boolean;
  error: string;          // inalterado: fallbackMessage ('' sem erro)
  errorDetail: string;    // novo: describeLoadError(err) ('' sem erro)
  setError: (v: string) => void;
  setLoading: (v: boolean) => void;
  run: (
    action: (ctx: AsyncRunContext) => Promise<void>,
    errorLogLabel: string,
    fallbackMessage: string
  ) => Promise<void>;
};
```
- `const seq = useRef(0)`. Cada `run` faz `const id = ++seq.current; const isCurrent = () => id === seq.current;`.
- Início: `setLoading(true); setError(''); setErrorDetail('')`.
- `catch (err)`: `console.error(errorLogLabel, err)` **sempre** (mesmo se superado). Se `isCurrent()`: `setError(fallbackMessage); setErrorDetail(describeLoadError(err))`.
- `finally`: se `isCurrent()`, `setLoading(false)`.
- Retrocompatibilidade: as actions atuais (`async () => {...}`) ignoram o argumento. Os chamadores que fazem `setError(...)` dentro da action continuam funcionando, porque `error` continua sendo o mesmo estado.
- Não é preciso cancelar no desmontar: o React 18 ignora `setState` em componente desmontado sem aviso.

**Uso padrão nas telas (contrato do STEP 2 em diante):**

```tsx
const list = useAsyncState();
const load = useCallback(() => list.run(async ({ isCurrent }) => {
  const data = await listSolicitacoes(tenantId, { status });
  if (isCurrent()) setSolicitacoes(data);
}, 'Erro ao carregar procedimentos:', 'Não foi possível carregar os procedimentos'), [...]);

const view = resolveLoadView({ loading: list.loading, error: !!list.error, isEmpty: filtered.length === 0 });
```

### 6.3 Mudanças na UI

#### 6.3.0 Componente `LoadErrorAlert` (`src/components/ui/load-error-alert.tsx`)

```tsx
interface LoadErrorAlertProps {
  title: string;          // ex.: "Não foi possível carregar os procedimentos"
  description?: string;   // orientação fixa opcional, específica do bloco
  detail?: string;        // errorDetail (describeLoadError)
  onRetry: () => void;
  className?: string;
}
```
- Markup: `<Alert variant="destructive">` + `<AlertTriangle className="h-4 w-4" />` + `<AlertTitle>{title}</AlertTitle>` + `<AlertDescription className="space-y-3">`, com `<p>{description}</p>` (se houver), `<p>{detail}</p>` (se houver) e `<Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>`.
- O botão não precisa de estado "tentando": ao clicar, `loading` volta a `true` e o bloco mostra o skeleton.
- Sem `aria-live` extra: o `Alert` já tem `role="alert"`.

Texto "Indisponível" nos contadores: `<div className="text-sm font-medium text-muted-foreground">Indisponível</div>` no lugar do número, com o mesmo `CardHeader`.

#### 6.3.1 Procedimentos — `/clinic/requests` (UX-038)

| Bloco | Hoje | Depois |
|---|---|---|
| Lista (`listSolicitacoes`) | Falha → "Nenhum procedimento encontrado / Crie seu primeiro procedimento" + botão | `view === 'error'` → `LoadErrorAlert`. Título: "Não foi possível carregar os procedimentos". `description`: "Seus procedimentos registrados não foram afetados; a lista só não pôde ser lida agora. Antes de registrar um novo, tente carregar de novo para evitar duplicidade." Título do card: "Procedimentos" (sem contagem). O ramo vazio só aparece com `view === 'empty'`, com texto e CTA **idênticos** aos atuais |
| Cards do mês (`getDashboardProcedimentosStats`) | Falha → `—` | Erro → os três cards mostram "Indisponível" (sem a linha de crescimento) e, logo abaixo da grade, um `LoadErrorAlert` com o título "Não foi possível carregar os números do mês" e `onRetry` das estatísticas |
| Troca de filtro | Corrida possível | `isCurrent()` descarta resultado de execução superada |

O efeito de lista continua dependendo de `[tenantId, statusFilter]` e chama `load()`. O de estatísticas depende de `[tenantId]`.

#### 6.3.2 Pedidos de Transferência — `/consultant/transfer-requests` (UX-053)

- `loadRequests` passa a ser:
  ```ts
  run(async () => {
    const res = await fetch(...);
    setRequests((await readApiData<ConsultantTransferRequest[]>(res)) ?? []);
  }, 'Erro ao carregar pedidos de transferência:', 'Não foi possível carregar os pedidos de transferência')
  ```
- `view === 'error'`: o `LoadErrorAlert` substitui o `<Tabs>` inteiro.
  - Título: "Não foi possível carregar os pedidos de transferência".
  - `description`: "Os pedidos pendentes continuam valendo e têm prazo de resposta. Tente novamente para vê-los."
- `isEmpty` não se aplica ao `<Tabs>`: as abas continuam com os textos de vazio atuais **por aba**, só quando `view !== 'error'`.
- `handleApprove`/`handleRejectConfirm`: sem mudança de lógica. A releitura (`loadRequests()`) que falhar leva ao estado de erro (RF-06).

#### 6.3.3 Dashboard da clínica — `/clinic/dashboard` (UX-025 e UX-026)

| Bloco | Fonte | Hoje | Depois |
|---|---|---|---|
| Próximos Procedimentos | `getUpcomingProcedures(tenantId, 5)` | `Promise.all(...).catch(() => {})` → vazio | `useAsyncState` próprio. Erro → `LoadErrorAlert` com "Não foi possível carregar os próximos procedimentos" no `CardContent` |
| Atividade Recente | `getRecentActivity(tenantId, 5)` | falha engolida no serviço → vazio | `useAsyncState` próprio. Erro → `LoadErrorAlert` com "Não foi possível carregar a atividade recente" |
| Estoque (UX-026) | `getDashboardEstoqueStats` | `Alert` global + "Nenhum produto em estoque" | `useAsyncState` próprio. Erro → `LoadErrorAlert` com "Não foi possível carregar o resumo do estoque" no card. Vazio legítimo inalterado |
| Procedimentos do mês (UX-026) | `getDashboardProcedimentosStats` | `Alert` global + "Sem dados de procedimentos" | `useAsyncState` próprio. Erro → `LoadErrorAlert` com "Não foi possível carregar os procedimentos do mês" |
| `Alert` do topo | `error` compartilhado | escrito por estatísticas e listener | Só o listener de alertas escreve (UX-027, fora do escopo) |
| Projeção, Alertas, Produtos a Vencer | — | — | **Inalterados** |

`loadingBlocks`/`loadingDetails` são substituídos pelos `loading` de cada hook. Os skeletons atuais de cada bloco são mantidos.

#### 6.3.4 Usuários — `/admin/users` (UX-047)

- `loadAllUsers` dentro de `run(...)`. O `catch` externo sai (o hook faz o log). O `catch` interno da clínica passa a gravar `tenantName = 'Clínica indisponível'` (RF-09).
- `view === 'error'`: o `CardContent` da tabela mostra o `LoadErrorAlert` com o título "Não foi possível carregar os usuários". Os quatro cards mostram "Indisponível", e o subtítulo de cada card continua igual.
- A busca continua visível (sem efeito durante o erro). O vazio (`'Nenhum usuário encontrado'`/`'Nenhum usuário cadastrado'`) fica inalterado.
- O "Carregando usuários..." atual é mantido (UX-015 fora do escopo).
- `loadAllUsers()` depois de salvar: uma falha leva ao estado de erro.

#### 6.3.5 Minhas Clínicas — `/consultant/clinics` (UX-050)

- `loadClinics`:
  ```ts
  run(async () => {
    setClinics((await readApiData<Clinic[]>(response)) ?? []);
  }, 'Erro ao carregar clínicas:', 'Não foi possível carregar suas clínicas')
  ```
  Depois, **fora** do `run` e só em sucesso: `refreshClaims().catch((e) => console.error('Erro ao sincronizar vínculos:', e))`. Para saber se houve sucesso, o `run` não retorna valor: usar uma variável local `let loaded = false` setada dentro da action.
- `view === 'error'`: o `LoadErrorAlert` substitui a grade e o vazio.
  - Título: "Não foi possível carregar suas clínicas".
  - `description`: "Seus vínculos não foram alterados. Tente novamente antes de buscar ou pedir vínculo com uma clínica."
- Os dois vazios (sem vínculo × filtro sem resultado) ficam inalterados.

#### 6.3.6 Dashboard do consultor — `/consultant/dashboard` (UX-051)

| Bloco | Fonte | Depois |
|---|---|---|
| Página | — | Remove o spinner de página inteira (l. 117-125). Cabeçalho sempre visível; skeleton por bloco |
| Saudação | perfil | "Bem-vindo ao Portal do Consultor, {primeiro nome}" só quando há nome. Caso contrário, "Bem-vindo ao Portal do Consultor" (sem vírgula; cobre a parte de texto do UX-056 nesta condição) |
| Cartão do código | `GET /api/consultants/{consultantId}` (`useAsyncState` próprio) | Carregando → skeleton no lugar do código. Erro → `LoadErrorAlert` **no lugar do cartão** (fundo neutro; não usar o gradiente `sky` para o erro), com o título "Não foi possível carregar seu código de consultor". O botão copiar só existe com código |
| Clínicas Vinculadas (card) | `GET /api/consultants/me/clinics` (`useAsyncState` próprio) | Erro → "Indisponível" (sem "N ativas") |
| Projeção de Reposição (card) | derivado das clínicas | Erro das clínicas → "Indisponível", e o efeito da projeção **não** roda (guarda: só calcular se a view das clínicas for `'ready'` ou `'empty'`). Vazio legítimo (0 clínicas) e soma parcial inalterados |
| Minhas Clínicas (bloco) | idem | Erro → `LoadErrorAlert` com "Não foi possível carregar suas clínicas" e a mesma `description` da §6.3.5. Vazio "Você ainda não possui clínicas vinculadas" inalterado |

`refreshClaims` segue a mesma regra da §6.3.5. A falha do perfil não impede a leitura das clínicas, e vice-versa.

### 6.4 Mudanças em API Routes

N/A. As rotas `GET /api/consultants/me/clinics`, `GET /api/consultants/transfer-requests` e `GET /api/consultants/{id}` ficam inalteradas. O cliente passa a respeitar o status delas. A sinalização sobre o `error.message` cru no 500 fica na §10.

---

## 7. Plano de Implementação

### STEP 1 — Peças compartilhadas (lib pura, hook e componente)

**Objetivo:** Entregar `loadErrors.ts` (testado), `useAsyncState` estendido e `LoadErrorAlert`, sem tocar em nenhuma tela.

**Arquivos afetados:**
- `src/lib/loadErrors.ts` (a criar)
- `src/__tests__/loadErrors.test.ts` (a criar)
- `src/hooks/useAsyncState.ts`
- `src/components/ui/load-error-alert.tsx` (a criar)

**Ações:**
1. Implementar a lib conforme a §6.1/§6.2. O único import permitido é `translateFirestoreError`.
2. Escrever os testes da §8.1. Para `readApiData`, usar o `Response` global do Node (v22 no ambiente atual; `jest.config.js` usa `testEnvironment: 'node'`).
3. Estender `useAsyncState` (§6.2) mantendo a assinatura. Atualizar o comentário de cabeçalho para citar este bugfix.
4. Criar `LoadErrorAlert` (§6.3.0).

**Validação:** `npm run test -- loadErrors` passa. `npm run type-check` e `npm run lint` ficam sem erros. As três telas que já usam o hook (`/clinic/profile`, `/consultant/profile`, aba Consultor em `/clinic/my-clinic`) continuam abrindo normalmente (`npm run build` ok).

**Commit:** `fix(ui): add shared load error helpers, alert and async state guard`

### STEP 2 — Procedimentos (UX-038, Alta)

**Objetivo:** Uma falha ao listar procedimentos ou estatísticas aparece como erro, nunca como "Crie seu primeiro procedimento" ou `—`.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/requests/page.tsx`
- `src/lib/services/solicitacaoService.ts` (`listSolicitacoes` → `getDocsFromServer`, D1)
- `src/lib/services/dashboardService.ts` (`getDashboardProcedimentosStats` → `getDocsFromServer`, D1)

**Ações:**
1. Trocar `loading`/`loadingStats` por dois `useAsyncState`. Usar `isCurrent()` na lista.
2. Renderização por `resolveLoadView` (§6.3.1). O ramo vazio fica sem alteração textual.
3. "Indisponível" nos três cards e `LoadErrorAlert` das estatísticas.
4. Trocar `getDocs` por `getDocsFromServer` nas duas funções de serviço citadas (D1), sem mudar query ou filtros.

**Validação:**
- Com o DevTools em "Offline" depois de a página carregar, trocar o filtro de status: aparece "Não foi possível carregar os procedimentos" + "Tentar novamente", e não aparece "Crie seu primeiro procedimento".
- Ao voltar para "Online" e clicar em "Tentar novamente", a lista volta.
- Clínica sem procedimentos e online: o vazio atual aparece igual.

**Commit:** `fix(clinic): show load error instead of empty state in procedures list`

### STEP 3 — Pedidos de Transferência (UX-053, Alta)

**Objetivo:** Uma falha (rede ou `!ok`) ao listar pedidos aparece como erro, e não como "Nenhum pedido pendente".

**Arquivos afetados:**
- `src/app/(consultant)/consultant/transfer-requests/page.tsx`

**Ações:**
1. `loadRequests` com `useAsyncState` + `readApiData` (§6.3.2).
2. `LoadErrorAlert` no lugar do `<Tabs>` em erro.

**Validação:** com uma regra de bloqueio de URL no DevTools ("Block request URL" em `/api/consultants/transfer-requests`), a tela mostra o erro. Ao remover o bloqueio e clicar em "Tentar novamente", as abas aparecem. Sem pedidos, os textos de vazio aparecem iguais.

**Commit:** `fix(consultant): show load error instead of empty state in transfer requests`

### STEP 4 — Dashboard da clínica (UX-025 e UX-026)

**Objetivo:** Erro por bloco em "Próximos Procedimentos" e "Atividade Recente" e nos cards "Estoque" e "Procedimentos" (UX-026, D2).

**Arquivos afetados:**
- `src/app/(clinic)/clinic/dashboard/page.tsx`
- `src/lib/services/inventoryService.ts` (`getRecentActivity` propaga e usa `getDocsFromServer`)
- `src/lib/services/solicitacaoService.ts` (`getUpcomingProcedures` → `getDocsFromServer`)
- `src/lib/services/dashboardService.ts` (`getDashboardEstoqueStats` → `getDocsFromServer`)

**Ações:**
1. `getRecentActivity`: trocar `return []` por `throw error` e remover o comentário errado.
2. Separar o `Promise.all` dos detalhes em duas leituras com `useAsyncState` próprio (§6.3.3).
3. Separar o `Promise.all` das estatísticas da mesma forma (UX-026, D2). Elas deixam de chamar `setError`.
4. `getDocsFromServer` nas funções citadas (D1).

**Validação:** com "Offline" antes de abrir o Dashboard (ou bloqueando as requisições do Firestore no DevTools), "Estoque", "Procedimentos", "Próximos Procedimentos" e "Atividade Recente" mostram cada um o próprio erro e o próprio "Tentar novamente". Nenhum mostra a mensagem de vazio, e o `Alert` genérico "Erro ao carregar dados do dashboard" não aparece mais. A Projeção continua com o comportamento atual.

**Commit:** `fix(clinic): show per-block load errors in clinic dashboard`

### STEP 5 — Usuários (UX-047)

**Objetivo:** Uma falha ao listar usuários aparece como erro, os cards mostram "Indisponível" e a falha do nome da clínica não vira "Sem clínica".

**Arquivos afetados:**
- `src/app/(admin)/admin/users/page.tsx`

**Ações:**
1. `loadAllUsers` dentro de `run` (§6.3.4), com "Clínica indisponível" no `catch` interno.
2. Cards e tabela por `resolveLoadView`.
3. `getDocsFromServer` na query de `users` e `getDocFromServer` em `tenants/{id}` (D1).

**Validação:** com "Offline" antes de abrir `/admin/users`, aparecem "Não foi possível carregar os usuários" + "Tentar novamente" e os quatro cards em "Indisponível". "Nenhum usuário cadastrado" não aparece.

**Commit:** `fix(admin): show load error instead of empty state in users list`

### STEP 6 — Minhas Clínicas e Dashboard do consultor (UX-050, UX-051)

**Objetivo:** As duas telas tratam `!ok` e falha de rede como erro; no Dashboard, o erro é por bloco.

**Arquivos afetados:**
- `src/app/(consultant)/consultant/clinics/page.tsx`
- `src/app/(consultant)/consultant/dashboard/page.tsx`

**Ações:**
1. Minhas Clínicas conforme a §6.3.5 (inclui `refreshClaims` fora do caminho de erro).
2. Dashboard conforme a §6.3.6: dois `useAsyncState`, fim do spinner de página, guarda da projeção e saudação sem vírgula.

**Validação:**
- Bloqueando `/api/consultants/me/clinics` no DevTools: Minhas Clínicas mostra o erro, sem "Nenhuma clínica vinculada". No Dashboard, "Clínicas Vinculadas" e "Projeção de Reposição" mostram "Indisponível", o bloco mostra o erro e o cartão do código continua com o código.
- Bloqueando `/api/consultants/{id}`: só o cartão do código mostra erro, e a saudação fica sem vírgula.

**Commit:** `fix(consultant): show load errors in my clinics and consultant dashboard`

### STEP 7 — Caderno Playwright

**Objetivo:** Criar o caderno transversal da §8.2 (D3) com os cenários obrigatórios das 2 telas Alta e os demais viáveis.

**Arquivos afetados:**
- `tests/e2e/_ux-erro-exibido-como-vazio.spec.ts` (a criar; arquivo transversal, D3)

**Ações:**
1. Logins: `loginAs(page, TEST_USERS.systemAdmin, '/admin/dashboard')` e `loginAs(page, TEST_USERS.clinicAdminA, '/clinic/dashboard')` (`tests/e2e/helpers/auth.ts`). Para o consultor, usar **`TEST_USERS.consultantB`**, que tem aceite de termos no seed (`scripts/seed-emulator.ts:166-171`) e cai direto em `/consultant/dashboard`. O helper fica local ao spec, no mesmo padrão de `loginAsConsultantB` em `tests/e2e/UC-56-...spec.ts:98-104`.
   - **Não usar** `TEST_USERS.consultant` nem `TEST_USERS.clinicUserA`: os dois ficam de propósito sem aceite e caem em `/accept-terms` (`seed-emulator.ts:161-165`).
   - O seed **não muda**.
2. Simulação de falha:
   - leituras diretas do Firestore: `page.route('**/google.firestore.v1.Firestore/**', (r) => r.abort())`, técnica validada no UC-35 (`tests/e2e/UC-35-...spec.ts:121-127`);
   - API routes: `page.route('**/api/consultants/me/clinics', (r) => r.abort())`, padrão do UC-59 (`tests/e2e/UC-59-...spec.ts:289-293`).
   - Nos dois casos, aguardar `page.waitForEvent('requestfailed', ...)` antes das asserções, para que um glob errado falhe de forma explícita.
3. Cenários `!ok` (D4), só com status de erro e corpo mínimo `{ error }` (`route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Internal error (teste)' }) })`). O teste confere que o texto do corpo **não** aparece (RF-04).
4. Cabeçalho do spec com: mapeamento cenário → UX → UC, assunções a confirmar na revisão humana (como no UC-35) e a regra "se a interceptação não funcionar, parar e consultar o usuário; não trocar de técnica por conta própria".
5. Revisão humana do spec antes de virar gate de CI (regra 8 do `CLAUDE.md`).
6. **Confirmação da premissa da D1 (sem commit):** com o cenário 1 já verde, trocar **localmente e temporariamente** `getDocsFromServer` por `getDocs` em `listSolicitacoes` e rodar só o cenário 1. Registrar no cabeçalho do caderno e no PR o que foi observado:
   - (a) a tela cai no vazio legítimo (premissa confirmada); ou
   - (b) a tela mostra o erro mesmo com `getDocs` (premissa não confirmada).

   Depois, restaurar `getDocsFromServer` e confirmar com `git diff` que nada da troca temporária ficou. No caso (b), a D1 continua válida (§4.1(c)): avisar o orquestrador para que a justificativa seja ajustada aqui e no UC.

**Validação:** `npm run test:e2e -- tests/e2e/_ux-erro-exibido-como-vazio.spec.ts` passa. A suíte completa (`npm run test:e2e`) não regride.

**Commit:** `test(e2e): cover load failure states shown as empty (UX-038, UX-053 and others)`

### STEP 8 — Validação manual em `dev-gscandelari.web.app`

**Objetivo:** Confirmar o comportamento no Firebase real, depois do PR para `gscandelari_setup`.

**Ações (roteiro):**
1. Para cada uma das 6 telas: abrir online e conferir que dados e vazio legítimo estão iguais aos de antes.
2. DevTools em "Offline" (ou "Block request URL" para as rotas `/api/consultants/...`), provocar o carregamento e conferir:
   - o erro aparece no bloco certo;
   - o vazio não aparece;
   - nenhum `0` aparece nos contadores afetados;
   - "Tentar novamente" recupera.
3. Pedidos de Transferência: aprovar um pedido com a rede caindo logo depois (Offline após o toast) e conferir que a lista antiga não continua visível.
4. Dashboards: derrubar só uma rota ou bloco e conferir que os outros blocos ficam normais.
5. **Não** alterar dados de produção para testar.

**Validação:** os itens conferidos e descritos no PR.

**Commit:** N/A.

---

## 8. Estratégia de Testes

### 8.1 Jest (funções puras): `src/__tests__/loadErrors.test.ts`

| Função | Cenários obrigatórios |
|--------|----------------------|
| `readApiData` | 200 `{ data: [1] }` → `[1]`. 200 `{ success: true }` (sem `data`) → `undefined`. 200 com corpo não JSON → lança `ApiLoadError` (status 200). 500 `{ error: 'X' }` → `ApiLoadError` status 500, `serverMessage: 'X'`. 403 `{ error: 'Acesso negado' }` → `serverMessage: 'Acesso negado'`. 404 sem corpo → `serverMessage` undefined. `error` não string (`{ error: { code: 1 } }`) → `serverMessage` undefined. |
| `describeLoadError` | `ApiLoadError(401, 'x')` → mensagem de sessão (ignora o servidor). `ApiLoadError(403, 'Acesso restrito a consultores')` → a própria mensagem. `ApiLoadError(404)` sem mensagem → mensagem de servidor. `ApiLoadError(500, 'Missing or insufficient permissions.')` → mensagem fixa de servidor (**nunca** o texto cru). `new TypeError('Failed to fetch')` → mensagem de rede. `{ code: 'auth/network-request-failed' }` → rede. `{ code: 'auth/user-token-expired' }` → sessão. `{ code: 'permission-denied' }` → `translateFirestoreError('permission-denied')`. `{ code: 'unavailable' }` → texto de indisponível. `new Error('boom')`, `null` e `'string'` → genérico. |
| `resolveLoadView` | `loading` vence tudo (inclusive com `error` e `isEmpty`). `error` sem `loading` → `'error'` **mesmo com `isEmpty: true`** (RN-01). Sem erro e vazio → `'empty'`. Sem erro e com itens → `'ready'`. |

Hook, componente e páginas: não há teste Jest (`testEnvironment: 'node'`, regra do MVP). A cobertura vem do caderno Playwright. A retrocompatibilidade do hook é validada pelo `type-check` e pelo build.

### 8.2 Caderno Playwright: `tests/e2e/_ux-erro-exibido-como-vazio.spec.ts` (D3)

**Princípio:** nenhuma resposta de dados é fabricada. A falha é injetada na rede (`abort`), e o emulador continua real. A exceção é o `fulfill` de status de erro dos cenários 5, 11 e 12 (D4, precedente UC-06/UC-07).

**Por que falha simulada:** com as rules atuais, `clinicAdminA`, `systemAdmin` e `consultantB` sempre conseguem ler os dados das próprias telas. Não há falha "natural" no emulador sem mexer em rules (descartado no UX-046) ou no seed.

**Relação com D1:** os cenários que leem o Firestore direto (1, 2, 7 e 8) dependem de `getDocsFromServer` para que o `abort` vire erro. Pela documentação do SDK, com `getDocs` eles veriam o cache vazio. Essa premissa é confirmada na ação 6 do STEP 7. Os cenários de API route (3 a 6, 9 a 12) não dependem da D1.

| # | Tela (UX, UC) | Usuário | Preparação | Verificação | Obrig.? |
|---|---|---|---|---|---|
| 1 | Procedimentos (UX-038; UC-16..19) | `clinicAdminA` | Login. `goto('/clinic/requests')` online. Conferir o vazio legítimo atual ("Crie seu primeiro procedimento"; o seed não tem solicitações). Depois, `page.route(FIRESTORE_GLOB, abort)` e trocar o filtro de status para "Agendada" | `requestfailed` no glob. Visível "Não foi possível carregar os procedimentos" e "Tentar novamente". `getByText('Crie seu primeiro procedimento')` com `toHaveCount(0)`. Botão "Novo Procedimento" do vazio ausente. Título "Procedimentos" sem "(0)" | **Sim** (Alta) |
| 2 | Procedimentos: recuperação | idem | Continuação do 1: `page.unroute(FIRESTORE_GLOB)` | `expect(async () => { click "Tentar novamente"; expect(vazio legítimo visível) }).toPass({ timeout: 30_000 })` (backoff de reconexão, como no UC-35 cenário 2). Erro some | **Sim** |
| 3 | Pedidos de Transferência (UX-053; UC-26/27/54) | `consultantB` | Login. `page.route('**/api/consultants/transfer-requests', abort)`, depois `goto('/consultant/transfer-requests')` | `requestfailed`. Visível "Não foi possível carregar os pedidos de transferência". Aba "Pendentes" ausente (`getByRole('tab', { name: /Pendentes/ })` com `toHaveCount(0)`). "Nenhum pedido de transferência pendente" com `toHaveCount(0)` | **Sim** (Alta) |
| 4 | Pedidos: recuperação | idem | `unroute` e clicar em "Tentar novamente" | Abas visíveis. **Não** asserir vazio: outros specs (UC-54) podem deixar convites para `consultantB` | **Sim** |
| 5 | Pedidos: `!ok` (D4) | idem | `route.fulfill` 500 com `{ error: 'Internal error (teste)' }` | Erro visível. "Internal error (teste)" com `toHaveCount(0)`. Texto fixo de servidor visível | **Sim** (D4) |
| 6 | Minhas Clínicas (UX-050; UC-48) | `consultantB` | `route('**/api/consultants/me/clinics', abort)` + `goto('/consultant/clinics')` | Erro visível. "Nenhuma clínica vinculada" com `toHaveCount(0)`. Depois, `unroute` + "Tentar novamente" → "Nenhuma clínica vinculada" visível (`consultantB` tem `authorized_tenants: []`: vazio legítimo preservado) | Recomendado |
| 7 | Dashboard da clínica (UX-025; UC-53) | `clinicAdminA` | Login (cai em `/clinic/dashboard` online). `page.route(FIRESTORE_GLOB, abort)` + `page.reload()` | "Não foi possível carregar os próximos procedimentos" e "Não foi possível carregar a atividade recente" visíveis, e também "Não foi possível carregar o resumo do estoque" e "Não foi possível carregar os procedimentos do mês" (UX-026), cada um com o próprio "Tentar novamente" (`getByRole('button', { name: 'Tentar novamente' })` com `toHaveCount(4)`). "Nenhum procedimento agendado nas próximas 2 semanas", "Nenhuma movimentação recente", "Nenhum produto em estoque", "Sem dados de procedimentos" e "Erro ao carregar dados do dashboard" com `toHaveCount(0)` | Se viável (ver nota) |
| 8 | Usuários (UX-047; UC-36) | `systemAdmin` | Login. `route(FIRESTORE_GLOB, abort)` + `goto('/admin/users')` (mesma ordem do UC-35) | "Não foi possível carregar os usuários" visível. "Nenhum usuário cadastrado" com `toHaveCount(0)`. Card "Total de Usuários" contém "Indisponível". `unroute` + "Tentar novamente" → linha de `TEST_USERS.clinicAdminA.email` visível | Recomendado |
| 9 | Dashboard do consultor: clínicas (UX-051; UC-48/52) | `consultantB` | `route('**/api/consultants/me/clinics', abort)` + `goto('/consultant/dashboard')` | Bloco "Minhas Clínicas" com erro. "Você ainda não possui clínicas vinculadas" com `toHaveCount(0)`. Cards "Clínicas Vinculadas" e "Projeção de Reposição" com "Indisponível". Cartão do código **com** o código `TEST_USERS.consultantB.code` | Recomendado |
| 10 | Dashboard do consultor: perfil (UX-051) | `consultantB` | `route('**/api/consultants/qa-consultant-b', abort)` + `goto` | "Não foi possível carregar seu código de consultor" visível. Texto `Bem-vindo ao Portal do Consultor` sem vírgula final. Bloco "Minhas Clínicas" normal (vazio legítimo) | Recomendado |
| 11 | Minhas Clínicas: `!ok` (D4) | `consultantB` | `fulfill` 500 em `/api/consultants/me/clinics` | Erro visível; o corpo do servidor não aparece | **Sim** (D4) |
| 12 | Dashboard do consultor: `!ok` (D4) | `consultantB` | `fulfill` 403 `{ error: 'Acesso restrito a consultores' }` em `/api/consultants/me/clinics` | A mensagem 4xx do servidor **aparece** como detalhe (RF-04) | **Sim** (D4) |

**Notas de viabilidade:**
- **Cenário 7 (e 8):** com o Firestore abortado desde o carregamento, os componentes de layout também falham:
  - `ProtectedRoute.tsx:66` (`getDoc(system_settings/global)` sem `catch`, só para não-admin): rejeição não tratada, que no `next dev` pode abrir o overlay de erro;
  - `usePendingTerms` (com `catch`);
  - `useTenantSuspension` (`onSnapshot`).

  Se o overlay ou um redirecionamento impedir as asserções, o dev **para e registra** no cabeçalho do spec e no PR. Nesse caso, o cenário 7 fica coberto só pela validação manual (STEP 8), **sem** alterar `ProtectedRoute` neste bugfix. O cenário 8 (system_admin) não passa por essa leitura, como no UC-35.
- **Cenário 1:** a falha é provocada **depois** do carregamento (troca de filtro) justamente para não depender do layout.
- Rodar a suíte completa no DoD: os cenários não gravam dados (só leitura) e não precisam de `afterEach` de limpeza. Cada teste deve chamar `page.unroute` / `unrouteAll` antes de terminar, ou confiar no contexto novo por teste do Playwright.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — loadErrors.test.ts passando, suíte completa verde
[ ] npm run test:e2e    — caderno novo passando e nenhum outro spec regredido
[ ] Spec Playwright revisado por humano antes de virar gate de CI (regra 8 do CLAUDE.md)
[ ] Multi-tenant: nenhuma query nova; leituras de clínica continuam em tenants/{claims.tenant_id}
[ ] firestore.rules e firestore.indexes.json inalterados (git diff vazio nesses arquivos)
[ ] Segurança: nenhum secret ou credencial no código
[ ] Nenhum error.message cru exibido nas 6 telas (grep "error.message" nos arquivos modificados só em console.error)
[ ] getRecentActivity não contém mais "return []" no catch
[ ] Premissa da D1 (getDocs offline) registrada no cabeçalho do caderno e no PR (STEP 7, ação 6); troca temporária revertida
[ ] As 6 telas: falha → LoadErrorAlert no bloco; vazio legítimo com texto idêntico ao anterior
[ ] Leituras por API route: response.ok === false tratado via readApiData (sem "if (res.ok)" silencioso)
[ ] Chamadores antigos de useAsyncState (clinic/profile, consultant/profile, useLinkedConsultant) sem alteração e funcionando
[ ] Branch pessoal: PR da task para gscandelari_setup, validado em dev-gscandelari.web.app (STEP 8)
[ ] PR gscandelari_setup → develop aberto com template preenchido
[ ] Pós-PR: uc-issues-tracker, uml-use-case-writer e ux-reviewer Modo C acionados (§12.1)
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| A premissa da D1 (`getDocs` offline resolve com o cache) não se confirmar no E2E | Baixa | Baixo | A D1 continua correta (`getDocsFromServer` é explícito). Só a justificativa muda: registrar no caderno e no PR (STEP 7, ação 6) e ajustar a §4.1(c) e o UC |
| `page.route` do Firestore no cenário 7 dispara o overlay do Next dev por rejeição não tratada em `ProtectedRoute.tsx:66` | Média | Médio | Parar e registrar; cobrir pela validação manual. Não corrigir `ProtectedRoute` aqui. Sinalizar ao `ux-reviewer`/`security-auditor` |
| Cenário de recuperação intermitente (backoff do SDK) | Média | Baixo | `toPass` com 30 s e cliques repetidos (padrão UC-35). Alternativa: `page.reload()` depois do `unroute`, registrada no cabeçalho |
| Convites ou pedidos deixados por outros specs para `consultantB` mudam o que aparece em "Pedidos" | Média | Baixo | Os cenários 3 e 4 não asserem vazio nem contagem, só erro × ausência de erro |
| Mudança em `useAsyncState` quebra um chamador antigo | Baixa | Médio | Assinatura mantida, `type-check` + build e abertura manual das 3 telas (STEP 1) |
| As rotas do consultor continuam devolvendo `error.message` cru no 500 (fora do escopo) | Alta | Baixo | `describeLoadError` nunca exibe corpo 5xx. Sinalizar ao `uc-issues-tracker` como item novo (mesmo padrão do `UC-37-RN-06`) |
| `getDocsFromServer` aumenta a latência percebida em rede lenta (não usa cache) | Baixa | Baixo | O cache em memória quase nunca tem esses dados. Skeletons por bloco já existem |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Erro exibido como vazio | Falha de carregamento que a tela mostra como "nenhum item", estado vazio com CTA ou contador `0` (`_PADRAO-UX.md` §2, regra 1). |
| Vazio legítimo | Leitura bem-sucedida que retornou zero itens. O texto e o CTA atuais são preservados. |
| Bloco | Área da tela alimentada por uma leitura independente, com loading, erro e conteúdo próprios. |
| `LoadErrorAlert` | Componente compartilhado do estado de erro: `Alert` destrutivo + título + detalhe + "Tentar novamente". |
| `ApiLoadError` | Erro lançado por `readApiData` quando uma API route responde `!ok` ou com corpo ilegível. |
| `getDocsFromServer` | Variante de leitura do SDK web que nunca responde do cache: rejeita se não alcançar o servidor. |
| Guarda de sequência | Mecanismo do `useAsyncState` que ignora o resultado de uma execução superada por outra mais recente. |
| Injeção de falha de rede | Abortar requisições no navegador (`page.route(...).abort()`) sem fabricar resposta. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/_PADRAO-UX.md` v1.0.1:
  - §2 (estados obrigatórios, regras 1-4);
  - §5 (mensagens pt-BR, `data.error` de `/api/*`);
  - §7.2 (linhas UX-025, UX-026, UX-038, UX-047, UX-050, UX-051, UX-053);
  - §7.6 (exceções: Último acesso, Projeção);
  - §8(c), lote 1.
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` v3.62 §8.6:
  - severidades: UX-038 e UX-053 Alta; UX-025, UX-047, UX-050 e UX-051 Média;
  - pares "só no UC": UX-050 e UX-051 ↔ UC-48 §10 RNF-01 / fluxo 8a;
  - destaque 18.
- UCs:
  - UC-16, UC-17, UC-18 e UC-19 (Procedimentos);
  - UC-26, UC-27 e UC-54 (Pedidos/convites);
  - UC-53 (widget "Atividade Recente", §12);
  - UC-08, UC-36 e UC-37 (Admin › Usuários);
  - UC-48 v1.2 (§4.2, fluxos 8a/8b, RNF-01, §14 item 4);
  - UC-52 (RNF-04, padrão de erro da projeção).
- Padrão entregue: `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-admin-settings-sobrescrita-falha-leitura.md` e `src/app/(admin)/admin/settings/page.tsx:53-85`, `:212-227`.
- `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md` v2.0 (política sem mock; regra 8).
- Código citado:
  - telas: os 6 `page.tsx` do escopo;
  - serviços: `src/lib/services/inventoryService.ts:213-246`, `solicitacaoService.ts:1006-1052` e `:1144-1175`, `dashboardService.ts:26-146`;
  - hook, lib e componentes: `src/hooks/useAsyncState.ts`, `src/lib/firestoreErrors.ts`, `src/components/ui/alert.tsx`, `src/components/inventory/ProjectionsView.tsx:105-111`;
  - autenticação e layout: `src/components/auth/ProtectedRoute.tsx:66`, `src/hooks/usePendingTerms.ts`, `src/lib/firebase.ts:42`;
  - API routes: `src/app/api/consultants/me/clinics/route.ts`, `src/app/api/consultants/transfer-requests/route.ts`, `src/app/api/consultants/[id]/route.ts`.
- Testes de referência:
  - `tests/e2e/UC-35-...spec.ts` (abort do Firestore, `toPass`);
  - `tests/e2e/UC-59-...spec.ts:289` (abort de API route);
  - `tests/e2e/UC-56-...spec.ts:98` (login de `consultantB`);
  - `tests/e2e/UC-06-...spec.ts:161` (precedente de `fulfill` 500);
  - `tests/e2e/fixtures/seed-data.ts`, `scripts/seed-emulator.ts:155-181` (aceite de termos), `playwright.config.ts` (`next dev`, `workers: 1`).
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`: Git Flow e Conventional Commits.

### 12.1 Atualizações esperadas depois da correção (pipeline de agentes)

- **`ux-reviewer` (Modo C, re-verificação obrigatória antes de qualquer item sair de Aberto):**
  - confirmar UX-025, UX-038, UX-047, UX-050, UX-051 e UX-053 e UX-026 no código;
  - atualizar a `_PADRAO-UX.md`:
    - §2: trocar a lista de "Desvio típico" da linha Erro e citar `LoadErrorAlert` + `useAsyncState` + `resolveLoadView` como "Exemplo a seguir";
    - §7.1: P0 abertos 7 → 1 (só UX-035);
    - §7.3: linhas UC-16..19, UC-26/27, UC-36, UC-48, UC-53 e UC-54;
    - §8(c): lote 1 entregue.
  - Registrar como observação nova:
    - a precificação silenciosa em `/clinic/requests` (colunas de custo em `—` quando a leitura falha);
    - a rejeição não tratada de `ProtectedRoute.tsx:66` offline.
  - Avaliar a inclusão de `/consultant/*` em `A11Y_ROUTES` usando `consultantB` (§8(d) do padrão; o seed já permite).
- **`uc-issues-tracker` → mapa (v3.62 → próxima):**
  - UX-025, UX-038, UX-047, UX-050, UX-051 e UX-053 e UX-026 vão para "Corrigido e Documentado", **só depois** do Modo C;
  - atualizar a contagem da §1 (tabela de achados de UX) e o destaque 18;
  - pares "só no UC": UX-050/UX-051 ↔ UC-48 RNF-01. A correção vira sinalização ao `uml-use-case-writer` (regra de sincronização da §8.6). UX-052 continua aberto, então o RNF-01 do UC-48 fica **parcialmente** resolvido (fluxo 8a sim; 8b, que é o detalhe da clínica, não);
  - item novo sugerido: rotas `/api/consultants/me/clinics`, `/api/consultants/transfer-requests` e `/api/consultants/[id]` devolvem `error.message` cru no 500 (mesmo padrão do `UC-37-RN-06`).
- **`uml-use-case-writer`:**
  - **UC-48:**
    - §4.2 (garantia mínima: falha visível com "Tentar novamente");
    - fluxo 8a reescrito (erro distinto do vazio, `!ok` tratado);
    - RNF-01 marcado como parcialmente corrigido (telas Minhas Clínicas e Dashboard; detalhe da clínica pendente, UX-052);
    - §14 item 4 respondido para essas duas telas;
    - Dashboard do consultor: erro por bloco e projeção "Indisponível" quando as clínicas falham.
  - **UC-26 / UC-27 / UC-54:** confirmar ou acrescentar o fluxo de exceção "falha ao carregar a lista de pedidos" (pedido explícito do `_PADRAO-UX.md` §8(b)), com o comportamento novo, inclusive a releitura após aprovar/rejeitar.
  - **UC-16 (e citação em UC-17/18/19):** fluxo de exceção da lista `/clinic/requests` (erro distinto, sem CTA de criação, aviso de duplicidade).
  - **UC-36:** fluxo de exceção da listagem `/admin/users` ("Indisponível" nos cards, "Clínica indisponível" na linha).
  - **UC-53:** §12, o widget "Atividade Recente" passa a exibir erro em vez de vazio.
  - **UC-52:** RF-03/RNF-02 inalterados; registrar que o card do consultor não calcula quando a lista de clínicas falha.
- **Caderno de teste:** registrar no mapa e nos UCs que o caderno transversal `tests/e2e/_ux-erro-exibido-como-vazio.spec.ts` (D3) cobre os fluxos de falha. Os cadernos completos dos UCs continuam pendentes (retroativo, regra 8).

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 22/10/2026 | Doc Writer (Claude) | Versão inicial, baseada em `develop` `f4d516a` (worktree `curva_mestra-ux046`). Status "Aguardando decisão" por causa de D1 (`getDocsFromServer` nas leituras diretas do Firestore), D2 (incluir UX-026), D3 (caderno transversal × por UC) e D4 (`route.fulfill` de status de erro para cobrir `!ok` no E2E). |
| 1.1 | 23/10/2026 | Doc Writer (Claude) | As quatro decisões foram respondidas explicitamente pelo usuário em 22/10/2026 (pergunta estruturada). Status: "Aguardando decisão" → "Planejamento". **D1 = sim:** `getDocsFromServer` nas leituras diretas do Firestore dos blocos do escopo (`getDocFromServer` no nome da clínica em Usuários). A premissa sobre o `getDocs` offline vem da documentação do SDK e será confirmada no E2E (nova ação 6 do STEP 7, sem commit; novo item no DoD; risco da §10 reescrito). **D2 = sim:** UX-026 entra no lote (RF-08, §6.3.3, STEP 4 e cenário 7 com 4 blocos); UX-027 fica fora. **D3:** caderno transversal `tests/e2e/_ux-erro-exibido-como-vazio.spec.ts`. **D4 = sim:** cenários 5, 11 e 12 obrigatórios, com `route.fulfill` só de status 500/403 e corpo mínimo. A seção "Decisões pendentes" virou "Decisões resolvidas", e as condicionais "se D1/D2/D3/D4" foram removidas do escopo, do mapa de impacto, dos commits, dos STEPs, do caderno e das atualizações pós-correção. |
| 1.2 | 23/10/2026 | Claude (implementação) | Task concluída e movida para `TASK_COMPLETED`. Commits: `0e86624` (spec), `0ae4f45` (`loadErrors.ts` + 23 testes Jest, `useAsyncState` com `errorDetail`/guarda de sequência, `LoadErrorAlert` e `UnavailableValue` em `load-error-alert.tsx`), `aa03fba` (UX-038), `c053b73` (UX-053), `c518149` (UX-025/UX-026; `getRecentActivity` propaga o erro), `c9e74ac` (UX-047), `53152b8` (UX-050/UX-051), `fc44d2e` (caderno `_ux-erro-exibido-como-vazio.spec.ts`, 10 testes cobrindo os 12 cenários; cenário 7 viável, sem `test.fixme`). Ajustes de implementação: `UnavailableValue` virou componente compartilhado (em vez de markup repetido); nas telas do consultor, `refreshClaims` é chamado via `ref` (ele muda de identidade a cada render e geraria loop como dependência), o que também eliminou o `eslint-disable` do Dashboard do consultor; nos cenários 6 e 10 o caderno lê do emulador se o `consultantB` já tem vínculos (o UC-56 vincula clínicas a ele na suíte). **Premissa da D1 confirmada — resultado (a)**: com `listSolicitacoes` temporariamente em `getDocs` e o Firestore abortado, a tela mostrou "Procedimentos (0)" / "Crie seu primeiro procedimento"; troca revertida (registrado no cabeçalho do caderno). Validação: Jest 43 suítes/794 testes; type-check ok; lint 0 erros (326 warnings, 2 a menos que antes); build ok; rules/índices inalterados; caderno 10/10 em 2,0 min. Suíte E2E local completa: 176 passed, 4 failed — UC-09, UC-52, UC-53 e UC-58, com as mesmas mensagens da rodada local anterior a esta task (instabilidade local já conhecida; UC-52 e UC-58 falham em navegação de telas não alteradas aqui). STEP 8 (validação manual em `dev-gscandelari.web.app`) fica para depois do PR. Pendências pós-correção (§12.1): `ux-reviewer` Modo C, `uc-issues-tracker` (pares ↔, inclusive UX-050/UX-051 ↔ UC-48 RNF-01 parcial) e `uml-use-case-writer`. |
