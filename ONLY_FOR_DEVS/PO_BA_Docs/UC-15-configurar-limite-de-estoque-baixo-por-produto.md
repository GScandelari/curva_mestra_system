# UC-15: Configurar Limite de Estoque Baixo por Produto

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário
**Versão:** 1.0.1

> Um Clinic Admin define, produto a produto (por código, agregando todos os lotes), a partir de qual quantidade total disponível o produto passa a ser considerado "Estoque Baixo". O limite fica salvo por tenant + código de produto. Ele é consumido em dois lugares com lógicas ligeiramente diferentes: o badge de status na UI (fallback simples: limite `?? 10`) e o gatilho de notificação automática de estoque baixo (fallback em 3 níveis: limite do produto → limite global do tenant → 10) — e este último só roda quando um Clinic Admin aciona manualmente a verificação de alertas (não há nenhum agendamento/cron automático encontrado no código).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    AlertsCheck([🔧 "Executar Verificações"\nmanual, aba Alertas — UC não mapeado])
    Notification([🔧 Notificação de\nestoque baixo])

    subgraph Sistema["Curva Mestra"]
        UC15(("UC-15\nConfigurar Limite de\nEstoque Baixo por Produto"))
    end

    ClinicAdmin --> UC15
    UC15 -.->|limite salvo é lido por| AlertsCheck
    AlertsCheck -.->|se abaixo do limite e alertas habilitados| Notification
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** — a aba "Limite de Estoque" só é renderizada para `claims.role === "clinic_admin"` na página pai (`clinic/my-clinic/page.tsx`, `{isAdmin && (...)}`). **Diferente de UC-11/UC-14, aqui a UI oculta corretamente a aba para `clinic_user`.** Mesmo assim, a regra do Firestore para `stock_limits` não é uma regra dedicada — cai na regra genérica de `tenants/{tenantId}/{document=**}`, que permite leitura e escrita a qualquer usuário do tenant (`belongsToTenant`), não apenas `clinic_admin` (RN-07/seção 14).

### 2.2 Atores Secundários / Sistemas Externos
Nenhum ator humano direto; indiretamente, o mecanismo de verificação de alertas (aba "Alertas", `checkLowStock`) é quem consome o limite configurado aqui.

---

