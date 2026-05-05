# BUG — Vínculo Consultor-Clínica: Auto-Link e Transferência sem Aprovação da Clínica

**Branch:** `bugfix/consultant-auto-link-sem-aprovacao`  
**Base:** `develop`  
**Dev:** Guilherme Scandelari → `gscandelari_setup` → `dev-gscandelari.web.app`  
**Data de criação:** 2026-05-04  

---

## Contexto do Problema

### Fluxo atual (incorreto)
1. Consultor busca clínica por CPF/CNPJ
2. Encontra clínica → clica "Solicitar Vínculo"
3. Sistema cria `consultant_claims` com `status: 'pending'`
4. Clínica (clinic_admin) recebe notificação e aprova/rejeita no tab "Consultor"
5. Após aprovação → link é estabelecido

**Problemas:**
- clinic_admin não deveria ter poder de decisão sobre qual consultor a atende
- Se já existe consultor vinculado, bloqueava completamente — sem fluxo de transferência
- O `ClaimClinicDialog` dizia "Aguarde a aprovação do administrador" (comportamento errado)

### Fluxo correto (a implementar)
| Situação                          | Ação                                                              |
|-----------------------------------|-------------------------------------------------------------------|
| Clínica sem consultor             | Vínculo automático imediato — sem aprovação de nenhum lado       |
| Clínica com consultor existente   | Consultor ATUAL recebe notificação e aprova/rejeita a transferência |
| Notificação para clinic_admin     | Apenas informativa (pós-fato) → direciona para `/clinic/my-clinic?tab=consultant` |

---

## Análise de Impacto

### Nova coleção Firestore
```
consultant_transfer_requests/{id}
  requesting_consultant_id: string      — consultor que quer entrar
  requesting_consultant_name: string
  requesting_consultant_code: string
  current_consultant_id: string         — consultor que deve aprovar
  current_consultant_name: string
  tenant_id: string
  tenant_name: string
  tenant_document: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  approved_at?: Timestamp
  rejected_at?: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
```

### Arquivos criados (4)
| # | Arquivo                                                                         | Função                                                              |
|---|---------------------------------------------------------------------------------|---------------------------------------------------------------------|
| 1 | `src/app/api/consultants/transfer-requests/route.ts`                            | GET: lista pedidos de transferência para o consultor atual          |
| 2 | `src/app/api/consultants/transfer-requests/[id]/approve/route.ts`               | POST: consultor atual aprova a transferência                        |
| 3 | `src/app/api/consultants/transfer-requests/[id]/reject/route.ts`                | POST: consultor atual rejeita a transferência                       |
| 4 | `src/app/(consultant)/consultant/transfer-requests/page.tsx`                    | UI: página do consultor para ver e responder pedidos de transferência |

### Arquivos modificados (8)
| # | Arquivo                                                                           | O que muda                                                                  |
|---|-----------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| 1 | `src/types/index.ts`                                                              | + `ConsultantTransferRequestStatus` + `ConsultantTransferRequest` interface |
| 2 | `src/app/api/consultants/claims/route.ts`                                         | POST: se sem consultor → auto-link; se com consultor → criar transfer request |
| 3 | `src/app/api/consultants/claims/[id]/approve/route.ts`                            | Remover permissão `clinic_admin` (apenas `system_admin`)                    |
| 4 | `src/app/api/consultants/claims/[id]/reject/route.ts`                             | Remover permissão `clinic_admin` (apenas `system_admin`)                    |
| 5 | `src/components/consultant/ClaimClinicDialog.tsx`                                 | Atualizar texto/comportamento para auto-link e pedido de transferência      |
| 6 | `src/app/(consultant)/consultant/clinics/search/page.tsx`                         | Habilitar botão mesmo com consultor existente; atualizar textos do "Como funciona?" |
| 7 | `src/components/clinic/ConsultantTab.tsx`                                         | Remover seção "Solicitações Pendentes"; atualizar texto do empty state      |
| 8 | `src/components/consultant/ConsultantLayout.tsx`                                  | + item "Transferências" no nav com badge de pendentes                       |

---

## Steps de Implementação

