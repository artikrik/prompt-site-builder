# Design Spec: Enrichment & Variants Completion

**Date:** 2026-07-12
**Branch:** feat/enrichment-and-variants
**Status:** Approved
**Parent spec:** 2026-07-05-enrichment-and-variants-design.md (Phase 1-5 already implemented)

## Overview

Audit of `feat/enrichment-and-variants` revealed core features are implemented but analytical layer (LLM analysis), publishing integration, and several frontend components are missing. This spec covers completion of all remaining items from the original spec plus additions discovered during audit.

## Audit Summary

### Implemented (no changes needed)
- InstagramProvider (unauthenticated scrape), FacebookProvider (Graph API v18), GoogleMapsProvider (Places API)
- EnrichmentFactory, EnrichmentService (basic), EnrichmentProcessor (BullMQ)
- EnrichmentController (3 endpoints), VariantsController (7 endpoints)
- VariantsService, GenerationService (variant-aware), HugoCompiler (variant paths)
- DB schema: SiteVariant, Lead enrichment fields, VariantStatus enum, GenerationJob.variantId
- Env vars defined (7 vars in .env.example + env.validation.ts)
- Shared types: full `EnrichmentData` interface in `packages/shared/src/types/enrichment.ts`
- Frontend: EnrichmentPanel, VariantCard, VariantList, GenerateModal, all 3 updated pages

### Gaps Found (this spec addresses)
1. **No LLM analysis layer** — raw data collected but never analyzed (brand, competitors, sales)
2. **Competitor data is stub** — `mapCompetitor` returns empty `services: []`, `positioning: ''`, `uniqueSellingPoints: []`
3. **Sales analysis missing** — no sales script, objection handling, pitch generation
4. **PublishingService no variant support** — looks for `/<slug>/` but HugoCompiler outputs `/<slug>--<variantId>/`
5. **Preview endpoint serves HTML only** — no CSS/JS/image assets
6. **EnrichmentController contract bug** — returns `{message}` instead of `{jobId}`
7. **5 env vars unused** — `ENRICHMENT_AUTO_RUN`, `ENRICHMENT_DEFAULT_SOURCES`, `INSTAGRAM_ACCESS_TOKEN`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
8. **Provider data collection limited** — not maximizing available data (photos, reviews, contacts)
9. **Sequential provider execution** — spec mandates parallel
10. **Missing frontend components** — BrandCard, CompetitorCard, SalesOpportunityCard, SalesScriptPanel, VariantGenerator, VariantPreview
11. **Missing tests** — enrichment controller, analysis service, frontend stores, components
12. **Frontend store issues** — Lead type missing enrichment fields, enrichment store duplicates `EnrichmentData` instead of importing from shared

---

## Phase 0: Production Verification & CI/CD Simplification

### 0.1 Production Server Health Check

Verify production server `sitenow.pp.ua`:

```bash
# SSH to server
ssh root@sitenow.pp.ua

# 1. Services health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
systemctl status caddy nginx postgresql redis

# 2. Backend healthcheck
curl -s https://api.sitenow.pp.ua/api/health
curl -s https://api.sitenow.pp.ua/api/health/db  # DB connectivity

# 3. Caddy routing
curl -s -H "Host: test.sitenow.pp.ua" https://localhost/ -o /dev/null -w "%{http_code}"

# 4. Disk space + backups
df -h /opt /var
ls -lt /opt/backups/ | head -5

# 5. Check logs for errors
docker logs promptsite-backend-1 --tail 50 | grep -i error
journalctl -u caddy --since "1 hour ago" | grep -i error
```

### 0.2 Deploy Verification

- Run `bash scripts/deploy.sh` from local → verify all steps succeed
- Check: Prisma migrations run, containers restart, healthcheck passes
- Verify frontend builds and serves from correct API base URL
- Test: create lead → enrich → generate variant → preview → activate

### 0.3 CI/CD Simplification

**Current state:** `.github/workflows/` has multiple workflow files with complex matrix builds.

**Simplify to single workflow:**

