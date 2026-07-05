# prompt-site-builder

## Architecture Overview
- **Admin Dashboard:** NestJS 11 + SvelteKit 2 — lead management, site generation, settings
- **Site Engine:** Hugo SSG — generates client websites from AI-produced content + themes
- **Reverse Proxy:** Caddy — On-Demand TLS, serves `/client-sites/<slug>/public` dynamically

## Stack
- **Backend:** NestJS 11, Prisma, PostgreSQL, Redis, BullMQ
- **Frontend:** SvelteKit 2, Svelte 5, Tailwind CSS v4, shadcn-svelte
- **AI:** Anthropic/OpenAI APIs (content generation, image generation)
- **Site Generator:** Hugo (extended), git submodules for themes
- **Infra:** Docker Compose, Caddy (On-Demand TLS), GitHub Actions
- **Monorepo:** Turborepo (apps/backend, apps/frontend, packages/shared)

## RTK (Rust Token Killer)
**ALL console commands MUST use `rtk` proxy.** Saves 60-90% tokens on dev operations.
**Bash/PowerShell: жодних прямих викликів.** Кожна shell команда — тільки через `rtk`.
Навіть у ланцюжках з `&&`: `rtk git add . && rtk git commit -m "msg" && rtk git push`
Before using native Read/Grep/Glob/Update etc. tools, ALWSAYS use `rtk`: example `rtk read`/`rtk grep`/`rtk find`, use RTK ALWSAYS.
Також використовуй ці правела в агентах, субагентах і усюди, де це можливо
```bash
rtk gain              # Token savings analytics
rtk gain --history    # Command history with savings
rtk discover          # Find missed opportunities
rtk proxy <cmd>       # Raw command (debugging)
```

Examples: `rtk git status`, `rtk npm install`, `rtk turbo build`

### RTK File Operations (CRITICAL)
**Prefer `rtk` shell equivalents over native Claude tools.** Native tools (Read, Grep, Glob) bypass the RTK hook — use `rtk read`/`rtk grep`/`rtk find` for 60-75% token savings.

| Native Tool | RTK Equivalent | Savings |
|-------------|---------------|---------|
| Read (tool) | `rtk read <file>` | ~60% |
| Grep (tool) | `rtk grep <pattern>` | ~75% |
| Glob (tool) | `rtk find <pattern>` | ~70% |
| Bash `cat`  | `rtk read <file>` | ~60% |
| Bash `rg`   | `rtk grep <pattern>` | ~75% |
| Bash `ls`   | `rtk ls <path>` | ~65% |

## Branching Strategy (GitHub Flow)

**One default branch: `main`.** All work branches from `main`, all PRs to `main`, deploy from `main`.

| Rule | Detail |
|------|--------|
| Default branch | `main` (protected) |
| Feature branches | `feat/<name>`, `fix/<name>`, `refactor/<name>` |
| PR target | `main` |
| Merge strategy | **Squash merge** — 1 commit per PR |
| Deploy | Auto-deploy on merge to `main` |
| Worktree | `EnterWorktree` for every task |

### Squash Merge Rule (MANDATORY)
**Кожен PR мерджиться через squash — всі коміти стискаються в один.** Це тримає історію `main` чистою.
- `git merge --squash` локально
- `gh pr merge --squash` через CLI
- GitHub UI: "Squash and merge" кнопка

### Branch Protection
- ✅ Require status checks: lint, typecheck, test-backend, test-frontend
- ✅ Require branches up to date (strict mode)
- ✅ Require conversation resolution
- ❌ NO approval required (solo project)
- ❌ NO force pushes, NO deletions

## Development Workflow (Superpowers)

**Philosophy: TDD + plan + review = MANDATORY. Not optional.**

Every task flows through these phases in order. Each phase activates automatically via `using-superpowers` skill.
Не вимагай ручного виклику — система сама пропонує потрібний скіл на кожному етапі.

### 1. brainstorming
Activates **before writing any code**. Refines rough ideas through Socratic dialogue:
- Explores alternatives and edge cases
- Presents design in sections for validation
- Saves design document to `docs/design/`

### 2. using-git-worktrees
Activates **after design approval**. Creates isolated workspace:
- New branch via `EnterWorktree`
- Runs `npm install` + project setup
- Verifies clean test baseline (all tests pass before start)

### 3. writing-plans
Activates **with approved design**. Breaks work into bite-sized tasks:
- Each task: 2-5 minutes
- Every task has: exact file paths, complete code, verification steps
- Output: ordered task list with dependencies

### 4. subagent-driven-development OR executing-plans
Activates **with plan ready**:
- `subagent-driven-development`: fresh subagent per task, two-stage review (spec compliance → code quality)
- `executing-plans`: executes in batches with human checkpoints between batches
- Default: `subagent-driven-development` для складних задач, `executing-plans` для простих

### 5. test-driven-development
Activates **during implementation**. Enforces RED-GREEN-REFACTOR:
1. RED: Write failing test first
2. Watch it fail (proof test catches bug)
3. GREEN: Write minimal code to pass
4. Watch it pass (proof fix works)
5. REFACTOR: Clean up while green
6. Commit
**Жоден код не пишеться перед тестами.** Code written before tests is deleted.