### Step 1 — Types
**Arquivo:** `src/types/index.ts`

Adicionar ao final da seção CONSULTORES:
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

**Validação:** `npm run type-check` sem erros.

---

### Step 2 — API: transfer-requests GET + POST (criação)
**Arquivo:** `src/app/api/consultants/transfer-requests/route.ts` (criar)

- `GET` — Apenas consultores. Retorna todos os pedidos onde `current_consultant_id == decodedToken.consultant_id`. Filtra por `status` se passado na query.
- `POST` — Não necessário neste endpoint (a criação ocorre dentro do `POST /api/consultants/claims`).

---

### Step 3 — API: transfer-requests approve
**Arquivo:** `src/app/api/consultants/transfer-requests/[id]/approve/route.ts` (criar)

Permissão: apenas `is_consultant` E `consultant_id === current_consultant_id` do transfer request (ou `is_system_admin`).

Ao aprovar (batch write):
1. Atualizar `consultant_transfer_requests/{id}` → `status: 'approved'`, `approved_at`
2. Remover `tenant_id` do `authorized_tenants` do consultor atual → `consultants/{current_consultant_id}`
3. Adicionar `tenant_id` ao `authorized_tenants` do novo consultor → `consultants/{requesting_consultant_id}`
4. Atualizar `tenants/{tenant_id}` → `consultant_id`, `consultant_code`, `consultant_name` (dados do novo consultor)
5. Atualizar Firebase Auth custom claims do novo consultor (add tenant)
6. Atualizar Firebase Auth custom claims do consultor atual (remove tenant)
7. Criar notificação em `tenants/{tenant_id}/notifications`:
   ```json
   {
     "type": "consultant_linked",
     "title": "Consultor alterado",
     "message": "Seu consultor foi alterado para {nome}. Acesse o perfil para mais detalhes.",
     "read": false
   }
   ```
8. Adicionar email para o consultor solicitante em `email_queue` (vínculo aprovado)

---

### Step 4 — API: transfer-requests reject
**Arquivo:** `src/app/api/consultants/transfer-requests/[id]/reject/route.ts` (criar)

Permissão: mesma do approve.

Ao rejeitar:
1. Atualizar `consultant_transfer_requests/{id}` → `status: 'rejected'`, `rejected_at`, `rejection_reason`
2. Adicionar email para o consultor solicitante em `email_queue` (pedido rejeitado)

---

### Step 5 — API: modificar POST /api/consultants/claims
**Arquivo:** `src/app/api/consultants/claims/route.ts`

Manter autenticação e validação básica. Remover a checagem que retorna 400 se clínica já tem consultor.

**Nova lógica do POST:**
```
1. Verificar se clínica existe
2. Verificar se consultor já é o atual desta clínica (retornar 400 se sim)
3. SE tenant.consultant_id == null:
   a. Executar auto-link (batch):
      - Atualizar consultant.authorized_tenants += tenant_id
      - Atualizar tenant: consultant_id, consultant_code, consultant_name
      - Criar consultant_claims com status 'approved' (registro de auditoria)
      - Criar notificação em tenants/{tenant_id}/notifications:
        { type: 'consultant_linked', title: 'Consultor vinculado', 
          message: '{nome} ({code}) foi vinculado como consultor. Acesse Minha Clínica > Consultor para mais detalhes.',
          action_url: '/clinic/my-clinic?tab=consultant' }
      - Atualizar Firebase Auth custom claims do consultor
   b. Retornar { success: true, auto_linked: true }

4. SE tenant.consultant_id != null (clínica já tem consultor):
   a. Verificar se já existe transfer request pendente para este par (retornar 400 se sim)
   b. Criar consultant_transfer_requests com status 'pending'
   c. Enviar email para consultor atual via email_queue:
      { type: 'consultant_transfer_request', to: current_consultant_email,
        subject: 'Pedido de transferência de clínica',
        body: '{nome_novo_consultor} solicitou ser o consultor de {tenant_name}. Acesse o Portal para aprovar ou rejeitar.' }
   d. Retornar { success: true, auto_linked: false, transfer_requested: true }
```

