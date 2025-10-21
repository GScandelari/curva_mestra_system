# 🎯 UPGRADE PARA ADMIN - PASSO A PASSO VISUAL

## 📋 SITUAÇÃO ATUAL
Todos os scripts estão funcionando perfeitamente, mas precisamos de credenciais do Google Cloud. A **solução mais rápida** é fazer o upgrade manualmente via Firebase Console.

## 🚀 MÉTODO MAIS RÁPIDO (2 MINUTOS)

### **PASSO 1: Acessar Firebase Console**
🌐 **URL**: https://console.firebase.google.com/project/curva-mestra

### **PASSO 2: Navegar para Authentication**
1. No menu lateral esquerdo, clique em **"Authentication"**
2. Clique na aba **"Users"**

### **PASSO 3: Encontrar seu usuário**
- Procure por: **scandelari.guilherme@hotmail.com**
- UID: **0vdFsTyia3di70080j9KG1vccLN2**

### **PASSO 4: Verificar Custom Claims**
1. **Clique no usuário** encontrado
2. Procure por uma seção chamada **"Custom Claims"**

### **PASSO 5A: Se houver "Custom Claims"**
1. Clique em **"Edit"** ou **"Set custom claims"**
2. **Cole exatamente este JSON:**

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

3. Clique em **"Save"**
4. **Pule para o PASSO 6**

### **PASSO 5B: Se NÃO houver "Custom Claims"**
A opção "Custom Claims" não está disponível na interface web para todos os projetos. Neste caso, use uma das soluções automáticas:

**🔧 SOLUÇÃO AUTOMÁTICA RÁPIDA:**

1. **Baixar Service Account Key:**
   - Acesse: https://console.cloud.google.com/iam-admin/serviceaccounts?project=curva-mestra
   - Encontre o service account do Firebase Admin SDK
   - Clique nos 3 pontos → "Manage keys" → "Add Key" → "Create new key" → "JSON"
   - Baixe o arquivo como `service-account-key.json`

2. **Configurar e Executar:**
   ```powershell
   # No PowerShell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Dev_projects\curva_mestra_system\service-account-key.json"
   node quick-admin-upgrade.js
   ```

### **PASSO 6: Testar o Upgrade**
1. **Acesse**: https://curva-mestra.web.app
2. **Faça LOGOUT** da sua conta atual
3. **Faça LOGIN** novamente com: scandelari.guilherme@hotmail.com
4. **Verifique** se agora tem acesso de administrador

### **PASSO 7: Verificação (Opcional)**
No console do navegador (F12), execute:
```javascript
firebase.auth().currentUser.getIdTokenResult()
  .then(result => {
    console.log('Role:', result.claims.role); // Deve ser 'admin'
    console.log('Is Admin:', result.claims.isAdmin); // Deve ser true
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

## 🎯 **RESUMO**

1. **Acesse**: https://console.firebase.google.com/project/curva-mestra
2. **Authentication → Users → seu usuário**
3. **Se houver "Custom Claims"**: Cole o JSON e salve
4. **Se não houver**: Use a solução automática com service account
5. **Logout/Login** no sistema
6. **Aproveite** seu acesso de admin!

---

**🚀 Em 2 minutos você será administrador completo do sistema!**