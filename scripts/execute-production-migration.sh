#!/bin/bash

# Production Migration Execution Script
# This script orchestrates the complete migration process from PostgreSQL to Firebase

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt for confirmation
confirm() {
    while true; do
        read -p "$1 (y/n): " yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Main migration function
execute_migration() {
    print_status "🚀 Starting Production Migration to Firebase"
    echo "=================================================="
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    
    if ! command_exists node; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "NPM is not installed"
        exit 1
    fi
    
    if ! command_exists pg_dump; then
        print_warning "pg_dump not found - backup functionality may not work"
    fi
    
    # Check if we're in the right directory
    if [ ! -f "backend/package.json" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Check environment variables
    if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
        print_error "Required database environment variables are not set"
        print_error "Please set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD"
        exit 1
    fi
    
    print_success "Prerequisites check completed"
    
    # Install dependencies if needed
    print_status "Installing dependencies..."
    cd backend
    npm install --silent
    cd ..
    print_success "Dependencies installed"
    
    # Step 1: Pre-migration validation
    print_status "Step 1: Running pre-migration validation..."
    cd backend
    if node scripts/pre-migration-check.js; then
        print_success "Pre-migration validation passed"
    else
        print_error "Pre-migration validation failed"
        print_error "Please resolve the issues above before proceeding"
        exit 1
    fi
    cd ..
    
    # Confirmation before proceeding
    echo ""
    print_warning "⚠️  IMPORTANT: This will migrate your production data to Firebase"
    print_warning "⚠️  Make sure you have:"
    print_warning "   - Tested the migration in a staging environment"
    print_warning "   - Notified users about potential downtime"
    print_warning "   - Verified all Firebase configurations"
    echo ""
    
    if ! confirm "Are you sure you want to proceed with the production migration?"; then
        print_status "Migration cancelled by user"
        exit 0
    fi
    
    # Step 2: Execute migration
    print_status "Step 2: Executing production migration..."
    cd backend
    if node scripts/production-migration.js migrate; then
        print_success "Production migration completed successfully"
    else
        print_error "Production migration failed"
        print_error "Check the migration logs for details"
        exit 1
    fi
    cd ..
    
    # Step 3: Post-migration validation
    print_status "Step 3: Running post-migration validation..."
    cd backend
    if node scripts/post-migration-validation.js; then
        print_success "Post-migration validation passed"
    else
        print_warning "Post-migration validation found issues"
        print_warning "Please review the validation report"
    fi
    cd ..
    
    # Final success message
    echo ""
    print_success "🎉 Migration process completed!"
    echo "=================================================="
    print_status "Next steps:"
    echo "1. Test the new Firebase system thoroughly"
    echo "2. Update DNS to point to Firebase Hosting when ready"
    echo "3. Monitor system performance and costs"
    echo "4. Archive the old PostgreSQL system after validation period"
    echo ""
    print_status "Important URLs:"
    echo "- Firebase Console: https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID:-curva-mestra}"
    echo "- New System: ${FIREBASE_HOSTING_URL:-https://curva-mestra.web.app}"
    echo ""
}

# Rollback function
execute_rollback() {
    print_warning "🔄 Starting Migration Rollback"
    echo "=================================================="
    
    print_warning "⚠️  WARNING: This will delete migrated users from Firebase Auth"
    print_warning "⚠️  Firestore data will need to be cleaned up manually"
    echo ""
    
    if ! confirm "Are you absolutely sure you want to rollback the migration?"; then
        print_status "Rollback cancelled by user"
        exit 0
    fi
    
    cd backend
    if node scripts/production-migration.js rollback --confirm; then
        print_success "Migration rollback completed"
    else
        print_error "Migration rollback failed"
        exit 1
    fi
    cd ..
}

# Status function
show_status() {
    if [ -z "$2" ]; then
        print_error "Please provide migration ID"
        print_error "Usage: $0 status <migration-id>"
        exit 1
    fi
    
    cd backend
    node scripts/production-migration.js status "$2"
    cd ..
}

# Help function
show_help() {
    echo "Production Migration Script - PostgreSQL to Firebase"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  migrate     Execute complete production migration"
    echo "  rollback    Rollback migration (destructive operation)"
    echo "  status <id> Show migration status and log"
    echo "  help        Show this help message"
    echo ""
    echo "Environment Variables Required:"
    echo "  DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
    echo "  FIREBASE_PROJECT_ID, FIREBASE_API_KEY"
    echo "  CLINIC_ID (optional, defaults to 'default-clinic')"
    echo ""
    echo "Examples:"
    echo "  $0 migrate"
    echo "  $0 status migration-1640995200000"
    echo "  $0 rollback"
    echo ""
}

# Main script logic
case "${1:-help}" in
    migrate)
        execute_migration
        ;;
    rollback)
        execute_rollback
        ;;
    status)
        show_status "$@"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac