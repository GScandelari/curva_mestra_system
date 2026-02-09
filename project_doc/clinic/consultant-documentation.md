# Documentação Experimental - Consultor (Clínica)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Consultor (`/clinic/consultant`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de gerenciamento do consultor vinculado à clínica. Exibe solicitações de vínculo pendentes (approve/reject), informações do consultor atual (código, contato) e ações de transferência/remoção. Usa API Routes com Bearer token.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/consultant/page.tsx`
- **Rota:** `/clinic/consultant`
- **Layout:** Clinic Layout

### 1.2 Dependências
- **API Routes:**
  - `GET /api/tenants/{tenantId}/consultant` (consultor atual)
  - `DELETE /api/tenants/{tenantId}/consultant` (remover)
  - `GET /api/consultants/claims?tenant_id={tenantId}&status=pending` (claims pendentes)
  - `POST /api/consultants/claims/{claimId}/approve` (aprovar claim)
  - `POST /api/consultants/claims/{claimId}/reject` (rejeitar claim)
- **Types:** `Consultant`, `ConsultantClaim`
- **Hooks:** `useAuth()`, `useToast()`

---

## 2. Seções da Página

### 2.1 Solicitações de Vínculo Pendentes
- Card com borda amber (bg-amber-50)
- Visível apenas se: `pendingClaims.length > 0 && isClinicAdmin`
- Cada claim mostra: nome, código, badge "Pendente"
- Botões: Aprovar + Rejeitar

### 2.2 Consultor Atual (quando vinculado)
- **Código do Consultor:** Display grande (font-mono, tracking-widest) + botão copiar
- **Informações:** Nome, Email (com ícone Mail), Telefone (com ícone Phone)
- **Status:** Badge "Ativo" (default) ou "Inativo" (destructive)
- **Ações (clinic_admin):** Transferir → `/clinic/consultant/transfer`, Remover (com confirm)

### 2.3 Nenhum Consultor (quando não vinculado)
- Empty state com ícone UserCheck
- Mensagem: "Sua clínica ainda não possui um consultor vinculado"
- Botão "Vincular Consultor" → `/clinic/consultant/transfer` (clinic_admin)

### 2.4 Card Informativo
- "Sobre Consultores" com lista de regras:
  - Acesso somente leitura
  - Limite de 1 consultor por clínica
  - Transferência/remoção a qualquer momento
  - Acesso a estoque, procedimentos e relatórios

---

## 3. Casos de Uso

### 3.1 Aprovar Claim
**Fluxo:**
1. `POST /api/consultants/claims/{claimId}/approve` com Bearer token
2. Toast: "Solicitação aprovada com sucesso"
3. Recarrega dados (loadData)

### 3.2 Rejeitar Claim
**Fluxo:**
1. `prompt()` para motivo (opcional)
2. `POST /api/consultants/claims/{claimId}/reject` com body `{ reason }`
3. Toast: "Solicitação rejeitada"
4. Recarrega dados

### 3.3 Remover Consultor
**Fluxo:**
1. `confirm()` de confirmação
2. `DELETE /api/tenants/{tenantId}/consultant` com Bearer token
3. Toast: "Consultor removido com sucesso"
4. `setConsultant(null)` (atualiza UI imediatamente)

### 3.4 Copiar Código
- `navigator.clipboard.writeText(consultant.code)`
- Toast: "Código copiado"

---

## 4. Regras de Negócio

- **RN-001:** Cada clínica pode ter no máximo 1 consultor vinculado
- **RN-002:** Ações de aprovar/rejeitar/remover/transferir são restritas a `clinic_admin`
- **RN-003:** Consultores têm acesso read-only aos dados da clínica
- **RN-004:** Claims pendentes usam borda amber para destaque visual

---

## 5. Observações
- Loading state: spinner animado (não skeleton)
- Autenticação via `user.getIdToken()` para Bearer token em todas as chamadas
- Remoção usa `confirm()` nativo do browser
- Rejeição usa `prompt()` nativo para motivo
- Página ~370 linhas

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
