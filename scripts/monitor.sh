#!/bin/bash

# System Monitoring Script for Inventario Clinica
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.production.yml"
LOG_LINES=50

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Check service status
check_services() {
    log "Checking service status..."
    echo ""
    
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    
    # Check individual service health
    services=("postgres" "backend" "nginx" "backup")
    
    for service in "${services[@]}"; do
        if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            log "✓ $service is running"
        else
            error "✗ $service is not running"
        fi
    done
}

# Check system resources
check_resources() {
    log "Checking system resources..."
    echo ""
    
    # CPU usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    info "CPU Usage: ${cpu_usage}%"
    
    # Memory usage
    memory_info=$(free -h | grep "Mem:")
    memory_used=$(echo "$memory_info" | awk '{print $3}')
    memory_total=$(echo "$memory_info" | awk '{print $2}')
    info "Memory Usage: $memory_used / $memory_total"
    
    # Disk usage
    disk_usage=$(df -h / | tail -1 | awk '{print $5}')
    info "Disk Usage: $disk_usage"
    
    # Docker stats
    echo ""
    info "Docker container resource usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# Check logs for errors
check_logs() {
    log "Checking recent logs for errors..."
    echo ""
    
    services=("backend" "nginx" "postgres")
    
    for service in "${services[@]}"; do
        info "Checking $service logs..."
        
        error_count=$(docker-compose -f "$COMPOSE_FILE" logs --tail=100 "$service" 2>/dev/null | grep -i "error\|exception\|failed" | wc -l)
        
        if [[ $error_count -gt 0 ]]; then
            warn "$service has $error_count recent errors"
            docker-compose -f "$COMPOSE_FILE" logs --tail=10 "$service" | grep -i "error\|exception\|failed" || true
        else
            log "$service has no recent errors"
        fi
        echo ""
    done
}

# Check database connectivity
check_database() {
    log "Checking database connectivity..."
    
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        log "✓ Database is accessible"
        
        # Check database size
        db_size=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres \
            psql -U postgres -d inventario_clinica -t -c "SELECT pg_size_pretty(pg_database_size('inventario_clinica'));" 2>/dev/null | xargs)
        info "Database size: $db_size"
        
        # Check active connections
        active_connections=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres \
            psql -U postgres -d inventario_clinica -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | xargs)
        info "Active database connections: $active_connections"
        
    else
        error "✗ Database is not accessible"
    fi
}

# Check API endpoints
check_api() {
    log "Checking API endpoints..."
    
    # Health check
    if curl -f -s http://localhost:3001/health > /dev/null; then
        log "✓ API health endpoint is responding"
    else
        error "✗ API health endpoint is not responding"
    fi
    
    # Check response time
    response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3001/health 2>/dev/null || echo "0")
    info "API response time: ${response_time}s"
}

# Check SSL certificates
check_ssl() {
    log "Checking SSL certificates..."
    
    cert_file="./ssl/cert.pem"
    
    if [[ -f "$cert_file" ]]; then
        # Check certificate expiration
        expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
        expiry_timestamp=$(date -d "$expiry_date" +%s)
        current_timestamp=$(date +%s)
        days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [[ $days_until_expiry -gt 30 ]]; then
            log "✓ SSL certificate is valid for $days_until_expiry days"
        elif [[ $days_until_expiry -gt 0 ]]; then
            warn "SSL certificate expires in $days_until_expiry days"
        else
            error "SSL certificate has expired"
        fi
    else
        warn "SSL certificate file not found"
    fi
}

# Check backup status
check_backups() {
    log "Checking backup status..."
    
    backup_dir="./backups"
    
    if [[ -d "$backup_dir" ]]; then
        backup_count=$(find "$backup_dir" -name "*.sql*" -mtime -7 | wc -l)
        
        if [[ $backup_count -gt 0 ]]; then
            log "✓ Found $backup_count backups from the last 7 days"
            
            # Show latest backup
            latest_backup=$(find "$backup_dir" -name "*.sql*" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
            if [[ -n "$latest_backup" ]]; then
                backup_date=$(stat -c %y "$latest_backup" | cut -d' ' -f1)
                backup_size=$(du -h "$latest_backup" | cut -f1)
                info "Latest backup: $(basename "$latest_backup") ($backup_size, $backup_date)"
            fi
        else
            warn "No recent backups found"
        fi
    else
        warn "Backup directory not found"
    fi
}

# Generate summary report
generate_report() {
    log "Generating monitoring report..."
    
    report_file="./logs/monitoring-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Inventario Clinica System Monitoring Report"
        echo "Generated: $(date)"
        echo "=========================================="
        echo ""
        
        echo "Service Status:"
        docker-compose -f "$COMPOSE_FILE" ps
        echo ""
        
        echo "System Resources:"
        echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%"
        echo "Memory: $(free -h | grep "Mem:" | awk '{print $3 "/" $2}')"
        echo "Disk: $(df -h / | tail -1 | awk '{print $5}')"
        echo ""
        
        echo "Recent Errors:"
        docker-compose -f "$COMPOSE_FILE" logs --tail=100 | grep -i "error\|exception\|failed" | tail -10 || echo "No recent errors found"
        
    } > "$report_file"
    
    info "Report saved to: $report_file"
}

# Show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  status     - Check service status (default)"
    echo "  resources  - Check system resources"
    echo "  logs       - Check logs for errors"
    echo "  database   - Check database connectivity"
    echo "  api        - Check API endpoints"
    echo "  ssl        - Check SSL certificates"
    echo "  backups    - Check backup status"
    echo "  all        - Run all checks"
    echo "  report     - Generate monitoring report"
    echo "  help       - Show this help message"
}

# Main function
main() {
    case "${1:-status}" in
        "status")
            check_services
            ;;
        "resources")
            check_resources
            ;;
        "logs")
            check_logs
            ;;
        "database")
            check_database
            ;;
        "api")
            check_api
            ;;
        "ssl")
            check_ssl
            ;;
        "backups")
            check_backups
            ;;
        "all")
            check_services
            echo ""
            check_resources
            echo ""
            check_database
            echo ""
            check_api
            echo ""
            check_ssl
            echo ""
            check_backups
            echo ""
            check_logs
            ;;
        "report")
            generate_report
            ;;
        "help")
            show_help
            ;;
        *)
            error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"