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

## Plugin Stack

| Plugin | Version | Purpose |
|--------|---------|---------|
| **ECC** | 2.0.0 | 67 agents, 271 skills, 92 commands, 6 MCP |
| **Superpowers** | 6.1.1 | 14 skills, auto-triggered workflow |
| **claude-mem** | 13.10.1 | Persistent memory between sessions |
| **Claude HUD** | 0.1.0 | Status line |
| **Caveman** | active | Response style |

## Development Workflow (Superpowers + ECC)

**Philosophy: TDD + plan + review = MANDATORY. Not optional.**

Superpowers = methodology (development process). ECC = tools (agents for specific tasks).

### 7-Phase Auto-Triggered Workflow

Each phase triggers automatically via SessionStart hook. No manual invocation needed.

```
1. /brainstorm              ← Superpowers (Socratic dialogue, design doc)
2. worktree isolate         ← Superpowers (clean environment + baseline)
3. /write-plan              ← Superpowers (2-5 min tasks, exact files, verification)
4. /execute-plan            ← Superpowers (batches with human checkpoints)
   ├─ ecc:architect         ← ECC (architectural decisions)
   ├─ ecc:code-reviewer     ← ECC (after every file)
   ├─ ecc:security-reviewer ← ECC (sensitive code)
   ├─ ecc:tdd-guide         ← ECC (write tests first)
   └─ ecc:e2e-runner        ← ECC (E2E tests)
5. code review              ← Superpowers (pre-merge, against plan)
6. merge / PR               ← Superpowers (merge/keep/discard decision)
```

### Superpowers Skills (auto-trigger)

| Skill | When It Fires |
|-------|---------------|
| **brainstorming** | Before any code — Socratic dialogue, design doc |
| **using-git-worktrees** | Creates isolated worktree + clean baseline |
| **writing-plans** | Breaks into 2-5 min tasks, exact files, verification |
| **executing-plans** | Executes in batches with human checkpoints |
| **subagent-driven-development** | Parallel sub-agents + two-level review |
| **test-driven-development** | RED-GREEN-REFACTOR. Test first, code second |
| **requesting-code-review** | Pre-merge review against plan |
| **receiving-code-review** | Processing review feedback |
| **finishing-a-development-branch** | Merge/PR/keep/discard decision |
| **systematic-debugging** | 4-phase root cause analysis |
| **verification-before-completion** | Proof that fix works |
| **dispatching-parallel-agents** | Parallel sub-agents |
| **writing-skills** | Creating new skills |
| **using-superpowers** | Intro to the system |

### Key ECC Agents for This Project

| Agent | Purpose |
|-------|---------|
| **ecc:code-reviewer** | After every file — quality, patterns, bugs |
| **ecc:security-reviewer** | Auth, payments, API endpoints, user input |
| **ecc:typescript-reviewer** | TS/JS type safety, async correctness |
| **ecc:architect** | Architectural decisions, system design |
| **ecc:build-error-resolver** | When build fails — minimal diffs, fast fix |
| **ecc:database-reviewer** | Prisma schemas, SQL queries, migrations |
| **ecc:performance-optimizer** | Bottlenecks, bundle size, N+1 queries |
| **ecc:silent-failure-hunter** | Swallowed errors, bad fallbacks, missing propagation |
| **ecc:refactor-cleaner** | Dead code, duplicates, unused deps |
| **ecc:doc-updater** | Documentation, codemaps, README updates |

### Agent Usage Rules
- **ecc:code-reviewer** — MANDATORY after every file write/edit
- **ecc:security-reviewer** — MANDATORY for auth, payment, API, file system code
- **ecc:tdd-guide** — MANDATORY for new features and bug fixes (write tests first)
- **ecc:architect** — Before major refactoring or new modules
- **ecc:build-error-resolver** — Immediately when build/typecheck fails
- All other agents — use PROACTIVELY when relevant domain code changes

### How to Start

**New feature:**
```
/brainstorm   → discuss design, get design doc
/write-plan   → get plan with small tasks
/execute-plan → execute plan (ECC agents auto-attach)
```

**Bug fix (from AUDIT_REPORT.md):**
Say: "fix B1 — path.dirname in site-publisher.service.ts"
Superpowers auto: worktree → plan → TDD fix → test → review

**Code review:**
```
/request-code-review          → Superpowers review
ecc:code-reviewer (direct)    → single file review
```

Superpowers via SessionStart hook automatically checks relevant skills before any task. No need to think "should I enable brainstorming now" — it asks if needed.

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

### ECC Protocol (Build Validation)
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
- Hugo build: `hugo --source ./client-sites/<slug>` (ECC protocol)

## Key Constraints
- All external API calls MUST be mocked in tests (REQUIREMENTS.md)
- `validateEnv()` must be called at startup (currently NOT wired)
- `RolesGuard` exists but NOT connected in app.module.ts
- Hugo themes loaded via git submodule — never commit theme code to repo
- Generated sites MUST pass `hugo build` with exit code 0 before publishing
