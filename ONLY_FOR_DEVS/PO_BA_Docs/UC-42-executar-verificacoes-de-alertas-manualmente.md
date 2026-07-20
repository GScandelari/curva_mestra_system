# UC-42: Executar Verificações de Alertas Manualmente

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Notificações e Alertas
**Versão:** 1.3

> Um Clinic Admin aciona manualmente, na tela `/clinic/alerts`, a varredura de todo o inventário do tenant em busca de produtos vencendo, produtos vencidos e produtos em estoque baixo, gerando notificações persistidas em `tenants/{tenantId}/notifications`. É o único ponto do sistema, hoje, que efetivamente dispara essas verificações — não existe nenhum agendamento automático (cron/Scheduled Function) rodando essa lógica.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    Firestore[(🗄️ Firestore\ntenants/{tenantId}/inventory\ntenants/{tenantId}/notifications)]

    subgraph Sistema["Curva Mestra"]
        UC42(("UC-42\nExecutar Verificações\nde Alertas Manualmente"))
        UC43(("UC-43\nConfigurar Preferências\nde Notificação"))
        UC15(("UC-15\nConfigurar Limite de\nEstoque Baixo por Produto"))
    end

    ClinicAdmin --> UC42
    UC42 -.->|lê enable_*/thresholds\nconfigurados em| UC43
    UC42 -.->|lê limite por produto\nconfigurado em| UC15
    UC42 -->|cria/consulta| Firestore
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** — a tela só é útil para `claims.role === 'clinic_admin'`: o componente `AlertsTab` (renderizado em `/clinic/alerts`) exibe, para qualquer outro papel, apenas o `Alert` "Apenas administradores podem executar checks de alertas" e nenhum botão de ação.

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo. Indiretamente, o resultado deste caso de uso (notificações criadas em `tenants/{tenantId}/notifications`) é consumido pelo componente `NotificationBell` (sino de notificações no header do layout de clínica, `src/components/clinic/ClinicLayout.tsx`), que lista, marca como lida e permite excluir essas notificações — funcionalidade que **não tem UC próprio mapeado** (ver seção 14).

---

## 3. Pré-condições
- Usuário autenticado com role `clinic_admin` e `tenant_id` definido.
- **Não é pré-condição real, mas afeta o resultado**: existir um documento em `tenants/{tenantId}/settings/notifications` (criado apenas via UC-43). Se esse documento não existir, todos os checks retornam silenciosamente sem verificar nada (ver RN-05 e fluxo 8b).

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Zero ou mais documentos são criados em `tenants/{tenantId}/notifications` (tipos `expiring`, `expired` e `low_stock` — desde a correção do commit `16877f1` (RN-02, **[CORRIGIDO]**), o tipo `expired` também é persistido de fato; antes, apenas `expiring` e `low_stock` geravam notificações reais), cada um com `read: false`.
- A UI exibe um toast e, quando "Executar Todos os Checks" é usado, um card de resultados com contagem `checked`/`created` por tipo e lista de erros (se houver).
- Nenhuma alteração é feita em `tenants/{tenantId}/inventory`, `stock_limits` ou `settings/notifications` — este caso de uso é somente leitura sobre esses dados.

### 4.2 Falha (Garantias Mínimas)
- Se ocorrer um erro inesperado, a função de check correspondente captura a exceção internamente e a devolve na lista `errors` do resultado (não propaga exceção não tratada para a UI, exceto falhas na própria chamada da função, capturadas pelo `try/catch` do componente com toast "Erro ao executar checks"/"Erro ao executar check").
- Nenhuma notificação parcial ou corrompida é criada — cada notificação é um `addDoc` individual e atômico por produto/lote.

---

## 5. Gatilho (Trigger)
Clinic Admin navega para `/clinic/alerts` e clica em "Executar Check" (em um dos três cards individuais) ou em "Executar Todos os Checks". **Não há nenhum link, item de menu ou botão em nenhuma outra tela do sistema que leve a esta rota** — nem na navegação principal do `ClinicLayout` (`navLinks`), nem nas abas de "Minha Clínica" (`clinic`, `users`, `stock_limits`, `consultant`), nem no dashboard. O acesso só ocorre por navegação direta de URL (ver RN-06/seção 14).

