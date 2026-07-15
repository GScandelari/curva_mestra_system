# UC-44: Consultar e Gerenciar Notificações Recebidas

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Notificações e Alertas
**Versão:** 1.0

> Um usuário da clínica (Clinic Admin ou Clinic User) consulta, em tempo real, as notificações recebidas através do sino (`NotificationBell`) no cabeçalho do layout de clínica: visualiza a lista das 50 mais recentes, marca uma ou todas como lidas, exclui uma notificação individual, limpa as já lidas em lote, e é redirecionado ao item relacionado (inventário ou solicitação) ao clicar. É este componente — não a tela `/clinic/alerts` (UC-42) — que efetivamente exibe e gerencia as notificações geradas pelo sistema (UC-42 e outros pontos do código, ver seção 9).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    ClinicUser([👤 Clinic User])

    subgraph Sistema["Curva Mestra"]
        UC44(("UC-44\nConsultar e Gerenciar\nNotificações Recebidas"))
        UC42(("UC-42\nExecutar Verificações\nde Alertas Manualmente"))
    end

    ClinicAdmin --> UC44
    ClinicUser --> UC44
    UC42 -.->|gera notificações\nconsumidas por| UC44
    UC44 -.->|marcar lida/excluir\nfalha silenciosamente para\nclinic_user, ver RN-02| Firestore[(Firestore\ntenants/{tenantId}/notifications)]
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** e **Clinic User** — o componente `NotificationBell` é renderizado incondicionalmente em `ClinicLayout.tsx` (linha 81, fora de qualquer bloco `isAdmin`), idêntico para os dois roles, sem nenhuma diferenciação de comportamento na interface.

### 2.2 Atores Secundários / Sistemas Externos
- **Firestore (listener em tempo real)** — `subscribeToNotifications` usa `onSnapshot` sobre `tenants/{tenantId}/notifications`, ordenado por `created_at desc`, limitado a 50 documentos.
- Geradores de notificação (não são atores deste UC, apenas produzem os dados consumidos aqui): UC-42 (`expiring`, `expired`, `low_stock`), e dois pontos de código que criam notificações do tipo `consultant_linked` (`api/consultants/claims/route.ts` e `api/consultants/transfer-requests/[id]/approve/route.ts`).

---

## 3. Pré-condições
- Usuário autenticado com `tenant_id` definido nos custom claims (`claims?.tenant_id`); se ausente, o hook `useNotifications` não inicia o listener (`loading` permanece controlado, lista vazia).
- Está em uma página que renderiza `ClinicLayout` (todo o Portal Clinic).

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- **Marcar como lida** (clique na notificação ou em "Marcar todas como lidas"): o(s) documento(s) em `tenants/{tenantId}/notifications` recebem `read: true` e `read_at: Timestamp.now()`. O contador do badge (`unreadCount`) é recalculado automaticamente pelo listener em tempo real.
- **Excluir uma notificação** (ícone de lixeira em cada item): o documento é removido (`deleteDoc`) — ação irreversível, sem confirmação.
- **Limpar notificações lidas** ("Limpar notificações lidas", só visível se `notifications.length > 0`): após confirmação via `confirm()` nativo do navegador, todos os documentos com `read == true` do tenant são excluídos em lote (`writeBatch`).
- **Clique em uma notificação com `inventory_id` ou `request_id`**: navega para `/clinic/inventory/{inventory_id}` ou `/clinic/requests/{request_id}`, respectivamente, e marca a notificação como lida antes de navegar (se ainda não estava lida).

### 4.2 Falha (Garantias Mínimas)
- Se o listener (`onSnapshot`) falhar: erro é apenas registrado em `console.error`; a lista simplesmente não é atualizada, sem nenhum feedback visual ao usuário.
- Se `markAsRead`, `markAllAsRead`, `deleteNotification` ou `deleteReadNotifications` lançarem exceção (ex.: permissão negada pela regra do Firestore — ver RN-02): o hook `useNotifications` captura o erro e grava em um estado interno `error`, mas **o componente `NotificationBell` nunca lê nem exibe esse estado** — a falha é completamente silenciosa para o usuário (RN-01).

---

## 5. Gatilho (Trigger)
Usuário clica no ícone de sino no cabeçalho de qualquer página do Portal Clinic, abrindo o dropdown de notificações (`DropdownMenuTrigger`).

---

## 6. Fluxo Principal (Basic Flow)

