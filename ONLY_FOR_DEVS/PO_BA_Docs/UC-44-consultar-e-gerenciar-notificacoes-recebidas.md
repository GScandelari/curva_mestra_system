# UC-44: Consultar e Gerenciar Notificações Recebidas

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Notificações e Alertas
**Versão:** 1.2.0

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
    UC44 -.->|excluir restrito a\nclinic_admin na UI e no\nFirestore, ver RN-02| Firestore[(Firestore\ntenants/{tenantId}/notifications)]
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** e **Clinic User** — o componente `NotificationBell` é renderizado incondicionalmente em `ClinicLayout.tsx` (linha 81, fora de qualquer bloco `isAdmin`), idêntico para os dois roles na consulta/marcação como lida; desde o commit `eb12c91`, os controles de exclusão (individual e em lote) só são renderizados para `clinic_admin` (RN-02).

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
- **Marcar como lida** (clique na notificação ou em "Marcar todas como lidas"): o(s) documento(s) em `tenants/{tenantId}/notifications` recebem `read: true` e `read_at: Timestamp.now()`. O contador do badge (`unreadCount`) é recalculado automaticamente pelo listener em tempo real. Ação disponível para ambos os roles, sem alteração nesta correção.
- **Excluir uma notificação** (ícone de lixeira em cada item — **visível apenas para `clinic_admin` desde o commit `eb12c91`, RN-02, `[CORRIGIDO]`**): após confirmação via `confirm()` nativo do navegador ("Deseja realmente excluir esta notificação?" — adicionado no commit `2ddebd6`, RN-07), o documento é removido (`deleteDoc`) — ação irreversível. Mesmo padrão de confirmação nativa já usado por "Limpar notificações lidas".
- **Limpar notificações lidas** ("Limpar notificações lidas", só visível se `notifications.length > 0` **e o usuário for `clinic_admin`**, desde o commit `eb12c91`, RN-02, `[CORRIGIDO]`): após confirmação via `confirm()` nativo do navegador, todos os documentos com `read == true` do tenant são excluídos em lote (`writeBatch`).
- **Clique em uma notificação com `inventory_id` ou `request_id`**: navega para `/clinic/inventory/{inventory_id}` ou `/clinic/requests/{request_id}`, respectivamente, e marca a notificação como lida antes de navegar (se ainda não estava lida).

### 4.2 Falha (Garantias Mínimas)
- Se o listener (`onSnapshot`) falhar: erro é apenas registrado em `console.error`; a lista simplesmente não é atualizada, sem nenhum feedback visual ao usuário (fluxo 8c — **não coberto** pela correção do commit `eb12c91`, que trata apenas os quatro erros de ação abaixo).
- Se `markAsRead`, `markAllAsRead`, `deleteNotification` ou `deleteReadNotifications` lançarem exceção (ex.: permissão negada pela regra do Firestore): o hook `useNotifications` captura o erro e grava em um estado interno `error`; desde o commit `eb12c91`, `NotificationBell` lê esse estado em um `useEffect` e exibe um `toast({ variant: 'destructive' })` com a mensagem de erro (RN-01, `[CORRIGIDO]`) — a falha deixa de ser silenciosa para o usuário.

---

## 5. Gatilho (Trigger)
Usuário clica no ícone de sino no cabeçalho de qualquer página do Portal Clinic, abrindo o dropdown de notificações (`DropdownMenuTrigger`).

---

## 6. Fluxo Principal (Basic Flow)

