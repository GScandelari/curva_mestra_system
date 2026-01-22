# Script de Deploy para Windows - Curva Mestra
# Correções de segurança CVE-2025-55182 (React2Shell)

Write-Host "=== Deploy Curva Mestra - Correções de Segurança ===" -ForegroundColor Green
Write-Host ""

# 1. Verificar Node.js
Write-Host "1. Verificando Node.js..." -ForegroundColor Cyan
node --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Node.js não encontrado!" -ForegroundColor Red
    exit 1
}

# 2. Verificar Next.js
Write-Host "`n2. Verificando Next.js..." -ForegroundColor Cyan
npx next --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Next.js não encontrado!" -ForegroundColor Red
    exit 1
}

# 3. Verificar Firebase CLI
Write-Host "`n3. Verificando Firebase CLI..." -ForegroundColor Cyan
firebase --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Firebase CLI não encontrado!" -ForegroundColor Red
    exit 1
}

# 4. Limpar build anterior
Write-Host "`n4. Limpando build anterior..." -ForegroundColor Cyan
if (Test-Path ".next") {
    Remove-Item -Recurse -Force .next
    Write-Host "Build anterior removido" -ForegroundColor Yellow
}

# 5. Build do Next.js
Write-Host "`n5. Building Next.js..." -ForegroundColor Cyan
$env:NODE_ENV = "production"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Build falhou!" -ForegroundColor Red
    exit 1
}

# 6. Deploy Firebase
Write-Host "`n6. Fazendo deploy no Firebase..." -ForegroundColor Cyan
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Deploy falhou!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Deploy concluído com sucesso! ===" -ForegroundColor Green
Write-Host "Versões deployadas:" -ForegroundColor Cyan
Write-Host "  - React: 19.2.3 (CVE-2025-55182 corrigido)" -ForegroundColor White
Write-Host "  - Next.js: 15.5.9 (CVE-2025-66478, CVE-2025-55184, CVE-2025-55183, CVE-2025-67779 corrigidos)" -ForegroundColor White
