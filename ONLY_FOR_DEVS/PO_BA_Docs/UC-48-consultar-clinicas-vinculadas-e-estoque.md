# UC-48: Consultar Clínicas Vinculadas e Estoque

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Portal do Consultor

**Versão:** 1.3

> Um Consultor navega pelas clínicas vinculadas à sua conta em três telas encadeadas, todas somente-leitura: `/consultant/clinics` (lista com busca local), `/consultant/clinics/{tenantId}` (detalhe com estatísticas de estoque) e `/consultant/clinics/{tenantId}/inventory` (inventário completo, reutilizando o mesmo componente `InventoryView` do Portal Clinic, restrito à marca Rennova). O consultor nunca edita nada nessas telas — apenas consulta. **[Novo em v1.1 — UC-58]** O detalhe da clínica ganhou o botão **"Ver Precificação"**, exibido somente quando o Clinic Admin daquela clínica ativou o compartilhamento de dados financeiros **para este consultor** (opt-in); ele leva à tela somente-leitura `/consultant/clinics/{tenantId}/pricing` (custo da hora clínica, custos fixos, markup e preço sugerido dos protocolos).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    Consultor([👤 Consultor])

    subgraph Sistema["Curva Mestra"]
        UC48(("UC-48\nConsultar Clínicas\nVinculadas e Estoque"))
        UC24(("UC-24\nVincular-se Automaticamente\na Clínica"))
    end

    UC58(("UC-58\nPrecificar Protocolos\npela Hora Clínica\n(visão somente leitura)"))

    Consultor --> UC48
    UC24 -.->|clínicas vinculadas\naqui aparecem em| UC48
    UC58 -.->|"<<extend>> Ver Precificação\n(só com opt-in do clinic_admin)"| UC48
    UC48 -.->|GET, somente leitura,\nfiltrado brand=Rennova| Firestore[(Firestore\ntenants/{id}/inventory)]
