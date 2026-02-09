# Documentação Experimental - Catálogo de Produtos

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Lista de Produtos (`/admin/products`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página que lista todos os produtos do catálogo master Rennova em formato de tabela. Permite busca por código ou nome, filtro ativo/inativo e ações de ativar/desativar direto na lista. Utiliza o `masterProductService` para operações CRUD.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/products/page.tsx`
- **Rota:** `/admin/products`
- **Layout:** Admin Layout

### 1.2 Dependências
- **masterProductService:** `listMasterProducts()`, `deactivateMasterProduct()`, `reactivateMasterProduct()`
- **Types:** `MasterProduct`
- **Lucide Icons:** Package, Plus, Search, Edit, Power, PowerOff

---

## 2. Casos de Uso

### 2.1 UC-001: Listar Produtos
**Fluxo:**
1. `loadProducts()` chama `listMasterProducts({ limit: 1000, activeOnly: false })`
2. Armazena em `products` (todos) e aplica filtros em `filteredProducts`

### 2.2 UC-002: Buscar Produtos
**Fluxo:**
1. Usuário digita no campo de busca
2. `filterProducts()` filtra por `code` ou `name` (case-insensitive)

### 2.3 UC-003: Filtrar Ativos/Inativos
**Fluxo:**
1. Botão toggle "Apenas Ativos" / "Todos"
2. Quando `showInactive = false` → mostra apenas `active === true`
3. Quando `showInactive = true` → mostra todos

### 2.4 UC-004: Ativar/Desativar Produto
**Fluxo:**
1. Clica no botão Power/PowerOff na linha do produto
2. Se ativo → `deactivateMasterProduct(id)` → desativa
3. Se inativo → `reactivateMasterProduct(id)` → reativa
4. Recarrega lista completa

### 2.5 UC-005: Novo Produto
**Ação:** Botão "Novo Produto" → navega para `/admin/products/new`

### 2.6 UC-006: Editar Produto
**Ação:** Botão Edit → navega para `/admin/products/{id}`

---

## 3. Tabela de Produtos

**Colunas:**

| Coluna | Descrição |
|--------|-----------|
| Código | `product.code` (font-mono) |
| Nome do Produto | `product.name` |
| Status | Badge "Ativo" (default) ou "Inativo" (secondary) |
| Ações | Edit (outline) + Power toggle (destructive se ativo) |

**Contador:** "Mostrando X de Y produtos"

---

## 4. Estados da Interface

| Estado | Exibição |
|--------|----------|
| Carregando | "Carregando produtos..." (center, muted) |
| Lista vazia | "Nenhum produto encontrado" (center, muted) |
| Erro | Banner vermelho com mensagem |
| Normal | Tabela com produtos |

---

## 5. Observações
- Carrega até 1000 produtos de uma vez (sem paginação)
- Filtro de busca é local (client-side) sobre dados já carregados
- Toggle ativo/inativo não pede confirmação
- Não há confirmação para desativar produto

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
