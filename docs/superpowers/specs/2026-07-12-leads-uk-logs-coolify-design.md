# Design Spec: Leads, Ukrainian i18n, Logs, Project Fixes & Coolify

**Date:** 2026-07-12
**Branch:** feat/leads-uk-logs-fixes
**Status:** Approved
**Splits into 4 sequential PRs**

## Overview

Six workstreams covered across 4 PR groups:
- **Group 1:** Leads (CRUD + detail card + scraping + categories + OpenRouter)
- **Group 2:** Project fixes (regeneration notifications, variant activation, addon config, preview)
- **Group 3:** Ukrainian i18n + logs page + design refresh
- **Group 4:** Coolify hybrid migration

---

## Group 1: Leads + OpenRouter + Categories

### 1.1 Lead Model Changes (Prisma)

```prisma
model Lead {
  // existing...
  socialUrls       String[]   @default([])  // was: socialUrl String?
  country          String?                  // new
  region           String?                  // new (oblast)
  scrapingEnabled  Boolean    @default(false)  // new

  // Scraping results (from spec enrichment-completion)
  scrapedPhotos    String[]   @default([])
  scrapedReviews   Json[]     @default([])
  scrapedContacts  Json       @default("{}")
  scrapedHours     Json       @default("{}")

  // existing enrichment fields...
}
```

### 1.2 CategoryPrompt Model (New)

```prisma
model CategoryPrompt {
  id               String   @id @default(uuid())
  category         String   @unique
  contentPrompt    String
  designPrompt     String
  competitorPrompt String
  isCustom         Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

### 1.3 Business Categories (17 total)

| # | Category | Theme |
|---|----------|-------|
| 1 | Стоматологія | hugo-fresh |
| 2 | Краса та догляд | hugo-hero-theme |
| 3 | Юридичні послуги | ananke |
| 4 | Будівництво | hugo-universal-theme |
| 5 | Автосервіс | hugo-universal-theme |
| 6 | Медицина | hugo-fresh |
| 7 | Ветеринарія | hugo-fresh |
| 8 | Ресторан/Кафе | hugo-hero-theme |
| 9 | Фітнес/Спорт | hugo-hero-theme |
| 10 | Логістика | hugo-scroll |
| 11 | Консалтинг | ananke |
| 12 | Нерухомість | hugo-universal-theme |
| 13 | Ремонт/Оздоблення | hugo-universal-theme |
| 14 | Сантехніка | hugo-scroll |
| 15 | Клінінг | hugo-fresh |
| 16 | ІТ/Розробка | hugo-hero-theme |
| 17 | Інше | AI auto-select |

### 1.4 Backend API

| Method | Path | Description |
|--------|------|-------------|
| `POST /leads` | Create lead (extended DTO: socialUrls, country, region) |
| `GET /leads/:id` | Lead detail with projects + enrichment |
| `POST /leads/:id/scrape` | Queue scraping job (platforms: instagram, facebook, googleMaps) |
| `GET /leads/:id/scrape-status` | Scraping job status + results |
| `GET /leads/:id/enrichment` | Existing — enrichment data |
| `POST /leads/:id/enrich` | Existing — queue enrichment |
| `GET /categories` | List categories with themes |
| `GET /categories/:category/prompts` | Prompts for category |
| `PUT /categories/:category/prompts` | Edit category prompts (admin) |
| `POST /leads/:id/analyze-competitors` | Run competitor analysis using category's competitorPrompt |

### 1.5 Scraping Config

API keys in global Settings (NOT per-lead):
- `SCRAPING_BRIGHTDATA_KEY`
- `SCRAPING_APIFY_KEY`  
- `INSTAGRAM_ACCESS_TOKEN`
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`

### 1.6 OpenRouter

- New provider `openrouter` in SettingsService
- `OPENROUTER_API_KEY` stored in Settings
- `GET /generation/models?provider=openrouter` — dynamic model list from OpenRouter API
- `OpenRouterStrategy` implements `LLMStrategy` (text only initially)

### 1.7 Frontend Pages

**Leads list (`/dashboard/leads`):**
- Create modal: businessName, socialUrls (dynamic input list), category (Select 17 options), city, region, country
- Table: click row → lead card

**Lead detail card (`/dashboard/leads/[id]`):**
- Tabs: Details | Enrichment | Projects | Scraping
- Details tab: all fields, edit form
- Scraping tab: platform URLs + "Run Scraping" button + results display (photos, reviews, contacts, hours)
- Enrichment tab: existing EnrichmentPanel + "Analyze Competitors" button

**Category prompts (`/dashboard/settings/categories`):**
- Table: category, theme, prompt preview
- Edit button → modal with 3 text areas (content, design, competitor prompts)
- Reset to default button per category

---

## Group 2: Project Fixes

### 2.1 Regeneration Notifications

**Problem:** No user feedback after clicking generate. No progress indication.