## 3. Pré-condições
- Usuário autenticado com role `clinic_admin` e `tenant_id` definido.
- Existe pelo menos um item de inventário ativo no tenant (senão a aba mostra "Nenhum produto em estoque").

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Um documento é criado/atualizado (`setDoc` com `merge: true`) em `tenants/{tenantId}/stock_limits/{codigo_produto}`, com o campo `limite_estoque_baixo`.
- Isso **não** dispara nenhum recálculo, notificação ou alerta imediato — o valor só é lido na próxima vez que a exibição do status "Estoque Baixo" for renderizada, ou que a verificação de alertas (aba "Alertas") for executada manualmente.

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
| RN-03 | **[Divergência confirmada entre exibição e notificação]** O gatilho real de notificação (`checkLowStock`, em `alertTriggers.ts`) usa um fallback em **três** níveis, diferente do simples `?? 10` da UI: limite específico do produto (`stock_limits`) → limite global do tenant (`settings.low_stock_threshold`, configurado em uma tela de notificações separada) → 10 fixo, só se nenhum dos dois primeiros existir. | Confirmado por leitura literal de `checkLowStock`: `stockLimitsMap.get(codigoProduto) ?? settings.low_stock_threshold ?? 10`. Um tenant com um limite global diferente de 10 pode ver o badge "Estoque Baixo" na UI usando 10 como referência, enquanto a notificação automática usa um limite diferente para o mesmo produto sem limite específico configurado. |
| RN-04 | **[Confirmado]** A geração de notificações de estoque baixo (`checkLowStock`) só ocorre se a configuração `enable_low_stock_alerts` do tenant estiver habilitada (tela de notificações, fora do escopo deste UC) — configurar um limite aqui não tem nenhum efeito de notificação se esse interruptor estiver desligado. | Confirmado por leitura de `checkLowStock` (retorno antecipado se `!settings.enable_low_stock_alerts`). |
| RN-05 | **[Confirmado, achado não solicitado mas relevante]** Não existe nenhum agendamento/cron automático rodando `checkLowStock` (nem `runAllChecks`) — o único ponto de chamada encontrado em toda a base de código é a aba "Alertas" (`AlertsTab.tsx`), acionada manualmente por um `clinic_admin` clicando em "Executar Verificações" ou no check individual de "Estoque Baixo". Configurar um limite aqui não gera nenhuma notificação por si só; alguém precisa, depois, acionar essa verificação manualmente. | Confirmado por busca em todo `src/` e `functions/` — nenhuma Cloud Function agendada referencia `checkLowStock` ou `runAllChecks`; `CLAUDE.md` menciona "Firebase Scheduled Functions" na stack pretendida, mas isso não está implementado para este fluxo especificamente. |
| RN-06 | **[Confirmado, robustez fraca]** `updateStockLimit` e o `handleSave` que a invoca não têm tratamento de erro voltado ao usuário — uma falha de validação (valor inválido) falha silenciosamente, e uma falha de gravação no Firestore não exibe nenhum toast/alert, diferente do padrão do resto do sistema. | Confirmado por leitura literal do componente — apenas um `try/finally` controla o estado `saving`, sem `catch` com feedback visual. |
| RN-07 | **[Mesmo padrão já visto em UC-11/UC-14, porém mais brando]** A restrição "só `clinic_admin` configura limites" é aplicada corretamente na renderização da aba (`isAdmin && ...`) — diferente de UC-14, aqui a UI de fato esconde a funcionalidade — mas não existe uma regra dedicada do Firestore para `stock_limits`; a coleção cai na regra genérica de `tenants/{tenantId}/{document=**}` (`belongsToTenant`), que permite leitura e escrita a qualquer usuário do tenant, incluindo `clinic_user`, via chamada direta. | Confirmado pela ausência de qualquer `match /stock_limits/` em `firestore.rules`. |
| RN-08 | **[Inconsistência cross-UC confirmada, relevante]** `checkLowStock` soma `quantidade_disponivel` de **todos** os documentos de `tenants/{tenantId}/inventory`, sem filtrar `active: true` — diferente de `listInventory` (usado por `StockLimitsTab`, que por padrão só traz itens ativos) e diferente da própria UC-13, onde `forceDeactivateInventoryItem` pode deixar um item já inativo com `quantidade_disponivel > 0` (o "sobra" liberado da reserva é somado ao disponível do próprio item desativado, mesmo ele ficando `active: false`). O total usado para decidir se um produto está em "estoque baixo" na notificação automática pode estar inflado por lotes já desativados, mascarando um estoque real mais baixo do que o calculado. | Confirmado por comparação direta entre `checkLowStock` (sem filtro `active`) e `listInventory` (`activeOnly: true` por padrão), e pela lógica de `forceDeactivateInventoryItem` documentada em UC-13. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | A edição é inline, linha a linha — cada salvamento é uma chamada individual a `updateStockLimit` (`setDoc`), não há salvamento em lote para múltiplos produtos de uma vez. | Usabilidade |
| RNF-02 | O carregamento inicial busca todos os itens de inventário ativos e todos os limites configurados em duas chamadas paralelas (`Promise.all`), sem paginação — para tenants com muitos produtos distintos, a tabela inteira é carregada de uma vez. | Performance |
| RNF-03 | O valor exibido de "Qtd. em Estoque" na tabela é sempre a soma de `quantidade_disponivel` de todos os lotes ativos daquele código — não distingue lotes prestes a vencer de lotes com validade distante (a granularidade FEFO de UC-13 não é considerada aqui). | Usabilidade |

---

## 11. Frequência de Uso
Ocasional — configurado uma vez por produto (ou ajustado esporadicamente), não uma operação recorrente.

---

## 12. Casos de Uso Relacionados
- **UC-42 (Executar Verificações de Alertas Manualmente, Clinic Admin, `/clinic/alerts`)** é o consumidor real do limite configurado aqui, via `checkLowStock` — sem essa ação manual, o limite configurado neste UC não gera nenhuma notificação (RN-05).
- **UC-43 (Configurar Preferências de Notificação, Clinic Admin, `/clinic/settings`)** é onde `enable_low_stock_alerts` e o limite global `low_stock_threshold` são configurados — ambos usados como fallback por `checkLowStock` (RN-03/RN-04), com o limite deste UC (por produto) tendo prioridade sobre o `low_stock_threshold` global de UC-43.
- **UC-13 (Desativar Item de Estoque com Verificação de Reservas Ativas)** é referenciado em RN-08 — a redistribuição forçada pode deixar `quantidade_disponivel` residual em itens inativos, que o `checkLowStock` deste UC soma incorretamente ao total do produto.

