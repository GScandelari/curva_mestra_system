# UC-54: Convidar Consultor para a Clínica

**Projeto:** Curva Mestra
**Data de Criação:** 13/08/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Gestão de Clínica / Consultores
**Versão:** 1.1

> Uma clínica sem consultor vinculado (`clinic_admin`) busca um consultor pelo código de 6 dígitos e envia um convite de vínculo. O consultor convidado aceita ou recusa em `/consultant/transfer-requests` (UC-26/UC-27); a clínica pode cancelar o convite enquanto ele estiver pendente; e o convite expira automaticamente em 15 dias se ninguém agir. Substitui a antiga página quebrada `TransferConsultantPage` (`/clinic/consultant/transfer`, sempre 403 para usuários de clínica — ver UC-46/RN-03/RN-04, agora resolvidas), reaproveitando a coleção `consultant_transfer_requests` e o mesmo mecanismo de aprovação já usado pelo fluxo irmão de transferência entre consultores (UC-25). **[v1.1 — PR #376, decisão do PO]** Consultor existente mas inativo deixou de ser tratado como "não encontrado": a busca e o envio do convite respondem 409 (`code: 'consultant_inactive'`) e a tela informa "Consultor temporariamente inativo" (RN-09). Este é também o caminho pelo qual uma clínica criada **sem** vínculo — porque o consultor do código estava inativo na aprovação (UC-02/RN-07, UC-56/RN-10) — tenta se vincular de novo.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    ConsultorConvidado([👤 Consultor Convidado])

    subgraph Sistema["Curva Mestra"]
        UC54(("UC-54\nConvidar Consultor\npara a Clínica"))
        UC26(("UC-26\nAprovar Pedido\n(aceitar convite)"))
        UC27(("UC-27\nRejeitar Pedido\n(recusar convite)"))
        UC46(("UC-46\nVisualizar Consultor\nVinculado"))
    end

    UC46 -->|"botão \"Convidar Consultor\"\n(estado vazio)"| UC54
    ClinicAdmin --> UC54
    UC54 -->|cria consultant_transfer_requests\ntype: 'invite'| UC26
    UC54 -->|cria consultant_transfer_requests\ntype: 'invite'| UC27
    ConsultorConvidado -.->|decide, via e-mail| UC26
    ConsultorConvidado -.->|decide, via e-mail| UC27
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** — apenas este role tem acesso a `/clinic/consultant/invite`; `clinic_user` é redirecionado ao tentar acessar a rota diretamente por URL (RN-01). O Clinic Admin inicia o convite e, se necessário, o cancela antes da resposta do consultor.

### 2.2 Atores Secundários / Sistemas Externos
- **Consultor Rennova (convidado)** — recebe um e-mail informando o convite e decide aceitar/recusar em `/consultant/transfer-requests` (UC-26/UC-27, fora do escopo direto deste UC, mas consequência dele).
- **Sistema de fila de e-mails** (`email_queue`) — mecanismo de envio assíncrono já usado em outras partes do sistema (ex.: UC-08, UC-25).

---

## 3. Pré-condições
- Clinic Admin autenticado, `tenant_id` presente nos custom claims, `role === 'clinic_admin'`.
- A clínica (tenant) ainda **não** possui `consultant_id` preenchido — se já tiver, a tela exibe um estado bloqueado, sem formulário (RN-02).
- Não existe já um convite `pending` **não expirado** para essa clínica — se existir, a tela exibe o convite atual em vez do formulário de busca (RN-03).
- Para enviar o convite: existe um consultor com `status === 'active'` correspondente ao código de 6 dígitos buscado. Código inexistente retorna 404 "Consultor não encontrado"; consultor existente com `status` diferente de `active` retorna 409 `consultant_inactive` — tanto na busca quanto no envio (RN-09).

---

## 4. Pós-condições

### 4.1 Sucesso — Enviar Convite (POST)
- Um documento é criado em `consultant_transfer_requests` com `type: 'invite'`, `status: 'pending'`, `expires_at` (`created_at + 15 dias`, RN-08), `requesting_consultant_id/name/code` = dados do consultor convidado, `tenant_id/name/document`, `invited_by_user_id/name` = dados do Clinic Admin que enviou o convite.
- Um e-mail é enfileirado em `email_queue` (`type: 'consultant_invite_created'`) para o consultor convidado.
- **Nenhum vínculo é efetivado ainda** — `tenants/{id}.consultant_id` permanece vazio até que o consultor aceite (UC-26).
- Tela exibe "Convite Enviado!" e redireciona automaticamente (2s) para `/clinic/my-clinic?tab=consultant`.

### 4.1b Sucesso — Cancelar Convite (DELETE, RF-13 da spec)
- O documento do convite `pending` passa para `status: 'cancelled'`, com `cancelled_at` e `cancelled_by_user_id` gravados.
- Nenhum e-mail ou notificação in-app é enviado ao consultor convidado (RN-07).
- A tela volta ao estado de formulário de busca — o convite cancelado, assim como um expirado, não bloqueia o envio de um novo convite (RN-03).

### 4.2 Falha (Garantias Mínimas)
- Se a clínica já tiver consultor vinculado: nenhuma alteração é feita, API retorna 400 (RN-02).
- Se já existir convite `pending` não expirado para a mesma clínica: nenhuma alteração é feita, API retorna 400 (RN-03).
- Se o consultor buscado não existir: nenhuma alteração é feita, API retorna 404 ("Consultor não encontrado"). Se existir mas não estiver ativo (já na busca, ou por condição de corrida entre a busca e o envio): nenhuma alteração é feita, API retorna 409 com `code: 'consultant_inactive'` e a tela exibe o aviso de consultor temporariamente inativo (RN-09).
- Se `clinic_user` tentar acessar a tela ou chamar a API diretamente: nenhuma ação é executada, usuário é redirecionado (UI) ou recebe 403 (API) — RN-01.
- Se o cancelamento for tentado sobre um convite já processado (`aceito`/`recusado`), sobre uma pendência `type: 'transfer'`, ou sobre um convite já expirado: nenhuma alteração é feita, API retorna 400/403 (RN-06/RN-08).

---

## 5. Gatilho (Trigger)
Clinic Admin, cuja clínica ainda não tem consultor vinculado, acessa `/clinic/my-clinic`, aba "Consultor" (`ConsultantTab`), e clica no botão **"Convidar Consultor"**, exibido no estado vazio apenas para esse role (ver UC-46, Fluxo Alternativo 7a). É levado a `/clinic/consultant/invite`.

---

## 6. Fluxo Principal (Basic Flow) — Enviar Convite

1. Clinic Admin acessa `/clinic/my-clinic`, aba "Consultor"; como a clínica não tem consultor vinculado, sistema exibe o estado vazio com o botão "Convidar Consultor".
2. Clinic Admin clica no botão e é levado a `/clinic/consultant/invite`.
3. Tela chama, em paralelo, `GET /api/tenants/{tenantId}/consultant` (há consultor já vinculado?) e `GET /api/tenants/{tenantId}/consultant/invite` (há convite `pending` não expirado já ativo?).
4. Como não há consultor vinculado nem convite ativo, sistema exibe o formulário "Buscar por Código".
5. Clinic Admin digita o código de 6 dígitos do consultor e clica no botão de busca.
6. Sistema chama `GET /api/consultants/by-code/{code}` (Bearer token) — a rota busca o consultor pelo código **sem** filtrar por status e responde 200 com `{ id, code, name, email }` apenas se ele estiver `active`; código inexistente → 404, consultor inativo → 409 `consultant_inactive` (RN-09, Fluxos de Exceção 8d/8e).
7. Sistema exibe um card "Consultor Encontrado" com nome, e-mail e código, e o botão "Enviar Convite".
8. Clinic Admin clica em "Enviar Convite"; sistema exibe um `confirm()` nativo: `Tem certeza que deseja convidar o consultor {nome}?`.
9. Clinic Admin confirma.
10. Sistema chama `POST /api/tenants/{tenantId}/consultant/invite` com `{ consultant_id }` e o Bearer token.
11. API valida token e permissão (`decodedToken.tenant_id === tenantId` e `decodedToken.role === 'clinic_admin'` — RN-01); valida a presença de `consultant_id` no corpo (400) e a existência do tenant (404); valida que `tenant.consultant_id` está vazio (RN-02, senão 400 orientando a aguardar uma solicitação de transferência — UC-25); valida que o consultor existe (404 "Consultor não encontrado") e está com `status === 'active'` (senão 409 `consultant_inactive`, RN-09); e valida que não existe outro convite `pending` **não expirado** para o mesmo tenant (RN-03).
12. API cria o documento em `consultant_transfer_requests` (`type: 'invite'`, `status: 'pending'`, `expires_at: computeExpiresAt()`, `invited_by_user_id/name` = dados do Clinic Admin chamador).
13. API enfileira um e-mail (`email_queue`, `type: 'consultant_invite_created'`) para o consultor convidado.
14. API retorna `{ success: true, message: 'Convite enviado ao consultor', data: { id } }`.
15. Sistema exibe a tela de sucesso "Convite Enviado!", com o texto "Aguarde a aceitação do consultor. Você será notificado quando ele responder.", e redireciona automaticamente (após 2 segundos) para `/clinic/my-clinic?tab=consultant` (RN-10).
16. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Clínica já possui consultor vinculado (a partir do passo 3)
1. `GET /api/tenants/{tenantId}/consultant` retorna um consultor vinculado.
2. Sistema exibe um estado bloqueado — ícone e o texto "Sua clínica já possui um consultor vinculado. Para trocar, aguarde uma solicitação de transferência do consultor interessado." — sem exibir o formulário de busca. Caso de uso é encerrado sem ação (RN-02).

### 7b. Já existe um convite pendente não expirado (a partir do passo 3)
1. `GET /api/tenants/{tenantId}/consultant/invite` retorna um convite `pending` não expirado.
2. Em vez do formulário, sistema exibe um card "Convite Pendente" com os dados do convite atual (nome do consultor convidado, código, badge "Expira em N dias", calculado a partir de `expires_at`) e o botão "Cancelar Convite" — ver Fluxo Alternativo 7b1.

### 7b1. Cancelamento de convite pendente (RF-13 da spec — a partir de 7b)
1. Clinic Admin clica em "Cancelar Convite".
2. Sistema exibe um `confirm()` nativo: `Tem certeza que deseja cancelar este convite?`.
3. Clinic Admin confirma.
4. Sistema chama `DELETE /api/tenants/{tenantId}/consultant/invite/{requestId}` com o Bearer token.
5. API valida permissão (RN-01/RN-06); valida que o documento pertence ao tenant e é `type: 'invite'` (RN-06, senão 403 — "Apenas convites podem ser cancelados pela clínica"); valida `status === 'pending'` (senão 400 — "Este convite já foi processado"); valida que **não está expirado** (RN-08, senão 400 — "Este pedido expirou").
6. API atualiza o documento: `status: 'cancelled'`, `cancelled_at`, `cancelled_by_user_id`.
7. Nenhum e-mail ou notificação in-app é enviado ao consultor convidado (RN-07).
8. Sistema exibe o toast "Convite cancelado" e volta ao estado de formulário de busca (RN-03 — o convite cancelado deixa de bloquear um novo envio, mesmo tratamento dado a um convite expirado).

### 7c. Consultor decide sobre o convite (fora deste UC, consequência dele)
1. O consultor convidado recebe o e-mail e acessa `/consultant/transfer-requests`.
2. Se aceitar (UC-26): o vínculo é efetivado — `tenants/{id}.consultant_id` passa a apontar para o consultor convidado, sem etapa de remoção de "consultor anterior" (por definição não existe nenhum nesse cenário, RN-04).
3. Se recusar (UC-27): a clínica recebe uma notificação in-app (`type: 'consultant_invite_rejected'`) informando a recusa (RN-05); a tela `/clinic/consultant/invite` volta a permitir um novo convite (o convite anterior fica `status: 'rejected'`, que não conta como "pendente" para a checagem de RN-03).

---

## 8. Fluxos de Exceção

### 8a. Clinic User tenta acessar a tela diretamente por URL
1. `role === 'clinic_user'` é detectado por um `useEffect` na montagem da página.
2. Sistema redireciona imediatamente para `/clinic/my-clinic?tab=consultant`; nenhum dado é carregado ou exibido (RN-01).

### 8b. Clínica já possui consultor, mas o POST é chamado diretamente
1. Chamada à API sem passar pelo estado bloqueado da UI (ex.: condição de corrida, ou chamada direta).
2. API retorna 400 com a mensagem "Esta clínica já possui um consultor vinculado. Para trocar, aguarde uma solicitação de transferência do consultor interessado." (RN-02).

### 8c. Convite duplicado
1. Já existe um convite `pending` **não expirado** para a mesma clínica (para qualquer consultor).
2. API retorna 400 ("Já existe um convite pendente para esta clínica"); nenhuma alteração é feita (RN-03).

### 8d. Consultor inativo — na busca por código ou no envio do convite (a partir dos passos 6 ou 11)
1. O código corresponde a um consultor existente, mas com `status` diferente de `active` (ex.: suspenso, UC-29) — seja já no momento da busca, seja por suspensão entre a busca e o clique em "Enviar Convite" (condição de corrida). Inclui o cenário de uma clínica criada sem vínculo porque o consultor do código estava inativo na aprovação (UC-02/RN-07, UC-56/RN-10) e que tenta convidar o mesmo consultor.
2. `GET /api/consultants/by-code/{code}` ou `POST /api/tenants/{tenantId}/consultant/invite` retorna **409** com `{ error: "Este consultor está inativo temporariamente. Um novo consultor poderá auxiliar sua clínica nesse meio tempo.", code: 'consultant_inactive' }`; nenhuma alteração é feita. (Até a v1.0: a busca retornava 404 "Consultor não encontrado", por filtrar `active` na query, e o `POST` retornava 400 "Consultor não está ativo".)
3. Sistema exibe um toast destructive com o título "Consultor temporariamente inativo" e a descrição "Este consultor está inativo temporariamente. Um novo consultor poderá auxiliar sua clínica nesse meio tempo." (constantes `INACTIVE_CONSULTANT_TITLE`/`INACTIVE_CONSULTANT_MESSAGE`, `src/lib/validations/serverValidations.ts`); nenhum card de resultado é exibido (na busca) ou o card do consultor é removido (no envio). O Clinic Admin pode buscar outro código.

### 8e. Código não corresponde a nenhum consultor (a partir do passo 6)
1. Código de 6 dígitos não corresponde a nenhum documento em `consultants` (independentemente de status).
2. `GET /api/consultants/by-code/{code}` retorna 404 ("Consultor não encontrado"); sistema exibe o toast "Consultor não encontrado"; nenhum card de resultado é exibido. (Código com formato diferente de 6 dígitos é barrado antes, na própria tela — toast "Informe um código de 6 dígitos" — e, se chegar à API, retorna 400 "Código deve ter 6 dígitos".)

### 8f. Cancelamento de pendência que não é convite, já processada, ou expirada
1. Chamada de `DELETE` sobre um documento `type: 'transfer'` (não pertence à clínica cancelar — RN-06), já com `status !== 'pending'`, ou com `expires_at` no passado (RN-08).
2. API retorna, respectivamente, 403 ("Apenas convites podem ser cancelados pela clínica"), 400 ("Este convite já foi processado"), ou 400 ("Este pedido expirou"); nenhuma alteração é feita.

### 8g. Convite expira sem resposta do consultor (a partir do passo 12)
1. Passam-se 15 dias sem que o consultor convidado aceite ou recuse.
2. O documento permanece `status: 'pending'` no Firestore — nenhuma escrita automática ocorre (não há Cloud Function agendada). A partir desse momento, `GET /api/tenants/{tenantId}/consultant/invite` deixa de retornar esse convite como ativo (RN-03/RN-08), e a tela volta a exibir o formulário de busca, permitindo um novo convite. Uma tentativa de aprovar/rejeitar/cancelar esse convite específico (ex.: link antigo de e-mail) retornaria 400 "Este pedido expirou".

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | Apenas `clinic_admin` do próprio tenant pode criar, consultar ou cancelar um convite — `clinic_user` não tem essa permissão, tanto na UI (redirecionamento) quanto na API (403). | Alinhado ao padrão do restante do módulo "Minha Clínica" (abas "Usuários" e "Limite de Estoque" já são exclusivas de `clinic_admin`); evita repetir a inversão de gate de role encontrada na extinta `TransferConsultantPage` (UC-46/RN-04, resolvida). Confirmado por leitura de `GET`/`POST /api/tenants/[id]/consultant/invite/route.ts` e do `useEffect` de `invite/page.tsx`. |
| RN-02 | Um convite só pode ser criado quando `tenants/{id}.consultant_id` está vazio. Se a clínica já tiver consultor, a API retorna 400 — o cenário de clínica **com** consultor é exclusivamente iniciado pelo consultor (transferência, UC-25), nunca pela clínica. | Reflete a decisão de produto validada na spec de implementação: Cenário "sem consultor" (convite, este UC) vs "com consultor" (transferência, UC-25) têm iniciadores diferentes e não se sobrepõem. Confirmado por leitura de `POST /api/tenants/[id]/consultant/invite/route.ts`. |
| RN-03 | Apenas **um** convite `pending` **não expirado** por clínica por vez (para qualquer consultor). Um convite `pending` cujo `expires_at` já passou **não conta** para essa checagem — a clínica pode enviar um novo convite normalmente, mesmo com o documento antigo permanecendo inalterado no Firestore. O mesmo vale para um convite `cancelled`/`rejected`/`approved`: nenhum deles bloqueia um novo envio, pois a checagem filtra apenas `status === 'pending'`. | Evita duplicidade de convites simultâneos, mas evita também um estado sem saída: como o cancelamento também é bloqueado para pendências expiradas (RN-08), a clínica precisa continuar podendo convidar um novo consultor mesmo com um convite antigo "preso" em `pending`/expirado. Confirmado por leitura de `POST`/`GET /api/tenants/[id]/consultant/invite/route.ts` — ambos usam `isRequestExpired` para excluir convites `pending` expirados da checagem de "ativo". |
| RN-04 | Ao aceitar o convite (ação do consultor, UC-26), o vínculo é efetivado sem uma etapa de remoção de "consultor anterior" no `batch` de aprovação, pois por definição não existe consultor atual nesse cenário (RN-02 já garante isso na criação). | Evita uma escrita `arrayRemove` desnecessária/incorreta sobre um `current_consultant_id` inexistente. Confirmado por leitura de `approve/route.ts`, bloco `if (!isInvite && current_consultant_id) { ... }`. |
| RN-05 | Se o consultor recusar o convite (UC-27), a clínica recebe uma notificação in-app (`tenants/{tenant_id}/notifications`, `type: 'consultant_invite_rejected'`, `action_url: '/clinic/consultant/invite'`) — único caso, entre convite e transferência, em que a rejeição gera notificação in-app para a clínica (a rejeição de uma transferência, UC-27, não notifica ninguém além do consultor solicitante por e-mail). | O convite rejeitado deixa a clínica sem nenhum consultor e sem next-step óbvio; a clínica precisa saber para tentar convidar outro consultor. Confirmado por leitura de `reject/route.ts`, bloco `if (isInvite) { ... }`. |
| RN-06 | Apenas pendências `type: 'invite'` podem ser canceladas pela clínica (`DELETE .../consultant/invite/[requestId]`). Uma pendência `type: 'transfer'` **não** pode ser cancelada por esta rota — ela é iniciada pelo consultor (UC-25), não pela clínica; a clínica não tem prerrogativa de cancelá-la. | O cancelamento é uma ação do lado de quem *iniciou* a pendência. Confirmado por leitura de `DELETE /api/tenants/[id]/consultant/invite/[requestId]/route.ts` — checagem explícita `requestData.type !== 'invite'` retorna 403. |
| RN-07 | Cancelar um convite **não** gera nenhuma notificação (nem e-mail, nem in-app) para o consultor convidado. | O consultor convidado ainda não foi formalmente engajado no momento do cancelamento (não aceitou nem recusou) — notificá-lo de algo que ele nunca chegou a ver adicionaria ruído sem valor de ação. Confirmado por leitura do handler `DELETE` — nenhuma chamada a `email_queue` ou `notifications` após o `update`. |
| RN-08 | O convite recebe `expires_at = created_at + 15 dias` no momento da criação (mesmo padrão de `password_reset_tokens`/`passwordResetService.ts` — campo gravado no documento, checagem em tempo de leitura via `isRequestExpired`, **sem** Cloud Function agendada). As rotas `POST` (criação, RN-03), `DELETE` (cancelamento) e as rotas de `approve`/`reject` (UC-26/UC-27) verificam a expiração antes de processar uma pendência `pending`; se expirada, retornam 400 "Este pedido expirou" **sem** alterar o documento (nenhum novo status é gravado). | Reaproveita um padrão já testado e em produção no projeto (reset de senha), evitando introduzir a primeira Cloud Function agendada do repositório. Confirmado por leitura de `computeExpiresAt`/`isRequestExpired` (`src/lib/consultantRequests.ts`) e seu uso em `invite/route.ts`, `invite/[requestId]/route.ts`, `approve/route.ts`, `reject/route.ts`. |
| RN-09 | **[Atualizada em v1.1 — PR #376, decisão do PO]** Consultor inexistente e consultor inativo são **distinguidos** para o Clinic Admin. `GET /api/consultants/by-code/{code}` busca pelo código sem filtrar status: inexistente → 404 "Consultor não encontrado"; existente com `status !== 'active'` → 409 `{ error: INACTIVE_CONSULTANT_MESSAGE, code: 'consultant_inactive' }`. `POST /api/tenants/[id]/consultant/invite` repete a checagem (defesa contra condição de corrida entre a busca e o envio) com a mesma resposta 409 (antes: 400 "Consultor não está ativo"). A tela trata `code === 'consultant_inactive'` exibindo o toast "Consultor temporariamente inativo" / "Este consultor está inativo temporariamente. Um novo consultor poderá auxiliar sua clínica nesse meio tempo." | Antes, um consultor inativo aparecia como "Consultor não encontrado", levando a clínica a achar que digitou o código errado. A rota é **autenticada** (Bearer token), então informar o status não abre enumeração pública — contraste deliberado com UC-01/RN-11, rota pública que usa mensagem única para código inexistente ou inativo. Relevante para clínicas criadas sem vínculo porque o consultor do código estava inativo na aprovação (UC-02/RN-07, UC-56/RN-10). |
| RN-10 | O redirecionamento pós-sucesso (envio de convite) sempre aponta para `/clinic/my-clinic?tab=consultant` — o único caminho de navegação real para consultar o consultor vinculado (UC-46/RN-05) — nunca para a rota órfã `/clinic/consultant`. | Confirmado por leitura de `handleInvite` em `invite/page.tsx` — `router.push('/clinic/my-clinic?tab=consultant')`. |
| RN-11 | Consultor convidado não recebe nenhuma notificação in-app ao ser convidado — apenas e-mail (`email_queue`, `type: 'consultant_invite_created'`). Mesma decisão consciente de débito técnico documentada para UC-25/UC-26/UC-27: não existe hoje nenhuma infraestrutura de notificação in-app equivalente para o Portal do Consultor. | Confirmado por leitura de `POST /api/tenants/[id]/consultant/invite/route.ts` — nenhuma escrita em coleção de notificações do consultor; e da spec de implementação (`FEAT-unificacao-vinculo-transferencia-consultor.md`, RN-05). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Toda leitura/escrita em `consultant_transfer_requests` (para este e para o tipo `transfer`, UC-25) continua passando exclusivamente pelas API routes via Firebase Admin SDK — nenhum acesso direto client-side é introduzido, preservando o isolamento multi-tenant. | Segurança / Multi-tenant |
| RNF-02 | A consulta do convite `pending` atual (`GET /api/tenants/[id]/consultant/invite`) usa apenas filtros de igualdade (`tenant_id` + `type` + `status`), sem `orderBy` no Firestore — a ordenação por `created_at` (para escolher "o mais recente", caso haja mais de um documento por alguma inconsistência histórica) é feita em memória no servidor, evitando a necessidade de um índice composto adicional. | Performance |
| RNF-03 | Multi-tenant garantido de forma explícita via Admin SDK (`decodedToken.tenant_id === tenantId`) em `GET`/`POST`/`DELETE`, não apenas por regra do Firestore — mesmo padrão já usado em `GET /api/tenants/[id]/consultant` (UC-46/RN-06). | Multi-tenant / Segurança |

---

## 11. Frequência de Uso
Recém-implementado — sem dados de uso em produção ainda. Qualitativamente esperado como pouco frequente: uma clínica só precisa convidar um consultor quando ainda não tem nenhum vinculado, cenário que hoje também pode ser resolvido pelo consultor via auto-link (UC-24, iniciado do lado do consultor). O volume real de uso relativo entre os dois caminhos (UC-24 vs. este UC) ainda não foi medido.

---

## 12. Casos de Uso Relacionados
- **UC-23 (Vincular/Alterar/Remover Consultor via Painel Admin)** — mecanismo paralelo e complementar do System Admin, sem etapa de aprovação; não afetado por este UC.
- **UC-24 (Vincular-se Automaticamente a uma Clínica Sem Consultor)** — caminho alternativo para o mesmo cenário "clínica sem consultor", mas iniciado pelo consultor (sem aprovação), não pela clínica.
- **UC-25 (Solicitar Transferência de Clínica Já Vinculada)** — fluxo irmão, usando a mesma coleção (`consultant_transfer_requests`) e as mesmas rotas de aprovação/rejeição, mas para o cenário oposto ("clínica já tem consultor") e iniciado pelo consultor solicitante, não pela clínica.
- **UC-26 (Aprovar Pedido de Transferência de Clínica)** e **UC-27 (Rejeitar Pedido de Transferência de Clínica)** — consomem o documento `type: 'invite'` criado por este UC; ambos foram generalizados para tratar os dois tipos de pendência na mesma tela e rota.
- **UC-46 (Visualizar Consultor Vinculado à Clínica)** — ponto de entrada real deste UC, a partir do botão "Convidar Consultor" no estado vazio de `ConsultantTab`.
- **UC-02 (Aprovar Solicitação de Acesso)** e **UC-56 (Consultor Aprova Solicitação Vinculada ao Seu Código)** — quando a solicitação aprovada não tinha código de consultor, ou o consultor do código estava inativo/removido no momento da aprovação, a clínica nasce sem consultor (UC-02/RN-07, UC-56/RN-10); este UC é o caminho pelo qual o `clinic_admin` dessa clínica pode convidar um consultor depois — e, se tentar o mesmo consultor ainda inativo, recebe o aviso de RN-09.
- **UC-01 (Solicitar Acesso ao Sistema)** — usa o mesmo código de consultor de 6 dígitos, mas em rota pública e com mensagem única para código inexistente ou inativo (UC-01/RN-11) — tratamento deliberadamente oposto ao de RN-09 deste UC.

---

## 13. Referências
- `src/app/(clinic)/clinic/consultant/invite/page.tsx` (tela do Clinic Admin)
- `src/app/api/tenants/[id]/consultant/invite/route.ts` (`GET`, `POST`)
- `src/app/api/tenants/[id]/consultant/invite/[requestId]/route.ts` (`DELETE`, cancelamento)
- `src/app/api/consultants/by-code/[code]/route.ts` (busca por código, reaproveitada da extinta `TransferConsultantPage`; 404 inexistente / 409 `consultant_inactive` — RN-09)
- `src/lib/validations/serverValidations.ts` (`INACTIVE_CONSULTANT_TITLE`, `INACTIVE_CONSULTANT_MESSAGE` — RN-09)
- `tests/e2e/UC-54-convidar-consultor-para-clinica-sem-vinculo.spec.ts` (caderno E2E **parcial** — cobre só o tratamento de consultor inativo: busca 409, distinção ativo 200 / inexistente 404, convite recusado com 409 sem criar documento e o toast na tela)
- `src/lib/consultantRequests.ts` (`getApproverConsultantId`, `isInviteRequest`, `computeExpiresAt`, `isRequestExpired`, `getPendencyTypeLabel`)
- `src/components/clinic/ConsultantTab.tsx` (botão "Convidar Consultor", gate `isAdmin`)
- `src/types/index.ts` (`ConsultantTransferRequest`, `ConsultantPendencyType`, `ConsultantTransferRequestStatus`)
- `src/types/notification.ts` (`consultant_invite_rejected`)
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-unificacao-vinculo-transferencia-consultor.md` (spec de implementação completa — RF-01 a RF-14, RN-01 a RN-12)
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-25-solicitar-transferencia-de-clinica-ja-vinculada.md`, `UC-26-aprovar-pedido-de-transferencia-de-clinica.md`, `UC-27-rejeitar-pedido-de-transferencia-de-clinica.md`, `UC-46-visualizar-consultor-vinculado-a-clinica.md`, `UC-23-vincular-alterar-remover-consultor-da-clinica.md`, `UC-24-vincular-se-automaticamente-a-clinica-sem-consultor.md`

---

## 14. Perguntas em Aberto / Decisões Pendentes

Nenhuma pendência de produto identificada. Toda regra de negócio necessária já estava detalhada e aprovada na Seção 3 da spec de referência (`FEAT-unificacao-vinculo-transferencia-consultor.md`, RF-01 a RF-14, RN-01 a RN-12) e foi confirmada por leitura direta do código implementado (`invite/page.tsx`, `invite/route.ts`, `invite/[requestId]/route.ts`, `ConsultantTab.tsx`, `consultantRequests.ts`). Como registrado na spec (Seção 4.3, Seção 5.5), permanecem como débito técnico consciente — não como lacunas deste UC — a ausência de notificação in-app para o consultor convidado (RN-11) e a não-unificação de `ClinicConsultantPage`/`ConsultantTab` (UC-46/Seção 14, item 2).

**[Cobertura de teste parcial — não bloqueante]** O caderno E2E `tests/e2e/UC-54-convidar-consultor-para-clinica-sem-vinculo.spec.ts` cobre apenas o tratamento de consultor inativo (RN-09, Fluxo de Exceção 8d). O restante do UC-54 (fluxo principal, 7a/7b/7b1, 8a-8c, 8e-8g) segue sem caderno — cobertura retroativa pendente, conforme o ADR de automação de QA.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | Versão inicial. Documenta o fluxo de convite da clínica ao consultor, implementado em `feature/consultor-vinculo-convite-transferencia` (spec `FEAT-unificacao-vinculo-transferencia-consultor.md`, concluída em 13/08/2026), substituindo a antiga `TransferConsultantPage` (removida, ver UC-46 v1.2). Elicitação feita a partir da Seção 3 da spec já aprovada (RF-01 a RF-14, RN-01 a RN-12) e confirmada por leitura direta de todo o código implementado: tela `/clinic/consultant/invite`, rotas `GET`/`POST /api/tenants/[id]/consultant/invite` e `DELETE .../invite/[requestId]`, módulo puro `src/lib/consultantRequests.ts`, e o novo ponto de entrada em `ConsultantTab.tsx`. Sem perguntas em aberto. |
| 1.1 | 08/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Mudança de comportamento (PR #376, decisão do PO): consultor inativo deixa de aparecer como "não encontrado".** `GET /api/consultants/by-code/[code]` passou a distinguir código inexistente (404 "Consultor não encontrado") de consultor existente e inativo (409, `code: 'consultant_inactive'`); `POST /api/tenants/[id]/consultant/invite` passou a responder 409 com a mesma mensagem para consultor inativo (antes 400 "Consultor não está ativo"); a tela mostra o toast "Consultor temporariamente inativo". RN-09 reescrita (inclui o contraste com UC-01/RN-11); Fluxo de Exceção 8d reescrito (busca e envio) e 8e restrito a código inexistente; Pré-condições, Pós-condição 4.2, Fluxo Principal (passos 6, 8 — texto real do `confirm()` —, 11 — ordem real das validações) atualizados. Referência cruzada a UC-02/RN-07 e UC-56/RN-10 (clínica criada sem vínculo por consultor inativo na aprovação). Registrado o novo caderno E2E parcial (`tests/e2e/UC-54-...spec.ts`, só consultor inativo). |
