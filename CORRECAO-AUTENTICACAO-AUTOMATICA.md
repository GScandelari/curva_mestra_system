# ✅ Correção: Autenticação Automática ao Criar Usuário

## 🐛 Problema

Quando um **system_admin** ou **clinic_admin** criava um usuário, o sistema **autenticava automaticamente** com a conta recém-criada, fazendo logout do admin.

## 🔍 Causa Raiz

A página `/admin/tenants/[id]` (onde system_admin cria usuários) estava usando a função `createClinicUser` do arquivo `src/lib/services/clinicUserService.ts`, que usa `createUserWithEmailAndPassword` **no client-side**.

```typescript
// ❌ CÓDIGO PROBLEMÁTICO (clinicUserService.ts)
const userCredential = await createUserWithEmailAndPassword(
  auth,
  email,
  password
);
```

**Problema:** A função `createUserWithEmailAndPassword` do Firebase Auth **automaticamente autentica** o usuário recém-criado, fazendo logout do admin atual.

## ✅ Solução Implementada

### 1. Página do System Admin (`/admin/tenants/[id]/page.tsx`)

**ANTES:**
```typescript
// Usava createClinicUser (client-side) - autenticava automaticamente
await createClinicUser({
  tenantId,
  email: newUserEmail,
  password: newUserPassword,
  displayName: newUserName,
  role: newUserRole,
});
```

**DEPOIS:**
```typescript
// Usa API route (server-side) - NÃO autentica automaticamente
const idToken = await auth.currentUser?.getIdToken();

const response = await fetch("/api/users/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`,
  },
  body: JSON.stringify({
    email: newUserEmail,
    password: newUserPassword,
    displayName: newUserName,
    role: newUserRole,
    tenant_id_override: tenantId, // System admin pode criar para qualquer tenant
  }),
});
```

### 2. API Route (`/api/users/create/route.ts`)

Atualizada para aceitar criação por **system_admin** ou **clinic_admin**:

```typescript
// Verificar se é clinic_admin OU system_admin
const isSystemAdmin = decodedToken.is_system_admin === true;
const isClinicAdmin = decodedToken.role === "clinic_admin";

if (!isSystemAdmin && !isClinicAdmin) {
  return NextResponse.json(
    { error: "Apenas administradores podem criar usuários" },
    { status: 403 }
  );
}

// Parse do body
const { email, displayName, password, role, tenant_id_override } = body;

// Para system_admin, usar tenant_id_override
// Para clinic_admin, usar tenant_id do token
let tenantId: string;
if (isSystemAdmin && tenant_id_override) {
  tenantId = tenant_id_override;
} else if (isClinicAdmin) {
  tenantId = decodedToken.tenant_id;
}
```

**Diferença chave:**
- `admin.auth().createUser()` (server-side) → **NÃO** autentica automaticamente ✅
- `createUserWithEmailAndPassword()` (client-side) → **SIM** autentica automaticamente ❌

## 📝 Arquivos Modificados

### 1. `/admin/tenants/[id]/page.tsx`
- **Linha 192-243**: Função `handleCreateUser` reescrita
- Agora usa API route ao invés de `createClinicUser`
- Remove import de `createClinicUser`

### 2. `/api/users/create/route.ts`
- **Linha 19-52**: Adicionado suporte para system_admin
- Adicionado parâmetro `tenant_id_override`
- System admin pode criar usuários para qualquer tenant
- Clinic admin cria usuários apenas para seu próprio tenant

## 🎯 Fluxo Correto Agora

### Criação por System Admin:

1. **System admin** acessa `/admin/tenants/{id}`
2. Clica em "Adicionar Usuário"
3. Preenche formulário (email, senha, nome, role)
4. Clica em "Criar Usuário"
5. **Frontend** chama `/api/users/create` com `tenant_id_override`
6. **API** cria usuário usando `admin.auth().createUser()` (server-side)
7. **API** configura custom claims
8. **API** salva documento no Firestore
9. ✅ **System admin continua logado** (NÃO faz logout)
10. ✅ Mensagem de sucesso: "Usuário criado com sucesso!"
11. ✅ Lista de usuários é recarregada automaticamente

### Criação por Clinic Admin:

1. **Clinic admin** acessa `/clinic/users`
2. Clica em "Adicionar Usuário"
3. Preenche formulário
4. **Frontend** chama `/api/users/create` (sem `tenant_id_override`)
5. **API** usa `tenant_id` do token do clinic_admin
6. **API** cria usuário (server-side)
7. ✅ **Clinic admin continua logado** (NÃO faz logout)
8. ✅ Mensagem de sucesso
9. ✅ Lista de usuários é recarregada

## ✅ Benefícios

1. **Não faz logout do admin** ao criar usuário
2. **Mais seguro**: Criação server-side com Firebase Admin SDK
3. **Consistente**: Ambos (system_admin e clinic_admin) usam mesma API
4. **Validações centralizadas**: Limite de usuários, plano, etc.
5. **Custom claims configurados corretamente** desde o início

## 🧪 Como Testar

### Teste 1: System Admin criando usuário

1. Login como `system_admin`
2. Ir em `/admin/tenants` e escolher uma clínica
3. Clicar em "Adicionar Usuário"
4. Preencher:
   - Email: "teste@clinica.com"
   - Nome: "João Teste"
   - Senha: "Senha@123"
   - Role: "Usuário"
5. Clicar em "Criar Usuário"
6. ✅ Deve aparecer mensagem "Usuário criado com sucesso!"
7. ✅ Você deve **continuar logado** como system_admin
8. ✅ Lista de usuários deve atualizar automaticamente

### Teste 2: Clinic Admin criando usuário

1. Login como `clinic_admin`
2. Ir em `/clinic/users`
3. Clicar em "Adicionar Usuário"
4. Preencher formulário
5. Clicar em "Criar Usuário"
6. ✅ Deve aparecer mensagem "Usuário criado com sucesso!"
7. ✅ Você deve **continuar logado** como clinic_admin
8. ✅ Lista de usuários deve atualizar automaticamente

## 📌 Observações Importantes

### Sobre o `clinicUserService.ts`

O arquivo `src/lib/services/clinicUserService.ts` **ainda existe** mas:
- ❌ Não deve ser usado para criar usuários (usa client-side auth)
- ✅ Ainda é usado para **listar** usuários (`listClinicUsers`)
- 🚧 Pode ser removido futuramente quando migrarmos listagem para API route

### Por que não deletar `clinicUserService.ts`?

Atualmente ele ainda é usado para:
1. `listClinicUsers()` - Listar usuários de uma clínica
2. `ClinicUser` interface - Tipo usado em várias páginas

Quando migrarmos a listagem para API route, poderemos deletar completamente.

## 🎉 Resultado

✅ System admin pode criar usuários sem fazer logout
✅ Clinic admin pode criar usuários sem fazer logout
✅ Usuários são criados com custom claims corretos
✅ Mensagem de sucesso clara
✅ Lista atualiza automaticamente
✅ Mais seguro (server-side)

## 📚 Documentação Relacionada

- **Firebase Admin SDK**: Cria usuários sem autenticar
- **Firebase Auth Client SDK**: `createUserWithEmailAndPassword` autentica automaticamente
- **API Routes**: `/api/users/create`
