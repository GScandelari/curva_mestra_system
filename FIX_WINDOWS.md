# 🔧 Fix: TypeScript não encontrado no Windows

## Solução Rápida

Execute estes comandos no PowerShell do VS Code:

```powershell
# Certifique-se que está na pasta functions
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra\functions"

# Reinstalar dependências (inclui o TypeScript)
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install

# Agora build deve funcionar
npm run build
```

## Se ainda não funcionar

Use o npx para executar o TypeScript local:

```powershell
# Em vez de: npm run build
# Use: npx tsc
npx tsc
```

Ou edite o `package.json` para usar npx:

Abra `functions/package.json` e altere:
```json
"scripts": {
  "build": "npx tsc",
  ...
}
```

Depois execute novamente:
```powershell
npm run build
```

---

## Deploy após o build

```powershell
# Voltar para raiz
cd ..

# Deploy
firebase deploy --only functions:sendTestEmail
```
