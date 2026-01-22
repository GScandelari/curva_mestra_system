# Deploy Workaround para Windows - Força uso do npx
Write-Host "=== Deploy Workaround - Windows ===" -ForegroundColor Green

# Adicionar node_modules/.bin ao PATH
$env:PATH = "$PWD\node_modules\.bin;$env:PATH"

# Criar link simbólico temporário (requer permissões de admin)
$nextCmd = "node_modules\.bin\next.cmd"
$nextLink = "node_modules\.bin\next"

if (-not (Test-Path $nextLink)) {
    Write-Host "Criando link simbólico para next..." -ForegroundColor Cyan
    try {
        # Tenta criar symlink (requer admin)
        New-Item -ItemType SymbolicLink -Path $nextLink -Target $nextCmd -Force -ErrorAction Stop | Out-Null
        Write-Host "✓ Link criado" -ForegroundColor Green
    } catch {
        # Se falhar, copia o arquivo
        Write-Host "Criando cópia do executável..." -ForegroundColor Yellow
        Copy-Item $nextCmd $nextLink -Force
    }
}

# Fazer deploy
Write-Host "`nIniciando deploy..." -ForegroundColor Cyan
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deploy concluído!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Deploy falhou. Tente a solução via GitHub Actions." -ForegroundColor Red
    Write-Host "`nPara configurar GitHub Actions:" -ForegroundColor Yellow
    Write-Host "1. Execute: firebase login:ci" -ForegroundColor White
    Write-Host "2. Copie o token gerado" -ForegroundColor White
    Write-Host "3. Adicione como secret FIREBASE_TOKEN no GitHub" -ForegroundColor White
    Write-Host "4. Faça push para o repositório" -ForegroundColor White
}
