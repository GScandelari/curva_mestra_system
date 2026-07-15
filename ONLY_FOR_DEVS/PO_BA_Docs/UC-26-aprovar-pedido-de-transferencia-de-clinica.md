# UC-26: Aprovar Pedido de Transferência de Clínica

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Portal do Consultor (Vínculo com Clínicas)
**Versão:** 1.0

> O consultor atual de uma clínica visualiza, em `/consultant/transfer-requests`, os pedidos de outros consultores que desejam assumir suas clínicas, e pode aprová-los. A lógica de aprovação está corretamente implementada e é tecnicamente alcançável — a tela e a API funcionam. **Porém**, como documentado no UC-25, nenhum pedido chega a ser criado hoje (o gatilho de solicitação está ausente da UI) — logo, esta tela, embora funcional, está condenada a permanecer sempre vazia ("Nenhum pedido de transferência pendente") até que o UC-25 seja implementado.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ConsultorAtual([👤 Consultor Atual])

    subgraph Sistema["Curva Mestra — Portal do Consultor"]
        UC26(("UC-26\nAprovar Pedido de\nTransferência"))
    end

    subgraph Dependencia["⚠️ Depende de UC-25, hoje sem gatilho"]
        UC25(("UC-25\nSolicitar Transferência"))
    end

    UC25 -.->|cria consultant_transfer_requests\n(nunca ocorre hoje)| UC26
    ConsultorAtual --> UC26
