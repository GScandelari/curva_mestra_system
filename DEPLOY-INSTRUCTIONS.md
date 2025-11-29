# Instruções de Deploy - Firebase Hosting

## Problema Identificado

O Firebase Hosting está tendo problemas com Node.js v22. O `.nvmrc` especifica Node 20, mas o `package.json` principal exige Node 22.

## Solução: Execute no Terminal Windows

### Opção 1: Deploy direto (pode funcionar dependendo do ambiente)

```powershell
# 1. Navegar para o diretório do projeto
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"

# 2. Fazer deploy
firebase deploy --only hosting
```

### Opção 2: Ajustar versão do Node temporariamente

```powershell
# 1. Navegar para o diretório
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"

# 2. Usar Node 20 (se tiver nvm no Windows)
nvm use 20

# 3. Fazer deploy
firebase deploy --only hosting
```

### Opção 3: Deploy apenas de arquivos estáticos (sem Cloud Functions)

Se o problema persistir, podemos fazer deploy apenas dos arquivos estáticos:

```powershell
# 1. Navegar para o diretório
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"

# 2. Build estático
npm run build

# 3. Deploy do diretório .next/static
firebase deploy --only hosting:curva-mestra
```

### Opção 4: Atualizar package.json para aceitar Node 20

Se ainda não funcionar, precisamos ajustar o `package.json`:

**Executar no PowerShell:**
```powershell
# Navegar para o diretório
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"

# Editar package.json manualmente ou usar comando
# Mudar "node": "22" para "node": ">=20"
```

## Solução Recomendada (MAIS SIMPLES)

Execute este comando no PowerShell/CMD:

```powershell
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
firebase deploy --only hosting --debug
```

O flag `--debug` vai mostrar mais detalhes sobre onde está falhando.

## Alternativa: Deploy Manual via Firebase Console

Se nenhuma opção funcionar via CLI:

1. Acesse: https://console.firebase.google.com/project/curva-mestra/hosting
2. Clique em "Add another site" ou use o site existente
3. Faça upload manual do diretório `.next` após o build

## Verificação de Pré-requisitos

Antes de fazer deploy, verifique:

```powershell
# Versão do Node
node --version

# Versão do Firebase CLI
firebase --version

# Projeto atual
firebase use
```

## Se o Deploy Falhar Novamente

O problema pode ser:

1. **Timeout na análise do código**: O Firebase está demorando para analisar o código Next.js
2. **Versão do Node incompatível**: Package.json pede Node 22, mas Firebase quer 20
3. **Cloud Functions sendo criadas automaticamente**: O Firebase está tentando criar Functions para rotas dinâmicas

### Solução Definitiva: Simplificar o Deploy

Vou criar um script de deploy simplificado:

```powershell
# Criar arquivo deploy.bat na raiz do projeto
# Execute este conteúdo:

@echo off
echo === Deploy Curva Mestra ===
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"

echo.
echo [1/3] Building...
call npm run build

echo.
echo [2/3] Deploying to Firebase...
call firebase deploy --only hosting

echo.
echo [3/3] Deploy completo!
pause
```

Salve como `deploy.bat` e execute clicando duas vezes.

## Troubleshooting

### Erro: "User code failed to load"
**Causa**: Timeout na análise do código
**Solução**:
1. Aumente o timeout do Firebase
2. Use Node 20 ao invés de Node 22
3. Simplifique o build removendo rotas dinâmicas temporariamente

### Erro: "EBADENGINE Unsupported engine"
**Causa**: Conflito entre versão do Node no package.json e versão instalada
**Solução**: Editar `package.json` linha 53-54:
```json
"engines": {
  "node": ">=20 <=22",
  "npm": ">=10.0.0"
}
```

### Erro: "Cannot determine backend specification"
**Causa**: Firebase não consegue analisar as Cloud Functions geradas automaticamente
**Solução**: Temporariamente desabilitar rotas de API ou fazer deploy sem framework backend

## Comando Recomendado AGORA

Execute no terminal Windows (PowerShell ou CMD):

```cmd
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
firebase experiments:enable webframeworks
firebase deploy --only hosting
```

O comando `firebase experiments:enable webframeworks` habilita suporte experimental para Next.js, que pode resolver o problema.