**Remover:** bloco existente que retorna 400 quando `tenantData?.consultant_id` existe.

---

### Step 6 — API: remover permissão clinic_admin de approve/reject de claims
**Arquivo:** `src/app/api/consultants/claims/[id]/approve/route.ts`

Linha 41-43: remover verificação `isClinicAdmin`. Manter apenas `isSystemAdmin`.

**Arquivo:** `src/app/api/consultants/claims/[id]/reject/route.ts`

Linha 43-44: mesma remoção.

---

### Step 7 — UI: ConsultantTab (clinic side)
**Arquivo:** `src/components/clinic/ConsultantTab.tsx`

**Remover:**
- Estado `pendingClaims` e `setPendingClaims`
- Fetch de `/api/consultants/claims?tenant_id=...&status=pending`
- Card "Solicitações de Vínculo Pendentes" (linhas 118–167)
- Handlers `handleApproveClaim` e `handleRejectClaim`
- Imports: `Clock`, `CheckCircle`, `XCircle`

**Atualizar empty state** (quando sem consultor):
```
"Sua clínica ainda não possui um consultor vinculado. 
O consultor pode solicitar o vínculo buscando pelo CNPJ/CPF da sua clínica — 
o vínculo é estabelecido automaticamente."
```

**Atualizar Info Card** — bullets:
- Consultor busca sua clínica pelo CNPJ/CPF e se vincula automaticamente
- Caso haja consultor anterior, ele deve aprovar a transferência
- Consultores têm acesso somente leitura aos dados da clínica

---

### Step 8 — UI: ClaimClinicDialog (consultor side)
**Arquivo:** `src/components/consultant/ClaimClinicDialog.tsx`

**Quando clínica SEM consultor (`!hasConsultant`):**
- Title: "Confirmar Vínculo"
- Description: "Ao confirmar, você será vinculado imediatamente como consultor desta clínica."
- Botão: "Vincular Agora"
- Mensagem de sucesso: "Vínculo estabelecido com sucesso! Você já tem acesso à clínica."

**Quando clínica COM consultor (`hasConsultant`):**
- NÃO bloquear o botão (hoje bloqueia e exibe warning)
- Title: "Solicitar Transferência"
- Description: "Esta clínica já possui o consultor {tenant.consultant_name}. Uma solicitação será enviada para que ele aprove a transferência."
- Botão: "Solicitar Transferência"
- Mensagem de sucesso: "Pedido de transferência enviado! Aguarde a resposta do consultor atual."

---

### Step 9 — UI: search/page.tsx (consultor side)
**Arquivo:** `src/app/(consultant)/consultant/clinics/search/page.tsx`

**Atualizar bloco de resultado quando `tenant.consultant_id` existe:**
Remover o card verde de "Já possui consultor vinculado" que bloqueia a ação.
Substituir por botão "Solicitar Transferência" (amarelo/âmbar) com ícone `ArrowRightLeft`.

**Atualizar Info Card "Como funciona?":**
```
1. Busque a clínica pelo CNPJ ou CPF
2. Se a clínica não tem consultor → vínculo automático imediato
3. Se a clínica já tem consultor → envie pedido de transferência
4. O consultor atual aprova ou rejeita o pedido
```

---

### Step 10 — UI: página de transferências do consultor
**Arquivo:** `src/app/(consultant)/consultant/transfer-requests/page.tsx` (criar)

- Lista pedidos de transferência pendentes onde o consultor logado é `current_consultant_id`
- Mostra: clínica, consultor solicitante, data do pedido
- Botões: "Aprovar" e "Rejeitar" (com prompt para motivo de rejeição)
- Tabs ou filtro: Pendentes / Histórico (aprovados + rejeitados)
- Empty state: "Nenhum pedido de transferência pendente"

---

### Step 11 — UI: ConsultantLayout (nav)
**Arquivo:** `src/components/consultant/ConsultantLayout.tsx`

Adicionar item de navegação "Transferências" com ícone `ArrowRightLeft`:
```typescript
{
  name: 'Transferências',
  href: '/consultant/transfer-requests',
  icon: ArrowRightLeft,
}
```

Posicionar após "Buscar Clínicas".

