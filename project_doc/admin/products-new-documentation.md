# Documentação Experimental - Novo Produto

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Criação de Produto (`/admin/products/new`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Formulário simples para cadastro de novos produtos no catálogo master Rennova. Contém apenas dois campos: código (7 dígitos) e nome do produto (convertido automaticamente para maiúsculas).

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/products/new/page.tsx`
- **Rota:** `/admin/products/new`
- **Layout:** Admin Layout

### 1.2 Dependências
- **masterProductService:** `createMasterProduct()`
- **Types:** `validateProductCode()`, `normalizeProductName()`
- **Lucide Icons:** Save, Package

---

## 2. Campos do Formulário

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Código do Produto | text (font-mono) | Sim | Exatamente 7 dígitos numéricos |
| Nome do Produto | text | Sim | Convertido para MAIÚSCULAS via `normalizeProductName()` |

---

## 3. Regras de Negócio

### RN-001: Formato do Código
- `formatCodeInput()` remove caracteres não-numéricos (`/\D/g`)
- Limita a 7 caracteres (`slice(0, 7)`)
- `maxLength={7}` no input
- `validateProductCode()` valida exatamente 7 dígitos

### RN-002: Normalização do Nome
- `normalizeProductName()` converte para MAIÚSCULAS antes de enviar
- Exibido como hint: "O nome será convertido para MAIÚSCULAS automaticamente"

---

## 4. Validações

| Validação | Mensagem de Erro |
|-----------|------------------|
| Código vazio | "Código do produto é obrigatório" |
| Código inválido | "Código inválido. O código deve ter 7 dígitos." |
| Nome vazio | "Nome do produto é obrigatório" |

---

## 5. Fluxo de Submissão

1. Valida código (não vazio + 7 dígitos)
2. Valida nome (não vazio)
3. `createMasterProduct({ code: code.trim(), name: normalizeProductName(name) })`
4. Sucesso → redirect para `/admin/products`
5. Erro → exibe mensagem de erro

---

## 6. Observações
- Não exibe feedback de sucesso (redirect imediato)
- Input de código usa `font-mono` para melhor legibilidade
- Placeholder do nome: "NABOTA 200U 1FR/AMP"
- Placeholder do código: "9274598"

---

## 7. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
