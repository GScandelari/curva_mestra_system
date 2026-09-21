# UC-26: Aprovar Pedido de Transferência de Clínica

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Portal do Consultor (Vínculo com Clínicas)
**Versão:** 1.1

> O consultor que deve decidir sobre uma pendência — o consultor atual de uma clínica (pedido de transferência, UC-25) ou o consultor convidado por uma clínica sem vínculo (convite, UC-54) — visualiza, em `/consultant/transfer-requests`, as pendências dirigidas a ele e pode aprová-las (aceitar a transferência ou aceitar o convite). A mesma tela, a mesma ação "Aprovar" e a mesma rota atendem os dois cenários, diferenciados internamente pelo campo `type` (`'invite' | 'transfer'`) do documento. **Atualização (v1.1):** até a v1.0.1, esta tela estava condenada a ficar sempre vazia, pois nenhum pedido de transferência chegava a ser criado (UC-25 sem gatilho de UI) e o cenário de convite ainda não existia. Ambos os gatilhos foram implementados em `feature/consultor-vinculo-convite-transferencia`, e a rota passou a resolver "quem aprova" via uma função pura (`getApproverConsultantId`) e a rejeitar pendências expiradas (15 dias). Ver Seção 15 para o detalhamento completo.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ConsultorAprovador([👤 Consultor Aprovador\n(atual, ou convidado)])

    subgraph Sistema["Curva Mestra — Portal do Consultor"]
        UC26(("UC-26\nAprovar Pedido\n(transferência ou convite)"))
    end

    subgraph Origem["Cria a pendência"]
        UC25(("UC-25\nSolicitar Transferência\n(type: transfer)"))
        UC54(("UC-54\nConvidar Consultor\n(type: invite)"))
    end

    UC25 -->|cria consultant_transfer_requests| UC26
    UC54 -->|cria consultant_transfer_requests| UC26
    ConsultorAprovador --> UC26