**New file:** `.github/workflows/ci.yml` (replaces all existing)

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping" --health-interval 10s --health-timeout 5s --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with: { node-version: '22' }

      - uses: peaceiris/actions-hugo@v3
        with: { hugo-version: '0.145.0', extended: true }

      - run: npm ci

      - run: cp .env.example .env

      - run: npx prisma generate
        working-directory: apps/backend

      - run: npx prisma migrate deploy
        working-directory: apps/backend

      - run: npm run lint
        continue-on-error: true  # Non-blocking for now

      - run: npm run typecheck

      - run: npm run test -- -- --coverage

      - run: npm run build
```

**Key simplifications:**
- Single workflow file (was 3-4)
- Single job (was matrix with multiple runners)
- No deploy step (manual deploy via `bash scripts/deploy.sh`)
- lint: `continue-on-error: true` (non-blocking, fix gradually)
- No Docker build in CI (deploy script handles it)
- No separate test-backend / test-frontend jobs (vitest handles both via turbo)

**Deleted workflows:**
- `.github/workflows/ci-backend.yml` → merged into ci.yml
- `.github/workflows/ci-frontend.yml` → merged into ci.yml
- `.github/workflows/deploy.yml` → replaced by manual `scripts/deploy.sh`
- Any other workflow files

### 0.4 Deploy Script

**File:** `scripts/deploy.sh` (already exists — verify and simplify)

```bash
#!/bin/bash
set -euo pipefail

echo "=== Deploy prompt-site-builder ==="

# 1. Build locally
npm run build

# 2. Copy to server
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.turbo' \
  ./ root@sitenow.pp.ua:/opt/prompt-site-builder/

# 3. Run migrations + restart on server
ssh root@sitenow.pp.ua << 'EOF'
  cd /opt/prompt-site-builder
  docker compose up -d --build backend frontend
  docker compose exec backend npx prisma migrate deploy
  docker compose restart backend
  sleep 5
  curl -s https://api.sitenow.pp.ua/api/health | grep -q "ok" && echo "✅ Deploy successful" || echo "❌ Healthcheck failed"
EOF
```

---

## Phase 1: Critical Bug Fixes

### 1.1 Fix EnrichmentController Contract

**File:** `apps/backend/src/modules/enrichment/enrichment.controller.ts`

**Current (bug):**
```typescript
@Post('/leads/:id/enrich')
async enrichLead(@Param('id') id: string) {
  await this.queueService.addEnrichmentJob(id);
  return { message: 'Enrichment job queued' };
}
```

**Fix:**
```typescript
@Post('/leads/:id/enrich')
async enrichLead(@Param('id') id: string) {
  const job = await this.queueService.addEnrichmentJob(id);
  return { jobId: job.id };
}
```

Frontend `enrichment.ts:60` expects `{ jobId: string }` — this bug silently breaks job tracking.

### 1.2 Fix PublishingService Variant Support

**File:** `apps/backend/src/modules/publishing/site-publisher.service.ts`

**Problem:** `publish(slug)` reads from `HUGO_SITES_PATH/<slug>/` but HugoCompiler outputs to `<slug>--<variantId>/`. No symlink switching for active variant.

**Fix — add methods:**

```typescript
interface PublishOptions {
  variantId?: string;
}

async publish(slug: string, options?: PublishOptions): Promise<void> {
  const variantId = options?.variantId;
  const sourcePath = variantId ? `${slug}--${variantId}` : slug;
  const targetPath = path.join(this.sitesPath, sourcePath);

  if (!await fs.pathExists(targetPath)) {
    throw new NotFoundException(`Built site not found: ${sourcePath}`);
  }

  // Symlink: <slug> → <slug>--<activeVariantId>
  const symlinkPath = path.join(this.sitesPath, slug);
  if (variantId) {
    await fs.remove(symlinkPath); // remove old symlink or directory
    await fs.ensureSymlink(targetPath, symlinkPath);
  }
}

async switchActiveVariant(slug: string, newVariantId: string): Promise<void> {
  const sourcePath = path.join(this.sitesPath, `${slug}--${newVariantId}`);
  const symlinkPath = path.join(this.sitesPath, slug);

  if (!await fs.pathExists(sourcePath)) {
    throw new NotFoundException(`Variant build not found: ${slug}--${newVariantId}`);
  }

  await fs.remove(symlinkPath);
  await fs.ensureSymlink(sourcePath, symlinkPath);
}
```

### 1.3 Fix Preview Endpoint Asset Serving

**File:** `apps/backend/src/modules/projects/variants/variants.controller.ts`

**Problem:** `res.sendFile(index.html)` works for HTML but all linked assets (CSS, JS, images) return 404.

**Fix — add static serve path:**
```typescript
// In VariantsController or main.ts — serve variant dirs as static
// Register in AppModule or main.ts:
// app.useStaticAssets(join(HUGO_SITES_PATH), { prefix: '/variant-assets' });

