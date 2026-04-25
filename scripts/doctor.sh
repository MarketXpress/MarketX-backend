#!/bin/bash

# MarketX Environment Diagnostics (Shell Version)
# No dependencies required except basic shell tools and nc (netcat)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log() {
    local status=$1
    local message=$2
    case $status in
        "PASS") echo -e "${GREEN}✅ [PASS] ${message}${NC}" ;;
        "FAIL") echo -e "${RED}❌ [FAIL] ${message}${NC}" ;;
        "WARN") echo -e "${YELLOW}⚠️ [WARN] ${message}${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️ [INFO] ${message}${NC}" ;;
    esac
}

check_version() {
    local cmd=$1
    local name=$2
    local min_version=$3

    if command -v $cmd &> /dev/null; then
        local version=$($cmd --version)
        log "PASS" "$name: $version"
    else
        log "FAIL" "$name is not installed or not in PATH."
        return 1
    fi
}

check_port() {
    local host=$1
    local port=$2
    local name=$3

    if command -v nc &> /dev/null; then
        if nc -z -w 2 "$host" "$port" &> /dev/null; then
            log "PASS" "$name connection successful ($host:$port)."
        else
            log "FAIL" "$name connection failed ($host:$port). Is the service running?"
        fi
    else
        log "WARN" "nc (netcat) not found, skipping $name port check."
    fi
}

echo -e "\n${BOLD}MarketX Environment Diagnostics${NC}\n"

log "INFO" "--- System Checks ---"
check_version "node" "Node.js"
check_version "npm" "npm"
check_version "docker" "Docker"

if command -v docker-compose &> /dev/null; then
    log "PASS" "Docker Compose: $(docker-compose --version)"
elif docker compose version &> /dev/null; then
    log "PASS" "Docker Compose: $(docker compose version)"
else
    log "FAIL" "Docker Compose is not installed or not in PATH."
fi

echo ""
log "INFO" "--- Environment Checks ---"
if [ -f .env ]; then
    log "PASS" ".env file found."
    # Load .env variables (excluding comments)
    export $(grep -v '^#' .env | xargs)
else
    log "FAIL" ".env file not found. Please copy .env.example to .env"
    env_failed=1
fi

if [ -z "$DATABASE_HOST" ] || [ -z "$DATABASE_PORT" ]; then
    log "FAIL" "Database environment variables not set."
    env_failed=1
fi

if [ -z "$REDIS_HOST" ] || [ -z "$REDIS_PORT" ]; then
    log "FAIL" "Redis environment variables not set."
    env_failed=1
fi

if [ -z "$AMQP_URL" ] && [ -z "$RABBITMQ_URL" ]; then
    log "FAIL" "RabbitMQ environment variables (AMQP_URL/RABBITMQ_URL) not set."
    env_failed=1
fi

if [ "$env_failed" != "1" ]; then
    log "PASS" "Core environment variables are set."
    
    echo ""
    log "INFO" "--- Service Connectivity (Port Checks) ---"
    check_port "$DATABASE_HOST" "$DATABASE_PORT" "PostgreSQL"
    check_port "$REDIS_HOST" "$REDIS_PORT" "Redis"
    
    # Extract host and port from AMQP_URL if possible
    # amqp://guest:guest@localhost:5672
    if [[ $AMQP_URL =~ @([^:]+):([0-9]+) ]]; then
        check_port "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "RabbitMQ"
    elif [ -n "$RABBITMQ_HOST" ] && [ -n "$RABBITMQ_PORT" ]; then
        check_port "$RABBITMQ_HOST" "$RABBITMQ_PORT" "RabbitMQ"
    else
        log "WARN" "Could not parse RabbitMQ host/port from AMQP_URL for port check."
    fi
fi

echo -e "\n${BOLD}Diagnostics Complete!${NC}\n"