---

## 13. Referências
- `src/components/clinic/StockLimitsTab.tsx`
- `src/app/(clinic)/clinic/my-clinic/page.tsx` (gate `isAdmin` da aba)
- `src/lib/services/inventoryService.ts` (`getStockLimitsMap`, `updateStockLimit`, `listInventory`)
- `src/lib/inventoryUtils.ts` (`getStatusEstoque`, `agruparProdutosPorCodigo`)
- `src/lib/services/alertTriggers.ts` (`checkLowStock`, `runAllChecks` — consumidor real do limite)
- `src/components/clinic/AlertsTab.tsx` (ponto de disparo manual de `checkLowStock`)
- `src/types/notification.ts` (`low_stock_threshold`, `enable_low_stock_alerts`)
- `firestore.rules` (ausência de regra dedicada para `stock_limits` — RN-07)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[Confirmado, achado não solicitado mas relevante]** RN-05 — não há nenhum agendamento automático rodando as verificações de alerta; tudo depende de um `clinic_admin` acionar manualmente a aba "Alertas". Configurar um limite aqui, isoladamente, não gera nenhum alerta por si só.
2. **[Divergência confirmada]** RN-03 — a UI usa um fallback simples (10) enquanto a notificação usa um fallback em 3 níveis (produto → global do tenant → 10); podem divergir visivelmente para tenants com um `low_stock_threshold` customizado.
3. **[Inconsistência cross-UC confirmada]** RN-08 — `checkLowStock` não filtra por `active: true`, podendo somar quantidade residual de lotes desativados por UC-13.
4. **[Observação]** RN-06 — ausência de feedback de erro ao usuário (validação e falha de gravação silenciosas).
5. **[Observação, mesmo padrão de UC-11/UC-14, porém mais brando]** RN-07 — Firestore não tem regra dedicada para `stock_limits`; restrição de role é só na UI (embora aqui, diferente de UC-11/14, a UI pelo menos esconda a aba corretamente).
6. **[Nota de rastreabilidade — resolvida]** "Executar Verificações de Alertas Manualmente" e "Configurar Preferências de Notificação" foram mapeados como UC-42 e UC-43, respectivamente (ver seção 12).

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero por leitura completa de `StockLimitsTab.tsx`, `inventoryService.ts` (`getStockLimitsMap`/`updateStockLimit`/`listInventory`), `inventoryUtils.ts` (`getStatusEstoque`), `alertTriggers.ts` (`checkLowStock`/`runAllChecks`) e `AlertsTab.tsx`, além de busca em todo `src/` e `functions/` para confirmar ausência de agendamento automático. Respondidas as quatro perguntas do levantamento: o limite é armazenado por tenant + código de produto, agregando todos os lotes (RN-01); é de fato consumido por `checkLowStock`, mas com um fallback em 3 níveis diferente do usado na exibição da UI (RN-03); o valor padrão quando não configurado é 10, aplicado só no frontend (RN-02); e a restrição de role, embora corretamente aplicada na renderização da aba (diferente de UC-11/14), não tem uma regra dedicada no Firestore (RN-07). Identificados também, fora do escopo das perguntas originais: ausência de qualquer agendamento automático das verificações de alerta (RN-05) e uma inconsistência cross-UC entre `checkLowStock` e a desativação forçada de UC-13 (RN-08). |
| 1.0.1 | 15/07/2026 | Guilherme Scandelari | Correção pontual: seção 12 e item 6 da seção 14 atualizados para referenciar UC-42 (Executar Verificações de Alertas Manualmente) e UC-43 (Configurar Preferências de Notificação), agora mapeados — resolvendo a nota de rastreabilidade que antes apontava para "UCs ainda não mapeados". Sem alteração de escopo, fluxos ou regras de negócio deste UC. |
