# CI/CD Pipeline v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three-level verification (pre-commit → pre-push → CI) with test-once policy — tests run on PR, not re-run on merge.

**Architecture:** Two shell hooks (pre-commit, pre-push) for local verification + modified GitHub Actions workflow with `pull_request.types: [opened, synchronize]` (no `closed`) for test-once policy. Branch protection blocks merge until tests pass on latest main.

**Tech Stack:** Bash (hooks), GitHub Actions YAML, Node.js (ci-local.sh)

## Global Constraints

- Test-once: tests run on PR open/sync only, NOT on merge to main
- Fail-fast: build depends on lint, typecheck, test-backend, test-frontend via `needs`
- Pre-commit blocks commit if lint or typecheck fails (`set -euo pipefail`)
- Pre-push merges latest main before running ci-local.sh, aborts merge on failure
- `set -euo pipefail` at top of every shell script
- RTK prefix for all shell commands in hooks (user requirement)
- Worktree-compatible: hooks in `.git/hooks/` shared across worktrees
- Windows-compatible: `#!/usr/bin/env bash` shebang, no `/bin/bash` hardcode

---

### Task 1: Create pre-commit hook script

**Files:**
- Create: `scripts/pre-commit.sh`

**Interfaces:**
- Produces: `scripts/pre-commit.sh` — run by `.git/hooks/pre-commit`, exit 0 = pass, exit 1 = block

- [ ] **Step 1: Create the script file**

```bash
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
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/pre-commit.sh`
Expected: No output, exit 0

- [ ] **Step 3: Install the hook**

Run: `cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
Expected: File copied, exit 0

- [ ] **Step 4: Verify hook works (positive case)**

Run: `bash scripts/pre-commit.sh`
Expected: lint + typecheck run, ✅ All checks passed, exit 0

- [ ] **Step 5: Verify hook works on commit**

Run: `git commit --allow-empty -m "test: pre-commit hook check"`
Expected: pre-commit runs, passes, commit created

- [ ] **Step 6: Clean up test commit**

Run: `git reset --soft HEAD~1`
Expected: Commit removed, changes preserved

- [ ] **Step 7: Commit**

```bash
git add scripts/pre-commit.sh .git/hooks/pre-commit
git commit -m "feat: add pre-commit hook — lint + typecheck before commit"
```

---

### Task 2: Create pre-push hook script

**Files:**
- Create: `scripts/pre-push.sh`

**Interfaces:**
- Produces: `scripts/pre-push.sh` — run by `.git/hooks/pre-push`, exit 0 = pass, exit 1 = block

- [ ] **Step 1: Create the script file**

```bash
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
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/pre-push.sh`
Expected: No output, exit 0

- [ ] **Step 3: Install the hook**

Run: `cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push`
Expected: File copied, exit 0

- [ ] **Step 4: Dry-run verification**

Run: `bash -n scripts/pre-push.sh`
Expected: No syntax errors, exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/pre-push.sh .git/hooks/pre-push
git commit -m "feat: add pre-push hook — merge main + full CI before push"
```

---

### Task 3: Verify cicd.yml trigger architecture (no changes needed)

**Files:**
- Read-only: `.github/workflows/cicd.yml`

