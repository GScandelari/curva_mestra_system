# 🚀 Postman Setup Guide - Curva Mestra Admin API

## 📥 Importação Rápida

### 1. Importar Collection
1. Abra o Postman
2. Clique em **Import**
3. Selecione o arquivo `Curva_Mestra_Admin_API.postman_collection.json`
4. Clique em **Import**

### 2. Importar Environment
1. Clique em **Import** novamente
2. Selecione o arquivo `Curva_Mestra_Environment.postman_environment.json`
3. Clique em **Import**
4. Selecione o ambiente **Curva Mestra Environment** no dropdown superior direito

---

## 🔧 Configuração do Ambiente

### Variáveis Obrigatórias

#### 1. Firebase Token
```
firebase_token: your-firebase-id-token-here
```

**Como obter o token:**

**Opção A - Via Console do Navegador:**
```javascript
// 1. Acesse https://curva-mestra.web.app
// 2. Faça login
// 3. Abra o Console do Navegador (F12)
// 4. Execute:
firebase.auth().currentUser.getIdToken().then(token => {
  console.log('Token:', token);
  navigator.clipboard.writeText(token);
  alert('Token copiado para clipboard!');
});
```

**Opção B - Via Firebase CLI:**
```bash
# Instalar Firebase CLI se necessário
npm install -g firebase-tools

# Fazer login
firebase login

# Obter token
firebase auth:print-users --project curva-mestra
```

**Opção C - Via SDK JavaScript:**
```javascript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  user.getIdToken().then(token => {
    console.log('Firebase Token:', token);
  });
}
```

#### 2. Test User UID
```
test_user_uid: uid-of-test-user
```

**Como obter:**
- Crie um usuário de teste no Firebase Auth Console
- Copie o UID do usuário
- Cole na variável `test_user_uid`

### Variáveis Opcionais (Auto-preenchidas)
- `current_user_uid` - Preenchido automaticamente
- `current_user_role` - Preenchido automaticamente  
- `current_user_is_admin` - Preenchido automaticamente
- `last_user_uid` - Preenchido automaticamente

---

## 🧪 Testes Rápidos

### 1. Teste de Conectividade
Execute: **Admin Initialization > Validate Admin Initialization**

**Resultado esperado:**
```json
{
  "result": {
    "success": true,
    "isInitialized": true/false,
    ...
  }
}
```

### 2. Inicialização do Sistema
Execute a pasta: **Test Sequences > Complete System Initialization**

**Ordem de execução:**
1. Validate Admin (Before)
2. Initialize Admin  
3. Validate Admin (After)

### 3. Teste de Autenticação
Execute: **User Role Management > Get User Role - Current User**

**Se der erro `unauthenticated`:**
- Verifique se o `firebase_token` está correto
- Verifique se o token não expirou (tokens expiram em 1 hora)

---

## 🔄 Fluxos de Teste Recomendados

### Fluxo 1: Inicialização Completa
```
1. Validate Admin Initialization
2. Initialize Default Admin (se necessário)
3. Validate Admin Initialization (confirmar)
```

### Fluxo 2: Gerenciamento de Usuário
```
1. Get User Role - Current User
2. Verify Admin Role - Current User
3. Set Admin Role (para test_user_uid)
4. Verify Admin Role - Specific User
5. Get User Role - Specific User
```

### Fluxo 3: Cenário de Emergência
```
1. Emergency Admin Assignment
2. Verify Admin Role (confirmar)
3. Get User Role (verificar claims)
```

---

## 🐛 Troubleshooting

### Erro: "unauthenticated"
**Causa:** Token Firebase inválido ou expirado

**Solução:**
1. Obter novo token Firebase
2. Atualizar variável `firebase_token`
3. Tentar novamente

### Erro: "not-found"
**Causa:** UID do usuário não existe

**Solução:**
1. Verificar se o usuário existe no Firebase Auth
2. Verificar se o UID está correto
3. Criar usuário se necessário

### Erro: "invalid-argument"
**Causa:** Parâmetros obrigatórios ausentes

**Solução:**
1. Verificar se todos os parâmetros estão preenchidos
2. Verificar se as variáveis de ambiente estão configuradas

### Erro: "failed-precondition"
**Causa:** Email não confere com o usuário

**Solução:**
1. Verificar se o email está correto
2. Verificar se o usuário existe com esse email

