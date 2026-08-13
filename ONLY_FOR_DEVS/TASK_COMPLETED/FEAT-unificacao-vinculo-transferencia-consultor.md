# Feature: Unificação dos Fluxos de Vínculo/Transferência de Consultor entre Clínica e Consultor

**Projeto:** Curva Mestra
**Data:** 18/07/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/consultor-vinculo-convite-transferencia`
**Prioridade:** Alta
**Versão:** 1.1

> Unifica, sob uma única coleção `consultant_transfer_requests` com campo discriminador `type: 'invite' | 'transfer'`, dois fluxos hoje incompletos: (1) a Clínica passa a poder convidar um consultor específico quando ainda não tem nenhum vinculado (**novo**), e (2) o Consultor passa a ter, finalmente, um botão real para solicitar a transferência de uma clínica já vinculada a outro consultor (**UC-25, backend pronto, sem gatilho de UI até hoje**). Remove código morto/quebrado (`TransferConsultantPage`, rotas órfãs de `consultant_claims/[id]/approve|reject`) e adiciona uma tela de System Admin, somente leitura, para visualizar todas as pendências dos dois tipos. Nesta revisão (v1.1), incorpora as respostas do PO às Decisões Necessárias da v1.0: cancelamento de convite pelo Clinic Admin e expiração de 15 dias para ambos os tipos de pendência.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`
- **Branch da task:** `feature/consultor-vinculo-convite-transferencia`
- **Fluxo de PR:** `feature/consultor-vinculo-convite-transferencia` → PR → `gscandelari_setup` (validação Firebase) → PR → `develop`. **Nunca** abrir PR direto para `master`.

| Step(s) | Tipo | Escopo | Mensagem |
|---------|------|--------|----------|
| 1 | `feat` | `types` | `feat(types): add type/status/expiration fields to ConsultantTransferRequest` |
| 2 | `feat` | `types` | `feat(types): add consultant_invite_rejected notification type` |
| 3 | `feat` | `hooks` | `feat(hooks): add pure helpers for consultant pendency approver and expiration resolution` |
| 4 | `test` | `hooks` | `test(hooks): cover consultant pendency helper functions` |
| 5 | `feat` | `api` | `feat(api): add clinic-initiated consultant invite endpoint` |
| 6 | `feat` | `api` | `feat(api): add clinic consultant invite cancellation endpoint` |
| 7 | `fix` | `api` | `fix(api): generalize transfer-requests GET to cover invite and transfer types` |
| 8 | `fix` | `api` | `fix(api): generalize transfer-requests approve/reject for invite type and expiration` |
| 9 | `chore` | `api` | `chore(api): remove dead consultant_claims approve/reject routes` |
| 10 | `feat` | `ui` | `feat(ui): add clinic consultant invite page with pending state and cancellation` |
| 11 | `fix` | `ui` | `fix(ui): remove broken TransferConsultantPage and dangling references` |
| 12 | `fix` | `ui` | `fix(ui): add invite trigger to ConsultantTab empty state` |
| 13 | `feat` | `ui` | `feat(ui): add transfer request trigger to consultant clinic search` |
| 14 | `fix` | `ui` | `fix(ui): differentiate invite vs transfer copy and expiration badge on consultant transfer-requests page` |
| 15 | `feat` | `admin` | `feat(admin): add read-only consultant pendencies screen for system admin` |
| 16 | `chore` | `firebase` | `chore(firebase): add composite indexes for consultant pendency queries` |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

O vínculo consultor–clínica hoje é resolvido por **quatro mecanismos paralelos e desiguais em maturidade**, todos confirmados por leitura de código:

1. **Auto-link (UC-24, funcional, não deve ser alterado)** — `POST /api/consultants/claims` (`src/app/api/consultants/claims/route.ts`, "CASO 1", linhas 64-147): quando um consultor busca (`/consultant/clinics/search`) uma clínica **sem** `consultant_id`, o vínculo é criado imediatamente, sem aprovação de ninguém. Cria um registro em `consultant_claims` já `status: 'approved'` (auditoria), atualiza `authorized_tenants` do consultor, `tenants/{id}.consultant_id/code/name`, cria notificação in-app em `tenants/{tenant_id}/notifications` (`type: 'consultant_linked'`) e sincroniza custom claims.

2. **Solicitação de transferência (UC-25, backend pronto, sem gatilho de UI)** — mesmo endpoint, "CASO 2" (linhas 149-211): quando a clínica buscada **já** tem `consultant_id`, a API cria um documento em `consultant_transfer_requests` com `status: 'pending'` e envia e-mail ao consultor atual via `email_queue` (`type: 'consultant_transfer_request'`). **Porém a única tela que chama essa API** (`src/app/(consultant)/consultant/clinics/search/page.tsx`, linhas 208-215) não renderiza nenhum botão de ação nesse caso — apenas o texto informativo `"Clínica já possui o consultor {tenant.consultant_name} vinculado"`. O ramo "CASO 2" é, hoje, inatingível por qualquer usuário.

3. **Aprovação/rejeição de transferência (UC-26/UC-27, funcionais, mas condenados a ficar vazios)** — `src/app/api/consultants/transfer-requests/[id]/approve/route.ts` e `.../reject/route.ts`, consumidos por `src/app/(consultant)/consultant/transfer-requests/page.tsx`. A lógica de permissão já aceita `is_system_admin` **ou** `is_consultant && consultant_id === transferData.current_consultant_id` (approve, linhas 34-41; reject, linhas 34-41, idêntico). Como nenhum pedido é criado (item 2), a aba "Pendentes" dessa tela está sempre vazia na prática.

4. **Vínculo direto pelo painel Admin (UC-23, funcional, não deve ser alterado)** — `POST/DELETE /api/tenants/[id]/consultant` (`src/app/api/tenants/[id]/consultant/route.ts`), usado por `admin/tenants/[id]/page.tsx`. Aceita `system_admin` **ou** o próprio consultor autorizado ao tenant (`is_consultant && authorized_tenants?.includes(tenantId)`) — **nunca** um usuário de clínica. Esta é a mesma rota que a página quebrada do item 5 tentava (sem sucesso) chamar.

5. **Página quebrada `TransferConsultantPage`** (`src/app/(clinic)/clinic/consultant/transfer/page.tsx`) — pretende permitir que a própria clínica busque um consultor por código de 6 dígitos (via `GET /api/consultants/by-code/[code]`, já funcional) e o vincule chamando `POST /api/tenants/{id}/consultant`. Essa chamada **sempre retorna 403** para qualquer usuário de clínica, pois a rota (item 4) só aceita `system_admin` ou consultor autenticado. Confirmado e documentado em UC-46/RN-03. Adicionalmente, a página redireciona `clinic_admin` de volta para `/clinic/consultant` num `useEffect`, mas não faz o mesmo para `clinic_user` (RN-04 do UC-46) — inversão de gate de role. **Nenhuma das duas rotas (`/clinic/consultant` e `/clinic/consultant/transfer`) está linkada em `ClinicLayout.navLinks`** (UC-46/RN-05) — são alcançáveis apenas por URL direta.

6. **Código morto duplo confirmado** — `src/app/api/consultants/claims/[id]/approve/route.ts` e `.../reject/route.ts` operam sobre `consultant_claims` (não `consultant_transfer_requests`) e implementam um fluxo antigo de aprovação manual por `system_admin`, hoje inatingível: nenhuma tela chama essas rotas, e nenhum fluxo atual cria uma claim com `status: 'pending'` (o auto-link cria direto como `'approved'`). Confirmado em UC-24/RN-04 e RN-05, com comentário no próprio código-fonte admitindo a substituição ("o novo fluxo usa auto-link"/"...usa transfer requests").

7. **Sem visão consolidada para o System Admin** — `GET /api/consultants/transfer-requests` (`src/app/api/consultants/transfer-requests/route.ts`) já retorna **todos** os pedidos quando `decodedToken.is_system_admin` é verdadeiro (linhas 19, 30 — só aplica o filtro `current_consultant_id` quando o chamador é consultor e não é admin). Nenhuma tela consome esse caso hoje.

### 1.2 Problema identificado

- A Clínica não tem nenhuma forma funcional de **iniciar** o vínculo com um consultor específico (item 5 quebrado).
- O Consultor não tem nenhuma forma de **iniciar** uma transferência de clínica já vinculada (item 2, sem gatilho de UI) — mesmo o backend estando pronto e testado.
- Como consequência direta do ponto anterior, UC-26/UC-27 (aprovar/rejeitar) nunca são exercitados em produção.
- O System Admin não tem nenhuma visibilidade centralizada sobre pendências de vínculo, apesar do backend já suportar essa consulta.
- Existe confusão de superfície de API: duas famílias de rotas de aprovação (`consultants/claims/[id]/*` e `consultants/transfer-requests/[id]/*`) para o mesmo conceito de negócio, sendo uma delas morta.

### 1.3 Motivação estratégica

O PO validou que a Clínica precisa poder escolher e convidar um consultor específico (hoje só o consultor pode iniciar o vínculo, e apenas quando a clínica não tem nenhum). Ao mesmo tempo, o fluxo de transferência do lado do consultor (UC-25) já foi implementado e testado no backend há dias, mas nunca chegou a ser exposto na UI — completar esse gatilho é a forma de menor risco de aproveitar trabalho já feito, em vez de reescrever o mecanismo. Generalizar a coleção existente evita duplicar 90% da lógica de aprovação (UC-26/27) para o novo cenário de convite.

---

## 2. Objetivos

