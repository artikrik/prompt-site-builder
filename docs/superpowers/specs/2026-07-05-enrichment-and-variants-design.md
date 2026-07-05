# Design Spec: Enrichment & Site Variants

**Date:** 2026-07-05
**Branch:** feat/enrichment-and-variants
**Status:** Draft

## Overview

Two major features to improve site generation quality and flexibility:

1. **Data Enrichment** — collect real business data from Instagram, Facebook, Google Maps (photos, prices, services, reviews, brand colors, tone of voice, competitor analysis, sales opportunities). Use verified data instead of LLM-invented content.

2. **Site Variants** — generate multiple site versions per project with different LLM/image models and themes. Preview, compare, and activate one. Preserves generation history.

## Data Model Changes

### New Enum: `VariantStatus`
```prisma
enum VariantStatus {
  DRAFT
  GENERATING
  GENERATED
  PUBLISHED
}
```

### New Model: `SiteVariant`
```prisma
model SiteVariant {
  id           String        @id @default(uuid())
  projectId    String
  variantName  String        // e.g. "GPT-4o + DALL-E 3 + ananke"
  status       VariantStatus @default(DRAFT)
  hugoConfig   Json          @default("{}")
  content      Json          @default("{}")
  modelUsed    String?
  imageModel   String?
  themeName    String?
  previewUrl   String?
  publishedAt  DateTime?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  project      Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assets       SiteAsset[]
  jobs         GenerationJob[]

  @@index([projectId])
}
```

### Changes to `Project`
- Add `activeVariantId String?` — FK to SiteVariant
- Add `activeVariant SiteVariant?` — relation
- Add `variants SiteVariant[]` — relation

### Changes to `Lead`
- Add `enrichmentData Json @default("{}")` — structured enriched data
- Add `enrichedAt DateTime?` — last enrichment timestamp
- Add `enrichmentSources String[] @default([])` — active sources

### Changes to `GenerationJob`
- Add `variantId String?` — FK to SiteVariant

## Enrichment Data Schema

```typescript
interface EnrichmentData {
  // Content
  services: { name: string; price?: string; description?: string }[];
  reviews: { author: string; text: string; rating?: number }[];
  workingHours: { day: string; open: string; close: string }[];
  faq: { question: string; answer: string }[];

  // Media
  photos: string[];
  videos: string[];
  logoUrl?: string;
  coverPhotoUrl?: string;

  // Brand
  brandColors: { primary: string; secondary: string; accent: string; extractedFrom: string };
  fonts: { preferred: string[]; note: string };
  toneOfVoice: {
    style: string;
    formality: string;
    keyPhrases: string[];
    languageMix: string;
    emojiUsage: string;
    sampleBio: string;
  };

  // Audience
  audienceInsights: {
    followers: number;
    engagementRate: string;
    topLocations: string[];
    ageGroup: string;
  };

  // Customer journey
  customerJourney: {
    bookingChannels: string[];       // "phone", "instagram_dm", "whatsapp", etc.
    paymentMethods: string[];        // "card_transfer", "cash", "terminal"
    messagingApps: string[];         // "viber", "telegram", "whatsapp"
  };

  // Competitors
  competitors: {
    name: string;
    googleMapsUrl?: string;
    website?: string;
    instagram?: string;
    rating: number;
    reviewCount: number;
    distance?: string;
    services: { name: string; price?: string }[];
    websiteAnalysis?: {
      pages: string[];
      hasOnlineBooking: boolean;
      hasPriceList: boolean;
      hasPortfolio: boolean;
      hasReviews: boolean;
      strengths: string[];
      weaknesses: string[];
    };
    positioning: string;
    uniqueSellingPoints: string[];
  }[];

  marketGap: {
    opportunities: string[];
    recommendedPages: string[];
    differentiationAngle: string;
  };

  // Sales
  salesOpportunities: {
    gap: string;
    currentState: string;
    recommendation: string;
    pitchAngle: string;
    revenueImpact: string;
  }[];

  // Meta
  sourceUrls: { instagram?: string; facebook?: string; googleMaps?: string };
  stats: {
    instagramPosts?: number;
    instagramFollowers?: number;
    facebookReviews?: number;
    googleRating?: number;
    googleReviewCount?: number;
  };
}
```

## Enrichment Module

### Providers

| Provider | Sources | Data Collected |
|----------|---------|----------------|
| `InstagramProvider` (extend existing) | Profile, posts, highlights | bio, services, photos, videos, tone, followers, booking/payment hints |
| `FacebookProvider` (new) | Business Page, reviews, Marketplace | services, prices, reviews, cover photo, working hours, customer journey |
| `GoogleMapsProvider` (new) | Places API, Photos, Reviews | photos, reviews, rating, working hours, competitor discovery |

### Factory
`EnrichmentFactory.create(sources: string[])` → returns array of provider instances for requested sources.