---

## 📊 Scripts de Teste Automático

### Pre-request Script Global
```javascript
// Adicionar Content-Type automaticamente
if (!pm.request.headers.has('Content-Type')) {
    pm.request.headers.add({
        key: 'Content-Type',
        value: 'application/json'
    });
}

// Log da requisição
console.log('🚀 Request:', pm.request.method, pm.request.url.toString());
```

### Test Script Global
```javascript
// Verificações básicas
pm.test('✅ Response is valid JSON', function () {
    pm.response.to.be.json;
});

pm.test('✅ Status code is 200', function () {
    pm.response.to.have.status(200);
});

// Log da resposta
const response = pm.response.json();
console.log('📥 Response:', response);

// Salvar dados úteis
if (response.result && response.result.uid) {
    pm.environment.set('last_user_uid', response.result.uid);
}

// Verificar erros
if (response.error) {
    console.error('❌ Error:', response.error);
} else {
    console.log('✅ Success:', response.result.message || 'Operation completed');
}
```

---

## 🎯 Testes Específicos por Endpoint

### Initialize Default Admin
```javascript
pm.test('Admin UID is correct', function () {
    const response = pm.response.json();
    pm.expect(response.result.uid).to.eql('gEjUSOsHF9QmS0Dvi0zB10GsxrD2');
});

pm.test('Admin has correct permissions', function () {
    const response = pm.response.json();
    const permissions = response.result.claims.permissions;
    pm.expect(permissions).to.include('system_admin');
    pm.expect(permissions).to.include('manage_users');
});
```

### Set Admin Role
```javascript
pm.test('Admin role assigned successfully', function () {
    const response = pm.response.json();
    pm.expect(response.result.claims.admin).to.be.true;
    pm.expect(response.result.claims.role).to.eql('administrator');
});
```

### Get User Role
```javascript
pm.test('User role information complete', function () {
    const response = pm.response.json();
    pm.expect(response.result.uid).to.not.be.undefined;
    pm.expect(response.result.email).to.not.be.undefined;
    pm.expect(response.result.role).to.not.be.undefined;
    pm.expect(response.result.permissions).to.be.an('array');
});
```

---

## 🔐 Segurança e Boas Práticas

### 1. Gerenciamento de Tokens
- ✅ Use tokens válidos e atualizados
- ✅ Não compartilhe tokens em repositórios públicos
- ✅ Renove tokens regularmente (expiram em 1 hora)
- ✅ Use variáveis de ambiente para tokens sensíveis

### 2. Testes em Ambiente Seguro
- ✅ Use usuários de teste, não usuários reais
- ✅ Teste em ambiente de desenvolvimento primeiro
- ✅ Monitore logs para detectar problemas
- ✅ Documente todos os testes realizados

### 3. Validação de Dados
- ✅ Sempre valide respostas da API
- ✅ Verifique códigos de erro esperados
- ✅ Teste cenários de falha
- ✅ Valide estrutura de dados retornados

---

## 📈 Monitoramento e Logs

### Console Logs Úteis
```javascript
// No Pre-request Script
console.log('🚀 Starting request to:', pm.request.url.toString());
console.log('📝 Request data:', JSON.parse(pm.request.body.raw));

// No Test Script
console.log('📊 Response time:', pm.response.responseTime + 'ms');
console.log('📦 Response size:', pm.response.responseSize + ' bytes');
```

### Métricas de Performance
```javascript
pm.test('Response time is acceptable', function () {
    pm.expect(pm.response.responseTime).to.be.below(5000); // 5 segundos
});

pm.test('Response size is reasonable', function () {
    pm.expect(pm.response.responseSize).to.be.below(10000); // 10KB
});
```

---

## 🎉 Pronto para Usar!

Após seguir este guia, você terá:

- ✅ Collection completa importada
- ✅ Ambiente configurado
- ✅ Tokens de autenticação funcionando
- ✅ Testes automatizados rodando
- ✅ Logs detalhados para debugging

**Próximos passos:**
1. Execute os testes de conectividade
2. Rode a sequência de inicialização completa
3. Teste os fluxos de gerenciamento de usuários
4. Explore os endpoints individuais

**Suporte:**
- Consulte a documentação em `API_DOCUMENTATION.md`
- Verifique os logs do console para debugging
- Use os scripts de teste para validação automática