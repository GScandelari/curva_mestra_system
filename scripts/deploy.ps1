# Production Deployment Script for Inventario Clinica System
param(
    [Parameter(Position=0)]
    [ValidateSet("deploy", "health", "logs", "rollback", "backup")]
    [string]$Command = "deploy"
)

# Configuration
$ProjectName = "inventario-clinica"
$BackupDir = "./backups"
$LogDir = "./logs"
$SslDir = "./ssl"
$ComposeFile = "docker-compose.production.yml"

# Logging functions
function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] WARNING: $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $Message" -ForegroundColor Red
    exit 1
}

# Check prerequisites
function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    
    # Check if Docker is installed
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker is not installed. Please install Docker first."
    }
    
    # Check if Docker Compose is installed
    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        Write-Error "Docker Compose is not installed. Please install Docker Compose first."
    }
    
    # Check if .env file exists
    if (-not (Test-Path ".env")) {
        Write-Error ".env file not found. Please create it from .env.example"
    }
    
    Write-Log "Prerequisites check passed"
}

# Create necessary directories
function New-Directories {
    Write-Log "Creating necessary directories..."
    
    @($BackupDir, $LogDir, $SslDir, "./uploads", "./logs/nginx") | ForEach-Object {
        if (-not (Test-Path $_)) {
            New-Item -ItemType Directory -Path $_ -Force | Out-Null
        }
    }
    
    Write-Log "Directories created"
}

# Generate SSL certificates if they don't exist
function Set-SSL {
    Write-Log "Setting up SSL certificates..."
    
    $certFile = Join-Path $SslDir "cert.pem"
    $keyFile = Join-Path $SslDir "key.pem"
    
    if (-not (Test-Path $certFile) -or -not (Test-Path $keyFile)) {
        Write-Warning "SSL certificates not found. Generating self-signed certificates..."
        
        # Check if OpenSSL is available
        if (Get-Command openssl -ErrorAction SilentlyContinue) {
            $opensslCmd = "openssl req -x509 -newkey rsa:4096 -keyout `"$keyFile`" -out `"$certFile`" -days 365 -nodes -subj `"/C=BR/ST=State/L=City/O=Organization/CN=localhost`""
            Invoke-Expression $opensslCmd
            Write-Log "Self-signed SSL certificates generated"
        } else {
            Write-Warning "OpenSSL not found. Please install OpenSSL or provide SSL certificates manually."
            Write-Warning "You can download OpenSSL from: https://slproweb.com/products/Win32OpenSSL.html"
        }
        
        Write-Warning "For production, replace with proper SSL certificates from a CA"
    } else {
        Write-Log "SSL certificates found"
    }
}

# Build and deploy
function Start-Deploy {
    Write-Log "Starting deployment..."
    
    # Pull latest images
    Write-Log "Pulling latest Docker images..."
    docker-compose -f $ComposeFile pull
    
    # Build custom images
    Write-Log "Building application images..."
    docker-compose -f $ComposeFile build
    
    # Stop existing containers
    Write-Log "Stopping existing containers..."
    docker-compose -f $ComposeFile down
    
    # Start services
    Write-Log "Starting services..."
    docker-compose -f $ComposeFile up -d
    
    # Wait for services to be healthy
    Write-Log "Waiting for services to be healthy..."
    Start-Sleep -Seconds 30
    
    # Check service health
    Test-Health
    
    Write-Log "Deployment completed successfully"
}

# Check service health
function Test-Health {
    Write-Log "Checking service health..."
    
    # Check database
    $dbHealth = docker-compose -f $ComposeFile exec -T postgres pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Database is healthy"
    } else {
        Write-Error "Database health check failed"
    }
    
    # Check backend
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Log "Backend is healthy"
        } else {
            Write-Error "Backend health check failed"
        }
    } catch {
        Write-Error "Backend health check failed: $($_.Exception.Message)"
    }
    
    # Check nginx
    try {
        $response = Invoke-WebRequest -Uri "http://localhost/health" -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Log "Nginx is healthy"
        } else {
            Write-Error "Nginx health check failed"
        }
    } catch {
        Write-Error "Nginx health check failed: $($_.Exception.Message)"
    }
    
    Write-Log "All services are healthy"
}

# Backup before deployment
function New-BackupBeforeDeploy {
    Write-Log "Creating backup before deployment..."
    
    $postgresRunning = docker-compose -f $ComposeFile ps postgres | Select-String "Up"
    if ($postgresRunning) {
        $backupFile = Join-Path $BackupDir "pre-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
        docker-compose -f $ComposeFile exec -T postgres pg_dump -U postgres inventario_clinica > $backupFile
        Write-Log "Pre-deployment backup created: $backupFile"
    } else {
        Write-Warning "Database not running, skipping backup"
    }
}

# Show logs
function Show-Logs {
    Write-Log "Showing recent logs..."
    docker-compose -f $ComposeFile logs --tail=50
}

# Rollback deployment
function Start-Rollback {
    Write-Log "Rolling back deployment..."
    
    # Stop current containers
    docker-compose -f $ComposeFile down
    
    # Restore from backup if available
    $latestBackup = Get-ChildItem -Path $BackupDir -Filter "pre-deploy-*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    
    if ($latestBackup) {
        Write-Log "Restoring from backup: $($latestBackup.Name)"
        
        # Start only database for restore
        docker-compose -f $ComposeFile up -d postgres
        Start-Sleep -Seconds 10
        
        # Restore database
        Get-Content $latestBackup.FullName | docker-compose -f $ComposeFile exec -T postgres psql -U postgres -d inventario_clinica
        
        Write-Log "Database restored from backup"
    }
    
    Write-Log "Rollback completed"
}

# Main execution
switch ($Command) {
    "deploy" {
        Test-Prerequisites
        New-Directories
        Set-SSL
        New-BackupBeforeDeploy
        Start-Deploy
    }
    "health" {
        Test-Health
    }
    "logs" {
        Show-Logs
    }
    "rollback" {
        Start-Rollback
    }
    "backup" {
        New-BackupBeforeDeploy
    }
    default {
        Write-Host "Usage: .\deploy.ps1 [deploy|health|logs|rollback|backup]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  deploy   - Deploy the application (default)"
        Write-Host "  health   - Check service health"
        Write-Host "  logs     - Show recent logs"
        Write-Host "  rollback - Rollback deployment"
        Write-Host "  backup   - Create database backup"
    }
}