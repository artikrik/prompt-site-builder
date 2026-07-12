#!/usr/bin/env bash
# ci-local.sh — Local CI pipeline (mirrors .github/workflows/cicd.yml)
# Usage: bash scripts/ci-local.sh [--compact]
#   --compact  Minimal output: ESLint compact, vitest dot, errors only on fail.
# Fails fast — first error stops execution.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_step() {
  echo -e "${CYAN}[$1/$TOTAL]${NC} $2..."
}

log_pass() {
  echo -e "  ${GREEN}✅ PASS${NC}"
}

log_fail() {
  echo -e "  ${RED}❌ FAIL${NC}"
  exit 1
}

COMPACT=false
if [[ "${1:-}" == "--compact" ]]; then
  COMPACT=true
fi

TOTAL=4

# ─── 1. Lint ───────────────────────────────────────────
log_step 1 "Lint (ESLint — 0 errors required)"
if $COMPACT; then
  if npx turbo lint -- --format compact 2>&1; then
    log_pass
  else
    log_fail
  fi
else
  if npm run lint 2>&1; then
    log_pass
  else
    log_fail
  fi
fi

# ─── 2. Type Check ─────────────────────────────────────
log_step 2 "Type Check (tsc + svelte-check — 0 errors required)"
if $COMPACT; then
  set +e
  TYPECHECK_OUT=$(npm run typecheck 2>&1)
  TYPECHECK_EXIT=$?
  set -e
  if [ $TYPECHECK_EXIT -eq 0 ]; then
    log_pass
  else
    echo "$TYPECHECK_OUT" | { grep -E "error TS|Error:|error:" | head -20 || echo "$TYPECHECK_OUT" | tail -20; }
    log_fail
  fi
else
  if npm run typecheck 2>&1; then
    log_pass
  else
    log_fail
  fi
fi

# ─── 3. Tests ──────────────────────────────────────────
log_step 3 "Tests (vitest — backend + frontend)"
if $COMPACT; then
  if npx turbo test -- --reporter=dot 2>&1; then
    log_pass
  else
    log_fail
  fi
else
  if npm run test 2>&1; then
    log_pass
  else
    log_fail
  fi
fi

# ─── 4. Build ──────────────────────────────────────────
log_step 4 "Build (production)"
if $COMPACT; then
  set +e
  BUILD_OUT=$(npm run build 2>&1)
  BUILD_EXIT=$?
  set -e
  if [ $BUILD_EXIT -eq 0 ]; then
    log_pass
  else
    echo "$BUILD_OUT" | { grep -iE "error|failed|cannot" | head -20 || echo "$BUILD_OUT" | tail -30; }
    log_fail
  fi
else
  if npm run build 2>&1; then
    log_pass
  else
    log_fail
  fi
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  All CI checks passed — safe to push${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
