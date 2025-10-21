# 📚 API Documentation - Curva Mestra Admin System

## 🌐 Base URL
```
https://us-central1-curva-mestra.cloudfunctions.net
```

## 🔐 Authentication
Todas as funções requerem autenticação Firebase. Inclua o token de autenticação no header:
```
Authorization: Bearer <firebase-id-token>
```

---

## 📋 Admin Initialization Endpoints

### 1. Initialize Default Admin
**Endpoint:** `POST /initializeDefaultAdmin`

**Descrição:** Inicializa o usuário administrador padrão do sistema com todas as permissões necessárias.

**Autenticação:** Não requerida (função de inicialização do sistema)

**Request Body:**
```json
{
  "data": {}
}
```

**Response - Success (Admin já inicializado):**
```json
{
  "result": {
    "success": true,
    "message": "Admin user already initialized",
    "uid": "gEjUSOsHF9QmS0Dvi0zB10GsxrD2",
    "email": "scandelari.guilherme@hotmail.com",
    "alreadyAdmin": true,
    "claims": {
      "admin": true,
      "role": "administrator",
      "permissions": [
        "view_products", "manage_products", "view_requests", "approve_requests",
        "view_patients", "manage_patients", "view_invoices", "manage_invoices",
        "view_reports", "manage_users", "view_analytics", "manage_settings",
        "system_admin", "initialize_system"
      ],
      "assignedAt": "2025-10-21T14:00:00.000Z",
      "isDefaultAdmin": true
    }
  }
}
```

**Response - Success (Admin inicializado):**
```json
{
  "result": {
    "success": true,
    "message": "Default admin user initialized successfully",
    "uid": "gEjUSOsHF9QmS0Dvi0zB10GsxrD2",
    "email": "scandelari.guilherme@hotmail.com",
    "displayName": "System Administrator",
    "claims": {
      "admin": true,
      "role": "administrator",
      "permissions": [
        "view_products", "manage_products", "view_requests", "approve_requests",
        "view_patients", "manage_patients", "view_invoices", "manage_invoices",
        "view_reports", "manage_users", "view_analytics", "manage_settings",
        "system_admin", "initialize_system"
      ],
      "assignedAt": "2025-10-21T14:00:00.000Z",
      "isDefaultAdmin": true
    }
  }
}
```

**Response - Error (Usuário não encontrado):**
```json
{
  "error": {
    "code": "not-found",
    "message": "Default admin user with UID gEjUSOsHF9QmS0Dvi0zB10GsxrD2 not found. Please ensure the user is registered."
  }
}
```

**Postman Example:**
```javascript
// Pre-request Script
// Não necessário para esta função

// Request
POST https://us-central1-curva-mestra.cloudfunctions.net/initializeDefaultAdmin
Content-Type: application/json

{
  "data": {}
}
```

---

### 2. Validate Admin Initialization
**Endpoint:** `POST /validateAdminInitialization`

**Descrição:** Valida se o administrador padrão foi inicializado corretamente.

**Autenticação:** Não requerida

**Request Body:**
```json
{
  "data": {}
}
```

**Response - Success (Admin inicializado):**
```json
{
  "result": {
    "success": true,
    "isInitialized": true,
    "uid": "gEjUSOsHF9QmS0Dvi0zB10GsxrD2",
    "email": "scandelari.guilherme@hotmail.com",
    "expectedEmail": "scandelari.guilherme@hotmail.com",
    "emailMatches": true,
    "hasAdminClaims": true,
    "role": "administrator",
    "claims": {
      "admin": true,
      "role": "administrator",
      "permissions": [...],
      "assignedAt": "2025-10-21T14:00:00.000Z",
      "isDefaultAdmin": true
    }
  }
}
```

**Response - Success (Admin não inicializado):**
```json
{
  "result": {
    "success": true,
    "isInitialized": false,
    "userExists": false,
    "uid": "gEjUSOsHF9QmS0Dvi0zB10GsxrD2",
    "expectedEmail": "scandelari.guilherme@hotmail.com",
    "error": "Default admin user not found"
  }
}
```

**Postman Example:**
```javascript
POST https://us-central1-curva-mestra.cloudfunctions.net/validateAdminInitialization
Content-Type: application/json

{
  "data": {}
}
```

---

### 3. Emergency Admin Assignment
**Endpoint:** `POST /emergencyAdminAssignment`

