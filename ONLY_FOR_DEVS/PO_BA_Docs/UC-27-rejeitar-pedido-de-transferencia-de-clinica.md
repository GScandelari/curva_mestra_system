# UC-27: Rejeitar Pedido de Transferência de Clínica

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Portal do Consultor (Vínculo com Clínicas)
**Versão:** 1.0

> O consultor atual de uma clínica pode rejeitar, com um motivo opcional, um pedido de outro consultor que deseja assumi-la. Assim como o UC-26 (Aprovar), a lógica está corretamente implementada e a tela é funcional — mas depende de um pedido `pending` que, conforme documentado no UC-25, nunca chega a ser criado hoje por ausência de gatilho de UI.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ConsultorAtual([👤 Consultor Atual])

    subgraph Sistema["Curva Mestra — Portal do Consultor"]
        UC27(("UC-27\nRejeitar Pedido de\nTransferência"))
    end

    subgraph Dependencia["⚠️ Depende de UC-25, hoje sem gatilho"]
        UC25(("UC-25\nSolicitar Transferência"))
    end

    UC25 -.->|cria consultant_transfer_requests\n(nunca ocorre hoje)| UC27
    ConsultorAtual --> UC27
```

---

## 2. Atores

### 2.1 Ator Primário
**Consultor Rennova (atual)** — o consultor hoje vinculado à clínica alvo do pedido.

### 2.2 Atores Secundários / Sistemas Externos
- **Consultor Rennova (solicitante)** — recebe um e-mail informando a rejeição, incluindo o motivo, se informado.
- **System Admin** — também pode rejeitar qualquer pedido (mesma regra de permissão do UC-26 — RN-02).

---

## 3. Pré-condições
- Consultor autenticado, `is_consultant === true`, `consultant_id` presente no token, coincidindo com `current_consultant_id` do pedido (ou chamador é `system_admin`).
- Existe um documento em `consultant_transfer_requests` com `status === 'pending'` referenciando este consultor.
- **[Dependência confirmada]** Assim como no UC-26, esta pré-condição nunca se cumpre hoje na prática (ver UC-25, RN-00).

---

## 4. Pós-condições

### 4.1 Sucesso
- `consultant_transfer_requests/{id}.status` passa para `'rejected'`.
- `consultant_transfer_requests/{id}.rejection_reason` é gravado com o texto informado, ou `'Não especificado'` se o campo for deixado em branco.
- **Nenhum outro documento é alterado** — diferente do UC-26, a rejeição não toca em `tenants`, `consultants` nem em custom claims de ninguém; o vínculo atual permanece intacto (RN-01).
- Um e-mail é enfileirado para o consultor solicitante, informando a rejeição e o motivo (se houver).

### 4.2 Falha
- Se o pedido já tiver sido processado (`status !== 'pending'`): nenhuma alteração é feita, erro 400.
- Se o pedido, o consultor ou a clínica referenciados não existirem mais: erro 404 (nos pontos aplicáveis).

---

## 5. Gatilho (Trigger)
Consultor atual acessa `/consultant/transfer-requests`, aba "Pendentes", clica em "Rejeitar" num pedido, opcionalmente digita um motivo, e confirma.

---

## 6. Fluxo Principal (Basic Flow)

1. Consultor acessa `/consultant/transfer-requests` (mesma tela do UC-26).
2. Para um pedido pendente, clica em "Rejeitar".
3. Sistema abre um diálogo modal com um campo de texto livre "Motivo (opcional)" e os botões "Cancelar"/"Confirmar Rejeição" — **esta é a única das duas ações (aprovar/rejeitar) que exibe algum tipo de confirmação/diálogo** (RN-03, em contraste com a RN-01 do UC-26).
4. Consultor opcionalmente digita um motivo e clica em "Confirmar Rejeição".
5. Sistema chama `POST /api/consultants/transfer-requests/{id}/reject` com `{ reason }` e o Bearer token.
6. API valida token e permissão (mesma regra do UC-26: `is_system_admin` OU `is_consultant && consultant_id === current_consultant_id`); verifica que `status === 'pending'`.
7. API atualiza o documento do pedido: `status: 'rejected'`, `rejection_reason: reason || 'Não especificado'`, `rejected_at`.
8. API busca os dados do consultor solicitante e enfileira um e-mail informando a rejeição e o motivo (se houver) — falha no envio é capturada por `try/catch` e apenas logada, sem impedir a resposta de sucesso (mesmo padrão de UC-24/UC-25).
9. Sistema exibe "Pedido rejeitado", fecha o diálogo e recarrega a lista.
10. Caso de uso é concluído com sucesso.

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
1. Consultor autenticado não é o `current_consultant_id` do pedido, nem `system_admin`.
2. API retorna 403.

### 8d. Falha ao enfileirar e-mail
1. `adminDb.collection('email_queue').add(...)` falha.
2. Erro é absorvido por `try/catch` (`console.warn`) — a rejeição do pedido já foi persistida antes dessa etapa, então a operação principal não é afetada; apenas o consultor solicitante pode não ser notificado.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Confirmado]** A rejeição é a operação "mais simples" das duas (aprovar/rejeitar): apenas um `updateDoc` no próprio documento do pedido — não há `batch`, não há alteração em `tenants`/`consultants`, não há sincronização de custom claims. O vínculo atual permanece completamente intacto. | Confirmado por leitura literal de `POST /api/consultants/transfer-requests/[id]/reject/route.ts` — ausência total de qualquer `batch` ou escrita fora da própria coleção `consultant_transfer_requests`. |
| RN-02 | Mesma regra de permissão do UC-26: `system_admin` OU o consultor atual (`current_consultant_id`) podem rejeitar. Nenhuma tela admin dedicada existe para isso. | Confirmado por leitura da checagem de permissão, idêntica à de `approve/route.ts`. |
| RN-03 | **[Achado de inconsistência de UX entre as duas ações irmãs]** Rejeitar exige a abertura de um diálogo modal (com campo de motivo opcional) antes de confirmar, enquanto Aprovar (UC-26, RN-01) executa a ação imediatamente com um único clique, sem qualquer confirmação. A ação potencialmente mais impactante para o negócio do consultor atual (perder a clínica, via Aprovar) tem, paradoxalmente, menos fricção de confirmação que a ação de simplesmente recusar um pedido. | Confirmado por comparação direta entre `handleApprove` (sem diálogo) e `handleRejectConfirm`/diálogo modal (com campo de motivo) na mesma tela. |
| RN-04 | Assim como estabelecido no UC-25 (RN-00) e no UC-26 (RN-04), este fluxo depende de um pedido `pending` que, hoje, nunca é criado — a tela está, na prática, sempre vazia na aba "Pendentes". | Consequência direta do achado do UC-25. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Por não envolver `batch` nem custom claims, esta operação não compartilha os riscos de atomicidade documentados em UC-23/UC-24/UC-26 — é a operação mais simples e mais segura de todo o módulo. | Observação técnica |

---

## 11. Frequência de Uso
**Nula hoje**, por dependência do UC-25 (RN-04).

---

## 12. Casos de Uso Relacionados
- **UC-25 (Solicitar Transferência de Clínica Já Vinculada)** — pré-condição funcional (mas hoje inatingível) deste UC.
- **UC-26 (Aprovar Pedido de Transferência de Clínica)** — ação alternativa disponível na mesma tela, para o mesmo pedido; ver RN-03 sobre a assimetria de UX entre as duas.

---

## 13. Referências
- `src/app/(consultant)/consultant/transfer-requests/page.tsx` (mesma tela do UC-26, diálogo de rejeição)
- `src/app/api/consultants/transfer-requests/[id]/reject/route.ts`
- `src/types/index.ts` (`ConsultantTransferRequest`, `ConsultantTransferRequestStatus`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-04, herdado do UC-25]** Este UC só passa a ser útil na prática se o gatilho do UC-25 for implementado — decisão de produto compartilhada com aquele UC e com o UC-26.
2. **[RN-03]** Vale avaliar se a assimetria de confirmação entre Aprovar (sem diálogo) e Rejeitar (com diálogo) é intencional ou um descuido de UX — a ação de aprovar (mais impactante) hoje tem menos fricção que a de rejeitar.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Fluxo de rejeição documentado como a operação mais simples e segura do módulo (sem batch, sem custom claims — RN-01), mas dependente do mesmo gatilho ausente identificado no UC-25 (RN-04). Identificada uma assimetria de UX entre Aprovar (sem confirmação) e Rejeitar (com diálogo de confirmação e motivo) — RN-03. Último dos 4 UCs do módulo "Consultor — vínculo com clínicas" (UC-24 a UC-27). |
