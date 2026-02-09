# Documentação Experimental - Detalhes da Clínica (Tenant)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Detalhes/Edição de Clínica (`/admin/tenants/[id]`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página complexa (~1040 linhas) que combina visualização de informações, gerenciamento de usuários, informações de pagamento, gestão de consultor Rennova, formulário de edição e zona de perigo (desativar/reativar). Funciona como hub central de administração de um tenant.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/tenants/[id]/page.tsx`
- **Rota:** `/admin/tenants/{id}`
- **Layout:** Admin Layout

### 1.2 Dependências
- **tenantServiceDirect:** `getTenant()`, `updateTenant()`, `deactivateTenant()`, `reactivateTenant()`
- **clinicUserService:** `listClinicUsers()`
- **plans:** `formatPlanPrice()`, `getPlanMaxUsers()`
- **documentValidation:** `validateDocument()`, `formatDocumentAuto()`, `getDocumentType()`
- **Componente:** `TenantPaymentInfo`
- **Firebase Auth:** `auth.currentUser?.getIdToken()` para chamadas de API
- **API Routes:** `/api/users/create`, `/api/consultants/search`, `/api/tenants/{id}/consultant`
- **Types:** `Tenant`, `DocumentType`, `Consultant`, `ClinicUser`

---

## 2. Seções da Página

### 2.1 Card: Informações Gerais (read-only)
Resumo com grid 2 colunas:
- Nome, CPF/CNPJ (formatado), Email, Telefone, Plano (Badge + preço), Endereço

### 2.2 Card: Usuários da Clínica
- Lista de usuários com avatar (Shield para admin, User para regular)
- Exibe nome, email, Badge de role ("Admin"), Badge de status (Ativo/Inativo)
- Contador: "X de Y usuários"
- Botão "Adicionar Usuário" (desabilitado se max_users atingido)

### 2.3 Card: Informações de Pagamento
- Componente externo `TenantPaymentInfo` com props `tenantId` e `tenantName`

### 2.4 Card: Consultor Rennova
- Se possui consultor: exibe nome, código (com botão copiar), botão remover (X)
- Se não possui: placeholder + botão "Configurar Consultor"
- Botão "Alterar" para trocar consultor

### 2.5 Card: Editar Informações (formulário)
Campos editáveis: Nome, CPF/CNPJ (mascarado), Email, Telefone, Endereço, Plano (select), Status (toggle buttons)

### 2.6 Zona de Perigo / Reativar
- Se ativo → Card com borda vermelha + botão "Desativar Clínica"
- Se inativo → Card com borda verde + botão "Reativar Clínica"

---

## 3. Casos de Uso

### 3.1 UC-001: Adicionar Usuário à Clínica
**Fluxo:**
1. Clica "Adicionar Usuário" → abre Dialog
2. Preenche: Nome, Email, Senha, Função (clinic_user/clinic_admin)
3. Obtém `idToken` do admin logado
4. POST `/api/users/create` com `tenant_id_override: tenantId`
5. Sucesso → fecha dialog, recarrega lista de usuários

### 3.2 UC-002: Buscar e Vincular Consultor
**Fluxo:**
1. Abre Dialog de consultor → busca por código/nome/telefone
2. GET `/api/consultants/search?q={query}`
3. Exibe resultados com status (apenas ativos são clicáveis)
4. Clica consultor → `confirm()` → POST `/api/tenants/{id}/consultant` com `new_consultant_id`
5. Recarrega tenant

### 3.3 UC-003: Remover Consultor
**Fluxo:**
1. `confirm()` → DELETE `/api/tenants/{id}/consultant`
2. Recarrega tenant

### 3.4 UC-004: Editar Dados do Tenant
**Fluxo:**
1. Preenche formulário com dados modificados
2. Valida nome, CPF/CNPJ (via `validateDocument`), email
3. `updateTenant(tenantId, { ... })` com `max_users` baseado no tipo de doc (CPF=1, CNPJ=5)
4. Sucesso → "Clínica atualizada com sucesso!" → redirect após 1500ms

### 3.5 UC-005: Desativar Clínica
**Fluxo:** `confirm()` → `deactivateTenant(tenantId)` → redirect após 1500ms

### 3.6 UC-006: Reativar Clínica
**Fluxo:** `confirm()` → `reactivateTenant(tenantId)` → atualiza estado local

### 3.7 UC-007: Copiar Código do Consultor
**Ação:** `navigator.clipboard.writeText(code)` → mensagem de sucesso

---

## 4. API Routes Utilizadas

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/users/create` | Cria usuário para o tenant (com `tenant_id_override`) |
| GET | `/api/consultants/search?q=` | Busca consultores por código, nome ou telefone |
| POST | `/api/tenants/{id}/consultant` | Vincula consultor ao tenant |
| DELETE | `/api/tenants/{id}/consultant` | Remove consultor do tenant |

Todas requerem header `Authorization: Bearer {idToken}`.

---

## 5. Dialogs

### Dialog: Adicionar Novo Usuário
| Campo | Tipo | Descrição |
|-------|------|-----------|
| Nome Completo | text | — |
| Email | email | — |
| Senha | password | Mínimo 6 caracteres |
| Função | select | "Usuário" (clinic_user) ou "Administrador" (clinic_admin) |

### Dialog: Configurar Consultor Rennova
- Input de busca com Enter para pesquisar
- Lista de resultados com avatar, nome, código, email, Badge status
- Consultores inativos: `opacity-60`, `cursor-not-allowed`, não clicáveis
- Limite de scroll: `max-h-64 overflow-y-auto`

---

## 6. Validações do Formulário de Edição

| Validação | Mensagem |
|-----------|----------|
| Nome vazio | "Nome da clínica é obrigatório" |
| Documento inválido | "CPF/CNPJ inválido. Verifique os dígitos verificadores." |
| Tipo de documento inválido | "Tipo de documento inválido" |
| Email vazio | "Email é obrigatório" |

---

## 7. Observações
- Página mais complexa do módulo admin (~1040 linhas)
- Usa `confirm()` nativo para ações destrutivas
- Redirect de sucesso com `setTimeout` de 1500ms
- Compatibilidade: `tenant.document_number || tenant.cnpj` para documentos legados
- `max_users` recalculado automaticamente ao alterar tipo de documento
- Desativar: "irá suspender todos os usuários desta clínica"
- Reativar: atualiza estado local sem redirect

---

## 8. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
