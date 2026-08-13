# UC-25: Solicitar Transferência de Clínica Já Vinculada

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Portal do Consultor (Vínculo com Clínicas)
**Versão:** 2.0

> Um consultor, buscando por clínicas via CNPJ/CPF em `/consultant/clinics/search`, encontra uma clínica que já possui outro consultor vinculado e clica em "Solicitar Transferência". O pedido fica pendente até que o consultor atual (ou um System Admin) o aprove (UC-26) ou rejeite (UC-27), e expira automaticamente em 15 dias se ninguém agir. **Atualização (v2.0):** este UC descrevia, até a v1.0, um "achado crítico" — o backend estava pronto, mas nenhuma tela expunha um botão para disparar este fluxo. A implementação de `feature/consultor-vinculo-convite-transferencia` adicionou esse gatilho e um prazo de expiração de 15 dias; este documento foi reescrito para descrever o comportamento **implementado**, não mais hipotético. Ver Seção 15 para o detalhamento completo da mudança.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ConsultorSolicitante([👤 Consultor Solicitante])
    ConsultorAtual([👤 Consultor Atual])

    subgraph Sistema["Curva Mestra"]
        UC25(("UC-25\nSolicitar Transferência de\nClínica Já Vinculada"))
        UC26(("UC-26\nAprovar Pedido"))
        UC27(("UC-27\nRejeitar Pedido"))
    end

    ConsultorSolicitante --> UC25
    UC25 -.->|e-mail via email_queue| ConsultorAtual
    UC25 -->|cria consultant_transfer_requests\n(sem type explícito, tratado\ncomo 'transfer')| UC26
    UC25 --> UC27
    ConsultorAtual --> UC26
    ConsultorAtual --> UC27
