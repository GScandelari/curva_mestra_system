# 🚀 Deploy Firebase Functions - Windows PowerShell

**Problema:** Deploy travando no WSL com timeout
**Solução:** Tentar deploy diretamente no Windows PowerShell

---

## 📋 Pré-requisitos

Certifique-se de ter instalado no Windows (não no WSL):
- ✅ Node.js 20.x ([nodejs.org](https://nodejs.org))
- ✅ Firebase CLI (`npm install -g firebase-tools`)

---

## 🔧 Passo a Passo

### 1. Abrir PowerShell como Administrador

- Pressione `Win + X`
- Selecione "Windows PowerShell (Admin)" ou "Terminal (Admin)"

### 2. Navegar até o Projeto

```powershell
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
```

### 3. Verificar Node.js e Firebase CLI

```powershell
# Verificar versão do Node.js (deve ser 20.x)
node --version

# Verificar versão do Firebase CLI
firebase --version

# Se não tiver Firebase CLI instalado:
npm install -g firebase-tools
```

### 4. Fazer Login no Firebase (se necessário)

```powershell
firebase login
```

Isso abrirá o navegador para autenticação.

### 5. Verificar Projeto Atual

```powershell
firebase projects:list
firebase use curva-mestra
```

### 6. Navegar para Functions e Rebuild

```powershell
cd functions
npm install
npm run build
```

**Importante:** Verifique se o build completou sem erros.

### 7. Voltar para Raiz e Fazer Deploy

```powershell
cd ..
firebase deploy --only functions
```

---

## 🎯 Comandos Completos (Copy/Paste)

```powershell
# Navegar até o projeto
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"

# Verificar ambiente
node --version
firebase --version

# Rebuild functions
cd functions
npm run build
cd ..

# Deploy
firebase deploy --only functions
```

---

## ⏱️ Tempo Esperado

- **Análise de código:** 30-60 segundos
- **Upload:** 1-2 minutos
- **Deploy completo:** 3-5 minutos

Se travar por mais de 2 minutos em "Loading and analyzing source code", ainda há problema.

---

## 🐛 Se Ainda Der Timeout

### Opção A: Deploy Incremental

Deploy função por função:

```powershell
# Deploy apenas placeholder
firebase deploy --only functions:placeholder

# Deploy apenas onUserCreated
firebase deploy --only functions:onUserCreated

# Deploy apenas sendTempPasswordEmail
firebase deploy --only functions:sendTempPasswordEmail

# E assim por diante...
```

### Opção B: Limpar Cache

```powershell
# Limpar cache do Firebase
firebase --clear-cache

# Deletar node_modules e reinstalar
cd functions
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run build
cd ..

# Tentar deploy novamente
firebase deploy --only functions
```

### Opção C: Atualizar Firebase CLI

```powershell
npm uninstall -g firebase-tools
npm install -g firebase-tools@latest
firebase --version
```

---

## 📊 Checklist de Troubleshooting

Antes de reportar erro, verifique:

- [ ] Node.js versão 20.x no Windows (não WSL)
- [ ] Firebase CLI instalado globalmente no Windows
- [ ] Login no Firebase feito (`firebase login`)
- [ ] Projeto correto selecionado (`firebase use curva-mestra`)
- [ ] Build sem erros (`npm run build` na pasta functions)
- [ ] Secrets configurados (`firebase functions:secrets:access SMTP_USER`)
- [ ] Internet estável (deploy precisa subir ~140KB)

---

## 🔑 Verificar Secrets (Opcional)

```powershell
# Listar secrets
firebase functions:secrets:access SMTP_USER
firebase functions:secrets:access SMTP_PASS
```

Se precisar reconfigurar:

```powershell
firebase functions:secrets:set SMTP_USER
# Digite: scandelari.guilherme@curvamestra.com.br

firebase functions:secrets:set SMTP_PASS
# Digite: $I64796479z
```

---

## 📝 Log de Deploy

Anote o que acontece:

```
[ ] Iniciou deploy
[ ] "Loading and analyzing source code" - quanto tempo levou?
[ ] "Preparing codebase" - completou?
[ ] "Uploading" - completou?
[ ] "Deploy complete" - sucesso?
```

Se der erro, copie a mensagem de erro completa.

---

## ✅ Resultado Esperado

```
✔ Deploy complete!

Functions deployed:
- placeholder(southamerica-east1)
- onUserCreated(southamerica-east1)
- onTenantCreated(southamerica-east1)
- sendTempPasswordEmail(southamerica-east1)
- sendAccessRejectionEmail(southamerica-east1)
```

---

## 🆘 Se Continuar com Problemas

1. **Copie o output completo do erro**
2. **Tire screenshot da mensagem de erro**
3. **Anote em qual etapa travou**
4. **Verifique se há firewall/antivírus bloqueando**

Me envie essas informações para investigarmos mais.

---

**Criado:** 23/01/2026
**Autor:** Claude Code (Anthropic)
