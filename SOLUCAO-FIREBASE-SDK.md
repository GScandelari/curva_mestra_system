# 🔧 Solução: Failed to find location of Firebase Functions SDK

**Erro:** `Failed to find location of Firebase Functions SDK`

**Causa:** O Firebase CLI não está encontrando o módulo `firebase-functions` na pasta `functions/node_modules`

---

## ✅ Solução Rápida

Execute no **PowerShell** (como Administrador):

```powershell
# 1. Navegar até a pasta functions
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra\functions"

# 2. Deletar node_modules e package-lock.json
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# 3. Reinstalar dependências
npm install

# 4. Verificar se firebase-functions foi instalado
npm list firebase-functions

# 5. Rebuild TypeScript
npm run build

# 6. Voltar para raiz
cd ..

# 7. Tentar deploy novamente
firebase deploy --only functions
```

---

## 🔍 Verificações

### 1. Verificar se firebase-functions está instalado:

```powershell
cd functions
npm list firebase-functions
```

**Resultado esperado:**
```
curva-mestra-functions@1.0.0 C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra\functions
└── firebase-functions@7.0.3
```

### 2. Verificar se o arquivo main existe:

```powershell
Test-Path "lib\index.js"
```

**Resultado esperado:** `True`

### 3. Verificar package.json:

```powershell
cat package.json
```

Certifique-se de que tem:
```json
{
  "main": "lib/index.js",
  "dependencies": {
    "firebase-functions": "^7.0.3"
  }
}
```

---

## 🐛 Se Ainda Der Erro

### Opção A: Reinstalar Firebase CLI

```powershell
npm uninstall -g firebase-tools
npm cache clean --force
npm install -g firebase-tools@latest
firebase --version
```

### Opção B: Usar NPX (sem instalação global)

```powershell
# Voltar para raiz do projeto
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"

# Deploy usando npx
npx firebase-tools deploy --only functions
```

### Opção C: Verificar Node.js no Windows

```powershell
# Verificar versão do Node
node --version

# Deve ser 20.x ou 18.x (não 22.x)
```

Se estiver em versão diferente, baixe Node.js 20.x LTS em: https://nodejs.org

---

## 📋 Comandos Completos (Copy/Paste)

```powershell
# Navegar até functions
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra\functions"

# Limpar instalação anterior
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# Reinstalar
npm install

# Verificar
npm list firebase-functions
npm run build

# Voltar e deployar
cd ..
firebase deploy --only functions
```

---

## ⚠️ Atenção

Se estiver usando **política de execução** restritiva no PowerShell:

```powershell
# Ver política atual
Get-ExecutionPolicy

# Se for "Restricted", temporariamente permitir:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

**Data:** 23/01/2026
