# Data Pipeline — Prompt Site Builder

## Overview

System that scrapes businesses without websites, enriches their data from multiple sources, generates Hugo static sites via LLM, and publishes them under `*.sitenow.pp.ua`.

---

## Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ПАЙПЛАЙН ДАНИХ                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SCRAPING (BullMQ queue: "scraping")                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ScrapingService.scrapeAndCreateLeads()                  │   │
│  │                                                          │   │
│  │  Вхід: city="Вінниця", category="Косметологія"          │   │
│  │                                                          │   │
│  │  ApifyProvider.scrapeGoogleMaps()                        │   │
│  │    └─ POST api.apify.com/acts/apify~google-maps-scraper │   │
│  │    └─ Шукає: "Косметологія Вінниця"                     │   │
│  │    └─ Повертає: placeId, name, address, phone, website  │   │
│  │                                                          │   │
│  │  Фільтр: ТІЛЬКИ бізнеси БЕЗ сайту (!website)            │   │
│  │                                                          │   │
│  │  Результат: → LeadsService.create() → PostgreSQL        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  2. ENRICHMENT (BullMQ queue: "enrichment")                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  EnrichmentService.enrichLead(leadId)                   │   │
│  │                                                          │   │
│  │  ┌─ InstagramProvider ─────────────────────────────┐    │   │
│  │  │  - Отримує URL з lead.socialUrl                 │    │   │
│  │  │  - GET instagram.com/api/v1/users/web_profile_info│   │   │
│  │  │  - Парсить: username, fullName, bio, followers,  │    │   │
│  │  │    postsCount, isVerified, recentPosts           │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  ┌─ FacebookProvider ──────────────────────────────┐    │   │
│  │  │  - Шукає Facebook Page по назві + місту         │    │   │
│  │  │  - GET graph.facebook.com/v18.0/page/search      │    │   │
│  │  │  - GET graph.facebook.com/v18.0/{page-id}       │    │   │
│  │  │  - Отримує: about, description, phone, hours,   │    │   │
│  │  │    rating, reviews, cover photo, posts           │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  ┌─ GoogleMapsProvider ────────────────────────────┐    │   │
│  │  │  - Шукає Place ID через Find Place API           │    │   │
│  │  │  - GET maps.googleapis.com/maps/api/place/details│    │   │
│  │  │  - Отримує: photos, reviews, rating, hours,     │    │   │
│  │  │    phone, address, website, coordinates          │    │   │
│  │  │  - Шукає конкурентів: Nearby Search API         │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  EnrichmentAnalysisService.analyze() — LLM-аналіз:     │   │
│  │    ├─ brandAnalysis()     — кольори, шрифти, tone      │   │
│  │    ├─ competitorAnalysis() — хто поруч, ціни, рейтинги  │   │
│  │    └─ salesAnalysis()     — sales script для менеджерів │   │
│  │                                                          │   │
│  │  Результат: → lead.enrichmentData (JSON) → PostgreSQL  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  3. GENERATION (BullMQ queue: "generation")                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  GenerationService.generateSite(request)                │   │
│  │                                                          │   │
│  │  КРОК 1: LLM → контент                                  │   │
│  │    LLMStrategyFactory.create() → OpenAI/Anthropic/etc.  │   │
│  │    PromptBuilder.buildHugoPrompt(businessData)           │   │
│  │    → Повний промпт (149 рядків)                         │   │
│  │    → LLM відповідає JSON: hugoToml, indexMd, aboutMd,  │   │
│  │      servicesMd, contactMd, heroImagePrompt, SEO        │   │
│  │    → Якщо LLM падає: DefaultContentBuilder.build()      │   │
│  │                                                          │   │
│  │  КРОК 2: Збірка структури                               │   │
│  │    buildSiteStructure() → GeneratedSiteStructure         │   │
│  │    Inject addonInjector.injectAddons() (payment, booking)│   │
│  │                                                          │   │
│  │  КРОК 3: Героїчне зображення (DALL-E 3 / Flux)          │   │
│  │    imageStrategy.generateHeroImage(name, category)       │   │
│  │    → heroImagePrompt від LLM → DALL-E 3 API             │   │
│  │    → Якщо падає: placeholder SVG                        │   │
│  │                                                          │   │
│  │  КРОК 4: Збірка сайту                                   │   │
│  │    HugoCompilerService.build(slug, structure, theme)     │   │
│  │    → git clone theme submodule                           │   │
│  │    → hugo --source ./client-sites/{slug}                 │   │
│  │    → Якщо падає: generateStaticSite() — статичний HTML  │   │
│  │                                                          │   │
│  │  КРОК 5: Публікація                                     │   │
│  │    SitePublisherService.publish(slug)                    │   │
│  │    → Копіює /public/ в /var/www/client-sites/{slug}/    │   │
│  │    → Caddy обслуговує: {slug}.sitenow.pp.ua             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

