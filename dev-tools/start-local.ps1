# Script para iniciar aplicação local com ambiente completo no Windows
# Uso: .\dev-tools\start-local.ps1

$ErrorActionPreference = "Stop"

# Configurar Java 21
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Host "🚀 Iniciando Curva Mestra - Ambiente Local" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# 1. Verificar Java
Write-Host "☕ Verificando Java..." -ForegroundColor Yellow
$javaVersion = java -version 2>&1 | Select-String "version"
if ($javaVersion -match "21\.") {
    Write-Host "✅ Java 21 encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ Java 21 não encontrado. Instale com: winget install EclipseAdoptium.Temurin.21.JDK" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Verificar Firebase CLI
Write-Host "🔥 Verificando Firebase CLI..." -ForegroundColor Yellow
if (!(Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Firebase CLI não encontrado." -ForegroundColor Red
    Write-Host "Instale com: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Firebase CLI encontrado" -ForegroundColor Green
Write-Host ""

# 3. Instalar dependências se necessário
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
    npm install
    Write-Host "✅ Dependências instaladas" -ForegroundColor Green
    Write-Host ""
}

# 4. Limpar processos existentes
Write-Host "🧹 Limpando processos anteriores..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*firebase*" -or $_.ProcessName -like "*next*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "✅ Processos limpos" -ForegroundColor Green
Write-Host ""

# 5. Iniciar emuladores Firebase em background
Write-Host "🔥 Iniciando Firebase Emulators..." -ForegroundColor Yellow
$firebaseJob = Start-Job -ScriptBlock {
    $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot"
    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
    Set-Location $using:PWD
    firebase emulators:start
}
Write-Host "   Job ID: $($firebaseJob.Id)" -ForegroundColor Gray
Write-Host ""

# 6. Aguardar emuladores estarem prontos
Write-Host "⏳ Aguardando emuladores iniciarem..." -ForegroundColor Yellow
$maxAttempts = 60
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and !$ready) {
    Start-Sleep -Seconds 1
    $attempt++
    
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:4000" -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        # Continuar tentando
    }
    
    if ($attempt % 5 -eq 0) {
        Write-Host "   Tentativa $attempt/$maxAttempts..." -ForegroundColor Gray
    }
}

if (!$ready) {
    Write-Host "❌ Timeout aguardando emuladores" -ForegroundColor Red
    Stop-Job $firebaseJob
    Remove-Job $firebaseJob
    exit 1
}

Write-Host "✅ Emuladores prontos!" -ForegroundColor Green
Write-Host ""

# 7. Aguardar mais um pouco para garantir
Start-Sleep -Seconds 3

# 8. Criar System Admin + Clínicas
Write-Host "👤 Criando System Admin e Clínicas de Teste..." -ForegroundColor Yellow
try {
    node dev-tools/setup-complete-environment.js
    Write-Host "✅ Ambiente configurado" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao criar usuários: $_" -ForegroundColor Red
    Stop-Job $firebaseJob
    Remove-Job $firebaseJob
    exit 1
}
Write-Host ""

# 9. Importar produtos Rennova
Write-Host "📦 Importando catálogo de produtos Rennova..." -ForegroundColor Yellow
try {
    node scripts/import-master-products.js
    Write-Host "✅ Produtos importados" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao importar produtos: $_" -ForegroundColor Red
    Stop-Job $firebaseJob
    Remove-Job $firebaseJob
    exit 1
}
Write-Host ""

# 10. Mostrar informações
Write-Host "🎉 Ambiente pronto! Iniciando aplicação..." -ForegroundColor Green
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "📋 CREDENCIAIS DE ACESSO" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔐 SYSTEM ADMIN" -ForegroundColor Yellow
Write-Host "   Email: scandelari.guilherme@curvamestra.com.br"
Write-Host "   Senha: admin123"
Write-Host "   URL:   http://localhost:3000/admin"
Write-Host ""
Write-Host "🏥 CLÍNICA BELLA VITA (Plano Anual)" -ForegroundColor Yellow
Write-Host "   CNPJ:  34.028.316/0001-03"
Write-Host "   Admin: admin@bellavita.com / bella123"
Write-Host "   User:  maria@bellavita.com / bella123"
Write-Host ""
Write-Host "🏥 ESPAÇO RENOVA (Plano Semestral)" -ForegroundColor Yellow
Write-Host "   CNPJ:  07.526.557/0001-00"
Write-Host "   Admin: admin@espacorenova.com / renova123"
Write-Host "   User:  carlos@espacorenova.com / renova123"
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🛠️  FERRAMENTAS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Aplicação:    http://localhost:3000"
Write-Host "   Emulator UI:  http://127.0.0.1:4000"
Write-Host "   Firestore:    http://127.0.0.1:4000/firestore"
Write-Host "   Auth:         http://127.0.0.1:4000/auth"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Pressione Ctrl+C para parar todos os serviços" -ForegroundColor Yellow
Write-Host ""

# Cleanup ao sair
$null = Register-EngineEvent PowerShell.Exiting -Action {
    Stop-Job $firebaseJob -ErrorAction SilentlyContinue
    Remove-Job $firebaseJob -ErrorAction SilentlyContinue
}

# 11. Iniciar Next.js (foreground)
npm run dev

# Cleanup
Stop-Job $firebaseJob -ErrorAction SilentlyContinue
Remove-Job $firebaseJob -ErrorAction SilentlyContinue