---

## 6. Fluxo Principal (Basic Flow) — "Executar Todos os Checks"

1. Clinic Admin acessa `/clinic/alerts` diretamente pela URL.
2. Sistema confirma `claims.role === 'clinic_admin'` e renderiza três cards ("Produtos Vencendo", "Produtos Vencidos", "Estoque Baixo") mais um card "Executar Todos os Checks".
3. Clinic Admin clica em "Executar Todos os Checks".
4. Sistema chama `runAllChecks(tenantId)`, que dispara em paralelo (`Promise.all`) `checkExpiringProducts`, `checkExpiredProducts` e `checkLowStock`.
5. Cada função busca `tenants/{tenantId}/settings/notifications` (`getNotificationSettings`); se o switch correspondente (`enable_expiry_alerts` ou `enable_low_stock_alerts`) estiver desligado, a função retorna imediatamente com `checked: 0, notificationsCreated: 0` (ver fluxo 8b para o caso de configurações inexistentes).
6. Cada função busca **todos** os documentos de `tenants/{tenantId}/inventory` — sem filtro `active: true` e sem paginação (RN-03).
7. `checkExpiringProducts` verifica, item a item, se `dt_validade` cai entre hoje e hoje + `expiry_warning_days`; para cada item elegível sem notificação `expiring` não lida já existente para aquele `inventory_id`, cria uma notificação (`createExpiringProductNotification`) com prioridade `urgent` (≤7 dias), `high` (≤15 dias) ou `medium`.
8. `checkExpiredProducts` verifica, item a item, se `dt_validade < hoje`; para cada item elegível sem notificação `expired` não lida existente, cria de fato uma notificação via `createExpiredProductNotification` (tipo `expired`, prioridade `urgent`, sempre) — RN-02, **[CORRIGIDO]** no commit `16877f1`; antes, esse passo apenas incrementava o contador interno `notificationsCreated` e logava no console, sem gravar nada no Firestore.
9. `checkLowStock` busca `tenants/{tenantId}/stock_limits`, agrupa a quantidade disponível de **todos** os lotes de `inventory` por `codigo_produto` (incluindo lotes inativos — RN-03) e, para cada produto cujo total esteja `> 0` e `<= limite` (limite = `stock_limits` do produto → `settings.low_stock_threshold` → 10), cria uma notificação (`createLowStockNotification`) com prioridade `high`, se ainda não existir uma notificação `low_stock` não lida para aquele `codigo_produto`.
10. Sistema exibe um toast "Checks concluídos! {N} notificações foram criadas." e um card "Resultados do Último Check" com a contagem `checked`/`created` de cada um dos três tipos, mais uma lista de erros se `totalErrors > 0`.
11. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Executar apenas um check individual (a partir do passo 3)
1. Clinic Admin clica em "Executar Check" em um dos três cards ("Produtos Vencendo", "Produtos Vencidos" ou "Estoque Baixo") em vez de "Executar Todos os Checks".
2. Sistema chama apenas a função correspondente (`checkExpiringProducts`, `checkExpiredProducts` ou `checkLowStock`).
3. Sistema exibe um toast "{Nome do Check} - Concluído: {checked} produtos verificados, {notificationsCreated} alertas criados." — **o card "Resultados do Último Check" não é atualizado nesse fluxo**, pois o estado `results` só é setado por `handleRunAllChecks` (ver RN-04).
4. Caso de uso é concluído com sucesso.

---

## 8. Fluxos de Exceção

### 8a. Usuário não é Clinic Admin (a partir do passo 2)
1. `claims.role !== 'clinic_admin'`.
2. Sistema renderiza apenas o `Alert` "Apenas administradores podem executar checks de alertas" — nenhum card ou botão é exibido.
3. Caso de uso é encerrado sem nenhuma ação possível.

