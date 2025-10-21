# 🔑 INSTRUÇÕES PARA SE TORNAR ADMIN

## 📋 **MÉTODO MANUAL (Mais Confiável)**

Como você não consegue acessar o Firebase Console, vou te dar uma alternativa:

### **🌐 Acesso ao Firebase Console:**

1. **Acesse**: https://console.firebase.google.com/project/curva-mestra
2. **Faça login** com sua conta Google (a mesma que tem acesso ao projeto)
3. **Navegue**: Authentication → Users
4. **Encontre seu usuário**: scandelari.guilherme@hotmail.com
5. **Clique no usuário**
6. **Aba "Custom Claims"**
7. **Adicione este JSON**:

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

8. **Clique "Save"**
9. **Faça logout** do sistema: https://curva-mestra.web.app
10. **Faça login novamente**
11. ✅ **Agora você será Admin!**

---

## 🔧 **MÉTODO ALTERNATIVO (Via Código)**

Se você conseguir acessar o console do navegador:

### **Passo 1: Acesse o Sistema**
1. Vá para: https://curva-mestra.web.app
2. Faça login normalmente
3. Abra o console do navegador (F12)

### **Passo 2: Execute este Código**
```javascript
// Obter o token atual
firebase.auth().currentUser.getIdToken(true)
  .then(token => {
    console.log('Token atual:', token);
    
    // Mostrar claims atuais
    return firebase.auth().currentUser.getIdTokenResult();
  })
  .then(result => {
    console.log('Claims atuais:', result.claims);
    console.log('Role atual:', result.claims.role);
    console.log('Is Admin:', result.claims.isAdmin);
  });
```

---

## 🚨 **SE NADA FUNCIONAR**

### **Opção 1: Criar Nova Conta Admin**
1. Crie uma nova conta no sistema
2. Me informe o email da nova conta
3. Eu configuro ela como admin
4. Use a nova conta para gerenciar o sistema

### **Opção 2: Usar Emulador Local**
1. Execute: `firebase emulators:start --only auth`
2. Use o emulador para testar funcionalidades admin
3. Configure as claims localmente

---

## ✅ **VERIFICAÇÃO**

### **Como Saber se Funcionou:**

1. **No Sistema**: Você verá opções de Admin no menu
2. **No Console (F12)**:
```javascript
firebase.auth().currentUser.getIdTokenResult()
  .then(result => {
    console.log('Role:', result.claims.role); // Deve ser 'admin'
    console.log('Is Admin:', result.claims.isAdmin); // Deve ser true
  });
```

---

## 📞 **PRECISA DE AJUDA?**

Se você não conseguir acessar o Firebase Console:

1. **Verifique se está logado** com a conta correta do Google
2. **Confirme se tem acesso** ao projeto 'curva-mestra'
3. **Tente acessar** em modo anônimo/incógnito
4. **Me informe** se há alguma mensagem de erro específica

---

## 🎯 **RESULTADO ESPERADO**

Após seguir qualquer método:
- ✅ Role: admin
- ✅ isAdmin: true
- ✅ Acesso total ao sistema
- ✅ Painel de administração disponível

**Qual método você prefere tentar? 🤔**