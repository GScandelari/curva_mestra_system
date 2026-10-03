# UC-15: Configurar Limite de Estoque Baixo por Produto

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário
**Versão:** 1.3

> Um Clinic Admin define, produto a produto (por código, agregando todos os lotes), a partir de qual quantidade total disponível o produto passa a ser considerado "Estoque Baixo". O limite fica salvo por tenant + código de produto. Ele é consumido em dois lugares com lógicas ligeiramente diferentes: o badge de status na UI (fallback simples: limite `?? 10`) e o gatilho de notificação automática de estoque baixo (fallback em 3 níveis: limite do produto → limite global do tenant → 10) — este último roda tanto quando um Clinic Admin aciona manualmente a verificação de alertas (UC-42) quanto, desde o commit `0b647d8` (RN-05, **[RESOLVIDO]**), automaticamente todo dia às 06:00 (horário de Brasília) via a Scheduled Function `checkAlertsScheduled`. Desde o commit `216b3a0`, o gatilho de notificação (`checkLowStock`) não soma mais quantidade residual de lotes já desativados (RN-08, corrigida).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    AlertsCheck([🔧 "Executar Verificações"\nmanual, aba Alertas — UC-42])
    Cron(["⏰ Scheduled Function\ncheckAlertsScheduled\n(diária, 06:00 America/Sao_Paulo)"])
    Notification([🔧 Notificação de\nestoque baixo])

    subgraph Sistema["Curva Mestra"]
        UC15(("UC-15\nConfigurar Limite de\nEstoque Baixo por Produto"))
    end

    ClinicAdmin --> UC15
    UC15 -.->|limite salvo é lido por| AlertsCheck
    Cron -.->|dispara checkLowStock\nautomaticamente, RN-05| AlertsCheck
    AlertsCheck -.->|se abaixo do limite (só lotes ativos, desde 216b3a0) e alertas habilitados| Notification
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** — a aba "Limite de Estoque" só é renderizada para `claims.role === "clinic_admin"` na página pai (`clinic/my-clinic/page.tsx`, `{isAdmin && (...)}`). **Diferente de UC-11/UC-14, aqui a UI oculta corretamente a aba para `clinic_user`.** **[CORRIGIDO — PR #344, ver RN-07]** Até o PR #344, a regra do Firestore para `stock_limits` não era uma regra dedicada — caía na regra genérica de `tenants/{tenantId}/{document=**}`, que permitia leitura e escrita a qualquer usuário do tenant (`belongsToTenant`), não apenas `clinic_admin`. Hoje, a escrita em `tenants/{tenantId}/stock_limits/{limitId}` exige, também no Firestore, `belongsToTenant(tenantId) && hasRole('clinic_admin')`.

### 2.2 Atores Secundários / Sistemas Externos
Nenhum ator humano direto; indiretamente, o mecanismo de verificação de alertas (aba "Alertas", `checkLowStock`) é quem consome o limite configurado aqui — seja acionado manualmente (UC-42) ou, desde a RN-05 (**[RESOLVIDO]**), automaticamente pela Scheduled Function `checkAlertsScheduled`.

---

## 3. Pré-condições
- Usuário autenticado com role `clinic_admin` e `tenant_id` definido.
- Existe pelo menos um item de inventário ativo no tenant (senão a aba mostra "Nenhum produto em estoque").

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Um documento é criado/atualizado (`setDoc` com `merge: true`) em `tenants/{tenantId}/stock_limits/{codigo_produto}`, com o campo `limite_estoque_baixo`.
- Isso **não** dispara nenhum recálculo, notificação ou alerta imediato — o valor só é lido na próxima vez que a exibição do status "Estoque Baixo" for renderizada, que a verificação de alertas (aba "Alertas") for executada manualmente, ou que a execução automática diária (RN-05) rodar.

### 4.2 Falha (Garantias Mínimas)
- Nenhuma alteração é feita; a UI simplesmente não sai do modo de edição (não há tratamento de erro explícito nesta função — ver RN-06/seção 14).

---

## 5. Gatilho (Trigger)
Clinic Admin acessa "Minha Clínica" → aba "Limite de Estoque" e clica no ícone de lápis na linha de um produto.

---

## 6. Fluxo Principal (Basic Flow)

1. Clinic Admin acessa `/clinic/my-clinic` e seleciona a aba "Limite de Estoque" (visível apenas para `clinic_admin`).
2. Sistema carrega, em paralelo: todos os itens de inventário ativos do tenant (agrupados por código de produto, somando a quantidade disponível de todos os lotes) e o mapa de limites já configurados (`tenants/{tenantId}/stock_limits`).
3. Sistema exibe uma tabela com uma linha por produto (código, nome, quantidade total em estoque, limite atual — ou 10 se nenhum limite foi configurado ainda para aquele código).
4. Clinic Admin clica no ícone de lápis na linha de um produto.
5. Sistema entra em modo de edição naquela linha, pré-preenchendo o campo com o limite atual (ou 10, se não configurado).
6. Clinic Admin digita um novo valor (inteiro, ≥ 0) e confirma (clicando no ícone de check, ou pressionando Enter).
7. Sistema valida no frontend que o valor é um número inteiro válido e não negativo (`parseInt` + `isNaN` + `< 0`); se inválido, a função retorna silenciosamente sem salvar nem avisar o usuário (RN-06/seção 14).
8. Sistema chama `updateStockLimit(tenantId, codigo, valor)`, que grava (`setDoc` com `merge: true`) em `tenants/{tenantId}/stock_limits/{codigo_produto}`: `{ limite_estoque_baixo: valor }`.
9. Sistema atualiza o estado local (mapa de limites) e sai do modo de edição para aquela linha — sem recarregar a lista inteira do Firestore.
10. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Clinic Admin cancela a edição (a partir do passo 5)
1. Clinic Admin clica no ícone de X, ou pressiona Escape.
2. Sistema sai do modo de edição sem salvar; o limite exibido permanece o anterior.

### 7b. Nenhum limite configurado ainda para um produto (a partir do passo 3)
1. O produto não tem nenhum documento em `stock_limits`.
2. Sistema exibe o valor padrão **10** na coluna "Limite", tanto aqui quanto em qualquer outro lugar que leia esse valor via `getStatusEstoque` (badge de status, página de detalhe do item — UC-13) — mas **não** em `checkLowStock`, que usaria o limite global de notificações (`settings.low_stock_threshold`) antes de cair no 10 fixo (RN-03/RN-04, ver seção 9).

---

## 8. Fluxos de Exceção

### 8a. Valor inválido digitado (a partir do passo 7)
1. Clinic Admin digita um valor não numérico ou negativo e confirma.
2. `handleSave` detecta `isNaN(valor) || valor < 0` e simplesmente retorna — **sem salvar e sem exibir nenhuma mensagem de erro ao usuário**. O campo de edição permanece aberto com o valor inválido digitado.
3. Nenhuma pista visual indica ao usuário por que nada aconteceu.

### 8b. Erro ao salvar no Firestore (a partir do passo 8)
1. `setDoc` lança exceção (rede, permissão, etc.).
2. A exceção não é capturada por nenhum `catch` específico dentro de `handleSave` — só um `finally` libera o estado `saving` — não há toast nem alert de erro; o modo de edição pode permanecer ou fechar de forma inconsistente, dependendo de onde a exceção interrompeu a execução (RN-06/seção 14).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | O limite de estoque baixo é armazenado por **tenant + código de produto** (`tenants/{tenantId}/stock_limits/{codigo_produto}`), agregando **todos** os lotes daquele código — não é um limite por lote/item individual de inventário. | Confirmado pela chave do documento (`codigo_produto`) e pelo agrupamento feito tanto em `StockLimitsTab` (`agruparProdutosPorCodigo`) quanto em `checkLowStock` (`totalByCode`). |
| RN-02 | Quando nenhum limite foi configurado para um produto, o valor padrão usado na exibição da UI (`StockLimitsTab`, badge de status em `getStatusEstoque`, página de detalhe do item) é **10**, aplicado apenas no código do frontend (`?? 10`) — nenhum documento com valor 10 é criado automaticamente no Firestore só por exibir esse padrão. | Confirmado por leitura de `StockLimitsTab`, `inventory/[id]/page.tsx` e `inventoryUtils.getStatusEstoque` — todos usam `?? 10` sem persistir nada. |
| RN-03 | **[Divergência confirmada entre exibição e notificação]** O gatilho real de notificação (`checkLowStock`, em `alertTriggers.ts`/`alertChecks.ts`) usa um fallback em **três** níveis, diferente do simples `?? 10` da UI: limite específico do produto (`stock_limits`) → limite global do tenant (`settings.low_stock_threshold`, configurado em uma tela de notificações separada) → 10 fixo, só se nenhum dos dois primeiros existir. | Confirmado por leitura literal de `checkLowStock`: `stockLimitsMap.get(codigoProduto) ?? settings.low_stock_threshold ?? 10` (hoje centralizado em `resolveLowStockThreshold`, `alertRules.ts`). Um tenant com um limite global diferente de 10 pode ver o badge "Estoque Baixo" na UI usando 10 como referência, enquanto a notificação automática usa um limite diferente para o mesmo produto sem limite específico configurado. |
| RN-04 | **[Confirmado]** A geração de notificações de estoque baixo (`checkLowStock`) só ocorre se a configuração `enable_low_stock_alerts` do tenant estiver habilitada (tela de notificações, fora do escopo deste UC) — configurar um limite aqui não tem nenhum efeito de notificação se esse interruptor estiver desligado, nem no disparo manual nem no automático (RN-05). | Confirmado por leitura de `checkLowStock` (retorno antecipado se `!settings.enable_low_stock_alerts`), nos dois espelhos. |
| RN-05 | **[RESOLVIDO — commit `0b647d8`, branch `feature/scheduled-alert-checks`, PR #299, release v1.9.0, cross-ref UC-42/RN-05]** Até esta correção, não havia nenhum agendamento automático rodando as verificações de alerta — tudo dependia de um `clinic_admin` acionar manualmente a aba "Alertas" (UC-42); configurar um limite aqui, isoladamente, não gerava nenhum alerta por si só. **Resolvido**: a Scheduled Function `checkAlertsScheduled` (`functions/src/checkAlertsScheduled.ts`, `onSchedule`, diária às 06:00, horário de Brasília, região `southamerica-east1`) passou a chamar `runChecksForAllTenants`, que executa `checkLowStock` (entre as outras duas checagens) para todos os tenants com `active === true` — o limite configurado neste UC agora também é avaliado automaticamente uma vez por dia, sem depender de nenhuma ação manual. A automação só funcionou de fato em produção depois de três correções adicionais encontradas em validação real pós-deploy: filtro de tenant ativo quebrado (UC-42/RN-09), dedup de `checkLowStock` quebrado (RN-09 deste UC / UC-42/RN-10) e ausência de `admin.initializeApp()` (RN-10 deste UC / UC-42/RN-11). Detalhamento completo de cada correção em UC-42 (RN-05, RN-09 a RN-12). | Confirmado por leitura de `checkAlertsScheduled.ts` e `alertChecks.ts` (`runChecksForAllTenants` → `checkLowStock`), commit `0b647d8`. Cross-referenciado com UC-42/RN-05 (mesma automação, mesmo fechamento, detalhamento completo lá). |
| RN-06 | **[Confirmado, robustez fraca]** `updateStockLimit` e o `handleSave` que a invoca não têm tratamento de erro voltado ao usuário — uma falha de validação (valor inválido) falha silenciosamente, e uma falha de gravação no Firestore não exibe nenhum toast/alert, diferente do padrão do resto do sistema. | Confirmado por leitura literal do componente — apenas um `try/finally` controla o estado `saving`, sem `catch` com feedback visual. |
| RN-07 | **[CORRIGIDO — PR #344, commits `f3ce046` (restrição inicial) + `94cbe2e` (correção de regressão em `list`/query), branch `bugfix/firestore-rules-tenant-role-enforcement`, mergeado em `gscandelari_setup`, deploy confirmado em `curva-mestra-dev`]** Até esta correção, a restrição "só `clinic_admin` configura limites" era aplicada corretamente na renderização da aba (`isAdmin && ...`) — diferente de UC-14, aqui a UI de fato escondia a funcionalidade — mas, no Firestore, a regra genérica `match /tenants/{tenantId}/{document=**} { allow read, write: if belongsToTenant(tenantId); }` já concedia leitura e escrita irrestritas a qualquer usuário do tenant para **qualquer** subcoleção do sistema, tornando inefetiva qualquer regra dedicada que viesse a ser criada só para `stock_limits` (semântica OR do Firestore entre blocos `match`). **Corrigido**: a regra genérica passou a usar `match /tenants/{tenantId}/{collectionId}/{document=**}` e deixou de conceder `write`; um novo bloco dedicado `match /tenants/{tenantId}/stock_limits/{limitId} { allow write: if belongsToTenant(tenantId) && hasRole('clinic_admin'); }` agora é o único caminho de escrita — um `clinic_user` deixa de conseguir alterar um limite chamando o Firestore diretamente. Não se aplica à execução automática (RN-05), que roda com credenciais Admin SDK (bypass de regras do Firestore, só lê o limite já configurado). Mesma correção aplicada em conjunto com UC-13/RN-09, UC-20/RN-07, UC-42/RN-01, UC-43/RN-07 e UC-44/RN-02. | Confirmado por leitura de `firestore.rules` pós-deploy — bloco genérico de subcoleção sem `write`, bloco dedicado `tenants/{tenantId}/stock_limits/{limitId}` exigindo `hasRole('clinic_admin')` para `write`, em conjunto com UC-13/RN-09 (mesma correção, detalhamento técnico completo da história do fix em duas etapas lá). |
| RN-08 | **[CORRIGIDO — commit `216b3a0`]** Até esta correção, `checkLowStock` somava `quantidade_disponivel` de **todos** os documentos de `tenants/{tenantId}/inventory`, sem filtrar `active: true` — diferente de `listInventory` (usado por `StockLimitsTab`, que por padrão só traz itens ativos) e diferente da própria UC-13, onde `forceDeactivateInventoryItem` pode deixar um item já inativo com `quantidade_disponivel > 0`. Corrigido: `checkLowStock` agora usa `query(inventoryRef, where('active', '==', true))` em vez de ler a coleção inteira sem filtro — o total usado para decidir "estoque baixo" não é mais inflado por lotes já desativados. **Achado adicional, além do escopo original catalogado:** o mesmo problema existia nas outras duas funções de `alertTriggers.ts` (`checkExpiringProducts` e `checkExpiredProducts`), corrigidas no mesmo commit e documentadas em UC-42/RN-03 (também marcada `[CORRIGIDO]`). | Corrigido por leitura direta de `checkLowStock`, `checkExpiringProducts` e `checkExpiredProducts` (`alertTriggers.ts`), commit `216b3a0` — todas as três agora filtram `active: true` na query de inventário. |
| RN-09 | **[CORRIGIDO — commit `bd66c8f`, branch `feature/scheduled-alert-checks`, PR #299, cross-ref UC-42/RN-10]** A deduplicação de `checkLowStock` (nos dois espelhos — `src/lib/services/alertTriggers.ts` e o Admin SDK `functions/src/alertChecks.ts`) consultava `where('codigo_produto', '==', codigoProduto)` em `tenants/{tenantId}/notifications` — mas nenhuma notificação grava esse campo na raiz do documento; ele só existe em `metadata.product_code`. A query de dedup, portanto, nunca encontrava nenhuma notificação não lida já existente, e toda execução de `checkLowStock` — seja pelo disparo manual (UC-42) ou pela verificação diária automática (RN-05) — criava uma nova notificação de estoque baixo duplicada para o mesmo produto, mesmo sem nenhuma mudança real no total em estoque avaliado contra o limite configurado por este UC. Corrigido: a query passou a usar `where('metadata.product_code', '==', codigoProduto)`, nos dois lados. Detalhamento completo em UC-42/RN-10. | Corrigido por leitura direta de `checkLowStock` em `alertTriggers.ts` e `alertChecks.ts`, commit `bd66c8f`. |
| RN-10 | **[CORRIGIDO — commit `33bcd47`, branch `hotfix/functions-admin-initializeapp`, PR #307, release v1.9.1, severidade Alta, cross-ref UC-42/RN-11]** A mesma Scheduled Function cujo fechamento de RN-05 está documentado neste UC (`checkAlertsScheduled`) nunca chamava `admin.initializeApp()` — `admin.firestore()`, usado por `checkLowStock` (entre as outras duas checagens) dentro do handler, lançava `Error: The default Firebase app does not exist` em toda execução real (confirmado via `gcloud functions logs read` em produção `curva-mestra` e dev `curva-mestra-dev`), silenciando também a verificação automática de estoque baixo configurada por este UC. Corrigido: guard `if (!admin.apps.length) { admin.initializeApp(); }` no início do handler. Revalidado limpo em produção e dev. Detalhamento completo em UC-42/RN-11. | Corrigido por leitura direta de `checkAlertsScheduled.ts`, commit `33bcd47`, confirmado via `gcloud functions logs read` em produção e dev. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | A edição é inline, linha a linha — cada salvamento é uma chamada individual a `updateStockLimit` (`setDoc`), não há salvamento em lote para múltiplos produtos de uma vez. | Usabilidade |
| RNF-02 | O carregamento inicial busca todos os itens de inventário ativos e todos os limites configurados em duas chamadas paralelas (`Promise.all`), sem paginação — para tenants com muitos produtos distintos, a tabela inteira é carregada de uma vez. | Performance |
| RNF-03 | O valor exibido de "Qtd. em Estoque" na tabela é sempre a soma de `quantidade_disponivel` de todos os lotes ativos daquele código — não distingue lotes prestes a vencer de lotes com validade distante (a granularidade FEFO de UC-13 não é considerada aqui). | Usabilidade |

---

## 11. Frequência de Uso
Ocasional — configurado uma vez por produto (ou ajustado esporadicamente), não uma operação recorrente. **[Nota adicionada em v1.2]** O consumo desse limite, por outro lado, agora ocorre pelo menos uma vez por dia desde a RN-05 (**[RESOLVIDO]**) — a Scheduled Function `checkAlertsScheduled` avalia o limite configurado aqui automaticamente às 06:00, além de qualquer execução manual via UC-42.

---

## 12. Casos de Uso Relacionados
- **UC-42 (Executar Verificações de Alertas Manualmente, Clinic Admin, `/clinic/alerts`)** é o consumidor real do limite configurado aqui, via `checkLowStock` — historicamente, sem essa ação manual, o limite configurado neste UC não gerava nenhuma notificação; desde a RN-05 (**[RESOLVIDO]**, commit `0b647d8`), existe também uma verificação automática diária (Scheduled Function `checkAlertsScheduled`), que só passou a funcionar de fato após três correções adicionais também aplicáveis a este UC (RN-09/RN-10 deste UC, cross-ref UC-42/RN-10 e UC-42/RN-11). O mesmo bug de não filtrar `active: true` (RN-08) existia também em duas outras funções daquele UC (`checkExpiringProducts`, `checkExpiredProducts`), todas corrigidas juntas no commit `216b3a0` (ver UC-42/RN-03).
- **UC-43 (Configurar Preferências de Notificação, Clinic Admin, `/clinic/settings`)** é onde `enable_low_stock_alerts` e o limite global `low_stock_threshold` são configurados — ambos usados como fallback por `checkLowStock` (RN-03/RN-04), com o limite deste UC (por produto) tendo prioridade sobre o `low_stock_threshold` global de UC-43.
- **UC-13 (Desativar Item de Estoque com Verificação de Reservas Ativas)** é referenciado em RN-08 — a redistribuição forçada podia deixar `quantidade_disponivel` residual em itens inativos, que o `checkLowStock` deste UC somava incorretamente ao total do produto (corrigido no commit `216b3a0`). Também compartilha o mesmo achado estrutural de arquitetura de segurança registrado em RN-07/RN-09 de ambos os UCs — corrigido em conjunto no PR #344.

---

## 13. Referências
- `src/components/clinic/StockLimitsTab.tsx`
- `src/app/(clinic)/clinic/my-clinic/page.tsx` (gate `isAdmin` da aba)
- `src/lib/services/inventoryService.ts` (`getStockLimitsMap`, `updateStockLimit`, `listInventory`)
- `src/lib/inventoryUtils.ts` (`getStatusEstoque`, `agruparProdutosPorCodigo`)
- `src/lib/services/alertTriggers.ts` (`checkLowStock`, `runAllChecks` — consumidor real do limite; filtro `active: true` adicionado no commit `216b3a0`, RN-08; dedup corrigido no commit `bd66c8f`, RN-09)
- `src/lib/alertRules.ts` (`resolveLowStockThreshold`, `isLowStock` — funções puras de decisão extraídas no commit `10396a7`/`3086373`)
- `functions/src/alertChecks.ts` (espelho Admin SDK de `checkLowStock`, usado pela Scheduled Function; mesmas correções RN-09 aplicadas aqui também)
- `functions/src/checkAlertsScheduled.ts` (Scheduled Function que dispara `checkLowStock` automaticamente todo dia às 06:00, RN-05; guard `admin.initializeApp()` adicionado no commit `33bcd47`, RN-10)
- `src/components/clinic/AlertsTab.tsx` (ponto de disparo manual de `checkLowStock`)
- `src/types/notification.ts` (`low_stock_threshold`, `enable_low_stock_alerts`)
- `firestore.rules` (regra genérica de subcoleção do tenant agora `tenants/{tenantId}/{collectionId}/{document=**}`, sem `write`; bloco dedicado `tenants/{tenantId}/stock_limits/{limitId}` exigindo `hasRole('clinic_admin')` para `write` — RN-07, corrigido no PR #344, commits `f3ce046`/`94cbe2e`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RESOLVIDO em v1.2 — commit `0b647d8`, release v1.9.0]** RN-05 — a Scheduled Function `checkAlertsScheduled` passou a existir, rodando diariamente `checkLowStock` (entre as outras duas checagens) para todos os tenants ativos, além do disparo manual (UC-42). A automação só funcionou de fato após três correções adicionais encontradas em validação real pós-deploy (RN-09/RN-10 deste UC — cross-ref UC-42/RN-10 e UC-42/RN-11 —, e UC-42/RN-09, este último sem cross-ref dedicado neste UC por afetar apenas a seleção de quais tenants processar, não a lógica de `checkLowStock` em si). Mesma resolução documentada em UC-42/RN-05.
2. **[Divergência confirmada]** RN-03 — a UI usa um fallback simples (10) enquanto a notificação usa um fallback em 3 níveis (produto → global do tenant → 10); podem divergir visivelmente para tenants com um `low_stock_threshold` customizado.
3. **[RESOLVIDO em v1.1 — commit `216b3a0`]** RN-08 — `checkLowStock` agora filtra `active: true` (assim como `checkExpiringProducts` e `checkExpiredProducts`, corrigidas no mesmo commit — ver UC-42/RN-03). Não há mais soma de quantidade residual de lotes desativados por UC-13.
4. **[Observação]** RN-06 — ausência de feedback de erro ao usuário (validação e falha de gravação silenciosas).
5. **[RESOLVIDO em v1.3 — PR #344, commits `f3ce046`/`94cbe2e`]** RN-07 — a restrição de role para configurar limites, antes só de interface, agora também é reforçada no Firestore: a regra genérica de subcoleção do tenant deixou de conceder `write`, e um bloco dedicado para `stock_limits` exige `hasRole('clinic_admin')`. Mesma correção aplicada em conjunto a UC-13/RN-09, UC-20/RN-07, UC-42/RN-01, UC-43/RN-07 e UC-44/RN-02.
6. **[Nota de rastreabilidade — resolvida]** "Executar Verificações de Alertas Manualmente" e "Configurar Preferências de Notificação" foram mapeados como UC-42 e UC-43, respectivamente (ver seção 12).
7. **[Nota de rastreabilidade, v1.2]** RN-09 e RN-10 documentam, do ponto de vista deste UC, dois bugs cuja correção completa está detalhada em UC-42 (RN-10 e RN-11, respectivamente) — evitando duplicar aqui o relato investigativo completo (logs de produção, commits, PRs), já registrado lá.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero por leitura completa de `StockLimitsTab.tsx`, `inventoryService.ts` (`getStockLimitsMap`/`updateStockLimit`/`listInventory`), `inventoryUtils.ts` (`getStatusEstoque`), `alertTriggers.ts` (`checkLowStock`/`runAllChecks`) e `AlertsTab.tsx`, além de busca em todo `src/` e `functions/` para confirmar ausência de agendamento automático. Respondidas as quatro perguntas do levantamento: o limite é armazenado por tenant + código de produto, agregando todos os lotes (RN-01); é de fato consumido por `checkLowStock`, mas com um fallback em 3 níveis diferente do usado na exibição da UI (RN-03); o valor padrão quando não configurado é 10, aplicado só no frontend (RN-02); e a restrição de role, embora corretamente aplicada na renderização da aba (diferente de UC-11/14), não tem uma regra dedicada no Firestore (RN-07). Identificados também, fora do escopo das perguntas originais: ausência de qualquer agendamento automático das verificações de alerta (RN-05) e uma inconsistência cross-UC entre `checkLowStock` e a desativação forçada de UC-13 (RN-08). |
| 1.0.1 | 15/07/2026 | Guilherme Scandelari | Correção pontual: seção 12 e item 6 da seção 14 atualizados para referenciar UC-42 (Executar Verificações de Alertas Manualmente) e UC-43 (Configurar Preferências de Notificação), agora mapeados — resolvendo a nota de rastreabilidade que antes apontava para "UCs ainda não mapeados". Sem alteração de escopo, fluxos ou regras de negócio deste UC. |
| 1.1 | 25/07/2026 | Guilherme Scandelari | **Correção de bug de severidade Média (commit `216b3a0`)**: RN-08 corrigido — `checkLowStock` agora filtra `active: true` na query de inventário (assim como as duas outras funções de `alertTriggers.ts`, corrigidas de brinde no mesmo commit e documentadas em UC-42/RN-03), eliminando a soma de quantidade residual de lotes já desativados. **Achado ampliado, não corrigido**: RN-07 foi reescrita para refletir uma descoberta mais séria feita durante a mesma investigação — a regra genérica de subcoleção do tenant em `firestore.rules` já concede escrita irrestrita a qualquer usuário para todas as subcoleções, tornando qualquer regra dedicada adicional (só para `stock_limits`) inefetiva sem alterar a regra genérica em si (mesmo achado documentado em UC-13/RN-09). RN-05 (agendamento automático) permanece não corrigida, sem alteração de texto. Seções 1 (diagrama), 2.1, 9 (RN-05, RN-07, RN-08), 12, 13 e 14 (itens 1, 3, 5) atualizadas de acordo. |
| 1.2 | 29/09/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Fechamento de RN-05 + duas novas RNs de bug, cross-referenciadas do mapa de bugs (v3.37, achados originais em UC-42-RN-10/UC-42-RN-11).** RN-05 passou de "adiada" para **[RESOLVIDO]**: a Scheduled Function `checkAlertsScheduled` (commit `0b647d8`, PR #299, release v1.9.0) passou a rodar `checkLowStock` diariamente para todos os tenants ativos, além do disparo manual (UC-42). Duas novas regras foram adicionadas, documentando do ponto de vista deste UC (domínio de estoque baixo) bugs cujo relato investigativo completo está em UC-42: **RN-09** (commit `bd66c8f`, cross-ref UC-42/RN-10) — dedup de `checkLowStock` consultava um campo inexistente na raiz da notificação, duplicando alertas de estoque baixo a cada execução; **RN-10** (commit `33bcd47`, release v1.9.1, severidade Alta, cross-ref UC-42/RN-11) — ausência de `admin.initializeApp()` quebrava a Scheduled Function em toda execução real, silenciando também a verificação automática de estoque baixo. Seções 1 (diagrama), 2.2, 4.1, 9 (RN-03, RN-04, RN-05, RN-07, RN-09 e RN-10 novas), 11, 12, 13 e 14 (item 1 fechado, novo item 7) atualizadas de acordo. **Nota de consistência**: o mapa de bugs já registrava RN-05 como fechada desde o commit `0b647d8`/v3.36, mas essa atualização nunca havia sido propagada para este documento — corrigido nesta revisão. |
| 1.3 | 02/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Correção de segurança real implementada e mergeada (PR #344, branch `bugfix/firestore-rules-tenant-role-enforcement`, commits `f3ce046` + `94cbe2e`, deploy confirmado em `curva-mestra-dev`)**: RN-07 passou de "achado não corrigido" para **[CORRIGIDO]** — a regra genérica de subcoleção do tenant deixou de conceder `write` e mudou de `match /tenants/{tenantId}/{document=**}` para `match /tenants/{tenantId}/{collectionId}/{document=**}`; um novo bloco dedicado `match /tenants/{tenantId}/stock_limits/{limitId}` agora exige `hasRole('clinic_admin')` para `write`. Seção 2.1, RN-07 (seção 9), item 5 da seção 14, e seções 12/13 atualizadas de acordo. Mesma correção aplicada em conjunto a UC-13/RN-09, UC-20/RN-07, UC-42/RN-01, UC-43/RN-07 e UC-44/RN-02. |