```

---

## 2. Atores

### 2.1 Ator Primário
**Consultor** — as três páginas ficam sob o grupo de rota `(consultant)`, protegidas por role de consultor; nenhuma delas é acessível a `clinic_admin`/`clinic_user`/`system_admin`.

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo. Os dados consultados são os mesmos geridos pelos módulos de Inventário (UC-10 a UC-14) e de vínculo de consultor (UC-24 a UC-27), sob a mesma fonte (`tenants/{tenantId}/inventory`), sem nenhuma cópia/denormalização própria.

---

## 3. Pré-condições
- Usuário autenticado com `is_consultant === true` e `authorized_tenants` definido nos custom claims.
- Para acessar detalhe (`/consultant/clinics/{tenantId}`) ou inventário (`/consultant/clinics/{tenantId}/inventory`) de uma clínica específica: `tenantId` deve constar em `authorizedTenants` (verificado no client, via `useAuth`); caso contrário, o sistema redireciona de volta para `/consultant/clinics`.

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Nenhum dado é alterado em nenhuma das três telas — este UC é inteiramente de consulta.
- **Lista (`/consultant/clinics`):** exibe todas as clínicas retornadas por `GET /api/consultants/me/clinics`, filtráveis localmente (client-side, sem nova consulta) por nome, documento ou e-mail.
- **Detalhe (`/consultant/clinics/{tenantId}`):** exibe nome, documento formatado e status (Ativa/Inativa) da clínica, mais três cards de estatística de estoque (Itens no Estoque, Próximos a Vencer — 30 dias, Estoque Baixo), calculados a partir do inventário filtrado por `brand == 'Rennova'`.
- **[Novo em v1.1] Precificação (`/consultant/clinics/{tenantId}/pricing`, só com opt-in):** exibe, somente leitura, o resumo do custo da hora clínica do mês corrente, os custos fixos (itens base com valor, custos personalizados, Boletos Tec ativos e total), o markup (imposto, taxas de débito e crédito, comissão, margem) e o preço sugerido de cada protocolo (Pix/Dinheiro e Crédito), com detalhe de material só dos produtos Rennova (UC-58, Fluxo Alternativo 7f).
- **Inventário (`/consultant/clinics/{tenantId}/inventory`):** exibe a listagem completa de itens Rennova em modo somente-leitura (`InventoryView` com `readOnly` e `onlyBrand="Rennova"`), com exportação para Excel disponível, mas sem botão de "Adicionar Produtos" e sem navegação para o detalhe de item individual (ambos dependem de props — `onAddProducts`/`onRowClick` — que esta tela nunca passa ao componente).

### 4.2 Falha (Garantias Mínimas)
- **[Atualizado em v1.3 — UX-050/UX-051 corrigidos]** Se `GET /api/consultants/me/clinics` falhar (exceção de rede, resposta `!ok` ou corpo 2xx ilegível): nenhum dado é alterado, os vínculos do consultor permanecem como estão, `refreshClaims()` **não** é chamado e a falha fica **visível** em um estado de erro distinto do estado vazio ("Não foi possível carregar suas clínicas"), com o botão **"Tentar novamente"**, que repete só essa leitura (fluxo 8a). O mesmo vale para os blocos do Dashboard do consultor que dependem dessa leitura (fluxo 8d).
- Se a página de detalhe (`/consultant/clinics/{tenantId}`) falhar ao ler as estatísticas ou o documento do tenant: comportamento ainda silencioso (fluxo 8b; UX-052 `Aberto`).
- Se `tenantId` não estiver em `authorizedTenants`: usuário é redirecionado para `/consultant/clinics`, sem nenhuma mensagem explicando o motivo.

---

## 5. Gatilho (Trigger)
Consultor navega para `/consultant/clinics` (menu "Minhas Clínicas" do Portal do Consultor) e, a partir daí, clica em uma clínica (`ClinicCard`) e depois em "Ver Estoque" (ou, **[v1.1]** quando disponível, em "Ver Precificação").

---

## 6. Fluxo Principal (Basic Flow)

1. Consultor acessa `/consultant/clinics`.
2. Sistema chama `GET /api/consultants/me/clinics` com o token do usuário e popula a lista. **[Atualizado em v1.3]** Só depois de uma leitura bem-sucedida, chama `refreshClaims()` para sincronizar `authorized_tenants`; uma falha desse passo é apenas registrada em `console.error('Erro ao sincronizar vínculos:', …)` e não é tratada como erro de carregamento (as clínicas já foram lidas). Enquanto a leitura não termina, a área da lista mostra um indicador de carregamento. Se a leitura falhar, ver fluxo 8a.
3. Sistema exibe as clínicas em um grid de cards (`ClinicCard`), com um campo de busca que filtra localmente por nome, documento ou e-mail (sem nova chamada de API).
4. Consultor clica em uma clínica; sistema navega para `/consultant/clinics/{tenantId}`.
5. Sistema verifica `authorizedTenants.includes(tenantId)`; se verdadeiro, chama (sem uso do resultado — ver RN-01) `GET /api/tenants/{tenantId}/consultant`, depois consulta `tenants/{tenantId}/inventory` filtrando `brand == 'Rennova'` para calcular estatísticas (`computeInventoryStats`), e busca os dados básicos do tenant (`tenants/{tenantId}`) via client SDK. **[Novo em v1.1]** Entre a consulta de estatísticas e a dos dados do tenant, sistema tenta ler `tenants/{tenantId}/financeiro/custo_hora` (`getCustoHoraConfig`): se a leitura devolver um documento, marca a precificação como compartilhada; documento inexistente ou qualquer erro (inclusive `permission-denied`) a marca como não compartilhada, sem mensagem.
6. Sistema exibe nome, documento formatado, badge de status, e os três cards de estatística — o card "Estoque Baixo" exibe o texto "produtos Rennova com **10 unidades ou menos**" (**[CORRIGIDO em v1.0.1, commit `70a38d7`]** — ver RN-02).
7. Sistema exibe os botões de ação "Ver Estoque", "Ver Projeções" (UC-52) e, **[novo em v1.1]** somente se a precificação foi marcada como compartilhada no passo 5, **"Ver Precificação"** (ícone de calculadora — Fluxo Alternativo 7d). Consultor clica em "Ver Estoque"; sistema navega para `/consultant/clinics/{tenantId}/inventory`.
8. Sistema renderiza `InventoryView` com `tenantId`, `readOnly`, `onlyBrand="Rennova"` e `backUrl` de volta ao detalhe — mesma listagem/filtros/exportação já documentados em UC-13/UC-14 do lado da clínica, mas sem nenhuma ação de escrita disponível.
9. Caso de uso é concluído a qualquer momento em que o consultor navega para fora dessas três telas.

---

## 7. Fluxos Alternativos

### 7a. Nenhuma clínica vinculada (a partir do passo 3)
1. `clinics.length === 0`.
2. Sistema exibe estado vazio: "Nenhuma clínica vinculada" com um botão "Buscar Clínicas" (leva a `/consultant/clinics/search`, UC-24).

### 7b. Busca local sem resultados (a partir do passo 3)
1. `searchTerm` não corresponde a nenhuma clínica da lista já carregada.
2. Sistema exibe "Nenhuma clínica encontrada com os filtros aplicados" (mensagem diferente do estado "sem nenhuma clínica vinculada").

### 7c. Acesso direto a uma URL de clínica não vinculada (a partir do passo 5)
1. `tenantId` da URL não está em `authorizedTenants`.
2. Sistema redireciona imediatamente para `/consultant/clinics`, sem carregar nenhum dado da clínica solicitada. **[v1.1]** O mesmo vale para `/consultant/clinics/{tenantId}/pricing`.

### 7d. [Novo em v1.1] Ver Precificação da clínica (a partir do passo 7 — `<<extend>>` por UC-58)
1. Com o compartilhamento ativo para este consultor, ele clica em **"Ver Precificação"**; sistema navega para `/consultant/clinics/{tenantId}/pricing`.
2. Sistema lê `financeiro/custo_hora`; com o documento disponível, lê também `protocolos` e o inventário do tenant e exibe: botão "Voltar" (para o detalhe), título "Precificação", `ReadOnlyBanner`, card "Custo da Hora Clínica" (mês corrente), "Custos fixos mensais", "Markup" e "Protocolos" (Duração · Material · Hora clínica · Custo real · Preço Pix/Dinheiro · Preço Crédito por protocolo).
3. O detalhe de material de cada protocolo lista só os produtos Rennova; os de outras marcas aparecem agregados em "Outros materiais ({n})", sem nome nem código; os totais incluem todos os itens (UC-58 RN-12).
4. Nenhum campo é editável e nada é gravado. Regras completas em UC-58, Fluxo Alternativo 7f.

---

## 8. Fluxos de Exceção

### 8a. Falha ao carregar lista de clínicas (a partir do passo 2) — **[Reescrito em v1.3 — UX-050 corrigido]**
1. A leitura de `GET /api/consultants/me/clinics` falha: `fetch` lança exceção (rede), a API responde com status `!ok` (ex.: 403, 500) ou devolve um corpo 2xx ilegível. Desde v1.3 o status da resposta é respeitado (`readApiData`, `src/lib/loadErrors.ts`); até v1.2, um `!ok` era tratado como lista vazia.
2. Sistema registra o erro em `console.error('Erro ao carregar clínicas:', …)` e **não** chama `refreshClaims()`.
3. No lugar da grade de cards e dos estados vazios (7a/7b), sistema exibe um alerta de erro (`LoadErrorAlert`, `role="alert"`) com o título **"Não foi possível carregar suas clínicas"**, a orientação **"Seus vínculos não foram alterados. Tente novamente antes de buscar ou pedir vínculo com uma clínica."**, um detalhe em pt-BR e o botão **"Tentar novamente"**. O detalhe segue `describeLoadError`: falha de rede → "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."; 401 → "Sua sessão expirou. Faça login novamente."; outro 4xx com mensagem do servidor → a mensagem do servidor; 5xx → texto fixo "O servidor não conseguiu responder agora. Tente novamente em instantes." (o corpo cru do 500 nunca é exibido).
4. O estado de erro é **distinto** dos fluxos 7a ("Nenhuma clínica vinculada", com o botão "Buscar Clínicas") e 7b: esses só aparecem depois de uma leitura bem-sucedida.
5. Consultor clica em "Tentar novamente"; sistema volta ao indicador de carregamento e repete o passo 2. Com sucesso, segue para o passo 3 (ou 7a/7b) e só então chama `refreshClaims()`.
6. O campo de busca continua visível durante o erro, sem efeito (não há lista carregada para filtrar).

### 8b. Falha ao carregar estatísticas ou dados do tenant (a partir do passo 5)
1. A consulta ao inventário ou ao documento do tenant lança exceção.
2. Erro é registrado via `console.error`, mas a tela **não interrompe o carregamento** — cada bloco (`try/catch` separado) falha de forma independente; estatísticas permanecem zeradas ou o nome da clínica permanece vazio (`tenant?.name || 'Clínica'`), sem nenhum aviso de erro visível.

### 8c. [Novo em v1.1] Acesso direto à tela de precificação sem compartilhamento (a partir de 7d)
1. Consultor acessa `/consultant/clinics/{tenantId}/pricing` (clínica vinculada) sem que o Clinic Admin tenha compartilhado os dados financeiros com ele — ou com o compartilhamento amarrado a outro consultor (ex.: após transferência da clínica).
2. A leitura de `financeiro/custo_hora` é negada pelas rules (ou o documento não existe); sistema exibe "Esta clínica não compartilhou dados financeiros com você." (ícone de cadeado) e não carrega protocolos nem inventário.

### 8d. [Novo em v1.3 — UX-051 corrigido] Falha de carregamento no Dashboard do consultor (`/consultant/dashboard`)
O Dashboard do consultor é um ponto de entrada deste UC: o bloco "Minhas Clínicas" lista até 6 clínicas da mesma leitura `GET /api/consultants/me/clinics` (o clique leva a `/consultant/clinics/{tenantId}`, passo 4) e o botão "Ver Todas" leva a `/consultant/clinics` (passo 1). A tela faz duas leituras independentes, cada uma com o próprio estado de carregamento (skeleton por bloco) e de erro; não há mais spinner de página inteira, e o cabeçalho ("Dashboard" e a saudação) fica sempre visível.
1. **Falha na leitura do perfil** (`GET /api/consultants/{consultantId}`): no lugar do cartão "Seu código de consultor" (fundo neutro, sem o gradiente do cartão), sistema exibe o alerta **"Não foi possível carregar seu código de consultor"**, com detalhe em pt-BR e **"Tentar novamente"** (repete só a leitura do perfil). O botão de copiar só existe quando há código. A saudação fica "Bem-vindo ao Portal do Consultor" (sem vírgula e sem nome). As clínicas carregam normalmente.
2. **Falha na leitura das clínicas** (`GET /api/consultants/me/clinics`: exceção, `!ok` ou corpo ilegível):
   - o card "Clínicas Vinculadas" mostra **"Indisponível"** no lugar do número (sem a linha "N ativas");
   - o card "Projeção de Reposição" mostra **"Indisponível"** e a projeção **não é calculada** (o cálculo só roda depois que as clínicas foram lidas com sucesso, inclusive com 0 clínicas; ver UC-52);
   - o bloco "Minhas Clínicas" exibe o alerta **"Não foi possível carregar suas clínicas"**, com a mesma orientação do fluxo 8a, detalhe em pt-BR e **"Tentar novamente"**, no lugar do vazio "Você ainda não possui clínicas vinculadas" (que só aparece com leitura bem-sucedida e 0 clínicas);
   - `refreshClaims()` não é chamado; o cartão do código continua visível.
3. O "Tentar novamente" do bloco "Minhas Clínicas" repete só a leitura das clínicas; com sucesso, os dois cards e o bloco voltam ao estado normal e a projeção é calculada.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Achado, código morto]** `loadTenantData` (página de detalhe) chama `fetch(\`/api/tenants/\${tenantId}/consultant\`, ...)` mas nunca lê o corpo da resposta (`await fetch(...)` sem `.json()` nem checagem de `response.ok`) — a chamada não tem nenhum efeito observável na tela; parece um resquício de uma versão anterior da página. | Confirmado por leitura literal de `loadTenantData` — o resultado do `fetch` nunca é atribuído a nenhuma variável usada depois. |
| RN-02 | **[CORRIGIDO — commit `70a38d7`]** Antes: o card "Estoque Baixo" exibia o texto fixo "produtos Rennova com **5 unidades ou menos**", mas o cálculo real (`computeInventoryStats`) usa o limiar **`<= 10`**, não 5 — texto e comportamento real divergiam, confundindo o consultor sobre o que o número exibido realmente significava. Agora: o texto de `ClinicDetailPage` foi corrigido para "produtos Rennova com **10 unidades ou menos**", batendo com o threshold real (mesmo valor usado como fallback padrão em `getStatusEstoque` em outras partes do sistema). | Correção confirmada por leitura do commit `70a38d7` (`src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx`) comparada a `computeInventoryStats` em `inventoryUtils.ts` (linha `if (quantidade_disponivel <= 10) low_stock++`). |
| RN-03 | O limiar de 10 usado aqui é um **terceiro mecanismo de "estoque baixo"**, completamente independente do limite por produto (UC-15) e do fallback de tenant (UC-43, também default 10 — coincidência de valor, não relação de código) — `computeInventoryStats` não lê nenhuma configuração, é um valor fixo no código. | Confirmado por leitura de `computeInventoryStats` — nenhuma referência a `stock_limits` (UC-15) nem a `NotificationSettings` (UC-43). |
| RN-04 | O inventário exibido é sempre filtrado por `brand == 'Rennova'`, tanto no cálculo de estatísticas (query direta) quanto na listagem completa (`onlyBrand="Rennova"` em `InventoryView`) — produtos de outras marcas cadastrados no tenant nunca aparecem para o consultor. | Confirmado por leitura de `loadTenantData` (`where('brand', '==', 'Rennova')`) e da prop `onlyBrand` passada em `ConsultantInventoryPage`. |
| RN-05 | O modo somente-leitura do inventário é garantido, na prática, pela **ausência** das props `onAddProducts`/`onRowClick` (nunca passadas por esta tela) — não por um bloqueio explícito de role dentro de `InventoryView`. O botão "Adicionar Produtos" já é condicionado a `isAdmin && onAddProducts`, então mesmo que um consultor nunca satisfaça `isAdmin`, a ausência do callback é uma segunda camada da mesma proteção. | Confirmado por leitura de `InventoryView.tsx` (linhas 313 e 489) comparada às props passadas por `ConsultantInventoryPage`. |
| RN-06 | **[CORRIGIDO em v1.2 — achado `UC-48-RN-06`; `BUGFIX-consultor-allowlist-subcolecoes.md`, PR #389, commits `76f5af9` + `37da93f`]** **Isolamento entre tenants:** o consultor só lê dados de clínicas presentes em `authorized_tenants` (`consultantHasAccess(tenantId)`, `firestore.rules` l. 32-36; somente leitura), mesmo manipulando a URL diretamente — a regra do backend bloqueia, não apenas o redirecionamento client-side do fluxo 7c. **Isolamento por subcoleção (allowlist):** no bloco genérico `match /tenants/{tenantId}/{collectionId}/{document=**}` (l. 116-129), a linha do consultor é `allow read: if consultantHasAccess(tenantId) && consultantReadableSubcollection(collectionId);` (l. 128), e `consultantReadableSubcollection` (l. 43-45) aceita exatamente `inventory`, `stock_limits` e `solicitacoes`. Pelo bloco genérico o consultor lê **só** essas três (`inventory`/`stock_limits` para as telas deste UC; `solicitacoes` para as projeções do UC-52); qualquer outra subcoleção do tenant (ex.: `inventory_activity`, `notifications`, `settings`, `nf_imports`) e qualquer subcoleção criada no futuro ficam negadas ao consultor por construção. Fora da allowlist, com regra própria: `protocolos` — o consultor lê só com o opt-in financeiro ativo para ele (`consultantHasFinancialOptIn`, l. 58-63; bloco `protocolos/{protocoloId}`, l. 159-162 — RN-08, UC-58); `financeiro` — só com o compartilhamento amarrado ao `consultant_id` do token (bloco `financeiro/{docId}`, l. 206-214 — RN-07); `precificacao_procedimentos` — nunca lida pelo consultor (bloco l. 222-229). **Limite que permanece:** a allowlist restringe **subcoleções**, não **marcas**. Dentro de `inventory` (e de `solicitacoes`), o filtro "só Rennova" (RN-04) continua existindo apenas na UI — um consultor que leia o Firestore diretamente vê o inventário inteiro da clínica vinculada (todas as marcas, com valor de compra). Decisão de produto `UC-48-RN-06-Decisão` em aberto (Seção 14, item 5). **Histórico:** até v1.1 esta RN afirmava que o isolamento "de marca" era reforçado pela regra genérica (`firestore.rules` linha 60-61 à época); a v1.1 registrou a ressalva de que a linha do consultor era uma blocklist (excluía só `nf_imports`, `financeiro` e `precificacao_procedimentos`), corrigida pela allowlist acima. | Confirmado por leitura de `firestore.rules` nesta revisão (helper `consultantReadableSubcollection` l. 43-45, linha do consultor l. 128, blocos dedicados `protocolos` l. 159-162, `financeiro` l. 206-214, `precificacao_procedimentos` l. 222-229) e por `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-consultor-allowlist-subcolecoes.md` (v1.2, Concluído em 14/10/2026 — mergeado em `gscandelari_setup` pelo PR #389; cobertura em `tests/rules/firestore-tenant-subcollections.test.ts`, `get` e `list`; validação manual em `dev-gscandelari.web.app`). Filtro de marca fora do escopo do fix (Seção 4.5 da spec; RN-04 da spec). |
| RN-07 | **[Novo em v1.1 — UC-58]** O botão "Ver Precificação" só aparece quando a leitura de `tenants/{tenantId}/financeiro/custo_hora` pelo consultor é permitida e o documento existe — o que, pelas rules, exige `compartilhar_com_consultor == true` **e** `compartilhado_com_consultant_id == consultant_id` do token **e** o tenant em `authorized_tenants`. O compartilhamento é amarrado ao consultor que o recebeu: após troca/transferência de consultor, o novo consultor não herda o acesso até o Clinic Admin compartilhar de novo. | Decisões D5 da spec `FEAT-precificacao-hora-clinica.md` (UC-58 RN-15). Confirmado por leitura de `[tenantId]/page.tsx` (`pricingShared`) e do bloco `financeiro/{docId}` de `firestore.rules`. |
| RN-08 | **[Novo em v1.1 — UC-58; atualizado em v1.2]** Na tela de precificação, o consultor lê `protocolos`; a regra dedicada dessa coleção exige o mesmo opt-in financeiro (`allow read: if consultantHasAccess(tenantId) && consultantHasFinancialOptIn(tenantId)`, `firestore.rules` l. 161). **As-is v1.2:** `protocolos` está fora da allowlist do bloco genérico (RN-06), então essa é a **única** via de leitura do consultor — sem opt-in ativo para o próprio `consultant_id`, a leitura é negada. (Até v1.1, com a linha genérica em blocklist, a leitura também era concedida sem opt-in pelo bloco genérico.) O consultor nunca lê os snapshots de precificação de procedimentos (`precificacao_procedimentos`), mesmo com opt-in. | Decisão D6 da spec `FEAT-precificacao-hora-clinica.md`; D1 = (B) de `BUGFIX-consultor-allowlist-subcolecoes.md` (Seção 4.4.1). Verificado em `firestore.rules` nesta revisão (l. 58-63 e 159-162). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[PARCIALMENTE CORRIGIDO em v1.3 — UX-050/UX-051, PRs #421/#422]** Até v1.2: falhas de carregamento em qualquer uma das três telas eram inteiramente silenciosas (fluxos 8a/8b), mesmo padrão já observado em outras telas do sistema (ex.: UC-46). **As-is v1.3:** a lista `/consultant/clinics` (fluxo 8a) e o Dashboard do consultor (fluxo 8d) exibem a falha de carregamento como estado de erro distinto do vazio, por bloco, com "Tentar novamente" e "Indisponível" nos contadores derivados (padrão do `_PADRAO-UX.md` §2: `useAsyncState` + `resolveLoadView` + `LoadErrorAlert`/`UnavailableValue` + `readApiData`/`describeLoadError`). **Continua silencioso:** o detalhe da clínica `/consultant/clinics/{tenantId}` (fluxo 8b; **UX-052** `Aberto`) e a sondagem de `financeiro/custo_hora` (Seção 14, item 6). | Usabilidade |
| RNF-02 | A busca na lista de clínicas (`/consultant/clinics`) é local (sobre os dados já carregados), não uma nova consulta — rápida, mas limitada às clínicas já vinculadas (não busca novas clínicas; para isso, `/consultant/clinics/search`, UC-24). | Desempenho |
| RNF-03 | **[Atualizado em v1.2]** Isolamento multi-tenant garantido tanto no client (redirecionamento do fluxo 7c) quanto nas rules (`consultantHasAccess`, RN-06). Isolamento por subcoleção garantido nas rules pela allowlist `consultantReadableSubcollection` (`inventory`, `stock_limits`, `solicitacoes` — `firestore.rules` l. 43-45 e l. 128): qualquer outra subcoleção, atual ou futura, é negada ao consultor por construção; `protocolos` só com opt-in financeiro (RN-08, UC-58); `financeiro` e `precificacao_procedimentos` com regras próprias (RN-07/RN-08). A restrição **de marca** (RN-04) continua garantida **somente na UI** — não é reforçada pelas rules (decisão `UC-48-RN-06-Decisão` em aberto, Seção 14). | Multi-tenant / Segurança |

---

## 11. Frequência de Uso
Provavelmente alta — é o fluxo central de navegação do Portal do Consultor no dia a dia (acompanhar estoque das clínicas vinculadas).

---

## 12. Casos de Uso Relacionados
- **UC-24 (Vincular-se Automaticamente a Clínica sem Consultor)** e **UC-25/26/27 (Transferência)** — fonte das clínicas que aparecem na lista consultada aqui.
- **UC-13/UC-14 (Inventário — Clinic)** — mesmo componente `InventoryView`, aqui usado em modo `readOnly`/`onlyBrand="Rennova"`, sem nenhuma das ações de escrita documentadas naqueles UCs.
- **UC-15 (Configurar Limite de Estoque Baixo por Produto)** e **UC-43 (Configurar Preferências de Notificação)** — ambos completamente desconectados do cálculo de "Estoque Baixo" usado neste UC (RN-03), que usa seu próprio limiar fixo (10).
- **UC-49 (Visualizar Perfil Próprio do Consultor)** — outra tela somente-leitura do mesmo portal, mas sobre os dados do próprio consultor, não das clínicas.
- **UC-52 (Consultar Projeção de Reposição de Estoque)** — botão "Ver Projeções" na mesma tela de detalhe.
- **UC-58 (Precificar Protocolos pela Hora Clínica)** — **[Novo em v1.1]** `<<extend>>` deste UC pelo botão "Ver Precificação" (Fluxo Alternativo 7d); o opt-in é concedido/revogado pelo Clinic Admin em Minha Clínica → Custos Fixos e auditado (UC-53).

---

## 13. Referências
- `src/app/(consultant)/consultant/clinics/page.tsx`
- `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx`
- `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx`
- `src/components/consultant/ClinicCard.tsx`
- `src/components/inventory/InventoryView.tsx` (props `readOnly`, `onlyBrand`, `onAddProducts`, `onRowClick`)
- `src/lib/inventoryUtils.ts` (`computeInventoryStats`, `parseInventoryDate`)
- `src/app/api/consultants/me/clinics/route.ts`
- **[v1.3]** `src/app/(consultant)/consultant/dashboard/page.tsx` (fluxo 8d: leituras de perfil e de clínicas independentes; guarda da projeção); `src/lib/loadErrors.ts` (`readApiData`, `describeLoadError`, `resolveLoadView`); `src/hooks/useAsyncState.ts` (`run`, `errorDetail`, guarda `isCurrent()`); `src/components/ui/load-error-alert.tsx` (`LoadErrorAlert`, `UnavailableValue`); spec `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-ux-erro-exibido-como-vazio.md` (v1.2, §6.3.5 e §6.3.6); PRs #421 (→ `gscandelari_setup`, `824bd21`) e #422 (→ `develop`, `8bd8c7a`), commit `53152b8`; `_PADRAO-UX.md` v1.1.1 (UX-050 e UX-051 `Corrigido`; UX-052 `Aberto`; UX-056 parcialmente corrigido)
- **[v1.3] Caderno de teste:** a falha de carregamento de `/consultant/clinics` e de `/consultant/dashboard` é coberta pelo caderno transversal `tests/e2e/_ux-erro-exibido-como-vazio.spec.ts` (cenários 6 e 11, Minhas Clínicas; 9, 10 e 12, Dashboard do consultor). O caderno completo deste UC continua pendente (retroativo, regra 8 do `CLAUDE.md`).
- `firestore.rules` (**[v1.2]** l. 32-36 — `consultantHasAccess`; l. 43-45 — `consultantReadableSubcollection` (allowlist); l. 58-63 — `consultantHasFinancialOptIn`; l. 116-129 — bloco genérico de subcoleção do tenant, linha do consultor l. 128; l. 159-162 — `protocolos`; l. 206-214 — `financeiro`; l. 222-229 — `precificacao_procedimentos`). Até v1.1 este item citava "linha 60-61", numeração anterior ao fix.
- Commit da correção: `70a38d7` (`fix: quatro itens de media severidade (UC-39, UC-45, UC-47, UC-48)`) — corrige o texto do card "Estoque Baixo" de "5" para "10 unidades ou menos" (RN-02)
- **[v1.1]** `src/app/(consultant)/consultant/clinics/[tenantId]/pricing/page.tsx`; `src/lib/services/custoHoraService.ts` (`getCustoHoraConfig`, `listInventoryForCosting`); `src/components/pricing/CustoHoraResumo.tsx`, `ProtocoloPrecificacao.tsx` (modo `consultor`); `firestore.rules` (`isRestrictedTenantCollection`, `consultantHasFinancialOptIn`, blocos `financeiro/{docId}` e `protocolos/{protocoloId}`); spec `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-precificacao-hora-clinica.md` (v1.7), PR #382; `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` (caminho à época da v1.1)
- **[v1.2]** `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-consultor-allowlist-subcolecoes.md` (v1.2, Concluído em 14/10/2026); PR #389 (`bugfix/consultant-subcollection-allowlist` → `gscandelari_setup`), commits `76f5af9` (`fix(firebase): restrict consultant reads to subcollection allowlist`) e `37da93f` (`test(firebase): cover consultant subcollection allowlist in rules suite`); `tests/rules/firestore-tenant-subcollections.test.ts`

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. **[RESOLVIDO — commit `70a38d7`]** RN-02 — o texto foi corrigido para "10 unidades ou menos", batendo com o limiar real (`<= 10`) já usado por `computeInventoryStats`.
2. **[Observação]** RN-01 — a chamada `fetch` sem uso a `/api/tenants/{id}/consultant` parece código morto. Remover?
3. **[Observação]** RN-03 — existência de um terceiro limiar de "estoque baixo" (fixo, 10), independente de UC-15/UC-43. Vale unificar os três mecanismos, ou são propositalmente independentes (um é "estoque baixo por produto" da clínica, outro é "alerta configurável do tenant", e este é "resumo rápido para o consultor")?
4. **[PARCIALMENTE RESOLVIDO em v1.3 — UX-050/UX-051 corrigidos, PRs #421/#422]** RNF-01: o tratamento de erro visível, com "Tentar novamente", foi conectado em `/consultant/clinics` (fluxo 8a) e no Dashboard do consultor (fluxo 8d). **Continua aberto** para o detalhe da clínica (`/consultant/clinics/{tenantId}`, fluxo 8b; UX-052). O inventário somente-leitura (`/consultant/clinics/{tenantId}/inventory`) não foi reavaliado nesta revisão.
5. **[PARCIALMENTE RESOLVIDO em v1.2 — `UC-48-RN-06` corrigido pelo PR #389; `UC-48-RN-06-Decisão` continua ABERTA]** A troca da blocklist pela allowlist de subcoleções (`consultantReadableSubcollection`: `inventory`, `stock_limits`, `solicitacoes`) foi implementada (RN-06/RNF-03), e com ela a exigência de opt-in para o consultor ler `protocolos` (RN-08) passou a valer de fato. **Continua pendente a decisão de produto `UC-48-RN-06-Decisão`** (Seção 4.1 do `_MAPA-DE-BUGS-E-MELHORIAS.md`): o filtro por marca **dentro** de `inventory` existe só na UI — o consultor ainda pode ler, pelo Firestore, o inventário inteiro da clínica (todas as marcas, com valor de compra). Opções registradas no mapa: (a) aceitar o filtro de marca só na UI como decisão consciente documentada; (b) servir o inventário ao consultor via API server-side (Admin SDK) já filtrada por marca, retirando a leitura direta de `inventory` pelas rules. Não decidido por este documento. Ponto de atenção registrado na spec do fix (Seção 4.5): as projeções (UC-52) e o card do Dashboard do consultor também não filtram por marca.
6. **[Observação, v1.1]** Se a leitura de `financeiro/custo_hora` falhar por erro de rede (não por permissão), o botão "Ver Precificação" simplesmente não aparece, sem aviso — mesmo padrão silencioso de RNF-01.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `ConsultantClinicsPage`, `ClinicDetailPage`, `ConsultantInventoryPage`, `InventoryView.tsx` (props de somente-leitura), `computeInventoryStats` (`inventoryUtils.ts`) e `firestore.rules` (`consultantHasAccess`). Identificado bug confirmado de divergência entre texto e lógica no card "Estoque Baixo" (RN-02: texto diz "5", código usa 10), uma chamada de API sem uso do resultado (RN-01), e a existência de um terceiro mecanismo de limiar de estoque baixo, totalmente independente de UC-15/UC-43 (RN-03). |
| 1.0.1 | 03/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-48-RN-02), commit `70a38d7`: texto do card "Estoque Baixo" em `ClinicDetailPage` corrigido de "5 unidades ou menos" para "10 unidades ou menos", batendo com o threshold real usado por `computeInventoryStats` (`<= 10`). Atualizados Fluxo Principal (passo 6), RN-02 (marcada `[CORRIGIDO]`), Referências (Seção 13) e item 1 da Seção 14 (marcado `[RESOLVIDO]`). |
| 1.1 | 10/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Feature "Precificação pela Hora Clínica" (spec `FEAT-precificacao-hora-clinica.md` v1.7, PR #382) — as-is.** Detalhe da clínica passou a sondar `financeiro/custo_hora` e a exibir o botão "Ver Precificação" só com o opt-in do Clinic Admin para este consultor; nova tela somente leitura `/consultant/clinics/{tenantId}/pricing`. Novas RN-07 (condição do botão, opt-in amarrado ao `consultant_id`) e RN-08 (leitura de `protocolos` com opt-in, as-is dependente do bugfix da allowlist; consultor nunca lê snapshots de procedimentos); novo Fluxo Alternativo 7d e Fluxo de Exceção 8c; 7c, resumo, diagrama (`<<extend>>` UC-58), pós-condições, gatilho, Fluxo Principal (passos 5 e 7 — inclui o botão já existente "Ver Projeções", UC-52), seções 12 e 13 atualizados. **Ressalva as-is em RN-06 e RNF-03** refletindo o achado `UC-48-RN-06` (Aberto no mapa v3.51): o isolamento de marca é só de UI; o texto original foi mantido e anotado, não removido. Seção 14: novos itens 5 e 6. |
| 1.2 | 14/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Atualização as-is: allowlist de subcoleções do consultor (`BUGFIX-consultor-allowlist-subcolecoes.md` v1.2, Concluído; PR #389, commits `76f5af9` + `37da93f`).** RN-06 e RNF-03 deixam de afirmar que o isolamento é garantido pela regra genérica e passam a descrever a allowlist `consultantReadableSubcollection` em `firestore.rules` (consultor lê pelo bloco genérico só `inventory`, `stock_limits` e `solicitacoes`; qualquer outra subcoleção, atual ou futura, negada; `protocolos` só com opt-in financeiro — UC-58; `financeiro`/`precificacao_procedimentos` com regras próprias). RN-06 marcada `[CORRIGIDO]` quanto ao isolamento por subcoleção. RN-08 atualizada (a exigência de opt-in para `protocolos` agora vale de fato). Referências de linha de `firestore.rules` atualizadas (RN-06, RN-08, RNF-03, Seção 13 — antes "linha 60-61"). Seção 13 aponta a spec em `TASK_COMPLETED`. Seção 14, item 5: parcialmente resolvido — o filtro por marca dentro do inventário continua só na UI e a decisão `UC-48-RN-06-Decisão` segue **aberta**. Fontes: leitura de `firestore.rules` na branch `docs/nfe-duplicate-check-finding` e a spec concluída. |
| 1.3 | 26/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Atualização as-is: lote "erro exibido como estado vazio" (UX-050 e UX-051 corrigidos; spec `TASK_COMPLETED/BUGFIX-ux-erro-exibido-como-vazio.md` v1.2; PRs #421 → `gscandelari_setup` e #422 → `develop`, merge `8bd8c7a`; validação manual do usuário reportada como "validado"; sinalização do `_PADRAO-UX.md` v1.1.1 §8(b)).** §4.2: a falha da lista passa a ser visível, com "Tentar novamente" (o detalhe da clínica segue silencioso). Passo 2: `refreshClaims()` só depois de leitura bem-sucedida. Fluxo 8a reescrito (erro distinto do vazio, `!ok` tratado via `readApiData`, detalhe por `describeLoadError`, "Tentar novamente"). Novo fluxo 8d (Dashboard do consultor: erro por bloco; cartão do código, cards "Clínicas Vinculadas" e "Projeção de Reposição" em "Indisponível", bloco "Minhas Clínicas"). RNF-01 marcado como **parcialmente corrigido** (fluxo 8b, detalhe da clínica, inalterado; UX-052 `Aberto`). §13: referências do código e do caderno transversal `tests/e2e/_ux-erro-exibido-como-vazio.spec.ts`. §14 item 4 respondido para as duas telas. Fonte: leitura de `consultant/clinics/page.tsx`, `consultant/dashboard/page.tsx`, `loadErrors.ts`, `useAsyncState.ts`, `load-error-alert.tsx` e do caderno no `develop` `8bd8c7a`. |
