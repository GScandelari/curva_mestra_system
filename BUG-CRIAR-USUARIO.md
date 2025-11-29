# Bug: Criar Usuário pela Clínica

## 🐛 Problema Identificado

Quando um **clinic_admin** cria um usuário pela página `/clinic/users`:

1. ✅ O usuário É criado no Firebase Authentication
2. ✅ O usuário É salvo no Firestore (`tenants/{tenant_id}/users/{uid}`)
3. ✅ Os custom claims SÃO configurados corretamente
4. ❌ Mas o usuário criado **cai na tela de "waiting approval"** ao fazer login
5. ❌ E não aparece em `/admin/users` para o system_admin

## 🔍 Análise do Código

### API de Criação (`/api/users/create/route.ts:101-106`)

```typescript
await adminAuth.setCustomUserClaims(userRecord.uid, {
  tenant_id: tenantId,
  role: role,
  active: true,        // ✅ Está setando como true
  is_system_admin: false,
});
```

O código está **CORRETO**. O usuário é criado com `active: true`.

### Documento no Firestore (`/api/users/create/route.ts:109-117`)

```typescript
const userDoc = {
  email,
  displayName,
  role,
  active: true,       // ✅ Está setando como true
  tenant_id: tenantId,
  created_at: new Date(),
  updated_at: new Date(),
};
```

O documento também está **CORRETO**.

### Listagem em `/admin/users` (`/admin/users/page.tsx:56-98`)

```typescript
const loadAllUsers = async () => {
  // Buscar todos os tenants
  const tenantsSnapshot = await getDocs(tenantsRef);

  // Para cada tenant, buscar seus usuários
  for (const tenantDoc of tenantsSnapshot.docs) {
    const usersRef = collection(db, "tenants", tenantId, "users");
    const usersQuery = query(usersRef, orderBy("created_at", "desc"));
    const usersSnapshot = await getDocs(usersQuery);
    // ...
  }
}
```

O código de listagem está **CORRETO** e deveria listar os usuários.

## 🤔 Possíveis Causas

### 1. Problema de Sincronização de Custom Claims

**Sintoma**: O usuário é criado com `active: true`, mas ao fazer login o token ainda não tem os claims atualizados.

**Solução**: Forçar refresh do token após criar usuário.

### 2. Problema no Middleware/ProtectedRoute

**Causa**: O `ProtectedRoute` ou middleware está redirecionando para `/waiting-approval` mesmo com `active: true`.

**Local**: Verificar arquivo `src/components/auth/ProtectedRoute.tsx` ou middleware.

### 3. Problema de Permissões do Firestore

**Causa**: As regras de segurança do Firestore podem estar bloqueando a leitura dos usuários criados pelo clinic_admin.

**Verificar**: `firestore.rules`

## ✅ Soluções Propostas

### Solução 1: Verificar ProtectedRoute

Vamos verificar se o `ProtectedRoute` está verificando corretamente os claims.

### Solução 2: Forçar Refresh do Token

Após criar o usuário, o admin deve fazer logout/login ou forçar refresh do token.

### Solução 3: Verificar Middleware

Pode haver um middleware redirecionando incorretamente para `/waiting-approval`.

## 📋 Checklist de Diagnóstico

Para diagnosticar o problema, precisamos verificar:

- [ ] O usuário criado tem `active: true` no Authentication (custom claims)
- [ ] O usuário criado tem `active: true` no Firestore
- [ ] O usuário criado aparece em `/admin/users` quando recarrega a página
- [ ] Ao fazer login com o usuário criado, qual é o valor de `claims.active`?
- [ ] Existe algum middleware redirecionando para `/waiting-approval`?

## 🔧 Como Testar

1. **Criar usuário pela clínica:**
   - Login como clinic_admin
   - Ir em `/clinic/users`
   - Criar novo usuário

2. **Verificar no Firebase Console:**
   - Ir em Authentication > Users
   - Encontrar o usuário criado
   - Clicar e verificar "Custom claims"
   - Confirmar que `active: true`

3. **Verificar no Firestore:**
   - Ir em Firestore Database
   - Navegar para `tenants/{tenant_id}/users/{uid}`
   - Confirmar que `active: true`

4. **Testar login:**
   - Logout
   - Login com o usuário criado
   - Verificar se cai em `/waiting-approval` ou no dashboard

5. **Debug de claims:**
   - Na página de debug (`/debug`), verificar os claims do usuário logado
   - Confirmar que `active: true` e `tenant_id` estão presentes

## 🎯 Próximos Passos

1. Verificar o arquivo `ProtectedRoute.tsx`
2. Verificar se existe middleware
3. Verificar regras do Firestore
4. Adicionar logs para debug

## 📌 Informações Importantes

**Fluxo CORRETO** (esperado):

1. Clinic_admin cria usuário via `/api/users/create`
2. API cria usuário no Auth + Firestore
3. API seta custom claims com `active: true`
4. Usuário criado faz login
5. Usuário criado é redirecionado para `/clinic/dashboard` (não `/waiting-approval`)
6. Usuário aparece em `/admin/users` imediatamente

**Fluxo ATUAL** (bugado):

1. Clinic_admin cria usuário via `/api/users/create` ✅
2. API cria usuário no Auth + Firestore ✅
3. API seta custom claims com `active: true` ✅
4. Usuário criado faz login ✅
5. Usuário criado é redirecionado para `/waiting-approval` ❌ (BUG!)
6. Usuário NÃO aparece em `/admin/users` ❌ (PODE SER PROBLEMA DE REGRAS)

## 🔍 Arquivos para Investigar

1. `src/components/auth/ProtectedRoute.tsx` - Verificar lógica de redirecionamento
2. `src/middleware.ts` (se existir) - Verificar se tem middleware
3. `firestore.rules` - Verificar permissões de leitura
4. `src/app/layout.tsx` - Verificar se tem lógica de redirecionamento global
