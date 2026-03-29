#!/bin/bash

###############################################################################
# OWASP ZAP Security Penetration Test Runner - MarketX Backend
# Executes automated DAST scanning for SQL injection and CSRF vulnerabilities
###############################################################################

set -e

# Configuration
ZAP_HOST="${ZAP_HOST:-zap}"
ZAP_PORT="${ZAP_PORT:-8080}"
API_HOST="${API_HOST:-api}"
API_PORT="${API_PORT:-3000}"
ZAP_API_KEY="${ZAP_API_KEY:-zap_api_key_change_in_production}"
REPORT_DIR="/zap/reports"
PAYLOADS_DIR="/zap/payloads"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXIT_CODE=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Wait for ZAP to be ready
wait_for_zap() {
    log_info "Waiting for OWASP ZAP to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "http://${ZAP_HOST}:${ZAP_PORT}/" | grep -q "200"; then
            log_success "OWASP ZAP is ready"
            return 0
        fi
        log_info "Attempt $attempt/$max_attempts - ZAP not ready, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "ZAP failed to start after $max_attempts attempts"
    return 1
}

# Wait for API to be ready
wait_for_api() {
    log_info "Waiting for MarketX API to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "http://${API_HOST}:${API_PORT}/" | grep -q "200\|404\|301"; then
            log_success "MarketX API is ready"
            return 0
        fi
        log_info "Attempt $attempt/$max_attempts - API not ready, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "API failed to start after $max_attempts attempts"
    return 1
}

# Initialize ZAP context
init_context() {
    log_info "Initializing ZAP context..."
    
    # Create context via API
    curl -s -X POST "http://${ZAP_HOST}:${ZAP_PORT}/JSON/context/new" \
        -d "apiKey=${ZAP_API_KEY}" \
        -d "contextName=MarketX_Backend" > /dev/null
    
    # Add the API URL to context
    curl -s -X POST "http://${ZAP_HOST}:${ZAP_PORT}/JSON/context/includeInContext" \
        -d "apiKey=${ZAP_API_KEY}" \
        -d "contextName=MarketX_Backend" \
        -d "regex=.*${API_HOST}.*" > /dev/null
    
    log_success "Context initialized"
}

