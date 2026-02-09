# Documentação Experimental - Novo Procedimento

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Novo Procedimento (`/clinic/requests/new`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Wizard de 3 etapas para criar/editar procedimentos de consumo de produtos. Inclui autocomplete de pacientes, seleção de produtos com alocação FEFO (First Expired, First Out) e revisão final. Suporta modo edição via query params.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/requests/new/page.tsx`
- **Rota:** `/clinic/requests/new` (criação) ou `/clinic/requests/new?edit={id}&...` (edição)
- **Layout:** Clinic Layout

### 1.2 Dependências
- **inventoryService:** `listInventory()`
- **solicitacaoService:** `createSolicitacaoWithConsumption()`, `updateSolicitacaoAgendada()`
- **patientService:** `searchPatients()`
- **Types:** `Patient`, `InventoryItem`
- **Hooks:** `useAuth()`, `useToast()`
- **Restrição:** Apenas `clinic_admin`

---

## 2. Wizard de 3 Etapas

### Step 1: Dados do Paciente
- **Busca de paciente:** Autocomplete com debounce (300ms), filtros: todos/código/nome/telefone
- **Paciente selecionado:** Card azul com nome, código e botão limpar
- **Data do procedimento:** date input (não pode ser no passado, exceto em modo edição)
- **Observações:** texto opcional

### Step 2: Adicionar Produtos
- **Select de produto:** Produtos agrupados por código, mostra quantidade total disponível
- **Quantidade:** Input numérico + botão adicionar
- **Tabela de produtos adicionados:** Produto, Lote, Quantidade, Disponível, Valor Unit., Total, Remover
- **Valor total** calculado automaticamente

### Step 3: Revisão e Confirmação
- Resumo do paciente e data
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
Parâmetros via URL: `edit`, `patientCode`, `patientName`, `dtProcedimento`, `observacoes`, `produtos` (JSON), `createdAt`

---

## 4. Pré-preenchimento via URL
- `patientCode` / `pacienteCodigo`
- `patientName` / `pacienteNome`
- `edit` → ID do procedimento
- `dtProcedimento`, `observacoes`, `produtos` (JSON)

---

## 5. Observações
- Página mais complexa do módulo clínica (~1197 linhas)
- Produtos duplicados não permitidos (mesmo código)
- Mensagem de toast detalhada com lotes alocados
- Criação: status "Agendado" com produtos RESERVADOS
- Edição: ajusta reservas automaticamente

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
