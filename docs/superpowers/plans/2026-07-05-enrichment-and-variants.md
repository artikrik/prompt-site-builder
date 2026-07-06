# Enrichment & Site Variants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add social media data enrichment (Instagram, Facebook, Google Maps) for real business content, and multi-variant site generation with model comparison.

**Spec:** `docs/superpowers/specs/2026-07-05-enrichment-and-variants-design.md` — full data models, API contracts, UI layouts.

**Architecture:** New `EnrichmentModule` with provider-based data collection feeding into an LLM-based brand/competitor/sales analysis pipeline. New `SiteVariant` model allows multiple generations per project with different LLM/image/theme combinations, previewable and switchable.

**Tech Stack:** NestJS 11, Prisma 6, BullMQ 5, SvelteKit 2, Svelte 5, TailwindCSS v4, Vitest, Playwright

**Prerequisite:** PR #8 (`feat/llm-model-settings-webui`) — E2E mock fixtures, Playwright config, dev-start scripts.

## Global Constraints

- TDD: write failing test → implement → pass → refactor
- All external API calls MUST be mocked in tests
- CI: `npm run lint` (0 errors), `npm run typecheck` (0 errors), `npm run test` (all passing), `npm run build` (exit 0)
- No `console.log` in production code — use NestJS `Logger`
- AES-256-GCM encryption for all stored API keys
- Caveman mode ON for communication, RTK prefix for all shell commands

## File Map

| Area | New | Modify |
|------|-----|--------|
| **Shared types** | `types/enrichment.ts`, `types/variant.ts` | `enums.ts`, `types/lead.ts`, `types/project.ts`, `index.ts` |
| **Prisma** | migration `enrichment_and_variants` | `schema.prisma` (enum, table, 4 fields) |
| **Enrichment backend** | `enrichment/` module (controller, service, factory, FacebookProvider, GoogleMapsProvider, processor, types) | `scraping/providers/instagram.provider.ts`, `queue/queue.service.ts`, `app.module.ts` |
| **Variants backend** | `projects/variants/` (controller, service) | `generation/generation.service.ts`, `hugo/hugo-compiler.service.ts`, `publishing/site-publisher.service.ts`, `projects/projects.module.ts` |
| **Settings** | — | `env.validation.ts`, `.env.example` |
| **Frontend stores** | `stores/enrichment.ts`, `stores/variants.ts` (+specs) | — |
| **Frontend components** | `enrichment/` (4), `variants/` (3) | — |
| **Frontend pages** | `projects/[id]/variants/[variantId]/` | `leads/[id]/`, `projects/[id]/` |
| **E2E** | `smoke/generation.spec.ts` | `fixtures/api-mocks.ts` |
| **Infra** | `scripts/backup-db.sh` | `backend.Dockerfile`, `sitenow-nginx.conf`, `cicd.yml` |

---

## Phase 0: Production Fixes

### Task 0.1: Fix backend healthcheck on production

- [ ] SSH to server: `ssh root@192.168.31.22`
- [ ] Check logs: `docker compose logs backend --tail=100` (use correct compose files from /opt/prompt-site-builder/)
- [ ] Check .env has DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
- [ ] Common issues: DATABASE_URL says `localhost` → must be `postgres` (Docker service name). ENCRYPTION_KEY missing → `openssl rand -hex 32`
- [ ] Fix, rebuild: `docker compose up -d --build backend`
- [ ] Verify: `curl -s http://localhost:3001/health` → `{"status":"ok"}`
- [ ] Commit any Dockerfile/env fixes

### Task 0.2: Fix wildcard subdomain routing

- [ ] Diagnose: `curl -H "Host: test.sitenow.pp.ua" localhost:8080` (Caddy direct) vs `curl -H "Host: test.sitenow.pp.ua" https://localhost/ -k` (Nginx)
- [ ] If Nginx default_server eats wildcard: add server block to `scripts/sitenow-nginx.conf`:
  ```nginx
  server {
      listen 443 ssl; server_name *.sitenow.pp.ua;
      location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; }
      ssl_certificate /etc/letsencrypt/live/sitenow.pp.ua/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/sitenow.pp.ua/privkey.pem;
  }
  ```
- [ ] Apply on server: copy config, `nginx -t && systemctl reload nginx`
- [ ] Verify wildcard routing works, commit `scripts/sitenow-nginx.conf`

### Task 0.3: Set up database backups

