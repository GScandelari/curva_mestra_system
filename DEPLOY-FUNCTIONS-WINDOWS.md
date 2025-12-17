# 🚀 Deploy de Firebase Functions - Windows

## 📋 Pré-requisitos

- ✅ Firebase CLI instalado (`npm install -g firebase-tools`)
- ✅ Autenticado no Firebase (`firebase login`)
- ✅ Node.js 20 ou superior instalado

---

## 🔧 Passos para Deploy

### 1️⃣ Abrir PowerShell como Administrador

```powershell
# Navegar até a pasta do projeto
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
```

### 2️⃣ Limpar Cache (se houver problemas)

```powershell
# Limpar cache do Firebase CLI
firebase logout
firebase login

# Limpar build anterior
Remove-Item -Recurse -Force .\functions\lib -ErrorAction SilentlyContinue
```

### 3️⃣ Build das Functions

```powershell
# Compilar TypeScript
cd functions
npm run build
cd ..
```

### 4️⃣ Deploy das Functions

```powershell
# Deploy apenas das functions
firebase deploy --only functions
```

---

## ⚠️ Solução de Problemas

### Erro: "User code failed to load. Timeout after 10000"

Este erro geralmente ocorre quando o Firebase CLI tenta analisar o código localmente e encontra algum problema.

**Soluções:**

#### Solução 1: Reiniciar e Tentar Novamente
```powershell
# 1. Fechar TODOS os terminais
# 2. Abrir novo PowerShell como Admin
# 3. Tentar novamente
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
firebase deploy --only functions
```

#### Solução 2: Limpar Tudo e Reinstalar
```powershell
# 1. Deletar node_modules das functions
Remove-Item -Recurse -Force .\functions\node_modules
Remove-Item -Recurse -Force .\functions\lib

# 2. Reinstalar dependências
cd functions
npm install
npm run build
cd ..

# 3. Tentar deploy
firebase deploy --only functions
```

#### Solução 3: Usar WSL (Windows Subsystem for Linux)
```bash
# No terminal WSL
cd /mnt/c/Users/scand/OneDrive/Área\ de\ Trabalho/Curva\ Mestra/curva_mestra
npm run build --prefix functions
firebase deploy --only functions
```

#### Solução 4: Deploy Individual das Funções
```powershell
# Deploy apenas da função placeholder
firebase deploy --only functions:placeholder

# Deploy apenas da função checkLicenseExpiration
firebase deploy --only functions:checkLicenseExpiration
```

---

## 📊 Verificar Functions Deployadas

```powershell
# Listar todas as functions no Firebase
firebase functions:list
```

**Resultado Esperado:**
```
┌────────────────────────┬─────────┬───────────┬─────────────────────┬────────┬──────────┐
│ Function               │ Version │ Trigger   │ Location            │ Memory │ Runtime  │
├────────────────────────┼─────────┼───────────┼─────────────────────┼────────┼──────────┤
│ checkLicenseExpiration │ v2      │ scheduled │ southamerica-east1  │ 512    │ nodejs20 │
├────────────────────────┼─────────┼───────────┼─────────────────────┼────────┼──────────┤
│ placeholder            │ v2      │ https     │ southamerica-east1  │ 256    │ nodejs20 │
└────────────────────────┴─────────┴───────────┴─────────────────────┴────────┴──────────┘
```

---

## 🗑️ Deletar Funções Antigas (Já Executado)

As seguintes funções já foram deletadas:

### ✅ Deletadas com Sucesso:
- `checkExpiringProducts` (us-central1)
- `cleanupOldNotifications` (us-central1)
- `updateDashboardMetrics` (us-central1)
- `api` (us-central1)
- `onTenantCreated` (southamerica-east1)
- `onUserCreated` (southamerica-east1)
- `sendTestEmail` (southamerica-east1)
- `ssrcurvamestra` (us-central1)
- `checkLicenseExpiration` (us-central1) - versão antiga
- `placeholder` (us-central1) - versão antiga

### 🎯 Funções Atuais (Devem Estar em southamerica-east1):
- `checkLicenseExpiration` - Verifica licenças expiradas diariamente às 00:00
- `placeholder` - Função de teste/placeholder

---

## 📝 Estrutura do Código

### Arquivo: `functions/src/index.ts`
```typescript
// Function placeholder
import {onRequest} from "firebase-functions/v2/https";

export const placeholder = onRequest(
  {region: "southamerica-east1"},
  (req, res) => {
    res.json({message: "Firebase Functions configuradas com sucesso"});
  }
);

// Scheduled Functions - Licenças
// export { checkLicenseExpiration } from "./checkLicenseExpiration";
```

### Arquivo: `functions/src/checkLicenseExpiration.ts`
- ✅ Região configurada: `southamerica-east1`
- ✅ Schedule: Diariamente às 00:00 (America/Sao_Paulo)
- ✅ Timeout: 540 segundos
- ✅ Memory: 512MiB

---

## 🔐 Variáveis de Ambiente

As functions utilizam Firebase Admin SDK que é configurado automaticamente pelo Firebase.

**Não é necessário configurar:**
- ❌ GOOGLE_APPLICATION_CREDENTIALS (auto configurado)
- ❌ Project ID (auto configurado)
- ❌ Database URL (auto configurado)

---

## 🎯 Comandos Úteis

### Ver logs das functions
```powershell
# Logs em tempo real
firebase functions:log

# Logs de uma função específica
firebase functions:log --only checkLicenseExpiration
```

### Testar function localmente
```powershell
# Iniciar emuladores
firebase emulators:start --only functions

# Em outro terminal, testar
curl http://localhost:5001/curva-mestra/southamerica-east1/placeholder
```

### Deploy de produção
```powershell
# Deploy apenas functions
firebase deploy --only functions

# Deploy completo (hosting + functions + firestore rules)
firebase deploy
```

---

## ⏰ Agendamento Atual

### checkLicenseExpiration
- **Frequência:** Diária
- **Horário:** 00:00 (meia-noite)
- **Timezone:** America/Sao_Paulo (Brasília)
- **Ação:** Verifica licenças expiradas e envia notificações

**Cron Expression:** `0 0 * * *`

---

## 📞 Suporte

Se continuar com problemas:

1. **Verificar status do Firebase:**
   - https://status.firebase.google.com/

2. **Verificar quota de functions:**
   - https://console.firebase.google.com/project/curva-mestra/functions

3. **Documentação oficial:**
   - https://firebase.google.com/docs/functions/tips#avoid_deployment_timeouts_during_initialization

---

## ✅ Checklist Pré-Deploy

- [ ] Código compilando sem erros (`npm run build --prefix functions`)
- [ ] Autenticado no Firebase CLI (`firebase login`)
- [ ] Projeto correto selecionado (`firebase use curva-mestra`)
- [ ] Região correta configurada (`southamerica-east1`)
- [ ] Node modules instalados (`cd functions && npm install`)

---

**Última Atualização:** 2025-11-29
**Versão do Node.js:** 20.x
**Versão do Firebase Functions:** v2 (2nd Gen)
