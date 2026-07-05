#!/usr/bin/env bash
# pre-commit.sh — Lint + TypeCheck before commit
# Install: cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}[pre-commit] Running lint + typecheck...${NC}"

# 1. Lint
echo -e "${CYAN}[pre-commit] Lint (ESLint)...${NC}"
if rtk npm run lint 2>&1; then
  echo -e "${GREEN}  ✅ Lint passed${NC}"
else
  echo -e "${RED}  ❌ Lint failed — commit blocked${NC}"
  exit 1
fi

# 2. Type Check
echo -e "${CYAN}[pre-commit] Type Check (tsc + svelte-check)...${NC}"
if rtk npm run typecheck 2>&1; then
  echo -e "${GREEN}  ✅ Type check passed${NC}"
else
  echo -e "${RED}  ❌ Type check failed — commit blocked${NC}"
  exit 1
fi

echo -e "${GREEN}[pre-commit] All checks passed ✅${NC}"