1. Usuário está em qualquer página do Portal Clinic; o `ClinicLayout` já mantém, em segundo plano, um listener ativo (`onSnapshot`) sobre as 50 notificações mais recentes do tenant, atualizando `unreadCount` e exibindo um `Badge` numérico sobre o sino quando há notificações não lidas (99+ se ultrapassar 99).
2. Usuário clica no sino; o `DropdownMenuContent` abre, exibindo o cabeçalho "Notificações" e, se houver não lidas, o botão "Marcar todas como lidas".
3. Sistema lista as notificações em ordem decrescente de criação, cada uma com: ícone por tipo (`Clock` para vencimento, `Package` para estoque baixo, `Check`/`X`/`FileText` para solicitações, `AlertCircle` como padrão), título, mensagem (truncada a 2 linhas), tempo relativo (`formatDistanceToNow`, locale pt-BR) e badge "Novo" se não lida. O fundo da notificação varia por prioridade (`urgent`→vermelho, `high`→laranja, `medium`→amarelo, `low`→azul) ou azul fixo se não lida, independente da prioridade. O ícone de lixeira de cada item só é renderizado se `claims?.role === 'clinic_admin'` (`canDelete`, RN-02, `[CORRIGIDO]` no commit `eb12c91`).
4. Usuário (Clinic Admin ou Clinic User) clica em uma notificação: se não lida, é marcada como lida (`markAsRead`); em seguida, se a notificação tiver `inventory_id` ou `request_id`, o sistema navega para a tela correspondente e fecha o dropdown.
5. Alternativamente, **Clinic Admin** clica no ícone de lixeira de uma notificação específica (botão não existe na árvore de renderização para `clinic_user`, RN-02): sistema exibe uma confirmação nativa do navegador ("Deseja realmente excluir esta notificação?" — adicionada no commit `2ddebd6`, RN-07); se confirmado, a notificação é excluída (`deleteNotification`); se a exclusão falhar (ex.: erro de rede), um toast destructive é exibido com a mensagem de erro (RN-01).
6. Alternativamente, usuário (Clinic Admin ou Clinic User) clica em "Marcar todas como lidas": todas as notificações não lidas do tenant são marcadas como lidas em lote (`markAllAsRead` → `writeBatch`); falha, se houver, é exibida em toast destructive (RN-01).
7. Alternativamente, **Clinic Admin** clica em "Limpar notificações lidas" (rodapé do dropdown, só exibido se `notifications.length > 0` **e** `canDelete`, RN-02): após confirmar em um `confirm()` nativo do navegador, todas as notificações já lidas do tenant são excluídas em lote (`clearRead` → `deleteReadNotifications`); falha, se houver, é exibida em toast destructive (RN-01).
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

