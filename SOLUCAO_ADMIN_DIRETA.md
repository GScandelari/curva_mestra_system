# 🔑 SOLUÇÃO DIRETA PARA SE TORNAR ADMIN

## 🎯 **INFORMAÇÕES DA SUA CONTA**

- **Email**: scandelari.guilherme@hotmail.com
- **UID**: 0vdFsTyia3di70080j9KG1vccLN2
- **Status Atual**: Recepcionista
- **Status Desejado**: Admin

---

## 🚀 **MÉTODO DIRETO (Execute Agora)**

### **Passo 1: Acesse o Firebase Console**

**URL DIRETA**: https://console.firebase.google.com/project/curva-mestra/authentication/users

### **Passo 2: Encontre Seu Usuário**
- Procure por: **scandelari.guilherme@hotmail.com**
- Ou procure pelo UID: **0vdFsTyia3di70080j9KG1vccLN2**

### **Passo 3: Adicione Custom Claims**
1. **Clique no seu usuário**
2. **Aba "Custom Claims"**
3. **Cole este JSON exato**:

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

4. **Clique "Save"**

### **Passo 4: Aplicar Mudanças**
1. **Acesse**: https://curva-mestra.web.app
2. **Faça logout** da sua conta
3. **Faça login novamente**
4. ✅ **Agora você será Admin!**

---

## 🔍 **VERIFICAÇÃO**

### **No Console do Navegador (F12):**
```javascript
firebase.auth().currentUser.getIdTokenResult()
  .then(result => {
    console.log('✅ Role:', result.claims.role);
    console.log('✅ Is Admin:', result.claims.isAdmin);
    console.log('✅ Permissions:', result.claims.permissions);
  });
```

### **No Sistema:**
- ✅ Menu com opções de Admin
- ✅ Acesso ao painel administrativo
- ✅ Gestão de usuários
- ✅ Relatórios avançados

---

## 🆘 **SE NÃO CONSEGUIR ACESSAR O CONSOLE**

### **Possíveis Problemas:**

1. **Não tem acesso ao projeto**:
   - Verifique se está logado com a conta correta
   - Confirme se tem permissão no projeto 'curva-mestra'

2. **Erro de permissão**:
   - Tente acessar em modo anônimo/incógnito
   - Limpe cache do navegador

3. **Projeto não encontrado**:
   - Confirme se o projeto existe
   - Verifique se o nome está correto

### **ALTERNATIVA: Me Dê Acesso Temporário**

Se você não conseguir acessar:

1. **Adicione minha conta** como colaborador no projeto
2. **Eu configuro** sua conta como admin
3. **Removo meu acesso** depois

---

## 📞 **PRÓXIMOS PASSOS**

1. **Tente acessar**: https://console.firebase.google.com/project/curva-mestra/authentication/users
2. **Se conseguir**: Siga os passos acima
3. **Se não conseguir**: Me informe qual erro aparece
4. **Depois**: Teste o sistema como admin

---

## ✅ **RESULTADO ESPERADO**

Após configurar:
- ✅ **Role**: admin
- ✅ **Acesso**: Total ao sistema
- ✅ **Permissões**: Todas as funcionalidades
- ✅ **Painel**: Administração completa

**Tente acessar o console agora! 🎯**