**Interfaces:**
- Consumes: current cicd.yml with fail-fast needs chain (PR #10)
- Produces: Confirmation that trigger architecture is correct

**Design decision:** Quality gates MUST run on merge event (`pull_request.closed` with `merged == true`). This is required by `needs` chain — if quality gates are skipped on merge, `build` is also skipped (GitHub Actions default: skipped needs → skipped dependent). The practical optimization comes from:
1. Local pre-commit/pre-push hooks — catch errors before CI
2. `cancel-in-progress: true` — one CI run per branch at a time
3. Branch protection strict mode — block merge if tests fail

Result: max 2 CI test runs per PR (push + merge), down from 4+ before.

- [ ] **Step 1: Verify trigger types are correct**

Run: `grep -A6 '^on:' .github/workflows/cicd.yml`
Expected:
```yaml
on:
  push:
    branches-ignore: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, closed]
  workflow_dispatch:
```

`closed` is required — build job uses `github.event.pull_request.merged == true` which only fires on `closed` event.

- [ ] **Step 2: Verify quality gate conditions**

Run: `grep "if:" .github/workflows/cicd.yml | head -6`

Expected for lint, typecheck, test-backend, test-frontend:
```yaml
if: ${{ !(github.event_name == 'pull_request' && github.event.action == 'closed' && github.event.pull_request.merged == false) }}
```

This means: run on everything EXCEPT PR close WITHOUT merge.
- Push → run ✅
- PR open/sync → run ✅
- PR close (merged) → run ✅ (required for needs chain)
- PR close (not merged) → skip

Quality gates run on merge so `build.needs` is satisfied — dependent jobs don't get skipped.

- [ ] **Step 3: Verify build condition**

Run: `grep -A3 'name: Build' .github/workflows/cicd.yml | grep if:`

Expected:
```yaml
if: ${{ (github.event_name == 'pull_request' && github.event.pull_request.merged == true) || github.event_name == 'workflow_dispatch' }}
```

Build runs on: PR merge OR manual trigger. Combined with `needs`, it only proceeds if quality gates passed.

- [ ] **Step 4: Document the flow**

No code changes. Current architecture is correct. Flow summary:

```
Push to feature → quality gates only (build if: doesn't match)
  └─ cancel-in-progress kills previous push if any

PR open/sync  → same as push (quality gates only)
  └─ branch protection blocks merge if any ❌

PR merge       → quality gates + build + deploy  
  └─ needs chain: build only if quality gates ✅

workflow_dispatch          → quality gates only
workflow_dispatch+deploy   → quality gates + build + deploy
```

- [ ] **Step 5: Skip commit (no changes)**

No files modified in this task.

---

### Task 4: Update cicd.yml — deploy input + build condition

**Files:**
- Modify: `.github/workflows/cicd.yml`

**Interfaces:**
- Consumes: current workflow_dispatch inputs (only skip_tests)
- Produces: workflow_dispatch with skip_tests + deploy inputs; build condition uses inputs.deploy

- [ ] **Step 1: Add deploy input to workflow_dispatch**

Read `.github/workflows/cicd.yml` lines 9-14 (workflow_dispatch section).

Current:
```yaml
  workflow_dispatch:
    inputs:
      skip_tests:
        description: 'Skip tests (emergency deploy only)'
        type: boolean
        default: false
```

New — add `deploy` input after `skip_tests`:
```yaml
  workflow_dispatch:
    inputs:
      skip_tests:
        description: 'Skip tests (emergency deploy only)'
        type: boolean
        default: false
      deploy:
        description: 'Deploy to production after build'
        type: boolean
        default: false
```

- [ ] **Step 2: Update build job condition**

Read `.github/workflows/cicd.yml` line ~188 (build job `if`).

Current:
```yaml
    if: ${{ (github.event_name == 'pull_request' && github.event.pull_request.merged == true) || github.event_name == 'workflow_dispatch' }}
```

New — only run on workflow_dispatch if deploy is explicitly true:
```yaml
    if: ${{ (github.event_name == 'pull_request' && github.event.pull_request.merged == true) || (github.event_name == 'workflow_dispatch' && inputs.deploy) }}
```

This ensures: `gh workflow run cicd.yml` without `-f deploy=true` runs quality gates only (no build/deploy).

- [ ] **Step 3: Verify YAML validity**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/cicd.yml'))"` 2>&1 || echo "yaml module not available — manual review needed"

If Python yaml not available, run: `cat .github/workflows/cicd.yml | grep -A2 'deploy:'`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/cicd.yml
git commit -m "feat: add deploy input to workflow_dispatch — deploy only on explicit request"
```

---

### Task 5: Install hooks and verify end-to-end

**Files:**
- No new files — hooks already created in Tasks 1-2

**Interfaces:**
- Consumes: `scripts/pre-commit.sh`, `scripts/pre-push.sh`
- Produces: Installed hooks in `.git/hooks/`, verified working

- [ ] **Step 1: Verify hooks are installed**

Run: `ls -la .git/hooks/pre-commit .git/hooks/pre-push`
Expected: Both files exist, executable

- [ ] **Step 2: Test pre-commit with passing code**

Run: `git commit --allow-empty -m "test: verify pre-commit passes"`
Expected: pre-commit hook runs lint + typecheck, passes, commit created

- [ ] **Step 3: Clean up test commit**

Run: `git reset --soft HEAD~1`
Expected: Commit removed

- [ ] **Step 4: Document hook installation in README or CLAUDE.md**

No separate step — hooks install is one-time manual action documented below:

```bash
# One-time setup (run in repo root):
cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

- [ ] **Step 5: Commit any remaining changes**

Check: `git status`
If hooks are installed but not tracked (they're in `.git/hooks/` — not tracked normally), nothing to commit.

---

### Task 6: Branch Protection Configuration (Manual)

**This task is manual — documented for reference.**

- [ ] **Step 1: Open GitHub repo settings**

Navigate to: `https://github.com/artikrik/prompt-site-builder/settings/branches`

- [ ] **Step 2: Add branch protection rule**

Click "Add branch protection rule" or edit existing rule for `main`.

Configure:
```
Branch name pattern: main

✅ Require a pull request before merging
   ✅ Require approvals: 1

✅ Require status checks to pass before merging
   Search and select these checks:
   - lint
   - typecheck
   - test-backend
   - test-frontend
   
   ☐ Require branches to be up to date before merging
   (Recommended: ✅ enable for strict mode)

✅ Require conversation resolution before merging

☐ Do not allow bypassing the above settings
   (Recommended: ✅ enable)

☐ Allow force pushes — DO NOT CHECK
☐ Allow deletions — DO NOT CHECK
```

- [ ] **Step 3: Verify protection is active**

Navigate to any PR targeting `main`.
Expected: "Require status checks to pass before merging" section visible in merge box.

- [ ] **Step 4: Test — push bad code to a PR**

Create a branch with lint error, push, open PR.
Expected:
- CI runs lint → ❌ fails
- PR merge box shows: "1 failing check"
- Merge button greyed out

- [ ] **Step 5: Fix and verify**

Fix lint error, push again.
Expected:
- CI runs → ✅ all green
- PR merge box shows: "All checks have passed"
- Merge button green, clickable

---

### Task 7: Final Validation — Full CI Pipeline

**Files:**
- No new files

**Interfaces:**
- Consumes: All changes from Tasks 1-6

- [ ] **Step 1: Run pre-commit hook**

Run: `bash scripts/pre-commit.sh`
Expected: ✅ Lint passed, ✅ Type check passed, exit 0

- [ ] **Step 2: Run ci-local.sh (simulates pre-push without merge)**

Run: `bash scripts/ci-local.sh`
Expected: All 4 steps pass (lint, typecheck, test, build), exit 0

- [ ] **Step 3: Verify all commits are clean**

Run: `git log --oneline -10`
Expected: Recent commits follow the plan tasks, no WIP/merge commits

- [ ] **Step 4: Final push**

Run: `git push`
Expected: Push succeeds, CI triggers on GitHub

- [ ] **Step 5: Verify GitHub Actions**

Run: `gh run list --limit 3`
Expected: Latest workflow run for our branch, check status with `gh run watch`

---

## Summary

```
Task 1: scripts/pre-commit.sh     CREATE   ~10 min
Task 2: scripts/pre-push.sh       CREATE   ~15 min
Task 3: cicd.yml trigger types    VERIFY   ~5 min  (mostly done)
Task 4: cicd.yml deploy input     MODIFY   ~10 min
Task 5: Install hooks + verify    SETUP    ~5 min
Task 6: Branch protection         MANUAL   ~10 min (GitHub UI)
Task 7: Final validation          TEST     ~10 min
                                  TOTAL:   ~65 min
```