### 8b. Clinic User tenta excluir uma notificação ou limpar as lidas — histórico, `[CORRIGIDO]` no commit `eb12c91` e reforçado no Firestore no PR #344
1. **Antes da correção (`eb12c91`):** a regra do Firestore para `tenants/{tenantId}/notifications/{notificationId}` restringia `create, delete` a `request.auth.token.role == 'clinic_admin'` — um `clinic_user` não tinha permissão para excluir, apesar de o botão de lixeira e o "Limpar notificações lidas" estarem visíveis e habilitados para ambos os roles na interface. O SDK do Firestore rejeitava a operação com erro de permissão; o `catch` em `useNotifications` gravava a mensagem em seu estado interno `error`, mas `NotificationBell` nunca o lia (RN-01) — a notificação simplesmente não desaparecia da lista, sem qualquer explicação visível do motivo.
2. **Depois de `eb12c91`:** `NotificationBell` calcula `canDelete = claims?.role === 'clinic_admin'` e só renderiza o ícone de lixeira individual e o bloco de "Limpar notificações lidas" quando `canDelete` é verdadeiro (RN-02) — um `clinic_user` deixa de ver esses controles, então este cenário não ocorre mais pela UI padrão. Se a mesma chamada fosse feita fora da UI (ex.: manipulando o client diretamente), até o PR #344 a regra do Firestore **não** rejeitava de fato essa tentativa: a regra genérica de subcoleção do tenant já permitia a operação a qualquer usuário do tenant via semântica OR, tornando a regra dedicada de `delete` inefetiva (ver ressalva histórica em RN-02, seção 9).
3. **[CORRIGIDO — PR #344]** A regra genérica deixou de conceder `write` a qualquer subcoleção do tenant; a regra dedicada de `delete` restrito a `clinic_admin` em `notifications` passou a ser o único caminho de escrita efetivo. Um `clinic_user` que tentasse excluir uma notificação chamando o Firestore diretamente, fora da UI, agora é de fato rejeitado pela regra — não apenas pela ausência do botão.

### 8c. Listener perde conexão ou lança erro (a partir do passo 1)
1. O callback de erro de `onSnapshot` é acionado.
2. Erro é apenas registrado via `console.error('Erro no listener de notificações:', error)`; nenhum estado de erro é propagado, nenhuma UI de erro é exibida. **Não coberto pela correção do commit `eb12c91`** — o `useEffect` que exibe toast em `NotificationBell` observa apenas o estado `error` do hook, que só é setado pelas quatro ações (`markAsRead`, `markAllAsRead`, `deleteNotification`, `deleteReadNotifications`), nunca pelo callback de erro do listener.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[CORRIGIDO no commit `eb12c91` — UC-44-RN-01]** Antes: o hook `useNotifications` expunha um estado `error` (setado em falhas de `markAsRead`, `markAllAsRead`, `deleteNotification`, `deleteReadNotifications`), mas o componente `NotificationBell` desestruturava apenas `notifications, loading, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearRead` — **nunca `error`**. Toda falha nessas quatro ações era, portanto, invisível ao usuário. Agora: `NotificationBell` importa `useToast`, desestrutura `error` de `useNotifications(...)` e usa um `useEffect` (`[error, toast]`) que dispara `toast({ title: error, variant: 'destructive' })` sempre que `error` muda. Falhas do listener (`onSnapshot`, fluxo 8c) continuam fora do escopo desta correção, pois nunca setam o estado `error` do hook. | Correção confirmada por leitura do commit `eb12c91` (`src/components/notifications/NotificationBell.tsx`) — import de `useToast`, `error` desestruturado do hook, novo `useEffect` disparando o toast. |
| RN-02 | **[CORRIGIDO no commit `eb12c91`, reforçado no Firestore no PR #344 — UC-44-RN-02]** Antes: a regra do Firestore (`firestore.rules`, linhas 65-74) restringia `delete` em `tenants/{tenantId}/notifications/{notificationId}` a `role == 'clinic_admin'`, mas a UI (`NotificationBell`) exibia o botão de exclusão individual e "Limpar notificações lidas" identicamente para `clinic_admin` e `clinic_user` (nenhum gate de role no componente) — um `clinic_user` que tentasse excluir sofria uma falha de permissão silenciosa (ver 8b, histórico). O commit `eb12c91` alinhou a UI à regra: `NotificationBell` declarou `const canDelete = claims?.role === 'clinic_admin'` e passou a condicionar a renderização do botão de exclusão individual e do bloco "Limpar notificações lidas" a esse valor. **[CORRIGIDO de verdade no Firestore — PR #344, commits `f3ce046` + `94cbe2e`, branch `bugfix/firestore-rules-tenant-role-enforcement`, mergeado em `gscandelari_setup`, deploy confirmado em `curva-mestra-dev`]**: até esse PR, a regra dedicada de `delete` restrito a `clinic_admin`, embora presente no arquivo, era inefetiva na prática — a regra genérica de subcoleção do tenant (`tenants/{tenantId}/{document=**}`) concedia a mesma operação a qualquer usuário do tenant via semântica OR do Firestore. Corrigido: a regra genérica passou a usar `match /tenants/{tenantId}/{collectionId}/{document=**}` e deixou de conceder `write` a qualquer subcoleção — a regra dedicada de `delete` em `notifications`, que já existia e não precisou de nenhuma alteração própria, agora é o único caminho de escrita possível. Um `clinic_user` não consegue mais excluir uma notificação chamando a API do Firestore diretamente, mesmo contornando a UI. | Correção de UI confirmada por leitura do commit `eb12c91` (`NotificationBell.tsx`) — `canDelete` declarado a partir de `claims?.role`. Correção de regra confirmada por leitura de `firestore.rules` pós-deploy do PR #344 — regra genérica de subcoleção sem `write`, regra dedicada de `notifications` (`delete` restrito a `clinic_admin`) agora efetiva; cross-referência com UC-13/RN-09 (detalhamento técnico completo da história do fix em duas etapas). |
| RN-03 | **[Achado, não afeta este UC diretamente]** Os tipos `request_approved` e `request_rejected` têm funções auxiliares completas e prontas em `notificationService.ts` (`createRequestApprovedNotification`, `createRequestRejectedNotification`, com ícone próprio já implementado em `NotificationBell`), mas **nenhum ponto do código as chama** — são funções mortas. Da mesma forma, os tipos `request_created` e `new_user` nunca têm nenhuma notificação criada em todo o código-fonte. Na prática, apenas `expiring`/`expired`/`low_stock` (UC-42) e `consultant_linked` (2 pontos de chamada) geram notificações reais hoje. | Confirmado por busca exaustiva em `src/` por chamadas às funções `create*Notification` e pelos literais de `type:` usados em `createNotification`/`writeBatch`/`addDoc` na coleção `notifications`. |
| RN-04 | O som de notificação (`playSound`) é passado como `true` fixo pelo `ClinicLayout` (`<NotificationBell playSound={true} />`) — não há nenhuma opção na interface para o usuário desabilitá-lo por conta própria; o campo `notification_sound` de `NotificationSettings` (UC-43) existe no tipo e no formulário de preferências, mas **não é lido em nenhum lugar por `NotificationBell`/`useNotifications`** para controlar o som. | Confirmado por leitura de `ClinicLayout.tsx` (linha 81, prop fixa) e por busca por `notification_sound` em todo `src/` — só aparece em `notification.ts` (tipo) e `ClinicSettingsPage` (formulário de UC-43), nunca lido por `useNotifications`. |
| RN-05 | O listener sempre busca as 50 notificações mais recentes (`limit(50)`), sem paginação — notificações além desse limite nunca aparecem no sino, mesmo que não lidas. | Confirmado por leitura literal de `subscribeToNotifications` (`query(notificationsRef, orderBy('created_at', 'desc'), limit(50))`). |
| RN-06 | Multi-tenant: toda consulta, escuta e escrita de notificações é escopada por `tenants/{tenantId}/notifications`, tanto no client (`tenantId` vindo de `claims.tenant_id`) quanto na regra dedicada do Firestore (`belongsToTenant(tenantId)`). Um usuário nunca vê notificações de outro tenant. | Confirmado por leitura de `useNotifications.ts`, `notificationService.ts` e `firestore.rules`. |
| RN-07 | **[Corrigido no commit `2ddebd6` — UC-44-RN-07]** A exclusão de uma notificação individual agora exige confirmação antes de excluir — `handleDelete` (`src/components/notifications/NotificationBell.tsx`) passou a envolver `await deleteNotification(notificationId)` em `if (confirm('Deseja realmente excluir esta notificação?')) { ... }`, mesmo padrão nativo (`confirm()`) já usado por `handleClearAll` no mesmo componente para a limpeza em lote. Não foi adotado um `AlertDialog`/toast neste ciclo — manteve-se consistência com o padrão nativo já existente nesse componente específico. | Confirmado por leitura literal de `handleDelete` — a chamada a `deleteNotification` agora está dentro do bloco condicional de confirmação, idêntico em estrutura ao de `handleClearAll`. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Atualização em tempo real via `onSnapshot`, sem necessidade de refresh manual ou polling. | Desempenho / UX |
| RNF-02 | **[Parcialmente mitigado no commit `eb12c91`]** Falhas das quatro ações de escrita (`markAsRead`, `markAllAsRead`, `deleteNotification`, `deleteReadNotifications`) agora são exibidas ao usuário via toast destructive (RN-01, `[CORRIGIDO]`). Falhas do listener em tempo real (`onSnapshot`, fluxo 8c) continuam inteiramente silenciosas — risco de suporte residual, já que o usuário não recebe nenhuma pista caso a lista pare de atualizar. | Usabilidade |
| RNF-03 | Multi-tenant garantido tanto no client quanto por regra dedicada do Firestore (RN-06). | Multi-tenant / Segurança |
| RNF-04 | Limite fixo de 50 notificações exibidas, sem paginação (RN-05). | Escalabilidade |

---

## 11. Frequência de Uso
Alta — o sino é visível em todas as páginas do Portal Clinic e é o único ponto de consulta de notificações do sistema; o `unreadCount` no badge é o principal sinal visual de que algo requer atenção.

---

## 12. Casos de Uso Relacionados
- **UC-42 (Executar Verificações de Alertas Manualmente)** — é o gerador confirmado das notificações dos tipos `expiring`, `expired` (nominalmente — ver bug de RN-02 daquele UC) e `low_stock` consumidas aqui. Esta é a "central de alertas" real que a investigação original atribuía erroneamente a `/clinic/alerts`. Mesma correção de regra do Firestore aplicada em conjunto (RN-02 deste UC / UC-42/RN-01, PR #344).
- **UC-43 (Configurar Preferências de Notificação)** — define, entre outros campos, `notification_sound`, mas esse campo **não** controla o som tocado por este UC (RN-04) — divergência confirmada, não relação funcional real.
- Notificações do tipo `consultant_linked` são geradas por fluxos já cobertos em outros módulos (`api/consultants/claims/route.ts`, `api/consultants/transfer-requests/[id]/approve/route.ts`) — consumidas aqui sem alteração de escopo.

---

## 13. Referências
- `src/components/notifications/NotificationBell.tsx` (`handleDelete` — confirmação nativa, RN-07; `canDelete` e `useEffect` de toast — RN-01/RN-02, commit `eb12c91`)
- `src/hooks/useNotifications.ts`
- `src/hooks/use-toast.ts` (`useToast`, consumido por `NotificationBell` desde o commit `eb12c91`, RN-01)
- `src/lib/services/notificationService.ts` (`subscribeToNotifications`, `markAsRead`, `markAllAsRead`, `deleteNotification`, `deleteReadNotifications`, `getNotificationStats`)
- `src/types/notification.ts` (`Notification`, `NotificationType`, `NotificationPriority`)
- `src/components/clinic/ClinicLayout.tsx` (montagem do componente, linha 81)
- `firestore.rules` (regra genérica de subcoleção do tenant agora `tenants/{tenantId}/{collectionId}/{document=**}`, sem `write`; regra dedicada de `tenants/{tenantId}/notifications` — `delete` restrito a `clinic_admin` — agora efetiva de verdade, RN-02, corrigido no PR #344, commits `f3ce046`/`94cbe2e`)
- Commit `2ddebd6` (`fix: terceiro lote de correções de baixa severidade (UC-32, UC-38, UC-41, UC-44)`) — `handleDelete` passa a exigir confirmação nativa antes de excluir uma notificação individual (RN-07)
- Commit `eb12c91` (`fix: dois itens de alta severidade (UC-40, UC-44)`) — `NotificationBell` passa a ler `error` do hook e exibir toast (RN-01); botões de exclusão individual e "Limpar notificações lidas" passam a só renderizar para `clinic_admin` (RN-02)

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto/bugs pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. **[RESOLVIDO no commit `eb12c91` — RN-01/RN-02]** `clinic_user` não conseguia excluir notificações (bloqueado pela regra do Firestore), mas a interface não escondia nem desabilitava os botões correspondentes para esse role, e a falha resultante era totalmente silenciosa. Decisão tomada: a UI passou a ocultar os botões de exclusão (individual e "Limpar notificações lidas") para `clinic_user` (`canDelete`, RN-02), em vez de relaxar a regra do Firestore.
2. **[RESOLVIDO parcialmente no commit `eb12c91` — RN-01]** O hook já capturava erros de todas as ações, mas o componente não os exibia. Agora `error` está conectado a um toast destructive para as quatro ações de escrita. Ressalva: falhas do listener em tempo real (`onSnapshot`, fluxo 8c) continuam sem nenhum feedback ao usuário — fora do escopo desta correção.
3. **[Achado, requer decisão]** RN-03 — `createRequestApprovedNotification`/`createRequestRejectedNotification` existem e têm ícone próprio pronto no `NotificationBell`, mas nunca são chamadas. É uma funcionalidade planejada e não finalizada, ou código morto a remover?
4. **[Achado, requer decisão]** RN-04 — o campo `notification_sound` de UC-43 não tem nenhum efeito real sobre o som deste componente. Deveria ser conectado, ou o campo do formulário de preferências deveria deixar de existir?
5. **[Observação, sem ação sugerida]** RN-05 — limite fixo de 50 notificações sem paginação; comportamento aceitável para o volume atual ou vale reavaliar no futuro?
6. **[RESOLVIDO em v1.2.0 — PR #344, commits `f3ce046`/`94cbe2e`]** A regra dedicada de RN-02 (`delete` restrito a `clinic_admin`), antes inefetiva na prática por causa da regra genérica de subcoleção do tenant, passou a ser efetiva de verdade: a regra genérica deixou de conceder `write`, e a regra dedicada de `notifications` (inalterada, já existia) agora é o único caminho de escrita possível. Este achado estava registrado com severidade Alta no mapa de bugs (`_MAPA-DE-BUGS-E-MELHORIAS.md`, UC-13-RN-09/UC-15-RN-07) e foi corrigido em conjunto com UC-13/RN-09, UC-15/RN-07, UC-20/RN-07, UC-42/RN-01 e UC-43/RN-07.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `NotificationBell.tsx`, `useNotifications.ts`, `notificationService.ts` (funções de leitura/escrita de notificações), `notification.ts`, `ClinicLayout.tsx` e `firestore.rules` (regra de `tenants/{tenantId}/notifications`). Mapeia o componente que, segundo achado registrado em UC-42/UC-43, é a real "central de alertas" do sistema (não `/clinic/alerts`). Identificados dois bugs confirmados: falhas de permissão/listener são inteiramente silenciosas para o usuário (RN-01), e a regra do Firestore restringe exclusão a `clinic_admin` enquanto a UI expõe os botões de exclusão identicamente para `clinic_user` (RN-02). Também confirmado que `createRequestApprovedNotification`/`createRequestRejectedNotification` são código morto (RN-03) e que `notification_sound` (UC-43) não controla o som real tocado aqui (RN-04). |
| 1.0.1 | 18/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-44-RN-07): `handleDelete` (`src/components/notifications/NotificationBell.tsx`) passou a envolver `await deleteNotification(notificationId)` em `if (confirm('Deseja realmente excluir esta notificação?')) { ... }` — corrigido no commit `2ddebd6`, alinhando a exclusão individual ao mesmo padrão de confirmação nativa já usado por "Limpar notificações lidas" (`handleClearAll`). Atualizados Pós-condição 4.1, Fluxo Principal (passo 5), RN-07 (marcado `[Corrigido]`) e referências (Seção 13). |
| 1.1 | 19/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | RN-01 e RN-02 marcadas como `[CORRIGIDO]`, citando o commit `eb12c91` ("fix: dois itens de alta severidade (UC-40, UC-44)"). RN-01: `NotificationBell` passou a importar `useToast`, desestruturar `error` de `useNotifications` e exibir `toast({ variant: 'destructive' })` sempre que uma das quatro ações de escrita falha — falhas do listener em tempo real (fluxo 8c) permanecem fora do escopo desta correção. RN-02: novo `canDelete = claims?.role === 'clinic_admin'` passou a condicionar a renderização do botão de exclusão individual e do bloco "Limpar notificações lidas", alinhando a UI à regra do Firestore que já restringia `delete` a esse role — `clinic_user` deixa de ver controles que sempre falhavam. Seções 2.1, 4.1, 4.2, 6 (passos 3, 5, 6, 7), 8b (reescrito como histórico/corrigido), 8c (nota de escopo), 9 (RN-01, RN-02), 10 (RNF-02), 13 (referências) e 14 (itens 1 e 2, marcados RESOLVIDO) atualizadas de acordo. Diagrama (Seção 1) ajustado para refletir a restrição de exclusão a `clinic_admin`. |
| 1.1.1 | 25/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Ressalva de precisão factual, sem correção de código.** RN-02 (seção 9) e o fluxo de exceção 8b passaram a deixar explícito que a regra dedicada de `delete` restrito a `clinic_admin` (`firestore.rules`, linhas 65-74), embora exista no arquivo e não tenha sido alterada, é hoje **inefetiva na prática**: a regra genérica de subcoleção do tenant (`tenants/{tenantId}/{document=**}`, linhas 58-67) já concede a mesma operação a qualquer usuário do tenant via semântica OR do Firestore (regras que casam o mesmo caminho são combinadas com OR, não com "mais específica vence") — um `clinic_user` poderia, tecnicamente, excluir uma notificação chamando a API do Firestore diretamente. A proteção real hoje é apenas o gate de UI (`canDelete`). Achado cross-referenciado com o item de severidade Alta consolidado no mapa de bugs (UC-13-RN-09/UC-15-RN-07), com correção adiada. Adicionado item 6 na seção 14 e referência a `firestore.rules` linhas 58-67 na seção 13. |
| 1.2.0 | 02/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Correção de segurança real implementada e mergeada (PR #344, branch `bugfix/firestore-rules-tenant-role-enforcement`, commits `f3ce046` + `94cbe2e`, deploy confirmado em `curva-mestra-dev`)**: RN-02 passou de "ressalva de inefetividade" para **[CORRIGIDO]** — a regra genérica de subcoleção do tenant deixou de conceder `write` e mudou de `match /tenants/{tenantId}/{document=**}` para `match /tenants/{tenantId}/{collectionId}/{document=**}`; a regra dedicada de `delete` em `notifications` (restrita a `clinic_admin`), que já existia sem alteração própria, passou a ser o único caminho de escrita efetivo. Fluxo de Exceção 8b reescrito com um terceiro passo confirmando a correção no Firestore. RN-02 (seção 9), item 6 da seção 14, e seções 12/13 atualizados de acordo. Mesma correção aplicada em conjunto a UC-13/RN-09, UC-15/RN-07, UC-20/RN-07, UC-42/RN-01 e UC-43/RN-07. |
