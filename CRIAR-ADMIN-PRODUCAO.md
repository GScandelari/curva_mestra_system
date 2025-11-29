# Criar System Admin em Produção

## 📋 Pré-requisitos

Para criar o system_admin em produção, você precisa autenticar o Firebase Admin SDK.

### Opção 1: Usar Application Default Credentials (Recomendado)

Se você já está autenticado com Firebase CLI, pode usar diretamente:

```bash
# No terminal Windows (PowerShell ou CMD)
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
node scripts/create-system-admin-production.js
```

### Opção 2: Usar Service Account Key (Mais seguro)

1. **Baixar Service Account Key:**
   - Acesse: https://console.firebase.google.com/project/curva-mestra/settings/serviceaccounts/adminsdk
   - Clique em "Generate new private key"
   - Salve o arquivo como `serviceAccountKey.json` na raiz do projeto

2. **Configurar variável de ambiente:**

   **No PowerShell:**
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra\serviceAccountKey.json"
   node scripts/create-system-admin-production.js
   ```

   **No CMD:**
   ```cmd
   set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra\serviceAccountKey.json
   node scripts/create-system-admin-production.js
   ```

## 🚀 Executar o Script

### Comando Simples (Tente este primeiro)

```bash
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
node scripts/create-system-admin-production.js
```

### Se der erro de autenticação

Execute o login do Firebase primeiro:

```bash
firebase login
node scripts/create-system-admin-production.js
```

## 📝 O que o script faz

O script `create-system-admin-production.js` vai:

1. ✅ Conectar ao Firebase Authentication de **PRODUÇÃO**
2. ✅ Verificar se o usuário já existe
3. ✅ Criar o usuário (se não existir) com:
   - **Email:** scandelari.guilherme@curvamestra.com.br
   - **Senha:** Admin@123
   - **Nome:** Guilherme Scandelari
   - **Email verificado:** Sim
4. ✅ Configurar custom claims:
   - `is_system_admin: true`
   - `role: system_admin`
   - `active: true`

## 🔐 Credenciais do System Admin

Após executar o script, você terá:

```
Email: scandelari.guilherme@curvamestra.com.br
Senha: Admin@123
```

**⚠️ IMPORTANTE:**
- Salve estas credenciais em local seguro
- Altere a senha após o primeiro login
- Este usuário tem acesso TOTAL ao sistema

## 🌐 Próximos Passos

1. **Testar login em produção:**
   - Acesse: https://curva-mestra.web.app/login
   - Faça login com as credenciais acima

2. **Verificar no Firebase Console:**
   - Acesse: https://console.firebase.google.com/project/curva-mestra/authentication/users
   - Confirme que o usuário foi criado
   - Clique no usuário e veja os "Custom claims"

3. **Alterar senha (Recomendado):**
   - Faça login no sistema
   - Vá em Perfil
   - Altere a senha

## ❓ Troubleshooting

### Erro: "auth/project-not-found"

**Solução:** Configure as credenciais do Firebase Admin SDK

```bash
firebase login
```

Ou baixe o Service Account Key e configure GOOGLE_APPLICATION_CREDENTIALS

### Erro: "Permission denied"

**Solução:** Você não tem permissões suficientes. Certifique-se de que está autenticado como owner do projeto Firebase.

```bash
firebase login --reauth
```

### Erro: "Module not found: firebase-admin"

**Solução:** Instale as dependências:

```bash
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
npm install firebase-admin
node scripts/create-system-admin-production.js
```

### Script não encontra emuladores (erro de timeout)

**Isso é NORMAL!** O script está configurado para produção, não emuladores. Se você ver mensagens sobre emuladores, ignore-as.

## 📂 Arquivo de Service Account Key

**⚠️ ATENÇÃO:** Se você baixar o `serviceAccountKey.json`:

1. **NUNCA** commite este arquivo no Git
2. O arquivo já está no `.gitignore`
3. Mantenha em local seguro
4. Delete após usar (se preferir usar Application Default Credentials)

## ✅ Verificação

Após executar o script, você deve ver uma mensagem como:

```
✅ SYSTEM ADMIN CRIADO COM SUCESSO!

👑 CREDENCIAIS DO SYSTEM ADMIN:

   Email: scandelari.guilherme@curvamestra.com.br
   Senha: Admin@123
   UID: [UID gerado]
   Nome: Guilherme Scandelari

📋 CUSTOM CLAIMS:
   is_system_admin: true
   role: system_admin
   active: true

🌐 Acesse: https://curva-mestra.web.app/login
```

## 🔄 Executar novamente

Se executar o script novamente:
- O script detecta que o usuário já existe
- Atualiza os custom claims (caso tenham sido alterados)
- **NÃO** altera a senha

Isso é seguro e pode ser usado para "resetar" os custom claims se necessário.
