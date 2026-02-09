# Documentação Experimental - Detalhe da Clínica (Consultor)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Consultor
**Componente:** Detalhe da Clínica (`/consultant/clinics/[tenantId]`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de visão geral de uma clínica vinculada ao consultor. Exibe informações da clínica, cards de estatísticas do inventário, ações rápidas (estoque, procedimentos, relatórios) e lista de procedimentos recentes. Dados carregados via Firestore direto (com verificação de autorização).

### 1.1 Localização
- **Arquivo:** `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx`
- **Rota:** `/consultant/clinics/{tenantId}`
- **Layout:** Consultant Layout

### 1.2 Dependências
- **API Routes:** `GET /api/tenants/{tenantId}/consultant`
- **Firestore direto:**
  - `tenants/{tenantId}/inventory` (stats de estoque)
  - `tenants/{tenantId}/solicitacoes` (procedimentos recentes, limit 5)
  - `tenants/{tenantId}` (dados do tenant)
- **Componentes:** `ReadOnlyBanner`
- **Hooks:** `useAuth()` (user, authorizedTenants, claims)
- **Utils:** `formatTimestamp()`

---

## 2. Seções

### 2.1 Header
- Botão "Voltar" → `/consultant/clinics`
- Nome da clínica + documento formatado (CPF/CNPJ)
- Badge Ativa/Inativa

### 2.2 ReadOnlyBanner
- Banner de acesso somente leitura

### 2.3 Cards de Estatísticas (grid 3 colunas)

| Card | Cálculo | Ícone/Cor |
|------|---------|-----------|
| Itens no Estoque | Items com `quantidade_disponivel > 0` | Package |
| Próximos a Vencer | Validade <= 30 dias e qty > 0 | AlertTriangle (amber) |
| Estoque Baixo | `quantidade_disponivel <= 5` | Package (red) |

### 2.4 Ações Rápidas (grid 3 colunas)

| Ação | Destino |
|------|---------|
| Ver Estoque | `/consultant/clinics/{tenantId}/inventory` |
| Ver Procedimentos | `/consultant/clinics/{tenantId}/procedures` |
| Ver Relatórios | `/consultant/clinics/{tenantId}/reports` |

### 2.5 Procedimentos Recentes
- Últimos 5 procedimentos (orderBy created_at desc, limit 5)
- Cada item: nome do paciente, data, badge de status
- Empty state: "Nenhum procedimento registrado"

---

## 3. Regras de Negócio

- **RN-001:** Verificação de autorização: `authorizedTenants.includes(tenantId)`, senão redirect → `/consultant/clinics`
- **RN-002:** Espera auth carregado (`authLoading`) antes de verificar autorização
- **RN-003:** Estoque baixo definido como `<= 5` unidades (diferente de < 10 no clinic)
- **RN-004:** Dados de inventário e procedimentos carregados via Firestore direto (não via API routes)

---

## 4. Status Badges

| Status | Variante | Label |
|--------|----------|-------|
| criada | outline | Criada |
| agendada | default | Agendada |
| concluida | secondary | Concluída |
| aprovada | default | Aprovada |
| reprovada | destructive | Reprovada |
| cancelada | destructive | Cancelada |

---

## 5. Observações
- Página carrega 3 fontes de dados: API route (tenant details), Firestore direto (inventory e procedures)
- Suporte a `dt_validade` como string (DD/MM/YYYY ou ISO) e Timestamp do Firestore
- Formatação de documento (CPF/CNPJ) via função local `formatDocument`
- Página ~378 linhas

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