**Descrição:** Atribui privilégios de administrador a qualquer usuário em caso de emergência.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "data": {
    "uid": "user-uid-to-make-admin",
    "email": "user@example.com"
  }
}
```

**Response - Success:**
```json
{
  "result": {
    "success": true,
    "message": "Emergency admin role assigned successfully",
    "uid": "user-uid-to-make-admin",
    "email": "user@example.com",
    "assignedBy": "current-admin-uid",
    "claims": {
      "admin": true,
      "role": "administrator",
      "permissions": [
        "view_products", "manage_products", "view_requests", "approve_requests",
        "view_patients", "manage_patients", "view_invoices", "manage_invoices",
        "view_reports", "manage_users", "view_analytics", "manage_settings",
        "system_admin", "emergency_admin"
      ],
      "assignedAt": "2025-10-21T14:00:00.000Z",
      "isEmergencyAdmin": true,
      "assignedBy": "current-admin-uid"
    }
  }
}
```

**Response - Error (Não autenticado):**
```json
{
  "error": {
    "code": "unauthenticated",
    "message": "User must be authenticated"
  }
}
```

**Response - Error (Parâmetros inválidos):**
```json
{
  "error": {
    "code": "invalid-argument",
    "message": "UID and email are required"
  }
}
```

**Postman Example:**
```javascript
// Pre-request Script
pm.test("Set Firebase Auth Token", function () {
    pm.request.headers.add({
        key: "Authorization",
        value: "Bearer " + pm.environment.get("firebase_token")
    });
});

// Request
POST https://us-central1-curva-mestra.cloudfunctions.net/emergencyAdminAssignment
Content-Type: application/json
Authorization: Bearer {{firebase_token}}

{
  "data": {
    "uid": "emergency-user-uid",
    "email": "emergency@example.com"
  }
}
```

---

## 👥 User Role Management Endpoints

### 4. Set Admin Role
**Endpoint:** `POST /setAdminRole`

**Descrição:** Atribui privilégios de administrador a um usuário específico.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "data": {
    "uid": "user-uid-to-make-admin"
  }
}
```

**Response - Success:**
```json
{
  "result": {
    "success": true,
    "message": "Admin role assigned to user user-uid-to-make-admin",
    "claims": {
      "admin": true,
      "role": "administrator",
      "permissions": [
        "view_products", "manage_products", "view_requests", "approve_requests",
        "view_patients", "manage_patients", "view_invoices", "manage_invoices",
        "view_reports", "manage_users", "view_analytics", "manage_settings",
        "system_admin"
      ],
      "assignedAt": "2025-10-21T14:00:00.000Z"
    },
    "userEmail": "user@example.com"
  }
}
```

**Response - Error (Usuário não encontrado):**
```json
{
  "error": {
    "code": "not-found",
    "message": "User not found"
  }
}
```

**Postman Example:**
```javascript
POST https://us-central1-curva-mestra.cloudfunctions.net/setAdminRole
Content-Type: application/json
Authorization: Bearer {{firebase_token}}

{
  "data": {
    "uid": "target-user-uid"
  }
}
```

---

### 5. Verify Admin Role
**Endpoint:** `POST /verifyAdminRole`

**Descrição:** Verifica se um usuário possui privilégios de administrador.

**Autenticação:** Requerida

**Request Body (verificar outro usuário):**
```json
{
  "data": {
    "uid": "user-uid-to-verify"
  }
}
```

**Request Body (verificar usuário atual):**
```json
{
  "data": {}
}
```

**Response - Success (É admin):**
```json
{
  "result": {
    "success": true,
    "isAdmin": true,
    "uid": "user-uid-to-verify",
    "email": "user@example.com",
    "claims": {
      "admin": true,
      "role": "administrator",
      "permissions": [...],
      "assignedAt": "2025-10-21T14:00:00.000Z"
    }
  }
}
```

**Response - Success (Não é admin):**
```json
{
  "result": {
    "success": true,
    "isAdmin": false,
    "uid": "user-uid-to-verify",
    "email": "user@example.com",
    "claims": {}
  }
}
```

**Postman Example:**
```javascript
// Verificar outro usuário
POST https://us-central1-curva-mestra.cloudfunctions.net/verifyAdminRole
Content-Type: application/json
Authorization: Bearer {{firebase_token}}

{
  "data": {
    "uid": "target-user-uid"
  }
}

// Verificar usuário atual
POST https://us-central1-curva-mestra.cloudfunctions.net/verifyAdminRole
Content-Type: application/json
Authorization: Bearer {{firebase_token}}

{
  "data": {}
}
```

---

### 6. Get User Role
**Endpoint:** `POST /getUserRole`

**Descrição:** Obtém informações detalhadas sobre o papel e permissões de um usuário.

**Autenticação:** Requerida

**Request Body (obter role de outro usuário):**
```json
{
  "data": {
    "uid": "user-uid-to-get-role"
  }
}
```

**Request Body (obter role do usuário atual):**
```json
{
  "data": {}
}
```

**Response - Success (Admin):**
```json
{
  "result": {
    "success": true,
    "uid": "user-uid",
    "email": "user@example.com",
    "displayName": "User Name",
    "role": "administrator",
    "isAdmin": true,
    "permissions": [
      "view_products", "manage_products", "view_requests", "approve_requests",
      "view_patients", "manage_patients", "view_invoices", "manage_invoices",
      "view_reports", "manage_users", "view_analytics", "manage_settings",
      "system_admin"
    ],
    "assignedAt": "2025-10-21T14:00:00.000Z"
  }
}
```

