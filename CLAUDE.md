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