**Fix:**
- Frontend: polling `GET /generation/:projectId/status` every 3s after generate
- Toast notifications: "Генерація..." → "Готово!" / "Помилка: ..."
- Progress indicator on Generate button
- New endpoint: `GET /generation/:projectId/history` (paginated job history)

### 2.2 Variant Activation

**Problem:** Activate API works but site doesn't switch (PublishingService no variant support).

**Fix (from existing spec 1.2):**
- `PublishingService.switchActiveVariant(slug, newVariantId)` — symlink `<slug>` → `<slug>--<variantId>`
- HugoCompiler outputs to `<slug>--<variantId>/`
- Call `switchActiveVariant` from `VariantsService.activate()`

### 2.3 Addon Configuration

**Problem:** `handleConfigureAddon` shows "will be available in next update" alert.

**Fix:**
- `AddonConfigModal.svelte` — dynamic form per addon type
- `PUT /projects/:id/addons/:addonType` — already exists

| Addon | Config Fields |
|-------|---------------|
| ONLINE_PAYMENT | WayForPay merchant login, secret key, test mode toggle |
| ONLINE_BOOKING | EasyWeek widget URL, business ID |
| CONTENT_MANAGEMENT | Monthly update limit, notification email |

### 2.4 Site Preview

**Problem:** `test.sitenow.pp.ua refused to connect` — subdomain not configured.

**Fix (short-term):**
- Replace iframe with "Open site" button linking to `publishedUrl`
- Iframe only shown when `publishedUrl` is confirmed accessible

**Fix (long-term, Group 4 Coolify):**
- Ensure Caddy wildcard `*.sitenow.pp.ua` routes to client sites directory

---

## Group 3: Ukrainian i18n + Logs + Design

### 3.1 Ukrainian i18n

**Approach:** Simple dictionary, no libraries, Ukrainian only.

**File:** `apps/frontend/src/lib/i18n/uk.ts`

```typescript
export const t = {
  nav: { dashboard: 'Панель керування', leads: 'Ліди', projects: 'Проекти', ... },
  leads: { title: 'Ліди', addLead: 'Додати ліда', businessName: 'Назва бізнесу', ... },
  projects: { title: 'Проекти', generate: 'Згенерувати сайт', generating: 'Генерація...', ... },
  status: { NEW: 'Новий', CONTACTED: 'Зконтактовано', GENERATING: 'Генерується', ... },
  // ...all UI strings
};
```

Usage: `{t.leads.title}` in Svelte components.

### 3.2 Logs Page

**New page:** `apps/frontend/src/routes/dashboard/logs/+page.svelte`

Two tabs:

**Tab 1: Generation Logs**
- Table: Project | Type | Status | Started | Duration | Error
- Filters: project (select), status
- Click row → job detail (JSON result, error stack trace)
- Auto-refresh every 10s
- API: `GET /logs/generation?projectId=&status=&limit=50`

**Tab 2: System Logs**
- Backend writes logs to DB via `SystemLog` table
- Levels: INFO, WARN, ERROR
- Filter by level + text search
- Last 500 entries, paginated
- API: `GET /logs/system?level=&search=&limit=50`

**New Prisma model:**

```prisma
model SystemLog {
  id        String   @id @default(uuid())
  level     String   // INFO, WARN, ERROR
  module    String
  message   String
  details   Json?
  createdAt DateTime @default(now())
  
  @@index([level])
  @@index([createdAt])
  @@index([module])
}
```

**Custom NestJS Logger:** `PrismaLogger implements LoggerService` — writes WARN+ERROR to DB, INFO to console only.

**Backend API:**
| Method | Path | Description |
|--------|------|-------------|
| `GET /logs/generation` | Generation job history (query: projectId, status, limit) |
| `GET /logs/generation/:jobId` | Single job detail |
| `GET /logs/system` | System logs (query: level, search, limit, offset) |

### 3.3 Design Refresh

Apply to all existing + new pages. Design system defined below.

#### Color System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#FFFFFF` | Page background |
| Surface | `#F8FAFC` | Card backgrounds, sidebar |
| Text Primary | `#1E293B` (slate-900) | Headings, body text |
| Text Secondary | `#64748B` (slate-500) | Muted text, descriptions |
| Border | `#E2E8F0` (slate-200) | Card borders, dividers |
| Accent Primary | `#2563EB` (blue-600) | Primary buttons, links, active states |
| Accent Success | `#16A34A` (green-600) | Success status, completed, published |
| Accent Danger | `#DC2626` (red-600) | Error status, delete actions, failed |
| Accent Warning | `#F59E0B` (amber-500) | Warning status, generating/pending |
| Shadow | `0 1px 3px rgba(0,0,0,0.08)` | Card elevation |

#### Typography

