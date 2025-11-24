# Script PowerShell para testar envio de e-mail

# URL da função (ajuste se necessário)
$functionUrl = "https://southamerica-east1-curva-mestra.cloudfunctions.net/sendTestEmail"

# Suas credenciais
$email = "scandelari.guilherme@curvamestra.com.br"
$smtpUser = "scandelari.guilherme@curvamestra.com.br"
$smtpPass = Read-Host "Digite sua senha do Zoho" -AsSecureString
$smtpPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($smtpPass))

# Criar JSON
$body = @{
    email = $email
    smtpUser = $smtpUser
    smtpPass = $smtpPassPlain
} | ConvertTo-Json

# Enviar requisição
Write-Host "Enviando e-mail de teste..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $functionUrl -Method Post -Body $body -ContentType "application/json"
    Write-Host "✅ SUCESSO!" -ForegroundColor Green
    Write-Host "Resposta: $($response | ConvertTo-Json)" -ForegroundColor Cyan
    Write-Host "`nVerifique sua caixa de entrada: $email" -ForegroundColor Yellow
} catch {
    Write-Host "❌ ERRO!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
