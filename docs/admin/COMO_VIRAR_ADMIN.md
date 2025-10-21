# 🔑 Como se Tornar Admin no Sistema

## 🎯 **Situação Atual**
Você criou sua conta diretamente no Firebase Authentication Console, mas ela ficou com perfil de **Recepcionista** porque não recebeu as custom claims necessárias.

---

## 🚀 **Opção 1: Script Automático (Recomendado)**

### **Passo 1: Execute o Script**
```bash
# No terminal, na raiz do projeto:
node scripts/make-admin.js SEU-EMAIL@EXEMPLO.COM
```

**Substitua `SEU-EMAIL@EXEMPLO.COM` pelo email da sua conta!**

### **Passo 2: Faça Logout e Login**
1. Acesse https://curva-mestra.web.app
2. Faça logout da sua conta
3. Faça login novamente
4. ✅ Agora você será **Admin**!

---

## 🛠️ **Opção 2: Via Firebase Console (Manual)**

### **Passo 1: Acesse o Firebase Console**
1. Vá para: https://console.firebase.google.com/project/curva-mestra
2. Clique em **Authentication** → **Users**
3. Encontre seu usuário na lista

### **Passo 2: Adicione Custom Claims**
1. Clique no seu usuário
2. Vá para a aba **Custom Claims**
3. Adicione o seguinte JSON:

```json
{
  "role": "admin",
  "isAdmin": true,
  "clinicId": "default-clinic",
  "permissions": [
    "view_products",
    "manage_products", 
    "view_requests",
    "approve_requests",
    "view_patients",
    "manage_patients",
    "view_invoices", 
    "manage_invoices",
    "view_reports",
    "manage_users",
    "view_analytics",
    "manage_settings"
  ]
}
```

### **Passo 3: Salve e Recarregue**
1. Clique em **Save**
2. Faça logout e login no sistema
3. ✅ Agora você será **Admin**!

---

## 🔧 **Opção 3: Via Firebase Functions (Avançado)**

Se você quiser usar as Functions que criei:

### **Passo 1: Deploy das Functions**
```bash
# Build das functions
cd functions
npm run build

# Deploy
firebase deploy --only functions
```

### **Passo 2: Chame a Function**
```javascript
// No console do navegador (F12):
const functions = firebase.functions();
const setUserRole = functions.httpsCallable('setAdminUserRole');

setUserRole({
  uid: 'SEU-UID-AQUI',
  role: 'admin',
  clinicId: 'default-clinic',
  isAdmin: true
}).then(result => {
  console.log('✅ Sucesso:', result.data);
}).catch(error => {
  console.error('❌ Erro:', error);
});
```

---

## 🎯 **Verificação**

### **Como Verificar se Funcionou:**

1. **No Sistema:**
   - Acesse https://curva-mestra.web.app
   - Faça login
   - Você deve ver opções de **Admin** no menu

2. **No Console do Navegador (F12):**
   ```javascript
   // Verificar custom claims
   firebase.auth().currentUser.getIdTokenResult()
     .then(idTokenResult => {
       console.log('Claims:', idTokenResult.claims);
       console.log('Role:', idTokenResult.claims.role);
       console.log('Is Admin:', idTokenResult.claims.isAdmin);
     });
   ```

3. **Permissões de Admin:**
   - ✅ Acesso a todos os módulos
   - ✅ Painel de administração
   - ✅ Gestão de usuários
   - ✅ Relatórios avançados
   - ✅ Configurações do sistema

---

## 🚨 **Troubleshooting**

### **Problema: "Script não funciona"**
```bash
# Instalar dependências se necessário
npm install firebase-admin

# Verificar se está na raiz do projeto
pwd
# Deve mostrar: /caminho/para/curva_mestra_system
```

### **Problema: "Usuário não encontrado"**
- Verifique se o email está correto
- Confirme que o usuário existe no Firebase Authentication
- Use o email exato que aparece no console

### **Problema: "Permissões não aplicadas"**
1. Faça logout completo
2. Limpe cache do navegador (Ctrl+Shift+R)
3. Faça login novamente
4. Aguarde alguns segundos para sincronização

---

## 📞 **Precisa de Ajuda?**

Se nenhuma opção funcionar:

1. **Verifique o Console do Firebase**
2. **Confirme que está usando o projeto correto** (`curva-mestra`)
3. **Tente a Opção 2 (Manual)** - é a mais confiável

---

## ✅ **Resultado Esperado**

Após seguir qualquer uma das opções:

- ✅ **Role**: admin
- ✅ **isAdmin**: true  
- ✅ **clinicId**: default-clinic
- ✅ **Permissões**: Todas as permissões de administrador
- ✅ **Acesso**: Painel completo de administração

**Agora você terá acesso total ao sistema como administrador! 🎉**