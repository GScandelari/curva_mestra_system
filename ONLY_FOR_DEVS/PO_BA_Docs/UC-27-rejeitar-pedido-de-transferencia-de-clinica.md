# UC-27: Rejeitar Pedido de Transferência de Clínica

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Portal do Consultor (Vínculo com Clínicas)
**Versão:** 1.1

> O consultor que deve decidir sobre uma pendência — o consultor atual (pedido de transferência, UC-25) ou o consultor convidado (convite, UC-54) — pode rejeitá-la, com um motivo opcional. A mesma tela, o mesmo diálogo de rejeição e a mesma rota atendem os dois cenários. **Atualização (v1.1):** até a v1.0, esta tela dependia de um pedido `pending` que, na prática, nunca era criado (UC-25 sem gatilho de UI). Ambos os gatilhos (UC-25 e o novo UC-54) foram implementados; a rota passou a resolver "quem rejeita" via `getApproverConsultantId`, a checar expiração (15 dias), e — novidade nesta revisão — a rejeição de um **convite** passou a notificar a clínica in-app, efeito colateral que não existe para a rejeição de uma transferência. Ver Seção 15.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ConsultorAprovador([👤 Consultor Aprovador\n(atual, ou convidado)])
    Clinica([🏥 Clínica])

    subgraph Sistema["Curva Mestra — Portal do Consultor"]
        UC27(("UC-27\nRejeitar Pedido\n(transferência ou convite)"))
    end

    subgraph Origem["Cria a pendência"]
        UC25(("UC-25\nSolicitar Transferência\n(type: transfer)"))
        UC54(("UC-54\nConvidar Consultor\n(type: invite)"))
    end

    UC25 -->|cria consultant_transfer_requests| UC27
    UC54 -->|cria consultant_transfer_requests| UC27
    ConsultorAprovador --> UC27
    UC27 -.->|notificação in-app\napenas se type=invite| Clinica