```

---

## 2. Atores

### 2.1 Ator Primário
**Consultor Rennova (atual)** — o consultor hoje vinculado à clínica alvo do pedido, identificado no documento do pedido como `current_consultant_id`.

### 2.2 Atores Secundários / Sistemas Externos
- **Consultor Rennova (solicitante)** — recebe um e-mail informando a aprovação.
- **Clínica (tenant)** afetada — recebe uma notificação informativa in-app sobre a troca de consultor.
- **System Admin** — também pode aprovar qualquer pedido (não só o consultor atual — RN-02).

---

## 3. Pré-condições
- Consultor autenticado, `is_consultant === true`, `consultant_id` presente no token — **e** esse `consultant_id` deve coincidir com o `current_consultant_id` do pedido (ou o chamador é `system_admin`).
- Existe um documento em `consultant_transfer_requests` com `status === 'pending'` referenciando este consultor como `current_consultant_id`.
- **[Dependência confirmada]** Esta pré-condição, na prática, nunca se cumpre hoje, pois nada cria pedidos `pending` (ver UC-25, RN-00).

---

## 4. Pós-condições

### 4.1 Sucesso
- `consultant_transfer_requests/{id}.status` passa para `'approved'`.
- `consultants/{consultor_atual}.authorized_tenants` deixa de incluir o `tenant_id`.
- `consultants/{consultor_solicitante}.authorized_tenants` passa a incluir o `tenant_id`.
- `tenants/{tenant_id}.consultant_id/consultant_code/consultant_name` passam a refletir o consultor solicitante.
- Uma notificação informativa é criada em `tenants/{tenant_id}/notifications` (`type: 'consultant_linked'`, mensagem "Consultor alterado").
- Os custom claims de ambos os consultores (atual e solicitante) são atualizados para refletir a mudança (etapa sequencial, fora da transação — mesma janela de inconsistência de RN-03 do UC-23).
- Um e-mail é enfileirado para o consultor solicitante, avisando da aprovação.

### 4.2 Falha
- Se o pedido já tiver sido processado (`status !== 'pending'`): nenhuma alteração é feita, erro 400.
- Se o `batch` for commitado mas a sincronização de custom claims falhar depois: mesmo padrão de inconsistência parcial já documentado no UC-23 (RN-03) e no UC-24 (RN-02) — aqui, diferente do UC-24, essa etapa **não** está em `try/catch`, então uma falha aqui derruba a resposta com erro 500 mesmo com os dados do Firestore já alterados (RN-03).

---

## 5. Gatilho (Trigger)
Consultor atual acessa `/consultant/transfer-requests`, aba "Pendentes", e clica em "Aprovar" num pedido.

---

## 6. Fluxo Principal (Basic Flow)

1. Consultor acessa `/consultant/transfer-requests` (Portal do Consultor).
2. Sistema chama `GET /api/consultants/transfer-requests` com o Bearer token; a API filtra automaticamente por `current_consultant_id === decodedToken.consultant_id` (a menos que o chamador seja `system_admin`, que vê todos).
3. Sistema exibe os pedidos em duas abas: "Pendentes" (com badge de contagem) e "Histórico" (aprovados/rejeitados).
4. Para um pedido pendente, sistema exibe: nome/documento da clínica, nome/código do consultor solicitante, data de recebimento, e os botões "Aprovar" e "Rejeitar".
5. Consultor clica em "Aprovar".
6. Sistema chama `POST /api/consultants/transfer-requests/{id}/approve` com o Bearer token — **sem nenhuma confirmação adicional** (nem `confirm()` nativo, nem diálogo) — RN-01.
7. API valida token e permissão (`is_system_admin` OU `is_consultant && consultant_id === transferData.current_consultant_id`); verifica que `status === 'pending'`.
8. API busca os dados do consultor solicitante e da clínica.
9. API executa um `batch` atômico: atualiza o pedido para `status: 'approved'`; remove `tenant_id` de `authorized_tenants` do consultor atual; adiciona `tenant_id` a `authorized_tenants` do consultor solicitante; atualiza `tenants/{tenant_id}` com os dados do novo consultor; cria a notificação informativa para o `clinic_admin`.
10. Após o commit do `batch`, API atualiza (sequencialmente, fora da transação, **sem** `try/catch`) os custom claims de ambos os consultores.
11. API enfileira um e-mail para o consultor solicitante avisando da aprovação.
12. Sistema exibe "Transferência aprovada com sucesso" e recarrega a lista de pedidos.
13. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos
Nenhum identificado além do fluxo principal.

---

## 8. Fluxos de Exceção

### 8a. Pedido já processado
1. `status !== 'pending'` no momento da chamada (ex.: já foi aprovado/rejeitado por outra aba/dispositivo).
2. API retorna 400 ("Pedido já foi processado"); nenhuma alteração é feita.

### 8b. Pedido, consultor solicitante ou clínica não encontrados
1. Algum dos documentos referenciados não existe mais (ex.: consultor solicitante foi excluído entre a criação do pedido e a aprovação).
2. API retorna 404; nenhuma alteração é feita.

### 8c. Chamador sem permissão
1. Consultor autenticado não é o `current_consultant_id` do pedido, nem `system_admin`.
2. API retorna 403.

### 8d. Falha ao sincronizar custom claims após o batch já commitado
1. `adminAuth.getUser`/`adminAuth.setCustomUserClaims` falha para qualquer um dos dois consultores.
2. **Diferente do UC-24**, essa chamada não está em `try/catch` — o erro propaga, a rota captura no bloco `catch` externo e retorna 500 ao cliente, **mas os dados do Firestore já foram alterados** pelo `batch` anterior. O usuário veria uma mensagem de erro mesmo com a transferência já efetivamente realizada nos dados — inconsistência entre o que a API reporta e o que de fato ocorreu (RN-03).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A aprovação não exige nenhuma confirmação adicional na UI (nem `confirm()` nativo, diferente de praticamente todas as outras ações destrutivas/importantes documentadas neste projeto até aqui) — um único clique em "Aprovar" já executa a transferência. | Confirmado por leitura de `handleApprove` na tela — chama a API diretamente, sem diálogo de confirmação. |
| RN-02 | Um `system_admin` também pode aprovar qualquer pedido de transferência, não apenas o consultor atual — a API não distingue a origem, apenas verifica a permissão. Não existe, porém, nenhuma tela administrativa que liste esses pedidos para o `system_admin` agir (a única tela existente é a do Portal do Consultor, filtrada por `current_consultant_id`) — um `system_admin` só conseguiria aprovar chamando a API diretamente. | Confirmado por leitura da checagem de permissão em `transfer-requests/[id]/approve/route.ts` e por grep confirmando ausência de página admin equivalente. |
| RN-03 | **[Achado de atomicidade, mais grave que o padrão já visto]** A sincronização de custom claims após o `batch` não está protegida por `try/catch` nesta rota (diferente de UC-24) — uma falha nessa etapa resulta em erro 500 reportado ao usuário, mesmo com os documentos Firestore já definitivamente alterados pela transferência. O usuário pode acreditar que a aprovação falhou quando, na verdade, os dados já mudaram. | Confirmado por leitura literal de `POST /api/consultants/transfer-requests/[id]/approve/route.ts` — chamadas a `adminAuth.getUser`/`setCustomUserClaims` fora de qualquer `try/catch`. |
| RN-04 | Como estabelecido no UC-25 (RN-00), este fluxo depende de um pedido `pending` que, hoje, nunca é criado — a tela `/consultant/transfer-requests` está, na prática, sempre vazia na aba "Pendentes". | Consequência direta do achado do UC-25. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | A listagem de pedidos (`GET /api/consultants/transfer-requests`) usa `orderBy('created_at', 'desc')` sem paginação — pode se tornar um problema de performance/custo conforme o volume crescer, embora hoje irrelevante dado RN-04. | Performance |

---

## 11. Frequência de Uso
**Nula hoje**, por dependência do UC-25 (RN-04).

---

## 12. Casos de Uso Relacionados
- **UC-25 (Solicitar Transferência de Clínica Já Vinculada)** — pré-condição funcional (mas hoje inatingível) deste UC.
- **UC-27 (Rejeitar Pedido de Transferência de Clínica)** — ação alternativa disponível na mesma tela, para o mesmo pedido.
- **UC-23 (Vincular/Alterar/Remover Consultor via Painel Admin)** — mecanismo equivalente e sempre funcional para o `system_admin`, que não depende deste ciclo de aprovação.

---

## 13. Referências
- `src/app/(consultant)/consultant/transfer-requests/page.tsx`
- `src/app/api/consultants/transfer-requests/route.ts` (GET)
- `src/app/api/consultants/transfer-requests/[id]/approve/route.ts`
- `src/types/index.ts` (`ConsultantTransferRequest`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-04, herdado do UC-25]** Este UC só passa a ser útil na prática se o gatilho do UC-25 for implementado — decisão de produto compartilhada com aquele UC.
2. **[RN-03]** Ausência de `try/catch` na sincronização de custom claims pode gerar mensagens de erro enganosas ao usuário (dados já alterados, mas erro reportado) — recomenda-se alinhar com o padrão mais defensivo usado no UC-24.
3. **[RN-01]** Ausência de confirmação antes de uma ação irreversível (troca de consultor de uma clínica) — vale avaliar se deveria haver um `confirm()` ou diálogo, como ocorre em praticamente todas as outras ações equivalentes já mapeadas no sistema.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Fluxo de aprovação documentado como corretamente implementado do lado "consumidor", mas dependente do gatilho ausente identificado no UC-25 (RN-04). Identificado achado de atomicidade mais grave que o padrão já visto em UCs anteriores: falha na sincronização de custom claims pode gerar erro 500 reportado ao usuário mesmo com os dados já definitivamente alterados (RN-03), e ausência de confirmação antes de uma ação irreversível (RN-01). Terceiro de 4 UCs do módulo "Consultor — vínculo com clínicas" (UC-24 a UC-27). |