- [ ] Create `scripts/backup-db.sh`:
  ```bash
  #!/bin/bash
  BACKUP_DIR="/opt/backups"; DB_NAME="promptsite"; DB_USER="promptsite"
  CONTAINER="prompt-site-postgres"; KEEP_DAYS=7
  mkdir -p "$BACKUP_DIR"
  FILE="$BACKUP_DIR/promptsite-$(date +%Y%m%d-%H%M%S).sql.gz"
  docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
  echo "Backup: $FILE ($(du -h "$FILE" | cut -f1))"
  find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete
  ```
- [ ] Deploy: `scp` to server, set up cron `0 3 * * *` for daily backups
- [ ] Run first backup manually to verify
- [ ] Commit

### Task 0.4: Sync Hugo version

- [ ] In `docker/backend.Dockerfile`, change line 7 and line 40: `HUGO_VERSION=0.139.0` → `HUGO_VERSION=0.145.0`
- [ ] Commit

---

## Phase 1: Enrichment Backend

### Task 1.1: Shared types

- [ ] Add `VariantStatus` const+type to `packages/shared/src/enums.ts`: DRAFT, GENERATING, GENERATED, PUBLISHED
- [ ] Create `packages/shared/src/types/enrichment.ts` — all interfaces per spec "Enrichment Data Schema" section: EnrichmentService, EnrichmentReview, EnrichmentWorkingHours, EnrichmentFAQ, BrandColors, ToneOfVoice, AudienceInsights, CustomerJourney, CompetitorInfo, MarketGap, SalesOpportunity, EnrichmentData, UpdateEnrichmentSourcesDto
- [ ] Create `packages/shared/src/types/variant.ts`: SiteVariant, CreateVariantDto, VariantListItem
- [ ] Update `types/lead.ts`: add `enrichmentData`, `enrichedAt`, `enrichmentSources` to Lead, CreateLeadDto, UpdateLeadDto
- [ ] Update `types/project.ts`: add `activeVariantId` to Project
- [ ] Update `index.ts`: export new modules
- [ ] Build: `cd packages/shared && npm run build`
- [ ] Commit

### Task 1.2: DB migration

- [ ] Add `VariantStatus` enum to `apps/backend/prisma/schema.prisma`
- [ ] Add enrichment fields to Lead model: `enrichmentData Json @default("{}")`, `enrichedAt DateTime?`, `enrichmentSources String[] @default([])`
- [ ] Add `SiteVariant` model with fields: id, projectId, variantName, status (VariantStatus), hugoConfig (Json), content (Json), modelUsed?, imageModel?, themeName?, previewUrl?, publishedAt?, timestamps. FK to Project (cascade), `@@index([projectId])`
- [ ] Add to Project: `activeVariantId String?`, `activeVariant SiteVariant? @relation("ActiveVariant")`, `variants SiteVariant[]`
- [ ] Add to GenerationJob: `variantId String?`, `variant SiteVariant?`
- [ ] Add to SiteAsset: `variantId String?`, `variant SiteVariant?`
- [ ] Run: `npx prisma migrate dev --name enrichment_and_variants`
- [ ] Commit

### Task 1.3: Extend InstagramProvider

- [ ] Add `InstagramEnrichment` type: services[], photos[], videos[], logoUrl, bio, followers, toneOfVoice, customerJourney, sourceUrl
- [ ] Add `enrichFull(username: string): Promise<InstagramEnrichment | null>` method
- [ ] Implement `extractServices(text)` — regex for price patterns (500 ₴, 500грн, $50)
- [ ] Implement `detectCustomerJourney(text)` — find booking channels (dm/phone/viber/telegram), payment methods (card_transfer/cash), messaging apps
- [ ] Implement `analyzeToneQuick(text)` — detect emoji use, formality level, return style+sampleBio
- [ ] Write unit test with mocked fetch, commit

### Task 1.4: Create FacebookProvider

- [ ] Create `apps/backend/src/modules/enrichment/providers/types.ts`: `IEnrichmentProvider` contract — source: EnrichmentSource, enrich(businessName, city?, url?): Promise<Partial<EnrichmentData>>
- [ ] Create `facebook.provider.ts`: implement IEnrichmentProvider, use Facebook Graph API v18.0+
- [ ] Search page by name+city, fetch: name, about, category, phone, emails, website, location, hours, rating_count, cover photo
- [ ] Fetch recent posts (message, created_time, limit 20), ratings/reviews (reviewer, text, rating, limit 20)
- [ ] Extract services from post texts, working hours, reviews as EnrichmentReview[]
- [ ] Return partial data on API errors, never throw
- [ ] Write unit test, commit

