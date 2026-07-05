# CI/CD Pipeline v2: Fail-Fast + Test-Once

**Date:** 2026-07-05
**Status:** Approved
**Branch:** worktree-fix+cicd-test-fail-fast

## Problem

1. Tests run multiple times (push to feature, PR open, PR merge) — wastes self-hosted runner time (~10-15 min per redundant run)
2. No local safety net before push — broken code reaches CI
3. No fail-fast: build/deploy run even when tests fail
4. ECC plugin references in CLAUDE.md (unused) — confusing workflow instructions

## Solution Overview

Three-level verification + trust-PR-tests approach:

```
Level 1 (local, ~10s):   pre-commit  → lint + typecheck
Level 2 (local, ~2min):  pre-push    → merge main + full CI
Level 3 (CI, ~10min):    PR open/sync → tests
Level 3 (CI, ~5min):     PR merge     → build + deploy (no tests)
```

## Design

### Level 1: Pre-commit Hook

File: `scripts/pre-commit.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
npm run lint
npm run typecheck
```

Install: `cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`

Blocks commit if lint or typecheck fails. Time: ~10 seconds.

### Level 2: Pre-push Hook

File: `scripts/pre-push.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

git fetch origin main
git merge origin/main --no-edit || { echo "Merge conflict with main"; exit 1; }
bash scripts/ci-local.sh || { git merge --abort; exit 1; }
```

Install: `cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push`

Merges latest main before running CI locally. Blocks push if any step fails. On failure, aborts merge to leave clean state. Time: ~2-3 minutes.

### Level 3: GitHub Actions CI/CD

File: `.github/workflows/cicd.yml`

#### Triggers

```yaml
on:
  push:
    branches-ignore: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize]  # no 'closed' — skip tests on merge
  workflow_dispatch:
    inputs:
      skip_tests:
        description: 'Skip tests (emergency)'
        type: boolean
        default: false
      deploy:
        description: 'Deploy to production'
        type: boolean
        default: false
```

#### Jobs

```
push (feature branch):
  lint ─────────┐
  typecheck ────┤  parallel, independent
  test-backend ─┤  if any ❌ → workflow ❌
  test-frontend ┘

PR (opened, synchronize):
  Same as push + branch protection gates merge on ❌

PR merge (or workflow_dispatch + deploy:true):
  build  ─┐  needs: [lint, typecheck, test-backend, test-frontend]
  deploy ─┘  needs: [build], environment: production
```

quality gate jobs: `if: ${{ !(github.event_name == 'pull_request' && github.event.action == 'closed' && github.event.pull_request.merged == false) }}`

build job: `if: ${{ (github.event_name == 'pull_request' && github.event.pull_request.merged == true) || (github.event_name == 'workflow_dispatch' && inputs.deploy) }}`

#### Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Branch Protection (configured in GitHub UI)

| Setting | Value |
|---------|-------|
| Require pull request before merging | ✅ |
| Require status checks to pass | ✅ lint, typecheck, test-backend, test-frontend |
| Require branches to be up to date | ✅ (strict mode) |
| Require conversation resolution | ✅ |

Branch: `main`

### Integration with Worktree Flow

```
EnterWorktree → git commit → pre-commit hook (~10s) → git push → pre-push hook (~2min)
                                                                      ↓
finishing-a-development-branch ← PR ready ← CI tests pass ← GitHub Actions
       ↓
  merge → build → deploy (no test re-run)
```

Hooks work transparently in worktrees — `.git/hooks/` is shared across all worktrees of the same repository. Pre-commit and pre-push run in the worktree's context.

### CLAUDE.md Changes

- Removed ECC Plugin Stack entry, Key ECC Agents, Agent Usage Rules
- ECC Protocol renamed to Build Validation Protocol (Hugo)
- Added detailed 7-phase Superpowers flow
- ECC rules archived to `.claude/rules/.archive/ecc_20260705/`

## Files Changed

| File | Change |
|------|--------|
| `.github/workflows/cicd.yml` | fail-fast needs, test-once triggers, deploy input, concurrency |
| `scripts/pre-commit.sh` | NEW — lint + typecheck hook |
| `scripts/pre-push.sh` | NEW — merge main + full CI hook |
| `CLAUDE.md` | Remove ECC, add Superpowers flow |
| `docs/superpowers/specs/2026-07-05-cicd-fail-fast-test-once-design.md` | This spec |

## Verification

### Pre-commit
```bash
echo "bad code" > test.ts && git add test.ts && git commit -m "test"
# Expected: ❌ lint fails, commit blocked
rm test.ts
```

### Pre-push
```bash
git push --dry-run
# Expected: pre-push runs, merge main, full CI passes
```

### CI
1. Push to feature branch → only quality gates run (no build/deploy)
2. Open PR → same, merge blocked if ❌
3. Merge PR → build + deploy, no test re-run
4. `gh workflow run cicd.yml -f deploy=true` → full cycle with tests + deploy

### Branch Protection
- PR with ❌ tests: merge button greyed out
- PR with ✅ tests but behind main: requires "Update branch" button
- PR with ✅ tests and up to date: merge allowed

## References

- [Using jobs in a workflow — needs](https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow)
- [Events that trigger workflows — pull_request](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request)
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Workflow syntax — concurrency](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#concurrency)