### 8b. Configurações de notificação inexistentes para o tenant (a partir do passo 5)
1. `tenants/{tenantId}/settings/notifications` não existe (tenant nunca acessou `/clinic/settings` — UC-43 — com sucesso; ver RN-05 daquele UC sobre o bug de inicialização).
2. `getNotificationSettings` retorna `null`.
3. Cada função de check trata `!settings` da mesma forma que "alertas desabilitados": retorna imediatamente com `checked: 0, notificationsCreated: 0`, sem lançar erro.
4. A UI exibe o mesmo toast de sucesso ("0 produtos verificados, 0 alertas criados") sem nenhuma indicação de que a causa é a ausência de configuração — o Clinic Admin não tem como saber, por essa tela, que precisa primeiro configurar (ou tentar configurar) as preferências em `/clinic/settings`.

### 8c. [Corrigido no commit `16877f1`] Produto vencido não gerava notificação real (histórico)
1. Antes da correção, `checkExpiredProducts` encontrava um item com `dt_validade < hoje` e nenhuma notificação `expired` não lida existente.
2. A função executava `await getDocs(notificationsRefCreate)` — uma leitura, comentada no código-fonte como `"Placeholder para addDoc"` — e **não gravava nenhum documento**.
3. `results.notificationsCreated++` era incrementado mesmo assim, e o console logava `"🚨 Alerta URGENTE criado: ... VENCIDO ..."`.
4. A UI (toast e card de resultados) reportava esse produto como um alerta "criado" — mas nenhuma notificação de produto vencido jamais aparecia no `NotificationBell` ou em qualquer outro lugar do sistema.
5. **[CORRIGIDO]** No commit `16877f1`, foi adicionado o helper `createExpiredProductNotification` em `notificationService.ts` (mesmo padrão de `createExpiringProductNotification`/`createLowStockNotification`), com `type: 'expired'`, `priority: 'urgent'` (sempre urgente, já que o produto já venceu), título "Produto vencido" e mensagem `"{nome} (lote {lote}) está vencido desde {data}"`. `checkExpiredProducts` agora chama esse helper no lugar do placeholder — a notificação passa a ser efetivamente persistida em `tenants/{tenantId}/notifications` (ver seção 6, passo 8, e RN-02).

