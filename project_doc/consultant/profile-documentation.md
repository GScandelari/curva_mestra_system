# Documentação Experimental - Perfil do Consultor

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Consultor
**Componente:** Meu Perfil (`/consultant/profile`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de perfil do consultor (somente leitura). Exibe código do consultor com botão copiar, informações pessoais (nome, email, telefone, membro desde), resumo de clínicas vinculadas e card de ajuda.

### 1.1 Localização
- **Arquivo:** `src/app/(consultant)/consultant/profile/page.tsx`
- **Rota:** `/consultant/profile`
- **Layout:** Consultant Layout

### 1.2 Dependências
- **API Routes:** `GET /api/consultants/{consultantId}`
- **Types:** `Consultant`
- **Hooks:** `useAuth()` (user, consultantId), `useToast()`
- **Utils:** `formatTimestamp()`

---

## 2. Seções

### 2.1 Código do Consultor
- Card gradiente sky-500 → sky-600 (texto branco)
- Código em font-mono 5xl tracking-widest
- Botão "Copiar" (clipboard)

### 2.2 Informações Pessoais
- Avatar circular (sky-100 com ícone User)
- Nome (xl semibold) + Badge status (Ativo/Inativo)
- Grid 2 colunas: Email (Mail), Telefone (Phone), Membro desde (Calendar + formatTimestamp)

### 2.3 Clínicas Vinculadas
- Número grande (4xl, sky-600): `consultant.authorized_tenants.length || 0`
- Texto: "clínica(s) vinculada(s) à sua conta"

### 2.4 Card de Ajuda
- "Para alterar seus dados cadastrais, entre em contato com o suporte do sistema"

---

## 3. Observações
- Página read-only, sem formulários de edição
- Dados carregados via API route, não Firestore direto
- Loading: spinner animado sky-600
- Max-width: `max-w-3xl`
- Página compacta (~205 linhas)

---

## 4. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