1. Usuário está em qualquer página do Portal Clinic; o `ClinicLayout` já mantém, em segundo plano, um listener ativo (`onSnapshot`) sobre as 50 notificações mais recentes do tenant, atualizando `unreadCount` e exibindo um `Badge` numérico sobre o sino quando há notificações não lidas (99+ se ultrapassar 99).
2. Usuário clica no sino; o `DropdownMenuContent` abre, exibindo o cabeçalho "Notificações" e, se houver não lidas, o botão "Marcar todas como lidas".
3. Sistema lista as notificações em ordem decrescente de criação, cada uma com: ícone por tipo (`Clock` para vencimento, `Package` para estoque baixo, `Check`/`X`/`FileText` para solicitações, `AlertCircle` como padrão), título, mensagem (truncada a 2 linhas), tempo relativo (`formatDistanceToNow`, locale pt-BR) e badge "Novo" se não lida. O fundo da notificação varia por prioridade (`urgent`→vermelho, `high`→laranja, `medium`→amarelo, `low`→azul) ou azul fixo se não lida, independente da prioridade.
4. Usuário clica em uma notificação: se não lida, é marcada como lida (`markAsRead`); em seguida, se a notificação tiver `inventory_id` ou `request_id`, o sistema navega para a tela correspondente e fecha o dropdown.
5. Alternativamente, usuário clica no ícone de lixeira de uma notificação específica (sem abrir/navegar): a notificação é excluída (`deleteNotification`), sem confirmação.
6. Alternativamente, usuário clica em "Marcar todas como lidas": todas as notificações não lidas do tenant são marcadas como lidas em lote (`markAllAsRead` → `writeBatch`).
7. Alternativamente, usuário clica em "Limpar notificações lidas" (rodapé do dropdown, só exibido se `notifications.length > 0`): após confirmar em um `confirm()` nativo do navegador, todas as notificações já lidas do tenant são excluídas em lote (`clearRead` → `deleteReadNotifications`).
8. Caso de uso é concluído a qualquer momento em que o usuário fecha o dropdown (clique fora, ou após navegação no passo 4).

---

## 7. Fluxos Alternativos

### 7a. Nenhuma notificação existente (a partir do passo 3)
1. `notifications.length === 0`.
2. Sistema exibe um estado vazio: ícone de sino cinza, texto "Nenhuma notificação". O rodapé "Limpar notificações lidas" não é exibido.

### 7b. Carregamento inicial (a partir do passo 2)
1. Enquanto `loading === true` (antes do primeiro retorno do listener), o sistema exibe 3 blocos de skeleton (`Skeleton`) no lugar da lista.

### 7c. Nova notificação chega com o dropdown fechado
1. O listener em tempo real atualiza `unreadCount` e a lista independentemente do dropdown estar aberto.
2. Se `playSound` estiver habilitado (`true` por padrão, fixo — não configurável pelo usuário nesta tela; ver RN-04) e o número de não lidas aumentar em relação ao valor anterior, um som curto é tocado via Web Audio API (`oscillator`, 800Hz, 0.5s).

---

## 8. Fluxos de Exceção

### 8a. `tenantId` ausente (a partir do passo 1)
1. `claims?.tenant_id` é `null`/`undefined`.
2. O hook `useNotifications` encerra `loading` como `false` sem iniciar o listener; a lista permanece vazia, sem mensagem de erro específica (mesmo comportamento visual do fluxo 7a).

### 8b. Clinic User tenta excluir uma notificação ou limpar as lidas (a partir dos passos 5, 6 ou 7)
1. A regra do Firestore para `tenants/{tenantId}/notifications/{notificationId}` restringe `create, delete` a `request.auth.token.role == 'clinic_admin'` — um `clinic_user` não tem permissão para excluir, apesar do botão de lixeira e do "Limpar notificações lidas" estarem visíveis e habilitados para ambos os roles na interface.
2. O SDK do Firestore rejeita a operação com erro de permissão; o `catch` em `useNotifications` grava a mensagem em seu estado interno `error`.
3. **[Bug confirmado — RN-01]** Como `NotificationBell` nunca lê `error`, nenhuma mensagem é exibida ao `clinic_user` — a notificação simplesmente não desaparece da lista, sem qualquer explicação visível do motivo.

