# Production Migration Execution Script (PowerShell)
# This script orchestrates the complete migration process from PostgreSQL to Firebase

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("migrate", "rollback", "status", "help")]
    [string]$Command,
    
    [Parameter(Position=1)]
    [string]$MigrationId
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ❌ $Message" -ForegroundColor Red
}

# Function to check if command exists
function Test-Command {
    param([string]$CommandName)
    return (Get-Command $CommandName -ErrorAction SilentlyContinue) -ne $null
}

# Function to prompt for confirmation
function Confirm-Action {
    param([string]$Message)
    do {
        $response = Read-Host "$Message (y/n)"
        if ($response -eq 'y' -or $response -eq 'Y') { return $true }
        if ($response -eq 'n' -or $response -eq 'N') { return $false }
        Write-Host "Please answer yes (y) or no (n)."
    } while ($true)
}

# Main migration function
function Invoke-Migration {
    Write-Status "🚀 Starting Production Migration to Firebase"
    Write-Host "=================================================="
    
    # Check prerequisites
    Write-Status "Checking prerequisites..."
    
    if (-not (Test-Command "node")) {
        Write-Error "Node.js is not installed"
        exit 1
    }
    
    if (-not (Test-Command "npm")) {
        Write-Error "NPM is not installed"
        exit 1
    }
    
    if (-not (Test-Command "pg_dump")) {
        Write-Warning "pg_dump not found - backup functionality may not work"
    }
    
    # Check if we're in the right directory
    if (-not (Test-Path "backend/package.json")) {
        Write-Error "Please run this script from the project root directory"
        exit 1
    }
    
    # Check environment variables
    if (-not $env:DB_HOST -or -not $env:DB_NAME -or -not $env:DB_USER) {
        Write-Error "Required database environment variables are not set"
        Write-Error "Please set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD"
        exit 1
    }
    
    Write-Success "Prerequisites check completed"
    
    # Install dependencies if needed
    Write-Status "Installing dependencies..."
    Push-Location backend
    npm install --silent
    Pop-Location
    Write-Success "Dependencies installed"
    
    # Step 1: Pre-migration validation
    Write-Status "Step 1: Running pre-migration validation..."
    Push-Location backend
    $preValidationResult = & node scripts/pre-migration-check.js
    $preValidationExitCode = $LASTEXITCODE
    Pop-Location
    
    if ($preValidationExitCode -eq 0) {
        Write-Success "Pre-migration validation passed"
    } else {
        Write-Error "Pre-migration validation failed"
        Write-Error "Please resolve the issues above before proceeding"
        exit 1
    }
    
    # Confirmation before proceeding
    Write-Host ""
    Write-Warning "⚠️  IMPORTANT: This will migrate your production data to Firebase"
    Write-Warning "⚠️  Make sure you have:"
    Write-Warning "   - Tested the migration in a staging environment"
    Write-Warning "   - Notified users about potential downtime"
    Write-Warning "   - Verified all Firebase configurations"
    Write-Host ""
    
    if (-not (Confirm-Action "Are you sure you want to proceed with the production migration?")) {
        Write-Status "Migration cancelled by user"
        exit 0
    }
    
    # Step 2: Execute migration
    Write-Status "Step 2: Executing production migration..."
    Push-Location backend
    $migrationResult = & node scripts/production-migration.js migrate
    $migrationExitCode = $LASTEXITCODE
    Pop-Location
    
    if ($migrationExitCode -eq 0) {
        Write-Success "Production migration completed successfully"
    } else {
        Write-Error "Production migration failed"
        Write-Error "Check the migration logs for details"
        exit 1
    }
    
    # Step 3: Post-migration validation
    Write-Status "Step 3: Running post-migration validation..."
    Push-Location backend
    $postValidationResult = & node scripts/post-migration-validation.js
    $postValidationExitCode = $LASTEXITCODE
    Pop-Location
    
    if ($postValidationExitCode -eq 0) {
        Write-Success "Post-migration validation passed"
    } else {
        Write-Warning "Post-migration validation found issues"
        Write-Warning "Please review the validation report"
    }
    
    # Final success message
    Write-Host ""
    Write-Success "🎉 Migration process completed!"
    Write-Host "=================================================="
    Write-Status "Next steps:"
    Write-Host "1. Test the new Firebase system thoroughly"
    Write-Host "2. Update DNS to point to Firebase Hosting when ready"
    Write-Host "3. Monitor system performance and costs"
    Write-Host "4. Archive the old PostgreSQL system after validation period"
    Write-Host ""
    Write-Status "Important URLs:"
    Write-Host "- Firebase Console: https://console.firebase.google.com/project/$($env:FIREBASE_PROJECT_ID ?? 'curva-mestra')"
    Write-Host "- New System: $($env:FIREBASE_HOSTING_URL ?? 'https://curva-mestra.web.app')"
    Write-Host ""
}

# Rollback function
function Invoke-Rollback {
    Write-Warning "🔄 Starting Migration Rollback"
    Write-Host "=================================================="
    
    Write-Warning "⚠️  WARNING: This will delete migrated users from Firebase Auth"
    Write-Warning "⚠️  Firestore data will need to be cleaned up manually"
    Write-Host ""
    
    if (-not (Confirm-Action "Are you absolutely sure you want to rollback the migration?")) {
        Write-Status "Rollback cancelled by user"
        exit 0
    }
    
    Push-Location backend
    $rollbackResult = & node scripts/production-migration.js rollback --confirm
    $rollbackExitCode = $LASTEXITCODE
    Pop-Location
    
    if ($rollbackExitCode -eq 0) {
        Write-Success "Migration rollback completed"
    } else {
        Write-Error "Migration rollback failed"
        exit 1
    }
}

# Status function
function Show-Status {
    param([string]$MigrationId)
    
    if (-not $MigrationId) {
        Write-Error "Please provide migration ID"
        Write-Error "Usage: .\execute-production-migration.ps1 status <migration-id>"
        exit 1
    }
    
    Push-Location backend
    & node scripts/production-migration.js status $MigrationId
    Pop-Location
}

# Help function
function Show-Help {
    Write-Host "Production Migration Script - PostgreSQL to Firebase"
    Write-Host ""
    Write-Host "Usage: .\execute-production-migration.ps1 <command> [options]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  migrate     Execute complete production migration"
    Write-Host "  rollback    Rollback migration (destructive operation)"
    Write-Host "  status <id> Show migration status and log"
    Write-Host "  help        Show this help message"
    Write-Host ""
    Write-Host "Environment Variables Required:"
    Write-Host "  DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
    Write-Host "  FIREBASE_PROJECT_ID, FIREBASE_API_KEY"
    Write-Host "  CLINIC_ID (optional, defaults to 'default-clinic')"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\execute-production-migration.ps1 migrate"
    Write-Host "  .\execute-production-migration.ps1 status migration-1640995200000"
    Write-Host "  .\execute-production-migration.ps1 rollback"
    Write-Host ""
}

# Main script logic
switch ($Command) {
    "migrate" {
        Invoke-Migration
    }
    "rollback" {
        Invoke-Rollback
    }
    "status" {
        Show-Status -MigrationId $MigrationId
    }
    "help" {
        Show-Help
    }
    default {
        Write-Error "Unknown command: $Command"
        Show-Help
        exit 1
    }
}