// Then preview endpoint becomes:
@Get('/variants/:variantId/preview')
async preview(@Param('variantId') variantId: string, @Res() res: Response) {
  const variant = await this.variantsService.findById(variantId);
  // Redirect to variant asset dir which resolves relative paths
  res.redirect(`/variant-assets/${variant.project.slug}--${variantId}/index.html`);
}
```

Or use `express.static` middleware on the variant directory directly:
```typescript
// In main.ts bootstrap():
const expressApp = app.getHttpAdapter().getInstance();
expressApp.use('/variant-preview', express.static(HUGO_SITES_PATH));
```

Then preview URL becomes `/variant-preview/<slug>--<variantId>/index.html`.

### 1.4 Wire Unused Env Vars

**ENRICHMENT_AUTO_RUN** — check on lead creation, auto-queue enrichment job.

**File:** `apps/backend/src/modules/leads/leads.service.ts` (or `leads.controller.ts`)
```typescript
async create(dto: CreateLeadDto) {
  const lead = await this.prisma.lead.create({
    data: {
      ...dto,
      enrichmentSources: dto.enrichmentSources ?? this.configService.get('ENRICHMENT_DEFAULT_SOURCES')?.split(','),
    },
  });

  if (this.configService.get('ENRICHMENT_AUTO_RUN') === 'true') {
    await this.queueService.addEnrichmentJob(lead.id);
  }

  return lead;
}
```

**INSTAGRAM_ACCESS_TOKEN** — if present, use Graph API instead of web_profile_info.

**File:** `apps/backend/src/modules/scraping/providers/instagram.provider.ts`
```typescript
constructor(@Inject('INSTAGRAM_ACCESS_TOKEN') private readonly accessToken?: string) {}

async scrape(username: string): Promise<InstagramEnrichment> {
  if (this.accessToken) {
    return this.scrapeViaGraphApi(username); // richer data
  }
  return this.scrapeViaWebProfile(username); // current fallback
}
```

---

## Phase 2: Enrichment Analysis Layer (LLM)

### 2.1 EnrichmentAnalysisService

**New file:** `apps/backend/src/modules/enrichment/enrichment-analysis.service.ts`

Three independent analysis methods, called in parallel after provider data collection:

```typescript
@Injectable()
export class EnrichmentAnalysisService {
  constructor(private readonly llm: LlmService) {}

  async analyze(rawData: ProviderRawData[], lead: Lead): Promise<Partial<EnrichmentData>> {
    const existingData = (lead.enrichmentData as EnrichmentData) || {};

    const [brand, competitors, sales] = await Promise.all([
      this.brandAnalysis(rawData, existingData),
      this.competitorAnalysis(rawData, existingData),
      this.salesScriptGeneration(rawData, existingData, lead),
    ]);

    return deepMerge(existingData, brand, competitors, sales);
  }
}
```

**LLM Model:** Haiku (cheapest) — extraction/structuring, not creative generation.

### 2.2 Brand Analysis

**Method:** `brandAnalysis(rawData, existingData) → Partial<EnrichmentData>`

**Prompt template:**
```
You are a brand analyst. Analyze this business data and extract structured brand information.

BUSINESS DATA:
- Bio/About: {bio}
- Recent posts: {posts}
- Reviews: {reviews}
- Existing brand info: {existing}

