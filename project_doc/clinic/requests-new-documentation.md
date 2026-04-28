# Documentação Experimental - Novo Procedimento

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Novo Procedimento (`/clinic/requests/new`)
**Versão:** 2.0
**Data:** 22/04/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Wizard de 2 etapas para criar/editar procedimentos de consumo de produtos. Inclui seleção de produtos com alocação FEFO (First Expired, First Out) e revisão final. Suporta modo edição via query params.

### 1.1 Localização

- **Arquivo:** `src/app/(clinic)/clinic/requests/new/page.tsx`
- **Rota:** `/clinic/requests/new` (criação) ou `/clinic/requests/new?edit={id}&...` (edição)
- **Layout:** Clinic Layout

### 1.2 Dependências

- **inventoryService:** `listInventory()`
- **solicitacaoService:** `createSolicitacaoWithConsumption()`, `updateSolicitacaoAgendada()`
- **Types:** `InventoryItem`
- **Hooks:** `useAuth()`, `useToast()`
- **Restrição:** Apenas `clinic_admin`

---

## 2. Wizard de 2 Etapas

### Step 1: Dados do Procedimento e Produtos

- **Descrição:** texto livre opcional para identificar o procedimento
- **Data do procedimento:** date input (não pode ser no passado, exceto em modo edição)
- **Observações:** texto opcional
- **Select de produto:** Produtos agrupados por código, mostra quantidade total disponível
- **Quantidade:** Input numérico + botão adicionar
- **Tabela de produtos adicionados:** Produto, Lote, Quantidade, Disponível, Valor Unit., Total, Remover
- **Valor total** calculado automaticamente

### Step 2: Revisão e Confirmação

- Resumo da descrição e data
- Tabela de produtos a consumir
- Alert sobre reserva de estoque
- Botões: Voltar, Cancelar, Confirmar

---

## 3. Regras de Negócio

### RN-001: Alocação FEFO

Ao selecionar um produto por código, os lotes são ordenados por data de validade (mais próximo primeiro) e a quantidade é alocada automaticamente por múltiplos lotes se necessário.

### RN-002: Agrupamento de Produtos

Produtos no inventário são agrupados por `codigo_produto`, somando quantidades de todos os lotes. O usuário seleciona pelo código, não pelo lote individual.

### RN-003: Validação de Data

- Criação: data não pode ser no passado
- Edição: permite data passada se o procedimento foi agendado antes da data do procedimento

### RN-004: Modo Edição

Parâmetros via URL: `edit`, `descricao`, `dtProcedimento`, `observacoes`, `produtos` (JSON), `createdAt`

---

## 4. Pré-preenchimento via URL

- `edit` → ID do procedimento
- `descricao` → descrição livre do procedimento
- `dtProcedimento`, `observacoes`, `produtos` (JSON)

---

## 5. Observações

- Produtos duplicados não permitidos (mesmo código)
- Mensagem de toast detalhada com lotes alocados
- Criação: status "Agendado" com produtos RESERVADOS
- Edição: ajusta reservas automaticamente

---

## 6. Histórico de Mudanças

| Data       | Versão | Autor              | Descrição                                         |
| ---------- | ------ | ------------------ | ------------------------------------------------- |
| 07/02/2026 | 1.0    | Engenharia Reversa | Documentação inicial                              |
| 22/04/2026 | 2.0    | Engenharia Reversa | Remoção do conceito de paciente; wizard 3→2 steps |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 22/04/2026
**Status:** Aprovado