### 8d. Erro inesperado durante um check (a partir do passo 4)
1. Uma chamada ao Firestore falha (rede, permissão) dentro de uma das três funções.
2. O `try/catch` interno da função captura o erro, adiciona a mensagem em `results.errors` e a função retorna normalmente (sem lançar).
3. Se o erro ocorrer fora desses `try/catch` internos (ex.: na própria invocação de `runAllChecks`/`checkLowStock` pelo componente), o `catch` do `AlertsTab` exibe um toast destrutivo "Erro ao executar checks" / "Erro ao executar check" com `error.message`.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | Apenas `clinic_admin` pode executar os checks — e, diferente de UC-15 (`stock_limits`), aqui a restrição também é reforçada no Firestore: a regra `match /tenants/{tenantId}/notifications/{notificationId}` exige `role == 'clinic_admin'` para `create` e `delete` (mas não para `read`/`update`, que qualquer usuário do tenant pode fazer). | Confirmado por leitura de `AlertsTab.tsx` (`isAdmin &&`) e `firestore.rules` linhas 65-74. |
| RN-02 | **[CORRIGIDO — commit `16877f1`]** `checkExpiredProducts` não persistia nenhuma notificação real: o trecho que deveria chamar um criador de notificação foi substituído por um `getDocs` comentado como placeholder. `notificationsCreated` era incrementado e o toast reportava sucesso, mas nenhum documento era gravado em `tenants/{tenantId}/notifications` com `type: 'expired'`. Corrigido: novo helper `createExpiredProductNotification` (em `notificationService.ts`, mesmo padrão de `createExpiringProductNotification`/`createLowStockNotification`) — `type: 'expired'`, `priority: 'urgent'`, título "Produto vencido", mensagem `"{nome} (lote {lote}) está vencido desde {data}"` — agora é chamado por `checkExpiredProducts`, substituindo o placeholder. | Corrigido por leitura direta de `alertTriggers.ts` (`checkExpiredProducts`) e `notificationService.ts` (novo `createExpiredProductNotification`), commit `16877f1`. |
| RN-03 | **[Mesmo padrão de UC-15/RN-08, agora confirmado nos três checks]** Nenhuma das três funções (`checkExpiringProducts`, `checkExpiredProducts`, `checkLowStock`) filtra `active: true` ao buscar `tenants/{tenantId}/inventory` — todas somam/avaliam também lotes já desativados (ex.: por UC-13). | Confirmado por leitura literal: nenhuma das três funções usa `where('active', '==', true)` nem equivalente. |
| RN-04 | O card "Resultados do Último Check" só é populado ao usar "Executar Todos os Checks" (`handleRunAllChecks`, que seta o estado `results`); executar um check individual (`handleRunSingleCheck`) mostra apenas um toast, sem atualizar esse card. | Confirmado por leitura de `AlertsTab.tsx` — `setResults` só é chamado dentro de `handleRunAllChecks`. |
| RN-05 | **[Cross-referência confirmada com UC-15/RN-05]** Não existe nenhum agendamento automático (Scheduled Function/cron) rodando `runAllChecks`/`runChecksForAllTenants`. A função `runChecksForAllTenants` (pensada para uso em uma scheduled function, processa todos os tenants ativos) existe em `alertTriggers.ts` mas não é chamada por nenhum arquivo em `functions/src/` nem em nenhum outro ponto do repositório. | Confirmado por busca em todo o repositório por `runChecksForAllTenants` — única ocorrência é a própria definição da função. `CLAUDE.md` cita "Firebase Scheduled Functions" na stack pretendida, mas não implementada para este fluxo. |
| RN-06 | **[Achado não solicitado, mas relevante]** A rota `/clinic/alerts` não é referenciada por nenhum link, `href` ou `router.push` em nenhuma outra tela do sistema (menu principal, abas de "Minha Clínica", dashboard). O único caminho de acesso é a navegação direta por URL. | Confirmado por busca textual em todo `src/` por `clinic/alerts` e `/alerts'` — nenhuma ocorrência fora da própria rota e do componente `AlertsTab`. |
| RN-07 | A deduplicação de alertas usa uma consulta por notificação **não lida** já existente do mesmo tipo e mesma entidade (`inventory_id` para vencimento/vencido, `codigo_produto` para estoque baixo); uma vez que o Clinic Admin (ou qualquer usuário, via `NotificationBell`) marca essa notificação como lida, a próxima execução do check volta a criar uma nova notificação idêntica, mesmo que a condição de origem não tenha mudado. | Confirmado pela lógica de `existingNotificationQuery` (`where('read', '==', false)`) presente nas três funções. |
| RN-08 | **[Divergência confirmada entre marketing e produto]** A landing page (`ONLY_FOR_DEVS/new_landing_page/sections-product.jsx`, módulo `id: "inventario"` do array `MODULES`) promete ao cliente, na `desc` do módulo (linha 96), "**Alertas automáticos de vencimento**" e, em um dos `bullets` (linha 99), "**Validade com alertas de 60/30/15 dias**". Nenhuma das duas promessas corresponde ao sistema real: (a) não existe automação — confirmado por RN-05 deste UC (nenhuma Scheduled Function/cron chama `runAllChecks`/`runChecksForAllTenants`; busca em `functions/src/` por `onSchedule`/`pubsub.schedule` não retornou nenhuma ocorrência) — a verificação só ocorre quando um Clinic Admin clica manualmente em `/clinic/alerts`; (b) não existe escalonamento em três estágios fixos de 60/30/15 dias — existe apenas um único limiar configurável, `expiry_warning_days` (ver UC-43/RN-03, padrão 30 dias), e a "prioridade" visual calculada em `createExpiringProductNotification` (`notificationService.ts`, linhas 356-357: `daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 15 ? 'high' : 'medium'`) usa os cortes 7/15, não 60/30/15. Ver também UC-43/RN-08 (mesma divergência, do ponto de vista da tela de configuração). | Confirmado por leitura literal de `sections-product.jsx` (linhas 96 e 99), releitura de `alertTriggers.ts` (RN-05 deste UC) e de `notificationService.ts` (`createExpiringProductNotification`, linhas 346-365), e busca em `functions/src/` por `onSchedule`/`pubsub.schedule`/`runChecksForAllTenants`, sem nenhuma ocorrência de agendamento automático. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Cada função de check faz uma varredura completa de `tenants/{tenantId}/inventory` sem paginação; para tenants com muitos itens de estoque, a operação pode ficar lenta e cara em leituras do Firestore (agravado por rodar as três funções em paralelo via `Promise.all`). | Performance |
| RNF-02 | Todas as escritas (`addDoc` de notificação) são individuais e sequenciais dentro do laço de cada função — não há `writeBatch`, diferente de `markAllAsRead`/`deleteReadNotifications` em `notificationService.ts`. | Performance |
| RNF-03 | Multi-tenant: todas as leituras e escritas são escopadas por `tenants/{tenantId}/...`, tanto no client (`tenantId` vindo de `claims.tenant_id`) quanto na regra do Firestore (`belongsToTenant`/regra dedicada de `notifications`). | Multi-tenant |