### Task 1.5: Create GoogleMapsProvider

- [ ] Create `google-maps.provider.ts`: implement IEnrichmentProvider
- [ ] Use Google Places API: findplacefromtext → place details (photos, reviews, hours, website, phone)
- [ ] Use nearbysearch for competitors: same category, 5km radius, top 5 by rating
- [ ] Extract photo URLs, reviews with ratings, working hours, competitor list as CompetitorInfo[]
- [ ] Skip provider gracefully if GOOGLE_MAPS_API_KEY not set
- [ ] Write unit test, commit

### Task 1.6: Create EnrichmentFactory

- [ ] Create `enrichment-factory.ts`: inject InstagramProvider, FacebookProvider, GoogleMapsProvider
- [ ] Implement `createForProvider(source: EnrichmentSource): IEnrichmentProvider | null` — route by source string
- [ ] Write test: instagram→Instagram, facebook→Facebook, googleMaps→GoogleMaps, unknown→null
- [ ] Commit

### Task 1.7: Create EnrichmentService

- [ ] Create `enrichment.service.ts`:
  - `enrichLead(leadId)`: get lead, iterate enrichmentSources, call providers via factory, merge results (arrays concatenate, scalars last-wins)
  - `mergeResults(results[])`: reduce function for combining partial EnrichmentData from multiple providers
  - Save merged data to lead.enrichmentData + set enrichedAt
- [ ] Write test: 2 providers return services → merged array, provider throws → skipped not blocking
- [ ] Commit

### Task 1.8: Create EnrichmentProcessor

- [ ] Create `processors/enrichment.processor.ts`: `@Processor('scraping')`, extends WorkerHost
- [ ] On `process(job)`: if job.data.type === 'ENRICH_LEAD', call enrichmentService.enrichLead, update progress 10→100
- [ ] Write test: verify processor calls enrichment service
- [ ] Commit

### Task 1.9: Create EnrichmentController + Module

- [ ] Controller endpoints: POST /leads/:id/enrich (queue job), PUT /leads/:id/enrichment-sources, GET /leads/:id/enrichment
- [ ] Module: wire controller, service, factory, providers, processor. Import LeadsModule, QueueModule, PrismaModule
- [ ] Add `addEnrichmentJob(leadId)` to QueueService: push to scraping queue, type ENRICH_LEAD, 2 retries, exponential backoff 10s
- [ ] Register EnrichmentModule in AppModule
- [ ] Commit

### Task 1.10: Enrichment env vars

- [ ] Add to `env.validation.ts`: FACEBOOK_ACCESS_TOKEN?, GOOGLE_MAPS_API_KEY?, INSTAGRAM_ACCESS_TOKEN?, ENRICHMENT_AUTO_RUN? (default 'true'), ENRICHMENT_DEFAULT_SOURCES? (default 'instagram,facebook,googleMaps')
- [ ] Add to `.env.example` under "Enrichment APIs" section
- [ ] Commit

---

## Phase 2: Site Variants Backend

### Task 2.1: VariantsService

- [ ] Create `apps/backend/src/modules/projects/variants/variants.service.ts`:
  - `create(projectId, dto: CreateVariantDto)` — generate variantName from model+image+theme, insert SiteVariant, return it
  - `findByProject(projectId)` — lightweight list (id, variantName, status, models, theme, createdAt)
  - `findById(variantId)` — full variant with project relation
  - `activate(variantId)` — set Project.activeVariantId, de-publish previous variant (status→GENERATED), copy variant files to main slug dir, set variant status=PUBLISHED+publishedAt, project status=PUBLISHED+publishedUrl
  - `remove(variantId)` — delete if not active, throw if active
  - `generateVariantName(model?, imageModel?, theme?)` — e.g. "GPT-4o + DALL-E 3 + ananke"
- [ ] Write unit test, commit

### Task 2.2: VariantsController

- [ ] Create `variants.controller.ts`:
  - POST /projects/:id/variants — create variant, queue generation, return variant
  - GET /projects/:id/variants — list
  - GET /variants/:variantId — details
  - PUT /variants/:variantId/activate — activate
  - DELETE /variants/:variantId — delete
  - GET /variants/:variantId/preview — read index.html from variant dir, sendFile
- [ ] Register in ProjectsModule
- [ ] Commit

### Task 2.3: Update GenerationService for variants

