# Documentação Experimental - Lista de Clínicas (Tenants)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Lista de Clínicas (`/admin/tenants`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página que lista todas as clínicas (tenants) cadastradas no sistema. Exibe informações de contato, plano, status de pagamento, status ativo/inativo e data de criação. Permite busca textual, filtro por ativos e desativação direta.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/tenants/page.tsx`
- **Rota:** `/admin/tenants`
- **Layout:** Admin Layout

### 1.2 Dependências
- **tenantServiceDirect:** `listTenants()`, `deactivateTenant()`
- **Firestore:** `collection(db, "payment_methods")` → consulta direta para status de pagamento
- **Utils:** `formatCNPJ()`, `formatDocumentAuto()`, `formatTimestamp()`
- **Types:** `Tenant`
- **Lucide Icons:** Plus, Search, Building2, Mail, Phone, FileText, Edit, XCircle, CreditCard

---

## 2. Casos de Uso

### 2.1 UC-001: Listar Clínicas
**Fluxo:**
1. `loadTenants()` chama `listTenants({ limit: 100, activeOnly })`
2. Carrega status de pagamento via `loadPaymentStatus()`
3. Exibe tabela com dados

### 2.2 UC-002: Verificar Status de Pagamento
**Fluxo:**
1. `loadPaymentStatus()` consulta `payment_methods` onde `is_default === true`
2. Cria Set com tenant_ids que possuem método de pagamento
3. Exibe "Configurado" (verde) ou "Pendente" (âmbar) na tabela

### 2.3 UC-003: Buscar Clínicas
**Filtro local** por: nome, email ou documento (CPF/CNPJ)

### 2.4 UC-004: Filtrar Apenas Ativos
**Fluxo:** Toggle "Mostrar Ativos" → recarrega via `listTenants({ activeOnly: true })`

### 2.5 UC-005: Desativar Clínica
**Fluxo:**
1. Botão XCircle (apenas para tenants ativos)
2. `confirm()` com nome do tenant
3. `deactivateTenant(tenantId)`
4. Recarrega lista

### 2.6 UC-006: Editar Clínica
**Ação:** Botão Edit → navega para `/admin/tenants/{id}`

### 2.7 UC-007: Nova Clínica
**Ação:** Botão "Nova Clínica" → navega para `/admin/tenants/new`

---

## 3. Tabela de Clínicas

| Coluna | Descrição |
|--------|-----------|
| Nome | `tenant.name` com ícone Building2 |
| CPF/CNPJ | `formatDocumentAuto()` com ícone FileText |
| Contato | Email (Mail) + Telefone opcional (Phone) |
| Plano | `tenant.plan_id` como Badge outline |
| Pagamento | CreditCard + "Configurado" (verde) ou "Pendente" (âmbar) |
| Status | Badge "Ativo" (default) ou "Inativo" (destructive) |
| Criado em | `formatTimestamp(tenant.created_at)` |
| Ações | Edit (ghost) + Desativar XCircle (ghost, apenas ativos) |

---

## 4. Integrações

### 4.1 Firestore Direto - Payment Methods
```typescript
query(collection(db, "payment_methods"), where("is_default", "==", true))
```
Consulta direta ao Firestore para verificar se tenant possui método de pagamento configurado.

---

## 5. Observações
- Limite de 100 tenants por consulta
- Filtro "ativo" é server-side (recarrega via service), busca textual é client-side
- Desativação usa `confirm()` nativo
- Erro de desativação usa `alert()` nativo
- Compatibilidade: usa `tenant.document_number || tenant.cnpj` para documentos

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
