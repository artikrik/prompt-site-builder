#!/usr/bin/env bash
# ci-local.sh — Local CI pipeline (mirrors .github/workflows/cicd.yml)
# Usage: bash scripts/ci-local.sh
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

TOTAL=4

# ─── 1. Lint ───────────────────────────────────────────
log_step 1 "Lint (ESLint — 0 errors required)"
if npm run lint 2>&1; then
  log_pass
else
  log_fail
fi

# ─── 2. Type Check ─────────────────────────────────────
log_step 2 "Type Check (tsc + svelte-check — 0 errors required)"
if npm run typecheck 2>&1; then
  log_pass
else
  log_fail
fi

# ─── 3. Tests ──────────────────────────────────────────
log_step 3 "Tests (vitest — backend + frontend)"
if npm run test 2>&1; then
  log_pass
else
  log_fail
fi

# ─── 4. Build ──────────────────────────────────────────
log_step 4 "Build (production)"
if npm run build 2>&1; then
  log_pass
else
  log_fail
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  All CI checks passed — safe to push${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