- [ ] Add optional `variantId?: string` to `generateSite()` signature
- [ ] When variantId given: fetch variant → set status=GENERATING → on success store hugoConfig+content in variant + status=GENERATED → on failure set project status=FAILED
- [ ] When variantId not given: backward compatible (existing behavior)
- [ ] Update `HugoCompilerService.build()`: accept variantId → output to `/var/www/client-sites/<slug>--<variantId>/`
- [ ] Update `SitePublisherService`: add `activateVariant(slug, variantId)` → copy variant build to main slug dir
- [ ] Update tests: variant flow + backward compat
- [ ] Run all backend tests, commit

### Task 2.4: Migrate existing projects to variants

- [ ] Write migration script (run manually once after deploy):
  ```sql
  -- For each Project without a variant, create a default SiteVariant
  INSERT INTO "SiteVariant" ("id", "projectId", "variantName", "status", "hugoConfig", "content", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), "id", 'Default (legacy)', 'PUBLISHED', "hugoConfig", '{}', NOW(), NOW()
  FROM "Project" WHERE "id" NOT IN (SELECT DISTINCT "projectId" FROM "SiteVariant");
  -- Then set activeVariantId
  UPDATE "Project" p SET "activeVariantId" = (SELECT "id" FROM "SiteVariant" v WHERE v."projectId" = p."id" LIMIT 1)
  WHERE p."activeVariantId" IS NULL AND p."id" IN (SELECT "projectId" FROM "SiteVariant");
  ```
- [ ] Test migration on a copy of production DB or staging
- [ ] Run after deploy: `docker compose exec backend npx prisma db execute --file prisma/migrations/20260705_migrate_existing_projects.sql`

---

## Phase 3: Frontend

### Task 3.1: Enrichment store

- [ ] Create `apps/frontend/src/lib/stores/enrichment.ts`:
  - State: { data: EnrichmentData | null, enrichedAt, sources, isLoading, error }
  - Methods: `fetch(leadId)` → GET /leads/:id/enrichment, `trigger(leadId)` → POST /leads/:id/enrich, `updateSources(leadId, sources)` → PUT
  - Follow pattern from existing stores (writable + update)
- [ ] Create `enrichment.spec.ts`: mock api, verify fetch populates state, trigger calls POST
- [ ] Commit

### Task 3.2: Variants store

- [ ] Create `apps/frontend/src/lib/stores/variants.ts`:
  - State: { variants: VariantListItem[], activeVariantId, isLoading, error }
  - Methods: `fetchByProject(projectId)`, `create(projectId, model?, imageModel?, theme?)`, `activate(variantId)`, `remove(variantId)`, `getPreviewUrl(variantId)`
- [ ] Create `variants.spec.ts`
- [ ] Commit

### Task 3.3: Enrichment UI components

- [ ] `BrandCard.svelte` — logo img, 3 color swatches with hex labels, tone style/emoji badges
- [ ] `CompetitorCard.svelte` — name, rating stars, strengths (green checkmarks), weaknesses (red X), services+price list
- [ ] `SalesOpportunityCard.svelte` — gap title, currentState→recommendation arrows, pitchAngle blockquote, revenueImpact badge
- [ ] `EnrichmentPanel.svelte` — parent: source toggle buttons, "Enrich" button, sections for each data type. Loading: Skeleton cards. Empty: "No enrichment data" message. Calls enrichment store on mount
- [ ] All use Svelte 5 runes ($state, $derived, $props). Use shadcn-svelte Card, Badge, Button, Skeleton
- [ ] Commit

### Task 3.4: Variant UI components

- [ ] `VariantCard.svelte` — variantName, status Badge (color by status), model Badge, image Badge, theme Badge. Buttons: Preview (eye icon), Activate (star, disabled if active), Delete (trash, disabled if active). Props: variant, isActive, onActivate, onPreview, onDelete
- [ ] `VariantGenerator.svelte` — reuse ModelSelector (content + image), Select for theme (from GET /generation/themes), "Generate Variant" Button. On submit: calls variants.create, dispatches custom event
- [ ] `VariantPreview.svelte` — iframe with loading spinner, "Open in new tab" Button. Props: previewUrl
- [ ] Commit

### Task 3.5: Update Lead Detail page

- [ ] In `routes/dashboard/leads/[id]/+page.svelte`:
  - Add import: `import EnrichmentPanel from '$lib/components/enrichment/EnrichmentPanel.svelte'`
  - Add section after payment config: `<section class="space-y-4"><h2 class="text-lg font-semibold">Enrichment Data</h2><EnrichmentPanel {leadId} /></section>`
  - Define `leadId` from `$page.params.id`
