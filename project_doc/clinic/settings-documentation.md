# Documentação Experimental - Configurações da Clínica

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Configurações (`/clinic/settings`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de configurações de notificações e alertas da clínica. Permite ativar/desativar alertas de vencimento, estoque baixo e solicitações, além de ajustar thresholds numéricos. Usa `notificationService` com persistência Firestore.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/settings/page.tsx`
- **Rota:** `/clinic/settings`
- **Layout:** Clinic Layout

### 1.2 Dependências
- **notificationService:** `getNotificationSettings()`, `saveNotificationSettings()`, `initializeNotificationSettings()`
- **Types:** `NotificationSettings`
- **Hooks:** `useAuth()`, `useToast()`
- **Restrição:** Apenas `clinic_admin` pode acessar

---

## 2. Cards de Configuração

### 2.1 Alertas de Vencimento
- **Switch:** Ativar alertas de vencimento (`enable_expiry_alerts`)
- **Input numérico:** Dias de antecedência (1-365, padrão 30) (`expiry_warning_days`)

### 2.2 Alertas de Estoque Baixo
- **Switch:** Ativar alertas de estoque baixo (`enable_low_stock_alerts`)
- **Input numérico:** Quantidade mínima (1-1000, padrão 10) (`low_stock_threshold`)

### 2.3 Alertas de Solicitações
- **Switch:** Ativar alertas de solicitações (`enable_request_alerts`)

### 2.4 Preferências de Notificação
- **Switch:** Som de notificação (`notification_sound`)
- **Switch:** Notificações por e-mail (`email_notifications`) — **desabilitado** (em breve)

---

## 3. Fluxo de Carregamento

1. Obtém `tenantId` dos claims
2. `getNotificationSettings(tenantId)`
3. Se não existe → `initializeNotificationSettings(tenantId, userId)` → recarrega
4. Preenche estados locais

---

## 4. Observações
- Inicialização automática de settings se não existirem
- Usa Skeleton para loading state
- Botão "Salvar Configurações" separado (não auto-save)
- Não-admin vê Alert "Apenas administradores podem acessar"

---

## 5. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