| Source | API | Data | Purpose |
|--------|-----|------|---------|
| **Google Maps** (Apify) | `apify~google-maps-scraper` | Name, address, phone, rating, review count, placeId | Lead creation, basic info |
| **Instagram** | `instagram.com/api/v1/users/web_profile_info` | Bio, followers, posts, tone of voice, emoji usage, recent posts | Brand analysis, tone for copy |
| **Facebook** | `graph.facebook.com/v18.0/page/search` + `/page` | About, description, phone, hours, rating, reviews, cover, posts | Additional contacts, reviews, hours |
| **Google Maps (details)** | `maps.googleapis.com/maps/api/place/details` | Photos, reviews, rating, opening hours, coordinates | Competitive analysis, reviews, photos |
| **Google Maps (competitors)** | `maps.googleapis.com/maps/api/place/nearbysearch` | Competitors in radius, their ratings, distance | Positioning, pricing |
| **LLM** (OpenAI/Anthropic/DeepSeek/MiMo/Gemini) | Respective API | hugoToml, indexMd, aboutMd, servicesMd, contactMd, heroImagePrompt, SEO | Site content |
| **DALL-E 3 / Flux** | `api.openai.com/v1/images/generations` | Hero image | Visual |

---

## Tech Stack

```
BullMQ (Redis)     → Job queue with retry, backoff, 3 attempts
Prisma             → ORM for PostgreSQL (leads, projects, variants, jobs)
NestJS             → Modular architecture, dependency injection
Apify              → Google Maps scraping (external service)
Instagram API      → Profile + posts (web scraping, unofficial API)
Facebook Graph API → Page search + details (requires access token)
Google Places API  → Details + Nearby Search (requires API key)
Hugo SSG           → Static site generation from themes
Caddy              → Reverse proxy with On-Demand TLS
```

---

## Theme → Category Mapping

| Category | Default Theme | Keywords for mapping |
|----------|--------------|---------------------|
| Косметологія, клініка, стоматолог, лікар | `hugo-fresh` | медицина, клінік, стоматолог, лікар |
| Перукарня, салон краси | `hugo-hero-theme` | салон, краси, перукарн |
| Будівництво, ремонт | `hugo-universal-theme` | будівництво, ремонт, будівельн |
| Спортзал, фітнес | `hugo-hero-theme` | спортзал, фітнес, тренажерн |
| Доставка, логістика | `hugo-scroll` | логістика, транспорт, доставк, вантаж |
| Автосервіс | `hugo-universal-theme` | авто, автосервіс, сто, майстерн |
| Клінінг | `hugo-fresh` | клінінг, прибир, уборк |
| Ветеринар | `hugo-fresh` | ветеринар, ветклінік, зооклінік |
| Юридичні послуги | `ananke` | юрист, адвокат, правов, юридичн |

---

## LLM Prompts

### Main Generation Prompt (`prompt-builder.ts`)

The system sends a single 149-line prompt to the LLM with:
- Business context (name, category, description, address, phone, email, social, domain)
- Theme-specific guidance (params, sections, frontmatter schema)
- Category-specific guidance (medical/salon/construction/etc. copy rules)
- AIDA framework instructions (Attention → Interest → Desire → Action)
- Psychology-driven copy rules (Ukrainian "Ви" > "Ми", specific numbers, trust signals)
- 9-section landing page structure (Hero → Problem/Solution → Services → Trust → Steps → Testimonials → FAQ → CTA → Footer)
- Output format: JSON with hugoToml, indexMd, aboutMd, servicesMd, contactMd, heroImagePrompt, seoTitle, seoDescription

### Brand Analysis Prompt (`enrichment-analysis.service.ts`)

Extracts from business data:
- `brandColors`: primary, secondary, accent hex
- `fonts`: preferred font names
- `toneOfVoice`: style, formality, keyPhrases, languageMix, emojiUsage

### Fallback Content (`default-content.builder.ts`)

When LLM fails, generates realistic Ukrainian content with:
- Full AIDA structure
- Category-appropriate services
- Simulated testimonials
- SEO metadata

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/backend/src/modules/scraping/scraping.service.ts` | Orchestrates Google Maps scraping |
| `apps/backend/src/modules/scraping/providers/apify.provider.ts` | Apify Google Maps scraper |
| `apps/backend/src/modules/scraping/providers/instagram.provider.ts` | Instagram profile enrichment |
| `apps/backend/src/modules/enrichment/enrichment.service.ts` | Multi-source enrichment orchestrator |
| `apps/backend/src/modules/enrichment/providers/facebook.provider.ts` | Facebook Page enrichment |
| `apps/backend/src/modules/enrichment/providers/google-maps.provider.ts` | Google Places details + competitors |
| `apps/backend/src/modules/enrichment/enrichment-analysis.service.ts` | LLM-powered brand/competitor/sales analysis |
| `apps/backend/src/modules/generation/prompt-builder.ts` | Centralized LLM prompt construction |
| `apps/backend/src/modules/generation/generation.service.ts` | Site generation orchestrator |
| `apps/backend/src/modules/generation/default-content.builder.ts` | Fallback content when LLM fails |
| `apps/backend/src/modules/generation/strategies/llm-strategy.factory.ts` | LLM provider selection (OpenAI/Anthropic/DeepSeek/MiMo/Gemini/OpenRouter) |
| `apps/backend/src/modules/generation/hugo/hugo-compiler.service.ts` | Hugo build execution |
| `apps/backend/src/modules/publishing/site-publisher.service.ts` | Publish to Caddy webroot |
| `apps/backend/src/modules/queue/queue.service.ts` | BullMQ job queue management |
| `apps/backend/src/modules/generation/themes/theme-registry.ts` | 13 Hugo themes with metadata |
| `apps/backend/src/modules/generation/themes/theme-selector.ts` | Auto-select theme by category |
