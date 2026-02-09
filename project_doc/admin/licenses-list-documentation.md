# Documentação Experimental - Licenças (Lista)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Lista de Licenças (`/admin/licenses`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página que lista todas as licenças do sistema com cards de estatísticas e tabela detalhada. Exibe status com ícones coloridos, dias restantes, plano e renovação automática. Utiliza o `licenseService` para buscar dados.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/licenses/page.tsx`
- **Rota:** `/admin/licenses`
- **Layout:** Admin Layout

### 1.2 Dependências
- **licenseService:** `getAllLicenses()`, `getDaysUntilExpiration()`
- **Types:** `License`
- **Lucide Icons:** CheckCircle, XCircle, Clock, AlertTriangle

---

## 2. Cards de Estatísticas

| Card | Valor | Cor |
|------|-------|-----|
| Total de Licenças | `licenses.length` | gray |
| Ativas | `status === "ativa"` | verde |
| Expirando em Breve | Ativas com 0 < dias ≤ 15 | laranja |
| Expiradas | `status === "expirada"` | vermelho |

---

## 3. Tabela de Licenças

**Colunas:** Tenant, Plano, Status (ícone + badge), Início, Término, Dias Restantes, Renovação Automática, Ações

**Status visuais:**
- `ativa` → verde (CheckCircle)
- `expirada` → vermelho (XCircle)
- `suspensa` → laranja (AlertTriangle)
- `pendente` → amarelo (Clock)

**Dias Restantes:**
- Normal → verde
- ≤ 15 dias → laranja
- < 0 → vermelho

**Navegação:** Clicar na linha ou "Ver Detalhes" → `/admin/licenses/{id}`

---

## 4. Casos de Uso

### 4.1 Listar Licenças
**Service:** `getAllLicenses()` retorna `License[]`

### 4.2 Criar Nova Licença
**Ação:** Botão "Nova Licença" → `/admin/licenses/new`

### 4.3 Ver Detalhes
**Ação:** Click na linha → `/admin/licenses/{id}`

---

## 5. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
