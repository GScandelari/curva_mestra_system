# 🔧 Guia de Setup de Desenvolvimento

Este guia explica como configurar custom claims e gerenciar usuários durante o desenvolvimento.

## 📋 Índice

0. [Setup do Ambiente Firebase Real (curva-mestra-dev)](#0-setup-do-ambiente-firebase-real-curva-mestra-dev)
1. [Métodos Disponíveis](#métodos-disponíveis)
2. [Método 1: Interface HTML](#método-1-interface-html)
3. [Método 2: Firebase Emulator UI](#método-2-firebase-emulator-ui)
4. [Método 3: Console do Navegador](#método-3-console-do-navegador)
5. [Funções Disponíveis](#funções-disponíveis)

---

## 0. Setup do Ambiente Firebase Real (curva-mestra-dev)

Este fluxo é para o ambiente Firebase de desenvolvimento real, acessível em `dev-gscandelari.web.app` ou `dev-lhuancassio.web.app`. É diferente dos emuladores locais.

### Pré-requisitos

- Acesso ao Firebase Console do projeto `curva-mestra-dev`
- Arquivo de credenciais do Service Account (`curva-mestra-dev-firebase-adminsdk-*.json`) — solicite ao tech lead

### Passo 1 — Criar a conta no Firebase Auth

1. Acesse o [Firebase Console](https://console.firebase.google.com) e selecione o projeto **curva-mestra-dev**
2. Vá em **Authentication → Users → Add user**
3. Informe o email e a senha da conta que será o `system_admin`
4. Clique em **Add user**

> A conta criada ainda não tem Custom Claims — o sistema exibirá "Aguardando aprovação do administrador" ao tentar logar. Isso é esperado.

### Passo 2 — Setar Custom Claims de system_admin

Com o arquivo do Service Account disponível, rode o script:

```bash
FIREBASE_ADMIN_CREDENTIALS="$(cat /caminho/para/curva-mestra-dev-firebase-adminsdk-*.json)" \
  node scripts/set-system-admin.js <email-da-conta>
```

**Exemplo real:**

```bash
FIREBASE_ADMIN_CREDENTIALS="$(cat ~/Downloads/curva-mestra-dev-firebase-adminsdk-fbsvc-4eff2f0021.json)" \
  node scripts/set-system-admin.js scandelari.guilherme@curvamestra.com.br
```

**Saída esperada:**

```
✅ Usuário encontrado: ppE4dEMCmjTLz4aLJho9IZkEqAG3 (scandelari.guilherme@curvamestra.com.br)
✅ Custom Claims setados:
   role: system_admin
   is_system_admin: true
   active: true
```

### Passo 3 — Fazer logout e login novamente

O token JWT é cacheado. Para que os novos Custom Claims sejam reconhecidos pelo sistema, **faça logout e login novamente** no domínio dev correspondente.

### Claims aplicados

```json
{
  "role": "system_admin",
  "is_system_admin": true,
  "active": true
}
```

### Observações de segurança

- O arquivo `.json` do Service Account **nunca deve ser commitado** — já está no `.gitignore`
- Use esse fluxo apenas no projeto `curva-mestra-dev`, nunca em `curva-mestra` (produção)
- Em produção, o `system_admin` é configurado pelo tech lead via procedimento separado

---

## Métodos Disponíveis

Você pode configurar custom claims de três formas:

1. **Interface HTML** - Mais fácil e visual
2. **Firebase Emulator UI** - Direto na interface do Firebase
3. **Console do Navegador** - Para desenvolvedores que preferem JavaScript

---

## Método 1: Interface HTML

### Passo a Passo

1. **Certifique-se que os emuladores estão rodando:**

   ```bash
   firebase emulators:start
   ```

2. **Abra a ferramenta de setup:**

   Abra o arquivo no navegador:

   ```
   dev-tools/setup-admin.html
   ```

   Ou acesse diretamente:

   ```
   file:///mnt/c/Users/scand/OneDrive/Área de Trabalho/Curva Mestra/curva_mestra/dev-tools/setup-admin.html
   ```

3. **Use as ferramentas disponíveis:**

   ### 1️⃣ Criar System Admin
   - Preencha nome, email e senha
   - Clique em "Criar System Admin"
   - Você receberá o UID do usuário criado

   **Exemplo:**
   - Nome: `System Admin`
   - Email: `admin@curva-mestra.dev`
   - Senha: `admin123`

   ### 2️⃣ Adicionar Custom Claims

   Use esta opção quando você já criou um usuário pelo formulário de registro.

   **Como obter o User ID (UID):**
   - Acesse: http://127.0.0.1:4000/auth
   - Copie o UID do usuário
   - Cole no campo "User ID"

   **Exemplo de configuração:**
   - User ID: `abc123def456...` (copie do Emulator UI)
   - Tenant ID: `tenant_1234567890`
   - Role: `admin`
   - System Admin: ❌ (desmarcado)
   - Ativo: ✅ (marcado)

   ### 3️⃣ Criar Tenant (Clínica)

   **IMPORTANTE:** Você precisa estar autenticado como system admin!
   1. Primeiro, faça login no app (http://localhost:3000) com o system admin
   2. Depois, volte para esta ferramenta e crie o tenant

   **Exemplo:**
   - Nome: `Clínica Bella Vita`
   - CNPJ: `12.345.678/0001-90`
   - Email: `contato@bellavita.com.br`

---

## Método 2: Firebase Emulator UI

### Configurar Custom Claims Manualmente

1. **Acesse o Emulator UI:**

   ```
   http://127.0.0.1:4000
   ```

2. **Vá para Authentication:**
   - Clique em "Authentication" no menu lateral

3. **Selecione o usuário:**
   - Encontre o usuário na lista
   - Clique no UID para abrir os detalhes

4. **Edite Custom Claims:**

   Na aba "Custom Claims", adicione o JSON:

   ```json
   {
     "tenant_id": "tenant_1234567890",
     "role": "admin",
     "is_system_admin": false,
     "active": true
   }
   ```

5. **Salve as alterações**

6. **Force refresh do token:**

   No app, o usuário precisa fazer logout e login novamente para que as novas claims sejam aplicadas.

---

## Método 3: Console do Navegador

### Pré-requisitos

1. Faça login no app como system admin
2. Abra o console do navegador (F12)
3. Execute os comandos abaixo

### Comandos Disponíveis

#### Importar as funções necessárias

Se estiver no dashboard ou qualquer página do app:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// Se estiver usando emulador (já configurado automaticamente)
```

#### 1. Configurar Custom Claims

```javascript
const setUserClaims = httpsCallable(functions, 'setUserClaims');

await setUserClaims({
  userId: 'UID_DO_USUARIO',
  tenantId: 'tenant_1234567890',
  role: 'admin',
  isSystemAdmin: false,
  active: true,
});
```

**Exemplo completo:**

```javascript
// Configurar um usuário como admin de uma clínica
const setUserClaims = httpsCallable(functions, 'setUserClaims');

const result = await setUserClaims({
  userId: 'abc123def456ghi789',
  tenantId: 'tenant_1701234567890',
  role: 'admin',
  isSystemAdmin: false,
  active: true,
});

console.log(result.data);
// { success: true, message: 'Custom claims atualizados com sucesso', ... }
```

#### 2. Criar Tenant

```javascript
const createTenant = httpsCallable(functions, 'createTenant');

const result = await createTenant({
  name: 'Clínica Bella Vita',
  cnpj: '12.345.678/0001-90',
  email: 'contato@bellavita.com.br',
  planId: 'basic', // opcional
});

console.log(result.data);
// { tenantId: 'tenant_1701234567890', message: 'Tenant criado com sucesso' }
```

#### 3. Adicionar Usuário a um Tenant

```javascript
const addUserToTenant = httpsCallable(functions, 'addUserToTenant');

const result = await addUserToTenant({
  userId: 'UID_DO_USUARIO',
  tenantId: 'tenant_1701234567890',
  role: 'manager',
});

console.log(result.data);
```

---

## Funções Disponíveis

### 1. `setupSystemAdmin`

Cria um novo usuário system admin.

**Parâmetros:**

```typescript
{
  email: string;        // Email do admin
  password: string;     // Senha (mínimo 6 caracteres)
  displayName?: string; // Nome (opcional)
}
```

**Retorno:**

```typescript
{
  success: true,
  message: "System admin criado com sucesso",
  userId: string,
  email: string
}
```

**Custom Claims aplicados:**

```json
{
  "is_system_admin": true,
  "role": "system_admin",
  "active": true
}
```

---

### 2. `setUserClaims`

Configura custom claims para um usuário existente.

**Parâmetros:**

```typescript
{
  userId: string;           // UID do usuário (obrigatório)
  tenantId?: string;        // ID do tenant (opcional)
  role?: string;            // Role do usuário (opcional)
  isSystemAdmin?: boolean;  // Se é system admin (opcional)
  active?: boolean;         // Se está ativo (opcional)
}
```

**Retorno:**

```typescript
{
  success: true,
  message: "Custom claims atualizados com sucesso",
  userId: string,
  claims: object
}
```

**Exemplo de claims:**

```json
{
  "tenant_id": "tenant_1701234567890",
  "role": "admin",
  "is_system_admin": false,
  "active": true
}
```

---

### 3. `createTenant`

Cria um novo tenant (clínica). **Requer autenticação como system_admin.**

**Parâmetros:**

```typescript
{
  name: string;    // Nome da clínica (obrigatório)
  cnpj: string;    // CNPJ (obrigatório)
  email: string;   // Email de contato (obrigatório)
  planId?: string; // ID do plano (opcional, padrão: 'basic')
}
```

**Retorno:**

```typescript
{
  tenantId: string,
  message: "Tenant criado com sucesso"
}
```

**Documento criado no Firestore:**

```json
{
  "id": "tenant_1701234567890",
  "name": "Clínica Bella Vita",
  "cnpj": "12.345.678/0001-90",
  "email": "contato@bellavita.com.br",
  "plan_id": "basic",
  "created_at": "2024-11-07T...",
  "updated_at": "2024-11-07T...",
  "active": true
}
```

---

### 4. `addUserToTenant`

Adiciona um usuário a um tenant. **Requer autenticação como system_admin ou admin do tenant.**

**Parâmetros:**

```typescript
{
  userId: string; // UID do usuário (obrigatório)
  tenantId: string; // ID do tenant (obrigatório)
  role: string; // Role do usuário (obrigatório)
}
```

**Roles disponíveis:**

- `admin` - Administrador da clínica
- `manager` - Gerente
- `user` - Usuário padrão

**Retorno:**

```typescript
{
  success: true,
  message: "Usuário adicionado ao tenant com sucesso",
  userId: string,
  tenantId: string,
  role: string
}
```

**O que esta função faz:**

1. Atualiza os custom claims do usuário
2. Cria um documento em `tenants/{tenantId}/users/{userId}`

---

## 🎯 Fluxo Recomendado para Testes

### Setup Inicial (Fazer uma vez)

1. **Criar System Admin:**

   ```
   Usar setup-admin.html → Seção 1
   Email: admin@curva-mestra.dev
   Senha: admin123
   ```

2. **Criar um Tenant:**
   ```
   1. Login no app como system admin
   2. Usar setup-admin.html → Seção 3
   Nome: Clínica Teste
   CNPJ: 12.345.678/0001-90
   ```

### Para cada usuário de teste

1. **Registrar usuário normal:**

   ```
   http://localhost:3000/register
   Nome: João Silva
   Email: joao@teste.com
   Senha: teste123
   ```

2. **Configurar custom claims:**

   ```
   Usar setup-admin.html → Seção 2
   User ID: [copiar do Emulator UI]
   Tenant ID: tenant_1701234567890
   Role: admin
   ```

3. **Fazer logout/login:**
   ```
   O usuário precisa fazer logout e login novamente
   para receber as novas permissões
   ```

---

## ⚠️ Troubleshooting

### "Apenas system_admin pode criar tenants"

**Problema:** Você não está autenticado como system admin.

**Solução:**

1. Crie um system admin primeiro (seção 1 do setup-admin.html)
2. Faça login no app com essas credenciais
3. Depois tente criar o tenant

### "User not found"

**Problema:** O UID do usuário está incorreto.

**Solução:**

1. Acesse http://127.0.0.1:4000/auth
2. Copie o UID completo do usuário
3. Cole no campo correto

### Custom claims não estão sendo aplicados

**Problema:** O token não foi atualizado.

**Solução:**

1. Faça logout no app
2. Faça login novamente
3. As novas claims serão carregadas

### Função não encontrada

**Problema:** As functions não foram compiladas ou o emulador não está rodando.

**Solução:**

```bash
cd functions
npm run build
cd ..
firebase emulators:start
```

---

## 📝 Notas Importantes

1. **Ambiente de Desenvolvimento:**
   - Estas ferramentas devem ser usadas apenas em desenvolvimento
   - Em produção, use o Firebase Console ou scripts seguros

2. **Custom Claims:**
   - Custom claims são cacheados no token
   - Usuário precisa fazer logout/login para receber novas claims
   - Ou você pode forçar refresh: `await user.getIdToken(true)`

3. **Multi-Tenancy:**
   - Cada usuário pode pertencer a apenas um tenant
   - System admins têm acesso a todos os tenants
   - Admins de tenant têm acesso apenas ao seu tenant

4. **Segurança:**
   - Firestore Rules verificam tenant_id automaticamente
   - Functions verificam permissões antes de executar
   - Sempre valide dados no backend

---

## 🚀 Links Úteis

- **App:** http://localhost:3000
- **Emulator UI:** http://127.0.0.1:4000
- **Auth Emulator:** http://localhost:9099
- **Firestore UI:** http://127.0.0.1:4000/firestore
- **Functions Log:** http://127.0.0.1:4000/logs

---

Criado para o projeto **Curva Mestra** - Sistema Multi-Tenant para Clínicas
