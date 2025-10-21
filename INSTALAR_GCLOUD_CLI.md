# 🛠️ INSTALAR GOOGLE CLOUD CLI - SOLUÇÃO DEFINITIVA

## 📋 PASSO A PASSO PARA WINDOWS

### **1. Baixar e Instalar Google Cloud CLI**

**Opção A - Download Direto:**
1. Acesse: https://cloud.google.com/sdk/docs/install-windows
2. Baixe o instalador: `GoogleCloudSDKInstaller.exe`
3. Execute o instalador
4. Siga as instruções na tela

**Opção B - PowerShell (Automático):**
```powershell
# Execute no PowerShell como Administrador
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe
```

### **2. Configurar após instalação**

**Abra um novo terminal/PowerShell e execute:**

```bash
# 1. Fazer login no Google Cloud
gcloud auth login

# 2. Definir o projeto
gcloud config set project curva-mestra

# 3. Configurar credenciais para aplicações
gcloud auth application-default login

# 4. Verificar configuração
gcloud config list
```

### **3. Executar o upgrade**

```bash
# Voltar para o diretório do projeto
cd C:\Dev_projects\curva_mestra_system

# Executar o script de upgrade
node upgrade-admin-direct.js
```

## 🎯 **RESULTADO ESPERADO**

Após executar `node upgrade-admin-direct.js`, você deve ver:

```
🚀 Iniciando processo de upgrade para admin...
🔄 UPGRADE DIRETO: Recepcionista → Admin
👤 Email: scandelari.guilherme@hotmail.com
🆔 UID: 0vdFsTyia3di70080j9KG1vccLN2
✅ Firebase inicializado com credenciais padrão

🔧 Aplicando custom claims...
✅ Custom claims aplicados com sucesso!

🎉 UPGRADE REALIZADO COM SUCESSO!
📧 Email: scandelari.guilherme@hotmail.com
🆔 UID: 0vdFsTyia3di70080j9KG1vccLN2
🔑 Role: admin
👑 Is Admin: true
🏥 Clinic ID: default-clinic
📊 Permissões: 12

🔄 PRÓXIMOS PASSOS:
1. 🚪 Faça LOGOUT do sistema
2. 🔑 Faça LOGIN novamente
3. 🌐 Acesse: https://curva-mestra.web.app
4. ✅ Verifique acesso de Admin!

🎯 ✅ PROCESSO CONCLUÍDO COM SUCESSO!
```

## ⚡ **ALTERNATIVA RÁPIDA - SERVICE ACCOUNT**

Se não quiser instalar o gcloud CLI, pode usar service account:

### **1. Baixar Service Account Key**
1. Acesse: https://console.cloud.google.com/iam-admin/serviceaccounts?project=curva-mestra
2. Encontre o service account do Firebase Admin SDK
3. Clique nos 3 pontos → "Manage keys"
4. "Add Key" → "Create new key" → JSON
5. Baixe o arquivo como `service-account-key.json`

### **2. Configurar variável de ambiente**
```powershell
# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Dev_projects\curva_mestra_system\service-account-key.json"

# OU Windows CMD
set GOOGLE_APPLICATION_CREDENTIALS=C:\Dev_projects\curva_mestra_system\service-account-key.json
```

### **3. Executar o script**
```bash
node upgrade-admin-direct.js
```

## 🎯 **QUAL MÉTODO USAR?**

- **Mais Permanente**: Google Cloud CLI (Solução 1)
- **Mais Rápido**: Service Account Key (Alternativa)

**Recomendo o Google Cloud CLI por ser mais seguro e permanente.**

---

**Escolha um dos métodos acima e execute. O upgrade será feito em menos de 2 minutos! 🚀**