# Documentação Experimental - Procedimentos da Clínica (Consultor)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Consultor
**Componente:** Procedimentos (`/consultant/clinics/[tenantId]/procedures`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Visualização read-only dos procedimentos (solicitações de consumo) de uma clínica vinculada. Exibe cards de estatísticas por status, filtros (busca + status), e tabela completa com dados de paciente, data, produtos, valor e status. Dados carregados diretamente do Firestore.

### 1.1 Localização
- **Arquivo:** `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx`
- **Rota:** `/consultant/clinics/{tenantId}/procedures`
- **Layout:** Consultant Layout

### 1.2 Dependências
- **Firestore:** `tenants/{tenantId}/solicitacoes` (orderBy created_at desc)
- **Componentes:** `ReadOnlyBanner`, Shadcn Select
- **Hooks:** `useAuth()` (user, authorizedTenants, claims)
- **Utils:** `formatTimestamp()`

---

## 2. Cards de Estatísticas (grid 4 colunas)

| Card | Filtro | Ícone/Cor |
|------|--------|-----------|
| Total | `solicitacoes.length` | FileText |
| Agendadas | status === "agendada" | Calendar (blue) |
| Aprovadas | status === "aprovada" | Package (green) |
| Concluídas | status === "concluida" | Package (purple) |

---

## 3. Filtros

### 3.1 Busca Textual
- Busca por `paciente_nome` ou `paciente_codigo` (case-insensitive)

### 3.2 Filtro de Status (Shadcn Select)
- Todos, Criada, Agendada, Aprovada, Concluída, Reprovada, Cancelada
- Client-side filtering

---

## 4. Tabela de Procedimentos

| Coluna | Campo | Formato |
|--------|-------|---------|
| Paciente | nome + código | Bold + texto muted |
| Data Procedimento | `dt_procedimento.toDate().toLocaleDateString("pt-BR")` | — |
| Produtos | `total_produtos` | Badge outline |
| Valor Total | `valor_total` | BRL |
| Status | badge colorido | — |
| Criado em | `formatTimestamp(created_at)` | Muted |

---

## 5. Status Badges

| Status | Variante | Label |
|--------|----------|-------|
| criada | default | Criada |
| agendada | secondary | Agendada |
| aprovada | default | Aprovada |
| concluida | default | Concluída |
| reprovada | destructive | Reprovada |
| cancelada | destructive | Cancelada |

---

## 6. Regras de Negócio
- **RN-001:** Verificação `authorizedTenants.includes(tenantId)` antes de carregar
- **RN-002:** Acesso read-only (sem ações de status)
- **RN-003:** Filtragem client-side (todos os dados carregados de uma vez)

---

## 7. Observações
- Espelha `/clinic/requests` mas sem ações de escrita e sem botão "Gerenciar"
- ReadOnlyBanner exibido no topo
- Botão "Voltar" → `/consultant/clinics/{tenantId}`
- Página ~357 linhas

---

## 8. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