1. Remover a página quebrada `TransferConsultantPage` (`/clinic/consultant/transfer`) e confirmar que nenhuma referência interna aponta para ela.
2. Generalizar a coleção `consultant_transfer_requests` com um campo discriminador `type: 'invite' | 'transfer'`, preservando 100% de compatibilidade de leitura com documentos legados (sem `type`).
3. Implementar o fluxo de convite da Clínica ao Consultor (cenário 1a): nova tela `/clinic/consultant/invite`, reaproveitando a UI de busca por código já existente e funcional na página removida.
4. Implementar o gatilho de UI que falta para a solicitação de transferência do Consultor (cenário 2a / UC-25), na tela `/consultant/clinics/search`.
5. Generalizar a tela `/consultant/transfer-requests` e as rotas `approve`/`reject` para tratar corretamente os dois tipos de pendência, com textos e resolução de "quem aprova" diferenciados por tipo.
6. Criar uma tela de System Admin, somente leitura, listando todas as pendências (convite + transferência) com filtros de status e tipo, reaproveitando a API já existente.
7. Remover as rotas órfãs `consultants/claims/[id]/approve` e `.../reject`, reduzindo a superfície de API duplicada.
8. Manter a notificação por e-mail (via `email_queue`) como único canal para os consultores nos dois tipos de pendência, documentando a ausência de notificação in-app para consultor como débito técnico consciente.
9. Deixar claro, para o `uml-use-case-writer`, exatamente quais RNs de UC-23 a UC-27 e UC-46 precisam ser revisadas após a implementação.
10. Permitir que o Clinic Admin que criou um convite pending possa cancelá-lo antes da resposta do consultor.
11. Aplicar expiração de 15 dias (em tempo de leitura, sem Cloud Function agendada) para toda pendência — convite ou transferência —, reaproveitando o padrão já estabelecido em `passwordResetService.ts`.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Clinic Admin deve poder buscar um consultor pelo código de 6 dígitos e enviar um convite de vínculo, a partir de `/clinic/consultant/invite` | clinic_admin | Must |
| RF-02 | Sistema deve impedir a criação de um convite quando a clínica já possui `consultant_id` preenchido (retorna 400 orientando o uso do fluxo de transferência, que é iniciado pelo consultor) | system | Must |
| RF-03 | Sistema deve impedir um segundo convite pendente simultâneo da mesma clínica (para qualquer consultor) enquanto já existir um `pending` **não expirado**; um convite `pending` cujo `expires_at` já passou não bloqueia a criação de um novo convite (RN-12) | system | Must |
| RF-04 | Consultor convidado deve poder aceitar ou recusar o convite em `/consultant/transfer-requests`, com textos específicos de convite | consultant | Must |
| RF-05 | Ao aceitar um convite, o vínculo deve ser efetivado com a mesma robustez do auto-link (UC-24) — sem etapa de remoção de consultor anterior, pois por definição não existe um | system | Must |
| RF-06 | Ao recusar um convite, a clínica deve receber uma notificação in-app (`tenants/{tenant_id}/notifications`) informando a recusa | system | Must |
| RF-07 | Consultor deve poder solicitar transferência de uma clínica já vinculada a partir de `/consultant/clinics/search`, com um botão real (implementa o gatilho que falta em UC-25) | consultant | Must |
| RF-08 | Consultor atual deve continuar podendo aprovar/rejeitar pedidos de transferência em `/consultant/transfer-requests` (UC-26/UC-27), agora com o texto adaptado por tipo | consultant | Must |
| RF-09 | System Admin deve visualizar, em `/admin/consultant-pendencies`, uma lista consolidada de todas as pendências (convite + transferência), com filtros de status e tipo | system_admin | Must |
| RF-10 | A tela de System Admin é somente leitura nesta versão — nenhum botão de aprovar/rejeitar é exposto, mesmo a API já aceitando `is_system_admin` como autorizado | system_admin | Should |
| RF-11 | A página `/clinic/consultant/transfer` deve ser removida, junto com qualquer referência interna (`router.push`/`router.replace`) a ela | system | Must |
| RF-12 | As rotas `consultants/claims/[id]/approve` e `.../reject` devem ser removidas por serem código morto confirmado (UC-24/RN-04, RN-05) | system | Should |
| RF-13 | Clinic Admin que criou um convite `pending` deve poder cancelá-lo antes de o consultor responder, a partir de `/clinic/consultant/invite` | clinic_admin | Must |
| RF-14 | Sistema deve expirar (em tempo de leitura, sem gravação de novo status) qualquer pendência `pending` (convite ou transferência) 15 dias após a criação, impedindo aprovação, rejeição ou cancelamento após esse prazo | system | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Toda leitura/escrita em `consultant_transfer_requests` (para ambos os tipos) continua passando exclusivamente pelas API routes via Firebase Admin SDK — nenhum acesso direto client-side é introduzido, preservando o isolamento multi-tenant hoje garantido fora das regras do Firestore | Segurança / Multi-tenant |
| RNF-02 | As duas novas consultas por "aprovador" (`current_consultant_id` para `transfer`, `requesting_consultant_id` para `invite`), ambas com `orderBy('created_at')`, precisam de índices compostos dedicados em `firestore.indexes.json` | Performance |
| RNF-03 | Documentos legados de `consultant_transfer_requests` sem o campo `type` devem continuar sendo lidos e exibidos corretamente, tratados como `type: 'transfer'` (fallback em tempo de leitura, sem exigir migração/backfill) | Manutenibilidade |
| RNF-04 | A tela de System Admin não deve fazer nenhuma chamada de escrita (approve/reject) nesta versão, mesmo a API tecnicamente permitindo | Segurança / Escopo |
| RNF-05 | A expiração de pendências segue o mesmo padrão já usado em `password_reset_tokens` (`src/lib/services/passwordResetService.ts`): campo `expires_at: Timestamp` gravado no documento na criação, checagem feita em tempo de leitura (`new Date() > expiresAt`) — **sem** introduzir a primeira Cloud Function agendada do projeto (nenhuma existe hoje em `functions/src`, confirmado por grep) | Manutenibilidade / Consistência arquitetural |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | O campo `type` determina quem deve aprovar/rejeitar uma pendência: para `'invite'`, é o próprio `requesting_consultant_id` (o consultor convidado decide sobre si mesmo); para `'transfer'`, é o `current_consultant_id` (o consultor hoje vinculado). Essa resolução é centralizada em uma função pura (`getApproverConsultantId`), não duplicada em cada rota. | Evita duplicar a lógica de autorização entre `approve` e `reject`, e entre os dois tipos. |
| RN-02 | Um convite (`type: 'invite'`) só pode ser criado quando `tenants/{id}.consultant_id` está vazio. Se a clínica já tiver consultor, a API retorna 400 — o cenário de clínica **com** consultor é exclusivamente iniciado pelo consultor (transferência, UC-25), nunca pela clínica. | Reflete literalmente a descrição de negócio validada com o PO: Cenário 1 (sem consultor) vs Cenário 2 (com consultor) têm iniciadores diferentes e não se sobrepõem. |
| RN-03 | Ao aprovar um convite, o batch **não** executa a etapa de "remover tenant do consultor atual" (presente no approve de transferência), pois por definição não existe consultor atual nesse cenário. A lógica de approve precisa ramificar por `type` neste ponto específico. | Evita uma escrita `arrayRemove` desnecessária/incorreta sobre um `current_consultant_id` inexistente. |
| RN-04 | A rejeição de um convite gera uma notificação in-app para a clínica (`tenants/{tenant_id}/notifications`, novo `type: 'consultant_invite_rejected'`) — canal que já existe para a clínica (usado em UC-24/UC-26) e que passa a ser reaproveitado aqui. A rejeição de uma transferência continua **sem** notificar a clínica (comportamento herdado de UC-27, inalterado), pois nesse caso o vínculo atual simplesmente permanece como estava — não há necessidade de a clínica agir. | O convite rejeitado deixa a clínica sem nenhum consultor e sem next-step óbvio; a clínica precisa saber para tentar convidar outro consultor. Já a transferência rejeitada não muda nada do ponto de vista da clínica. |
| RN-05 | Não existe, e não será criada nesta spec, notificação in-app para consultores (nem para convite recebido, nem para pedido de transferência recebido) — a única notificação para o consultor continua sendo por e-mail via `email_queue`, como já ocorre em UC-25/UC-26/UC-27. | Decisão consciente de escopo: construir notificação in-app para o Portal do Consultor é uma iniciativa maior (não existe nenhuma infraestrutura equivalente a `tenants/{tenantId}/notifications` do lado do consultor hoje), registrada como débito técnico conhecido (ver Seção 10). |
| RN-06 | A rota `POST/DELETE /api/tenants/[id]/consultant` (vínculo direto, sem aprovação) é mantida **sem nenhuma alteração** — continua servindo exclusivamente o painel administrativo (UC-23, `admin/tenants/[id]/page.tsx`), que depende dela e permanece funcional e correto. | Confirmado por leitura de UC-23 (Fluxo Principal, passos 11-14): esta é a mesma rota que a página quebrada tentava (e falhava) usar; removê-la quebraria UC-23, que é o único consumidor legítimo hoje. |
| RN-07 | As rotas `consultants/claims/[id]/approve` e `.../reject` são removidas nesta spec. A coleção `consultant_claims` em si **não é removida** — continua sendo usada como registro de auditoria pelo auto-link (UC-24, CASO 1, que grava `status: 'approved'` diretamente). | Confirmado por grep exaustivo (UC-24/RN-04, RN-05): zero chamadas a essas duas rotas em todo o `src/`, e nenhum caminho atual cria uma claim `pending` para elas processarem. |
| RN-08 | Apenas `clinic_admin` do próprio tenant pode criar um convite — `clinic_user` não tem essa permissão. | Alinhado ao padrão do restante do módulo "Minha Clínica" (abas "Usuários" e "Limite de Estoque" já são exclusivas de `clinic_admin`); evita repetir a inversão de gate de role encontrada em `TransferConsultantPage` (UC-46/RN-04). |
| RN-09 | Apenas pendências `type: 'invite'` podem ser canceladas pela clínica (`DELETE .../consultant/invite/[requestId]`). Uma `type: 'transfer'` **não** pode ser cancelada por esta rota — ela é iniciada pelo consultor, não pela clínica; a clínica não tem prerrogativa de cancelá-la. | O cancelamento é uma ação do lado de quem *iniciou* a pendência. Como a transferência é sempre iniciada pelo consultor, apenas ele (via `reject`, em outro fluxo) pode encerrá-la antes da aprovação — nunca a clínica. |
| RN-10 | Cancelar um convite **não** gera nenhuma notificação (nem e-mail, nem in-app) para o consultor convidado. | O consultor convidado ainda não foi formalmente engajado no momento do cancelamento (não aceitou nem recusou) — notificá-lo de algo que ele nunca chegou a ver adicionaria ruído sem valor de ação. Caso o PO perceba necessidade futura, é um incremento de baixo custo, reaproveitando o mesmo padrão de e-mail já usado para criação/rejeição. |
| RN-11 | Toda pendência (`invite` ou `transfer`) recebe `expires_at = created_at + 15 dias` no momento da criação, seguindo o mesmo padrão de `password_reset_tokens`/`passwordResetService.ts` (campo gravado no documento, checagem em tempo de leitura via `isRequestExpired`, **sem** Cloud Function agendada). As rotas `approve`, `reject` e `cancel` verificam `isRequestExpired` antes de processar uma pendência `status === 'pending'`; se expirada, retornam 400 com a mensagem "Este pedido expirou", **sem** alterar o documento (nenhum novo status é gravado). | Reaproveita um padrão já testado e em produção no projeto (reset de senha), evitando introduzir a primeira Cloud Function agendada do repositório só para esta feature — consistente com RNF-05. |
| RN-12 | Um convite `pending` cujo `expires_at` já passou **não conta** para a checagem de duplicidade de RF-03/RN-02 — a clínica pode enviar um novo convite normalmente. O documento antigo permanece inalterado no Firestore (nunca é reescrito automaticamente), apenas deixa de bloquear novas ações. | Evita um estado sem saída: como o cancelamento também é bloqueado para pendências expiradas (RN-11), a clínica precisa continuar podendo convidar um novo consultor mesmo com um convite antigo "preso" em `pending`/expirado. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