### Flow
1. Lead created with `enrichmentSources` → `EnrichmentJob` pushed to BullMQ `scraping` queue
2. `EnrichmentProcessor` calls `EnrichmentService.enrichLead(leadId)`
3. Service gathers data from all configured providers in parallel
4. LLM analyzes raw data → structured `EnrichmentData`
5. Saved to `Lead.enrichmentData` + `Lead.enrichedAt`

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST /leads/:id/enrich` | JWT | Trigger enrichment manually |
| `PUT /leads/:id/enrichment-sources` | JWT | Update active sources |
| `GET /leads/:id/enrichment` | JWT | Get enrichment data |

### LLM Usage in Enrichment
Raw scraped data (post texts, bios, reviews) is fed to LLM with a prompt to extract structured information. This is a lightweight LLM call (Haiku or GPT-4o Mini) — not full generation.

## Site Variants

### Lifecycle
```
DRAFT → GENERATING → GENERATED → PUBLISHED (active on main subdomain)
  │        │             │
  │        └─ FAILED     └─ (can be archived, previewed, or deleted)
  │
  └─ can be deleted
```

### File System Layout
```
/var/www/client-sites/
  luxe/                    # Active variant (symlink to luxe--<activeVariantId>/)
  luxe--a1b2c3d4/          # Variant 1 (generated files)
  luxe--e5f6g7h8/          # Variant 2 (generated files)
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST /projects/:id/variants` | JWT | Create variant + queue generation |
| `GET /projects/:id/variants` | JWT | List all variants for project |
| `GET /variants/:variantId` | JWT | Get variant details |
| `PUT /variants/:variantId/activate` | JWT | Set variant as active (publish) |
| `DELETE /variants/:variantId` | JWT | Delete variant (if not active) |
| `GET /variants/:variantId/preview` | JWT | Serve variant HTML for iframe preview |

### Variant Preview
Preview is served via backend API (not separate subdomain):
- Backend reads variant files from `/var/www/client-sites/<slug>--<variantId>/`
- Frontend embeds in iframe: `<iframe src="https://api.sitenow.pp.ua/variants/<id>/preview">`
- No Caddy changes required — simpler, more secure

### Generation Changes
- `GenerationService.generateSite()` accepts `variantId`
- Result stored in `SiteVariant.hugoConfig` and `SiteVariant.content`
- Assets linked to variant via `SiteAsset` relation
- `HugoCompiler.build()` accepts `variantId` for unique output path
- Publishing: active variant symlinked to main slug directory

### Migration of Existing Projects
- For each existing `Project` with `hugoConfig`, create one `SiteVariant` with status `PUBLISHED`
- Set `Project.activeVariantId` to this variant

## Frontend Changes

### Updated Pages

**Lead Detail (`/dashboard/leads/[id]`):**
- New "Enrichment Panel" section showing:
  - Source toggle (Instagram, Facebook, Google Maps)
  - Brand card (logo, colors, tone)
  - Services list with prices
  - Reviews with ratings
  - Competitor comparison
  - Sales opportunities

**Project Detail (`/dashboard/projects/[id]`):**
- Redesigned to show variant-based generation:
  - Variant Generator form (LLM + Image + Theme pickers)
  - Variant cards grid (model, theme, status, preview/activate/delete)
  - Active variant preview iframe

**New: Variant Detail (`/dashboard/projects/[id]/variants/[variantId]`):**
- Generated content per page
- Hugo config JSON (read-only)
- Assets gallery
- Generation stats

### New Components
| Component | Purpose |
|-----------|---------|
| `VariantCard` | Model/theme/status + actions |
| `VariantGenerator` | LLM + Image + Theme picker → generate |
| `VariantPreview` | iframe + Activate/Delete buttons |
| `EnrichmentPanel` | All enrichment data with sub-components |
| `BrandCard` | Logo, colors, tone of voice |
| `CompetitorCard` | Competitor with website analysis |
| `SalesOpportunityCard` | Gap + recommendation + pitch |

### New Stores
| Store | Purpose |
|-------|---------|
| `variants` | CRUD + activate + preview |
| `enrichment` | Fetch, trigger enrichment, update sources |

## DevOps

### Production Fixes (Phase 0)

1. **Backend healthcheck fix** — investigate logs, verify env vars, DB connection
2. **Wildcard subdomain routing** — ensure `*.sitenow.pp.ua` reaches Caddy:
   - Option A: Nginx wildcard server block proxying to Caddy
   - Option B: Caddy on 443 (swap with Nginx)
   - Verify with: `curl -H "Host: test.sitenow.pp.ua" https://localhost/`
3. **Database backups** — cron job: `pg_dump` → `/opt/backups/promptsite-$(date +%Y%m%d).sql.gz`
4. **Hugo version sync** — update Dockerfile to 0.145.0 (match host)

### New Environment Variables
```bash
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_ACCESS_TOKEN=
GOOGLE_MAPS_API_KEY=
INSTAGRAM_ACCESS_TOKEN=
ENRICHMENT_AUTO_RUN=true
ENRICHMENT_DEFAULT_SOURCES=instagram,facebook,googleMaps
```

