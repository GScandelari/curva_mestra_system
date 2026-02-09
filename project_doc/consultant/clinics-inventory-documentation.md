# Documentação Experimental - Estoque da Clínica (Consultor)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Consultor
**Componente:** Estoque da Clínica (`/consultant/clinics/[tenantId]/inventory`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Visualização read-only do inventário de uma clínica vinculada. Exibe cards de estatísticas, filtros por status (todos/vencendo/estoque baixo/esgotado), busca textual, tabela completa de produtos e exportação para Excel. Dados carregados diretamente do Firestore.

### 1.1 Localização
- **Arquivo:** `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx`
- **Rota:** `/consultant/clinics/{tenantId}/inventory`
- **Layout:** Consultant Layout

### 1.2 Dependências
- **Firestore:** `tenants/{tenantId}/inventory` (where active == true, orderBy nome_produto)
- **Componentes:** `ReadOnlyBanner`
- **Services:** `exportToExcel`, `formatDecimalBR` (reportService)
- **Hooks:** `useAuth()` (user, authorizedTenants, claims)

---

## 2. Cards de Estatísticas (grid 4 colunas)

| Card | Cálculo | Cor |
|------|---------|-----|
| Total de Produtos | `inventory.length` | — |
| Produtos Disponíveis | Soma `quantidade_disponivel` + reservados | Verde |
| Próximos ao Vencimento | Validade <= 30 dias e qty > 0 | Amarelo |
| Estoque Baixo | `0 < quantidade_disponivel < 10` | Laranja |

---

## 3. Filtros

### 3.1 Busca Textual
- Busca case-insensitive por `nome_produto`, `codigo_produto`, `lote`

### 3.2 Filtros por Status (Botões toggle)

| Filtro | Condição |
|--------|----------|
| Todos | Sem filtro |
| Vencendo | Validade <= 30 dias e qty > 0 |
| Estoque Baixo | `0 < quantidade_disponivel < 10` |
| Esgotado | `quantidade_disponivel === 0` |

---

## 4. Tabela de Produtos

| Coluna | Campo | Formato |
|--------|-------|---------|
| Código | `codigo_produto` | Monospace |
| Produto | `nome_produto` | Bold |
| Lote | `lote` | Monospace |
| Qtd. Total | `disponivel + reservada` | Bold cinza |
| Reservado | `quantidade_reservada` | Laranja |
| Disponível | `quantidade_disponivel` | Verde bold |
| Validade | `dt_validade` | dd/mm/yyyy + ícone Calendar |
| Valor Un. | `valor_unitario` | BRL |
| Status | Badges de validade + estoque | — |

---

## 5. Badges

### 5.1 Validade
| Condição | Variante | Texto |
|----------|----------|-------|
| qty === 0 | secondary | Sem estoque |
| dias < 0 | destructive | Vencido |
| dias <= 7 | destructive | {X} dias |
| dias <= 30 | warning | {X} dias |
| dias > 30 | default | {X} dias |

### 5.2 Estoque
| Condição | Variante | Texto |
|----------|----------|-------|
| qty === 0 | destructive | Esgotado + TrendingDown |
| qty < 10 | warning | Baixo + AlertTriangle |
| qty >= 10 | default | Normal |

---

## 6. Exportação Excel

Campos exportados: Código, Produto, Lote, Qtd. Total, Reservado, Disponível, Validade, Valor Unitário, NF.

---

## 7. Regras de Negócio
- **RN-001:** Verificação `authorizedTenants.includes(tenantId)` antes de carregar
- **RN-002:** Apenas itens com `active == true`
- **RN-003:** Acesso read-only (sem ações de modificação)

---

## 8. Observações
- Página espelha funcionalidade do `/clinic/inventory` mas sem ações de escrita
- ReadOnlyBanner exibido no topo
- Botão "Voltar" → `/consultant/clinics/{tenantId}`
- Timestamp handling: Firestore Timestamp e string
- Página ~512 linhas

---

## 9. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
