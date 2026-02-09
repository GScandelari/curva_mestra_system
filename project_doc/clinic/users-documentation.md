# Documentação Experimental - Usuários da Clínica

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Usuários (`/clinic/users`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de gerenciamento de usuários da clínica. Exibe cards de estatísticas (total, ativos, admins), tabela de usuários e dialog para criar novos. Respeita limite `max_users` do tenant. Apenas `clinic_admin` pode acessar.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/users/page.tsx`
- **Rota:** `/clinic/users`
- **Layout:** Clinic Layout

### 1.2 Dependências
- **Firestore:** `users` (filtro por tenant_id), `tenants/{tenantId}` (max_users)
- **API Route:** `POST /api/users/create`
- **Hooks:** `useAuth()`
- **Restrição:** `clinic_admin` (redirect para dashboard se não for admin)

---

## 2. Cards de Estatísticas

| Card | Valor |
|------|-------|
| Total de Usuários | `users.length` / Limite: `maxUsers` |
| Usuários Ativos | `users.filter(u => u.active).length` |
| Administradores | `users.filter(u => u.role === "clinic_admin").length` |

---

## 3. Tabela de Usuários

| Coluna | Descrição |
|--------|-----------|
| Usuário | Nome + ícone (Shield para admin, User para regular) |
| Email | email (muted) |
| Role | Badge "Administrador" (default) ou "Usuário" (outline) |
| Status | Badge "Ativo" (default) ou "Inativo" (destructive) |
| Cadastro | `formatTimestamp(created_at)` |

---

## 4. Dialog: Adicionar Novo Usuário

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Nome Completo | text | Obrigatório |
| Email | email | Obrigatório |
| Senha | password | Min 6 caracteres |
| Tipo de Usuário | Shadcn Select | clinic_user ou clinic_admin |

Chama `POST /api/users/create` com Authorization Bearer token.

---

## 5. Regras de Negócio

- **RN-001:** `max_users` vem do tenant (CPF=1, CNPJ=5, fallback=5)
- **RN-002:** Botão "Adicionar Usuário" desabilitado quando `users.length >= maxUsers`
- **RN-003:** Alert de "Limite atingido" quando max_users é alcançado
- **RN-004:** Busca local por nome ou email

---

## 6. Observações
- Usa Shadcn Select (não select nativo) para role
- Firestore query: `users` WHERE `tenant_id == tenantId` ORDER BY `created_at desc`
- Busca textual é client-side

---

## 7. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
