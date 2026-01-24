# 🚫 Sistema de Suspensão de Clínicas

**Versão:** 1.0.0
**Data:** 23/01/2026
**Status:** ✅ Implementado

---

## 📋 Visão Geral

Sistema completo para suspender/bloquear acesso de clínicas ao sistema, com motivos rastreáveis e comportamento diferenciado por role (clinic_admin vs clinic_user).

### Problema Identificado
- Clínicas desabilitadas continuavam com acesso ao sistema
- Não havia rastreabilidade do motivo da desabilitação
- Todos os usuários viam a mesma mensagem (sem distinção de role)

### Solução Implementada
- ✅ API para suspender/reativar clínicas com motivos específicos
- ✅ Atualização automática de custom claims de todos os usuários
- ✅ Verificação em tempo real via Firestore listener
- ✅ Páginas de bloqueio distintas por role
- ✅ Interface administrativa para gerenciar suspensões

---

## 🏗️ Arquitetura

### 1. Schema Firestore (types/index.ts)

```typescript
export type SuspensionReason =
  | "payment_failure"      // Falta de pagamento
  | "contract_breach"      // Quebra de contrato
  | "terms_violation"      // Violação dos termos de uso
  | "fraud_detected"       // Fraude detectada
  | "other";               // Outro motivo

export interface SuspensionInfo {
  suspended: boolean;
  reason: SuspensionReason;
  details: string;                  // Detalhes adicionais do motivo
  suspended_at: Timestamp;
  suspended_by: string;             // UID do system_admin que suspendeu
  contact_email: string;            // Email para contato (suporte)
}

export interface Tenant {
  // ... campos existentes
  active: boolean;
  suspension?: SuspensionInfo;      // NOVO: Informações de suspensão
}
```

### 2. API Routes

#### POST /api/tenants/[id]/suspend
**Suspender clínica**

**Autenticação:** Apenas `system_admin`

**Payload:**
```json
{
  "reason": "payment_failure",
  "details": "Fatura vencida há 15 dias, sem resposta aos contatos",
  "contact_email": "suporte@curvamestra.com.br"
}
```

**Ações realizadas:**
1. Valida autenticação e permissões
2. Atualiza tenant com `active: false` e `suspension: {...}`
3. Busca todos os usuários do tenant
4. Atualiza custom claims de cada usuário (`active: false`)
5. Atualiza documento de cada usuário no Firestore
6. Retorna quantidade de usuários afetados

**Response (200):**
```json
{
  "success": true,
  "message": "Clínica suspensa com sucesso",
  "tenant_id": "clinic_abc123",
  "users_affected": 5
}
```

#### DELETE /api/tenants/[id]/suspend
**Reativar clínica**

**Autenticação:** Apenas `system_admin`

**Ações realizadas:**
1. Remove campo `suspension` do tenant
2. Atualiza tenant com `active: true`
3. Reativa todos os usuários (`active: true` em custom claims e Firestore)

**Response (200):**
```json
{
  "success": true,
  "message": "Clínica reativada com sucesso",
  "tenant_id": "clinic_abc123",
  "users_affected": 5
}
```

---

## 🔐 Verificação de Suspensão

### Hook: useTenantSuspension

**Localização:** `src/hooks/useTenantSuspension.ts`

**Funcionalidade:**
- Listener em tempo real no documento do tenant
- Verifica campo `suspension.suspended`
- Retorna estado de suspensão + informações

**Retorno:**
```typescript
{
  isSuspended: boolean;
  suspensionInfo: SuspensionInfo | null;
  isLoading: boolean;
}
```

**Comportamento:**
- ✅ System admin: NUNCA é bloqueado
- ✅ Clinic admin/user: Verifica suspensão em tempo real
- ✅ Reage instantaneamente a mudanças no Firestore

### Componente: SuspensionInterceptor

**Localização:** `src/components/auth/SuspensionInterceptor.tsx`

**Funcionalidade:**
- Wrapper de verificação de suspensão
- Redireciona para página apropriada conforme role
- Integrado no layout das rotas `(clinic)`

**Fluxo:**
```
1. Verifica se usuário está suspenso
2. Se suspenso:
   - clinic_admin → /suspended/admin
   - clinic_user → /suspended/user
3. Se não suspenso mas está em /suspended:
   - Redireciona de volta para /clinic
```

---

## 📄 Páginas de Bloqueio

### /suspended/admin (clinic_admin)