```

---

## 2. Atores

### 2.1 Ator Primário
**Consultor Rennova (aprovador)** — resolvido por tipo de pendência via `getApproverConsultantId`: para `type: 'transfer'`, o consultor hoje vinculado à clínica; para `type: 'invite'`, o próprio consultor convidado.

### 2.2 Atores Secundários / Sistemas Externos
- **Consultor Rennova (solicitante)** — apenas em `type: 'transfer'`: recebe um e-mail informando a rejeição, incluindo o motivo, se informado. Não existe "consultor solicitante" distinto do aprovador em `type: 'invite'`.
- **Clínica (tenant)** — apenas em `type: 'invite'`: recebe uma notificação in-app informando que o convite foi recusado (novidade desta revisão, RN-04).
- **System Admin** — também pode rejeitar qualquer pendência, de ambos os tipos (mesma regra de permissão do UC-26 — RN-02).

---

## 3. Pré-condições
- Consultor autenticado, `is_consultant === true`, `consultant_id` presente no token, coincidindo com o aprovador resolvido por `getApproverConsultantId(transferData)` (ou chamador é `system_admin`).
- Existe um documento em `consultant_transfer_requests` com `status === 'pending'` referenciando este consultor como aprovador.
- O documento **não** está expirado — `expires_at` (created_at + 15 dias) ainda não passou, ou está ausente (documento legado).

---

## 4. Pós-condições

### 4.1 Sucesso
- `consultant_transfer_requests/{id}.status` passa para `'rejected'`.
- `consultant_transfer_requests/{id}.rejection_reason` é gravado com o texto informado, ou `'Não especificado'` se o campo for deixado em branco.
- **Nenhum outro documento é alterado em `tenants`/`consultants`** — a rejeição não toca em custom claims de ninguém; o vínculo atual (se houver) permanece intacto (RN-01).
- Se `type === 'invite'`: uma notificação in-app é criada em `tenants/{tenant_id}/notifications` (`type: 'consultant_invite_rejected'`), avisando a clínica da recusa — **sem** e-mail, pois não há "consultor solicitante" distinto do aprovador nesse tipo (RN-04).
- Se `type === 'transfer'`: um e-mail é enfileirado para o consultor solicitante, informando a rejeição e o motivo (se houver) — **sem** notificação in-app para a clínica, comportamento 100% herdado da versão anterior deste UC (RN-05).

### 4.2 Falha
- Se o pedido já tiver sido processado (`status !== 'pending'`): nenhuma alteração é feita, erro 400.
- Se o pedido estiver `pending` mas expirado: nenhuma alteração é feita, erro 400 "Este pedido expirou" (RN-06).
- Se o pedido, o consultor ou a clínica referenciados não existirem mais: erro 404 (nos pontos aplicáveis).

---

## 5. Gatilho (Trigger)
Consultor aprovador acessa `/consultant/transfer-requests`, aba "Pendentes", clica em "Rejeitar" numa pendência dirigida a ele (transferência recebida ou convite recebido), opcionalmente digita um motivo, e confirma.

---

## 6. Fluxo Principal (Basic Flow)

1. Consultor acessa `/consultant/transfer-requests` (mesma tela do UC-26).
2. Para uma pendência pendente e não expirada, clica em "Rejeitar".
3. Sistema abre um diálogo modal com um campo de texto livre "Motivo (opcional)" e os botões "Cancelar"/"Confirmar Rejeição" — **esta é a única das duas ações (aprovar/rejeitar) que exibe algum tipo de confirmação/diálogo** (RN-03, em contraste com a RN-01 do UC-26).
4. Consultor opcionalmente digita um motivo e clica em "Confirmar Rejeição".
5. Sistema chama `POST /api/consultants/transfer-requests/{id}/reject` com `{ reason }` e o Bearer token.
6. API busca o documento; resolve o aprovador esperado via `getApproverConsultantId(transferData)`; valida permissão (mesma regra do UC-26: `is_system_admin` OU `is_consultant && consultant_id === approverConsultantId`); verifica que `status === 'pending'`; verifica que o pedido **não está expirado**, retornando 400 caso esteja (RN-06).
7. API atualiza o documento do pedido: `status: 'rejected'`, `rejection_reason: reason || 'Não especificado'`, `rejected_at`.
8. **Ramificação por tipo (RN-04/RN-05):**
   - Se `type === 'invite'`: API cria uma notificação in-app em `tenants/{tenant_id}/notifications` (`type: 'consultant_invite_rejected'`, `action_url: '/clinic/consultant/invite'`), avisando a clínica da recusa. Nenhum e-mail é enviado (não há "solicitante" distinto do aprovador).
   - Se `type === 'transfer'`: API busca os dados do consultor solicitante e enfileira um e-mail informando a rejeição e o motivo (se houver) — comportamento idêntico ao já existente antes desta feature.
9. Falha ao enfileirar e-mail ou criar notificação é capturada por `try/catch` e apenas logada, sem impedir a resposta de sucesso (mesmo padrão de UC-24/UC-25).
10. Sistema exibe "Pedido rejeitado", fecha o diálogo e recarrega a lista.
11. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos
Nenhum identificado além do fluxo principal.

---

## 8. Fluxos de Exceção

### 8a. Pedido já processado
1. `status !== 'pending'` no momento da chamada.
2. API retorna 400 ("Pedido já foi processado"); nenhuma alteração é feita.

### 8b. Pedido não encontrado
1. `id` não corresponde a nenhum documento existente.
2. API retorna 404.

### 8c. Chamador sem permissão
1. Consultor autenticado não é o aprovador resolvido por `getApproverConsultantId`, nem `system_admin`.
2. API retorna 403.

### 8d. Falha ao enfileirar e-mail ou criar notificação
1. `adminDb.collection('email_queue').add(...)` (transfer) ou `adminDb.collection('.../notifications').add(...)` (invite) falha.
2. Erro é absorvido por `try/catch` (`console.warn`) — a rejeição do pedido já foi persistida antes dessa etapa, então a operação principal não é afetada; apenas o consultor solicitante (transfer) ou a clínica (invite) pode não ser notificado.

### 8e. Pendência expirada (a partir do passo 6)
1. O documento está `pending`, mas `expires_at` (created_at + 15 dias) já passou.
2. API retorna 400 ("Este pedido expirou") **sem alterar o documento** — a pendência permanece `pending`/expirada indefinidamente, apenas deixa de ser acionável (RN-06).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A rejeição, para os dois tipos de pendência, continua sendo a operação mais simples entre as duas (aprovar/rejeitar): apenas um `updateDoc` no próprio documento — não há `batch`, não há alteração em `tenants`/`consultants`, não há sincronização de custom claims. **[Nuance adicionada em v1.1]** Esse grau de simplicidade não se aplica mais de forma absolutamente universal: quando `type === 'invite'`, a rejeição passa a incluir uma escrita adicional (a notificação in-app para a clínica, RN-04) — ainda assim, sem `batch` nem `arrayRemove`/`arrayUnion`, permanecendo a operação mais simples e segura do módulo em relação à Aprovação (UC-26). | Confirmado por leitura literal de `POST /api/consultants/transfer-requests/[id]/reject/route.ts` — ausência de `batch` ou escrita fora de `consultant_transfer_requests` e, condicionalmente, de `tenants/{tenant_id}/notifications`. |
| RN-02 | Mesma regra de permissão do UC-26: `system_admin` OU o aprovador resolvido por `getApproverConsultantId` podem rejeitar. Nenhuma tela admin dedicada com ação de aprovar/rejeitar existe para isso. | Confirmado por leitura da checagem de permissão, idêntica à de `approve/route.ts`, agora via `getApproverConsultantId`. |
| RN-03 | **[Achado de inconsistência de UX entre as duas ações irmãs, inalterado]** Rejeitar exige a abertura de um diálogo modal (com campo de motivo opcional) antes de confirmar, enquanto Aprovar (UC-26, RN-01) executa a ação imediatamente com um único clique, sem qualquer confirmação — para os dois tipos de pendência. | Confirmado por comparação direta entre `handleApprove` (sem diálogo) e `handleRejectConfirm`/diálogo modal (com campo de motivo) na mesma tela. |
| RN-04 | **[Novo, v1.1]** A rejeição de um **convite** (`type === 'invite'`) gera uma notificação in-app para a clínica (`tenants/{tenant_id}/notifications`, novo `type: 'consultant_invite_rejected'`, `action_url: '/clinic/consultant/invite'`) — canal que já existe para a clínica (usado em UC-24/UC-26) e passa a ser reaproveitado aqui. Nenhum e-mail é enviado nesse caso (não há "consultor solicitante" distinto do aprovador). | Confirmado por leitura de `reject/route.ts`, bloco `if (isInvite) { ... adminDb.collection('tenants/{id}/notifications').add(...) }`. |
| RN-05 | **[Novo, v1.1]** A rejeição de uma **transferência** (`type === 'transfer'`) continua **sem** notificar a clínica — comportamento 100% herdado, inalterado desde a v1.0: apenas um e-mail é enviado ao consultor solicitante. A clínica não precisa agir nesse caso, pois o vínculo atual simplesmente permanece como estava. | Confirmado por leitura de `reject/route.ts` — o `else` do bloco condicional preserva exatamente a lógica pré-existente de envio de e-mail, sem nenhuma escrita em `notifications`. |
| RN-06 | **[Novo, v1.1]** Uma pendência `pending` cujo `expires_at` (created_at + 15 dias) já passou não pode mais ser rejeitada — a API retorna 400 ("Este pedido expirou") sem alterar o documento. Documentos legados sem `expires_at` nunca são considerados expirados. | Confirmado por leitura de `isRequestExpired` e da pré-checagem em `reject/route.ts`, antes da atualização do documento. |
| RN-07 | **[Renumerado, antiga RN-04]** Este fluxo depende de uma pendência `pending` e não expirada dirigida ao consultor autenticado — criada por UC-25 (transferência) ou UC-54 (convite), ambos agora com gatilho de UI implementado. A tela **não está mais condenada a ficar sempre vazia**. | Consequência direta da implementação de UC-25/UC-54. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Por não envolver `batch` nem custom claims, esta operação continua sem os riscos de atomicidade documentados em UC-23/UC-24/UC-26 — permanece a operação mais simples e mais segura de todo o módulo, mesmo com a escrita condicional adicional de RN-04. | Observação técnica |

---

## 11. Frequência de Uso
Recém-implementado — sem dados de uso em produção ainda. Deixa de ser "nula" (como registrado nas versões anteriores), já que ambos os gatilhos que alimentam esta tela (UC-25 e UC-54) agora existem.

---

## 12. Casos de Uso Relacionados
- **UC-25 (Solicitar Transferência de Clínica Já Vinculada)** — cria pendências `type: 'transfer'` consumidas por este UC.
- **UC-54 (Convidar Consultor para a Clínica)** — cria pendências `type: 'invite'` também consumidas por este UC, na mesma tela e rota; a rejeição de um convite tem o efeito colateral adicional de RN-04, ausente em UC-54 em si.
- **UC-26 (Aprovar Pedido de Transferência de Clínica)** — ação alternativa disponível na mesma tela, para a mesma pendência; ver RN-03 sobre a assimetria de UX entre as duas.

---

## 13. Referências
- `src/app/(consultant)/consultant/transfer-requests/page.tsx` (mesma tela do UC-26, diálogo de rejeição)
- `src/app/api/consultants/transfer-requests/[id]/reject/route.ts` (generalizado para dois tipos, expiração e notificação in-app condicional)
- `src/lib/consultantRequests.ts` (`getApproverConsultantId`, `isInviteRequest`, `isRequestExpired`)
- `src/types/index.ts` (`ConsultantTransferRequest`, `ConsultantTransferRequestStatus`, `ConsultantPendencyType`)
- `src/types/notification.ts` (`consultant_invite_rejected`)
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-unificacao-vinculo-transferencia-consultor.md` (spec de implementação)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. ~~**[RN-07, herdado do UC-25]** Este UC só passa a ser útil na prática se o gatilho do UC-25 for implementado.~~ **[RESOLVIDO em v1.1]** Gatilho de UC-25 implementado, e novo gatilho de UC-54 (convite) adicionado.
2. **[RN-03]** Vale avaliar se a assimetria de confirmação entre Aprovar (sem diálogo) e Rejeitar (com diálogo) é intencional ou um descuido de UX — a ação de aprovar (mais impactante) hoje tem menos fricção que a de rejeitar. Ainda em aberto, inalterado por esta feature.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Fluxo de rejeição documentado como a operação mais simples e segura do módulo (sem batch, sem custom claims — RN-01), mas dependente do mesmo gatilho ausente identificado no UC-25 (RN-04). Identificada uma assimetria de UX entre Aprovar (sem confirmação) e Rejeitar (com diálogo de confirmação e motivo) — RN-03. Último dos 4 UCs do módulo "Consultor — vínculo com clínicas" (UC-24 a UC-27). |
| 1.1 | 13/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | Revisão pós-implementação de `feature/consultor-vinculo-convite-transferencia`: a rota e a tela passam a tratar dois tipos de pendência (`transfer` e o novo `invite`, criado por UC-54), com a resolução de "quem rejeita" centralizada em `getApproverConsultantId`; pendências expiradas (15 dias) passam a ser rejeitadas com 400, sem alteração do documento (novo RN-06); a rejeição de um **convite** passa a gerar notificação in-app para a clínica (novo RN-04), enquanto a rejeição de uma **transferência** permanece sem notificar a clínica, comportamento herdado (novo RN-05). RN-01 ganhou nuance sobre a escrita adicional condicional. Ator primário generalizado para "consultor aprovador"; título do diagrama, atores, pré/pós-condições, gatilho e fluxo principal atualizados. Antiga RN-04 (dependência de UC-25) renumerada para RN-07 e marcada como resolvida. Frequência de uso deixa de ser "nula". |
