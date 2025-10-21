# Production Deployment Script for Firebase Migration
# This script handles complete production deployment including Functions and Hosting

param(
    [switch]$SkipBuild = $false,
    [switch]$SkipTests = $false,
    [switch]$Force = $false
)

Write-Host "🚀 Iniciando deploy de produção completo para Firebase" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan

# Set working directory to project root
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# Configuration
$ProjectId = "curva-mestra"
$FrontendUrl = "https://curva-mestra.web.app"
$FunctionsUrl = "https://us-central1-curva-mestra.cloudfunctions.net"

try {
    # Pre-deployment checks
    Write-Host "🔍 Executando verificações pré-deploy..." -ForegroundColor Yellow
    
    # Check Firebase CLI
    if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Firebase CLI não encontrado. Instalando..." -ForegroundColor Red
        npm install -g firebase-tools
    }
    
    # Check authentication
    Write-Host "🔐 Verificando autenticação Firebase..." -ForegroundColor Yellow
    $loginCheck = firebase projects:list 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Não autenticado no Firebase. Execute: firebase login" -ForegroundColor Red
        exit 1
    }
    
    # Verify project exists
    Write-Host "📋 Verificando projeto Firebase..." -ForegroundColor Yellow
    $projectCheck = firebase projects:list | Select-String $ProjectId
    if (-not $projectCheck) {
        Write-Host "❌ Projeto $ProjectId não encontrado" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Verificações pré-deploy concluídas" -ForegroundColor Green
    
    # Step 1: Deploy Firebase Functions
    Write-Host "`n🔧 Passo 1: Deploy das Firebase Functions" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    
    Set-Location functions
    
    if (-not $SkipBuild) {
        # Install dependencies
        Write-Host "📦 Instalando dependências das Functions..." -ForegroundColor Yellow
        npm ci
        
        # Build Functions
        Write-Host "🏗️ Construindo Functions..." -ForegroundColor Yellow
        npm run build
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Falha no build das Functions" -ForegroundColor Red
            exit 1
        }
    }
    
    # Run tests if not skipped
    if (-not $SkipTests) {
        Write-Host "🧪 Executando testes das Functions..." -ForegroundColor Yellow
        npm run test
        
        if ($LASTEXITCODE -ne 0 -and -not $Force) {
            Write-Host "❌ Testes falharam. Use -Force para continuar" -ForegroundColor Red
            exit 1
        }
    }
    
    # Deploy Functions
    Write-Host "🚀 Fazendo deploy das Functions..." -ForegroundColor Yellow
    firebase deploy --only functions --project $ProjectId
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Falha no deploy das Functions" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Functions deployadas com sucesso" -ForegroundColor Green
    Set-Location ..
    
    # Step 2: Configure production environment variables
    Write-Host "`n⚙️ Passo 2: Configurando variáveis de ambiente" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    
    # Set Firebase Functions config
    Write-Host "🔧 Configurando variáveis das Functions..." -ForegroundColor Yellow
    
    $configCommands = @(
        "firebase functions:config:set email.service_enabled=true --project $ProjectId",
        "firebase functions:config:set email.from=noreply@curva-mestra.firebaseapp.com --project $ProjectId",
        "firebase functions:config:set monitoring.performance=true --project $ProjectId",
        "firebase functions:config:set monitoring.error_reporting=true --project $ProjectId",
        "firebase functions:config:set monitoring.analytics=true --project $ProjectId",
        "firebase functions:config:set security.cors_origins=https://curva-mestra.web.app,https://curva-mestra.firebaseapp.com --project $ProjectId",
        "firebase functions:config:set backup.enabled=true --project $ProjectId",
        "firebase functions:config:set backup.schedule='0 2 * * *' --project $ProjectId",
        "firebase functions:config:set backup.retention_days=30 --project $ProjectId"
    )
    
    foreach ($cmd in $configCommands) {
        Write-Host "Executando: $cmd" -ForegroundColor Gray
        Invoke-Expression $cmd
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️ Aviso: Falha ao configurar: $cmd" -ForegroundColor Yellow
        }
    }
    
    Write-Host "✅ Configuração de ambiente concluída" -ForegroundColor Green
    
    # Step 3: Deploy Frontend to Firebase Hosting
    Write-Host "`n🌐 Passo 3: Deploy do Frontend (Firebase Hosting)" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    
    Set-Location frontend
    
    if (-not $SkipBuild) {
        # Install dependencies
        Write-Host "📦 Instalando dependências do frontend..." -ForegroundColor Yellow
        npm ci
        
        # Build frontend for production
        Write-Host "🏗️ Construindo frontend para produção..." -ForegroundColor Yellow
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
    }
    
    Set-Location ..
    
    # Deploy to Firebase Hosting
    Write-Host "🚀 Fazendo deploy para Firebase Hosting..." -ForegroundColor Yellow
    firebase deploy --only hosting --project $ProjectId
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Falha no deploy do Hosting" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Frontend deployado com sucesso" -ForegroundColor Green
    
    # Step 4: Configure Firestore Security Rules and Indexes
    Write-Host "`n🔒 Passo 4: Deploy das regras de segurança e índices" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    
    Write-Host "🔧 Fazendo deploy das regras do Firestore..." -ForegroundColor Yellow
    firebase deploy --only firestore:rules --project $ProjectId
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Falha no deploy das regras do Firestore" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "📊 Fazendo deploy dos índices do Firestore..." -ForegroundColor Yellow
    firebase deploy --only firestore:indexes --project $ProjectId
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Falha no deploy dos índices do Firestore" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Regras e índices deployados com sucesso" -ForegroundColor Green
    
    # Step 5: Setup monitoring and alerts
    Write-Host "`n📊 Passo 5: Configurando monitoramento e alertas" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    
    Write-Host "🔧 Executando configuração de monitoramento..." -ForegroundColor Yellow
    
    # Run monitoring setup script
    try {
        & "$ProjectRoot\scripts\setup-monitoring.ps1" -ProjectId $ProjectId -SkipEmailAlerts
        Write-Host "✅ Monitoramento configurado com sucesso" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Erro na configuração de monitoramento: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Continuando com o deploy..." -ForegroundColor Yellow
    }
    
    Write-Host "📊 Configurando alertas adicionais no Firebase Console:" -ForegroundColor Yellow
    Write-Host "   - Performance Monitoring: https://console.firebase.google.com/project/$ProjectId/performance" -ForegroundColor Gray
    Write-Host "   - Crashlytics: https://console.firebase.google.com/project/$ProjectId/crashlytics" -ForegroundColor Gray
    Write-Host "   - Analytics: https://console.firebase.google.com/project/$ProjectId/analytics" -ForegroundColor Gray
    
    # Step 6: Final validation
    Write-Host "`n✅ Passo 6: Validação final" -ForegroundColor Cyan
    Write-Host "===========================" -ForegroundColor Cyan
    
    Write-Host "🔍 Executando validação completa..." -ForegroundColor Yellow
    
    # Run validation script
    try {
        & "$ProjectRoot\scripts\validate-production.ps1" -ProjectId $ProjectId -FrontendUrl $FrontendUrl -FunctionsUrl $FunctionsUrl
        Write-Host "✅ Validação concluída com sucesso" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Alguns testes de validação falharam" -ForegroundColor Yellow
        Write-Host "Verifique os logs acima para detalhes" -ForegroundColor Yellow
    }
    
    # Display final configuration
    Write-Host "`n📋 CONFIGURAÇÃO FINAL DE PRODUÇÃO" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host "🌐 Frontend URL: $FrontendUrl" -ForegroundColor White
    Write-Host "⚡ Functions URL: $FunctionsUrl" -ForegroundColor White
    Write-Host "🗄️ Firestore: Configurado com regras de segurança" -ForegroundColor White
    Write-Host "🔐 Authentication: Firebase Auth ativo" -ForegroundColor White
    Write-Host "📊 Monitoring: Performance, Analytics, Error Reporting" -ForegroundColor White
    Write-Host "💾 Backup: Configurado para execução diária às 2h" -ForegroundColor White
    
    Write-Host "`n🎉 DEPLOY DE PRODUÇÃO CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    
    # Optional: Open in browser
    $openBrowser = Read-Host "`nAbrir aplicação no navegador? (y/N)"
    if ($openBrowser -eq "y" -or $openBrowser -eq "Y") {
        Start-Process $FrontendUrl
    }
    
} catch {
    Write-Host "❌ Erro durante o deploy: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace: $($_.Exception.StackTrace)" -ForegroundColor Red
    exit 1
}

Write-Host "`n📝 Próximos passos:" -ForegroundColor Cyan
Write-Host "- Configurar alertas no Firebase Console" -ForegroundColor White
Write-Host "- Configurar domínio customizado (se necessário)" -ForegroundColor White
Write-Host "- Executar testes de integração em produção" -ForegroundColor White
Write-Host "- Configurar monitoramento de custos" -ForegroundColor White