- **Reaproveitar a coleção `consultant_transfer_requests` e as rotas `approve`/`reject` já existentes e testadas (UC-26/UC-27)**, em vez de criar uma coleção/rota nova para convites. A generalização é feita por um único campo discriminador `type: 'invite' | 'transfer'`, com o restante do schema quase inteiramente reaproveitado.
- **Centralizar a resolução de "quem aprova" em uma função pura** (`getApproverConsultantId`, em `src/lib/consultantRequests.ts`), consumida pelas rotas `approve`/`reject` — em vez de duplicar `if (type === 'invite') ... else ...` em cada rota. Essa função é testável isoladamente (ver Seção 8).
- **Reaproveitar a UI de busca por código de `TransferConsultantPage`** para a nova tela `/clinic/consultant/invite`, trocando apenas a chamada final (`POST /api/tenants/{id}/consultant` → `POST /api/tenants/{id}/consultant/invite`) e os textos de confirmação/sucesso.
- **Nova rota aninhada sob o recurso "tenant"**: `POST /api/tenants/[id]/consultant/invite`, e não `POST /api/consultants/invites`, porque quem possui e inicia a ação é a clínica (o tenant), mesmo padrão de aninhamento já usado por `GET/POST/DELETE /api/tenants/[id]/consultant`. Pelo mesmo motivo, o cancelamento é `DELETE /api/tenants/[id]/consultant/invite/[requestId]`, aninhado sob o mesmo recurso, em vez de uma rota solta em `consultants/transfer-requests/[id]/cancel`.
- **Reaproveitar `GET /api/consultants/transfer-requests`** para a tela de System Admin, sem criar uma nova rota de leitura — ela já retorna todos os documentos quando `is_system_admin` é verdadeiro.
- **Expiração de pendências (convite e transferência) segue o padrão já estabelecido em `password_reset_tokens`/`passwordResetService.ts`**: campo `expires_at: Timestamp` gravado na criação (`created_at + 15 dias`), checado em tempo de leitura por uma função pura (`isRequestExpired`, `src/lib/consultantRequests.ts`) — sem Cloud Function agendada, consistente com o fato de o projeto não ter nenhuma hoje (confirmado por grep em `functions/src`).
- **Cancelamento reaproveita o mesmo documento** (`status: 'cancelled'`, novo valor de `ConsultantTransferRequestStatus`), em vez de soft/hard delete — mantém histórico auditável, mesmo padrão já usado para `approved`/`rejected`.

### 4.2 Alternativas descartadas

- **Coleção separada `consultant_invites`**: descartada por duplicar praticamente todo o schema de `consultant_transfer_requests` e exigir uma segunda tela quase idêntica de aprovação/rejeição no Portal do Consultor, contrariando a orientação de reaproveitar UC-26/UC-27.
- **Renomear integralmente `requesting_consultant_id` para um nome neutro (ex.: `target_consultant_id`)**: tecnicamente mais correto (o nome atual fica semanticamente sobrecarregado quando `type === 'invite'`, pois o consultor convidado não "solicitou" nada), mas descartado nesta versão por ampliar desnecessariamente o diff em rotas já estáveis (UC-26/UC-27) sem ganho funcional. O PO deixou a critério do time (Seção 13) e a decisão de manter foi confirmada — ver Seção 4.3 e "Decisões Confirmadas pelo PO" ao final do documento.
- **Expiração automática via Cloud Function agendada (scheduled function/cron)**: descartada em favor do padrão de checagem em tempo de leitura já usado em `passwordResetService.ts` — o projeto não possui nenhuma Cloud Function agendada hoje (confirmado por grep em `functions/src`), e introduzir a primeira apenas para esta feature adicionaria complexidade operacional desproporcional ao ganho (documentos expirados sem limpeza automática são inofensivos, apenas deixam de ser acionáveis — RN-11).
- **Gravar `status: 'expired'` de forma preguiçosa no primeiro `GET` que detectar a expiração**: descartada em favor de cálculo 100% em tempo de leitura (`isRequestExpired`, sem escrita). Evita uma escrita extra a cada listagem, evita condição de corrida entre duas leituras concorrentes tentando gravar o mesmo status, e mantém uma única fonte de verdade (`expires_at`) — mesmo padrão comportamental de `validateToken`/`consumeToken` em `passwordResetService.ts`, que também nunca escrevem um status "expirado", apenas comparam datas a cada chamada.
- **Permitir que `system_admin` também crie convites em nome de uma clínica**: descartada por não ter sido solicitada pelo PO; o cenário 1a é explicitamente "Clinic Admin busca e seleciona um consultor".

### 4.3 Trade-offs aceitos

