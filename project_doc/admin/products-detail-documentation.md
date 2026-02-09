# Documentação Experimental - Editar Produto

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Edição de Produto (`/admin/products/[id]`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Formulário de edição de produto existente no catálogo master Rennova. Permite alterar código, nome e status (ativo/inativo). Carrega dados existentes via `getMasterProduct` e atualiza via `updateMasterProduct`.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/products/[id]/page.tsx`
- **Rota:** `/admin/products/{id}`
- **Layout:** Admin Layout

### 1.2 Dependências
- **masterProductService:** `getMasterProduct()`, `updateMasterProduct()`
- **Types:** `MasterProduct`, `validateProductCode()`, `normalizeProductName()`
- **Lucide Icons:** Save, Package

---

## 2. Campos do Formulário

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Código do Produto | text (font-mono) | Sim | 7 dígitos numéricos |
| Nome do Produto | text | Sim | MAIÚSCULAS via `normalizeProductName()` |
| Status do Produto | toggle buttons | Sim | Botões "Ativo" / "Inativo" + Badge |

---

## 3. Diferenças da Criação (New)

| Aspecto | New | Edit |
|---------|-----|------|
| Carregamento | Nenhum (formulário vazio) | `getMasterProduct(id)` preenche formulário |
| Operação | `createMasterProduct()` | `updateMasterProduct(id, data)` |
| Campo Status | Não existe | Botões toggle Ativo/Inativo |
| Feedback Sucesso | Redirect imediato | "Produto atualizado com sucesso!" + redirect após 1500ms |

---

## 4. Fluxo de Carregamento

1. Obtém `id` dos params da rota
2. `getMasterProduct(productId)` busca dados
3. Preenche `code`, `name`, `active` nos estados
4. Se erro → exibe mensagem + botão "Voltar para Produtos"

---

## 5. Validações

| Validação | Mensagem de Erro |
|-----------|------------------|
| Código vazio | "Código do produto é obrigatório" |
| Código inválido | "Código inválido. O código deve ter 7 dígitos." |
| Nome vazio | "Nome do produto é obrigatório" |

---

## 6. Fluxo de Submissão

1. Valida código e nome
2. `updateMasterProduct(productId, { code, name: normalizeProductName(name), active })`
3. Sucesso → exibe "Produto atualizado com sucesso!" (verde)
4. Após 1500ms → redirect para `/admin/products`
5. Erro → exibe mensagem de erro (vermelho)

---

## 7. Estados da Interface

| Estado | Exibição |
|--------|----------|
| Carregando | "Carregando produto..." (center, muted) |
| Produto não encontrado | "Produto não encontrado" + botão "Voltar para Produtos" |
| Salvando | Botão "Salvando..." (disabled) |
| Sucesso | Banner verde "Produto atualizado com sucesso!" |
| Erro | Banner vermelho com mensagem |

---

## 8. Observações
- Redirect após sucesso usa `setTimeout` de 1500ms para mostrar feedback
- Toggle de status usa dois botões (não checkbox)
- `formatCodeInput` limita a 7 dígitos numéricos

---

## 9. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
