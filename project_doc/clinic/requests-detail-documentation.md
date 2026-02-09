# Documentação Experimental - Detalhes do Procedimento

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Detalhes do Procedimento (`/clinic/requests/[id]`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de detalhes de um procedimento (solicitação de consumo). Exibe status, informações do paciente, resumo financeiro, tabela de produtos consumidos, histórico de status e informações de auditoria. Ações administrativas variam conforme o status atual.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/requests/[id]/page.tsx`
- **Rota:** `/clinic/requests/{id}`
- **Layout:** Clinic Layout

### 1.2 Dependências
- **solicitacaoService:** `getSolicitacao()`, `updateSolicitacaoStatus()`
- **Types:** `SolicitacaoWithDetails`
- **Hooks:** `useAuth()`, `useToast()`
- **Utils:** `formatTimestamp()`

---

## 2. Seções da Página

### 2.1 Header
- Botão "Voltar" → `/clinic/requests`
- Título: "Procedimento #{id.substring(0, 8)}"
- Badge de status atual
- Botões de ação (somente admin, conforme status)

### 2.2 Informações do Paciente
- Card com ícone User
- Campos: Código, Nome

### 2.3 Detalhes do Procedimento
- Card com ícone Calendar
- Data do procedimento (`dt_procedimento.toDate().toLocaleDateString("pt-BR")`)
- Observações (se houver)

### 2.4 Resumo Financeiro
| Métrica | Descrição |
|---------|-----------|
| Total de Produtos | `solicitacao.total_produtos` |
| Tipos Diferentes | `solicitacao.produtos_solicitados.length` |
| Valor Total | `formatCurrency(solicitacao.valor_total)` |

### 2.5 Tabela de Produtos Consumidos

| Coluna | Descrição |
|--------|-----------|
| Produto | nome + código |
| Lote | Badge outline |
| Qtd Consumida | `produto.quantidade` |
| Valor Unit. | `formatCurrency(produto.valor_unitario)` |
| Total | `formatCurrency(quantidade * valor_unitario)` |
| **Rodapé** | Valor Total em destaque |

### 2.6 Histórico de Status
- Timeline com badge de status, nome do responsável, data/hora e observação
- Condicional: só exibe se `status_history.length > 0`

### 2.7 Informações de Auditoria
- Criado por: `created_by_name`
- Criado em: `formatTimestamp(created_at)`
- Última atualização: `formatTimestamp(updated_at)`

---

## 3. Ações por Status (clinic_admin)

### 3.1 Status "Agendada"
| Ação | Botão | Novo Status |
|------|-------|-------------|
| Editar | outline (azul) → `/clinic/requests/{id}/edit` | — |
| Aprovar | default (verde) | aprovada |
| Reprovar | destructive | reprovada |
| Cancelar | outline | cancelada |

### 3.2 Status "Aprovada"
| Ação | Botão | Novo Status |
|------|-------|-------------|
| Concluir | default (azul) | concluida |
| Cancelar | outline | cancelada |

### 3.3 Status Finais (concluida, reprovada, cancelada)
- Nenhum botão de ação exibido

---

## 4. Alertas Contextuais por Status

| Status | Variante | Título | Mensagem |
|--------|----------|--------|----------|
| aprovada | default | Consumo Realizado | "Os produtos foram consumidos do inventário" |
| agendada | default | Estoque Reservado | "Os produtos estão reservados..." |
| reprovada | destructive | Procedimento Reprovado | "Qualquer reserva de estoque foi liberada" |
| cancelada | default | Procedimento Cancelado | "O estoque foi ajustado de acordo com o status anterior" |

---

## 5. Status Badges

| Status | Variante | Label |
|--------|----------|-------|
| agendada | secondary | Agendada |
| aprovada | default | Aprovada |
| concluida | default | Concluída |
| reprovada | destructive | Reprovada |
| cancelada | destructive | Cancelada |

---

## 6. Observações
- `handleStatusUpdate` chama `updateSolicitacaoStatus()` com uid, displayName, newStatus e observação
- Após atualização de status, recarrega dados via `getSolicitacao()`
- Estado `updating` desabilita botões durante processamento
- Skeleton para loading, Alert destructive para erro
- Formatação de moeda: `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`
- Página ~584 linhas

---

## 7. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
