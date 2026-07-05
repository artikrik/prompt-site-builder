# Task 1.4 Report — FacebookProvider for Enrichment

**Date:** 2026-07-05
**Branch:** feat/enrichment-and-variants

## Status: DONE_WITH_CONCERNS

Concern: Tests could not be executed (no Bash in this agent context). Files verified via Read tool -- syntax, imports, structure correct. Manual test execution required:

```bash
cd apps/backend && npx vitest run src/modules/enrichment/providers/facebook.provider.spec.ts
```

Commit also pending:

```bash
git add apps/backend/src/modules/enrichment/providers/types.ts apps/backend/src/modules/enrichment/providers/facebook.provider.ts apps/backend/src/modules/enrichment/providers/facebook.provider.spec.ts
git commit -m "feat: add FacebookProvider — business page, reviews, posts, working hours"
```

## Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/backend/src/modules/enrichment/providers/types.ts` | Created | IEnrichmentProvider interface, EnrichmentSource type |
| `apps/backend/src/modules/enrichment/providers/facebook.provider.ts` | Created | FacebookProvider: Graph API v18.0, page search, posts, ratings, service extraction |
| `apps/backend/src/modules/enrichment/providers/facebook.provider.spec.ts` | Created | 16 tests across 4 describe blocks |

## Implementation Details

### types.ts (9 lines)
- `EnrichmentSource` — union type: `'instagram' | 'facebook' | 'googleMaps'`
- `IEnrichmentProvider` — interface with `source` and `enrich()` method returning `Partial<EnrichmentData>`

### facebook.provider.ts (257 lines)
- Implements `IEnrichmentProvider` with `source = 'facebook'`
- `enrich(businessName, city?, url?)` — main entry point:
  - Checks `process.env.FACEBOOK_ACCESS_TOKEN`, returns `{}` if missing
  - Finds page via search or URL extraction
  - Fetches posts + ratings in parallel with `Promise.all`
  - Returns structured `Partial<EnrichmentData>`: services, reviews, workingHours, coverPhotoUrl, sourceUrls, stats
  - All errors caught, logged via NestJS Logger.warn, returns `{}`

Private methods:
- `findPage()` — searches Facebook Graph API `/pages/search?q=...` or extracts page ID from URL
- `fetchPageDetails()` — GET `/{page-id}?fields=name,about,description,category,phone,emails,website,location,cover,rating_count,overall_star_rating,hours`
- `fetchPosts()` — GET `/{page-id}/posts?fields=message,created_time&limit=20` (internal try/catch)
- `fetchRatings()` — GET `/{page-id}/ratings?fields=reviewer{name},review_text,rating,created_time&limit=20` (internal try/catch)
- `extractPageId()` — regex for numeric page IDs and username extraction from facebook.com URLs
- `extractServices()` — price pattern matching (₴, грн, USD, EUR, $), dedup by lowercase name, skip <3 or >120 chars
- `mapRatings()` — maps FacebookRating[] to EnrichmentReview[], defaults to "Anonymous" author
- `mapHours()` — maps Facebook hours object (mon_1_open/mon_1_close format) to EnrichmentWorkingHours[]

### facebook.provider.spec.ts (358 lines)
Follows InstagramProvider test patterns:

**enrich (5 tests)**
- Structured data from valid page — 4 sequential fetch mocks, verifies all fields
- Empty object when no FACEBOOK_ACCESS_TOKEN — deletes env var, asserts fetch not called
- Empty object on API error — mockRejectedValue
- Empty object when page search returns no results
- URL-based page lookup — only 3 fetch calls (no search step)

**extractServices (5 tests)**
- Price extraction (₴, грн, грн.) — 3 services with prices
- USD and EUR price parsing
- Skip short/long lines — <3 chars filtered, >120 chars filtered
- Empty posts (missing message field)
- Deduplication by name

**mapRatings (3 tests)**
- Full mapping with all fields
- "Anonymous" fallback for missing reviewer name
- Filter out ratings without text or reviewer name

**mapHours (3 tests)**
- Standard 3-day mapping with day labels
- Skip incomplete entries (missing close time)
- Undefined hours returns empty array

## Design Decisions
- `process.env` used directly (not ConfigService) per task spec and InstagramProvider pattern
- `extractServices` uses same regex as InstagramProvider for consistency
- `fetchPosts`/`fetchRatings` have internal try/catch -- post/rating failures don't block the whole enrichment
- `Promise.all` for parallel posts+ratings fetching
- No `console.log` -- NestJS Logger throughout