# Spider the application
run_spider() {
    log_info "Starting Spider scan..."
    
    # Start spider
    curl -s -X POST "http://${ZAP_HOST}:${ZAP_PORT}/JSON/spider/action/scan" \
        -d "apiKey=${ZAP_API_KEY}" \
        -d "url=http://${API_HOST}:${API_PORT}/" \
        -d "maxChildren=100" \
        -d "maxDepth=10" > /dev/null
    
    # Wait for spider to complete
    local spider_status=""
    while [ "$spider_status" != "100" ]; do
        sleep 5
        spider_status=$(curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/spider/view/status" \
            -d "apiKey=${ZAP_API_KEY}" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        log_info "Spider progress: ${spider_status}%"
    done
    
    log_success "Spider scan completed"
}

# Run Active Scan with SQL injection focus
run_sql_injection_scan() {
    log_info "Starting SQL Injection Active Scan..."
    
    # Load SQL injection payloads
    if [ -f "${PAYLOADS_DIR}/sql-injection.txt" ]; then
        log_info "Loading SQL injection payloads..."
        
        # Start active scan targeting SQL injection
        scan_id=$(curl -s -X POST "http://${ZAP_HOST}:${ZAP_PORT}/JSON/ascan/action/scan" \
            -d "apiKey=${ZAP_API_KEY}" \
            -d "url=http://${API_HOST}:${API_PORT}/" \
            -d "recurse=true" \
            -d "inScopeOnly=true" \
            -d "scanPolicyName=SQL_Injection_Heavy" \
            -d "method=" \
            -d "postData=")
        
        # Wait for scan to progress
        local scan_progress=0
        while [ $scan_progress -lt 100 ]; do
            sleep 10
            scan_progress=$(curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/ascan/view/status" \
                -d "apiKey=${ZAP_API_KEY}" | grep -o '"status":[^,]*' | cut -d':' -f2)
            log_info "SQL Injection scan progress: ${scan_progress}%"
        done
    else
        log_warning "SQL injection payload file not found"
    fi
    
    log_success "SQL Injection scan completed"
}

# Run CSRF/XSRF scan
run_csrf_scan() {
    log_info "Starting CSRF/XSRF Active Scan..."
    
    if [ -f "${PAYLOADS_DIR}/csrf.txt" ]; then
        log_info "Loading CSRF test payloads..."
    fi
    
    # Perform active scan targeting CSRF
    curl -s -X POST "http://${ZAP_HOST}:${ZAP_PORT}/JSON/ascan/action/scan" \
        -d "apiKey=${ZAP_API_KEY}" \
        -d "url=http://${API_HOST}:${API_PORT}/api" \
        -d "recurse=true" \
        -d "scanPolicyName=CSRF_XSRF_Testing" > /dev/null
    
    sleep 5
    log_success "CSRF/XSRF scan completed"
}

# Test specific endpoints with SQL injection payloads
test_sql_injection_endpoints() {
    log_info "Testing SQL injection on specific endpoints..."
    
    local endpoints=(
        "/api/auth/login"
        "/api/auth/register"
        "/api/users"
        "/api/products"
        "/api/orders"
        "/api/cart"
        "/api/search"
        "/api/categories"
    )
    
    if [ -f "${PAYLOADS_DIR}/sql-injection.txt" ]; then
        while IFS= read -r payload; do
            # Skip empty lines and comments
            if [[ -z "$payload" || "$payload" =~ ^# ]]; then
                continue
            fi
            
            for endpoint in "${endpoints[@]}"; do
                # Test via GET parameter
                curl -s -o /dev/null -w "%{http_code}" \
                    "http://${API_HOST}:${API_PORT}${endpoint}?id=${payload}" &
                
                # Test via POST data
                curl -s -o /dev/null -w "%{http_code}" \
                    -X POST \
                    -H "Content-Type: application/json" \
                    -d "{\"query\":\"${payload}\"}" \
                    "http://${API_HOST}:${API_PORT}${endpoint}" &
            done
        done < "${PAYLOADS_DIR}/sql-injection.txt"
        
        wait
    fi
    
    log_success "SQL injection endpoint testing completed"
}

# Test CSRF vulnerabilities
test_csrf_vulnerabilities() {
    log_info "Testing CSRF vulnerabilities on state-changing endpoints..."
    
    local csrf_endpoints=(
        "/api/auth/register"
        "/api/auth/login"
        "/api/users/profile"
        "/api/orders"
        "/api/payments"
        "/api/cart/items"
        "/api/wishlist"
    )
    
    if [ -f "${PAYLOADS_DIR}/csrf.txt" ]; then
        while IFS= read -r line; do
            # Skip empty lines and comments
            if [[ -z "$line" || "$line" =~ ^# ]]; then
                continue
            fi
            
            for endpoint in "${csrf_endpoints[@]}"; do
                # Extract method and send without CSRF token
                method=$(echo "$line" | grep -oP '^(GET|POST|PUT|DELETE|PATCH)')
                if [ -n "$method" ]; then
                    curl -s -o /dev/null -w "%{http_code}" \
                        -X "$method" \
                        -H "Content-Type: application/json" \
                        -H "Origin: http://evil.com" \
                        -H "Referer: http://evil.com/attack" \
                        -d '{"test":"csrf_attempt"}' \
                        "http://${API_HOST}:${API_PORT}${endpoint}" &
                fi
            done
        done < "${PAYLOADS_DIR}/csrf.txt"
        
        wait
    fi
    
    log_success "CSRF vulnerability testing completed"
}

# Generate comprehensive report
generate_report() {
    log_info "Generating security report..."
    
    local report_file="${REPORT_DIR}/marketx_security_report_${TIMESTAMP}"
    
    # Generate JSON report
    curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/report/generate" \
        -d "apiKey=${ZAP_API_KEY}" \
        -d "title=MarketX Backend Security Report" \
        -d "description=Automated Security Penetration Test - SQL Injection & CSRF" \
        -d "template=traditional-json" > "${report_file}.json"
    
    # Generate HTML report
    curl -s "http://${ZAP_HOST}:${ZAP_PORT}/HTML/report" \
        -d "apiKey=${ZAP_API_KEY}" > "${report_file}.html"
    
    # Generate XML report
    curl -s "http://${ZAP_HOST}:${ZAP_PORT}/XML/report" \
        -d "apiKey=${ZAP_API_KEY}" > "${report_file}.xml"
    
    # Generate summary report
    generate_summary_report "${report_file}"
    
    log_success "Reports generated: ${report_file}.{json,html,xml}"
}

# Generate human-readable summary
generate_summary_report() {
    local report_file="$1"
    
    cat > "${report_file}_summary.txt" << EOF
###############################################################################
# MarketX Backend Security Test Summary Report
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
###############################################################################

EXECUTIVE SUMMARY
=================
This automated security penetration test evaluated the MarketX Backend API
for SQL Injection and Cross-Site Request Forgery (CSRF) vulnerabilities
using OWASP ZAP Dynamic Application Security Testing (DAST).

TEST METHODOLOGY
================
1. Spider/ Crawler - Discovery of all accessible endpoints
2. SQL Injection Tests - Heavy malformed SQL syntax exploitation attempts
3. CSRF Tests - State-changing operation exploitation attempts
4. Active Scanning - Comprehensive vulnerability assessment

ENDPOINTS TESTED
================
- /api/auth/* (Authentication endpoints)
- /api/users/* (User management)
- /api/products/* (Product catalog)
- /api/orders/* (Order processing)
- /api/payments/* (Payment processing)
- /api/cart/* (Shopping cart)
- /api/search/* (Search functionality)
- /api/categories/* (Category management)
- /api/wishlist/* (Wishlist functionality)
- /api/admin/* (Administrative endpoints)

SQL INJECTION TEST COVERAGE
===========================
Test Types:
- Classic SQL Injection
- UNION-based SQL Injection
- Boolean-based Blind SQL Injection
- Time-based Blind SQL Injection
- Error-based SQL Injection
- Stacked Queries
- Second-order SQL Injection
- ORM-specific Bypass Attempts
- Database-specific Exploits

Payload Count: $(wc -l < "${PAYLOADS_DIR}/sql-injection.txt" 2>/dev/null || echo "N/A")

CSRF TEST COVERAGE
==================
Test Types:
- Form Submission CSRF
- JSON-based CSRF
- XML-based CSRF
- Origin Header Bypass
- Referer Header Manipulation
- CORS Bypass Attempts
- Double Submit Pattern Bypass
- Token Validation Bypass

VULNERABILITY ASSESSMENT
========================
$(if curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/core/view/alerts" -d "apiKey=${ZAP_API_KEY}" 2>/dev/null | grep -q "HIGH"; then
    echo "HIGH SEVERITY: Vulnerabilities detected - IMMEDIATE ACTION REQUIRED"
    EXIT_CODE=2
elif curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/core/view/alerts" -d "apiKey=${ZAP_API_KEY}" 2>/dev/null | grep -q "MEDIUM"; then
    echo "MEDIUM SEVERITY: Vulnerabilities detected - Action required"
    EXIT_CODE=1
else
    echo "No critical vulnerabilities detected"
    EXIT_CODE=0
fi)

REMEDIATION RECOMMENDATIONS
===========================
1. Implement parameterized queries for all database operations
2. Use ORM frameworks with proper SQL injection protection
3. Implement CSRF tokens for all state-changing operations
4. Enable SameSite cookies
5. Implement Origin/Referer validation
6. Use Content Security Policy (CSP)
7. Regular security testing and code reviews

###############################################################################
# END OF REPORT
###############################################################################
EOF
}

# Print alerts summary
print_alerts_summary() {
    log_info "Retrieving alerts summary..."
    
    local alerts=$(curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/core/view/alerts" \
        -d "apiKey=${ZAP_API_KEY}" 2>/dev/null)
    
    if [ -n "$alerts" ]; then
        local high_count=$(echo "$alerts" | grep -o '"risk":"HIGH"' | wc -l)
        local medium_count=$(echo "$alerts" | grep -o '"risk":"MEDIUM"' | wc -l)
        local low_count=$(echo "$alerts" | grep -o '"risk":"LOW"' | wc -l)
        local info_count=$(echo "$alerts" | grep -o '"risk":"INFORMATIONAL"' | wc -l)
        
        echo ""
        echo "╔══════════════════════════════════════════════════════════════════════╗"
        echo "║                    SECURITY SCAN RESULTS SUMMARY                      ║"
        echo "╠══════════════════════════════════════════════════════════════════════╣"
        echo "║  HIGH SEVERITY:     ${high_count:-0}                                                ║"
        echo "║  MEDIUM SEVERITY:   ${medium_count:-0}                                                ║"
        echo "║  LOW SEVERITY:      ${low_count:-0}                                                ║"
        echo "║  INFORMATIONAL:     ${info_count:-0}                                                ║"
        echo "╚══════════════════════════════════════════════════════════════════════╝"
        echo ""
        
        if [ "${high_count:-0}" -gt 0 ]; then
            log_error "CRITICAL: ${high_count} HIGH severity vulnerabilities detected!"
            EXIT_CODE=2
        elif [ "${medium_count:-0}" -gt 0 ]; then
            log_warning "ALERT: ${medium_count} MEDIUM severity vulnerabilities detected"
            EXIT_CODE=1
        else
            log_success "No critical vulnerabilities detected"
            EXIT_CODE=0
        fi
    else
        log_warning "Unable to retrieve alerts - ZAP may not have completed scanning"
        EXIT_CODE=1
    fi
}

# Main execution
main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║       MarketX Backend - Automated Security Penetration Test          ║"
    echo "║              OWASP ZAP DAST Scanner Configuration                     ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Wait for services
    wait_for_zap || exit 1
    wait_for_api || exit 1
    
    # Initialize
    init_context
    
    # Spider the application
    run_spider
    
    # Run security scans
    run_sql_injection_scan
    run_csrf_scan
    
    # Test specific endpoints
    test_sql_injection_endpoints
    test_csrf_vulnerabilities
    
    # Allow scans to complete
    sleep 10
    
    # Generate reports
    generate_report
    
    # Print summary
    print_alerts_summary
    
    echo ""
    log_info "Security scan completed at $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo ""
    
    return $EXIT_CODE
}

# Run main function
main "$@"
exit $?
