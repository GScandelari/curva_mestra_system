# 🔧 SOLUÇÃO: Custom Claims via CLI

## 📋 PROBLEMA IDENTIFICADO
A interface web do Firebase Console não mostra a opção "Custom Claims" para todos os usuários. Vamos resolver via linha de comando.

## 🛠️ SOLUÇÃO 1: Google Cloud CLI (Recomendado)

### **1. Instalar Google Cloud CLI**

**Windows:**
```powershell
# Baixar e instalar o Google Cloud CLI
# Acesse: https://cloud.google.com/sdk/docs/install-windows
# OU use o PowerShell:
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe
```

### **2. Autenticar e Configurar**
```bash
# Fazer login
gcloud auth login

# Definir projeto
gcloud config set project curva-mestra

# Autenticar para Application Default Credentials
gcloud auth application-default login
```

### **3. Aplicar Custom Claims**
```bash
# Comando para definir custom claims
gcloud functions call setCustomUserClaims --data '{
  "uid": "0vdFsTyia3di70080j9KG1vccLN2",
  "customClaims": {
    "role": "admin",
    "isAdmin": true,
    "clinicId": "default-clinic",
    "permissions": [
      "view_products", "manage_products", "view_requests", "approve_requests",
      "view_patients", "manage_patients", "view_invoices", "manage_invoices",
      "view_reports", "manage_users", "view_analytics", "manage_settings"
    ]
  }
}'
```

## 🛠️ SOLUÇÃO 2: Node.js Script Direto

### **1. Instalar dependências globais**
```bash
npm install -g firebase-admin
```

### **2. Configurar credenciais**
```bash
# Gerar service account key
gcloud iam service-accounts keys create service-account-key.json --iam-account=firebase-adminsdk-xxxxx@curva-mestra.iam.gserviceaccount.com

# OU baixar manualmente do Console:
# https://console.cloud.google.com/iam-admin/serviceaccounts?project=curva-mestra
```

### **3. Script Node.js**
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'curva-mestra'
});

const uid = '0vdFsTyia3di70080j9KG1vccLN2';
const customClaims = {
  role: 'admin',
  isAdmin: true,
  clinicId: 'default-clinic',
  permissions: [
    'view_products', 'manage_products', 'view_requests', 'approve_requests',
    'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
    'view_reports', 'manage_users', 'view_analytics', 'manage_settings'
  ]
};

admin.auth().setCustomUserClaims(uid, customClaims)
  .then(() => {
    console.log('✅ Custom claims aplicados com sucesso!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
```

## 🛠️ SOLUÇÃO 3: Firebase Functions (Mais Simples)

### **1. Criar função temporária**
```javascript
// functions/src/admin-upgrade.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.upgradeToAdmin = functions.https.onCall(async (data, context) => {
  // Verificar se é o usuário correto
  if (context.auth.uid !== '0vdFsTyia3di70080j9KG1vccLN2') {
    throw new functions.https.HttpsError('permission-denied', 'Não autorizado');
  }
  
  const customClaims = {
    role: 'admin',
    isAdmin: true,
    clinicId: 'default-clinic',
    permissions: [
      'view_products', 'manage_products', 'view_requests', 'approve_requests',
      'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
      'view_reports', 'manage_users', 'view_analytics', 'manage_settings'
    ]
  };
  
  await admin.auth().setCustomUserClaims(context.auth.uid, customClaims);
  
  return { success: true, message: 'Upgrade realizado com sucesso!' };
});
```

### **2. Deploy e chamar**
```bash
firebase deploy --only functions:upgradeToAdmin
```

### **3. Chamar do frontend**
```javascript
// No seu app web
const upgradeToAdmin = firebase.functions().httpsCallable('upgradeToAdmin');
upgradeToAdmin().then(result => {
  console.log('✅ Upgrade realizado:', result.data);
  // Fazer logout/login
});
```

## 🎯 QUAL SOLUÇÃO USAR?

1. **Mais Rápida**: Solução 3 (Firebase Functions)
2. **Mais Robusta**: Solução 1 (Google Cloud CLI)
3. **Mais Flexível**: Solução 2 (Node.js Script)

## 📞 PRÓXIMOS PASSOS

Escolha uma das soluções acima. Recomendo começar com a **Solução 3** por ser mais simples e usar a infraestrutura que já temos configurada.

Qual solução você prefere implementar?