### 8c. Listener perde conexão ou lança erro (a partir do passo 1)
1. O callback de erro de `onSnapshot` é acionado.
2. Erro é apenas registrado via `console.error('Erro no listener de notificações:', error)`; nenhum estado de erro é propagado, nenhuma UI de erro é exibida.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Bug confirmado]** O hook `useNotifications` expõe um estado `error` (setado em falhas de `markAsRead`, `markAllAsRead`, `deleteNotification`, `deleteReadNotifications`), mas o componente `NotificationBell` desestrutura apenas `notifications, loading, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearRead` — **nunca `error`**. Toda falha nessas quatro ações é, portanto, invisível ao usuário. | Confirmado por leitura literal de `NotificationBell.tsx` (linhas 38-49, sem `error` na desestruturação) comparada à interface `UseNotificationsReturn` em `useNotifications.ts`, que declara `error: string \| null`. |
| RN-02 | **[Bug confirmado, consequência direta de RN-01]** A regra do Firestore (`firestore.rules`, linhas 64-74) restringe `delete` em `tenants/{tenantId}/notifications/{notificationId}` a `role == 'clinic_admin'`, mas a UI (`NotificationBell`) exibe o botão de exclusão individual e "Limpar notificações lidas" identicamente para `clinic_admin` e `clinic_user` (nenhum gate de role no componente). Um `clinic_user` que tentar excluir sofre uma falha de permissão silenciosa (ver 8b), sem nenhuma indicação de que a ação não é permitida para seu role. | Confirmado por leitura de `firestore.rules` (linhas 65-74: `allow read, update: if belongsToTenant(tenantId)`; `allow create, delete: if belongsToTenant(tenantId) && request.auth.token.role == 'clinic_admin'`) comparada a `NotificationBell.tsx` (nenhuma checagem de `claims?.role` antes de renderizar os botões de exclusão). |
| RN-03 | **[Achado, não afeta este UC diretamente]** Os tipos `request_approved` e `request_rejected` têm funções auxiliares completas e prontas em `notificationService.ts` (`createRequestApprovedNotification`, `createRequestRejectedNotification`, com ícone próprio já implementado em `NotificationBell`), mas **nenhum ponto do código as chama** — são funções mortas. Da mesma forma, os tipos `request_created` e `new_user` nunca têm nenhuma notificação criada em todo o código-fonte. Na prática, apenas `expiring`/`expired`/`low_stock` (UC-42) e `consultant_linked` (2 pontos de chamada) geram notificações reais hoje. | Confirmado por busca exaustiva em `src/` por chamadas às funções `create*Notification` e pelos literais de `type:` usados em `createNotification`/`writeBatch`/`addDoc` na coleção `notifications`. |
| RN-04 | O som de notificação (`playSound`) é passado como `true` fixo pelo `ClinicLayout` (`<NotificationBell playSound={true} />`) — não há nenhuma opção na interface para o usuário desabilitá-lo por conta própria; o campo `notification_sound` de `NotificationSettings` (UC-43) existe no tipo e no formulário de preferências, mas **não é lido em nenhum lugar por `NotificationBell`/`useNotifications`** para controlar o som. | Confirmado por leitura de `ClinicLayout.tsx` (linha 81, prop fixa) e por busca por `notification_sound` em todo `src/` — só aparece em `notification.ts` (tipo) e `ClinicSettingsPage` (formulário de UC-43), nunca lido por `useNotifications`. |
| RN-05 | O listener sempre busca as 50 notificações mais recentes (`limit(50)`), sem paginação — notificações além desse limite nunca aparecem no sino, mesmo que não lidas. | Confirmado por leitura literal de `subscribeToNotifications` (`query(notificationsRef, orderBy('created_at', 'desc'), limit(50))`). |
| RN-06 | Multi-tenant: toda consulta, escuta e escrita de notificações é escopada por `tenants/{tenantId}/notifications`, tanto no client (`tenantId` vindo de `claims.tenant_id`) quanto na regra dedicada do Firestore (`belongsToTenant(tenantId)`). Um usuário nunca vê notificações de outro tenant. | Confirmado por leitura de `useNotifications.ts`, `notificationService.ts` e `firestore.rules` (linhas 65-74). |
| RN-07 | A exclusão de uma notificação individual (passo 5) não exige confirmação (`confirm()` ou modal), diferente de "Limpar notificações lidas" (passo 7), que exige confirmação nativa do navegador antes de excluir em lote. | Confirmado por leitura de `handleDelete` (chama `deleteNotification` diretamente) vs. `handleClearAll` (envolve a chamada em `if (confirm(...))`). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Atualização em tempo real via `onSnapshot`, sem necessidade de refresh manual ou polling. | Desempenho / UX |
| RNF-02 | Falhas de permissão e de listener são inteiramente silenciosas para o usuário final (RN-01, 8c) — risco de suporte, já que o usuário não recebe nenhuma pista do motivo de uma ação não ter efeito. | Usabilidade |
| RNF-03 | Multi-tenant garantido tanto no client quanto por regra dedicada do Firestore (RN-06). | Multi-tenant / Segurança |
| RNF-04 | Limite fixo de 50 notificações exibidas, sem paginação (RN-05). | Escalabilidade |

