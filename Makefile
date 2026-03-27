# Makefile - Rust coverage targets (cargo-tarpaulin)
# Requires: cargo, cargo-tarpaulin, jq or Python3 (for coverage parsing)

COVERAGE_THRESHOLD ?= 95

.PHONY: coverage coverage-check ci

coverage:
	@command -v cargo >/dev/null 2>&1 || { echo "ERROR: cargo not found"; exit 1; }
	@command -v cargo-tarpaulin >/dev/null 2>&1 || { echo "ERROR: cargo-tarpaulin not found. Install with 'cargo install cargo-tarpaulin'"; exit 1; }
	@echo "Running cargo tarpaulin (XML report output) ..."
	@mkdir -p coverage/tarpaulin
	@cargo tarpaulin --out Xml --output-dir coverage/tarpaulin --timeout 120

coverage-check: coverage
	@echo "Checking tarpaulin coverage threshold ($(COVERAGE_THRESHOLD)%) ..."
	@coverage_line_rate=$$(grep -m1 -oP 'line-rate="\K[0-9\.]+(?=\")' coverage/tarpaulin/tarpaulin-report.xml 2>/dev/null || true); \
	if [ -z "$$coverage_line_rate" ]; then \
	  echo "ERROR: could not parse coverage from coverage/tarpaulin/tarpaulin-report.xml"; \
	  exit 1; \
	fi; \
	coverage_percent=$$(python - <<'PY'
import sys
val = float(sys.argv[1]) * 100
print(f"{val:.2f}")
PY "$$coverage_line_rate"); \
	echo "Coverage: $$coverage_percent%"; \
	if [ $$(printf '%s\n' "$(COVERAGE_THRESHOLD)" "$$coverage_percent" | sort -n | head -n1) != "$(COVERAGE_THRESHOLD)" ] && [ $$(printf '%s\n' "$(COVERAGE_THRESHOLD)" "$$coverage_percent" | sort -n | head -n1) != "$$coverage_percent" ]; then \
	  echo "ERROR: coverage threshold not met ($$coverage_percent% < $(COVERAGE_THRESHOLD)%)"; \
	  exit 1; \
	fi
	@echo "PASS: coverage threshold met ($$coverage_percent%)"

ci: coverage-check
	@echo "CI coverage gate passed"
