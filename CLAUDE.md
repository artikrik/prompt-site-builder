# prompt-site-builder

## RTK (Rust Token Killer) — MANDATORY

**Кожна shell команда — ТІЛЬКИ через `rtk`.** Bash і PowerShell перехоплюються PreToolUse хуком автоматично. Жодних прямих викликів.
Навіть у ланцюжках: `rtk git add . && rtk git commit -m "msg" && rtk git push`
Ці правила діють всюди: головний потік, агенти, субагенти, Workflow скрипти.

### RTK Tool Mapping (CRITICAL)
**Ніколи не використовуй нативні Claude Code інструменти для файлових операцій.**
Кожен нативний інструмент має RTK-відповідник через Bash із 60-90% економії токенів.
Нативні інструменти надсилають повний вивід у контекст. RTK фільтрує, групує, дедуплікує.

| Claude Code Tool | RTK Bash Command | Savings | Призначення |
|-----------------|-----------------|---------|-------------|
| **Read** | `rtk read <file>` | ~60% | Читання файлів з фільтрацією |
| **Grep** | `rtk grep <pattern>` | ~75% | Пошук, згрупований по файлах |
| **Glob** | `rtk find <pattern>` | ~70% | Пошук файлів, згрупований по директоріях |
| Bash `cat` | `rtk read <file>` | ~60% | Читання файлів |
| Bash `rg` | `rtk grep <pattern>` | ~75% | Пошук вмісту |
| Bash `grep` | `rtk grep <pattern>` | ~75% | Пошук вмісту |
| Bash `find` | `rtk find <pattern>` | ~70% | Пошук файлів |
| Bash `ls` | `rtk ls <path>` | ~65% | Деревоподібний список |
| Bash `dir` | `rtk ls <path>` | ~65% | Те саме (PowerShell) |

### RTK Build/Test/Git Commands
| Пряма команда | RTK Command | Savings |
|--------------|------------|---------|
| `git status` | `rtk git status` | ~59% |
| `git log` | `rtk git log` | ~59% |
| `git diff` | `rtk git diff` | ~80% |
| `git show` | `rtk git show` | ~80% |
| `npm install` | `rtk npm install` | ~90% |
| `npm test` | `rtk npm test` | ~90% |
| `pnpm install` | `rtk pnpm install` | ~90% |
| `turbo build` | `rtk turbo build` | ~70% |
| `turbo test` | `rtk turbo test` | ~90% |
| `docker ps` | `rtk docker ps` | ~85% |
| `docker logs` | `rtk docker logs <c>` | ~85% |
| `curl <url>` | `rtk curl <url>` | ~70% |

### Винятки (RTK не потрібен)
- **Write/Edit** — і так мінімальний вивід, RTK не дасть економії
- **Bash з `cd`/`export`/`mkdir`** — службові команди без виводу
- **Bash з `&&`** — використовуй `rtk` на початку ланцюжка, всі наступні команди теж пройдуть через RTK
- **Читання зображень/PDF/notebook** — для цих форматів Read tool обов'язковий

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
