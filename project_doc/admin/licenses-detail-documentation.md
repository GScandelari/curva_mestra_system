# Documentação Experimental - Detalhes da Licença

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Detalhes da Licença (`/admin/licenses/[id]`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de detalhes de uma licença específica com banner de status colorido, informações detalhadas e ações de gerenciamento (renovar, suspender, reativar, deletar). Exibe dias restantes com alertas visuais de expiração.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/licenses/[id]/page.tsx`
- **Rota:** `/admin/licenses/{id}`
- **Layout:** Admin Layout

### 1.2 Dependências
- **licenseService:** `getLicenseById()`, `getDaysUntilExpiration()`, `renewLicense()`, `suspendLicense()`, `reactivateLicense()`, `deleteLicense()`

---

## 2. Ações por Status

| Status | Ações Disponíveis |
|--------|-------------------|
| ativa | Renovar, Suspender, Deletar |
| suspensa | Reativar, Deletar |
| expirada | Deletar |
| pendente | Deletar |

---

## 3. Casos de Uso

### 3.1 UC-001: Renovar Licença
**Fluxo:**
1. Admin clica "Renovar"
2. `confirm()` pede meses (6 = Semestral, 12 = Anual)
3. Calcula nova `end_date` = `current_end_date + N meses`
4. `renewLicense(id, newEndDate)`
5. Alert: "Licença renovada com sucesso!"

### 3.2 UC-002: Suspender Licença
**Fluxo:** Confirm → `suspendLicense(id)` → Alert sucesso → Reload

### 3.3 UC-003: Reativar Licença
**Fluxo:** Confirm → `reactivateLicense(id)` → Alert sucesso → Reload

### 3.4 UC-004: Deletar Licença
**Fluxo:** Confirm com aviso "ATENÇÃO" → `deleteLicense(id)` → Alert → Redirect para `/admin/licenses`

---

## 4. Exibição

### Banner de Status
- **ativa** → bg-green-50, border-green-200
- **expirada** → bg-red-50, border-red-200
- **suspensa** → bg-orange-50, border-orange-200
- **pendente** → bg-yellow-50, border-yellow-200

### Cards de Informação
- **Informações:** Tenant ID, Plano, Máx. Usuários, Renovação Automática
- **Datas:** Início, Término, Criação, Última Atualização (formato "DD de mês de AAAA")
- **Funcionalidades:** Lista de features com ícones CheckCircle verde

### Alertas de Expiração
- ≤ 15 dias → "⚠️ Expira em X dias" (laranja)
- < 0 dias → "Expirou há X dias" (vermelho)
- Normal → "Válida por mais X dias" (neutro)

---

## 5. Observações
- Usa `confirm()` e `alert()` nativos em vez de Dialog/Toast
- Renovação usa `confirm()` que retorna string (adaptado via `parseInt`)
- Todas as ações são protegidas por confirmação

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
