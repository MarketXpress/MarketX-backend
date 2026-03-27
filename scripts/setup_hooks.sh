#!/bin/sh
# setup_hooks.sh
# Installs a Git pre-commit hook that runs cargo fmt and cargo clippy.

set -e

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
HOOKS_DIR="$ROOT_DIR/.git/hooks"
PRE_COMMIT="$HOOKS_DIR/pre-commit"

if [ ! -d "$ROOT_DIR/.git" ]; then
  echo "Error: this script must be run from inside a git repository."
  exit 1
fi

if [ ! command -v cargo >/dev/null 2>&1 ]; then
  echo "Error: cargo command not found. Install Rust toolchain first."
  exit 1
fi

cat > "$PRE_COMMIT" <<'EOF'
#!/bin/sh

echo "Running cargo fmt --all -- --check"
if ! cargo fmt --all -- --check; then
  echo "\nERROR: cargo fmt check failed. Please run 'cargo fmt --all' and commit again."
  exit 1
fi

echo "Running cargo clippy --all-targets --all-features -- -D warnings"
if ! cargo clippy --all-targets --all-features -- -D warnings; then
  echo "\nERROR: cargo clippy failed. Fix issues and commit again."
  exit 1
fi

exit 0
EOF

chmod +x "$PRE_COMMIT"

echo "Installed pre-commit hook at $PRE_COMMIT"