- **Font:** Inter (sans-serif), fallback: system-ui
- **Scale:**
  - Page title: 24px / 700 weight / 32px line-height
  - Section title: 18px / 600 weight / 24px line-height
  - Body: 14px / 400 weight / 20px line-height
  - Small/caption: 12px / 400 weight / 16px line-height
  - Table headers: 12px / 600 weight / uppercase tracking
  - Monospace (data values): JetBrains Mono, 13px

#### Layout

- **Sidebar:** Left, 240px width, collapsible to 64px (icons only)
  - Logo + project name at top
  - Nav items with icons + labels
  - User profile + notification bell at bottom
- **Top bar:** Breadcrumbs + global search (Cmd+K) + theme toggle placeholder
- **Content area:** Max-width 1280px, centered, 24px padding
- **Grid:** 12-column, 24px gap

#### Components

| Component | Specification |
|-----------|---------------|
| Card | White bg, 1px border, 8px radius, shadow on hover |
| Button primary | Blue bg, white text, 8px radius, 36px height |
| Button secondary | White bg, border, slate text |
| Button ghost | Transparent, text-only |
| Button danger | Red bg, white text, confirmation dialog |
| Input | 36px height, 8px radius, border, focus ring blue |
| Select | Same as Input + dropdown with 8px radius |
| Badge | 20px height, 6px radius, semi-bold 11px text |
| Table | Border-bottom rows, hover highlight, sticky header |
| Modal | Centered, 480px/640px max-width, overlay backdrop |
| Toast | Top-right, 4s auto-dismiss, success/error/warning variants |
| Tabs | Underline style, 32px height |
| Pagination | Page numbers + prev/next, 32px items |

#### Data Display Rules

1. **Tables:** Must have sorting (click header), filtering (inline or top bar), pagination (20 rows/page)
2. **Status badges:** Always use semantic colors (green=success, amber=pending, red=error, blue=info)
3. **Empty states:** Icon + "No X found" + optional CTA button
4. **Loading states:** Skeleton placeholders matching content shape
5. **Error states:** Inline error message with retry button
6. **Truncation:** Long text truncated with "..." + tooltip on hover

#### Global Elements

1. **Global Search (Cmd+K):** Modal with input, searches leads + projects by name
2. **Notification bell:** Dropdown with last 5 generation/enrichment job results
3. **Breadcrumbs:** Auto-generated from route path, last item non-clickable
4. **User profile:** Avatar (initials), name, role badge, logout link
5. **Responsive:** Sidebar collapses to icons at <1024px, becomes bottom tab bar at <768px

---

## Group 4: Coolify Hybrid Migration

### 4.1 Architecture

```
VPS
├── Coolify (orchestrates)
│   ├── Services: PostgreSQL 16, Redis 7
│   ├── Apps: backend (Git, port 3001), frontend (Git, port 3000)
│   └── TLS: Let's Encrypt for sitenow.pp.ua, api.sitenow.pp.ua
│
└── Caddy (separate container, NOT Coolify-managed)
    └── On-Demand TLS for *.sitenow.pp.ua
    └── Serves /client-sites/{host}/public
```

### 4.2 Migration Steps

1. **Backup:** pg_dump, /client-sites/, .env, docker-compose.prod.yml
2. **Install Coolify:** `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
3. **Create Services:** PostgreSQL 16 (restore from backup), Redis 7
4. **Create Apps:** backend (Dockerfile, port 3001), frontend (Dockerfile, port 3000) — Git integration on main branch
5. **Caddy container:** separate Docker Compose or Coolify Service for wildcard TLS
6. **DNS:** point sitenow.pp.ua + *.sitenow.pp.ua to Coolify IP
7. **Verify:** healthchecks, client site via subdomain, TLS certs valid

### 4.3 Removed

- GitHub Actions deploy workflow (replaced by Coolify Git webhook)
- `docker-compose.prod.yml` (Coolify manages config)
- Caddy from main compose (client-site Caddy stays separate)

### 4.4 Kept

- GitHub Actions CI (lint, typecheck, test, build)
- Hugo build inside backend container
- `/client-sites/` volume mounted to both backend and Caddy

---

## Implementation Order

```
Group 1 PR (~4-5h): Leads CRUD + detail card + scraping + categories + OpenRouter
Group 2 PR (~3-4h): Project fixes (regeneration, variants, addons, preview)
Group 3 PR (~2-3h): Ukrainian i18n + logs page + design refresh
Group 4 PR (~2-3h): Coolify hybrid migration
```

Each PR: branch → implement → CI → commit → PR → review → merge → deploy.

---

## Risks

1. **OpenRouter API changes** — cache model list locally, fallback to hardcoded defaults
2. **Symlinks on production** — Linux supports native symlinks; Windows dev env uses fs.copy fallback (existing spec 1.2)
3. **Coolify DNS propagation** — 24-48h; use existing Caddy during transition
4. **DB migration during Coolify switch** — backup critical; test on staging first if available
