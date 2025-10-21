# Deploy script for Firebase Hosting
# This script builds the frontend and deploys to Firebase Hosting

param(
    [string]$Environment = "staging",
    [switch]$SkipBuild = $false
)

Write-Host "🚀 Iniciando deploy do Firebase Hosting para ambiente: $Environment" -ForegroundColor Green

# Set working directory to project root
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

try {
    # Check if Firebase CLI is installed
    if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Firebase CLI não encontrado. Instalando..." -ForegroundColor Red
        npm install -g firebase-tools
    }

    # Login check
    Write-Host "🔐 Verificando autenticação Firebase..." -ForegroundColor Yellow
    $loginCheck = firebase projects:list 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Não autenticado no Firebase. Execute: firebase login" -ForegroundColor Red
        exit 1
    }

    if (-not $SkipBuild) {
        # Build frontend
        Write-Host "🏗️ Construindo frontend para produção..." -ForegroundColor Yellow
        Set-Location frontend
        
        # Install dependencies if needed
        if (-not (Test-Path "node_modules")) {
            Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
            npm ci
        }
        
        # Run production build
        npm run build:production
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Falha no build do frontend" -ForegroundColor Red
            exit 1
        }
        
        # Verify build output
        if (-not (Test-Path "dist/index.html")) {
            Write-Host "❌ Build não gerou arquivos esperados" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "✅ Build do frontend concluído" -ForegroundColor Green
        Set-Location ..
    }

    # Deploy to Firebase Hosting
    Write-Host "🚀 Fazendo deploy para Firebase Hosting..." -ForegroundColor Yellow
    
    if ($Environment -eq "production") {
        firebase deploy --only hosting --project production
    } else {
        firebase deploy --only hosting --project staging
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Falha no deploy" -ForegroundColor Red
        exit 1
    }
    
    # Get hosting URL
    $hostingUrl = if ($Environment -eq "production") { 
        "https://curva-mestra.web.app" 
    } else { 
        "https://curva-mestra.web.app" 
    }
    
    Write-Host "✅ Deploy concluído com sucesso!" -ForegroundColor Green
    Write-Host "🌐 URL: $hostingUrl" -ForegroundColor Cyan
    
    # Optional: Open in browser
    $openBrowser = Read-Host "Abrir no navegador? (y/N)"
    if ($openBrowser -eq "y" -or $openBrowser -eq "Y") {
        Start-Process $hostingUrl
    }

} catch {
    Write-Host "❌ Erro durante o deploy: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Deploy finalizado!" -ForegroundColor Green