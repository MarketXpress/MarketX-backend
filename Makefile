# Makefile - MarketX Backend Engine
# Helper targets for local development and CI

.PHONY: help install start test lint typecheck coverage pr-check doctor local-infra local-infra-down

help:
	@echo "Available commands:"
	@echo "  install          Install dependencies"
	@echo "  start            Start the development server"
	@echo "  test             Run all tests"
	@echo "  lint             Run lint checks"
	@echo "  typecheck        Run TypeScript typechecks"
	@echo "  coverage         Run tests with coverage"
	@echo "  pr-check         Run the pre-PR confidence suite"
	@echo "  doctor           Run environment diagnostics"
	@echo "  local-infra      Start local infrastructure (Docker)"
	@echo "  local-infra-down Stop local infrastructure"

install:
	npm install

start:
	npm run start:dev

test:
	npm run test

lint:
	npm run lint

typecheck:
	npm run typecheck

coverage:
	npm run test:cov

pr-check:
	npm run pr:check

doctor:
	npm run doctor

local-infra:
	docker compose --profile local-dev up -d

local-infra-down:
	docker compose --profile local-dev down

# ── CI / Coverage Gate ──────────────────────────────────────────────────────

ci: lint typecheck test
	@echo "CI checks passed"

node-coverage-check:
	npm run test:coverage:check

node-coverage-domain:
	@echo "Running per-domain coverage reports ..."
	@echo "\n=== Auth Domain ===" && npm run test:coverage:auth || true
	@echo "\n=== Payments Domain ===" && npm run test:coverage:payments || true
	@echo "\n=== Orders Domain ===" && npm run test:coverage:orders || true
	@echo "\n=== Escrow Domain ===" && npm run test:coverage:escrow || true