- O campo `requesting_consultant_id` passa a significar "o consultor que ficará vinculado à clínica se o pedido for aprovado" (e não literalmente "quem solicitou") quando `type === 'invite'`. Mitigado com comentário extenso no tipo TypeScript (Seção 6.1) e cobertura de teste que fixa o contrato via `getApproverConsultantId`.
- Nenhuma paginação é adicionada às telas de listagem (consultor e admin) — aceitável dado o volume ainda baixo, mesmo padrão já aceito em UC-26/RNF-01.
- `current_consultant_id`/`current_consultant_name` tornam-se campos opcionais no tipo `ConsultantTransferRequest` — qualquer código que hoje assume presença incondicional desses campos (nenhum identificado além das rotas já mapeadas nesta spec) precisa ser revisado.
- Documentos expirados (`status: 'pending'` com `expires_at` no passado) não são limpos/arquivados automaticamente — permanecem no Firestore indefinidamente, visíveis nas listagens com o badge "Expirado", mesmo trade-off já aceito hoje para `password_reset_tokens` (nunca purgados por cron). Uma eventual rotina de arquivamento é incremento futuro, fora de escopo.
- Um convite `pending` expirado não pode ser cancelado explicitamente pelo Clinic Admin (RN-11 bloqueia a ação em `approve`/`reject`/`cancel` de forma simétrica) — porém, como esse mesmo convite deixa de bloquear a criação de um novo (RN-12), a UI simplesmente oferece o formulário de busca novamente em vez de expor um botão "Cancelar" que sempre falharia (ver Seção 6.3).

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `src/app/(clinic)/clinic/consultant/invite/page.tsx` | Page (client) | Tela do Clinic Admin para buscar um consultor por código e enviar convite (cenário 1a); se já existir um convite `pending` não expirado, exibe esse convite em vez do formulário e permite cancelá-lo (RF-13) |
| `src/app/api/tenants/[id]/consultant/invite/route.ts` | API Route (`GET`, `POST`) | `GET`: retorna o convite `pending` não expirado atual do tenant, se existir. `POST`: cria uma pendência `type: 'invite'` (com `expires_at`) em `consultant_transfer_requests` e enfileira e-mail ao consultor convidado |
| `src/app/api/tenants/[id]/consultant/invite/[requestId]/route.ts` | API Route (`DELETE`) | Cancela (`status: 'cancelled'`) um convite `pending` e não expirado, criado pela própria clínica, antes da resposta do consultor (RF-13) |
| `src/app/(admin)/admin/consultant-pendencies/page.tsx` | Page (client) | Tela somente leitura do System Admin, lista todas as pendências (convite + transferência) com filtros |
| `src/lib/consultantRequests.ts` | Módulo puro | Funções puras de resolução de tipo/aprovador/expiração: `getApproverConsultantId`, `isInviteRequest`, `normalizeLegacyType`, `getPendencyTypeLabel`, `computeExpiresAt`, `isRequestExpired` |
| `src/__tests__/consultantRequests.test.ts` | Teste unitário | Cobertura das funções puras acima |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/types/index.ts` | Adiciona `ConsultantPendencyType`, estende `ConsultantTransferRequestStatus` com `'cancelled'`, estende `ConsultantTransferRequest` com `type`, `expires_at`, `cancelled_at`, `cancelled_by_user_id`, torna `current_consultant_id`/`current_consultant_name` opcionais, adiciona `invited_by_user_id`/`invited_by_user_name` |
| `src/types/notification.ts` | Adiciona `'consultant_invite_rejected'` a `NotificationType` |
| `src/app/api/consultants/claims/route.ts` | CASO 2 (criação de pedido de transferência): passa a gravar `expires_at = created_at + 15 dias` usando `computeExpiresAt` (RN-11). Nenhuma outra mudança de comportamento neste arquivo. |
| `src/app/api/consultants/transfer-requests/route.ts` | `GET`: para chamadores consultor (não admin), executa duas queries (transfer por `current_consultant_id`, invite por `requesting_consultant_id`), mescla e ordena por `created_at`; aceita novo query param `type`. Response continua incluindo `expires_at` (já parte do schema) para a UI calcular o badge "Expirado" via `isRequestExpired` |
| `src/app/api/consultants/transfer-requests/[id]/approve/route.ts` | Permissão via `getApproverConsultantId`; rejeita com 400 "Este pedido expirou" se `isRequestExpired(transferData)` (RN-11); batch ramifica por `type` (sem remoção de "consultor atual" quando `invite`); mensagem de notificação diferenciada por tipo |
| `src/app/api/consultants/transfer-requests/[id]/reject/route.ts` | Permissão via `getApproverConsultantId`; rejeita com 400 "Este pedido expirou" se `isRequestExpired(transferData)` (RN-11); quando `type === 'invite'`, cria notificação in-app para a clínica (`consultant_invite_rejected`) além do fluxo de e-mail já existente para `transfer` |
| `src/app/(consultant)/consultant/transfer-requests/page.tsx` | `RequestCard` passa a exibir título/descrição/rótulos de botão diferentes conforme `request.type`, além de um badge "Expirado" (via `isRequestExpired`) que desabilita os botões "Aprovar"/"Rejeitar" |
| `src/app/(consultant)/consultant/clinics/search/page.tsx` | Substitui o bloco informativo (quando `tenant.consultant_id` existe) por um botão "Solicitar Transferência" que chama `POST /api/consultants/claims` (CASO 2, já implementado, sem alteração de payload) |
| `src/components/clinic/ConsultantTab.tsx` | Adiciona botão "Convidar Consultor" (`isAdmin`-gated) no estado vazio, linkando para `/clinic/consultant/invite` |
| `src/components/admin/AdminLayout.tsx` | Adiciona item de navegação "Pendências de Consultor" → `/admin/consultant-pendencies` |
| `firestore.indexes.json` | Adiciona índices compostos para as novas consultas (ver Seção 6.4). Nenhum índice novo é necessário para `expires_at` — a expiração é sempre calculada em memória sobre documentos já lidos, nunca usada como filtro de query |

### 5.3 Arquivos a REMOVER

| Arquivo | Motivo |
|---------|--------|
| `src/app/(clinic)/clinic/consultant/transfer/page.tsx` (`TransferConsultantPage`) | Confirmadamente quebrado — chama uma API que sempre retorna 403 para usuários de clínica (UC-46/RN-03); gate de role invertido (UC-46/RN-04). Substituído pela nova tela `/clinic/consultant/invite`, que usa o endpoint correto. |
| `src/app/api/consultants/claims/[id]/approve/route.ts` | Código morto confirmado (UC-24/RN-04, RN-05) — nenhuma tela chama esta rota, e nenhum fluxo atual cria uma claim `pending` para ela processar. |
| `src/app/api/consultants/claims/[id]/reject/route.ts` | Idem acima. |

Confirmado por grep (`clinic/consultant/transfer`, `consultants/claims/[id]`) que nenhum outro arquivo de `src/` referencia essas rotas — a remoção é segura e isolada.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `consultant_transfer_requests` | Extensão de schema, não-destrutiva | `+ type: 'invite' \| 'transfer'` (novo), `+ invited_by_user_id`/`invited_by_user_name` (opcionais, só em `invite`), `+ expires_at: Timestamp` (novo, gravado na criação como `created_at + 15 dias` — ausente em documentos legados, tratado como "nunca expira"), `+ cancelled_at`/`cancelled_by_user_id` (opcionais, só quando cancelado), `status` ganha o valor `'cancelled'`, `current_consultant_id`/`current_consultant_name` passam de obrigatórios para opcionais |
| `tenants/{tenantId}/notifications` | Novo valor de `type` | `'consultant_invite_rejected'`, criado pela rota de `reject` apenas quando `type === 'invite'` |
| `consultant_claims` | Nenhuma mudança de schema | Continua recebendo registros de auditoria do auto-link (UC-24); as rotas órfãs de aprovação/rejeição sobre ela são removidas (não a coleção) |
| `firestore.rules` | Nenhuma mudança | Acesso a `consultant_transfer_requests` continua exclusivamente via API routes com Firebase Admin SDK (nunca client-side) — mesmo padrão de hoje (UC-25/RNF-02), preservado para o novo tipo `invite` e para a expiração |

**Plano de migração de dados:** a suposição verificada é que **não existem documentos em produção** com `consultant_transfer_requests.status === 'pending'` até esta data, pois o único caminho de criação (UC-25, CASO 2) nunca teve gatilho de UI (confirmado em UC-25/RN-00, "Frequência de Uso: Nula hoje"). Ainda assim, para qualquer documento legado que eventualmente exista (aprovado/rejeitado no passado, ou criado manualmente em teste), **nenhum backfill é necessário**: todo código que lê `type` (rotas `GET`/`approve`/`reject` e a função pura `normalizeLegacyType`) trata a ausência do campo como `type: 'transfer'` — o único tipo que existia antes desta spec. Da mesma forma, nenhum backfill de `expires_at` é necessário: documentos sem esse campo são tratados por `isRequestExpired` como "nunca expirados" (RN-11). Não é criado nenhum script de migração dedicado (o projeto não possui uma pasta `scripts/` para esse fim); o fallback em tempo de leitura é suficiente e mais simples.

### 5.5 O que NÃO muda

- **UC-24 (auto-link)** — `POST /api/consultants/claims`, CASO 1, permanece byte-a-byte idêntico. Nenhuma linha desse ramo é tocada.
- **UC-23 (painel Admin)** — `POST/DELETE /api/tenants/[id]/consultant` e a tela `admin/tenants/[id]/page.tsx` permanecem inalterados (RN-06).
- **Lógica de negócio de UC-26/UC-27** — o batch de aprovação e o update de rejeição continuam fazendo exatamente o que já faziam para `type === 'transfer'`; as mudanças são a resolução do aprovador (RN-01), a checagem de expiração (RN-11) e a ramificação para `type === 'invite'` (código novo, adicionado, não uma reescrita do caminho existente).
- **`firestore.rules`** — nenhuma regra nova ou alterada.
- **`functions/src`** — nenhuma Cloud Function agendada é criada; a expiração desta feature usa exclusivamente o padrão de checagem em tempo de leitura já usado por `passwordResetService.ts` (Seção 4.1), consistente com o fato de o projeto não ter nenhuma scheduled function hoje.
- **Parser DANFE/XML NF-e, inventário, procedimentos, relatórios** — módulos completamente não relacionados a este escopo.
- **`ConsultantTab.tsx`/`ClinicConsultantPage` (`/clinic/consultant`)** — a duplicação entre essas duas implementações de "visualizar consultor vinculado" (UC-46/RN-01) **não é resolvida nesta spec**; apenas `ConsultantTab.tsx` (a única alcançável por navegação real, UC-46/RN-05) recebe o novo botão "Convidar Consultor". A página órfã `/clinic/consultant` continua existindo, sem alterações — sua unificação com `ConsultantTab` é uma decisão de produto em aberto no próprio UC-46, fora do escopo aqui.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

**`src/types/index.ts` — antes (v1.0 desta spec, refletindo o estado hoje em produção):**

```typescript
export type ConsultantTransferRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ConsultantTransferRequest {
  id: string;
  requesting_consultant_id: string;
  requesting_consultant_name: string;
  requesting_consultant_code: string;
  current_consultant_id: string;
  current_consultant_name: string;
  tenant_id: string;
  tenant_name: string;
  tenant_document: string;
  status: ConsultantTransferRequestStatus;
  rejection_reason?: string;
  approved_at?: Timestamp;
  rejected_at?: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**Depois (v1.1 — inclui `type`, `expires_at` e `cancelled`):**

```typescript
export type ConsultantTransferRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * Discriminador do tipo de pendência.
 * - 'invite': iniciado pela CLÍNICA (clinic_admin), quando ela ainda não tem consultor
 *   vinculado. Quem deve aprovar é o próprio consultor convidado (requesting_consultant_id).
 *   Pode ser cancelado pela clínica que o criou (status: 'cancelled', RN-09).
 * - 'transfer': iniciado pelo CONSULTOR SOLICITANTE, quando a clínica já tem consultor
 *   vinculado a outro. Quem deve aprovar é o consultor atual (current_consultant_id).
 *   Não pode ser cancelado pela clínica (RN-09) — apenas aprovado/rejeitado pelo consultor
 *   atual, ou deixado expirar (RN-11).
 * Documentos legados sem este campo devem ser tratados como 'transfer'
 * (único tipo existente antes desta feature) — ver `normalizeLegacyType` em
 * `src/lib/consultantRequests.ts`.
 */
export type ConsultantPendencyType = 'invite' | 'transfer';

export interface ConsultantTransferRequest {
  id: string;
  type?: ConsultantPendencyType; // opcional para compatibilidade com documentos legados

  /**
   * Consultor que ficará vinculado à clínica SE o pedido for aprovado.
   * - type 'invite': o consultor CONVIDADO pela clínica (ainda não vinculado a ela).
   * - type 'transfer': o consultor SOLICITANTE (quer assumir uma clínica já vinculada
   *   a outro consultor). Nome do campo mantido por compatibilidade com UC-25/26/27;
   *   ver Seção 4.2/4.3 sobre a decisão consciente de não renomear (confirmada pelo PO).
   */
  requesting_consultant_id: string;
  requesting_consultant_name: string;
  requesting_consultant_code: string;

  /**
   * Consultor hoje vinculado à clínica, que deve aprovar a transferência.
   * Presente APENAS quando type === 'transfer' — ausente/undefined em 'invite',
   * pois por definição a clínica não tem consultor vinculado nesse cenário (RN-02).
   */
  current_consultant_id?: string;
  current_consultant_name?: string;

  tenant_id: string;
  tenant_name: string;
  tenant_document: string;

  /** Apenas para type 'invite': quem (clinic_admin) criou o convite. */
  invited_by_user_id?: string;
  invited_by_user_name?: string;

  status: ConsultantTransferRequestStatus;
  rejection_reason?: string;
  approved_at?: Timestamp;
  rejected_at?: Timestamp;

  /** Apenas quando status === 'cancelled' (somente aplicável a type 'invite', RN-09). */
  cancelled_at?: Timestamp;
  cancelled_by_user_id?: string;

  /**
   * Data-limite para a pendência permanecer acionável (aprovar/rejeitar/cancelar).
   * Calculada como created_at + 15 dias no momento da criação (mesmo padrão de
   * `password_reset_tokens.expires_at` em `src/lib/services/passwordResetService.ts`).
   * Ausente em documentos legados criados antes desta feature — nesse caso a pendência
   * é tratada como nunca expirada (ver `isRequestExpired` em `src/lib/consultantRequests.ts`).
   * Não existe Cloud Function agendada para expirar automaticamente: a checagem é
   * sempre feita em tempo de leitura (mesmo padrão de `validateToken`/`consumeToken`).
   */
  expires_at?: Timestamp;

  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**`src/types/notification.ts` — adição:**

```typescript
export type NotificationType =
  | 'expiring'
  | 'expired'
  | 'low_stock'
  | 'request_approved'
  | 'request_rejected'
  | 'request_created'
  | 'new_user'
  | 'consultant_linked'
  | 'consultant_claim'
  | 'consultant_invite_rejected'; // NOVO — clínica é avisada que o consultor convidado recusou
```

### 6.2 Mudanças em serviços (novo módulo puro)

**Arquivo novo:** `src/lib/consultantRequests.ts`

```typescript
import type { ConsultantPendencyType, ConsultantTransferRequest } from '@/types';
import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Normaliza o tipo de uma pendência, tratando documentos legados (sem `type`)
 * como 'transfer' — único tipo que existia antes desta feature.
 */
export function normalizeLegacyType(
  type: ConsultantPendencyType | undefined
): ConsultantPendencyType {
  return type ?? 'transfer';
}

export function isInviteRequest(
  request: Pick<ConsultantTransferRequest, 'type'>
): boolean {
  return normalizeLegacyType(request.type) === 'invite';
}

/**
 * Resolve qual consultor deve aprovar/rejeitar a pendência.
 * - 'invite': o próprio consultor convidado (requesting_consultant_id).
 * - 'transfer': o consultor atualmente vinculado (current_consultant_id).
 * Lança erro se type === 'transfer' e current_consultant_id estiver ausente
 * (estado de dado inválido — nunca deveria ocorrer para esse tipo).
 */
export function getApproverConsultantId(
  request: Pick<
    ConsultantTransferRequest,
    'type' | 'requesting_consultant_id' | 'current_consultant_id'
  >
): string {
  if (isInviteRequest(request)) {
    return request.requesting_consultant_id;
  }
  if (!request.current_consultant_id) {
    throw new Error('current_consultant_id ausente para pendência do tipo transfer');
  }
  return request.current_consultant_id;
}

export function getPendencyTypeLabel(type: ConsultantPendencyType | undefined): string {
  return normalizeLegacyType(type) === 'invite' ? 'Convite' : 'Transferência';
}

/** Prazo padrão de validade de uma pendência, em dias (RN-11). */
export const PENDENCY_EXPIRY_DAYS = 15;

/**
 * Calcula a data de expiração a partir de uma data de criação (created_at + 15 dias).
 * Mesma lógica de `TOKEN_EXPIRY_MINUTES` em `passwordResetService.ts`, adaptada para dias.
 */
export function computeExpiresAt(createdAt: Date = new Date()): Date {
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + PENDENCY_EXPIRY_DAYS);
  return expiresAt;
}

/**
 * Verifica se uma pendência já expirou, com base em `expires_at`.
 * Documentos legados/sem `expires_at` NUNCA são considerados expirados (RN-11/RN-12).
 * Mesmo padrão de comparação usado em `validateToken`/`consumeToken`
 * (`new Date() > expiresAt`), aqui centralizado como função pura testável.
 */
