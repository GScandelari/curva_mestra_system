# Documentação Experimental - Solicitações de Acesso (Clínica)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Solicitações de Acesso (`/clinic/access-requests`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página para clinic_admin aprovar ou rejeitar solicitações de acesso à clínica. Exibe cards com pendentes, vagas disponíveis e usuários ativos. Tabela de solicitações com ações de aprovar/rejeitar. Rejeição inclui dialog com motivo opcional.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/access-requests/page.tsx`
- **Rota:** `/clinic/access-requests`
- **Layout:** Clinic Layout

### 1.2 Dependências
- **accessRequestService:** `listAccessRequests()`, `approveAccessRequest()`, `rejectAccessRequest()`, `getTenantLimits()`
- **Types:** `AccessRequest`, `TenantLimits`
- **Hooks:** `useAuth()`, `useToast()`

---

## 2. Cards de Estatísticas

| Card | Valor |
|------|-------|
| Pendentes | `requests.length` |
| Vagas Disponíveis | `limits.available_slots` de `limits.max_users` |
| Usuários Ativos | `limits.current_users` |

---

## 3. Tabela de Solicitações

| Coluna | Descrição |
|--------|-----------|
| Solicitante | full_name + email |
| Data | `created_at.toDate().toLocaleDateString("pt-BR")` |
| Ações | Aprovar (default) + Rejeitar (destructive) |

---

## 4. Casos de Uso

### 4.1 Aprovar Solicitação
**Fluxo:**
1. Verifica `available_slots > 0`
2. `approveAccessRequest(id, { uid, name })`
3. Toast: "O usuário receberá um email com código de ativação"
4. Recarrega lista

### 4.2 Rejeitar Solicitação
**Fluxo:**
1. Abre Dialog com campo de motivo (opcional, Textarea)
2. `rejectAccessRequest(id, { uid, name }, rejectionReason)`
3. Toast: "O solicitante será notificado"
4. Fecha dialog, recarrega lista

---

## 5. Observações
- Carrega `listAccessRequests({ status: "pendente", tenant_id })` (apenas pendentes)
- Alert de limite quando `available_slots <= 0`
- Botão "Atualizar" manual para recarregar
- Aprovar desabilitado quando sem vagas
- Skeleton para loading state
- Usa `useToast()` para todos os feedbacks

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
