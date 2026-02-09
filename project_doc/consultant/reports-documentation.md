# Documentação Experimental - Relatórios do Consultor (Hub)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Consultor
**Componente:** Relatórios (`/consultant/reports`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página hub de relatórios consolidados do consultor. Atualmente em desenvolvimento ("Em Desenvolvimento"). Exibe seletor de clínica (ClinicSelector), card de "coming soon" e preview de funcionalidades futuras (Consolidado de Estoque, Consumo por Período, Alertas Consolidados).

### 1.1 Localização
- **Arquivo:** `src/app/(consultant)/consultant/reports/page.tsx`
- **Rota:** `/consultant/reports`
- **Layout:** Consultant Layout

### 1.2 Dependências
- **API Routes:** `GET /api/consultants/me/clinics`
- **Componentes:** `ClinicSelector`, `ReadOnlyBanner`
- **Hooks:** `useAuth()`

---

## 2. Seções

### 2.1 ReadOnlyBanner
- Banner padrão de acesso somente leitura (componente reutilizável)

### 2.2 Seletor de Clínica
- Card com `ClinicSelector` (componente reutilizável)
- Só exibe se `clinics.length > 0`

### 2.3 Card "Em Desenvolvimento"
- Ícone AlertTriangle amber
- "Os relatórios consolidados para consultores estão sendo desenvolvidos"

### 2.4 Preview de Funcionalidades (3 cards, opacity-60)

| Card | Descrição |
|------|-----------|
| Consolidado de Estoque | Visão geral do estoque de todas as clínicas |
| Consumo por Período | Análise de consumo de produtos por período |
| Alertas Consolidados | Produtos próximos ao vencimento em todas as clínicas |

---

## 3. Observações
- Funcionalidade em desenvolvimento, não funcional
- Cards de preview com `opacity-60` para indicar indisponibilidade
- Página compacta (~155 linhas)

---

## 4. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
