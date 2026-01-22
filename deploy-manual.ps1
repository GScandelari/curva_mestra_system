# Script de Deploy Manual - Workaround para Windows
# Este script copia manualmente os arquivos de build para o Firebase

Write-Host "=== Deploy Manual Curva Mestra ===" -ForegroundColor Green
Write-Host ""

# 1. Build do Next.js (já feito)
Write-Host "1. Usando build existente do Next.js..." -ForegroundColor Cyan
if (-not (Test-Path ".next")) {
    Write-Host "ERRO: Build não encontrado! Execute 'npm run build' primeiro." -ForegroundColor Red
    exit 1
}

# 2. Criar pasta temporária para deploy
Write-Host "`n2. Criando estrutura de deploy..." -ForegroundColor Cyan
$deployDir = ".firebase-deploy-temp"
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# 3. Copiar build do Next.js
Write-Host "`n3. Copiando build standalone..." -ForegroundColor Cyan
Copy-Item -Recurse ".next/standalone/*" $deployDir
Copy-Item -Recurse ".next/static" "$deployDir/.next/"
Copy-Item -Recurse "public" "$deployDir/"

# 4. Criar package.json para a função
Write-Host "`n4. Criando configuração da função..." -ForegroundColor Cyan
$functionPackageJson = @"
{
  "name": "nextjs-func",
  "version": "1.0.0",
  "main": "server.js",
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "next": "15.5.9",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  }
}
"@
$functionPackageJson | Out-File -FilePath "$deployDir/package.json" -Encoding utf8

# 5. Instruções finais
Write-Host "`n=== Build preparado em $deployDir ===" -ForegroundColor Green
Write-Host "`nPróximos passos:" -ForegroundColor Yellow
Write-Host "1. Use o Firebase Console para fazer upload manual dos arquivos" -ForegroundColor White
Write-Host "2. Ou tente: firebase deploy --only hosting --debug" -ForegroundColor White
Write-Host "`nAlternativamente, o deploy pode ser feito via GitHub Actions" -ForegroundColor Cyan
