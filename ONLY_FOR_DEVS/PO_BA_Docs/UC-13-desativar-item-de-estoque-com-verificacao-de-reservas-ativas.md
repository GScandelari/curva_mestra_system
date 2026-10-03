# UC-13: Desativar Item de Estoque com Verificação de Reservas Ativas

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário
**Versão:** 1.3

> Um Clinic Admin desativa (soft delete) um lote de produto do inventário. Se o lote não tem nenhuma reserva ativa em procedimentos agendados, a desativação é simples e imediata. Se tem, o sistema oferece "Forçar exclusão": redistribui automaticamente as reservas para outros lotes do mesmo produto (critério FEFO — validade mais próxima primeiro), removendo o produto de procedimentos sem alternativa suficiente, e cancelando automaticamente procedimentos que ficarem sem nenhum produto. A desativação do item em si nunca é bloqueada — o pior cenário é procedimentos perderem produtos ou serem cancelados. Se a verificação prévia de reservas falhar, a desativação simples fica bloqueada até a checagem ser refeita com sucesso.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    Redistribuicao([🔧 Redistribuição automática\nFEFO — sem escolha do usuário])

    subgraph Sistema["Curva Mestra"]
        UC13(("UC-13\nDesativar Item de Estoque\ncom Verificação de Reservas"))
    end

    ClinicAdmin --> UC13
    UC13 -.->|se houver reservas ativas, aciona| Redistribuicao
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** — o botão "Desativar" só é exibido quando `claims.role === "clinic_admin"` (`isAdmin`). **[CORRIGIDO — PR #344, ver RN-09]** Até o PR #344, isso era uma restrição apenas de interface: a regra do Firestore para subcoleções do tenant (`belongsToTenant(tenantId)`) permitia leitura e escrita a qualquer usuário do tenant — incluindo `clinic_user` — sem *enforcement* de role a nível de dados para `deactivateInventoryItem`/`forceDeactivateInventoryItem`. Hoje, a escrita em `tenants/{tenantId}/inventory/{itemId}` exige, também no Firestore, `belongsToTenant(tenantId) && hasRole('clinic_admin')` — a restrição deixou de ser só de UI.

### 2.2 Atores Secundários / Sistemas Externos
Nenhum ator humano — a redistribuição de reservas é inteiramente automática (algoritmo FEFO), sem intervenção de outro usuário. Indiretamente, os responsáveis pelos procedimentos agendados impactados são afetados pela ação, mas não participam dela nem são notificados (RN-08).

---

## 3. Pré-condições
- Usuário autenticado com `tenant_id` definido (role `clinic_admin` para que o botão apareça na UI — ver 2.1).
- O item de inventário (`tenants/{tenantId}/inventory/{itemId}`) existe e está `active: true` (o botão "Desativar" só aparece para itens ativos).

---

## 4. Pós-condições

### 4.1 Sucesso — sem reservas ativas
- Item marcado `active: false`, `updated_at` atualizado. Nenhum outro documento é alterado.

### 4.1b Sucesso — com reservas ativas, via "Forçar exclusão"
- Item original marcado `active: false`; sua `quantidade_reservada` é reduzida e `quantidade_disponivel` aumentada pelo total liberado (mesmo o item ficando inativo).
- Cada lote alternativo que recebeu parte da redistribuição tem `quantidade_reservada` aumentada e `quantidade_disponivel` reduzida na mesma proporção.
- Cada solicitação impactada é atualizada (`produtos_solicitados` substituído/mesclado, com avisos anexados a `observacoes`) ou cancelada (`status: "cancelada"`, com entrada em `status_history` atribuída ao sistema).
- Tudo gravado em uma única operação atômica (`writeBatch`).

### 4.2 Falha (Garantias Mínimas)
- Nenhuma alteração é feita; um erro é exibido no próprio diálogo.
- **[CORRIGIDO em v1.1, commit `91eb37e`]** Se a verificação prévia de reservas (`checkInventoryItemReservations`) falhar, nenhum botão de ação ("Confirmar desativação" ou "Forçar exclusão") é exibido — a desativação fica bloqueada até a checagem ser refeita com sucesso (RN-07).

---

## 5. Gatilho (Trigger)
Clinic Admin clica em "Desativar" na página de detalhe de um item de inventário (`/clinic/inventory/[id]`).

---

## 6. Fluxo Principal (Basic Flow)

1. Clinic Admin acessa `/clinic/inventory/[id]` e visualiza os detalhes do lote (produto, lote, quantidades, validade, valores, NF de origem).
2. Clinic Admin clica em "Desativar" (visível apenas para `clinic_admin`, com `item.active === true`).
3. Sistema abre um Dialog "Desativar produto do estoque" e chama `checkInventoryItemReservations(tenantId, itemId)`, que consulta todas as `solicitacoes` com `status: "agendada"` do tenant e filtra as que têm este `itemId` em `produtos_solicitados`, retornando descrição, data do procedimento e quantidade reservada de cada uma.
4. Enquanto carrega, exibe um spinner.
5. **Se não houver nenhum procedimento impactado** (lista vazia): sistema exibe "Este produto não possui reservas ativas. Ele será removido do estoque e não poderá ser usado em procedimentos." e mostra apenas o botão "Confirmar desativação".
6. **Se houver procedimentos impactados:** sistema exibe um Alert destrutivo ("Produto com reservas ativas — Este lote está reservado em N procedimento(s) agendado(s). Use 'Forçar exclusão' para redistribuir automaticamente para outros lotes disponíveis.") e a lista dos procedimentos afetados (data, descrição, quantidade reservada); mostra apenas o botão "Forçar exclusão" (não há opção de desativação simples quando há reservas).
7. **[Sem reservas] Clinic Admin clica em "Confirmar desativação":** sistema chama `deactivateInventoryItem(tenantId, itemId)` — um `updateDoc` simples (`active: false`, `updated_at`) — e redireciona para `/clinic/inventory`.
8. **[Com reservas] Clinic Admin clica em "Forçar exclusão":** sistema chama `forceDeactivateInventoryItem(tenantId, itemId)`, que:
   - a. Recarrega o item e todas as `solicitacoes` "agendada" que o referenciam.
   - b. Busca lotes alternativos do **mesmo** `codigo_produto`, `active: true`, com `dt_validade` no futuro, ordenados por `dt_validade` ascendente (FEFO).
   - c. Para cada solicitação impactada (na ordem em que a consulta do Firestore as retornou — não necessariamente pela data do procedimento, ver RN-04), tenta alocar a quantidade necessária a partir dos lotes alternativos, em ordem de validade, consumindo um contador de disponibilidade **compartilhado** entre todas as solicitações processadas no mesmo laço (a primeira solicitação processada tem prioridade sobre o estoque alternativo).
   - d. Classifica o resultado por solicitação: substituição total (sem aviso), substituição parcial (aviso "Produtos alterados - revisar antes de concluir"), ou remoção total do produto (aviso "{nome} (lote {X}) removido - revisar antes de concluir") quando não sobra nenhum lote alternativo com saldo.
   - e. Se, após a remoção, a solicitação ficar sem nenhum produto, ela é cancelada automaticamente (`status: "cancelada"`, nova entrada em `status_history` com `changed_by: "system"`/`"Sistema"` e observação "Cancelado automaticamente: todos os produtos foram removidos do estoque"), em vez de apenas ficar com a lista de produtos vazia.
   - f. Grava tudo — desativação do item original, ajustes de quantidade nos lotes alternativos, e atualização/cancelamento das solicitações — em um único `writeBatch` atômico.
   - g. Retorna `{ procedimentosAlterados, procedimentosCancelados }`.
9. Sistema redireciona para `/clinic/inventory`.
10. Caso de uso é concluído com sucesso — o item está sempre desativado ao final (ressalvado o bloqueio descrito no Fluxo de Exceção 8a, RN-07); procedimentos impactados podem ter sido silenciosamente ajustados ou cancelados (RN-08).

---

## 7. Fluxos Alternativos

### 7a. Clinic Admin cancela o diálogo (a partir de qualquer momento antes de confirmar)
1. Clinic Admin clica em "Cancelar".
2. Diálogo fecha; nenhuma alteração é feita; item permanece ativo.

---

## 8. Fluxos de Exceção

### 8a. [CORRIGIDO em v1.1, commit `91eb37e`] Erro ao verificar reservas (a partir do passo 3)
1. `checkInventoryItemReservations` lança exceção.
2. Sistema seta um novo estado `checkError` com a mensagem "Não foi possível verificar reservas ativas. Tente novamente." e mantém `impactedProcedimentos` em `null` — **não** trata mais como "sem reservas" (comportamento anterior à correção, ver seção 14).
3. Sistema exibe um Alert destrutivo ("Não foi possível verificar reservas") com a mensagem de erro e um aviso de que a desativação fica bloqueada para não arriscar remover um lote com reservas ativas não confirmadas.
4. Como os botões "Confirmar desativação" e "Forçar exclusão" só são renderizados quando `impactedProcedimentos !== null`, nenhum dos dois aparece — a desativação fica integralmente bloqueada.
5. Sistema exibe um botão "Tentar novamente", que rechama `handleOpenDeactivate` (repete o passo 3 do Fluxo Principal). Ver RN-07.

### 8b. Erro ao desativar (sem reservas) (a partir do passo 7)
1. `deactivateInventoryItem` lança exceção.
2. Sistema exibe "Erro ao desativar produto. Tente novamente." no próprio diálogo; item permanece ativo.

### 8c. Erro ao forçar exclusão (a partir do passo 8)
1. `forceDeactivateInventoryItem` lança exceção em qualquer ponto antes do commit do batch (o batch é atômico — se falhar, nada é gravado).
2. Sistema exibe "Erro ao processar desativação. Tente novamente." no próprio diálogo; item permanece ativo, nenhuma solicitação é alterada.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A redistribuição de reservas ("Forçar exclusão") é **inteiramente automática** — o sistema escolhe os lotes alternativos por FEFO (lotes ativos do mesmo código de produto, não vencidos, ordenados por data de validade crescente); o usuário **não** escolhe manualmente para qual lote a reserva vai. | Confirmado por leitura direta de `forceDeactivateInventoryItem` (query com `orderBy('dt_validade', 'asc')` e comentário explícito "FEFO" no código). |
| RN-02 | Somente solicitações com `status: "agendada"` são consideradas "reservas ativas" — tanto para a checagem prévia (`checkInventoryItemReservations`) quanto para a redistribuição em si. | Confirmado — a reserva de estoque (`quantidade_reservada`) é feita no momento da criação da solicitação, que já nasce com `status: "agendada"` (comentário no código de criação: "Toda solicitação inicia como 'agendada' → RESERVAR estoque"). |
| RN-03 | Um procedimento agendado pode ter, para o item desativado, um de três desfechos automáticos: substituição total (sem aviso visível na tela de desativação), substituição parcial (aviso anexado às observações), ou remoção total do produto daquele procedimento (aviso anexado); se a remoção zerar a lista de produtos da solicitação, ela é **cancelada automaticamente**. | Confirmado por leitura completa de `forceDeactivateInventoryItem` — três ramos de `warnings` + lógica de cancelamento explícita (`cancel = newProdutos.length === 0`). |
| RN-04 | **[Observação relevante]** A ordem de alocação entre múltiplas solicitações impactadas segue a ordem em que a consulta do Firestore as retorna — não há ordenação explícita por `dt_procedimento`. Se o estoque alternativo for insuficiente para cobrir todas as solicitações impactadas, não há garantia de que o procedimento mais próximo (ou mais antigo) tenha prioridade sobre um procedimento mais distante no tempo. | Confirmado por leitura do código — a query de `solicitacoes` não usa `orderBy`; a ordem de processamento no laço é a ordem de retorno do snapshot. Ver seção 14. |
| RN-05 | A desativação do item em si **nunca é bloqueada** pela lógica de redistribuição, mesmo quando não há nenhum lote alternativo disponível para nenhuma das solicitações impactadas — o item é sempre marcado `active: false` no mesmo batch; o pior cenário possível dentro de `forceDeactivateInventoryItem` é todas as solicitações impactadas perderem o produto (ou serem canceladas), não a impossibilidade de desativar. (Distinto de RN-07: a partir da v1.1, uma falha na *checagem prévia* de reservas passou a bloquear a desativação simples, como proteção contra fail-open — não uma limitação da lógica de redistribuição em si.) | Confirmado — `batch.update(itemRef, {active: false, ...})` é incondicional dentro de `forceDeactivateInventoryItem`, não depende do resultado da alocação. Responde diretamente à pergunta sobre "desativação impossível" dentro do fluxo de redistribuição: **não existe esse caso**. |
| RN-06 | Mesmo lotes de outras marcas ou produtos com código diferente nunca são considerados como alternativa — a busca por lotes alternativos é estritamente por `codigo_produto` igual ao do item desativado. | Confirmado pela query `where('codigo_produto', '==', codigoProduto)`. |
| RN-07 | **[CORRIGIDO em v1.1, commit `91eb37e`]** Se `checkInventoryItemReservations` falhar (exceção de rede/Firestore), a interface **até a v1.0** tratava isso como "nenhuma reserva encontrada" (`setImpactedProcedimentos([])`), oferecendo ao usuário o botão de desativação simples mesmo que o item pudesse ter reservas ativas não verificadas — um fail-open perigoso. A correção introduziu um novo estado `checkError`: no `catch` de `handleOpenDeactivate`, em vez de assumir "sem reservas", o sistema agora seta `checkError` com uma mensagem explicativa e mantém `impactedProcedimentos` em `null`. Como os botões "Confirmar desativação" e "Forçar exclusão" só renderizam quando `impactedProcedimentos !== null`, ambos ficam ocultos automaticamente — a desativação é bloqueada (fail-closed) até a checagem ser refeita com sucesso via um novo botão "Tentar novamente" (que rechama `handleOpenDeactivate`). | Corrigido conforme diff de `src/app/(clinic)/clinic/inventory/[id]/page.tsx` no commit `91eb37e` — novo estado `checkError`, remoção do `setImpactedProcedimentos([])` no `catch`, e renderização condicional dos botões de ação preservada (`impactedProcedimentos !== null`). |
| RN-08 | Nenhuma notificação é enviada a quem criou ou é responsável pelo procedimento impactado (alterado ou cancelado automaticamente) — a única forma de descobrir a alteração é abrir a solicitação depois e ler o campo `observacoes` (para alterações) ou notar que o `status` virou `"cancelada"` (para cancelamentos). | Confirmado pela ausência de qualquer chamada a serviço de notificação/e-mail dentro de `forceDeactivateInventoryItem`. |
| RN-09 | **[CORRIGIDO — PR #344, commits `f3ce046` (restrição inicial) + `94cbe2e` (correção de regressão em `list`/query), branch `bugfix/firestore-rules-tenant-role-enforcement`, mergeado em `gscandelari_setup`, deploy confirmado em `curva-mestra-dev`]** Até esta correção, a restrição "apenas `clinic_admin` pode desativar" era aplicada somente na interface (`isAdmin && ...`): a regra genérica `match /tenants/{tenantId}/{document=**} { allow read, write: if belongsToTenant(tenantId); }` concedia leitura e escrita irrestritas a **qualquer** usuário do tenant para **qualquer** subcoleção do sistema (incluindo `inventory`), e a semântica **OR** do Firestore entre blocos `match` que casam o mesmo caminho tornava qualquer regra dedicada adicional (só para `inventory`) inefetiva isoladamente — exigindo alterar a própria regra genérica para corrigir de verdade. **Corrigido**: a regra genérica passou a usar `match /tenants/{tenantId}/{collectionId}/{document=**}` (wildcard de um segmento, não mais recursivo) e deixou de conceder `write` — a leitura ampla permanece (exceto `nf_imports`), mas toda escrita sensível passou a depender de um bloco dedicado por subcoleção. Para `inventory`, o novo bloco `match /tenants/{tenantId}/inventory/{itemId} { allow write: if belongsToTenant(tenantId) && hasRole('clinic_admin'); }` agora é o único caminho de escrita — um `clinic_user` deixa de conseguir desativar um item chamando o Firestore diretamente, mesmo contornando a UI. **Nota técnica**: a primeira tentativa de correção (commit `f3ce046`) excluía `nf_imports` da leitura genérica usando `document[0] != 'nf_imports'` sobre o wildcard recursivo `{document=**}` — isso funciona para `get`, mas quebra **todo** `list`/query em qualquer subcoleção do tenant, pois o wildcard recursivo não é vinculável em operações de lista quando usado para indexação condicional (confirmado contra o Firebase Emulator, derrubou UC-05/UC-51/UC-52/UC-53 em CI). Corrigido no mesmo PR (commit `94cbe2e`) trocando para `{collectionId}` — um wildcard de um segmento, vinculável tanto em `get` quanto em `list`. Mesma correção aplicada em conjunto com UC-15/RN-07, UC-20/RN-07, UC-42/RN-01, UC-43/RN-07 e UC-44/RN-02 (todas as subcoleções sensíveis do tenant ganharam blocos de escrita dedicados no mesmo PR). | Confirmado por leitura de `firestore.rules` pós-deploy (bloco genérico de subcoleção, linha ~87, sem `write`; bloco dedicado de `inventory`, linha ~110, exigindo `hasRole('clinic_admin')` para `write`) e pelos comentários do próprio arquivo documentando a história da correção em duas etapas. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | A redistribuição (passo 8) é executada em um único `writeBatch` do Firestore — atomicidade garantida entre a desativação do item, os ajustes nos lotes alternativos e as atualizações/cancelamentos das solicitações. | Confiabilidade |
| RNF-02 | O cálculo de "lotes alternativos" e a alocação entre múltiplas solicitações são recalculados do zero a cada chamada de `forceDeactivateInventoryItem` — não há *lock*/transação otimista contra chamadas concorrentes (ex.: dois admins desativando lotes diferentes do mesmo produto ao mesmo tempo poderiam, em teoria, gerar leituras desatualizadas de `quantidade_disponivel` entre a leitura e o commit do batch). | Confiabilidade |
| RNF-03 | O diálogo de desativação é sempre montado com uma nova checagem de reservas (sem cache) toda vez que é aberto — inclusive ao clicar em "Tentar novamente" após uma falha de checagem (RN-07). | Confiabilidade |

---

## 11. Frequência de Uso
Ocasional — ocorre quando um lote precisa ser removido do estoque (ex.: erro de cadastro, produto danificado, correção manual), não é uma operação de rotina.

---

## 12. Casos de Uso Relacionados
- Um eventual **"Agendar Procedimento com Reserva de Estoque"** (UC ainda não mapeado, `solicitacaoService.ts`) é pré-condição indireta — é o que cria as reservas que este UC pode ter que redistribuir ou cancelar.
- **UC-10/UC-11 (Importar/Inserir Nota Fiscal)** são os UCs que criam os itens de inventário que, eventualmente, podem vir a ser desativados aqui.
- **UC-15 (Configurar Limite de Estoque Baixo por Produto)** — RN-07 daquele UC documenta o mesmo achado de arquitetura de segurança registrado aqui em RN-09, agora corrigido em conjunto (PR #344).

---

## 13. Referências
- `src/app/(clinic)/clinic/inventory/[id]/page.tsx` (linhas alteradas pelo commit `91eb37e` — estado `checkError`, `handleOpenDeactivate`, RN-07)
- `src/lib/services/inventoryService.ts` (`deactivateInventoryItem`, `checkInventoryItemReservations`, `forceDeactivateInventoryItem`)
- `src/lib/services/solicitacaoService.ts` (criação de solicitação e reserva inicial — contexto de RN-02)
- `firestore.rules` (regra genérica de subcoleção do tenant agora `tenants/{tenantId}/{collectionId}/{document=**}`, sem `write`; bloco dedicado `tenants/{tenantId}/inventory/{itemId}` exigindo `hasRole('clinic_admin')` para `write` — RN-09, corrigido no PR #344, commits `f3ce046`/`94cbe2e`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[Observação relevante, não confirmada como bug intencional]** RN-04 — a ordem de alocação entre solicitações concorrentes não é por data do procedimento; pode não ser a priorização mais justa/esperada pelo negócio.
2. **[RESOLVIDO em v1.1 — commit `91eb37e`]** RN-07 — implementado: falha ao verificar reservas ativas agora bloqueia a desativação (fail-closed), em vez de assumir "sem reservas" (fail-open). A interface exibe um alerta de erro e um botão "Tentar novamente".
3. **[Observação]** RN-08 — nenhuma notificação para os responsáveis pelos procedimentos alterados/cancelados automaticamente.
4. **[RESOLVIDO em v1.3 — PR #344, commits `f3ce046`/`94cbe2e`]** RN-09 — a restrição de role para desativar um item de inventário, antes só de interface, agora também é reforçada no Firestore: a regra genérica de subcoleção do tenant deixou de conceder `write`, e um bloco dedicado para `inventory` exige `hasRole('clinic_admin')`. Mesma correção aplicada em conjunto a UC-15/RN-07, UC-20/RN-07, UC-42/RN-01, UC-43/RN-07 e UC-44/RN-02.
5. **[Nota de rastreabilidade]** "Agendar Procedimento com Reserva de Estoque" ainda não foi mapeado como UC formal.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero e confirmada por leitura completa de `inventory/[id]/page.tsx`, das três funções relevantes em `inventoryService.ts`, do trecho de criação de solicitação em `solicitacaoService.ts` (RN-02), e da regra genérica de `tenants/{tenantId}/{document=**}` em `firestore.rules` (RN-09). Respondidas as três perguntas específicas do levantamento: a redistribuição é automática por FEFO, sem escolha do usuário (RN-01); os procedimentos impactados podem ser substituídos total/parcialmente, ter o produto removido, ou ser cancelados automaticamente se ficarem sem nenhum produto (RN-03); e a desativação do item nunca é impossível — o pior cenário é a perda/cancelamento de procedimentos, não o bloqueio da desativação (RN-05). |
| 1.1 | 19/07/2026 | Guilherme Scandelari | Correção de severidade Alta (commit `91eb37e`): o fail-open na verificação prévia de reservas (RN-07) foi corrigido — falha em `checkInventoryItemReservations` agora bloqueia a desativação (novo estado `checkError`, `impactedProcedimentos` permanece `null`, ambos os botões de ação ficam ocultos) em vez de tratar como "sem reservas". Adicionado Fluxo de Exceção 8a detalhado, novo botão "Tentar novamente" na UI, e RN-05 esclarecida para distinguir a garantia de não-bloqueio da lógica de redistribuição (inalterada) do novo bloqueio da checagem prévia (RN-07). RN-07 marcada como `[CORRIGIDO]`. |
| 1.2 | 25/07/2026 | Guilherme Scandelari | **Achado técnico ampliado, não corrigido (investigação do commit `216b3a0`)**: RN-09 (e o item 4 da seção 14) foram reescritos para refletir uma descoberta mais séria do que a originalmente catalogada — a regra genérica de subcoleção do tenant em `firestore.rules` já concede escrita irrestrita a qualquer usuário do tenant para TODAS as subcoleções (não só `inventory`), e a semântica OR do Firestore entre blocos `match` torna qualquer regra dedicada adicional (só para `inventory`) inefetiva sem alterar a própria regra genérica. O usuário decidiu não corrigir agora; fica registrado como achado de arquitetura de segurança para decisão dedicada futura, em conjunto com o mesmo achado documentado em UC-15/RN-07. Nenhum código foi alterado por esta atualização de documentação. Seção 12 e 13 também atualizadas com a referência cruzada a UC-15. |
| 1.3 | 02/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Correção de segurança real implementada e mergeada (PR #344, branch `bugfix/firestore-rules-tenant-role-enforcement`, commits `f3ce046` + `94cbe2e`, deploy confirmado em `curva-mestra-dev`)**: RN-09 passou de "achado não corrigido" para **[CORRIGIDO]** — a regra genérica de subcoleção do tenant deixou de conceder `write` e mudou de `match /tenants/{tenantId}/{document=**}` para `match /tenants/{tenantId}/{collectionId}/{document=**}` (correção de uma regressão em `list`/query encontrada em CI, documentada como nota técnica dentro da própria RN-09); um novo bloco dedicado `match /tenants/{tenantId}/inventory/{itemId}` agora exige `hasRole('clinic_admin')` para `write`. Seção 2.1, RN-09 (seção 9), item 4 da seção 14, e seções 12/13 atualizadas de acordo. Mesma correção aplicada em conjunto a UC-15/RN-07, UC-20/RN-07, UC-42/RN-01, UC-43/RN-07 e UC-44/RN-02. |
