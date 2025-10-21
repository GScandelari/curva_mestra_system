# 🔄 UPGRADE MANUAL: Recepcionista → Admin

## 📋 INSTRUÇÕES PASSO A PASSO

### **1. Acesse o Firebase Console**
🌐 **URL**: https://console.firebase.google.com/project/curva-mestra

### **2. Navegue para Authentication**
1. No menu lateral, clique em **"Authentication"**
2. Clique na aba **"Users"**

### **3. Encontre seu usuário**
- **Email**: `scandelari.guilherme@hotmail.com`
- **UID**: `0vdFsTyia3di70080j9KG1vccLN2`

### **4. Edite Custom Claims**
1. Clique no usuário encontrado
2. Procure pela seção **"Custom Claims"**
3. Clique em **"Edit"** ou **"Set custom claims"**

### **5. Adicione o JSON de Admin**
Cole exatamente este JSON:

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

### **6. Salvar e Aplicar**
1. Clique em **"Save"** ou **"Apply"**
2. Aguarde a confirmação

### **7. Logout e Login**
1. 🚪 **Faça LOGOUT** do sistema: https://curva-mestra.web.app
2. 🔑 **Faça LOGIN** novamente com sua conta
3. ✅ **Verifique** se agora tem acesso de Admin

## 🎯 **VERIFICAÇÃO**

Após fazer login, abra o console do navegador (F12) e execute:

```javascript
firebase.auth().currentUser.getIdTokenResult()
  .then(result => {
    console.log('Role:', result.claims.role); // Deve ser 'admin'
    console.log('Is Admin:', result.claims.isAdmin); // Deve ser true
    console.log('Permissions:', result.claims.permissions); // Array com permissões
  });
```

## ✅ **RESULTADO ESPERADO**

Após o upgrade, você terá:
- 👑 **Role**: admin
- 🔐 **Acesso Total** ao sistema
- 📊 **Painel Administrativo** completo
- 👥 **Gestão de Usuários**
- 📈 **Relatórios Avançados**
- ⚙️ **Configurações do Sistema**

## 🆘 **SUPORTE**

Se tiver problemas:
1. Verifique se o JSON foi colado corretamente
2. Certifique-se de que salvou as alterações
3. Faça logout/login completo
4. Limpe o cache do navegador se necessário

---

**🎉 Após seguir estes passos, você será um administrador completo do sistema!**