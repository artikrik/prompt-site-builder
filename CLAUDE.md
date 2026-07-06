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

## Model Selection (Token Optimization)
**Rule: flash for mechanical, pro for code.**
- **deepseek-v4-flash** — mechanical tasks: docs, grep/find, format, commits, PRs, config changes, CI fixes, dependency updates, transcription, dead-code removal
- **deepseek-v4-pro[1m]** — code tasks: single/multi-file edits, bug fixes, refactors, features, tests, code review, security audit, architecture, debugging, concurrency
- **Subagents**: flash for mechanical implementers/reviewers (docs, config, CI); pro for code implementers + all code reviewers
- **Session default**: this session uses deepseek-v4-pro[1m] (inherited). Subagents use pro for code work.

## RTK (Rust Token Killer)
**ALL shell commands MUST use `rtk` prefix.** Saves 60-90% tokens. See `~/.claude/RTK.md` for full command reference.
For file ops, prefer `rtk read`/`rtk grep`/`rtk find` over native Claude tools.

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
**TDD + plan + review = MANDATORY.** Phases: brainstorm → worktree → write-plan → subagent/TDD → review → finish.
See superpowers skills for each phase. Quick flow: `brainstorm → design doc → worktree isolate → plan tasks (2-5 min each) → execute (subagent per task + TDD) → review → finish (merge/PR + cleanup)`.

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
/client-sites/<slug>/   # Hugo projects (one per client)
  /content/             # AI-generated Markdown
  /themes/<theme>/      # git submodule
  hugo.toml             # AI-generated config
  /public/              # built site (served by Caddy)
```

### Theme Registry — Category Mapping
| Theme | Categories |
|-------|------------|
| **ananke** | Law, Consulting |
| **hugo-fresh** | Medical, Cleaning, Vet |
| **hugo-hero-theme** | Salon, Gym |
| **hugo-universal-theme** | Construction, Real Estate, Auto |
| **hugo-scroll** | Plumbers, Logistics |

Git URLs: github.com/theNewDynamic/gohugo-theme-ananke, /StefMa/hugo-fresh, /zerostaticthemes/hugo-hero-theme, /devcows/hugo-universal-theme, /janraasch/hugo-scroll

### Key Rules
- NEVER generate raw HTML. ALWAYS generate `hugo.toml` + Markdown Front Matter matching theme schema.
- System prompt MUST include selected theme's config schema (params, sections, front matter).
- Build validation: generate → `hugo --source ./client-sites/<slug>` → parse errors → fix until EXIT 0.
- Verify: `node scripts/test-pipeline.js`

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
