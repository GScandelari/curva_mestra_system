# Documentação Experimental - Lista de Consultores

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Lista de Consultores (`/admin/consultants`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página que lista todos os consultores Rennova cadastrados no sistema. Permite busca textual, filtro por status (todos/ativos/suspensos) e ações de suspender/reativar direto na tabela. Utiliza API Routes com autenticação Bearer token.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/consultants/page.tsx`
- **Rota:** `/admin/consultants`
- **Layout:** Admin Layout

### 1.2 Dependências
- **Hooks:** `useAuth()`, `useToast()`
- **API Routes:** `GET /api/consultants`, `PUT /api/consultants/{id}`
- **Utils:** `formatTimestamp()`
- **Types:** `Consultant`
- **Lucide Icons:** Plus, Search, Users, Edit, Ban, CheckCircle, Building2, Copy

---

## 2. Casos de Uso

### 2.1 UC-001: Listar Consultores
**Fluxo:**
1. Obtém `idToken` via `user.getIdToken()`
2. GET `/api/consultants?status={status}` com header Authorization
3. Armazena `data.data` em `consultants`

### 2.2 UC-002: Filtrar por Status
**Filtros server-side:** Botões "Todos" (null), "Ativos" ("active"), "Suspensos" ("suspended")
- Muda `statusFilter` → recarrega via `loadConsultants()`

### 2.3 UC-003: Buscar Consultores
**Filtro local** por: nome, email, código ou telefone (case-insensitive)

### 2.4 UC-004: Suspender/Reativar Consultor
**Fluxo:**
1. `confirm()` com nome do consultor
2. PUT `/api/consultants/{id}` com `{ status: newStatus }`
3. Toast de sucesso → recarrega lista

### 2.5 UC-005: Copiar Código
**Ação:** `navigator.clipboard.writeText(code)` → Toast "Código copiado"

### 2.6 UC-006: Editar Consultor
**Ação:** Botão Edit → navega para `/admin/consultants/{id}`

### 2.7 UC-007: Novo Consultor
**Ação:** Botão "Novo Consultor" → navega para `/admin/consultants/new`

---

## 3. Tabela de Consultores

| Coluna | Descrição |
|--------|-----------|
| Código | `consultant.code` (font-mono, sky-600) + botão Copy |
| Nome | `consultant.name` |
| Contato | Email + Telefone (muted) |
| Clínicas | Building2 + `authorized_tenants.length` |
| Status | Badge: Ativo (default), Suspenso (destructive), Inativo (secondary) |
| Criado em | `formatTimestamp(created_at)` |
| Ações | Edit (ghost) + Ban/CheckCircle (toggle status) |

---

## 4. API Routes

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/consultants?status=` | Lista consultores com filtro opcional |
| PUT | `/api/consultants/{id}` | Atualiza status do consultor |

Todas requerem header `Authorization: Bearer {idToken}`.

---

## 5. Observações
- Usa `useToast()` para feedback (não `alert()`)
- Filtro de status é server-side (query param), busca textual é client-side
- Estilo sky-600 (azul) para elementos do consultor
- Botão "Novo Consultor" com `bg-sky-600`
- Suspensão/reativação usa `confirm()` nativo

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