```

---

## 2. Atores

### 2.1 Ator Primário
**Consultor Rennova (aprovador)** — resolvido por tipo de pendência via `getApproverConsultantId`: para `type: 'transfer'`, é o consultor hoje vinculado à clínica (`current_consultant_id`); para `type: 'invite'`, é o próprio consultor convidado (`requesting_consultant_id`, que decide sobre si mesmo).

### 2.2 Atores Secundários / Sistemas Externos
- **Consultor Rennova (solicitante)** — apenas em `type: 'transfer'`: recebe um e-mail informando a aprovação. Em `type: 'invite'`, não recebe e-mail nesta etapa (o próprio ator que aprovou é o destinatário natural do convite).
- **Clínica (tenant)** afetada — recebe uma notificação informativa in-app sobre o novo vínculo (texto diferenciado por tipo).
- **System Admin** — também pode aprovar qualquer pendência, de ambos os tipos (não só o aprovador natural — RN-02).

---

## 3. Pré-condições
- Consultor autenticado, `is_consultant === true`, `consultant_id` presente no token — **e** esse `consultant_id` deve coincidir com o aprovador da pendência, resolvido por `getApproverConsultantId(transferData)` (ou o chamador é `system_admin`).
- Existe um documento em `consultant_transfer_requests` com `status === 'pending'` referenciando este consultor como aprovador (via `current_consultant_id` para `transfer`, ou `requesting_consultant_id` para `invite`).
- O documento **não** está expirado — `expires_at` (created_at + 15 dias) ainda não passou, ou está ausente (documento legado, nunca expira).

---

## 4. Pós-condições

### 4.1 Sucesso
- `consultant_transfer_requests/{id}.status` passa para `'approved'`.
- `consultants/{consultor_aprovador}.authorized_tenants` deixa de incluir o `tenant_id` — **apenas quando `type === 'transfer'`**; para `type === 'invite'`, esta etapa é pulada por definição não existir um "consultor atual" (RN-05).
- `consultants/{consultor_que_fica_vinculado}.authorized_tenants` passa a incluir o `tenant_id` (o consultor solicitante, em `transfer`; o próprio consultor convidado/aprovador, em `invite`).
- `tenants/{tenant_id}.consultant_id/consultant_code/consultant_name` passam a refletir o consultor que fica vinculado.
- Uma notificação informativa é criada em `tenants/{tenant_id}/notifications` (`type: 'consultant_linked'`), com texto condicional: "Consultor vinculado" (convite aceito) ou "Consultor alterado" (transferência aprovada).
- Os custom claims do consultor que fica vinculado (e, em `transfer`, também do consultor atual que perde a clínica) são atualizados via `syncConsultantAuthorizedTenants`, sequencialmente e fora da transação (mesma janela de inconsistência de RN-03 do UC-23); o resultado (`claims_synced: boolean`) é retornado explicitamente na resposta.
- Um e-mail é enfileirado para o consultor solicitante avisando da aprovação — **apenas para `type === 'transfer'`**; para `invite`, nenhum e-mail é enviado nesta etapa (RN-06).

### 4.2 Falha
- Se o pedido já tiver sido processado (`status !== 'pending'`): nenhuma alteração é feita, erro 400.
- Se o pedido estiver `pending` mas expirado (`expires_at` no passado): nenhuma alteração é feita, erro 400 "Este pedido expirou" (RN-08).
- Se o `batch` for commitado mas a sincronização de custom claims falhar depois: a etapa está protegida pelo utilitário compartilhado `syncConsultantAuthorizedTenants`, que nunca propaga exceção — a resposta deixa de ser um 500 e passa a ser `success: true` com `claims_synced: false`, mesmo padrão unificado com UC-23 e UC-24 (RN-04).

---

## 5. Gatilho (Trigger)
Consultor aprovador acessa `/consultant/transfer-requests`, aba "Pendentes", e clica em "Aprovar" numa pendência dirigida a ele (transferência recebida ou convite recebido).

---

## 6. Fluxo Principal (Basic Flow)

1. Consultor acessa `/consultant/transfer-requests` (Portal do Consultor).
2. Sistema chama `GET /api/consultants/transfer-requests` com o Bearer token; para o chamador consultor (não admin), a API executa **duas consultas em paralelo** — uma por `current_consultant_id` (pendências de transferência em que ele é o aprovador) e outra por `type: 'invite'` + `requesting_consultant_id` (convites recebidos) — mescla e ordena por `created_at desc` em memória (`system_admin` continua vendo todas as pendências, sem filtro de aprovador).
3. Sistema exibe as pendências em duas abas: "Pendentes" (com badge de contagem) e "Histórico" (aprovados/rejeitados/cancelados).
4. Para cada pendência pendente, o `RequestCard` exibe: badge de tipo ("Convite" ou "Transferência", via `getPendencyTypeLabel`), badge de status, nome/documento da clínica, texto condicional por tipo (`"A clínica {tenant_name} convidou você..."` para convite, `"Solicitante: {nome} ({código})"` para transferência), data de recebimento, um badge "Expirado" quando aplicável, e os botões "Aprovar" e "Rejeitar" (desabilitados se a pendência estiver expirada).
5. Consultor clica em "Aprovar" — **sem nenhuma confirmação adicional** (nem `confirm()` nativo, nem diálogo) — RN-01.
6. Sistema chama `POST /api/consultants/transfer-requests/{id}/approve` com o Bearer token.
7. API busca o documento; resolve o aprovador esperado via `getApproverConsultantId(transferData)` (RN-03); valida permissão (`is_system_admin` OU `is_consultant && consultant_id === approverConsultantId`); verifica que `status === 'pending'`; verifica que o pedido **não está expirado** (`isRequestExpired`), retornando 400 caso esteja (RN-08).
8. API busca os dados do consultor que ficará vinculado (`requesting_consultant_id`) e da clínica.
9. API executa um `batch` atômico: atualiza a pendência para `status: 'approved'`; **ramifica por tipo (RN-05)** — se `type === 'transfer'`, remove `tenant_id` de `authorized_tenants` do consultor atual; se `type === 'invite'`, pula essa etapa; em ambos os casos, adiciona `tenant_id` a `authorized_tenants` do consultor que fica vinculado; atualiza `tenants/{tenant_id}` com os dados do novo consultor; cria a notificação informativa para o `clinic_admin`, com texto condicional por tipo.
10. Após o commit do `batch`, API chama `syncConsultantAuthorizedTenants` (utilitário compartilhado) para atualizar, sequencialmente e fora da transação, os custom claims do consultor que fica vinculado e, apenas em `transfer`, do consultor atual que perde a clínica — a função nunca propaga exceção; a API acumula o resultado em `claimsSynced` (RN-04).
11. API enfileira um e-mail para o consultor solicitante avisando da aprovação — **apenas para `type === 'transfer'`** (RN-06) — e retorna `{ success: true, claims_synced, message }`, com a mensagem condicional ("Convite aceito com sucesso" ou "Transferência aprovada com sucesso").
12. Sistema exibe a mensagem de sucesso e recarrega a lista de pendências.
13. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos
Nenhum identificado além do fluxo principal.

---

## 8. Fluxos de Exceção

### 8a. Pedido já processado
1. `status !== 'pending'` no momento da chamada (ex.: já foi aprovado/rejeitado/cancelado por outra aba/dispositivo).
2. API retorna 400 ("Pedido já foi processado"); nenhuma alteração é feita.

### 8b. Pedido, consultor solicitante ou clínica não encontrados
1. Algum dos documentos referenciados não existe mais (ex.: consultor solicitante foi excluído entre a criação do pedido e a aprovação).
2. API retorna 404; nenhuma alteração é feita.

### 8c. Chamador sem permissão
1. Consultor autenticado não é o aprovador resolvido por `getApproverConsultantId`, nem `system_admin`.
2. API retorna 403.

### 8d. Falha ao sincronizar custom claims após o batch já commitado
1. `adminAuth.getUser`/`adminAuth.setCustomUserClaims` falha para algum dos consultores envolvidos, dentro de `syncConsultantAuthorizedTenants`.
2. A função captura o erro internamente e retorna `{ synced: false, error }` sem propagar exceção. A rota retorna `success: true` com `claims_synced: false` — o usuário não vê uma mensagem de erro enganosa quando a mudança já foi efetivamente realizada nos dados (RN-04).

### 8e. Pendência expirada (a partir do passo 7)
1. O documento está `pending`, mas `expires_at` (created_at + 15 dias) já passou.
2. API retorna 400 ("Este pedido expirou") **sem alterar o documento** — nenhum novo status é gravado; a pendência permanece `pending`/expirada indefinidamente, apenas deixa de ser acionável (RN-08).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A aprovação não exige nenhuma confirmação adicional na UI (nem `confirm()` nativo) — um único clique em "Aprovar" já executa a transferência ou a aceitação do convite, para os dois tipos. | Confirmado por leitura de `handleApprove` na tela — chama a API diretamente, sem diálogo de confirmação. |
| RN-02 | Um `system_admin` também pode aprovar qualquer pendência (transferência ou convite), não apenas o aprovador natural — a API não distingue a origem, apenas verifica a permissão via `getApproverConsultantId`. Não existe, na tela do Portal do Consultor, nenhuma visão administrativa desta lista — um `system_admin` só conseguiria aprovar chamando a API diretamente (a tela somente-leitura de pendências para System Admin, se implementada, não expõe ação de aprovar/rejeitar). | Confirmado por leitura da checagem de permissão em `transfer-requests/[id]/approve/route.ts`. |
| RN-03 | **[Novo, v1.1]** A resolução de "quem deve aprovar" é centralizada na função pura `getApproverConsultantId` (`src/lib/consultantRequests.ts`): para `type: 'invite'`, retorna `requesting_consultant_id` (o próprio consultor convidado decide sobre si mesmo); para `type: 'transfer'` (ou documentos legados sem `type`), retorna `current_consultant_id`, lançando erro se esse campo estiver ausente (estado de dado inválido para esse tipo). A rota não duplica essa lógica com um `if/else` local. | Confirmado por leitura de `getApproverConsultantId` e do seu uso em `approve/route.ts`. |
| RN-04 | A sincronização de custom claims após o `batch` usa o utilitário compartilhado `syncConsultantAuthorizedTenants` (`src/lib/services/consultantClaimsSync.ts`, mesmo usado por UC-23 e UC-24). Uma falha nessa etapa não propaga exceção; a resposta deixa de ser um 500 mesmo com os documentos Firestore já definitivamente alterados — passa a ser `success: true` com `claims_synced: false` explícito. A limitação de plataforma em si (claims fora da transação Firestore) permanece. | Confirmado por leitura de `approve/route.ts` — chamadas a `syncConsultantAuthorizedTenants`, resposta inclui `claims_synced`. |
| RN-05 | **[Novo, v1.1]** O `batch` de aprovação ramifica por tipo: quando `type === 'invite'`, a etapa de `arrayRemove` sobre `authorized_tenants` do "consultor atual" é **pulada**, pois por definição não existe consultor atual nesse cenário (a clínica não tinha nenhum vínculo antes do convite). Essa ramificação usa `isInviteRequest(transferData)`, também de `src/lib/consultantRequests.ts`. | Confirmado por leitura literal do `batch` em `approve/route.ts` — bloco `if (!isInvite && current_consultant_id) { ... }` isolando a remoção do consultor atual. |
| RN-06 | **[Novo, v1.1]** O e-mail de aprovação para o "consultor solicitante" só é enviado quando `type === 'transfer'`. Para `type === 'invite'`, nenhum e-mail é enviado nesta etapa — o próprio ator que clicou em "Aprovar" é o consultor convidado, destinatário natural do convite; um e-mail aqui seria redundante (ele acabou de agir, não precisa ser avisado do próprio resultado). | Confirmado por leitura de `approve/route.ts` — bloco de envio de e-mail condicionado a `if (!isInvite)`. |
| RN-07 | **[Renumerado, antiga RN-04]** Este fluxo depende de uma pendência `pending` e não expirada dirigida ao consultor autenticado — criada por UC-25 (transferência) ou UC-54 (convite), ambos agora com gatilho de UI implementado. Diferente das versões anteriores deste documento, a tela **não está mais condenada a ficar sempre vazia**. | Consequência direta da implementação de UC-25/UC-54. |
| RN-08 | **[Novo, v1.1]** Uma pendência `pending` cujo `expires_at` (created_at + 15 dias) já passou não pode mais ser aprovada — a API retorna 400 ("Este pedido expirou") **sem alterar o documento** (nenhum novo status é gravado; a checagem é sempre feita em tempo de leitura via `isRequestExpired`, nunca por Cloud Function agendada). Documentos legados sem `expires_at` nunca são considerados expirados. | Confirmado por leitura de `isRequestExpired`/`computeExpiresAt` em `src/lib/consultantRequests.ts` e da pré-checagem em `approve/route.ts`, antes do `batch`. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | A listagem de pendências (`GET /api/consultants/transfer-requests`) usa `orderBy('created_at', 'desc')` em cada uma das (até duas) consultas por consultor, sem paginação — pode se tornar um problema de performance/custo conforme o volume crescer, agora que o gatilho de UI existe para os dois tipos. | Performance |
| RNF-02 | As duas consultas por aprovador (`current_consultant_id` para `transfer`, `type + requesting_consultant_id` para `invite`) exigem índices compostos dedicados em `firestore.indexes.json`, implantados junto com esta feature. | Performance |

---

## 11. Frequência de Uso
Recém-implementado — sem dados de uso em produção ainda. Deixa de ser "nula" (como registrado nas versões anteriores), já que ambos os gatilhos que alimentam esta tela (UC-25 e UC-54) agora existem.

---

## 12. Casos de Uso Relacionados
- **UC-25 (Solicitar Transferência de Clínica Já Vinculada)** — cria pendências `type: 'transfer'` consumidas por este UC.
- **UC-54 (Convidar Consultor para a Clínica)** — cria pendências `type: 'invite'` também consumidas por este UC, na mesma tela e rota.
- **UC-27 (Rejeitar Pedido de Transferência de Clínica)** — ação alternativa disponível na mesma tela, para a mesma pendência.
- **UC-23 (Vincular/Alterar/Remover Consultor via Painel Admin)** — mecanismo equivalente e sempre funcional para o `system_admin`, que não depende deste ciclo de aprovação. Compartilha o mesmo utilitário `src/lib/services/consultantClaimsSync.ts` para sincronização de claims (junto com UC-24).

---

## 13. Referências
- `src/app/(consultant)/consultant/transfer-requests/page.tsx`
- `src/app/api/consultants/transfer-requests/route.ts` (GET — generalizado para duas consultas)
- `src/app/api/consultants/transfer-requests/[id]/approve/route.ts` (generalizado para dois tipos e expiração)
- `src/lib/consultantRequests.ts` (`getApproverConsultantId`, `isInviteRequest`, `isRequestExpired`, `getPendencyTypeLabel`)
- `src/lib/services/consultantClaimsSync.ts` (utilitário compartilhado de sincronização de claims — RN-04)
- `src/types/index.ts` (`ConsultantTransferRequest`, `ConsultantPendencyType`)
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-unificacao-vinculo-transferencia-consultor.md` (spec de implementação)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. ~~**[RN-07, herdado do UC-25]** Este UC só passa a ser útil na prática se o gatilho do UC-25 for implementado.~~ **[RESOLVIDO em v1.1]** Gatilho de UC-25 implementado, e novo gatilho de UC-54 (convite) adicionado.
2. **[RN-01]** Ausência de confirmação antes de uma ação irreversível (troca ou vínculo de consultor de uma clínica) — vale avaliar se deveria haver um `confirm()` ou diálogo, como ocorre em praticamente todas as outras ações equivalentes já mapeadas no sistema. Ainda em aberto.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Fluxo de aprovação documentado como corretamente implementado do lado "consumidor", mas dependente do gatilho ausente identificado no UC-25 (RN-04). Identificado achado de atomicidade mais grave que o padrão já visto em UCs anteriores: falha na sincronização de custom claims pode gerar erro 500 reportado ao usuário mesmo com os dados já definitivamente alterados (RN-03), e ausência de confirmação antes de uma ação irreversível (RN-01). Terceiro de 4 UCs do módulo "Consultor — vínculo com clínicas" (UC-24 a UC-27). |
| 1.0.1 | 24/07/2026 | Guilherme Scandelari | Correção pontual (commit `001671b`): RN-03 marcada como corrigida — a sincronização de custom claims em `POST /api/consultants/transfer-requests/[id]/approve`, antes sem nenhum `try/catch` (o achado de atomicidade mais grave dos três UCs deste padrão), passou a usar o utilitário compartilhado `src/lib/services/consultantClaimsSync.ts`; falha nessa etapa deixa de derrubar a resposta com 500 e passa a ser reportada via `claims_synced: boolean`. Seções 4.1, 4.2, 6 (passos 10-11), 8d, 9, 12, 13 e 14 atualizadas. Este UC continua, na prática, sem uso real, por dependência do gatilho ausente do UC-25 (RN-04, inalterado). |
| 1.1 | 13/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | Revisão pós-implementação de `feature/consultor-vinculo-convite-transferencia`: a rota e a tela passam a tratar dois tipos de pendência (`transfer` e o novo `invite`, criado por UC-54), com a resolução de "quem aprova" centralizada em `getApproverConsultantId` (novo RN-03); o `batch` ramifica por tipo, pulando a remoção do "consultor atual" quando `invite` (novo RN-05); o e-mail de aprovação só é enviado para `transfer` (novo RN-06); pendências expiradas (15 dias) passam a ser rejeitadas com 400, sem alteração do documento (novo RN-08). Ator primário generalizado para "consultor aprovador"; título do diagrama, atores, pré/pós-condições, gatilho e fluxo principal atualizados. Antiga RN-04 (dependência de UC-25) renumerada para RN-07 e marcada como resolvida. Frequência de uso deixa de ser "nula". |
