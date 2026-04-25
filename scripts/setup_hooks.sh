#!/bin/sh
# setup_hooks.sh
# Installs a Git pre-commit hook that runs linting and typechecking.

set -e

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
HOOKS_DIR="$ROOT_DIR/.git/hooks"
PRE_COMMIT="$HOOKS_DIR/pre-commit"

if [ ! -d "$ROOT_DIR/.git" ]; then
  echo "Error: this script must be run from inside a git repository."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm command not found. Install Node.js first."
  exit 1
fi

cat > "$PRE_COMMIT" <<'EOF'
#!/bin/sh

echo "Running npm run lint..."
if ! npm run lint; then
  echo "\nERROR: lint check failed. Please fix issues and commit again."
  exit 1
fi

echo "Running npm run typecheck..."
if ! npm run typecheck; then
  echo "\nERROR: typecheck failed. Fix issues and commit again."
  exit 1
fi

exit 0
EOF

chmod +x "$PRE_COMMIT"

echo "Installed pre-commit hook at $PRE_COMMIT"
