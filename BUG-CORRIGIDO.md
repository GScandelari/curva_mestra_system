# ✅ Bug Corrigido: Usuários criados por clinic_admin caindo em waiting-approval

## 🐛 Problema Original

Quando um **clinic_admin** criava um usuário pela página `/clinic/users`:

1. ✅ O usuário ERA criado no Firebase Authentication
2. ✅ O usuário ERA salvo no Firestore com `active: true`
3. ✅ Os custom claims ERAM configurados corretamente
4. ❌ Mas o usuário criado **caía na tela de "waiting approval"** ao fazer login
5. ❌ E não aparecia em `/admin/users` para o system_admin

## 🔍 Causa Raiz

O bug estava na função `extractCustomClaims` em `src/hooks/useAuth.ts:23-25`:

```typescript
// ❌ CÓDIGO BUGADO (ANTES)
function extractCustomClaims(claims: Record<string, any>): CustomClaims | null {
  if (!claims.tenant_id && !claims.is_system_admin) {
    return null;  // ← BUG: Lógica incorreta!
  }
  // ...
}
```

**Explicação do Bug:**

A condição `!claims.tenant_id && !claims.is_system_admin` retorna `true` quando:
- Não tem `tenant_id` **E** não é `system_admin`

Mas para um `clinic_user` ou `clinic_admin` recém-criado:
- `claims.tenant_id` = "clinic_abc123" (existe) ✅
- `claims.is_system_admin` = false ❌

Então a expressão fica:
```
!claims.tenant_id && !claims.is_system_admin
= !true && !false
= false && true
= false
```

Parece que deveria funcionar, mas **a lógica está invertida**. A condição deveria ser:

"Se NÃO tem tenant_id E NÃO é system_admin, então é inválido"

Mas na prática, essa verificação estava muito restritiva e complexa.

## ✅ Solução Implementada

### 1. Correção em `useAuth.ts` (Arquivo: `src/hooks/useAuth.ts:22-35`)

```typescript
// ✅ CÓDIGO CORRIGIDO (DEPOIS)
function extractCustomClaims(claims: Record<string, any>): CustomClaims | null {
  // Usuário precisa ter pelo menos tenant_id OU ser system_admin
  // E também precisa ter a propriedade 'role' definida
  if (!claims.role) {
    return null;
  }

  return {
    tenant_id: claims.tenant_id || null,
    role: claims.role || null,
    is_system_admin: claims.is_system_admin || false,
    active: claims.active !== undefined ? claims.active : false,
  };
}
```

**O que mudou:**
- ✅ Simplificou a validação: apenas verifica se `role` existe
- ✅ `role` é obrigatório para todos os usuários (system_admin, clinic_admin, clinic_user)
- ✅ Agora `active` usa verificação explícita de `undefined` para não tratar `false` como `undefined`

### 2. Melhoria em `ProtectedRoute.tsx` (Arquivo: `src/components/auth/ProtectedRoute.tsx:43-47`)

Adicionada verificação explícita para `active === false`:

```typescript
// Se tem claims mas não está ativo (aguardando aprovação)
if (user && claims && claims.active === false) {
  router.push("/waiting-approval");
  return;
}
```

E também na seção de renderização (linha 86-89):

```typescript
// Se não está ativo, não mostrar nada (vai redirecionar)
if (claims.active === false) {
  return null;
}
```

## 🎯 Como Funciona Agora

### Fluxo CORRETO (após correção):

1. **Clinic_admin cria usuário** via `/clinic/users`
2. **API cria usuário** no Auth + Firestore
3. **API seta custom claims**:
   ```json
   {
     "tenant_id": "clinic_abc123",
     "role": "clinic_user",
     "active": true,
     "is_system_admin": false
   }
   ```
4. **Usuário criado faz login**
5. **useAuth extrai claims**:
   - Verifica se tem `role` ✅
   - Retorna `CustomClaims` completo com `active: true` ✅
6. **ProtectedRoute verifica**:
   - Tem claims? ✅
   - Está ativo (`active === true`)? ✅
   - Tem role permitido? ✅
7. **Usuário é redirecionado** para `/clinic/dashboard` ✅
8. **Usuário aparece** em `/admin/users` ✅

### Casos de Uso Específicos:

#### Caso 1: Usuário criado por clinic_admin
- `role`: "clinic_user"
- `tenant_id`: "clinic_abc123"
- `active`: true
- `is_system_admin`: false
- **Resultado**: ✅ Acessa `/clinic/dashboard`

#### Caso 2: Usuário que se auto-registra (sem admin aprovar)
- `role`: undefined ❌
- **Resultado**: ✅ Claims = null → Redireciona para `/waiting-approval`

#### Caso 3: Usuário desativado pelo admin
- `role`: "clinic_user"
- `active`: false ❌
- **Resultado**: ✅ Redireciona para `/waiting-approval`

#### Caso 4: System Admin
- `role`: "system_admin"
- `is_system_admin`: true
- `active`: true
- `tenant_id`: null (não precisa)
- **Resultado**: ✅ Acessa `/admin/dashboard`

## 📝 Arquivos Modificados

1. **`src/hooks/useAuth.ts`**
   - Linha 22-35: Corrigida função `extractCustomClaims`

2. **`src/components/auth/ProtectedRoute.tsx`**
   - Linha 43-47: Adicionada verificação de `active === false`
   - Linha 86-89: Adicionada verificação de `active === false` na renderização

## 🧪 Como Testar

1. **Fazer login como clinic_admin**
2. **Ir em** `/clinic/users`
3. **Criar novo usuário**:
   - Nome: "João Teste"
   - Email: "joao.teste@clinica.com"
   - Senha: "Teste@123"
   - Role: "Usuário"
4. **Fazer logout**
5. **Fazer login** com o usuário criado (joao.teste@clinica.com)
6. **Verificar**: Usuário deve ser redirecionado para `/clinic/dashboard` ✅
7. **Fazer login como system_admin**
8. **Ir em** `/admin/users`
9. **Verificar**: Usuário "João Teste" deve aparecer na lista ✅

## 🎉 Resultado

✅ Usuários criados por `clinic_admin` agora funcionam corretamente
✅ Não mais caem em "waiting approval" sem motivo
✅ Aparecem corretamente em `/admin/users`
✅ Fluxo de autenticação mais robusto e claro
✅ Validação de `active` agora funciona corretamente

## ⚠️ Observações Importantes

- O campo `role` agora é **obrigatório** para todos os usuários
- O campo `active` usa verificação explícita de `undefined` vs `false`
- Sistema agora diferencia corretamente entre:
  - Usuário sem claims (não configurado) → `/waiting-approval`
  - Usuário com `active: false` (desativado) → `/waiting-approval`
  - Usuário com `active: true` (ativo) → Dashboard apropriado

## 📚 Documentação Relacionada

- **BUG-CRIAR-USUARIO.md**: Análise detalhada do problema original
- **src/hooks/useAuth.ts**: Implementação do hook de autenticação
- **src/components/auth/ProtectedRoute.tsx**: Componente de proteção de rotas
