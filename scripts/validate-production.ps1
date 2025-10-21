# Production Validation Script
# This script validates that all production services are working correctly

param(
    [string]$ProjectId = "curva-mestra",
    [string]$FrontendUrl = "https://curva-mestra.web.app",
    [string]$FunctionsUrl = "https://us-central1-curva-mestra.cloudfunctions.net",
    [switch]$Verbose = $false
)

Write-Host "🔍 Validando deploy de produção" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Cyan

$validationResults = @{
    Frontend = $false
    Functions = $false
    Firestore = $false
    Authentication = $false
    Monitoring = $false
    Overall = $false
}

try {
    # Test 1: Frontend Accessibility
    Write-Host "`n🌐 Teste 1: Acessibilidade do Frontend" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    
    try {
        Write-Host "🔍 Testando: $FrontendUrl" -ForegroundColor Yellow
        $frontendResponse = Invoke-WebRequest -Uri $FrontendUrl -Method HEAD -TimeoutSec 10
        
        if ($frontendResponse.StatusCode -eq 200) {
            Write-Host "✅ Frontend acessível (Status: $($frontendResponse.StatusCode))" -ForegroundColor Green
            $validationResults.Frontend = $true
            
            # Check security headers
            $headers = $frontendResponse.Headers
            if ($headers['X-Content-Type-Options']) {
                Write-Host "✅ Security headers configurados" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Security headers podem estar ausentes" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "❌ Frontend não acessível: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 2: Health Check Endpoint
    Write-Host "`n⚡ Teste 2: Health Check das Functions" -ForegroundColor Cyan
    Write-Host "====================================" -ForegroundColor Cyan
    
    try {
        $healthUrl = "$FunctionsUrl/healthCheck"
        Write-Host "🔍 Testando: $healthUrl" -ForegroundColor Yellow
        
        $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method GET -TimeoutSec 15
        
        if ($healthResponse.status -eq "healthy") {
            Write-Host "✅ Functions saudáveis" -ForegroundColor Green
            $validationResults.Functions = $true
            
            if ($Verbose) {
                Write-Host "📊 Detalhes do health check:" -ForegroundColor Gray
                $healthResponse | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor Gray
            }
        } else {
            Write-Host "⚠️ Functions com status: $($healthResponse.status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Health check falhou: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 3: Firebase Services via CLI
    Write-Host "`n🔥 Teste 3: Serviços Firebase" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    
    # Test Firestore
    Write-Host "🔍 Testando Firestore..." -ForegroundColor Yellow
    try {
        $firestoreTest = firebase firestore:rules:get --project $ProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Firestore configurado e acessível" -ForegroundColor Green
            $validationResults.Firestore = $true
        } else {
            Write-Host "❌ Problema com Firestore: $firestoreTest" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erro ao testar Firestore: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test Authentication
    Write-Host "🔍 Testando Firebase Auth..." -ForegroundColor Yellow
    try {
        $authTest = firebase auth:export /dev/null --project $ProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Firebase Auth configurado e acessível" -ForegroundColor Green
            $validationResults.Authentication = $true
        } else {
            Write-Host "❌ Problema com Firebase Auth" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erro ao testar Firebase Auth: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 4: API Endpoints
    Write-Host "`n🔌 Teste 4: Endpoints da API" -ForegroundColor Cyan
    Write-Host "===========================" -ForegroundColor Cyan
    
    $apiEndpoints = @(
        "/api/products",
        "/api/requests", 
        "/api/patients",
        "/api/invoices"
    )
    
    $apiResults = @{}
    
    foreach ($endpoint in $apiEndpoints) {
        try {
            $apiUrl = "$FunctionsUrl$endpoint"
            Write-Host "🔍 Testando: $endpoint" -ForegroundColor Yellow
            
            # Test with OPTIONS method to check CORS
            $apiResponse = Invoke-WebRequest -Uri $apiUrl -Method OPTIONS -TimeoutSec 10
            
            if ($apiResponse.StatusCode -eq 200 -or $apiResponse.StatusCode -eq 204) {
                Write-Host "✅ $endpoint - CORS configurado" -ForegroundColor Green
                $apiResults[$endpoint] = $true
            } else {
                Write-Host "⚠️ $endpoint - Status: $($apiResponse.StatusCode)" -ForegroundColor Yellow
                $apiResults[$endpoint] = $false
            }
        } catch {
            Write-Host "❌ $endpoint - Erro: $($_.Exception.Message)" -ForegroundColor Red
            $apiResults[$endpoint] = $false
        }
    }
    
    # Test 5: Monitoring and Analytics
    Write-Host "`n📊 Teste 5: Monitoramento" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    
    try {
        # Check if monitoring functions are deployed
        Write-Host "🔍 Verificando funções de monitoramento..." -ForegroundColor Yellow
        
        $functionsListOutput = firebase functions:list --project $ProjectId 2>&1
        
        $monitoringFunctions = @("reportError", "monitorCosts", "healthCheck")
        $deployedFunctions = @()
        
        foreach ($func in $monitoringFunctions) {
            if ($functionsListOutput -match $func) {
                $deployedFunctions += $func
                Write-Host "✅ Função $func deployada" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Função $func não encontrada" -ForegroundColor Yellow
            }
        }
        
        if ($deployedFunctions.Count -ge 2) {
            $validationResults.Monitoring = $true
            Write-Host "✅ Monitoramento configurado" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Monitoramento parcialmente configurado" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "❌ Erro ao verificar monitoramento: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 6: Performance Check
    Write-Host "`n⚡ Teste 6: Performance" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan
    
    try {
        Write-Host "🔍 Medindo tempo de resposta do frontend..." -ForegroundColor Yellow
        
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $performanceResponse = Invoke-WebRequest -Uri $FrontendUrl -Method GET -TimeoutSec 30
        $stopwatch.Stop()
        
        $responseTime = $stopwatch.ElapsedMilliseconds
        
        if ($responseTime -lt 3000) {
            Write-Host "✅ Tempo de resposta: ${responseTime}ms (Bom)" -ForegroundColor Green
        } elseif ($responseTime -lt 5000) {
            Write-Host "⚠️ Tempo de resposta: ${responseTime}ms (Aceitável)" -ForegroundColor Yellow
        } else {
            Write-Host "❌ Tempo de resposta: ${responseTime}ms (Lento)" -ForegroundColor Red
        }
        
        # Check content size
        $contentLength = $performanceResponse.Headers['Content-Length']
        if ($contentLength) {
            $sizeKB = [math]::Round($contentLength / 1024, 2)
            Write-Host "📊 Tamanho da página: ${sizeKB}KB" -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "❌ Erro no teste de performance: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Calculate overall result
    $passedTests = ($validationResults.Values | Where-Object { $_ -eq $true }).Count
    $totalTests = $validationResults.Count - 1 # Exclude Overall
    
    if ($passedTests -ge ($totalTests * 0.8)) {
        $validationResults.Overall = $true
    }
    
    # Final Results
    Write-Host "`n📋 RESULTADOS DA VALIDAÇÃO" -ForegroundColor Cyan
    Write-Host "==========================" -ForegroundColor Cyan
    
    foreach ($test in $validationResults.GetEnumerator()) {
        if ($test.Key -eq "Overall") { continue }
        
        $status = if ($test.Value) { "✅ PASSOU" } else { "❌ FALHOU" }
        $color = if ($test.Value) { "Green" } else { "Red" }
        
        Write-Host "$($test.Key): $status" -ForegroundColor $color
    }
    
    Write-Host "`n📊 Resumo: $passedTests/$totalTests testes passaram" -ForegroundColor Cyan
    
    if ($validationResults.Overall) {
        Write-Host "`n🎉 VALIDAÇÃO GERAL: SUCESSO" -ForegroundColor Green
        Write-Host "O sistema está funcionando corretamente em produção!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ VALIDAÇÃO GERAL: ATENÇÃO NECESSÁRIA" -ForegroundColor Yellow
        Write-Host "Alguns componentes precisam de atenção." -ForegroundColor Yellow
    }
    
    # Recommendations
    Write-Host "`n💡 Recomendações:" -ForegroundColor Cyan
    
    if (-not $validationResults.Frontend) {
        Write-Host "- Verificar configuração do Firebase Hosting" -ForegroundColor White
    }
    
    if (-not $validationResults.Functions) {
        Write-Host "- Verificar deploy das Firebase Functions" -ForegroundColor White
    }
    
    if (-not $validationResults.Firestore) {
        Write-Host "- Verificar configuração do Firestore" -ForegroundColor White
    }
    
    if (-not $validationResults.Authentication) {
        Write-Host "- Verificar configuração do Firebase Auth" -ForegroundColor White
    }
    
    if (-not $validationResults.Monitoring) {
        Write-Host "- Executar deploy das funções de monitoramento" -ForegroundColor White
    }
    
    Write-Host "`n🔗 Links Úteis:" -ForegroundColor Cyan
    Write-Host "- Firebase Console: https://console.firebase.google.com/project/$ProjectId" -ForegroundColor White
    Write-Host "- Frontend: $FrontendUrl" -ForegroundColor White
    Write-Host "- Health Check: $FunctionsUrl/healthCheck" -ForegroundColor White
    
} catch {
    Write-Host "❌ Erro durante validação: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Exit with appropriate code
if ($validationResults.Overall) {
    exit 0
} else {
    exit 1
}