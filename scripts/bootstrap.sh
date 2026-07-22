#!/usr/bin/env bash
# =============================================================================
# MarketX Backend – One-Command Local Bootstrap
# Usage: npm run bootstrap  OR  bash scripts/bootstrap.sh
# =============================================================================
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[bootstrap]${RESET} $*"; }
success() { echo -e "${GREEN}[bootstrap] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[bootstrap] ⚠${RESET}  $*"; }
error()   { echo -e "${RED}[bootstrap] ✗${RESET} $*" >&2; }
step()    { echo -e "\n${BOLD}── $* ──${RESET}"; }

# ── Helpers ───────────────────────────────────────────────────────────────────
need_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "Required command '$1' not found. Please install it and re-run."
    exit 1
  fi
}

version_gte() {
  # usage: version_gte "18.0.0" "$(node -v | tr -d 'v')"
  local required="$1" actual="$2"
  printf '%s\n%s\n' "$required" "$actual" | sort -V -C
}

# ── 0. Banner ─────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   MarketX Backend – Local Bootstrap   ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${RESET}"

# ── 1. Prerequisite checks ────────────────────────────────────────────────────
step "Checking prerequisites"

need_cmd node
need_cmd npm
need_cmd docker

NODE_VERSION=$(node -v | tr -d 'v')
if ! version_gte "18.0.0" "$NODE_VERSION"; then
  error "Node.js v18+ is required (found v${NODE_VERSION})."
  exit 1
fi
success "Node.js v${NODE_VERSION}"

DOCKER_COMPOSE_CMD=""
if docker compose version &>/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  DOCKER_COMPOSE_CMD="docker-compose"
else
  error "Docker Compose (plugin or standalone) not found."
  exit 1
fi
success "Docker Compose – using '${DOCKER_COMPOSE_CMD}'"

# ── 2. Environment file ───────────────────────────────────────────────────────
step "Setting up environment"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    success "Created .env from .env.example"
    warn "Review .env and fill in any secrets before running the app."
  else
    error ".env.example not found – cannot create .env automatically."
    exit 1
  fi
else
  info ".env already exists – skipping copy."
fi

# ── 3. Install Node dependencies ─────────────────────────────────────────────
step "Installing Node dependencies"

npm ci --prefer-offline 2>&1 | tail -5
success "npm dependencies installed."

# ── 4. Start local infrastructure ────────────────────────────────────────────
step "Starting local infrastructure (Postgres, Redis, RabbitMQ)"

$DOCKER_COMPOSE_CMD --profile local-dev up -d --remove-orphans

# Wait for Postgres to be healthy (up to 30 s)
info "Waiting for Postgres to be ready..."
for i in $(seq 1 30); do
  if $DOCKER_COMPOSE_CMD exec -T postgres \
       pg_isready -U "${DB_USER:-marketx_user}" -d "${DB_NAME:-marketx}" \
       &>/dev/null 2>&1; then
    success "Postgres is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "Postgres did not become healthy within 30 s."
    error "Run '${DOCKER_COMPOSE_CMD} logs postgres' for details."
    exit 1
  fi
  sleep 1
done

# Wait for Redis
info "Waiting for Redis to be ready..."
for i in $(seq 1 30); do
  if $DOCKER_COMPOSE_CMD exec -T redis redis-cli ping &>/dev/null 2>&1; then
    success "Redis is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "Redis did not become healthy within 30 s."
    exit 1
  fi
  sleep 1
done

# Wait for RabbitMQ
info "Waiting for RabbitMQ to be ready..."
for i in $(seq 1 30); do
  if $DOCKER_COMPOSE_CMD exec -T rabbitmq \
       rabbitmq-diagnostics -q ping &>/dev/null 2>&1; then
    success "RabbitMQ is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    warn "RabbitMQ health check timed out – continuing anyway."
    break
  fi
  sleep 1
done

# ── 5. Run quick smoke checks ─────────────────────────────────────────────────
step "Running pre-flight checks (lint + typecheck + tests)"

npm run pr:check

success "All pre-flight checks passed."

# ── 6. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}Bootstrap complete! 🚀${RESET}"
echo ""
echo -e "  ${CYAN}Start the dev server:${RESET}  npm run start:dev"
echo -e "  ${CYAN}Run tests:${RESET}             npm test"
echo -e "  ${CYAN}Run diagnostics:${RESET}       npm run doctor"
echo -e "  ${CYAN}Stop infrastructure:${RESET}   ${DOCKER_COMPOSE_CMD} --profile local-dev down"
echo ""