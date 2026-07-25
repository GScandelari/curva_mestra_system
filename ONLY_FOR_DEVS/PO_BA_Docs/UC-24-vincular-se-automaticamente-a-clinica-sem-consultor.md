# UC-24: Vincular-se Automaticamente a uma Clínica Sem Consultor (Auto-Link)

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Portal do Consultor (Vínculo com Clínicas)
**Versão:** 1.0.1

> Um Consultor Rennova busca uma clínica pelo CNPJ/CPF no Portal do Consultor e, se ela ainda não tiver nenhum consultor vinculado, estabelece o vínculo imediatamente com um único clique — sem aprovação de ninguém (nem da clínica, nem de um system_admin). **Achado confirmado:** existe um par de rotas de API (`api/consultants/claims/[id]/approve` e `[id]/reject`) que implementa um fluxo antigo de aprovação manual por `system_admin` — mas o próprio código-fonte confirma, em comentário, que foi substituído por este auto-link, e nenhuma tela do sistema as chama (código morto). **Atualização (v1.0.1, commit `001671b`):** a sincronização de custom claims (RN-02), antes protegida por um `try/catch` que absorvia o erro silenciosamente e sempre retornava sucesso ao cliente, passou a usar o utilitário compartilhado `src/lib/services/consultantClaimsSync.ts` — o resultado agora é reportado explicitamente via `claims_synced: boolean` no corpo da resposta. **Nota lateral:** o mesmo commit também corrigiu a rota órfã `claims/[id]/approve` (RN-05) para usar o mesmo utilitário — mas isso não altera a conclusão de que a rota continua sendo código morto (nenhuma claim `pending` é criada hoje, nenhuma tela a chama); foi uma correção de consistência/defesa em profundidade, não uma reativação do fluxo antigo.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    Consultor([👤 Consultor Rennova])

    subgraph Sistema["Curva Mestra — Portal do Consultor"]
        UC24(("UC-24\nVincular-se Automaticamente\na Clínica Sem Consultor"))
    end

    subgraph Orfao["⚠️ Rotas órfãs — fluxo de aprovação superado"]
        Approve(("claims/[id]/approve\n(nunca há claim 'pending'\npara aprovar)"))
    end

    Consultor --> UC24
    UC24 -.->|registro de auditoria já nasce 'approved'| Approve
```

---

## 2. Atores

### 2.1 Ator Primário
**Consultor Rennova** — usuário Firebase Auth próprio (não pertence a nenhum `tenant_id`; `tenant_id: null` nos custom claims), com `is_consultant: true` e `consultant_id` apontando para seu documento em `consultants/{id}`. Acessa o Portal do Consultor, grupo de rotas `(consultant)`.

### 2.2 Atores Secundários / Sistemas Externos
- **Clínica (tenant)** afetada — recebe uma notificação informativa (`tenants/{tenant_id}/notifications`), mas não participa da decisão.
- **Firebase Auth** — via `adminAuth.setCustomUserClaims`, para sincronizar `authorized_tenants` no token do consultor.

---

## 3. Pré-condições
- Consultor autenticado, com `is_consultant === true` e `consultant_id` presente no token.
- A clínica buscada existe em `tenants` e **não possui** `consultant_id` preenchido.
- O consultor buscando não é já o consultor vinculado a essa clínica (checagem redundante, dado que `consultant_id` está vazio, mas existe explicitamente no código).

---

## 4. Pós-condições

### 4.1 Sucesso
- `consultants/{consultantId}.authorized_tenants` passa a incluir o `tenant_id`.
- `tenants/{tenant_id}.consultant_id`, `consultant_code` e `consultant_name` são preenchidos com os dados do consultor.
- Um documento é criado em `consultant_claims` **já com `status: 'approved'`** — funciona como registro de auditoria da ação, não como uma etapa de aprovação pendente (RN-01).
- Uma notificação informativa é criada em `tenants/{tenant_id}/notifications` (`type: 'consultant_linked'`), visível para o `clinic_admin`.
- Os custom claims do consultor (`authorized_tenants`) são atualizados para incluir o `tenant_id`, via `syncConsultantAuthorizedTenants` (etapa sequencial, fora da transação — RN-02, corrigido no commit `001671b`); o resultado (`claims_synced: boolean`) é retornado explicitamente na resposta.

### 4.2 Falha (Garantias Mínimas)
- Se a validação falhar antes do `batch` (clínica não encontrada, consultor já vinculado, claim pendente duplicada): nenhuma alteração é feita.
- Se o `batch` for commitado mas a sincronização de custom claims falhar depois: o vínculo já está gravado no Firestore (`tenants`/`consultants`), mas o token do consultor pode ficar temporariamente desatualizado até novo login ou nova tentativa (mesmo padrão de RN-03 do UC-23). **[Atualizado v1.0.1]** Diferente do comportamento anterior (falha absorvida silenciosamente, sempre `success: true` sem indicação nenhuma), a resposta agora inclui `claims_synced: false` explicitamente nesse cenário — o cliente pode, em tese, tratar esse caso de forma diferenciada (hoje a tela ainda exibe a mesma mensagem de sucesso genérica, ver RN-02 corrigido).

---

## 5. Gatilho (Trigger)
Consultor, na tela `/consultant/clinics/search`, busca uma clínica por CNPJ/CPF e clica em "Vincular Agora" num resultado que não possui consultor vinculado.

---

## 6. Fluxo Principal (Basic Flow)

1. Consultor acessa `/consultant/clinics/search` (Portal do Consultor).
2. Informa o CNPJ ou CPF da clínica no campo de busca e clica no botão de busca.
3. Sistema chama `GET /api/tenants/search?document={documento}` com o Bearer token do consultor.
4. Sistema exibe os resultados: nome da clínica, tipo/número do documento, e-mail, e o consultor atual (se houver).
5. Para uma clínica **sem** `consultant_id`, o sistema exibe um botão "Vincular Agora"; para uma clínica que já tem consultor, exibe apenas uma mensagem informativa, sem nenhum botão de ação (ver UC-25 para o que acontece nesse segundo caso).
6. Consultor clica em "Vincular Agora".
7. Sistema chama `POST /api/consultants/claims` com `{ tenant_id }` e o Bearer token do consultor.
8. API valida o token, exige `is_consultant === true` e `consultant_id` presentes no token; busca os dados do consultor e da clínica; retorna erro se o consultor já for o vinculado a essa clínica.
9. Como `tenantData.consultant_id` está vazio, a API entra no ramo de auto-link: verifica se já existe uma claim com `status === 'pending'` para este par consultor/clínica (RN-04 — checagem hoje inatingível na prática).
10. API executa um `batch` atômico: cria o documento em `consultant_claims` já com `status: 'approved'`; adiciona `tenant_id` a `authorized_tenants` do consultor; atualiza `tenants/{tenant_id}` com `consultant_id`/`consultant_code`/`consultant_name`; cria a notificação informativa em `tenants/{tenant_id}/notifications`.
11. Após o commit do `batch` (fora dele, sequencialmente), API chama `syncConsultantAuthorizedTenants(userId, tenant_id, 'add')` (utilitário compartilhado, `src/lib/services/consultantClaimsSync.ts`) para incluir o `tenant_id` em `authorized_tenants` do consultor — a função nunca propaga exceção, sempre retorna `{ synced, error? }` (RN-02, corrigido no commit `001671b`).
12. API retorna `{ success: true, auto_linked: true, claims_synced, message: 'Vínculo estabelecido com sucesso' }`. Sistema exibe "Vínculo estabelecido com sucesso!" e marca visualmente o resultado como "Vinculado com sucesso" — **a UI ainda não diferencia visualmente o caso `claims_synced: false`** (mesma mensagem de sucesso em ambos os casos).
13. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos
Nenhum identificado além do fluxo principal — a ação é única e direta (buscar → clicar → vincular).

---

## 8. Fluxos de Exceção

### 8a. Consultor já é o vinculado a esta clínica
1. API retorna 400 ("Você já é o consultor vinculado a esta clínica").
2. Sistema exibe a mensagem de erro; nada é alterado.

### 8b. Clínica não encontrada
1. `tenant_id` recebido não corresponde a nenhum documento existente.
2. API retorna 404; sistema exibe a mensagem de erro.

### 8c. Token ausente/inválido ou usuário não é consultor
1. Sistema retorna 401 (token ausente) ou 403 (`is_consultant`/`consultant_id` ausentes no token).
2. Nenhuma alteração é feita.

### 8d. Falha ao sincronizar custom claims após o batch já commitado
1. `adminAuth.getUser`/`adminAuth.setCustomUserClaims` falha dentro de `syncConsultantAuthorizedTenants`.
2. **[CORRIGIDO em v1.0.1, commit `001671b`]** A função captura o erro internamente e retorna `{ synced: false, error }` — a API não propaga como falha da requisição, retorna sucesso ao cliente (`success: true`), mas agora com `claims_synced: false` explícito no corpo da resposta, em vez do `console.warn` isolado de antes. O usuário ainda vê "Vínculo estabelecido com sucesso!" (a UI não foi alterada para diferenciar esse caso), mas o dado de que a sincronização falhou deixa de estar disponível apenas nos logs do servidor — passa a existir no contrato de resposta da API (RN-02).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | O auto-link é **imediato e sem aprovação de ninguém** — nem do `clinic_admin` da clínica, nem de um `system_admin`. O documento criado em `consultant_claims` já nasce com `status: 'approved'`, servindo apenas como registro de auditoria da ação, não como uma etapa de aprovação real. A clínica só é informada **depois do fato consumado**, via notificação. | Confirmado por leitura literal do ramo "CASO 1" de `POST /api/consultants/claims`. |
| RN-02 | **[CORRIGIDO em v1.0.1, commit `001671b`]** A sincronização dos custom claims do consultor continua ocorrendo fora do `batch` atômico do Firestore (limitação de plataforma, não eliminável) — mas o `try/catch` que antes **absorvia o erro silenciosamente** (só `console.warn`, sempre retornando sucesso sem qualquer indicação) foi substituído pela chamada ao utilitário compartilhado `syncConsultantAuthorizedTenants` (`src/lib/services/consultantClaimsSync.ts`, mesmo usado pelo UC-23 e UC-26). O resultado (`claims_synced: boolean`) agora é retornado explicitamente no JSON de resposta (`auto_linked: true, claims_synced, message: '...'`) — o risco de inconsistência entre dados e claims em si não foi eliminado (mesma limitação de RN-03 do UC-23), mas deixou de ser silencioso a ponto de nem aparecer na resposta da API. | Confirmado por diff do commit `001671b` em `src/app/api/consultants/claims/route.ts` — bloco `try/catch` original substituído por `syncConsultantAuthorizedTenants`, resposta inclui `claims_synced`. |
| RN-03 | A busca de clínicas usa `GET /api/tenants/search?document=...` (rota compartilhada, não documentada neste UC) — exige o documento completo (mínimo 11 dígitos), não busca por nome. | Confirmado por leitura da tela de busca. |
| RN-04 | **[Achado — checagem hoje inatingível]** O ramo de auto-link verifica se já existe uma `consultant_claims` com `status === 'pending'` para o mesmo par consultor/clínica antes de prosseguir — mas, como nenhum fluxo atual do sistema cria uma claim com esse status (o auto-link cria direto como `'approved'`, e o fluxo de transferência usa a coleção `consultant_transfer_requests`, não `consultant_claims`), essa checagem de duplicidade é hoje código efetivamente inatingível, a menos que existam registros legados de antes da migração para o fluxo atual. | Confirmado por leitura completa de `POST /api/consultants/claims` e por grep confirmando que nenhum outro caminho do código cria `consultant_claims` com `status: 'pending'`. |
| RN-05 | **[Achado crítico — mesma clareza do UC-05/UC-22, rotas órfãs confirmadas]** As rotas `POST /api/consultants/claims/[id]/approve` e `POST /api/consultants/claims/[id]/reject` implementam um fluxo antigo em que um `system_admin` aprovava/rejeitava manualmente uma claim pendente — o próprio código-fonte confirma isso em comentário: *"Apenas system_admin pode aprovar claims diretamente (o novo fluxo usa auto-link)"* e *"...o novo fluxo usa transfer requests"*. Confirmado por grep exaustivo que **nenhuma tela do sistema chama essas duas rotas**, e que, como estabelecido em RN-04, nenhum fluxo atual sequer cria uma claim `pending` para elas processarem. São código morto duplo: sem gatilho de UI e sem dado de entrada possível. **Nota (v1.0.1, commit `001671b`):** apesar de permanecer código morto (conclusão acima inalterada — sem gatilho de UI, sem dado de entrada), a rota `claims/[id]/approve` foi encontrada, na mesma varredura que corrigiu RN-02 (UC-23/UC-24/UC-26), com o mesmo bug de sincronização de claims sem `try/catch` protegido (chamada direta a `adminAuth.getUser`/`setCustomUserClaims`, capaz de derrubar a resposta com 500 **se** algum dia voltasse a ser alcançável). Foi corrigida por consistência/defesa em profundidade — passou a usar `syncConsultantAuthorizedTenants` e a retornar `claims_synced: boolean` — mas isso não reativa nem torna o fluxo alcançável; é relevante apenas caso a decisão pendente do item 1 da Seção 14 seja, no futuro, reconectar essa rota. `claims/[id]/reject` (a rota irmã) **não** foi tocada por este commit e permanece com o comportamento original (sem chamada a claims, já que rejeitar não sincroniza `authorized_tenants`). | Confirmado por leitura completa das duas rotas e grep de `consultants/claims` em `src/app`. Correção adicional confirmada por diff do commit `001671b` em `src/app/api/consultants/claims/[id]/approve/route.ts`. |
| RN-06 | **[Achado adicional de regra Firestore]** A regra do Firestore para `consultant_claims` permite que o `clinic_admin` do tenant faça `read, update` diretamente nos documentos de claim do seu tenant (`belongsToTenant(resource.data.tenant_id) && hasRole('clinic_admin')`) — ou seja, mesmo que as rotas de API de aprovação/rejeição (RN-05) estejam mortas, um `clinic_admin` poderia, em tese, escrever diretamente no Firestore para alterar o `status` de uma claim, sem qualquer tela ou validação de negócio server-side. Como nenhuma claim `pending` chega a existir hoje (RN-04), esse é um risco teórico, não ativo. | Confirmado por leitura de `firestore.rules`, `match /consultant_claims/{claimId}`. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Diferente das rotas administrativas de UC-21/UC-23, a falha de sincronização de custom claims aqui era **absorvida silenciosamente** (RN-02) — não era reportada nem ao usuário nem de forma diferenciada nos logs (mesmo nível de severidade que um aviso comum). **[Atualizado v1.0.1]** Desde o commit `001671b`, o resultado (`claims_synced`) passa a ser reportado no corpo da resposta — a observabilidade melhora no contrato da API, mas a UI ainda não usa esse dado para diferenciar a mensagem exibida ao usuário. | Observabilidade |
| RNF-02 | A validação de Bearer token e de claims (`is_consultant`/`consultant_id`) segue o mesmo padrão correto encontrado em outras rotas administrativas do sistema. | Segurança |

---

## 11. Frequência de Uso
Ocasional a frequente — depende do ritmo de expansão da carteira de clínicas de cada consultor; presumivelmente mais comum no onboarding inicial de um novo consultor.

---

## 12. Casos de Uso Relacionados
- **UC-25 (Solicitar Transferência de Clínica Já Vinculada)** — mesma tela, mesma API (`POST /api/consultants/claims`), mas ramo "CASO 2" (clínica já tem consultor); ver achado crítico sobre ausência de gatilho de UI documentado lá.
- **UC-23 (Vincular/Alterar/Remover Consultor de uma Clínica via Painel Admin)** — mecanismo equivalente do lado do `system_admin`; desde o commit `001671b`, ambos os UCs (e o UC-26) compartilham o mesmo utilitário de sincronização de claims (`src/lib/services/consultantClaimsSync.ts`).
- **UC-26 (Aprovar Pedido de Transferência de Clínica)** — terceira rota que passou a usar o mesmo utilitário compartilhado (commit `001671b`).
- **UC-21/UC-22** — tela `admin/tenants/[id]/page.tsx`, onde `tenant.consultant_id` também pode ser gerenciado.

---

## 13. Referências
- `src/app/(consultant)/consultant/clinics/search/page.tsx`
- `src/app/api/consultants/claims/route.ts` (ramo "CASO 1"; alterado pelo commit `001671b` — sincronização de claims via `syncConsultantAuthorizedTenants`, RN-02)
- `src/app/api/consultants/claims/[id]/approve/route.ts` (órfão — RN-05; também alterado pelo commit `001671b`, mesma correção defensiva)
- `src/app/api/consultants/claims/[id]/reject/route.ts` (órfão — RN-05; não alterado)
- `src/app/api/tenants/search/route.ts`
- `src/lib/services/consultantClaimsSync.ts` (utilitário compartilhado de sincronização de claims — RN-02, commit `001671b`)
- `src/types/index.ts` (`Consultant`, `CustomClaims`)
- `firestore.rules` (`consultants/{consultantId}`, `consultant_claims/{claimId}`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-05]** As rotas `claims/[id]/approve` e `claims/[id]/reject` são código morto duplamente confirmado — decisão de produto pendente: remover, ou mantê-las como estão (sem risco ativo, já que nunca são alcançadas). **Nota v1.0.1:** `claims/[id]/approve` recebeu, ainda assim, a mesma correção de sincronização de claims que UC-23/UC-24/UC-26 (commit `001671b`) — puramente defensivo, não altera esta pendência nem a conclusão de que a rota é inalcançável hoje.
2. ~~**[RN-02]** A falha silenciosa na sincronização de custom claims pode causar um estado onde o Firestore já reflete o vínculo, mas o token do consultor (até novo login) ainda não enxerga a clínica — vale avaliar se deveria haver alguma notificação/retry.~~ **[PARCIALMENTE RESOLVIDO em v1.0.1, commit `001671b`]** A falha deixou de ser silenciosa — `claims_synced: false` agora é reportado na resposta da API. **Ainda em aberto:** a UI não usa esse campo (mensagem de sucesso é a mesma independente de `claims_synced`), e não há retry/notificação automática quando `synced: false`.
3. **[RN-06]** Risco teórico de escrita direta por `clinic_admin` na coleção `consultant_claims` via regra Firestore permissiva — hoje não explorável na prática (RN-04), mas vale revisão futura da regra.
4. **[Novo, v1.0.1]** Sinalizar ao `uc-issues-tracker`: a correção do commit `001671b` tocou uma rota (`claims/[id]/approve`) que este UC documenta como código morto (RN-05) — vale revisão cruzada para confirmar que nenhum outro UC assume incorretamente que essa rota está ativa ou reconectada à UI.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Confirmado que o auto-link é imediato e sem aprovação de ninguém (RN-01); identificadas as rotas órfãs `claims/[id]/approve`/`reject`, confirmadas como código morto duplo tanto por ausência de chamada na UI quanto por ausência de dado de entrada (`status: 'pending'`) desde a migração para este fluxo (RN-04, RN-05); e uma falha silenciosa na sincronização de custom claims não presente nas rotas administrativas equivalentes (RN-02). Primeiro de 4 UCs do módulo "Consultor — vínculo com clínicas" (UC-24 a UC-27). |
| 1.0.1 | 24/07/2026 | Guilherme Scandelari | Correção pontual (commit `001671b`): RN-02 marcada como corrigida — a sincronização de custom claims em `POST /api/consultants/claims` (CASO 1, auto-link) passou a usar o utilitário compartilhado `src/lib/services/consultantClaimsSync.ts`, com `try/catch` interno que nunca propaga exceção; resposta passa a incluir `claims_synced: boolean` no lugar do `console.warn` silencioso anterior. Nota adicional: a mesma correção também tocou a rota órfã `claims/[id]/approve` (RN-05), sem alterar sua condição de código morto — documentado como nota lateral e sinalizado para o `uc-issues-tracker`. Seções 4.1, 4.2, 6 (passos 11-12), 8d, 9 (RN-02, RN-05), 10 (RNF-01), 12, 13 e 14 atualizadas. |
