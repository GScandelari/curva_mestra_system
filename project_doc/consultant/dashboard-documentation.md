# Documentação Experimental - Dashboard do Consultor

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Consultor
**Componente:** Dashboard (`/consultant/dashboard`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Dashboard principal do portal do consultor. Exibe código do consultor, cards de estatísticas (clínicas vinculadas, solicitações pendentes, busca), lista de claims pendentes e grid de clínicas vinculadas. Usa API Routes com Bearer token.

### 1.1 Localização
- **Arquivo:** `src/app/(consultant)/consultant/dashboard/page.tsx`
- **Rota:** `/consultant/dashboard`
- **Layout:** Consultant Layout

### 1.2 Dependências
- **API Routes:**
  - `GET /api/consultants/{consultantId}` (perfil)
  - `GET /api/consultants/me/clinics` (clínicas vinculadas)
  - `GET /api/consultants/claims?status=pending` (claims pendentes)
- **Types:** `Consultant`, `ConsultantClaim`, `ClinicSummary` (local)
- **Hooks:** `useAuth()` (user, consultantId, refreshClaims), `useToast()`

---

## 2. Seções da Página

### 2.1 Código do Consultor
- Card gradiente sky-500 → sky-600 (texto branco)
- Código em font-mono 4xl tracking-widest
- Botão copiar (clipboard)
- Texto: "Compartilhe este código com as clínicas para vincular-se"

### 2.2 Cards de Estatísticas (grid 3 colunas)

| Card | Valor | Ícone | Clicável |
|------|-------|-------|----------|
| Clínicas Vinculadas | `clinics.length` + ativas | Building2 | Não |
| Solicitações Pendentes | `pendingClaims.length` | Clock | Não |
| Buscar Clínicas | Link direto | Search | Sim → `/consultant/clinics/search` |

### 2.3 Solicitações Pendentes
- Condicional: só exibe se `pendingClaims.length > 0`
- Cards amber com nome da clínica, documento e badge "Pendente"
- Não tem ações (pendente de aprovação pela clínica)

### 2.4 Minhas Clínicas
- Header com botão "Ver Todas" → `/consultant/clinics`
- Grid 2-3 colunas com cards clicáveis → `/consultant/clinics/{id}`
- Cada card: nome (truncate), badge Ativa/Inativa
- Limita a 6 clínicas (`clinics.slice(0, 6)`)
- Empty state: botão "Buscar Clínicas" → `/consultant/clinics/search`

---

## 3. Observações
- Saudação: "Bem-vindo ao Portal do Consultor, {firstName}"
- `refreshClaims()` chamado após carregar clínicas para sincronizar `authorized_tenants`
- Loading: spinner animado sky-600
- Copiar código: `navigator.clipboard.writeText(code)` + toast
- Página ~296 linhas

---

## 4. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