---

## 11. Frequência de Uso
Não determinável com precisão a partir do código — depende inteiramente de um Clinic Admin lembrar de navegar manualmente para uma URL não linkada em nenhum lugar da aplicação (RN-06). Presumivelmente rara/esporádica no uso real, mas isso é uma inferência sobre comportamento do usuário, não um fato confirmado pelo código (ver seção 14).

---

## 12. Casos de Uso Relacionados
- **UC-43 (Configurar Preferências de Notificação)** — os switches (`enable_expiry_alerts`, `enable_low_stock_alerts`) e o limite global (`low_stock_threshold`) lidos por este caso de uso são configurados lá; se o documento de configurações nunca foi criado com sucesso, este UC não verifica nada (fluxo 8b).
- **UC-15 (Configurar Limite de Estoque Baixo por Produto)** — o limite específico por `codigo_produto`, usado como primeira prioridade no fallback de `checkLowStock`, é configurado lá. UC-15 já referenciava este caso de uso (antes não mapeado) em sua seção 12 e RN-05.
- **UC-13 (Desativar Item de Estoque com Verificação de Reservas Ativas)** — itens desativados por aquele UC ainda são somados por `checkLowStock`/considerados por `checkExpiringProducts`/`checkExpiredProducts`, pois nenhuma das três funções filtra `active: true` (RN-03).
- **UC-44 (Consultar e Gerenciar Notificações Recebidas)** — via `NotificationBell`, header do `ClinicLayout`, é quem efetivamente exibe, marca como lida e permite excluir as notificações criadas por este caso de uso.

---