Return JSON with these fields (omit if not found):
{
  "brandColors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "extractedFrom": "logo|website|posts" },
  "fonts": { "preferred": ["font1"], "note": "observed in logo/posts" },
  "toneOfVoice": {
    "style": "professional|friendly|luxury|casual|technical|warm|bold",
    "formality": "formal|semi-formal|casual",
    "keyPhrases": ["recurring phrase 1"],
    "languageMix": "uk|ru|en|mix",
    "emojiUsage": "heavy|moderate|rare|none",
    "sampleBio": "rewritten best version of their bio"
  }
}
```

### 2.3 Competitor Analysis

**Method:** `competitorAnalysis(rawData, existingData) → Partial<EnrichmentData>`

For each competitor found by GoogleMapsProvider:
1. If competitor has `website` → `WebFetch` the website → LLM analysis
2. LLM analyzes: pages, online booking presence, price list, portfolio, reviews, strengths, weaknesses
3. Cross-reference with our business → market gap analysis

**Prompt template (per competitor):**
```
Analyze this competitor website for the business "{businessName}".

COMPETITOR: {name}, website: {url}, rating: {rating}
OUR BUSINESS: {ourServices}, {ourPrices}

Extract:
- Pages/structure
- Has online booking: yes/no (evidence)
- Has price list: yes/no
- Has portfolio/gallery: yes/no
- Has reviews/testimonials: yes/no
- Strengths: [3-5 specific things they do well]
- Weaknesses: [3-5 things they're missing or doing poorly]
- Positioning statement
- Unique selling points: [2-4]

Then identify gaps: what are they NOT doing that we could exploit?
```

**Market gap synthesis (after all competitors analyzed):**
```
Given our business "{name}" and these {N} competitors analyzed:

OUR SERVICES: {services}
COMPETITOR SUMMARIES: {summaries}

Identify:
- 3-5 market opportunities (things no competitor does well)
- Recommended website pages (what pages would differentiate us)
- Differentiation angle (1 sentence — why choose us)
```

### 2.4 Sales Script Generation

**New file:** `apps/backend/src/modules/enrichment/sales-script-generator.ts`

**Method:** `salesScriptGeneration(rawData, existingData, lead) → Partial<EnrichmentData>`

**Output schema — extended `SalesOpportunity` and new `SalesScript`:**

```typescript
interface SalesScript {
  // Opening
  opening: {
    greeting: string;           // "Добрий день, {name}! Це {agent} з PromptSite..."
    icebreaker: string;         // "Бачу ви в {niche} вже {years} років..."
    hook: string;               // "Ми допомогли {similar} збільшити клієнтів на 40%..."
  };

  // Discovery phase
  discovery: {
    qualificationQuestions: { question: string; purpose: string }[];  // 5-7 questions
    painPointProbes: { question: string; target: string }[];          // 3-4 probes
    budgetSignals: string[];    // Phrases that signal budget availability
  };

  // Value proposition
  valueProposition: {
    corePromise: string;        // 1 sentence
    tailoredToBusiness: string; // How this specifically helps THEIR business
    roiExamples: { scenario: string; result: string }[];  // 2-3 concrete examples
  };

  // Objection handling
  objections: {
    objection: string;          // "Це дорого"
    rootCause: string;          // Why they say this
    response: string;           // Exact words to say
    followUp: string;           // If they keep pushing back
    evidence?: string;          // Data point or example to cite
  }[];                          // 5-7 objections

  // Closing
  closing: {
    trialCloses: string[];      // 2-3 trial closes
    assumptiveClose: string;    // "Тоді давайте почнемо з безкоштовного аудиту..."
    urgencyBuilder: string;     // "Зараз у нас спеціальна пропозиція для {niche}..."
    alternativeClose: string;   // If assumptive fails
  };

  // Follow-up
  followUp: {
    sameDaySms: string;         // SMS template
    nextDayEmail: string;       // Email template
    threeDayCallback: string;   // Call script after 3 days
    referralAsk: string;        // How to ask for referrals even if they said no
  };

  // Strategy meta
  strategy: {
    targetDecisionMaker: string;    // "Власник, usually 35-50 male"
    bestTimeToCall: string;         // "Tue-Thu 10:00-12:00"
    dealBreakers: string[];         // Things that kill the deal
    quickWins: string[];            // Easy concessions to keep deal alive
    competitiveAdvantages: string[]; // Our strengths vs their current setup
  };
}

interface SalesOpportunity {
  gap: string;                  // What they're missing
  currentState: string;         // How they operate now
  recommendation: string;       // What we propose
  pitchAngle: string;           // How to pitch THIS specific gap
  revenueImpact: string;        // "~15,000 UAH/month lost to competitor X"
  scriptExcerpt: string;        // Relevant portion of sales script for this gap
}
```

**Prompt strategy:** One LLM call per section (opening, discovery, value, objections, closing, follow-up, strategy) — each independent, called in parallel where possible. Total ~7 lightweight Haiku calls.

**Prompt example (objections):**
```
You are a senior sales trainer for a web development agency in Ukraine.

BUSINESS: {name}, niche: {niche}, city: {city}
WEAKNESSES IDENTIFIED:
{weaknesses}

COMPETITOR LANDSCAPE:
{competitors}

OBJECTION: Generate 5-7 common objections this specific business owner would raise when pitched a new website.

For each objection provide:
1. Exact words they'd say (in Ukrainian or Russian, matching business language)
2. Root psychological cause
3. Exact response script (2-3 sentences)
4. Follow-up if they push back again
5. Evidence/data point to support your response

Be specific to THIS business. Generic objections waste our time.
```

### 2.5 Updated EnrichmentService Flow

```typescript
async enrichLead(leadId: string): Promise<void> {
  const lead = await this.prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const sources = lead.enrichmentSources as string[];

  // Phase 1: Collect raw data (parallel)
  const providerResults = await Promise.all(
    sources.map(source => this.factory.createForProvider(source)?.enrich(lead))
  );

  // Phase 2: LLM analysis (parallel — brand + competitors + sales)
  const analysis = await this.analysisService.analyze(
    providerResults.filter(Boolean),
    lead,
  );

  // Phase 3: Save
  await this.prisma.lead.update({
    where: { id: leadId },
    data: {
      enrichmentData: analysis,
      enrichedAt: new Date(),
    },
  });
}
```

---

## Phase 3: Provider Data Maximization

### 3.1 InstagramProvider Extensions

**File:** `apps/backend/src/modules/scraping/providers/instagram.provider.ts`

| Data | Current | Target |
|------|---------|--------|
| Profile photo | ✅ (150x150) | HD version (1080x1080) |
| Post images | ❌ | Last 12 posts, carousel → all images |
| Reels | ❌ | Preview + caption |
| Highlights | ❌ | Titles + cover images |
| Contact buttons | ❌ | Email, phone, directions from profile |
| Bio links | ✅ (raw) | Parsed: WhatsApp/Viber/Telegram numbers |
| Story mentions | ❌ | If accessible via token |

**Strategy:** If `INSTAGRAM_ACCESS_TOKEN` present → use Graph API (richer); otherwise enhance existing web_profile_info parser.

### 3.2 FacebookProvider Extensions

**File:** `apps/backend/src/modules/enrichment/providers/facebook.provider.ts`

| Data | Current | Target |
|------|---------|--------|
| Page photos | ❌ | Profile + cover + albums |
| Reviews | 20 max | All available (paginate) |
| Posts | 20 max | 50+ with pagination |
| About text | Minimal | Full: mission, history, awards |
| Contact info | Partial | Phone, email, website, messenger |

### 3.3 GoogleMapsProvider Extensions

**File:** `apps/backend/src/modules/enrichment/providers/google-maps.provider.ts`

| Data | Current | Target |
|------|---------|--------|
| Photos | Up to 5 | All available (max 10 per API, 1600px) |
| Reviews | All | All (already done) |
| Attributes | ❌ | wheelchair, delivery, dine_in, reservations |
| Competitor services | `[]` stub | Real scraping via website + LLM |
| Competitor positioning | `''` stub | LLM analysis |

---

## Phase 4: Frontend Components

### 4.1 BrandCard

**New file:** `apps/frontend/src/lib/components/enrichment/BrandCard.svelte`

```svelte
<!-- Props: { data: EnrichmentData } -->
<div class="brand-card">
  {#if data.logoUrl}
    <img src={data.logoUrl} alt="Logo" class="logo" />
  {:else}
    <div class="logo-placeholder">{businessInitial}</div>
  {/if}

  <div class="brand-colors">
    {#each [data.brandColors?.primary, data.brandColors?.secondary, data.brandColors?.accent] as color}
      {#if color}
        <div class="color-swatch" style="background:{color}" title={color}>{color}</div>
      {/if}
    {/each}
  </div>

  <div class="tone">
    <Badge>{data.toneOfVoice?.style}</Badge>
    <Badge>{data.toneOfVoice?.formality}</Badge>
    {#each data.toneOfVoice?.keyPhrases ?? [] as phrase}
      <Badge variant="outline">{phrase}</Badge>
    {/each}
  </div>

  <div class="stats">
    {#each Object.entries(data.stats ?? {}) as [key, value]}
      <StatBadge {key} {value} />
    {/each}
  </div>
</div>
```

### 4.2 CompetitorCard

**New file:** `apps/frontend/src/lib/components/enrichment/CompetitorCard.svelte`

Props: `competitor: CompetitorInfo`

Sections:
- Header: name, rating stars, distance, website link
- Services table: name + price
- Website analysis: checklist icons (booking/prices/portfolio/reviews) + strengths/weaknesses
- Positioning statement
- Unique selling points

### 4.3 SalesOpportunityCard

**New file:** `apps/frontend/src/lib/components/enrichment/SalesOpportunityCard.svelte`

Props: `opportunity: SalesOpportunity`

- Gap description (highlighted)
- Current state → Recommendation (arrow diagram)
- Pitch angle (quote box)
- Revenue impact (number, large, red/green)
- Script excerpt (collapsible)

### 4.4 SalesScriptPanel

**New file:** `apps/frontend/src/lib/components/enrichment/SalesScriptPanel.svelte`

Props: `script: SalesScript`

Tabs:
1. **Opening** — greeting + icebreaker + hook (copyable)
2. **Discovery** — question list with purpose column
3. **Value** — core promise + tailored + ROI examples
4. **Objections** — table: objection → response → follow-up (copyable each row)
5. **Closing** — trial closes → assumptive → urgency → alternative
6. **Follow-up** — SMS/Email/Callback templates (copyable)
7. **Strategy** — decision maker, best time, deal breakers, quick wins

Copy-to-clipboard button on every script block.

### 4.5 VariantGenerator

**New file:** `apps/frontend/src/lib/components/variants/VariantGenerator.svelte`

Form: LLM model dropdown + Image model dropdown + Theme dropdown + "Generate" button.
Replaces inline generation in Project Detail page.

### 4.6 VariantPreview

**New file:** `apps/frontend/src/lib/components/variants/VariantPreview.svelte`

iframe component with fullscreen toggle + Activate/Delete action bar.

### 4.7 Store Fixes

**`leads.ts`** — add to `Lead` interface:
```typescript
enrichmentData?: EnrichmentData | null;
enrichedAt?: string | null;
enrichmentSources?: string[];
```

**`enrichment.ts`** — replace duplicate `EnrichmentData` with:
```typescript
import type { EnrichmentData } from '@prompt-site-builder/shared';
```

### 4.8 Navigation Fix

**`VariantCard.svelte`** — add link to `/dashboard/variants/{variantId}`:
```svelte
<a href="/dashboard/variants/{variant.id}" class="variant-name">{variant.variantName}</a>
```

---

## Phase 6: Add-on Services (Monetization)

Add-on services are **separate paid features** that can be activated per project. Each add-on integrates into the generated Hugo site via embedded widgets/scripts.

### 6.1 Data Model

```prisma
enum AddonType {
  ONLINE_PAYMENT    // WayForPay / Monobank
  ONLINE_BOOKING    // EasyWeek
  CONTENT_MANAGEMENT // Self-service content editing
}

enum AddonStatus {
  INACTIVE
  ACTIVE
  SUSPENDED  // payment failed
}

model ProjectAddon {
  id          String      @id @default(uuid())
  projectId   String
  addonType   AddonType
  status      AddonStatus @default(ACTIVE)
  config      Json        @default("{}")  // Addon-specific config
  priceMonthly Decimal?
  activatedAt DateTime    @default(now())
  expiresAt   DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, addonType])
  @@index([projectId])
}
```

### 6.2 Add-on Definitions

#### A) Online Payment (`ONLINE_PAYMENT`)

**What it does:** Embeds payment form directly on the business's site. Client's customers pay for services/products online.

**Integration:**
- WayForPay widget (iframe embed) or Monobank acquiring
- Hugo shortcode: `{{< payment service="X" price="Y" >}}`
- Config: merchant ID, secret key, default currency (UAH)

**Pricing:** ₴499/month + 2.5% transaction fee

**Frontend config UI:**
- WayForPay credentials (merchant login, secret key)
- Default prices for services
- Test mode toggle

#### B) Online Booking (`ONLINE_BOOKING`)

**What it does:** Embeds EasyWeek booking widget. Client's customers book appointments directly.

**Integration:**
- EasyWeek iframe embed
- Hugo shortcode: `{{< booking >}}`
- Config: EasyWeek widget URL, business ID

**Pricing:** ₴299/month

**Frontend config UI:**
- EasyWeek widget URL
- Business ID
- Calendar embed preferences

#### C) Content Management (`CONTENT_MANAGEMENT`)

**What it does:** Self-service content editor. Business owner can edit texts, update photos, change prices — without touching code. Changes regenerate the site automatically.

**Integration:**
- Custom SvelteKit content editor page at `/dashboard/sites/[slug]/content`
- Edit mode on generated site: `?edit=true` → inline editing
- Changes → re-trigger Hugo build with updated content
- Version history — keep last 5 versions

**Pricing:** ₴799/month (includes up to 5 content updates/month, ₴199 per extra update)

**Frontend editor UI:**
- Page list (matches Hugo content structure)
- Per-page editor: front matter fields + markdown body
- Photo upload/replace with preview
- Service/price editor (structured)
- "Publish changes" button → triggers rebuild
- Version history with rollback

### 6.3 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET /projects/:id/addons` | JWT | List active add-ons |
| `POST /projects/:id/addons` | JWT | Activate add-on |
| `PUT /projects/:id/addons/:addonId` | JWT | Update add-on config |
| `DELETE /projects/:id/addons/:addonId` | JWT | Deactivate add-on |
| `GET /projects/:id/addons/:addonId/payments` | JWT | Payment history |
| `POST /sites/:slug/content/update` | JWT | Update site content (CMS) |
| `GET /sites/:slug/content/history` | JWT | Content version history |
| `POST /sites/:slug/content/rollback/:versionId` | JWT | Rollback to version |

### 6.4 Hugo Integration

Each add-on generates its own Hugo partial + shortcode:

```
/client-sites/<slug>/
  layouts/
    partials/
      addon-payment.html     ← Generated from add-on config
      addon-booking.html     ← Generated from add-on config
    shortcodes/
      payment.html
      booking.html
  content/
    services/
      _index.md             ← May contain {{< payment >}} shortcodes
```

Add-ons are injected into the Hugo build at generation time:

```typescript
// In HugoCompiler or GenerationService
async injectAddons(structure: PageStructure, addons: ProjectAddon[]): Promise<PageStructure> {
  for (const addon of addons) {
    switch (addon.addonType) {
      case 'ONLINE_PAYMENT':
        structure.partials.push(generatePaymentPartial(addon.config));
        break;
      case 'ONLINE_BOOKING':
        structure.partials.push(generateBookingPartial(addon.config));
        break;
      case 'CONTENT_MANAGEMENT':
        structure.partials.push(generateCmsPartial(addon.config));
        break;
    }
  }
  return structure;
}
```

### 6.5 Frontend Components

#### AddonCard
- Add-on name + icon + description
- Price (monthly)
- Status badge (active/inactive/suspended)
- Activate/Deactivate button
- "Configure" button → opens config modal

#### AddonConfigModal
- Dynamic form based on add-on type
- Payment: merchant credentials
- Booking: EasyWeek URL
- CMS: content update limit, editor preferences

#### ContentEditor (for CMS add-on)
- Page list sidebar (from Hugo content/ structure)
- Markdown editor with front matter form
- Photo manager (upload/delete/reorder)
- "Publish" button with build progress indicator
- Version history drawer

### 6.6 Project Detail Page Additions

Add new "Add-ons" section below variant list:
```
┌─────────────────────────────────┐
│ ADD-ONS (paid features)         │
│                                 │
│ 💳 Online Payment    ₴499/mo   │
│    [Active] [Configure]         │
│                                 │
│ 📅 Online Booking    ₴299/mo   │
│    [Inactive] [Activate]        │
│                                 │
│ ✏️ Content Mgmt     ₴799/mo   │
│    [Inactive] [Activate]        │
└─────────────────────────────────┘
```

---

## Phase 7: Tests (was Phase 5)

### Backend

| File | Tests |
|------|-------|
| `enrichment-analysis.service.spec.ts` | Brand analysis returns colors/tone; competitor analysis returns gaps; sales script returns full script; parallel execution |
| `enrichment.controller.spec.ts` | POST returns `{jobId}`; PUT updates sources; GET returns enrichment data |
| `enrichment.service.spec.ts` | Parallel providers; auto-enrichment on lead create; default sources applied |
| `sales-script-generator.spec.ts` | Each script section generated; objection count ≥ 5; valid JSON schema |

### Frontend

| File | Tests |
|------|-------|
| `enrichment.spec.ts` | fetchForLead, enrichLead, updateSources methods |
| `variants.spec.ts` | fetchForProject, create, activate, remove methods |
| `BrandCard.spec.ts` | Renders logo, colors, tone badges, stats |
| `CompetitorCard.spec.ts` | Renders competitor data, website analysis checklist |
| `SalesScriptPanel.spec.ts` | Renders all 7 tabs, copy button works |

### E2E

| Test | Flow |
|------|------|
| `enrichment-flow.spec.ts` | Create lead → set sources → enrich → verify brand/sales/competitors populated |
| `variants-flow.spec.ts` | Create project → generate 3 variants → activate one → verify site accessible |
| `full-pipeline.spec.ts` | Lead → enrich → analyze → generate variants → activate → site online |

---

## Implementation Order

```
Phase 0: Production + CI/CD (~1h)
  0.1 SSH production health check
  0.2 Deploy verification
  0.3 CI/CD simplification (single ci.yml)
  0.4 Deploy script verification

Phase 1: Critical Bug Fixes (~2h)
  1.1 Fix EnrichmentController contract ({jobId})
  1.2 Fix PublishingService variant symlink
  1.3 Fix Preview endpoint asset serving
  1.4 Wire ENRICHMENT_AUTO_RUN + ENRICHMENT_DEFAULT_SOURCES

Phase 2: Enrichment Analysis (~3h)
  2.1 Create EnrichmentAnalysisService
  2.2 Brand analysis (colors, tone, logo, fonts)
  2.3 Competitor analysis (website scraping + LLM gap detection)
  2.4 Sales script generation (full script: opening, discovery, value, objections, closing, follow-up, strategy)
  2.5 Update EnrichmentService to use analysis + parallel providers

Phase 3: Provider Maximization (~2h)
  3.1 Instagram: post images, highlights, contacts
  3.2 Facebook: all reviews, album photos, full about
  3.3 GoogleMaps: all photos, attributes, competitor scraping fix

Phase 4: Frontend (~3h)
  4.1 BrandCard, CompetitorCard, SalesOpportunityCard
  4.2 SalesScriptPanel (7 tabs + copy)
  4.3 VariantGenerator, VariantPreview
  4.4 Store fixes (Lead type, shared import, variantId in generate)
  4.5 Navigation: VariantCard → detail page link

Phase 5: Add-on Services (~3h)
  5.1 DB migration — ProjectAddon table + AddonType/AddonStatus enums
  5.2 AddonService — CRUD, activation, config management
  5.3 AddonController — API endpoints
  5.4 Hugo integration — partials + shortcodes per add-on type
  5.5 Frontend: AddonCard, AddonConfigModal, ContentEditor
  5.6 Project detail page — Add-ons section

Phase 6: Tests (~2h)
  6.1 Backend unit tests
  6.2 Frontend store + component tests
  6.3 E2E smoke test
```

## Risks

1. **LLM cost** — ~7 Haiku calls per enrichment. At ~$0.25/1M tokens, negligible (~$0.005 per analysis)
2. **Website scraping unreliability** — some competitor sites may block WebFetch. Fallback: partial analysis from Google Maps data only
3. **Instagram Graph API** — app review required for full access. Fallback: web_profile_info (working)
4. **PublishingService symlink** — Windows dev environment doesn't support symlinks without admin. Use `fs.copy` fallback on Windows

## Open Questions

- [ ] Instagram Graph API: do we have app review approved?
- [ ] Competitor website scraping: do we respect robots.txt?
- [ ] Sales script language: auto-detect from business data? Default Ukrainian?