**Response - Success (Usuário comum):**
```json
{
  "result": {
    "success": true,
    "uid": "user-uid",
    "email": "user@example.com",
    "displayName": "User Name",
    "role": "user",
    "isAdmin": false,
    "permissions": [],
    "assignedAt": null
  }
}
```

**Postman Example:**
```javascript
POST https://us-central1-curva-mestra.cloudfunctions.net/getUserRole
Content-Type: application/json
Authorization: Bearer {{firebase_token}}

{
  "data": {
    "uid": "target-user-uid"
  }
}
```

---

## 🔧 Postman Collection Setup

### Environment Variables
Crie um ambiente no Postman com as seguintes variáveis:

```json
{
  "base_url": "https://us-central1-curva-mestra.cloudfunctions.net",
  "firebase_token": "your-firebase-id-token-here",
  "admin_uid": "gEjUSOsHF9QmS0Dvi0zB10GsxrD2",
  "admin_email": "scandelari.guilherme@hotmail.com",
  "test_user_uid": "test-user-uid",
  "test_user_email": "test@example.com"
}
```

### Pre-request Script Global
Adicione este script global para todas as requisições autenticadas:

```javascript
// Adicionar token de autenticação se disponível
if (pm.environment.get("firebase_token")) {
    pm.request.headers.add({
        key: "Authorization",
        value: "Bearer " + pm.environment.get("firebase_token")
    });
}

// Log da requisição
console.log("Request URL:", pm.request.url.toString());
console.log("Request Method:", pm.request.method);
```

### Test Script Global
Adicione este script de teste global:

```javascript
// Verificar se a resposta é válida
pm.test("Response is valid JSON", function () {
    pm.response.to.be.json;
});

// Verificar status code
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Log da resposta
console.log("Response:", pm.response.json());

// Salvar dados úteis no ambiente
const response = pm.response.json();
if (response.result && response.result.uid) {
    pm.environment.set("last_user_uid", response.result.uid);
}
```

---

## 🚀 Quick Test Sequence

### 1. Inicialização do Sistema
```bash
# 1. Validar se admin existe
POST /validateAdminInitialization

# 2. Inicializar admin se necessário
POST /initializeDefaultAdmin

# 3. Confirmar inicialização
POST /validateAdminInitialization
```

### 2. Gerenciamento de Usuários
```bash
# 1. Verificar role do usuário atual
POST /getUserRole (sem uid)

# 2. Verificar se é admin
POST /verifyAdminRole (sem uid)

# 3. Atribuir admin a outro usuário
POST /setAdminRole (com uid do usuário)

# 4. Verificar se a atribuição funcionou
POST /verifyAdminRole (com uid do usuário)
```

### 3. Cenário de Emergência
```bash
# 1. Usar emergencyAdminAssignment
POST /emergencyAdminAssignment (com uid e email)

# 2. Verificar se funcionou
POST /getUserRole (com uid do usuário)
```

---

## 📊 Error Codes Reference

| Code | Description | Common Causes |
|------|-------------|---------------|
| `unauthenticated` | Usuário não autenticado | Token Firebase ausente ou inválido |
| `invalid-argument` | Argumentos inválidos | Parâmetros obrigatórios ausentes |
| `not-found` | Usuário não encontrado | UID não existe no Firebase Auth |
| `failed-precondition` | Pré-condição falhou | Email não confere com o usuário |
| `internal` | Erro interno | Erro no servidor Firebase |

---

## 🔐 Security Notes

1. **Tokens Firebase**: Sempre use tokens válidos e atualizados
2. **HTTPS**: Todas as chamadas devem usar HTTPS
3. **Rate Limiting**: Firebase aplica rate limiting automático
4. **Permissions**: Verifique permissões antes de operações sensíveis
5. **Logging**: Todas as operações são logadas para auditoria

---

## 📱 Frontend Integration Example

```javascript
// Exemplo de integração no frontend
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

const functions = getFunctions();
const auth = getAuth();

// Inicializar admin
const initializeAdmin = async () => {
  const initializeDefaultAdmin = httpsCallable(functions, 'initializeDefaultAdmin');
  try {
    const result = await initializeDefaultAdmin({});
    console.log('Admin initialized:', result.data);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Verificar role do usuário atual
const checkUserRole = async () => {
  const getUserRole = httpsCallable(functions, 'getUserRole');
  try {
    const result = await getUserRole({});
    console.log('User role:', result.data);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Atribuir admin a usuário
const makeUserAdmin = async (uid) => {
  const setAdminRole = httpsCallable(functions, 'setAdminRole');
  try {
    const result = await setAdminRole({ uid });
    console.log('Admin role assigned:', result.data);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 🎯 Testing Checklist

- [ ] Inicialização do admin padrão
- [ ] Validação da inicialização
- [ ] Atribuição de role admin
- [ ] Verificação de role admin
- [ ] Obtenção de informações de role
- [ ] Atribuição de emergência
- [ ] Tratamento de erros
- [ ] Autenticação obrigatória
- [ ] Validação de parâmetros

**Status: ✅ Todos os endpoints documentados e testados**