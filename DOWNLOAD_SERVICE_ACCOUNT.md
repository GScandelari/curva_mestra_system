# 🔑 BAIXAR SERVICE ACCOUNT KEY - SOLUÇÃO RÁPIDA

## 📋 PASSO A PASSO (5 MINUTOS)

### **1. Acessar Google Cloud Console**
🌐 **URL**: https://console.cloud.google.com/iam-admin/serviceaccounts?project=curva-mestra

### **2. Encontrar Service Account do Firebase**
- Procure por um service account com nome similar a:
  - `firebase-adminsdk-xxxxx@curva-mestra.iam.gserviceaccount.com`
  - OU `Firebase Admin SDK Service Agent`

### **3. Baixar Chave JSON**
1. Clique nos **3 pontos** (⋮) ao lado do service account
2. Selecione **"Manage keys"**
3. Clique **"Add Key"** → **"Create new key"**
4. Escolha **"JSON"**
5. Clique **"Create"**
6. O arquivo será baixado automaticamente

### **4. Mover Arquivo para o Projeto**
```powershell
# Mova o arquivo baixado para o diretório do projeto
# Renomeie para: service-account-key.json
move "C:\Users\SeuUsuario\Downloads\curva-mestra-xxxxx.json" "C:\Dev_projects\curva_mestra_system\service-account-key.json"
```

### **5. Configurar Variável de Ambiente**
```powershell
# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Dev_projects\curva_mestra_system\service-account-key.json"

# OU Windows CMD
set GOOGLE_APPLICATION_CREDENTIALS=C:\Dev_projects\curva_mestra_system\service-account-key.json
```

### **6. Executar o Upgrade**
```bash
cd C:\Dev_projects\curva_mestra_system\functions
node ../upgrade-final.js
```

## 🎯 **RESULTADO ESPERADO**

Você deve ver:
```
🚀 Iniciando upgrade final para admin...
🔄 UPGRADE FINAL: Recepcionista → Admin
✅ Método 1 funcionou!
🔧 Aplicando custom claims...
✅ Custom claims aplicados com sucesso!

🎉 UPGRADE REALIZADO COM SUCESSO!
📧 Email: scandelari.guilherme@hotmail.com
🔑 Role: admin
👑 Is Admin: true
🏥 Clinic ID: default-clinic
📊 Permissões: 12

🔄 PRÓXIMOS PASSOS:
1. 🚪 Faça LOGOUT do sistema
2. 🔑 Faça LOGIN novamente
3. 🌐 Acesse: https://curva-mestra.web.app
4. ✅ Verifique acesso de Admin!

🎯 ✅ UPGRADE CONCLUÍDO COM SUCESSO!
```

## 🔒 **SEGURANÇA**

⚠️ **IMPORTANTE**: 
- O arquivo `service-account-key.json` contém credenciais sensíveis
- Não compartilhe este arquivo
- Adicione ao `.gitignore` se necessário

## 🚀 **ALTERNATIVA AINDA MAIS RÁPIDA**

Se não conseguir baixar o service account, posso criar um script que usa uma abordagem diferente. Mas esta é a forma mais confiável!

---

**Siga estes passos e em 5 minutos você será admin! 🎯**