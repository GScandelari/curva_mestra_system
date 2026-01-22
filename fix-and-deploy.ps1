# Script para corrigir package.json e fazer deploy
Write-Host "Corrigindo package.json..." -ForegroundColor Yellow

# Ler o arquivo
$packagePath = ".firebase\curva-mestra\functions\package.json"
$content = Get-Content $packagePath -Raw | ConvertFrom-Json

# Corrigir a versão do Node
$content.engines.node = "22"

# Salvar
$content | ConvertTo-Json -Depth 10 | Set-Content $packagePath

Write-Host "Package.json corrigido!" -ForegroundColor Green
Write-Host "Fazendo deploy..." -ForegroundColor Yellow

# Fazer deploy
firebase deploy --only hosting