- [ ] No changes to existing lead info or payment sections
- [ ] Commit

### Task 3.6: Rewrite Project Detail page

- [ ] Replace `routes/dashboard/projects/[id]/+page.svelte`:
  - Keep: ArrowLeft back button, loading/not-found states
  - Add: header with businessName, domain, activeVariant status Badge
  - Add: collapsible VariantGenerator section (LLM + Image + Theme pickers)
  - Add: variants grid section (each VariantCard from variants store)
  - Add: VariantPreview iframe for active/previewed variant
  - Keep: Site Information card (domain, status, theme, dates)
  - Remove: old single-generate button + hardcoded HugoConfig card
- [ ] Load data on mount: `Promise.all([projects.fetchOne(id), api.get('/generation/themes'), variants.fetchByProject(id)])`
- [ ] Commit

### Task 3.7: Create Variant Detail page

- [ ] Create `routes/dashboard/projects/[id]/variants/[variantId]/+page.svelte`:
  - Header: variantName, status Badge, back link to project
  - Info card: model, image model, theme, created date, published date
  - Content tabs (index, about, services, contact): rendered from variant.content
  - Hugo Config: `<pre>` block with JSON.stringify(variant.hugoConfig, null, 2)
- [ ] Fetch on mount: `api.get('/variants/' + $page.params.variantId)`
- [ ] Commit

---

## Phase 4: Testing

### Task 4.1: Backend enrichment tests

- [ ] Ensure all enrichment module tests pass: `cd apps/backend && npx vitest run src/modules/enrichment/`
- [ ] Ensure Instagram provider extended tests pass
- [ ] Verify coverage ≥ 80% on enrichment module
- [ ] Commit any remaining test fixes

### Task 4.2: Backend variant tests

- [ ] Run variant service tests + updated generation tests
- [ ] Run full backend suite: `cd apps/backend && npx vitest run` — all must pass
- [ ] Commit

### Task 4.3: Frontend unit tests

- [ ] Run: `cd apps/frontend && npx vitest run` — enrichment + variants store tests pass
- [ ] Commit

### Task 4.4: E2E smoke test

- [ ] Add `mockEnrichment(page, leadId)` and `mockVariants(page, projectId)` to `apps/frontend/e2e/fixtures/api-mocks.ts` — follow existing pattern from PR #8, use `API` constant for route prefix
- [ ] Create `e2e/smoke/generation.spec.ts`:
  - test: login → navigate to lead detail → click Enrich → verify enrichment data visible
  - test: navigate to project → generate variant → verify variant card appears with GENERATING status
  - test: activate variant → verify status changes to PUBLISHED
- [ ] Run: `cd apps/frontend && npx playwright test --project=smoke` — all pass
- [ ] Commit

---

## Phase 5: CI & Deploy

### Task 5.1: Update CI/CD

- [ ] Verify enrichment env vars are in `/opt/prompt-site-builder/.env` (already copied in deploy step — no cicd.yml changes needed)
- [ ] Add Nginx config verification to deploy job: `nginx -t` check
- [ ] Commit

### Task 5.2: Full CI pipeline

- [ ] `npm run lint` — 0 errors
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run test` — all passing
- [ ] `npm run build` — exit 0
- [ ] Fix any issues, commit

### Task 5.3: PR and deploy

- [ ] `git push -u origin feat/enrichment-and-variants`
- [ ] `gh pr create --base master --title "feat: enrichment & site variants"`
- [ ] Wait for CI green, merge squash
- [ ] Verify deploy: containers healthy, health endpoint returns ok

### Task 5.4: Production smoke test

- [ ] Login to https://sitenow.pp.ua
- [ ] Create lead with enrichment sources enabled
- [ ] Trigger enrichment → verify data appears (services, reviews, brand colors)
- [ ] Create project → generate 2 variants with different models/themes
- [ ] Preview both → activate one → verify live site works at https://slug.sitenow.pp.ua

---

## Completion Checklist

- [ ] Phase 0: Production fixes (4 tasks)
- [ ] Phase 1: Enrichment backend (10 tasks)
- [ ] Phase 2: Variants backend (3 tasks)
- [ ] Phase 3: Frontend (7 tasks)
- [ ] Phase 4: Testing (4 tasks)
- [ ] Phase 5: CI & Deploy (4 tasks)

**Total: 32 tasks**
