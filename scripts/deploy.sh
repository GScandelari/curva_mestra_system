#!/bin/bash

# Production Deployment Script for Inventario Clinica System
set -e

# Configuration
PROJECT_NAME="inventario-clinica"
BACKUP_DIR="./backups"
LOG_DIR="./logs"
SSL_DIR="./ssl"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check if .env file exists
    if [[ ! -f .env ]]; then
        error ".env file not found. Please create it from .env.example"
    fi
    
    log "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$SSL_DIR"
    mkdir -p "./uploads"
    mkdir -p "./logs/nginx"
    
    log "Directories created"
}

# Generate SSL certificates if they don't exist
setup_ssl() {
    log "Setting up SSL certificates..."
    
    if [[ ! -f "$SSL_DIR/cert.pem" ]] || [[ ! -f "$SSL_DIR/key.pem" ]]; then
        warn "SSL certificates not found. Generating self-signed certificates..."
        
        # Generate self-signed certificate
        openssl req -x509 -newkey rsa:4096 -keyout "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem" \
            -days 365 -nodes -subj "/C=BR/ST=State/L=City/O=Organization/CN=localhost"
        
        log "Self-signed SSL certificates generated"
        warn "For production, replace with proper SSL certificates from a CA"
    else
        log "SSL certificates found"
    fi
}

# Build and deploy
deploy() {
    log "Starting deployment..."
    
    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose -f docker-compose.production.yml pull
    
    # Build custom images
    log "Building application images..."
    docker-compose -f docker-compose.production.yml build
    
    # Stop existing containers
    log "Stopping existing containers..."
    docker-compose -f docker-compose.production.yml down
    
    # Start services
    log "Starting services..."
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_health
    
    log "Deployment completed successfully"
}

# Check service health
check_health() {
    log "Checking service health..."
    
    # Check database
    if docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U postgres; then
        log "Database is healthy"
    else
        error "Database health check failed"
    fi
    
    # Check backend
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        log "Backend is healthy"
    else
        error "Backend health check failed"
    fi
    
    # Check nginx
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log "Nginx is healthy"
    else
        error "Nginx health check failed"
    fi
    
    log "All services are healthy"
}

# Backup before deployment
backup_before_deploy() {
    log "Creating backup before deployment..."
    
    if docker-compose -f docker-compose.production.yml ps postgres | grep -q "Up"; then
        # Database is running, create backup
        docker-compose -f docker-compose.production.yml exec -T postgres \
            pg_dump -U postgres inventario_clinica > "$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).sql"
        log "Pre-deployment backup created"
    else
        warn "Database not running, skipping backup"
    fi
}

# Show logs
show_logs() {
    log "Showing recent logs..."
    docker-compose -f docker-compose.production.yml logs --tail=50
}

# Rollback deployment
rollback() {
    log "Rolling back deployment..."
    
    # Stop current containers
    docker-compose -f docker-compose.production.yml down
    
    # Restore from backup if available
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/pre-deploy-*.sql 2>/dev/null | head -n1)
    if [[ -n "$LATEST_BACKUP" ]]; then
        log "Restoring from backup: $LATEST_BACKUP"
        # Start only database for restore
        docker-compose -f docker-compose.production.yml up -d postgres
        sleep 10
        
        # Restore database
        docker-compose -f docker-compose.production.yml exec -T postgres \
            psql -U postgres -d inventario_clinica < "$LATEST_BACKUP"
        
        log "Database restored from backup"
    fi
    
    log "Rollback completed"
}

# Main function
main() {
    case "${1:-deploy}" in
        "deploy")
            check_root
            check_prerequisites
            create_directories
            setup_ssl
            backup_before_deploy
            deploy
            ;;
        "health")
            check_health
            ;;
        "logs")
            show_logs
            ;;
        "rollback")
            rollback
            ;;
        "backup")
            backup_before_deploy
            ;;
        *)
            echo "Usage: $0 {deploy|health|logs|rollback|backup}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy the application (default)"
            echo "  health   - Check service health"
            echo "  logs     - Show recent logs"
            echo "  rollback - Rollback deployment"
            echo "  backup   - Create database backup"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"