---

## Mapeamento de Commits

| Step(s)    | Tipo   | Escopo       | Mensagem                                                              |
|------------|--------|--------------|-----------------------------------------------------------------------|
| 1          | `feat` | `types`      | `feat(types): add ConsultantTransferRequest type`                    |
| 2, 3, 4    | `feat` | `api`        | `feat(api): add consultant transfer-requests endpoints`              |
| 5, 6       | `fix`  | `api`        | `fix(api): convert claim flow to auto-link and transfer request`     |
| 7          | `fix`  | `ui`         | `fix(ui): remove clinic_admin approval from ConsultantTab`           |
| 8, 9       | `fix`  | `ui`         | `fix(ui): update ClaimClinicDialog and search for new link flow`     |
| 10, 11     | `feat` | `ui`         | `feat(ui): add transfer requests page to consultant portal`          |

---

## Avaliação de Testes

| Função / Módulo                                 | Avaliação | Justificativa                                                        |
|-------------------------------------------------|-----------|----------------------------------------------------------------------|
| `POST /api/consultants/claims` (lógica nova)    | Não testar | API route com dependência Firebase — mock frágil no MVP             |
| `POST /api/consultants/transfer-requests/approve` | Não testar | Idem                                                               |
| `ConsultantTab.tsx`                             | Não testar | Componente React com Firebase                                        |
| `ClaimClinicDialog.tsx`                         | Não testar | Componente React com Firebase                                        |
| `transfer-requests/page.tsx`                    | Não testar | Page component                                                       |

**Conclusão:** Nenhum teste unitário necessário. Toda a lógica está em API routes e componentes React com dependências Firebase, que os critérios do SST excluem de testes no MVP.

---

## Checklist de Validação Final

- [ ] `npm run lint` sem erros
- [ ] `npm run type-check` sem erros
- [ ] `npm run build` sem erros
- [ ] Consultor sem clínicas → busca → clínica sem consultor → vínculo automático ✓
- [ ] Consultor sem clínicas → busca → clínica com consultor → pedido de transferência ✓
- [ ] Consultor atual recebe pedido na página "Transferências" ✓
- [ ] Consultor atual aprova → vínculo atualizado, notificação para clinic_admin ✓
- [ ] Consultor atual rejeita → pedido marcado como rejeitado, email para solicitante ✓
- [ ] clinic_admin NÃO vê mais botões "Aprovar/Rejeitar" no tab Consultor ✓
- [ ] clinic_admin vê notificação informativa após vínculo automático ✓
- [ ] clinic_admin NÃO pode aprovar claims via API (403) ✓
- [ ] Todas as writes no Firestore são atômicas (batch) ✓
- [ ] Custom claims do Firebase Auth atualizadas corretamente em todos os casos ✓
- [ ] Task branch mergeada em `gscandelari_setup` para validação em `dev-gscandelari.web.app`
- [ ] PR aberto para `develop`

---

## Notas de Implementação

### Sobre o endpoint `/api/consultants/claims` após a mudança
O endpoint existente vai ser mantido (mesmo path) mas com comportamento alterado. Isso evita mudanças no `ClaimClinicDialog` além dos textos — a chamada `fetch('/api/consultants/claims', { method: 'POST' })` continua igual, mas a resposta agora inclui `auto_linked: boolean` para o UI saber o que exibir.

### Sobre notificações do consultor atual
O consultor atual será notificado **por email** (via `email_queue`) + terá visibilidade no portal via a nova página "Transferências". Não há sistema de push/in-app notifications para consultores além da página dedicada.

### Sobre registros de auditoria
O auto-link cria um `consultant_claims` com `status: 'approved'` diretamente (sem passar por `pending`). Isso mantém o histórico de todos os vínculos já estabelecidos na mesma coleção.

### Sobre o campo `action_url` nas notificações
A notificação criada em `tenants/{tenant_id}/notifications` deve incluir:
```json
{ "action_url": "/clinic/my-clinic?tab=consultant" }
```
Verificar se o `NotificationService` já suporta este campo ou se é necessário adicionar ao tipo `Notification` em `src/types/notification.ts`.
