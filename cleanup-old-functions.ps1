# Script PowerShell para limpar funções antigas do Firebase

Write-Host "🗑️  Limpando funções antigas do Firebase..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script irá deletar as seguintes funções:"
Write-Host "  - checkExpiringProducts (us-central1)"
Write-Host "  - cleanupOldNotifications (us-central1)"
Write-Host "  - updateDashboardMetrics (us-central1)"
Write-Host "  - api (us-central1)"
Write-Host "  - onTenantCreated (southamerica-east1)"
Write-Host "  - onUserCreated (southamerica-east1)"
Write-Host "  - sendTestEmail (southamerica-east1)"
Write-Host ""

$confirmation = Read-Host "Deseja continuar? (s/N)"
if ($confirmation -ne 's' -and $confirmation -ne 'S') {
    Write-Host "❌ Operação cancelada." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔄 Deletando funções antigas..." -ForegroundColor Yellow
Write-Host ""

# Funções que não existem no código (us-central1)
Write-Host "📦 Deletando: checkExpiringProducts (us-central1)..." -ForegroundColor White
firebase functions:delete checkExpiringProducts --region us-central1 --force

Write-Host "📦 Deletando: cleanupOldNotifications (us-central1)..." -ForegroundColor White
firebase functions:delete cleanupOldNotifications --region us-central1 --force

Write-Host "📦 Deletando: updateDashboardMetrics (us-central1)..." -ForegroundColor White
firebase functions:delete updateDashboardMetrics --region us-central1 --force

Write-Host "📦 Deletando: api (us-central1)..." -ForegroundColor White
firebase functions:delete api --region us-central1 --force

# Funções comentadas (southamerica-east1)
Write-Host "📦 Deletando: onTenantCreated (southamerica-east1)..." -ForegroundColor White
firebase functions:delete onTenantCreated --region southamerica-east1 --force

Write-Host "📦 Deletando: onUserCreated (southamerica-east1)..." -ForegroundColor White
firebase functions:delete onUserCreated --region southamerica-east1 --force

Write-Host "📦 Deletando: sendTestEmail (southamerica-east1)..." -ForegroundColor White
firebase functions:delete sendTestEmail --region southamerica-east1 --force

Write-Host ""
Write-Host "✅ Limpeza concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "Funções MANTIDAS (em uso):"
Write-Host "  ✓ checkLicenseExpiration (southamerica-east1)" -ForegroundColor Green
Write-Host "  ✓ placeholder (southamerica-east1)" -ForegroundColor Green
Write-Host ""
