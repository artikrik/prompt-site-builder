# Token Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce input token consumption by ~78% (640 → ~140 lines) by removing unused rules files and compressing remaining project memory.

**Architecture:** 4 tasks — delete 8 unused rules, rewrite CLAUDE.md in caveman format, compress testing.md, compress security.md. All filesystem operations, no code changes.

**Tech Stack:** Git, file ops only. No dependencies.

## Global Constraints

- Target: ~78% reduction in project-context lines (from ~640 to ~140)
- Keep: Hugo Theme Engine rules verbatim (CRITICAL project-specific knowledge)
- Keep: testing.md + security.md (compressed to caveman format)
- Delete: agents.md, code-review.md, coding-style.md, development-workflow.md, git-workflow.md, hooks.md, patterns.md, performance.md
- Branch: current branch (`main` in worktree `fix+turbo-cache-ci`)
- No code changes, only .md and config files

---
````

### Task 1: Delete 8 Unused Rules Files

**Files:**
- Delete: `.claude/rules/ecc/common/agents.md`
- Delete: `.claude/rules/ecc/common/code-review.md`
- Delete: `.claude/rules/ecc/common/coding-style.md`
- Delete: `.claude/rules/ecc/common/development-workflow.md`
- Delete: `.claude/rules/ecc/common/git-workflow.md`
- Delete: `.claude/rules/ecc/common/hooks.md`
- Delete: `.claude/rules/ecc/common/patterns.md`
- Delete: `.claude/rules/ecc/common/performance.md`

**Interfaces:**
- Consumes: Nothing
- Produces: Clean `.claude/rules/ecc/common/` — only testing.md + security.md remain

- [ ] **Step 1: Delete the 8 rule files**

```bash
rm .claude/rules/ecc/common/agents.md
rm .claude/rules/ecc/common/code-review.md
rm .claude/rules/ecc/common/coding-style.md
rm .claude/rules/ecc/common/development-workflow.md
rm .claude/rules/ecc/common/git-workflow.md
rm .claude/rules/ecc/common/hooks.md
rm .claude/rules/ecc/common/patterns.md
rm .claude/rules/ecc/common/performance.md
```

- [ ] **Step 2: Verify only 2 files remain**

Run: `ls -la .claude/rules/ecc/common/`
Expected: `testing.md` and `security.md` only

- [ ] **Step 3: Commit**

```bash
git add .claude/rules/ecc/common/
git commit -m "chore: remove 8 unused rules files (-430 lines, ~81% rules reduction)"
```

### Task 2: Rewrite CLAUDE.md in Caveman Format

**Files:**
- Modify: `CLAUDE.md` — full rewrite

**Interfaces:**
- Consumes: Hugo Theme Engine rules, commands, stack info from current CLAUDE.md
- Produces: Compressed CLAUDE.md (~40 lines vs 105)

- [ ] **Step 1: Write compressed CLAUDE.md**

Replace entire file content with:

```markdown
# prompt-site-builder

## Architecture
- Admin Dashboard: NestJS 11 + SvelteKit 2 — leads, site generation, settings
- Site Engine: Hugo SSG — client websites from AI content + themes
- Reverse Proxy: Caddy — On-Demand TLS, `/client-sites/<slug>/public`

## Stack
Backend: NestJS 11, Prisma, PostgreSQL, Redis, BullMQ
Frontend: SvelteKit 2, Svelte 5, Tailwind CSS v4, shadcn-svelte
AI: Anthropic/OpenAI (content + image generation)
Site Gen: Hugo extended, git submodules for themes
Infra: Docker Compose, Caddy, GitHub Actions
Monorepo: Turborepo (apps/backend, apps/frontend, packages/shared)

## Model Selection
- deepseek-v4-flash: mechanical — docs, grep, format, commits, PRs, config, CI, dead-code
- deepseek-v4-pro[1m]: code — edits, bugs, refactors, features, tests, review, security, debug
- Subagents: flash for mechanical; pro for code

## Commands
- `turbo dev|build|test|lint|typecheck|format`
- Pre-commit CI: `bash scripts/ci-local.sh` (lint → typecheck → test → build)
- Hugo: `hugo --source ./client-sites/<slug>`

## Branching
- `feat/<name>`, `fix/<name>`, `refactor/<name>` → main
- Squash merge only. Status checks: lint, typecheck, test-backend, test-frontend.
- No force pushes, no deletions.

## Hugo Theme Engine (CRITICAL)

### Directory Structure
```
/client-sites/<slug>/   # one per client
  /content/             # AI-generated Markdown
  /themes/<theme>/      # git submodule
  hugo.toml             # AI-generated config
  /public/              # built site, served by Caddy