**Informações Exibidas:**
- ✅ Motivo completo da suspensão
- ✅ Descrição detalhada (campo `details`)
- ✅ Data/hora da suspensão
- ✅ Email de contato para suporte
- ✅ Instruções de próximos passos

**UI Elements:**
- Badge de motivo (ex: "Falha no Pagamento")
- Box de detalhes adicionais
- Box de data de suspensão
- Box de contato (com link mailto:)
- Botões: "Sair da Conta" e "Entrar em Contato"

### /suspended/user (clinic_user)

**Informações Exibidas:**
- ⚠️ Mensagem genérica: "Acesso temporariamente bloqueado"
- ⚠️ Instrução: "Contate o administrador da clínica"
- ❌ NÃO mostra motivo específico
- ❌ NÃO mostra email de suporte

**UI Elements:**
- Ícone de alerta
- Mensagem simples e direta
- Instruções de o que fazer
- Botão: "Sair da Conta"

---

## 🎨 Interface Administrativa

### Componentes

#### SuspendTenantDialog

**Localização:** `src/components/admin/SuspendTenantDialog.tsx`

**Funcionalidade:**
- Dialog modal para suspender clínica
- Formulário com validações

**Campos:**
1. **Motivo** (select obrigatório)
   - Falha no Pagamento
   - Quebra de Contrato
   - Violação dos Termos de Uso
   - Fraude Detectada
   - Outro Motivo

2. **Detalhes** (textarea obrigatório)
   - Descrição específica do motivo
   - Visível para clinic_admin

3. **Email de Contato** (input)
   - Padrão: scandelari.guilherme@curvamestra.com.br
   - Exibido na página de bloqueio

**Validações:**
- ✅ Motivo não pode ser vazio
- ✅ Detalhes não pode ser vazio
- ✅ Email deve ser válido

#### ReactivateTenantDialog

**Funcionalidade:**
- Dialog modal para reativar clínica
- Mostra informações da suspensão atual
- Confirmação simples

---

## 🔄 Fluxo Completo

### Suspender Clínica

```
1. System Admin acessa portal admin
2. Abre dialog "Suspender Clínica"
3. Seleciona motivo (ex: "Falha no Pagamento")
4. Preenche detalhes (ex: "Fatura vencida há 30 dias")
5. Define email de contato
6. Clica em "Suspender Clínica"
   ↓
7. API POST /api/tenants/[id]/suspend
   ↓
8. Firestore: tenant.active = false
9. Firestore: tenant.suspension = {...}
10. Custom Claims: todos usuários → active = false
11. Firestore: users → active = false
   ↓
12. SuspensionInterceptor detecta mudança (listener)
   ↓
13. Clinic Admin:
    - Redirecionado para /suspended/admin
    - Vê motivo completo e detalhes
14. Clinic User:
    - Redirecionado para /suspended/user
    - Vê mensagem genérica
```

### Reativar Clínica

```
1. System Admin acessa portal admin
2. Abre dialog "Reativar Clínica"
3. Confirma reativação
   ↓
4. API DELETE /api/tenants/[id]/suspend
   ↓
5. Firestore: tenant.active = true
6. Firestore: remove tenant.suspension
7. Custom Claims: todos usuários → active = true
8. Firestore: users → active = true
   ↓
9. SuspensionInterceptor detecta mudança
   ↓
10. Usuários redirecionados para /clinic
11. Acesso restaurado normalmente
```

---

## 🧪 Como Testar

### Teste 1: Suspender Clínica

1. **Setup:**
   - Criar uma clínica de teste
   - Criar usuários: 1 clinic_admin + 2 clinic_users
   - Fazer login como clinic_admin

2. **Ações:**
   - Em outra aba/navegador, login como system_admin
   - Suspender a clínica com motivo "Teste de Suspensão"
   - Detalhes: "Teste funcional do sistema"

3. **Resultados Esperados:**
   - ✅ Clinic Admin:
     - Redirecionado para /suspended/admin
     - Vê motivo "Outro Motivo"
     - Vê detalhes "Teste funcional do sistema"
     - Vê email de contato
   - ✅ Clinic Users:
     - Redirecionados para /suspended/user
     - Veem mensagem genérica
     - NÃO veem motivo específico

4. **Validações:**
   - ✅ Não conseguem navegar para /clinic
   - ✅ Interceptor redireciona automaticamente
   - ✅ Logout funciona normalmente

### Teste 2: Reativar Clínica

1. **Ações:**
   - Como system_admin, reativar a clínica

2. **Resultados Esperados:**
   - ✅ Usuários redirecionados para /clinic
   - ✅ Acesso completo restaurado
   - ✅ Campo `suspension` removido do Firestore