### CI/CD Changes
- Add `ENRICHMENT_*` env vars to deploy job (from `/opt/prompt-site-builder/.env`)
- Add Nginx config verification step to deploy job
- Ensure Prisma migrate deploy runs (already in place — creates new tables)

### Caddy Changes
No changes needed. Variant preview uses backend API, not separate subdomains. Active variant uses existing wildcard routing.

### Nginx Changes
Add wildcard server block for `*.sitenow.pp.ua` → proxy to Caddy (port 8080) if not already working.

## Implementation Phases

### Phase 0: Production Fixes (DevOps)
| # | Task | Priority |
|---|------|----------|
| 0.1 | Fix backend healthcheck on production | CRITICAL |
| 0.2 | Fix wildcard subdomain routing | HIGH |
| 0.3 | Set up database backups (cron + pg_dump) | HIGH |
| 0.4 | Sync Hugo version (Docker 0.139.0 → 0.145.0) | MEDIUM |

### Phase 1: Enrichment (Backend)
| # | Task |
|---|------|
| 1.1 | DB migration — enrichment fields on Lead, new enums |
| 1.2 | Extend InstagramProvider — posts, highlights, media, tone analysis |
| 1.3 | Create FacebookProvider — page, reviews, marketplace |
| 1.4 | Create GoogleMapsProvider — places, photos, reviews, competitors |
| 1.5 | Create EnrichmentFactory — select providers by sources |
| 1.6 | Create EnrichmentService — orchestrate collection + LLM structuring |
| 1.7 | Create EnrichmentProcessor (BullMQ) — background enrichment jobs |
| 1.8 | Create EnrichmentController — API endpoints |
| 1.9 | Brand analysis: color extraction, tone of voice, logo detection |
| 1.10 | Competitor analysis: nearby search + website scraping + LLM gap analysis |
| 1.11 | Sales opportunity detection: scan journey → find gaps → generate pitch |
| 1.12 | Add new env vars to .env.example + env.validation.ts |

### Phase 2: Site Variants (Backend)
| # | Task |
|---|------|
| 2.1 | DB migration — SiteVariant table, Project.activeVariantId, GenerationJob.variantId |
| 2.2 | Create VariantsService — CRUD operations |
| 2.3 | Create VariantsController — API endpoints |
| 2.4 | Update GenerationService — accept variantId, store result in variant |
| 2.5 | Update HugoCompiler — variant-specific output paths |
| 2.6 | Update PublishingService — symlink active variant to main slug |
| 2.7 | Create variant preview endpoint (serve HTML from variant dir) |
| 2.8 | Migration script for existing projects → create default variants |

### Phase 3: Frontend
| # | Task |
|---|------|
| 3.1 | Create `enrichment` store |
| 3.2 | Create `variants` store |
| 3.3 | Build EnrichmentPanel + sub-components (BrandCard, CompetitorCard, SalesOpportunityCard) |
| 3.4 | Build VariantCard, VariantGenerator, VariantPreview |
| 3.5 | Update Lead Detail page — add enrichment section |
| 3.6 | Rewrite Project Detail page — variant-based generation |
| 3.7 | Create Variant Detail page |
| 3.8 | Update settings page — enrichment defaults, new model options |

### Phase 4: Testing
| # | Task |
|---|------|
| 4.1 | Backend: EnrichmentModule unit tests (providers, factory, service) |
| 4.2 | Backend: VariantsService + VariantsController unit tests |
| 4.3 | Backend: Updated GenerationService tests (variant-aware) |
| 4.4 | Frontend: enrichment + variants store tests |
| 4.5 | Frontend: new component tests |
| 4.6 | E2E: full enrichment + multi-variant generation flow |

### Phase 5: Final Deploy
| # | Task |
|---|------|
| 5.1 | Update server .env with new enrichment keys |
| 5.2 | Verify Nginx wildcard routing works |
| 5.3 | Deploy + run migrations |
| 5.4 | Health check all services |
| 5.5 | Smoke test: create lead → enrich → generate 3 variants → activate → verify site |

## Open Questions
- [ ] Facebook API: do we have a Business App approved? (needs app review for Page access)
- [ ] Instagram API: use official Graph API or continue with internal endpoint?
- [ ] Google Maps API key: do we have one with Places API enabled?
- [ ] Backup retention policy: how many days to keep?

## Risks
1. **API rate limits** — Instagram/Facebook/Google Maps have strict quotas. Need retry + backoff + fallback to partial data.
2. **Facebook App Review** — Page access requires app review (2-7 days). May delay Facebook enrichment.
3. **Enrichment cost** — LLM calls to structure enrichment data add token cost. Mitigate by using Haiku/smaller models for this step.
4. **Disk space** — multiple variants per project = multiple Hugo builds. Estimate ~5-50MB per variant depending on assets.