```

---

## 2. Atores

### 2.1 Ator Primário
**Consultor Rennova (solicitante)** — o consultor que deseja assumir uma clínica já vinculada a outro consultor.

### 2.2 Atores Secundários / Sistemas Externos
- **Consultor Rennova (atual)** — recebe uma notificação por e-mail e decide (UC-26/UC-27); não é notificado por nenhum outro canal (ver RN-03).
- **Sistema de fila de e-mails** (`email_queue`) — mecanismo de envio assíncrono já usado em outras partes do sistema (ex.: UC-08).

---

## 3. Pré-condições
- Consultor solicitante autenticado, `is_consultant === true`, `consultant_id` presente no token.
- A clínica buscada (via `/consultant/clinics/search`, por CNPJ/CPF) existe e **já possui** `consultant_id` preenchido, diferente do consultor solicitante.
- Não existe, hoje ou no passado, nenhum documento `pending` em `consultant_transfer_requests` para o mesmo par consultor solicitante + clínica — **mesmo que esse documento já esteja expirado** (ver RN-05, achado de assimetria com o fluxo de convite).

---

## 4. Pós-condições

### 4.1 Sucesso
- Um documento é criado em `consultant_transfer_requests` com `status: 'pending'`, `requesting_consultant_id/name/code`, `current_consultant_id/name`, `tenant_id/name/document` e `expires_at` (`created_at + 15 dias`, RN-02). **O documento não grava um campo `type` explícito** — é tratado implicitamente como `'transfer'` pela função pura `normalizeLegacyType` (mesmo tratamento dado a documentos legados anteriores a esta feature; ver RN-06).
- Um e-mail é enfileirado em `email_queue` para o consultor atual, com um link genérico ao Portal do Consultor (não um link direto para o pedido específico).
- **O vínculo atual não é alterado de forma alguma neste momento** — `tenants/{id}.consultant_id` continua apontando para o consultor atual, que mantém acesso total e normal à clínica durante todo o período em que o pedido ficar pendente (RN-01).
- O pedido permanece acionável (aprovável/rejeitável) por até 15 dias a partir da criação; após esse prazo, torna-se "expirado" — um estado calculado em tempo de leitura, nunca gravado como novo `status` (RN-02).
- Na tela de origem (`/consultant/clinics/search`), o card da clínica passa a exibir "Pedido de transferência enviado" em vez do botão, via estado local `transferRequested`.

### 4.2 Falha
- Se já existir um pedido `pending` (expirado ou não) do mesmo consultor solicitante para a mesma clínica: nenhuma alteração é feita, API retorna 400 (RN-05).
- Se o consultor solicitante já for o vinculado à clínica: erro 400 antes mesmo de entrar neste ramo (checagem comum aos dois casos da API).

---

## 5. Gatilho (Trigger)
Consultor solicitante, autenticado no Portal do Consultor, acessa `/consultant/clinics/search`, busca uma clínica por CNPJ/CPF cujo resultado **já possui** `consultant_id` preenchido (diferente do próprio consultor), e clica no botão **"Solicitar Transferência"** exibido no card de resultado dessa clínica.

---

## 6. Fluxo Principal (Basic Flow)

1. Consultor solicitante acessa `/consultant/clinics/search`.
2. Informa o CNPJ ou CPF da clínica e clica no botão de busca (ou pressiona Enter).
3. Sistema chama `GET /api/tenants/search?document={documento}` com o Bearer token; exibe os resultados encontrados.
4. Para uma clínica cujo `consultant_id` já está preenchido, sistema exibe o texto informativo "Clínica já possui o consultor **{nome}** vinculado" e, logo abaixo, o botão **"Solicitar Transferência"** (ícone `ArrowRightLeft`).
5. Consultor solicitante clica em "Solicitar Transferência" (`handleLink`).
6. Sistema chama `POST /api/consultants/claims` com `{ tenant_id }` e o Bearer token.
7. API valida token e permissão (`is_consultant` + `consultant_id`); busca dados do consultor solicitante e da clínica; retorna erro se o solicitante já for o consultor vinculado.
8. Como `tenantData.consultant_id` já está preenchido, a API entra no ramo "CASO 2": verifica se já existe **qualquer** pedido `pending` (expirado ou não) do mesmo solicitante para a mesma clínica em `consultant_transfer_requests` (RN-05 — impede duplicidade, sem a exclusão de expirados que existe para convites).
9. API busca os dados do consultor atual (`tenantData.consultant_id`).
10. API cria um documento em `consultant_transfer_requests` com `status: 'pending'`, `requesting_consultant_id/name/code`, `current_consultant_id/name`, `tenant_id/name/document`, `expires_at: computeExpiresAt()` (created_at + 15 dias, RN-02) — sem gravar `type` (RN-06).
11. API enfileira um e-mail em `email_queue` para o consultor atual (`type: 'consultant_transfer_request'`), com corpo HTML descrevendo o pedido e um link genérico ao Portal do Consultor (não um deep-link para o pedido específico — RN-04).
12. API retorna `{ success: true, auto_linked: false, transfer_requested: true, message: 'Pedido de transferência enviado ao consultor atual', data: { id } }`.
13. Sistema marca o card da clínica com o estado local `transferRequested` (substitui o botão por "Pedido de transferência enviado") e exibe um toast de mesmo texto.
14. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos
Nenhum identificado além do fluxo principal.

---

## 8. Fluxos de Exceção

### 8a. Pedido duplicado
1. Já existe um pedido `pending` (expirado ou não) do mesmo consultor solicitante para a mesma clínica.
2. API retorna 400 ("Já existe um pedido de transferência pendente para esta clínica"); nenhuma alteração é feita (RN-05).

### 8b. Consultor solicitante já é o vinculado
1. Checagem comum aos dois ramos da API (compartilhada com UC-24).
2. API retorna 400 ("Você já é o consultor vinculado a esta clínica").

### 8c. Falha ao enfileirar e-mail
1. `adminDb.collection('email_queue').add(...)` falha.
2. Erro é capturado por `try/catch` e apenas logado (`console.warn`) — a criação do pedido de transferência **não é revertida**; a API retorna sucesso normalmente mesmo que o consultor atual nunca seja notificado por e-mail (RN-04).

### 8d. Pedido expira sem ação do consultor atual (a partir do passo 10)
1. Passam-se 15 dias sem que o consultor atual (ou um System Admin) aprove ou rejeite o pedido.
2. O documento permanece `status: 'pending'` no Firestore — nenhuma escrita automática ocorre. Uma tentativa posterior de aprovar/rejeitar (`POST .../approve` ou `.../reject`) retorna 400 ("Este pedido expirou") sem alterar o documento (RN-02). Nenhuma notificação de expiração é enviada a nenhuma das partes.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-00 | **[RESOLVIDO em v2.0 — antes "achado crítico"]** Até a v1.0 deste documento, não existia em nenhuma tela um botão ou fluxo que disparasse este ramo da API — o backend estava pronto e testado, mas inatingível. A implementação de `feature/consultor-vinculo-convite-transferencia` adicionou o botão "Solicitar Transferência" em `/consultant/clinics/search`, reaproveitando o mesmo `handleLink`/`POST /api/consultants/claims` já existente, sem alteração de payload. | Confirmado por leitura de `src/app/(consultant)/consultant/clinics/search/page.tsx` — bloco informativo substituído por botão real, com estado local `transferRequested`. |
| RN-01 | **[Confirmado, inalterado]** Enquanto o pedido de transferência está pendente, o vínculo atual **não é alterado de forma alguma**: `tenants/{id}.consultant_id` permanece apontando para o consultor atual, que continua enxergando e operando a clínica normalmente durante todo o período de pendência. | Confirmado por leitura de `POST /api/consultants/claims` — o ramo "CASO 2" apenas cria o documento de pedido e envia e-mail; nenhuma escrita em `tenants` ou `consultants` ocorre nesta etapa. |
| RN-02 | **[RESOLVIDO em v2.0 — antes "sem prazo de expiração"]** O pedido de transferência agora expira 15 dias após a criação (`expires_at = created_at + 15 dias`, gravado no momento da criação via `computeExpiresAt()`). A expiração é calculada em tempo de leitura (`isRequestExpired`, `src/lib/consultantRequests.ts`) — **não** existe Cloud Function agendada; um pedido expirado permanece no Firestore como `pending`, apenas deixa de ser acionável (`approve`/`reject` retornam 400 "Este pedido expirou"). Mesmo padrão adotado para o convite (UC-54). | Confirmado por leitura de `POST /api/consultants/claims` (CASO 2, grava `expires_at: Timestamp.fromDate(computeExpiresAt())`) e de `isRequestExpired`/`computeExpiresAt` em `src/lib/consultantRequests.ts`, consumidas por `approve`/`reject/route.ts`. |
| RN-03 | **[Reclassificado em v2.0 — antes "achado", agora decisão consciente documentada]** A notificação ao consultor atual continua sendo feita **exclusivamente por e-mail** (fila `email_queue`) — não há notificação in-app (diferente do que ocorre com o `clinic_admin` no UC-24/UC-26/UC-27, que recebe notificações em `tenants/{tenant_id}/notifications`). Esta ausência não é mais uma lacuna não avaliada: é um débito técnico consciente, documentado na spec de implementação (`FEAT-unificacao-vinculo-transferencia-consultor.md`, RN-05), pela inexistência de qualquer infraestrutura de notificação in-app equivalente para o Portal do Consultor. | Confirmado por leitura completa de `POST /api/consultants/claims` (CASO 2) — nenhuma escrita em subcoleção de notificações do consultor — e da spec de implementação referenciada. |
| RN-04 | **[Inalterado]** O e-mail enfileirado para o consultor atual contém um link genérico ("Acesse o Portal do Consultor"), não um deep-link direto para `/consultant/transfer-requests` ou para o pedido específico. A falha no envio do e-mail é silenciosamente absorvida (`try/catch` com `console.warn`) e não impede a criação do pedido. | Confirmado por leitura literal do corpo do e-mail e do bloco `try/catch` em `POST /api/consultants/claims`. |
| RN-05 | **[Achado novo, v2.0]** Diferente do fluxo de convite (UC-54), cuja checagem de duplicidade explicitamente ignora convites `pending` já expirados (RF-03/RN-12 da spec), a checagem de duplicidade deste fluxo (`existingTransfer`, em `POST /api/consultants/claims`, CASO 2) **não** exclui pedidos `pending` já expirados — um pedido de transferência antigo, mesmo expirado e nunca respondido, continua bloqueando indefinidamente o mesmo consultor solicitante de criar um novo pedido para a mesma clínica. Não há como o consultor solicitante "desistir" de um pedido próprio (diferente da clínica, que pode cancelar um convite — RF-13 do UC-54). | Confirmado por leitura literal da query `existingTransfer` em `POST /api/consultants/claims` — filtra apenas por `requesting_consultant_id`, `tenant_id`, `status === 'pending'`, sem checagem de `expires_at`. |
| RN-06 | **[Achado novo, v2.0]** O documento criado por este fluxo **não grava um campo `type` explícito** (diferente do convite, que grava `type: 'invite'`). Ele é tratado implicitamente como `'transfer'` por `normalizeLegacyType` (`src/lib/consultantRequests.ts`), a mesma função usada para compatibilidade com documentos legados anteriores a esta feature — uma decisão consciente de implementação para minimizar o diff em `POST /api/consultants/claims` (apenas `expires_at` foi adicionado a este arquivo). | Confirmado por leitura literal do objeto passado a `consultant_transfer_requests.add(...)` em `POST /api/consultants/claims`, CASO 2 — ausência do campo `type` — e da spec de implementação (Seção 6.4, "Nenhuma outra linha do arquivo é tocada"). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Pedidos de transferência esquecidos/abandonados não são limpos automaticamente do Firestore mesmo após expirarem (RN-02) — permanecem indefinidamente com `status: 'pending'`, visíveis com o badge "Expirado" nas telas de consultor/admin. Mesmo trade-off já aceito para `password_reset_tokens`. | Manutenibilidade |
| RNF-02 | A leitura/escrita de `consultant_transfer_requests` continua exclusivamente via API routes (Firebase Admin SDK) — não existe regra dedicada em `firestore.rules`, mas isso não é um problema em produção, pois nenhum acesso client-side direto é feito. | Segurança / Multi-tenant |

---

## 11. Frequência de Uso
Recém-implementado (gatilho de UI adicionado em `feature/consultor-vinculo-convite-transferencia`) — sem dados de uso em produção ainda. Qualitativamente esperado como ocasional, dependendo da rotatividade de consultores por clínica (mesmo padrão qualitativo do UC-23). Deixa de ser "nula", como registrado nas versões anteriores deste documento.

---

## 12. Casos de Uso Relacionados
- **UC-24 (Vincular-se Automaticamente a uma Clínica Sem Consultor)** — mesma tela, mesma API (`POST /api/consultants/claims`), ramo "CASO 1" (auto-link, quando a clínica não tem consultor).
- **UC-54 (Convidar Consultor para a Clínica)** — fluxo irmão, também usando a coleção `consultant_transfer_requests` e as mesmas rotas de aprovação/rejeição, mas com iniciador (Clinic Admin) e gatilho (`type: 'invite'`) diferentes; mutuamente exclusivo em relação a este UC, pois um só existe quando a clínica não tem consultor (UC-54) e o outro apenas quando ela já tem (este UC).
- **UC-26 (Aprovar Pedido de Transferência de Clínica)** e **UC-27 (Rejeitar Pedido de Transferência de Clínica)** — consomem o documento `consultant_transfer_requests` criado por este UC; ambos passaram a ser efetivamente exercitáveis a partir desta implementação.
- **UC-23 (Vincular/Alterar/Remover Consultor via Painel Admin)** — mecanismo paralelo e totalmente funcional para o `system_admin` trocar o consultor de qualquer clínica a qualquer momento, sem depender deste fluxo de solicitação.

---

## 13. Referências
- `src/app/(consultant)/consultant/clinics/search/page.tsx` (botão "Solicitar Transferência", `handleLink`)
- `src/app/api/consultants/claims/route.ts` (ramo "CASO 2")
- `src/lib/consultantRequests.ts` (`computeExpiresAt`, `isRequestExpired`, `normalizeLegacyType`)
- `src/types/index.ts` (`ConsultantTransferRequest`, `ConsultantTransferRequestStatus`, `ConsultantPendencyType`)
- `firestore.rules` (ausência de regra dedicada para `consultant_transfer_requests`)
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-unificacao-vinculo-transferencia-consultor.md` (spec de implementação — RN-02, RN-11, RN-05 desta spec)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-05, achado novo]** Diferente do convite (UC-54), um pedido de transferência `pending` expirado continua bloqueando indefinidamente um novo pedido do mesmo consultor solicitante para a mesma clínica — não há como "desistir" e tentar de novo. Vale decisão de produto: aplicar a mesma exclusão de expirados usada em RF-03/RN-12 do convite também aqui?
2. ~~**[RN-00, decisão de produto necessária]** O backend deste caso de uso está pronto, mas sem gatilho de UI.~~ **[RESOLVIDO em v2.0]** Gatilho implementado.
3. ~~**[RN-02]** Ausência de prazo de expiração.~~ **[RESOLVIDO em v2.0]** Expira em 15 dias.
4. ~~**[RN-03]** Ausência de notificação in-app para o consultor atual.~~ **[Reclassificado em v2.0]** Documentado como débito técnico consciente na spec de implementação — não é mais uma lacuna não avaliada, mas continua sendo uma limitação real do produto.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Confirmado o achado crítico de que este ramo da API (`POST /api/consultants/claims`, "CASO 2") não possui nenhum gatilho de UI em nenhuma tela do sistema (RN-00) — documentado com o mesmo rigor do UC-05/UC-22. Confirmadas as duas perguntas específicas do coordenador: o vínculo atual não muda durante a pendência (RN-01) e não há prazo de expiração (RN-02). Segundo de 4 UCs do módulo "Consultor — vínculo com clínicas" (UC-24 a UC-27). |
| 2.0 | 13/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | Reescrita completa pós-implementação de `feature/consultor-vinculo-convite-transferencia`: RN-00 resolvida (botão "Solicitar Transferência" implementado em `/consultant/clinics/search`); RN-02 resolvida (expiração de 15 dias via `expires_at`/`isRequestExpired`, sem Cloud Function agendada); RN-03 reclassificada de "achado" para decisão consciente documentada na spec. Pré-condições, gatilho, fluxo principal e pós-condições reescritos como comportamento **implementado**, não mais hipotético. Adicionados dois achados novos por leitura de código: a checagem de duplicidade deste fluxo não exclui pedidos expirados, diferente do convite (RN-05); o documento criado por este fluxo não grava `type` explícito, sendo tratado implicitamente como `'transfer'` (RN-06). Frequência de uso atualizada de "nula" para "recém-implementada, ainda não mensurada". Adicionada relação com o novo UC-54 (convite, fluxo irmão). Bump de versão major por mudança de escopo/status do documento (de "achado crítico, inatingível" para "implementado, aprovado"). |
