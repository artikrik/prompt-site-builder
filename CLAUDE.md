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

## Development Workflow (Superpowers)

**Philosophy: TDD + plan + review = MANDATORY.**

### Superpowers Skills

| Skill | When It Fires |
|-------|---------------|
| **brainstorming** | Before any code — design discussion, design doc |
| **using-git-worktrees** | Creates isolated worktree + clean baseline |
| **writing-plans** | Breaks into 2-5 min tasks, exact files, verification |
| **executing-plans** | Executes in batches with human checkpoints |
| **test-driven-development** | RED-GREEN-REFACTOR. Test first, code second |
| **requesting-code-review** | Pre-merge review against plan |
| **receiving-code-review** | Processing review feedback |
| **finishing-a-development-branch** | Merge/PR/keep/discard decision |
| **verification-before-completion** | Proof that fix works |
| **systematic-debugging** | 4-phase root cause analysis |
| **dispatching-parallel-agents** | Parallel sub-agents for independent tasks |
| **subagent-driven-development** | Multi-agent orchestration |

### Standard Flow

```
Нова фіча:
  /brainstorm   → design doc
  worktree      → isolate
  /write-plan   → small tasks
  /execute-plan → implement (TDD per task)
  review        → pre-merge check
  finish        → merge/PR

Баг-фікс:
  worktree      → isolate
  TDD           → write failing test → fix → verify
  review        → pre-merge check
  finish        → merge/PR
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
