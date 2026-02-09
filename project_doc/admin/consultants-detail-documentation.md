# Documentação Experimental - Detalhes do Consultor

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Detalhes do Consultor (`/admin/consultants/[id]`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de detalhes e edição de um consultor Rennova. Exibe código único com opção de copiar, informações gerais (datas, clínicas vinculadas), formulário de edição e lista de clínicas vinculadas com link direto para cada tenant.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/consultants/[id]/page.tsx`
- **Rota:** `/admin/consultants/{id}`
- **Layout:** Admin Layout

### 1.2 Dependências
- **Hooks:** `useAuth()`, `useToast()`
- **API Routes:** `GET /api/consultants/{id}`, `PUT /api/consultants/{id}`
- **Utils:** `formatTimestamp()`
- **Types:** `Consultant`
- **Lucide Icons:** ArrowLeft, Users, Loader2, Copy, Building2, Save

---

## 2. Seções da Página

### 2.1 Card: Código do Consultor
- Código em texto 4xl, font-mono, sky-700, tracking-widest
- Background sky-50, borda sky-200
- Botão "Copiar Código" (ghost)

### 2.2 Card: Informações
- Criado em: `formatTimestamp(created_at)`
- Atualizado em: `formatTimestamp(updated_at)`
- Clínicas vinculadas: `authorized_tenants.length` com ícone Building2

### 2.3 Card: Editar Dados
Formulário com grid 2 colunas:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| Nome Completo | text (uppercase) | Forçado para MAIÚSCULAS |
| Email | email | — |
| Telefone | text (formatado) | Máscara (00) 00000-0000 |

### 2.4 Card: Clínicas Vinculadas
- Lista de `authorized_tenants` (array de tenant IDs)
- Cada item mostra tenant ID (font-mono) + botão "Ver Clínica" → `/admin/tenants/{tenantId}`
- Se vazio: "Nenhuma clínica vinculada"

---

## 3. Casos de Uso

### 3.1 UC-001: Carregar Consultor
**Fluxo:**
1. GET `/api/consultants/{id}` com header Authorization
2. Preenche `consultant` e `formData`
3. Se erro → Toast + redirect para `/admin/consultants`

### 3.2 UC-002: Editar Consultor
**Fluxo:**
1. Altera campos no formulário
2. Clica "Salvar Alterações"
3. PUT `/api/consultants/{id}` com `{ name, email (lowercase), phone }`
4. Toast sucesso → recarrega dados

### 3.3 UC-003: Copiar Código
**Ação:** `navigator.clipboard.writeText(consultant.code)` → Toast "Código copiado"

### 3.4 UC-004: Navegar para Clínica
**Ação:** Botão "Ver Clínica" → `/admin/tenants/{tenantId}`

---

## 4. API Routes

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/consultants/{id}` | Busca detalhes do consultor |
| PUT | `/api/consultants/{id}` | Atualiza dados do consultor |

Todas requerem header `Authorization: Bearer {idToken}`.

---

## 5. Status Badges

| Status | Badge |
|--------|-------|
| active | Badge "Ativo" (default) |
| suspended | Badge "Suspenso" (destructive) |
| inactive | Badge "Inativo" (secondary) |

---

## 6. Estados da Interface

| Estado | Exibição |
|--------|----------|
| Carregando | Loader2 spinning (center) |
| Não encontrado | "Consultor não encontrado" |
| Salvando | Loader2 no botão + disabled |
| Normal | Grid com 4 cards |

---

## 7. Observações
- Layout em grid: 2 colunas para Código + Informações, full-width para Editar e Clínicas
- Nome forçado para uppercase no handleChange
- Email enviado em lowercase
- Telefone formatado com máscara brasileira
- Botão "Voltar" no topo (ArrowLeft)
- Estilo sky-600/sky-700 para botão de salvar
- Clínicas vinculadas mostram apenas o ID (não o nome)

---

## 8. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
