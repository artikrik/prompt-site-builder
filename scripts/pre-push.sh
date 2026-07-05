#!/usr/bin/env bash
# pre-push.sh — Merge latest main + full CI before push
# Install: cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

ORIGINAL_BRANCH=$(git branch --show-current)

echo -e "${CYAN}[pre-push] Merging latest main + running full CI...${NC}"
echo -e "${CYAN}[pre-push] Current branch: ${ORIGINAL_BRANCH}${NC}"

# 1. Fetch latest main
echo -e "${CYAN}[pre-push] Fetching origin/main...${NC}"
rtk git fetch origin main

# 2. Stash uncommitted changes if any
STASHED=false
if ! git diff-index --quiet HEAD --; then
  echo -e "${CYAN}[pre-push] Stashing uncommitted changes...${NC}"
  rtk git stash push -u -m "pre-push-auto-stash"
  STASHED=true
fi

# 3. Merge latest main
echo -e "${CYAN}[pre-push] Merging origin/main into ${ORIGINAL_BRANCH}...${NC}"
if ! git merge origin/main --no-edit; then
  echo -e "${RED}[pre-push] ❌ Merge conflict with main. Resolve conflicts and retry.${NC}"
  git merge --abort 2>/dev/null || true
  if [ "$STASHED" = true ]; then rtk git stash pop; fi
  exit 1
fi

# 4. Run full CI pipeline
echo -e "${CYAN}[pre-push] Running full CI pipeline...${NC}"
CI_FAILED=false
if ! bash scripts/ci-local.sh 2>&1; then
  CI_FAILED=true
fi

# 5. If CI failed, abort merge
if [ "$CI_FAILED" = true ]; then
  echo -e "${RED}[pre-push] ❌ CI failed. Aborting merge...${NC}"
  git merge --abort
  if [ "$STASHED" = true ]; then
    echo -e "${CYAN}[pre-push] Restoring stashed changes...${NC}"
    rtk git stash pop
  fi
  echo -e "${RED}[pre-push] Push blocked. Fix CI issues and retry.${NC}"
  exit 1
fi

# 6. Success — merge stays, push proceeds
echo -e "${GREEN}[pre-push] ✅ CI passed on merged code${NC}"
echo -e "${GREEN}[pre-push] Push allowed${NC}"

# Restore stashed changes on top of merged code
if [ "$STASHED" = true ]; then
  echo -e "${CYAN}[pre-push] Restoring stashed changes...${NC}"
  rtk git stash pop
fi
