# Documentação Experimental - Minhas Clínicas (Consultor)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Consultor
**Componente:** Minhas Clínicas (`/consultant/clinics`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Listagem de todas as clínicas vinculadas ao consultor. Busca client-side por nome, documento ou email. Grid de cards usando componente `ClinicCard`. Botão para buscar novas clínicas.

### 1.1 Localização
- **Arquivo:** `src/app/(consultant)/consultant/clinics/page.tsx`
- **Rota:** `/consultant/clinics`
- **Layout:** Consultant Layout

### 1.2 Dependências
- **API Routes:** `GET /api/consultants/me/clinics`
- **Componentes:** `ClinicCard`
- **Hooks:** `useAuth()` (user, refreshClaims)

---

## 2. Seções

### 2.1 Header
- Título "Minhas Clínicas" com ícone Building2 (sky-600)
- Botão "Buscar Nova Clínica" → `/consultant/clinics/search` (sky-600)

### 2.2 Busca
- Card com Input + ícone Search
- Placeholder: "Buscar por nome, documento ou email..."
- Filtra client-side: `name`, `document_number`, `email`

### 2.3 Grid de Clínicas
- Grid responsivo: 2-3 colunas
- Cada clínica renderizada via `ClinicCard` component
- Interface local `Clinic`: id, name, document_type, document_number, email, phone, active

---

## 3. Estados

| Estado | Comportamento |
|--------|---------------|
| Loading | Spinner centralizado sky-600 |
| Sem clínicas | "Nenhuma clínica vinculada" + botão "Buscar Clínicas" |
| Com busca sem resultado | "Nenhuma clínica encontrada com os filtros aplicados" |
| Com dados | Grid de ClinicCards |

---

## 4. Observações
- `refreshClaims()` chamado após carregar clínicas para sincronizar `authorized_tenants`
- Busca case-insensitive
- Página compacta (~157 linhas)

---

## 5. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