```

### Theme → Category Mapping
| Theme | Categories |
|-------|------------|
| ananke | Law, Consulting |
| hugo-fresh | Medical, Cleaning, Vet |
| hugo-hero-theme | Salon, Gym |
| hugo-universal-theme | Construction, Real Estate, Auto |
| hugo-scroll | Plumbers, Logistics |

Git URLs: github.com/theNewDynamic/gohugo-theme-ananke, /StefMa/hugo-fresh, /zerostaticthemes/hugo-hero-theme, /devcows/hugo-universal-theme, /janraasch/hugo-scroll

### Key Rules
- NEVER raw HTML. ALWAYS hugo.toml + Markdown Front Matter matching theme schema.
- System prompt MUST include theme's config schema (params, sections, front matter).
- Build: generate → `hugo --source ./client-sites/<slug>` → parse errors → fix → EXIT 0.
- Verify: `node scripts/test-pipeline.js`

## Key Constraints
- External API calls MUST be mocked in tests.
- `validateEnv()` must be called at startup (currently NOT wired).
- `RolesGuard` exists but NOT connected in app.module.ts.
- Hugo themes via git submodule — never commit theme code.
- Generated sites MUST pass `hugo build` EXIT 0 before publishing.
```

- [ ] **Step 2: Verify line count**

Run: `wc -l CLAUDE.md`
Expected: ~50 lines or fewer

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: compress CLAUDE.md to caveman format (105→40 lines, -62%)"
```

### Task 3: Compress testing.md

**Files:**
- Modify: `.claude/rules/ecc/common/testing.md` — full rewrite

**Interfaces:**
- Consumes: Current testing.md content
- Produces: Compressed testing.md (~25 lines vs 57)

- [ ] **Step 1: Write compressed testing.md**

Replace entire file content with:

```markdown
# Testing

## Coverage: 80%+ required
- Unit/Integration: vitest (backend + frontend)
- E2E frontend: playwright test
- E2E backend: vitest run --config vitest.e2e.config.ts
- Hugo build: hugo --source ./client-sites/<slug> (build validation)

## TDD
RED → GREEN → IMPROVE. Use superpowers tdd-guide agent.
1. Write test (should FAIL)
2. Minimal implementation (should PASS)
3. Refactor
4. Verify 80%+ coverage

## AAA Pattern
```typescript
test('descriptive name of behavior', () => {
  // Arrange
  const input = ...
  // Act
  const result = functionUnderTest(input)
  // Assert
  expect(result).toBe(expected)
})
```

## Test Names
Descriptive: "returns empty array when no markets match query", "throws error when API key is missing"

## Rules
- External API calls MUST be mocked.
- If test fails: check isolation → verify mocks → fix implementation (not tests, unless tests wrong).
- CI: bash scripts/ci-local.sh (lint → typecheck → test → build).
```

- [ ] **Step 2: Verify line count**

Run: `wc -l .claude/rules/ecc/common/testing.md`
Expected: ~35 lines or fewer (was 57)

- [ ] **Step 3: Commit**

```bash
git add .claude/rules/ecc/common/testing.md
git commit -m "chore: compress testing.md to caveman format (57→35 lines, -39%)"
```

### Task 4: Compress security.md

**Files:**
- Modify: `.claude/rules/ecc/common/security.md` — full rewrite

**Interfaces:**
- Consumes: Current security.md content
- Produces: Compressed security.md (~18 lines vs 29)

- [ ] **Step 1: Write compressed security.md**

Replace entire file content with:

```markdown
# Security

## Pre-Commit Checklist
- [ ] No hardcoded secrets (API keys, passwords, tokens) — use env vars
- [ ] User input validated at system boundaries
- [ ] SQL injection: parameterized queries (Prisma), never string concat
- [ ] XSS: sanitize HTML, escape output
- [ ] CSRF protection enabled
- [ ] Auth verified
- [ ] Rate limiting on all endpoints
- [ ] Error messages: no sensitive data leak

## Secret Management
- NEVER hardcode. ALWAYS env vars or secret manager.
- Validate required secrets at startup (validateEnv).
- Rotate exposed secrets immediately.

## Security Incident
1. STOP → security-reviewer agent
2. Fix CRITICAL issues first
3. Rotate exposed secrets
4. Audit codebase for similar issues
```

- [ ] **Step 2: Verify line count**

Run: `wc -l .claude/rules/ecc/common/security.md`
Expected: ~28 lines or fewer (was 29)

- [ ] **Step 3: Commit**

```bash
git add .claude/rules/ecc/common/security.md
git commit -m "chore: compress security.md to caveman format (29→22 lines, -24%)"
```

### Task 5: Final Verification

**Files:**
- Check: `CLAUDE.md`
- Check: `.claude/rules/ecc/common/`

**Interfaces:**
- Consumes: All previous task outputs
- Produces: Verified clean state

- [ ] **Step 1: Verify final state**

```bash
echo "=== CLAUDE.md ===" && wc -l CLAUDE.md && echo "=== Rules ===" && ls .claude/rules/ecc/common/ && echo "=== Total rule lines ===" && wc -l .claude/rules/ecc/common/*.md
```

- [ ] **Step 2: Git status check**

Run: `git status`
Expected: clean working tree

- [ ] **Step 3: Verify Hugo rules preserved**

Run: `grep -c "hugo" CLAUDE.md`
Expected: > 5 (Hugo rules intact)

- [ ] **Step 4: Verify model selection preserved**

Run: `grep -c "deepseek" CLAUDE.md`
Expected: > 2

- [ ] **Step 5: Final commit (if any remaining changes)**

```bash
git status
# If clean: done. If not: commit remaining.
```
````
