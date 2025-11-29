# ⚡ EXECUTAR AGORA - Criar System Admin em Produção

## 🎯 Comando para Executar no Terminal Windows

Abra o **PowerShell** ou **CMD** e execute:

```bash
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
firebase login
node scripts/create-system-admin-production.js
```

Se o comando acima não funcionar, use este:

```bash
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
set GOOGLE_APPLICATION_CREDENTIALS=%CD%\serviceAccountKey.json
node scripts/create-system-admin-production.js
```

## 📝 Mas antes, você precisa:

### Opção 1: Login do Firebase (MAIS FÁCIL)

```bash
firebase login
```

Isso vai abrir o navegador para você fazer login. Depois execute:

```bash
node scripts/create-system-admin-production.js
```

### Opção 2: Service Account Key (SE OPÇÃO 1 FALHAR)

1. **Baixar o arquivo:**
   - Acesse: https://console.firebase.google.com/project/curva-mestra/settings/serviceaccounts/adminsdk
   - Clique em "Generate new private key"
   - Salve como `serviceAccountKey.json` na pasta do projeto

2. **Executar:**

   **PowerShell:**
   ```powershell
   cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
   $env:GOOGLE_APPLICATION_CREDENTIALS = "$PWD\serviceAccountKey.json"
   node scripts/create-system-admin-production.js
   ```

   **CMD:**
   ```cmd
   cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
   set GOOGLE_APPLICATION_CREDENTIALS=%CD%\serviceAccountKey.json
   node scripts/create-system-admin-production.js
   ```

## ✅ O que você vai ver

Se tudo funcionar, você verá:

```
════════════════════════════════════════════════
  CRIAR SYSTEM ADMIN - FIREBASE PRODUÇÃO
  Projeto: curva-mestra
════════════════════════════════════════════════

🚀 Criando System Admin em PRODUÇÃO...

⚠️  ATENÇÃO: Este script vai criar o usuário no Firebase de PRODUÇÃO!

1️⃣ Criando usuário no Firebase Authentication...
   ✓ Usuário criado com sucesso!
   UID: [gerado automaticamente]
   Email: scandelari.guilherme@curvamestra.com.br

2️⃣ Configurando custom claims...
   ✓ Custom claims configurados

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SYSTEM ADMIN CRIADO COM SUCESSO!

👑 CREDENCIAIS DO SYSTEM ADMIN:

   Email: scandelari.guilherme@curvamestra.com.br
   Senha: Admin@123
   UID: [gerado]
   Nome: Guilherme Scandelari
```

## 🔐 Credenciais Criadas

```
Email: scandelari.guilherme@curvamestra.com.br
Senha: Admin@123
```

## 🌐 Testar Login

Após criar, teste em:
- **Produção:** https://curva-mestra.web.app/login

## 📋 Resumo dos Comandos (copie e cole)

### OPÇÃO MAIS SIMPLES:

```bash
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
firebase login
node scripts/create-system-admin-production.js
```

## ⚠️ Se der erro

1. **"firebase not found":**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **"Module not found: firebase-admin":**
   ```bash
   npm install
   ```

3. **"Could not load credentials":**
   - Use a Opção 2 (Service Account Key)
   - Ou execute: `firebase login --reauth`