---

## 11. Frequência de Uso
Alta — o sino é visível em todas as páginas do Portal Clinic e é o único ponto de consulta de notificações do sistema; o `unreadCount` no badge é o principal sinal visual de que algo requer atenção.

---

## 12. Casos de Uso Relacionados
- **UC-42 (Executar Verificações de Alertas Manualmente)** — é o gerador confirmado das notificações dos tipos `expiring`, `expired` (nominalmente — ver bug de RN-02 daquele UC) e `low_stock` consumidas aqui. Esta é a "central de alertas" real que a investigação original atribuía erroneamente a `/clinic/alerts`.
- **UC-43 (Configurar Preferências de Notificação)** — define, entre outros campos, `notification_sound`, mas esse campo **não** controla o som tocado por este UC (RN-04) — divergência confirmada, não relação funcional real.
- Notificações do tipo `consultant_linked` são geradas por fluxos já cobertos em outros módulos (`api/consultants/claims/route.ts`, `api/consultants/transfer-requests/[id]/approve/route.ts`) — consumidas aqui sem alteração de escopo.

---

## 13. Referências
- `src/components/notifications/NotificationBell.tsx`
- `src/hooks/useNotifications.ts`
- `src/lib/services/notificationService.ts` (`subscribeToNotifications`, `markAsRead`, `markAllAsRead`, `deleteNotification`, `deleteReadNotifications`, `getNotificationStats`)
- `src/types/notification.ts` (`Notification`, `NotificationType`, `NotificationPriority`)
- `src/components/clinic/ClinicLayout.tsx` (montagem do componente, linha 81)
- `firestore.rules` (linhas 65-74 — regra dedicada de `tenants/{tenantId}/notifications`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto/bugs pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. **[Bug confirmado, prioridade sugerida alta — UX]** RN-01/RN-02 — `clinic_user` não consegue excluir notificações (bloqueado pela regra do Firestore), mas a interface não esconde nem desabilita os botões correspondentes para esse role, e a falha resultante é totalmente silenciosa. Deveria a UI ocultar/desabilitar esses botões para `clinic_user`, ou a regra deveria ser relaxada para permitir exclusão por qualquer usuário do tenant?
2. **[Achado, requer decisão]** RN-01 (geral) — o hook já captura erros de todas as ações, mas o componente não os exibe. Vale conectar `error` a um toast ou alerta visível?
3. **[Achado, requer decisão]** RN-03 — `createRequestApprovedNotification`/`createRequestRejectedNotification` existem e têm ícone próprio pronto no `NotificationBell`, mas nunca são chamadas. É uma funcionalidade planejada e não finalizada, ou código morto a remover?
4. **[Achado, requer decisão]** RN-04 — o campo `notification_sound` de UC-43 não tem nenhum efeito real sobre o som deste componente. Deveria ser conectado, ou o campo do formulário de preferências deveria deixar de existir?
5. **[Observação, sem ação sugerida]** RN-05 — limite fixo de 50 notificações sem paginação; comportamento aceitável para o volume atual ou vale reavaliar no futuro?

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `NotificationBell.tsx`, `useNotifications.ts`, `notificationService.ts` (funções de leitura/escrita de notificações), `notification.ts`, `ClinicLayout.tsx` e `firestore.rules` (regra de `tenants/{tenantId}/notifications`). Mapeia o componente que, segundo achado registrado em UC-42/UC-43, é a real "central de alertas" do sistema (não `/clinic/alerts`). Identificados dois bugs confirmados: falhas de permissão/listener são inteiramente silenciosas para o usuário (RN-01), e a regra do Firestore restringe exclusão a `clinic_admin` enquanto a UI expõe os botões de exclusão identicamente para `clinic_user` (RN-02). Também confirmado que `createRequestApprovedNotification`/`createRequestRejectedNotification` são código morto (RN-03) e que `notification_sound` (UC-43) não controla o som real tocado aqui (RN-04). |
