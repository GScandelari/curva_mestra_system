# Documentação Experimental - Lista de Procedimentos

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Lista de Procedimentos (`/clinic/requests`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página que lista todos os procedimentos (solicitações de consumo) da clínica. Exibe cards de estatísticas, filtros por busca e status, e tabela com dados do paciente, produtos, valor e status. Usa `solicitacaoService`.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/requests/page.tsx`
- **Rota:** `/clinic/requests`
- **Layout:** Clinic Layout

### 1.2 Dependências
- **solicitacaoService:** `listSolicitacoes()`
- **Types:** `SolicitacaoWithDetails`
- **Hooks:** `useAuth()`

---

## 2. Cards de Estatísticas

| Card | Valor | Ícone |
|------|-------|-------|
| Total | `solicitacoes.length` | FileText |
| Agendadas | status === "agendada" | Calendar (blue) |
| Aprovadas | status === "aprovada" | Package (green) |
| Concluídas | status === "concluida" | Package (purple) |

---

## 3. Filtros

- **Busca:** por nome do paciente ou código (client-side)
- **Status:** Select com opções: Todos, Agendada, Aprovada, Concluída, Reprovada, Cancelada (server-side via service)

---

## 4. Tabela

| Coluna | Descrição |
|--------|-----------|
| Paciente | nome + código |
| Data Procedimento | `dt_procedimento.toDate().toLocaleDateString("pt-BR")` |
| Produtos | Badge com `total_produtos` |
| Valor Total | formatCurrency (BRL) |
| Status | Badge colorido |
| Criado em | `formatTimestamp(created_at)` |
| Ações | "Gerenciar" → `/clinic/requests/{id}` |

---

## 5. Status Badges

| Status | Variante |
|--------|----------|
| agendada | secondary |
| aprovada | default |
| concluida | default |
| reprovada | destructive |
| cancelada | destructive |

---

## 6. Observações
- Botão "Novo Procedimento" apenas para `clinic_admin`
- Filtro de status é server-side (recarrega via service)
- Busca textual é client-side
- Valor formatado com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`

---

## 7. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