export function isRequestExpired(
  request: Pick<ConsultantTransferRequest, 'expires_at'>,
  now: Date = new Date()
): boolean {
  if (!request.expires_at) return false;
  const expiresAtDate = (request.expires_at as Timestamp).toDate
    ? (request.expires_at as Timestamp).toDate()
    : new Date(request.expires_at as unknown as string);
  return now > expiresAtDate;
}
```

Consumido por `approve/route.ts`, `reject/route.ts`, o novo `invite/[requestId]/route.ts` (permissão e expiração) e pelas três telas (rótulos e badges).

### 6.3 Mudanças na UI

**`/clinic/consultant/invite/page.tsx` (novo, adaptado de `TransferConsultantPage`):**
- Estado atual: não existe (a página equivalente, `TransferConsultantPage`, está quebrada e será removida).
- Estado novo: ao carregar, chama `GET /api/tenants/{tenantId}/consultant` (consultor já vinculado?) e `GET /api/tenants/{tenantId}/consultant/invite` (convite `pending` não expirado já existe?). Três estados possíveis:
  1. **Tenant já tem consultor vinculado** → estado bloqueado: "Sua clínica já possui um consultor vinculado. Para trocar, aguarde uma solicitação de transferência do consultor interessado." — sem formulário.
  2. **Tenant sem consultor e sem convite `pending` ativo** (nunca teve, ou o último expirou — RN-12) → formulário de busca por código de 6 dígitos (`GET /api/consultants/by-code/[code]`, reaproveitado sem alteração), idêntico ao da página removida. Botão final passa de "Confirmar Vínculo" para "Enviar Convite"; chama `POST /api/tenants/{tenantId}/consultant/invite`. Tela de sucesso passa de "Consultor Vinculado!" para "Convite Enviado!", com texto "Aguarde a aceitação do consultor. Você será notificado quando ele responder." Redirecionamento final para `/clinic/my-clinic?tab=consultant` (em vez de `/clinic/consultant`, alinhando com o único caminho de navegação real, UC-46/RN-05).
  3. **Tenant sem consultor e com um convite `pending` não expirado** → em vez do formulário, exibe um card com os dados do convite atual (consultor convidado, código, data de envio, badge "Expira em N dias"), e um botão "Cancelar Convite" que chama `DELETE /api/tenants/{tenantId}/consultant/invite/{requestId}` (RF-13). Após cancelamento bem-sucedido, a tela recarrega e volta ao estado 2 (formulário de busca).
- Comportamento condicional adicional: nenhum botão "Cancelar" é exibido para um convite expirado (ver Trade-off, Seção 4.3) — nesse caso a tela simplesmente cai no estado 2 (formulário), já que RN-12 garante que o convite expirado não bloqueia um novo envio.
- Gate de role: apenas `clinic_admin` (RN-08); `clinic_user` que acessar por URL direta é redirecionado para `/clinic/my-clinic?tab=consultant`.

**`ConsultantTab.tsx` — estado vazio ("Nenhum Consultor Vinculado"):**
- Estado atual: apenas texto explicativo, sem nenhuma ação.
- Estado novo: mantém o texto explicativo e adiciona, condicionado a `isAdmin` (mesmo padrão de gate já usado nas abas "Usuários"/"Limite de Estoque" em `my-clinic/page.tsx`), um botão "Convidar Consultor" linkando para `/clinic/consultant/invite`. A tela de destino já resolve sozinha se deve mostrar o formulário ou o convite pendente atual (ver acima) — `ConsultantTab` não precisa saber desse estado.

**`/consultant/clinics/search/page.tsx` — resultado quando `tenant.consultant_id` existe:**
- Estado atual: bloco `<div>` informativo cinza, sem nenhum botão (linhas 208-215).
- Estado novo: substitui o bloco por um botão "Solicitar Transferência" (mantendo o texto informativo acima, para contexto), que chama a mesma `POST /api/consultants/claims` já usada para o auto-link (CASO 2, sem nenhuma alteração de payload — apenas ganha `expires_at` internamente, ver Seção 6.4). Estado local `transferRequested: Record<string, boolean>` (paralelo ao `linked` já existente) marca visualmente "Pedido de transferência enviado" após sucesso.

**`/consultant/transfer-requests/page.tsx` — `RequestCard`:**
- Estado atual: sempre mostra "Solicitante: {requesting_consultant_name}" e botões "Aprovar"/"Rejeitar", independentemente de contexto.
- Estado novo: usa `getPendencyTypeLabel(request.type)` para exibir um `Badge` de tipo ("Convite"/"Transferência") ao lado do badge de status. Adiciona um badge "Expirado" (via `isRequestExpired(request)`) quando `status === 'pending'` e a pendência já passou dos 15 dias — nesse caso os botões "Aprovar"/"Rejeitar" ficam desabilitados (a chamada à API também rejeitaria, RN-11, mas a UI evita a chamada desnecessária). Texto do corpo do card passa a ser condicional:
  - `type === 'invite'`: `"A clínica {tenant_name} convidou você para ser o consultor vinculado."` — botões mantidos como "Aprovar"/"Rejeitar" (mesma ação/endpoint, apenas o texto do card muda — não há necessidade de renomear os botões, já que a semântica de "aprovar este pedido" continua válida para os dois tipos).
  - `type === 'transfer'`: mantém o texto atual, `"Solicitante: {requesting_consultant_name} ({requesting_consultant_code})"`.

**`/admin/consultant-pendencies/page.tsx` (novo):**
- Não existe hoje. Nova tela: tabela/lista consumindo `GET /api/consultants/transfer-requests` (sem filtro adicional de servidor além dos já suportados `status`/`type`, ambos aplicados via `<select>`s no topo da página). Colunas: Clínica (nome + documento), Tipo (badge via `getPendencyTypeLabel`), Consultor(es) envolvido(s) (convidado, ou solicitante → atual), Status (badge — incluindo "Cancelado" quando `status === 'cancelled'`, e um badge adicional "Expirado" quando `status === 'pending'` e `isRequestExpired` for verdadeiro), Data de criação. **Somente leitura** — nenhum botão de ação (RNF-04).

### 6.4 Mudanças em API Routes

**`GET /api/tenants/[id]/consultant/invite`** (novo)
- Auth: Bearer token; exige `decodedToken.tenant_id === tenantId && decodedToken.role === 'clinic_admin'` (mesmo gate de RN-08).
- Efeito: busca o documento mais recente em `consultant_transfer_requests` com `tenant_id === tenantId`, `type === 'invite'`, `status === 'pending'`. Se encontrado e `isRequestExpired` for `true`, retorna `data: null` (RN-12 — convite expirado não é considerado "ativo" para fins desta consulta).
- Response body: `{ success: true, data: ConsultantTransferRequest | null }`

**`POST /api/tenants/[id]/consultant/invite`** (novo)
- Auth: Bearer token; exige `decodedToken.tenant_id === tenantId && decodedToken.role === 'clinic_admin'` (RN-08). `system_admin` **não** é autorizado aqui (usa UC-23 para vínculo direto).
- Request body: `{ consultant_id: string }`
- Validações: tenant existe; `tenant.consultant_id` deve estar vazio (RN-02, senão 400); consultor existe e `status === 'active'`; não existe outro convite `pending` **não expirado** para o mesmo tenant (RF-03/RN-12 — convites `pending` expirados são ignorados nesta checagem via `isRequestExpired`).
- Efeito: cria documento em `consultant_transfer_requests` com `type: 'invite'`, `status: 'pending'`, `expires_at: computeExpiresAt()` (RN-11), `requesting_consultant_id/name/code` = dados do consultor convidado, `tenant_id/name/document`, `invited_by_user_id/name` = dados do `clinic_admin` chamador. Enfileira e-mail em `email_queue` (`type: 'consultant_invite_created'`) para o consultor convidado.
- Response body: `{ success: true, data: { id: string } }`

**`DELETE /api/tenants/[id]/consultant/invite/[requestId]`** (novo — RF-13)
- Auth: Bearer token; exige `decodedToken.tenant_id === tenantId && decodedToken.role === 'clinic_admin'` (RN-08/RN-09).
- Validações: documento existe e `tenant_id === tenantId` (senão 404); `type === 'invite'` (senão 403 — "Apenas convites podem ser cancelados pela clínica", RN-09); `status === 'pending'` (senão 400 — "Este convite já foi processado"); `!isRequestExpired(doc)` (senão 400 — "Este pedido expirou", RN-11).
- Efeito: `update({ status: 'cancelled', cancelled_at: FieldValue.serverTimestamp(), cancelled_by_user_id: decodedToken.uid, updated_at: FieldValue.serverTimestamp() })`. Nenhum e-mail ou notificação in-app é criado (RN-10).
- Response body: `{ success: true, message: 'Convite cancelado com sucesso' }`

**`GET /api/consultants/transfer-requests`** (modificado)
- Request: query params `status?` (existente) e `type?` (novo, `'invite' | 'transfer'`).
- Para `is_system_admin`: comportamento inalterado (sem filtro de aprovador), com `type` aplicado se presente.
- Para consultor (não admin): antes, uma única query `where('current_consultant_id', '==', consultantId)`. Depois, duas queries em paralelo (`Promise.all`), mescladas e reordenadas por `created_at desc`:
  - Query A: `where('type', '==', 'transfer').where('current_consultant_id', '==', consultantId)`
  - Query B: `where('type', '==', 'invite').where('requesting_consultant_id', '==', consultantId)`
  - Documentos legados sem `type` são cobertos pela Query A ao normalizar `type` ausente como `'transfer'` **na escrita da query** (Firestore não indexa campos ausentes como `'transfer'` automaticamente — por isso a Query A precisa, na prática, ser executada em duas variantes: uma com `where('type', '==', 'transfer')` e outra com `where('type', '==', null)`/sem filtro de `type` combinada com filtro de `current_consultant_id`, OU simplesmente omitir o filtro de `type` na Query A e filtrar `type !== 'invite'` em memória após a leitura. Optar pela segunda abordagem — mais simples e sem exigir índice adicional para `type == null`.)
  - Response body inalterado na forma: `{ success: true, data: ConsultantTransferRequest[] }` — cada item já inclui `expires_at` (parte do schema, Seção 6.1), usado pela UI para calcular o badge "Expirado" via `isRequestExpired`. Nenhum campo `expired` é calculado/gravado no servidor (RN-11/decisão de design, Seção 4.2).

**`POST /api/consultants/transfer-requests/[id]/approve`** (modificado)
- Permissão: `isSystemAdmin || (decodedToken.is_consultant && decodedToken.consultant_id === getApproverConsultantId(transferData))`.
- Pré-checagem: se `transferData.status === 'pending'` e `isRequestExpired(transferData)`, retorna 400 `{ error: 'Este pedido expirou' }` sem alterar o documento (RN-11).
- Batch: mantém a atualização do próprio documento (`status: 'approved'`) e a atualização de `tenants/{tenant_id}` + `authorized_tenants` do consultor que passa a ficar vinculado (`requesting_consultant_id`, para os dois tipos). A etapa `arrayRemove` sobre `current_consultant_id` só é executada quando `!isInviteRequest(transferData)`.
- Notificação in-app para a clínica: mensagem passa a ser condicional — `"Consultor vinculado"` (invite aceito) vs `"Consultor alterado"` (transfer aprovado, texto atual mantido).
- Sincronização de custom claims: a remoção de claims do consultor atual só ocorre quando `!isInviteRequest`.
- E-mail: mantido apenas para `type === 'transfer'` (avisa o solicitante da aprovação); para `type === 'invite'`, nenhum e-mail é enviado nesta etapa (o próprio ator que aprovou é o destinatário natural do e-mail — seria redundante).

**`POST /api/consultants/transfer-requests/[id]/reject`** (modificado)
- Permissão: mesma fórmula de `approve`, via `getApproverConsultantId`.
- Pré-checagem: mesma verificação de expiração de `approve` — 400 `{ error: 'Este pedido expirou' }` se `status === 'pending'` e `isRequestExpired(transferData)` (RN-11).
- Efeito adicional quando `type === 'invite'`: após o `update` do documento, cria notificação in-app em `tenants/{tenant_id}/notifications` (`type: 'consultant_invite_rejected'`, RN-04) informando a recusa; **não** envia e-mail (não há "consultor solicitante" distinto do aprovador nesse tipo).
- Efeito quando `type === 'transfer'`: comportamento 100% inalterado (envia e-mail ao `requesting_consultant_id`, sem notificação in-app).

**`POST /api/consultants/claims`** (modificado — apenas CASO 2)
- Ao criar o documento de `type: 'transfer'` (linhas 172-184 hoje), passa a incluir `expires_at: computeExpiresAt()` (RN-11), usando a mesma função pura de `src/lib/consultantRequests.ts`. Nenhuma outra linha do arquivo é alterada — CASO 1 (auto-link) permanece intocado (RN-06/5.5).

**`firestore.indexes.json`** — índices compostos necessários (RNF-02):
```json
{ "collectionGroup": "consultant_transfer_requests", "fields": [
  { "fieldPath": "type", "order": "ASCENDING" },
  { "fieldPath": "requesting_consultant_id", "order": "ASCENDING" },
  { "fieldPath": "created_at", "order": "DESCENDING" }
]},
{ "collectionGroup": "consultant_transfer_requests", "fields": [
  { "fieldPath": "current_consultant_id", "order": "ASCENDING" },
  { "fieldPath": "created_at", "order": "DESCENDING" }
]},
{ "collectionGroup": "consultant_transfer_requests", "fields": [
  { "fieldPath": "status", "order": "ASCENDING" },
  { "fieldPath": "created_at", "order": "DESCENDING" }
]}
```
Nenhum índice adicional é necessário para o `GET`/cancelamento de convite (`invite/route.ts`, `invite/[requestId]/route.ts`) — ambos consultam por `tenant_id` + `type` + `status`, cobertos combinando os índices acima com o índice automático de igualdade simples do Firestore, e a expiração nunca é usada como filtro de query (Seção 5.2).

### 6.5 Impacto nos Casos de Uso (UC) Existentes

Referência para o `uml-use-case-writer` revisar cada UC após a implementação:

| UC | O que muda | RNs a revisar |
|----|-----------|----------------|
| **UC-23** (Vincular/Alterar/Remover Consultor via Painel Admin) | Nenhuma mudança de comportamento. Vale apenas registrar, na próxima revisão, que a rota `POST/DELETE /api/tenants/[id]/consultant` deixou de ser a única forma de vínculo direto sem aprovação — agora coexiste com o fluxo de convite (com aprovação, cancelamento e expiração). | RN-07 (menciona o fluxo paralelo de "solicitação de transferência" como "não investigado, fora de escopo") — pode ser atualizada para referenciar esta spec/UC-25 já implementado. |
| **UC-24** (Auto-Link) | Nenhuma mudança funcional. | Nenhuma — CASO 1 permanece intocado. |
| **UC-25** (Solicitar Transferência) | **Deixa de ser um fluxo "sem gatilho de UI"** — o botão "Solicitar Transferência" passa a existir em `/consultant/clinics/search`. Pré-condição, gatilho e fluxo principal precisam ser reescritos como implementados (hoje descritos como hipotéticos). Passa também a expirar em 15 dias (RN-11). | RN-00 (achado crítico, resolvido), RN-02 (débito técnico de expiração automática — agora resolvido por RN-11 desta spec, aplicando expiração em tempo de leitura, não Cloud Function agendada), RN-03 (a ausência de notificação in-app para o consultor atual permanece — mas agora deve referenciar RN-05 desta spec como decisão consciente, não mais lacuna não avaliada). |
| **UC-26** (Aprovar Transferência) | A tela e a rota passam a tratar dois tipos de pendência; a resolução de "quem aprova" passa a ser explícita via `getApproverConsultantId`; a rota passa a rejeitar pedidos expirados (RN-11). Frequência de uso deixa de ser "nula" (RN-04 do UC-26). | RN-04 (dependência de UC-25 resolvida), e nova regra a documentar sobre a ramificação por `type` e a checagem de expiração no batch (Seção 6.4 desta spec). |
| **UC-27** (Rejeitar Transferência) | Idem UC-26, mais o novo efeito colateral de notificação in-app quando `type === 'invite'` (RN-04 desta spec) e a checagem de expiração (RN-11) — rejeição deixa de ser "a operação mais simples do módulo" (RN-01 do UC-27 antigo) apenas para o caso `invite`. | RN-01 (grau de simplicidade não se aplica mais universalmente), RN-04 (dependência de UC-25 resolvida). |
| **UC-46** (Visualizar Consultor Vinculado) | RN-03/RN-04 resolvidas pela remoção de `TransferConsultantPage`. Um novo ponto de entrada (`/clinic/consultant/invite`) passa a existir a partir de `ConsultantTab`, mudando o Fluxo Alternativo 8b (hoje descrito como "sempre 403"). | RN-03, RN-04 (resolvidas — página removida), RN-05 (parcialmente mitigada: `/clinic/consultant/invite` é linkada a partir de `ConsultantTab`, mas `/clinic/consultant` — a página órfã standalone — continua sem link, fora de escopo aqui). |
| **Novo UC recomendado** | Sugere-se ao `uml-use-case-writer` criar um UC novo para o fluxo de convite (cenário 1a/1c, incluindo cancelamento pela clínica e expiração), em vez de forçá-lo dentro de UC-23 ou UC-24/25, já que o ator primário (Clinic Admin) e o gatilho são distintos de ambos. | N/A |

---

## 7. Plano de Implementação

### STEP 1 — Types: discriminador de pendência, status e expiração

**Objetivo:** Introduzir `ConsultantPendencyType`, o status `'cancelled'` e `expires_at`, estendendo `ConsultantTransferRequest` sem quebrar compatibilidade.

**Arquivos afetados:**
- `src/types/index.ts` — adicionar `ConsultantPendencyType`, `'cancelled'` em `ConsultantTransferRequestStatus`, campos novos/opcionais (ver Seção 6.1)

**Ações:**
1. Adicionar o tipo e os comentários de contrato exatamente como especificado na Seção 6.1.
2. Tornar `current_consultant_id`/`current_consultant_name` opcionais.
3. Adicionar `expires_at?`, `cancelled_at?`, `cancelled_by_user_id?`.

**Validação:** `npm run type-check` sem erros; nenhum consumidor existente de `ConsultantTransferRequest` quebra (checar `transfer-requests/page.tsx` e as duas rotas approve/reject antigas).

**Commit:** `feat(types): add type/status/expiration fields to ConsultantTransferRequest`

---

### STEP 2 — Types: notificação de convite rejeitado

**Arquivos afetados:**
- `src/types/notification.ts`

**Ações:**
1. Adicionar `'consultant_invite_rejected'` a `NotificationType`.

**Validação:** `npm run type-check` sem erros.

**Commit:** `feat(types): add consultant_invite_rejected notification type`

---

### STEP 3 — Módulo puro de resolução de aprovador e expiração

**Arquivos afetados:**
- `src/lib/consultantRequests.ts` (criar)

**Ações:**
1. Implementar `normalizeLegacyType`, `isInviteRequest`, `getApproverConsultantId`, `getPendencyTypeLabel` conforme Seção 6.2.
2. Implementar `PENDENCY_EXPIRY_DAYS`, `computeExpiresAt`, `isRequestExpired` conforme Seção 6.2.

**Validação:** `npm run type-check` sem erros; funções exportadas e sem dependência de Firebase (apenas o tipo `Timestamp` importado para tipagem).

**Commit:** `feat(hooks): add pure helpers for consultant pendency approver and expiration resolution`

---

### STEP 4 — Testes do módulo puro

**Arquivos afetados:**
- `src/__tests__/consultantRequests.test.ts` (criar)

**Ações:**
1. Cobrir `normalizeLegacyType` (com/sem `type`).
2. Cobrir `isInviteRequest` (`'invite'`, `'transfer'`, `undefined`).
3. Cobrir `getApproverConsultantId` para os três casos: `invite` (retorna `requesting_consultant_id`), `transfer` com `current_consultant_id` presente (retorna esse valor), `transfer` sem `current_consultant_id` (lança erro).
4. Cobrir `getPendencyTypeLabel` para os três casos de `type`.
5. Cobrir `computeExpiresAt`: retorna `created_at + 15 dias` exatos; usa a data atual quando o parâmetro é omitido.
6. Cobrir `isRequestExpired`: `expires_at` ausente → `false` (nunca expira, documento legado); `expires_at` no futuro → `false`; `expires_at` no passado → `true`.

**Validação:** `npm run test -- consultantRequests` — todos os cenários passam.

**Commit:** `test(hooks): cover consultant pendency helper functions`

---

### STEP 5 — API: criação e consulta de convite

**Arquivos afetados:**
- `src/app/api/tenants/[id]/consultant/invite/route.ts` (criar)

**Ações:**
1. Implementar `GET` conforme Seção 6.4: retorna o convite `pending` não expirado atual do tenant, ou `null`.
2. Implementar `POST` conforme Seção 6.4 (auth `clinic_admin` do tenant, validações RN-02/RF-03/RN-12, criação do documento `type: 'invite'` com `expires_at`, e-mail via `email_queue`).

**Validação:** Testar manualmente via emulador: clinic_admin sem consultor cria convite com sucesso e `GET` passa a retorná-lo; clinic_admin com consultor recebe 400 no `POST`; clinic_user recebe 403; convite duplicado (não expirado) recebe 400; um convite expirado manualmente no emulador não bloqueia a criação de um novo.

**Commit:** `feat(api): add clinic-initiated consultant invite endpoint`

---

### STEP 6 — API: cancelamento de convite

**Arquivos afetados:**
- `src/app/api/tenants/[id]/consultant/invite/[requestId]/route.ts` (criar)

**Ações:**
1. Implementar `DELETE` conforme Seção 6.4 (auth `clinic_admin` do tenant, validações de `type`/`status`/expiração — RN-09/RN-11), atualizando o documento para `status: 'cancelled'`.
2. Não criar nenhum e-mail ou notificação in-app (RN-10).

**Validação:** Testar manualmente via emulador: clinic_admin cancela seu próprio convite `pending` com sucesso; tentativa de cancelar um `type: 'transfer'` retorna 403; tentativa de cancelar um convite já `approved`/`rejected` retorna 400; tentativa de cancelar um convite expirado retorna 400 "Este pedido expirou"; clinic_admin de outro tenant recebe 404/403.

**Commit:** `feat(api): add clinic consultant invite cancellation endpoint`

---

### STEP 7 — API: generalizar listagem

**Arquivos afetados:**
- `src/app/api/consultants/transfer-requests/route.ts`

**Ações:**
1. Implementar a lógica de duas queries + merge para consultores (Seção 6.4).
2. Adicionar suporte ao query param `type`.
3. Aplicar `normalizeLegacyType` na resposta, se necessário, para não quebrar UI legada.

**Validação:** Consultor vê tanto convites recebidos quanto pedidos de transferência recebidos na mesma lista; `system_admin` continua vendo tudo; filtro `type` funciona; `expires_at` retorna corretamente para cálculo do badge no client.

**Commit:** `fix(api): generalize transfer-requests GET to cover invite and transfer types`

---

### STEP 8 — API: generalizar approve/reject e aplicar expiração

**Arquivos afetados:**
- `src/app/api/consultants/transfer-requests/[id]/approve/route.ts`
- `src/app/api/consultants/transfer-requests/[id]/reject/route.ts`
- `src/app/api/consultants/claims/route.ts` (apenas CASO 2, para gravar `expires_at`)

**Ações:**
1. Substituir a checagem `decodedToken.consultant_id === transferData.current_consultant_id` por `decodedToken.consultant_id === getApproverConsultantId(transferData)`.
2. Adicionar, em `approve` e `reject`, a pré-checagem `isRequestExpired(transferData)` quando `status === 'pending'` — retornar 400 "Este pedido expirou" sem alterar o documento (RN-11).
3. Em `approve`, ramificar o batch por `isInviteRequest` (RN-03): pular a etapa `arrayRemove` do consultor atual quando `invite`.
4. Diferenciar mensagem da notificação in-app por tipo.
5. Em `reject`, adicionar a criação da notificação `consultant_invite_rejected` quando `isInviteRequest` (RN-04).
6. Em `src/app/api/consultants/claims/route.ts`, CASO 2: adicionar `expires_at: computeExpiresAt()` ao criar o documento (linha ~172-184 hoje). Nenhuma outra linha do arquivo é tocada.

**Validação:** Fluxo completo end-to-end no emulador para os dois tipos: convite aceito, convite recusado, transferência aprovada, transferência rejeitada — conferir estado final de `tenants`, `consultants` e `notifications` em cada caso. Adicionalmente: forçar `expires_at` no passado em um documento de teste e confirmar que `approve`/`reject` retornam 400 sem alterar o documento.

**Commit:** `fix(api): generalize transfer-requests approve/reject for invite type and expiration`

---

### STEP 9 — Remover rotas órfãs de `consultant_claims`

**Arquivos afetados:**
- `src/app/api/consultants/claims/[id]/approve/route.ts` (remover)
- `src/app/api/consultants/claims/[id]/reject/route.ts` (remover)

**Ações:**
1. Excluir os dois arquivos.
2. Confirmar via grep que nenhuma tela ou outro arquivo referencia essas rotas antes de excluir.

**Validação:** `npm run build` sem erros; grep de `consultants/claims/[id]/approve` e `.../reject` retorna zero ocorrências fora do histórico de git.

**Commit:** `chore(api): remove dead consultant_claims approve/reject routes`

---

### STEP 10 — UI: tela de convite da clínica (com estado pendente e cancelamento)

**Arquivos afetados:**
- `src/app/(clinic)/clinic/consultant/invite/page.tsx` (criar, adaptado de `TransferConsultantPage`)

**Ações:**
1. Reaproveitar o formulário de busca por código (idêntico ao removido).
2. Trocar a chamada final para `POST /api/tenants/{tenantId}/consultant/invite`.
3. Ajustar textos de confirmação/sucesso (Seção 6.3).
4. Adicionar checagem de `tenant.consultant_id` já preenchido (estado bloqueado).
5. Adicionar checagem de convite `pending` não expirado via `GET /api/tenants/{tenantId}/consultant/invite`: se existir, exibir card com dados do convite e botão "Cancelar Convite" (chama `DELETE .../invite/{requestId}`) em vez do formulário.
6. Gate de role: apenas `clinic_admin`.

**Validação:** Fluxo manual: clinic_admin busca consultor válido, envia convite, vê tela de sucesso; clinic_user é redirecionado; clínica já com consultor vê estado bloqueado; clínica com convite pendente vê o card e consegue cancelar, voltando ao formulário.

**Commit:** `feat(ui): add clinic consultant invite page with pending state and cancellation`

---

### STEP 11 — UI: remover página quebrada

**Arquivos afetados:**
- `src/app/(clinic)/clinic/consultant/transfer/page.tsx` (remover)

**Ações:**
1. Excluir o arquivo.
2. Confirmar (grep) que nenhum outro arquivo faz `router.push`/`router.replace`/`<Link>` para `/clinic/consultant/transfer`.

**Validação:** `npm run build` sem erros; acesso direto à URL antiga retorna 404 (comportamento esperado do App Router).

**Commit:** `fix(ui): remove broken TransferConsultantPage and dangling references`

---

### STEP 12 — UI: gatilho de convite em `ConsultantTab`

**Arquivos afetados:**
- `src/components/clinic/ConsultantTab.tsx`

**Ações:**
1. Adicionar botão "Convidar Consultor" no estado vazio, visível apenas quando `claims?.role === 'clinic_admin'`.
2. Link para `/clinic/consultant/invite`.

**Validação:** clinic_admin sem consultor vê o botão; clinic_user não vê.

**Commit:** `fix(ui): add invite trigger to ConsultantTab empty state`

---

### STEP 13 — UI: gatilho de transferência na busca do consultor

**Arquivos afetados:**
- `src/app/(consultant)/consultant/clinics/search/page.tsx`

**Ações:**
1. Substituir o bloco informativo por um botão "Solicitar Transferência" quando `tenant.consultant_id` existir.
2. Reaproveitar `handleLink` (já chama `POST /api/consultants/claims`) — nenhuma mudança de payload necessária, pois o backend (CASO 2) já trata esse caso.
3. Estado local para marcar "Pedido enviado" após sucesso.

**Validação:** Consultor busca clínica com consultor vinculado, clica "Solicitar Transferência", recebe confirmação de sucesso; documento `type: 'transfer'` é criado com `expires_at` preenchido (verificar no emulador).

**Commit:** `feat(ui): add transfer request trigger to consultant clinic search`

---

### STEP 14 — UI: diferenciar textos por tipo e expiração na tela do consultor

**Arquivos afetados:**
- `src/app/(consultant)/consultant/transfer-requests/page.tsx`

**Ações:**
1. Importar `getPendencyTypeLabel`/`isInviteRequest`/`isRequestExpired` de `src/lib/consultantRequests.ts`.
2. Adicionar badge de tipo no `RequestCard`.
3. Condicionar o texto do corpo do card por `request.type` (Seção 6.3).
4. Adicionar badge "Expirado" e desabilitar botões "Aprovar"/"Rejeitar" quando `isRequestExpired(request)` for verdadeiro para uma pendência `pending`.

**Validação:** Um convite pendente exibe "A clínica {tenant_name} convidou você..."; um pedido de transferência exibe o texto atual, inalterado; uma pendência expirada exibe o badge e os botões ficam desabilitados.

**Commit:** `fix(ui): differentiate invite vs transfer copy and expiration badge on consultant transfer-requests page`

---

### STEP 15 — UI: tela de System Admin

**Arquivos afetados:**
- `src/app/(admin)/admin/consultant-pendencies/page.tsx` (criar)
- `src/components/admin/AdminLayout.tsx` (adicionar item de navegação)

**Ações:**
1. Criar a tela consumindo `GET /api/consultants/transfer-requests` com filtros de `status`/`type` no client.
2. Renderizar tabela somente leitura (Seção 6.3), incluindo badges "Cancelado" e "Expirado".
3. Adicionar item "Pendências de Consultor" (ícone `ArrowRightLeft`) em `AdminLayout.navigation`, posicionado após "Consultores".

**Validação:** System Admin vê todas as pendências (convite + transferência) de todas as clínicas, incluindo canceladas e expiradas; filtros funcionam; nenhum botão de ação é exibido.

**Commit:** `feat(admin): add read-only consultant pendencies screen for system admin`

---

### STEP 16 — Firestore: índices compostos

**Arquivos afetados:**
- `firestore.indexes.json`

**Ações:**
1. Adicionar os três índices especificados na Seção 6.4.
2. `firebase deploy --only firestore:indexes` no ambiente de validação pessoal antes do PR para `develop`.

**Validação:** Consultas do Step 7 não retornam erro de índice ausente no emulador/ambiente pessoal.

**Commit:** `chore(firebase): add composite indexes for consultant pendency queries`

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-------------------|------------------------|
| `normalizeLegacyType` | `src/__tests__/consultantRequests.test.ts` | `type` presente (`'invite'`, `'transfer'`) retorna o mesmo valor; `type` ausente retorna `'transfer'` |
| `isInviteRequest` | `src/__tests__/consultantRequests.test.ts` | `type: 'invite'` → `true`; `type: 'transfer'` → `false`; `type` ausente → `false` |
| `getApproverConsultantId` | `src/__tests__/consultantRequests.test.ts` | `invite` retorna `requesting_consultant_id`; `transfer` com `current_consultant_id` retorna esse valor; `transfer` sem `current_consultant_id` lança erro |
| `getPendencyTypeLabel` | `src/__tests__/consultantRequests.test.ts` | `'invite'` → `'Convite'`; `'transfer'` → `'Transferência'`; `undefined` → `'Transferência'` |
| `computeExpiresAt` | `src/__tests__/consultantRequests.test.ts` | Retorna `created_at + 15 dias` exatos; usa `new Date()` quando parâmetro omitido |
| `isRequestExpired` | `src/__tests__/consultantRequests.test.ts` | `expires_at` ausente → `false`; `expires_at` no futuro → `false`; `expires_at` no passado → `true` |

**Regras aplicadas (conforme convenção do projeto):**
- `src/lib/consultantRequests.ts` é um módulo de funções puras (sem I/O, sem Firebase) — **sempre testar**, prioridade alta por concentrar a lógica de autorização de aprovação e de expiração (equivalente a lógica de segurança).
- API routes (`invite/route.ts`, `invite/[requestId]/route.ts`, `transfer-requests/route.ts`, `approve/route.ts`, `reject/route.ts`) — **não testadas** com Jest, por dependência direta do Firebase Admin SDK (mock frágil no MVP), consistente com o padrão já adotado em `BUG-consultor-vinculo-automatico.md` para as rotas irmãs.
- Componentes React/páginas (`invite/page.tsx`, `consultant-pendencies/page.tsx`, alterações em `ConsultantTab.tsx`, `search/page.tsx`, `transfer-requests/page.tsx`) — **não testados** no MVP, conforme convenção do projeto para componentes com dependência de Firebase/fetch.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — todos os testes passando, incluindo consultantRequests.test.ts (aprovador e expiração)
[ ] Multi-tenant: toda leitura/escrita de consultant_transfer_requests continua isolada por tenant_id, exclusivamente via API routes (Admin SDK)
[ ] Segurança: nenhum secret ou credencial no código
[ ] Branch pessoal: task branch mergeada na branch pessoal para validação no Firebase
[ ] PR: aberto para develop com template preenchido
[ ] Clinic Admin sem consultor consegue enviar convite; Clinic User não vê a opção
[ ] Clínica já com consultor vê estado bloqueado em /clinic/consultant/invite (RN-02)
[ ] Consultor convidado vê o convite em /consultant/transfer-requests com texto diferenciado
[ ] Aceitar convite: vínculo efetivado, sem etapa de remoção de consultor anterior (RN-03)
[ ] Recusar convite: clínica recebe notificação in-app consultant_invite_rejected (RN-04)
[ ] Consultor consegue solicitar transferência a partir de /consultant/clinics/search (gatilho do UC-25 implementado)
[ ] Aprovar/rejeitar transferência (UC-26/27) continua funcionando sem regressão, incluindo para documentos legados sem campo type
[ ] System Admin vê lista consolidada somente leitura em /admin/consultant-pendencies, com filtros de status e tipo
[ ] TransferConsultantPage removida; acesso à URL antiga retorna 404; nenhuma referência interna restante
[ ] Rotas consultants/claims/[id]/approve e reject removidas; build não quebra
[ ] Índices compostos de firestore.indexes.json implantados no ambiente de validação
[ ] Rota POST/DELETE /api/tenants/[id]/consultant (UC-23) segue funcionando sem alteração
[ ] Clinic Admin consegue cancelar um convite pending antes da resposta do consultor (RF-13); botão não aparece para convites já aceitos/recusados/expirados
[ ] Cancelamento de convite não envia e-mail nem notificação in-app ao consultor convidado (RN-10)
[ ] Pendência pending com expires_at no passado: approve/reject/cancel retornam 400 "Este pedido expirou" sem alterar o documento (RN-11)
[ ] Convite pending expirado não bloqueia o envio de um novo convite pela mesma clínica (RN-12)
[ ] Listagens (consultor e admin) exibem badge "Expirado" calculado via isRequestExpired, sem exigir novo status gravado no banco
[ ] POST /api/consultants/claims (CASO 2) grava expires_at ao criar pedido de transferência, sem alterar o comportamento do CASO 1 (auto-link)
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Query dupla (transfer + invite) no `GET /api/consultants/transfer-requests` exige índice composto ausente, causando erro em produção | Média | Alto | Índices declarados explicitamente em `firestore.indexes.json` (Step 16) e implantados no ambiente pessoal antes do PR para `develop`; testar a consulta no emulador antes de mergear |
| Documento legado sem `type` é mal interpretado por algum ponto do código que não usa `normalizeLegacyType`/`getApproverConsultantId` | Baixa (poucos ou nenhum documento legado, RN da Seção 5.4) | Médio | Centralizar toda leitura de `type` nas funções puras de `consultantRequests.ts`; nenhuma rota ou tela deve comparar `request.type === 'transfer'` diretamente |
| Ausência de notificação in-app para consultores (RN-05) gera reclamações de suporte por convites/transferências não vistos a tempo | Média | Médio | Documentado explicitamente como débito técnico consciente (Seção 3.3, RN-05); e-mail continua sendo o canal, mesmo padrão já aceito em UC-25/26/27 |
| Remoção de `TransferConsultantPage`/rotas de `consultant_claims` quebra algum fluxo não mapeado | Baixa | Alto | Confirmado por grep exaustivo (Seção 5.3) antes da remoção; validação de build após cada remoção (Steps 9 e 11) |
| Pendência `pending` expirada permanece indefinidamente no Firestore sem processo de limpeza, podendo poluir listagens ao longo do tempo | Média | Baixo | Aceito como trade-off (Seção 4.3); badge "Expirado" deixa claro o estado nas telas de consultor e admin; uma eventual rotina de arquivamento é incremento futuro, fora de escopo |
| Alguma rota ou tela nova compara `expires_at`/`status` diretamente em vez de usar `isRequestExpired`, divergindo do comportamento centralizado (ex.: fuso horário, formato de data do client SDK vs Admin SDK) | Baixa | Médio | `isRequestExpired` trata tanto `Timestamp` do Admin SDK quanto string/Date, centralizando a comparação; cobertura de teste dedicada (Seção 8) fixa o contrato |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Auto-link | Vínculo imediato entre consultor e clínica, sem aprovação de ninguém, quando a clínica não tem consultor (UC-24) |
| Convite (`type: 'invite'`) | Pendência iniciada pela clínica, propondo um consultor específico; só existe quando a clínica não tem consultor vinculado; pode ser cancelada pela própria clínica antes da resposta do consultor (RF-13) |
| Transferência (`type: 'transfer'`) | Pendência iniciada por um consultor, propondo assumir uma clínica já vinculada a outro consultor (UC-25); não pode ser cancelada pela clínica (RN-09) |
| Aprovador | O consultor cuja decisão (aprovar/rejeitar) é necessária para uma pendência avançar — resolvido por `getApproverConsultantId` |
| Pendência | Termo genérico usado nesta spec para qualquer documento em `consultant_transfer_requests`, seja `invite` ou `transfer` |
| Convite cancelado (`status: 'cancelled'`) | Convite `type: 'invite'` que a própria clínica cancelou antes de o consultor responder; estado terminal, distinto de `'rejected'` (que é decisão do consultor) — só existe para `type: 'invite'` |
| Expirado | Estado **calculado** (nunca gravado como novo `status`) de uma pendência `pending` cujo `expires_at` já passou; após 15 dias, deixa de ser acionável — `approve`/`reject`/`cancel` retornam erro |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/UC-23-vincular-alterar-remover-consultor-da-clinica.md`
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-24-vincular-se-automaticamente-a-clinica-sem-consultor.md`
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-25-solicitar-transferencia-de-clinica-ja-vinculada.md`
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-26-aprovar-pedido-de-transferencia-de-clinica.md`
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-27-rejeitar-pedido-de-transferencia-de-clinica.md`
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-46-visualizar-consultor-vinculado-a-clinica.md`
- `ONLY_FOR_DEVS/TO_DO/BUG-consultor-vinculo-automatico.md` (spec original que introduziu `consultant_transfer_requests`, UC-24/25)
- `src/app/api/consultants/claims/route.ts`
- `src/app/api/consultants/transfer-requests/route.ts`, `[id]/approve/route.ts`, `[id]/reject/route.ts`
- `src/app/api/tenants/[id]/consultant/route.ts`
- `src/lib/services/passwordResetService.ts` (padrão de expiração `expires_at` reaproveitado nesta spec — RN-11)
- `src/app/(clinic)/clinic/consultant/transfer/page.tsx`
- `src/components/clinic/ConsultantTab.tsx`
- `src/app/(consultant)/consultant/clinics/search/page.tsx`
- `src/app/(consultant)/consultant/transfer-requests/page.tsx`
- `src/components/admin/AdminLayout.tsx`
- `firestore.rules`, `firestore.indexes.json`

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 18/07/2026 | Doc Writer (Claude) | Versão inicial. Investigado o estado atual dos quatro mecanismos paralelos de vínculo consultor-clínica (auto-link, transferência sem gatilho, painel admin, página quebrada) e o código morto associado (`consultants/claims/[id]/approve\|reject`). Especificada a generalização da coleção `consultant_transfer_requests` com campo discriminador `type`, o novo fluxo de convite pela clínica, o gatilho de UI que faltava para UC-25, a generalização das telas/rotas de aprovação (UC-26/27) e a nova tela somente leitura de System Admin. |
| 1.1 | 18/07/2026 | Doc Writer (Claude) | Incorporadas as respostas do PO às 4 Decisões Necessárias da v1.0: (1) RF-03 confirmado como decisão definitiva, sem incerteza; (2) adicionado cancelamento de convite pelo Clinic Admin (RF-13, novo status `'cancelled'`, novo endpoint `DELETE /api/tenants/[id]/consultant/invite/[requestId]`, novo estado da tela `/clinic/consultant/invite`), sem notificação ao consultor convidado (RN-10); (3) adicionada expiração de 15 dias para `invite` e `transfer` (RF-14, campo `expires_at`, funções puras `computeExpiresAt`/`isRequestExpired`), seguindo o padrão de `passwordResetService.ts` (checagem em tempo de leitura, sem Cloud Function agendada) — inclui alteração de `src/app/api/consultants/claims/route.ts` (CASO 2) para gravar `expires_at`; convites expirados deixam de bloquear a criação de novos convites (RN-12); (4) mantida a decisão de não renomear `requesting_consultant_id`, agora como decisão confirmada e não mais em aberto. Plano de Implementação renumerado de 15 para 16 Steps. Seção "Decisões Necessárias" substituída por "Decisões Confirmadas pelo PO". |

---

## Decisões Confirmadas pelo PO (v1.1)

Todos os itens listados como "Decisões Necessárias" na v1.0 foram respondidos pelo PO e incorporados nesta revisão. **Não há decisões em aberto nesta versão.**

1. **RF-03 — Convites simultâneos.** Confirmado: uma clínica sem consultor só pode ter **um** convite `pending` não expirado por vez (para qualquer consultor). Era o comportamento já assumido por padrão na v1.0; agora é definitivo — ver RN-02/RF-03/RN-12.
2. **Cancelamento de convite pelo Clinic Admin.** Confirmado: **SIM**, é necessário. Implementado via `DELETE /api/tenants/[id]/consultant/invite/[requestId]` (RF-13, Seção 6.4) e um botão "Cancelar Convite" na própria tela `/clinic/consultant/invite`, que passa a mostrar o convite pendente atual em vez do formulário de busca quando já existe um (Seção 6.3, Step 10) — escolhido em vez de duplicar essa ação em `ConsultantTab`, já que só pode haver um convite ativo por vez. A decisão de **não** notificar o consultor convidado sobre o cancelamento está documentada e justificada em RN-10 (ele ainda não havia sido formalmente engajado).
3. **Prazo de expiração (15 dias).** Confirmado: necessário para os dois tipos (`invite` e `transfer`). Implementado seguindo o padrão já usado em `password_reset_tokens`/`passwordResetService.ts` — campo `expires_at` gravado no documento na criação, checado em tempo de leitura, **sem** Cloud Function agendada (RN-11, Seção 4.1/6.4). `src/app/api/consultants/claims/route.ts` (CASO 2) foi incluído no escopo de modificação desta spec para gravar `expires_at` em novos pedidos de transferência — apenas novos documentos passam a ter expiração; documentos legados sem o campo são tratados como "nunca expiram" (Seção 5.4). A expiração é calculada em tempo real (client e servidor) via `isRequestExpired`, sem gravar um novo status `'expired'` no banco — decisão justificada em detalhe na Seção 4.2 (evita escrita extra por leitura, evita condição de corrida, mantém uma única fonte de verdade).
4. **Nome do campo `requesting_consultant_id` para o caso `invite`.** Confirmado: **mantido**, sem renomeação — decisão que já era a assumida na v1.0 (para minimizar o diff em rotas já estáveis), agora ratificada como definitiva pelo PO, que deixou a critério do time. Ver Seção 4.2/4.3 para o racional completo.