### Teste 3: Suspensão em Tempo Real

1. **Setup:**
   - Clinic admin logado navegando pelo sistema

2. **Ações:**
   - System admin suspende a clínica

3. **Resultados Esperados:**
   - ✅ Clinic admin é redirecionado IMEDIATAMENTE
   - ✅ Não precisa fazer logout/login
   - ✅ Listener detecta mudança instantaneamente

---

## 📊 Dados no Firestore

### Tenant Ativo
```json
{
  "id": "clinic_abc123",
  "name": "Clínica Teste",
  "email": "teste@clinic.com",
  "active": true,
  "suspension": null  // ou campo não existe
}
```

### Tenant Suspenso
```json
{
  "id": "clinic_abc123",
  "name": "Clínica Teste",
  "email": "teste@clinic.com",
  "active": false,
  "suspension": {
    "suspended": true,
    "reason": "payment_failure",
    "details": "Fatura vencida há 30 dias. Sem resposta aos contatos.",
    "suspended_at": "Timestamp(...)",
    "suspended_by": "uid_system_admin",
    "contact_email": "suporte@curvamestra.com.br"
  }
}
```

### Custom Claims (Usuário Suspenso)
```json
{
  "tenant_id": "clinic_abc123",
  "role": "clinic_admin",
  "is_system_admin": false,
  "active": false  // ← Desativado
}
```

---

## 🔒 Segurança

### Permissões

| Role | Pode Suspender? | Pode Reativar? | Pode Ver Motivos? |
|------|----------------|---------------|-------------------|
| system_admin | ✅ Sim | ✅ Sim | ✅ Todos |
| clinic_admin | ❌ Não | ❌ Não | ✅ Própria clínica |
| clinic_user | ❌ Não | ❌ Não | ❌ Não |

### Validações de Segurança

1. **API Route:**
   - ✅ Verifica token JWT
   - ✅ Valida `is_system_admin = true`
   - ✅ Retorna 403 para não-admins

2. **Custom Claims:**
   - ✅ Atualizados server-side (não podem ser falsificados)
   - ✅ Propagados automaticamente para o cliente

3. **Firestore Rules:**
   ```javascript
   // Tenants só podem ser modificados por system_admin
   match /tenants/{tenantId} {
     allow write: if request.auth.token.is_system_admin == true;
   }
   ```

---

## 📈 Monitoramento

### Logs

**Suspensão:**
```
✅ Clínica clinic_abc123 suspensa por admin@system.com. Motivo: payment_failure
```

**Reativação:**
```
✅ Clínica clinic_abc123 reativada por admin@system.com
```

### Métricas Recomendadas

- Total de clínicas suspensas
- Motivos mais comuns de suspensão
- Tempo médio até reativação
- Taxa de reativação (reativadas / suspensas)

---

## 🚀 Uso no Portal Admin

### Exemplo de Integração

```tsx
import { SuspendTenantDialog, ReactivateTenantDialog } from "@/components/admin/SuspendTenantDialog";

// Na lista de tenants
{tenant.active ? (
  <SuspendTenantDialog tenant={tenant} onSuccess={refreshList} />
) : (
  <ReactivateTenantDialog tenant={tenant} onSuccess={refreshList} />
)}
```

### Indicador Visual de Status

```tsx
{tenant.suspension?.suspended ? (
  <Badge variant="destructive">
    <Ban className="h-3 w-3 mr-1" />
    Suspensa
  </Badge>
) : (
  <Badge variant="success">
    <CheckCircle className="h-3 w-3 mr-1" />
    Ativa
  </Badge>
)}
```

---

## 🐛 Troubleshooting

### Usuário não é redirecionado após suspensão

**Causa:** Listener não está ativo
**Solução:** Verificar se `SuspensionInterceptor` está no layout

### Reativação não funciona

**Causa:** Custom claims não atualizados
**Solução:** Usuário precisa fazer logout/login para atualizar token

### Clinic admin vê página de clinic_user

**Causa:** Role incorreto no Firestore
**Solução:** Verificar documento em `/users/{userId}`

---

## 📝 Changelog

### v1.0.0 - 23/01/2026
- ✅ Implementação inicial do sistema de suspensão
- ✅ API routes para suspender/reativar
- ✅ Páginas de bloqueio distintas por role
- ✅ Hook e interceptor em tempo real
- ✅ Interface administrativa completa
- ✅ Documentação completa

---

**Desenvolvido por:** Claude Code (Anthropic)
**Data:** 23/01/2026
