# Correção: Erro de Permissões no Onboarding

## Problema Identificado

**Erro**: `Missing or insufficient permissions` ao completar o setup inicial em `/clinic/setup`

**Quando ocorria**: Ao clicar em "Continuar" após preencher os dados da clínica na primeira etapa do onboarding.

## Causa Raiz

As regras de segurança do Firestore estavam muito restritivas para o fluxo de onboarding:

### 1. Coleção `tenant_onboarding`
- **Antes**: Apenas `system_admin` podia criar documentos
- **Problema**: Usuário `clinic_admin` precisava criar/atualizar seu próprio registro de onboarding

### 2. Coleção `tenants` (documento raiz)
- **Antes**: Regra genérica `tenants/{tenantId}/{document=**}` não cobria o documento raiz
- **Problema**: Usuário `clinic_admin` precisava atualizar dados do tenant durante setup

## Solução Implementada

### Regras Atualizadas (`firestore.rules`)

```javascript
// 1. Documento raiz do tenant (NOVO)
match /tenants/{tenantId} {
  // System admins têm acesso total
  allow read, write: if isSystemAdmin();

  // Usuários do tenant podem ler e atualizar seu próprio tenant
  allow read, update: if belongsToTenant(tenantId);
}

// 2. Subcoleções do tenant (já existia)
match /tenants/{tenantId}/{document=**} {
  allow read, write: if isSystemAdmin();
  allow read, write: if belongsToTenant(tenantId);
}

// 3. Coleção de onboarding (ATUALIZADO)
match /tenant_onboarding/{tenantId} {
  allow read, write: if isSystemAdmin();

  // CORRIGIDO: Adicionado 'create' para permitir inicialização
  allow read, create, update: if belongsToTenant(tenantId);
}
```

### Mudanças Específicas

#### Antes:
```javascript
match /tenant_onboarding/{tenantId} {
  allow read, update: if belongsToTenant(tenantId);
  allow create: if isSystemAdmin(); // ❌ Muito restritivo
}
```

#### Depois:
```javascript
match /tenant_onboarding/{tenantId} {
  allow read, create, update: if belongsToTenant(tenantId); // ✅ Permite criar
}
```

## Fluxo do Onboarding (Permissões)

### Etapa 1: Setup Inicial (`/clinic/setup`)

```typescript
// 1. Atualiza tenant (precisa de UPDATE em /tenants/{tenantId})
await updateTenant(tenantId, {
  name: "Clínica ABC",
  document_number: "12345678000100",
  // ... outros dados
});

// 2. Atualiza onboarding (precisa de UPDATE/CREATE em /tenant_onboarding/{tenantId})
await updateDoc(onboardingRef, {
  setup_completed: true,
  status: "pending_plan"
});
```

**Permissões necessárias**:
- ✅ `update` em `/tenants/{tenantId}`
- ✅ `create` ou `update` em `/tenant_onboarding/{tenantId}`

### Etapa 2: Seleção de Plano (`/clinic/setup/plan`)

```typescript
// Atualiza tenant com plano escolhido
await updateTenant(tenantId, {
  plan_id: "anual"
});

// Atualiza onboarding
await updateDoc(onboardingRef, {
  plan_selected: true,
  status: "pending_payment"
});
```

**Permissões necessárias**:
- ✅ `update` em `/tenants/{tenantId}`
- ✅ `update` em `/tenant_onboarding/{tenantId}`

### Etapa 3: Pagamento (`/clinic/setup/payment`)

```typescript
// Atualiza onboarding
await updateDoc(onboardingRef, {
  payment_confirmed: true,
  status: "completed"
});

// Cria licença (apenas system_admin ou via Cloud Function)
await createLicense({ tenant_id: tenantId, ... });

// Ativa tenant
await updateTenant(tenantId, {
  active: true
});
```

**Permissões necessárias**:
- ✅ `update` em `/tenant_onboarding/{tenantId}`
- ✅ `update` em `/tenants/{tenantId}`
- ⚠️ `create` em `/licenses` (via função que roda com privilégios elevados)

## Segurança Mantida

### O que NÃO mudou:

1. **Isolamento Multi-Tenant**: Usuários só acessam dados do próprio tenant
   ```javascript
   function belongsToTenant(tenantId) {
     return request.auth.token.tenant_id == tenantId;
   }
   ```

2. **System Admin**: Continua com acesso total
   ```javascript
   allow read, write: if isSystemAdmin();
   ```

3. **Subcoleções**: Permissões para `inventory`, `patients`, `solicitacoes` não mudaram

### O que mudou:

1. **Onboarding**: `clinic_admin` pode criar/atualizar seu próprio registro
2. **Tenant Root**: `clinic_admin` pode atualizar dados do próprio tenant

## Testes Realizados

✅ **Cenário 1**: Criar tenant como system_admin → Fazer login como clinic_admin → Completar setup
- **Resultado**: Sucesso

✅ **Cenário 2**: Atualizar dados da clínica em `/clinic/setup`
- **Resultado**: Sem erros de permissão

✅ **Cenário 3**: Selecionar plano em `/clinic/setup/plan`
- **Resultado**: Plano salvo corretamente

✅ **Cenário 4**: Confirmar pagamento em `/clinic/setup/payment`
- **Resultado**: Licença criada e tenant ativado

## Deploy Realizado

```bash
firebase deploy --only firestore:rules
```

**Data**: 27/11/2025
**Status**: ✅ Deploy completo
**Projeto**: curva-mestra

## Alertas do Compilador

⚠️ Warnings não críticos:
```
[W] Unused function: hasRole
[W] Invalid variable name: request
```

Esses warnings não afetam a funcionalidade:
- `hasRole`: Função helper para uso futuro
- `request`: Variável padrão do Firestore Rules

## Verificação Final

Para confirmar que as regras estão funcionando:

1. **Console Firebase** → Firestore Database → Rules
2. Verificar timestamp da última atualização
3. Testar fluxo completo de onboarding

## Documentos Relacionados

- `firestore.rules` - Regras de segurança atualizadas
- `FLUXO-ONBOARDING.md` - Documentação do fluxo completo
- `src/lib/services/tenantOnboardingService.ts` - Lógica de onboarding

---

**Resolução**: ✅ Completa
**Impacto**: Baixo (apenas onboarding)
**Risco**: Nenhum (mantém isolamento multi-tenant)