## 13. Referências
- `src/app/(clinic)/clinic/alerts/page.tsx` (re-exporta `AlertsTab`)
- `src/components/clinic/AlertsTab.tsx`
- `src/lib/services/alertTriggers.ts` (`checkExpiringProducts`, `checkExpiredProducts`, `checkLowStock`, `runAllChecks`, `runChecksForAllTenants`)
- `src/lib/services/notificationService.ts` (`getNotificationSettings`, `createExpiringProductNotification`, `createExpiredProductNotification`, `createLowStockNotification`)
- `src/types/notification.ts` (`NotificationType`, `NotificationSettings`)
- `firestore.rules` (linhas 65-86 — regras dedicadas de `notifications` e `settings/notifications`)
- `firestore.indexes.json` (sem índice composto dedicado declarado para `notifications`)
- `src/components/clinic/ClinicLayout.tsx` (`navLinks` — ausência de link para `/clinic/alerts`)
- `src/components/notifications/NotificationBell.tsx` e `src/hooks/useNotifications.ts` (consumidores reais das notificações geradas aqui)

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. **[Correção de escopo em relação à investigação original — resolvida em v1.1]** O pedido original descrevia `/clinic/alerts` como uma "tela de visualização/gestão dos alertas gerados". A leitura completa do código mostrou que **não é isso**: `AlertsTab` só dispara manualmente as funções de verificação e mostra contadores agregados do último disparo — quem lista, marca como lida e permite excluir notificações é o componente `NotificationBell`, agora mapeado em **UC-44 (Consultar e Gerenciar Notificações Recebidas)**.
2. **[Resolvido — commit `16877f1`]** RN-02 — `checkExpiredProducts` agora persiste de fato a notificação de produto vencido via novo helper `createExpiredProductNotification`, substituindo o placeholder que apenas lia a coleção sem gravar nada.
3. **[Achado não solicitado, requer decisão]** RN-06 — a rota `/clinic/alerts` não é acessível por nenhum link da aplicação. É intencional (feature "escondida"/em desenvolvimento) ou um item de navegação esquecido?
4. **[Observação]** RN-05 — como já registrado em UC-15, não há nenhum agendamento automático das verificações; toda a geração de alertas depende de um Clinic Admin acionar esta tela manualmente.
5. **[Observação]** Seção 11 (Frequência de Uso) não pôde ser estimada com confiança — depende de um comportamento de usuário não observável estaticamente no código.
6. **[Divergência marketing x produto, requer decisão]** RN-08 — a landing page promete "alertas automáticos de vencimento" com escalonamento "60/30/15 dias" (`sections-product.jsx`, linhas 96 e 99), mas o sistema real oferece apenas verificação manual (este UC) com um único limiar configurável (`expiry_warning_days`, UC-43). Duas opções não excludentes entre si foram identificadas, mas nenhuma foi escolhida por este documento: (a) implementar de fato a automação — uma Scheduled Function chamando `runChecksForAllTenants` (já existe, mas não é invocada por nada) — e o escalonamento de três estágios fixos 60/30/15 dias, para cumprir a promessa da landing page; ou (b) ajustar o texto da landing page para refletir o comportamento manual e o limiar único configurável hoje existentes. Decisão de produto pendente — não decidida aqui.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `AlertsTab.tsx`, `alertTriggers.ts` (as quatro funções de check e `runChecksForAllTenants`), `notificationService.ts`, `notification.ts`, `firestore.rules` e `firestore.indexes.json`, além de busca em toda a base de código por referências de navegação para `/clinic/alerts`. Corrigido o escopo assumido na investigação original: esta tela executa checks manuais, não é uma central de consulta/gestão de alertas (essa função real está no `NotificationBell`, não mapeado). Identificado bug confirmado em `checkExpiredProducts` (nunca persiste notificação real) e ausência de qualquer ponto de navegação da aplicação para esta rota. |
| 1.1 | 15/07/2026 | Guilherme Scandelari | Cross-reference: `NotificationBell` foi mapeado como UC-44 (Consultar e Gerenciar Notificações Recebidas); seção 12 e item 1 da seção 14 atualizados de "UC ainda não mapeado" para referência direta a UC-44. |
| 1.2 | 15/07/2026 | Guilherme Scandelari | Adicionada RN-08 documentando divergência confirmada entre a promessa da landing page (`sections-product.jsx`, módulo "Inventário inteligente", linhas 96 e 99 — "alertas automáticos de vencimento" e "60/30/15 dias") e o comportamento real (verificação 100% manual, limiar único `expiry_warning_days`), com referência cruzada a UC-43/RN-08. Adicionado item 6 na seção 14 registrando as duas opções de decisão de produto (automatizar vs. ajustar a landing page), sem decidir entre elas. Reconfirmada ausência de `onSchedule`/`pubsub.schedule` em `functions/src/`. |
| 1.3 | 20/07/2026 | Guilherme Scandelari | **Correção de bug (commit `16877f1`)**: RN-02 corrigido — novo helper `createExpiredProductNotification` (`notificationService.ts`) agora é chamado por `checkExpiredProducts` (`alertTriggers.ts`), substituindo o placeholder (`getDocs` comentado) que apenas incrementava o contador e logava, sem gravar nenhuma notificação real de produto vencido. Fluxo de Exceção 8c reescrito como histórico "[Corrigido]"; seções 4.1, 6 (passo 8), 9 (RN-02), 13 e 14 (item 2) atualizadas para refletir a correção. RN-08 (divergência marketing x produto) não é afetada por esta correção — a verificação continua 100% manual. |