### 6. requesting-code-review
Activates **between tasks** (after each file/task completion):
- Reviews against plan (not generic critique)
- Reports issues by severity: CRITICAL (block) → HIGH (warn) → MEDIUM (info) → LOW (note)
- CRITICAL issues block progress to next task

### 7. finishing-a-development-branch
Activates **when all tasks complete**:
1. Verifies all tests pass (local CI: `bash scripts/ci-local.sh`)
2. Pushes branch, creates PR via `gh pr create`
3. Dispatches **code-reviewer agent** — reviews PR diff against plan
   - CRITICAL issues → fix first, re-review
   - Questions → asks user before proceeding
   - All clear → approves PR
4. GitHub Actions CI runs on PR (lint, typecheck, test)
5. CI green → PR auto-mergeable (branch protection: status checks only, no approval required)
6. Merge to main → CI build + deploy
7. Cleans up worktree, deletes branch

### Auto-Review + Auto-Merge Flow

```
PR створено → reviewer agent → CRITICAL? → fix → re-review
                              → OK → CI запускається
                                    → CI green → auto-merge
                                    → CI ❌ → fix → push → CI again
```

Branch protection: **status checks required, approvals NOT required.**
Це дозволяє Claude автоматично мерджити PR після проходження CI.

### Quick Reference

```
Нова фіча:
  brainstorm → design doc
  worktree   → isolate + baseline
  write-plan → tasks (2-5 min each)
  execute    → subagent per task + TDD
  review     → against plan, block on CRITICAL
  finish     → merge/PR + cleanup

Баг-фікс:
  worktree   → isolate + baseline
  TDD        → RED-GREEN-REFACTOR
  review     → against expected behavior
  finish     → merge/PR + cleanup
```

## Commands
- `turbo dev` — run all dev servers
- `turbo build` — build all packages
- `turbo test` — run all tests (vitest)
- `turbo lint` — eslint across workspaces
- `turbo typecheck` — tsc --noEmit + svelte-check
- `turbo format` — prettier
- `hugo --source ./client-sites/<slug>` — build single client site

## Hugo Theme Engine (CRITICAL)

### Directory Structure
```
/client-sites/            # Hugo projects (one per client)
  /<slug>/
    /content/             # AI-generated Markdown
    /themes/<theme>/      # git submodule
    hugo.toml             # AI-generated config
    /public/              # built site (served by Caddy)
```

### Theme Registry — Category Mapping
| Theme | Git URL | Categories |
|-------|---------|------------|
| **ananke** | `github.com/theNewDynamic/gohugo-theme-ananke` | Law, Consulting |
| **hugo-fresh** | `github.com/StefMa/hugo-fresh` | Medical, Cleaning, Vet |
| **hugo-hero-theme** | `github.com/zerostaticthemes/hugo-hero-theme` | Salon, Gym |
| **hugo-universal-theme** | `github.com/devcows/hugo-universal-theme` | Construction, Real Estate, Auto |
| **hugo-scroll** | `github.com/janraasch/hugo-scroll` | Plumbers, Logistics |

### ThemeOrchestrator Module
- Maps 15 business categories → 5 themes based on registry above.
- `git submodule add <theme_url> themes/<theme_name>` on project creation.
- NEVER generate raw HTML. ALWAYS generate `hugo.toml` + Markdown Front Matter matching the selected theme's schema.

### Build Validation Protocol
Every Hugo generation MUST pass:
1. **WRITE** — Generate `hugo.toml` + content `.md` files per theme schema.
2. **EXECUTE** — Run `hugo --source ./client-sites/<slug>`.
3. **PARSE** — Capture stderr for layout warnings, missing partials, config errors.
4. **CORRECT** — If exit code ≠ 0, fix config/content and retry until EXIT 0.

### AI Generation Constraints
- System prompt MUST include selected theme's config schema (params, sections, front matter).
- Example: "You generate configuration for 'hugo-fresh'. Use [params.hero], [params.services], [params.testimonials] structures."
- LLM parses social media JSON → produces theme-compatible `hugo.toml` + Markdown.

### Verification Pipeline
```bash
node scripts/test-pipeline.js  # Simulate lead → pull theme → generate → hugo build
```
Must produce successful build in `/client-sites/<slug>/public/`.

## Testing
- Unit/Integration: `vitest` (backend + frontend)
- E2E: `playwright test` (frontend)
- E2E backend: `vitest run --config vitest.e2e.config.ts`
- Hugo build: `hugo --source ./client-sites/<slug>` (build validation protocol)

## Key Constraints
- All external API calls MUST be mocked in tests (REQUIREMENTS.md)
- `validateEnv()` must be called at startup (currently NOT wired)
- `RolesGuard` exists but NOT connected in app.module.ts
- Hugo themes loaded via git submodule — never commit theme code to repo
- Generated sites MUST pass `hugo build` with exit code 0 before publishing
