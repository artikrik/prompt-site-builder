# Task 1.5 Report — GoogleMapsProvider for Enrichment

**Date:** 2026-07-05
**Branch:** feat/enrichment-and-variants

## Status: DONE_WITH_CONCERNS

Concern: Tests could not be executed (no Bash in this agent context). Files verified via Read tool -- syntax, imports, structure correct. Manual test execution required:

```bash
cd apps/backend && npx vitest run src/modules/enrichment/providers/google-maps.provider.spec.ts
```

Commit also pending:

```bash
git add apps/backend/src/modules/enrichment/providers/google-maps.provider.ts apps/backend/src/modules/enrichment/providers/google-maps.provider.spec.ts
git commit -m "feat: add GoogleMapsProvider — place details, photos, reviews, hours, competitors"
```

## Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/backend/src/modules/enrichment/providers/google-maps.provider.ts` | Created | GoogleMapsProvider: Place API, Photos API, Nearby Search, details mapping |
| `apps/backend/src/modules/enrichment/providers/google-maps.provider.spec.ts` | Created | 18 tests across 5 describe blocks |

## Implementation Details

### google-maps.provider.ts (290 lines)
- Implements `IEnrichmentProvider` with `source = 'googleMaps'`
- Constructor reads `process.env.GOOGLE_MAPS_API_KEY`
- `enrich(businessName, city?, url?)`:
  - Checks API key, returns `{}` if missing
  - findPlace: GET `findplacefromtext/json?input=...&inputtype=textquery&fields=place_id&key=...`
  - getPlaceDetails: GET `place/details/json?place_id=...&fields=photos,reviews,rating,opening_hours,website,formatted_phone_number,formatted_address,types,geometry&key=...`
  - findCompetitors: GET `nearbysearch/json?location=...,...&radius=5000&rankby=prominence&type=...&key=...`
  - Returns: photos, reviews, workingHours, coverPhotoUrl, sourceUrls, stats, competitors
  - All errors caught, logged via NestJS Logger.warn, returns `{}` -- never throws

Private methods:
- `findPlace()` -- calls findplacefromtext, returns place_id or null
- `getPlaceDetails()` -- calls place/details, returns full result or null
- `findCompetitors()` -- calls nearbysearch, maps competitors, returns [] on failure
- `buildPhotoUrls()` -- constructs `photo?maxwidth=800&photoreference=...&key=...` URLs
- `mapReviews()` -- maps GoogleReview[] to EnrichmentReview[], defaults "Anonymous" author
- `mapHours()` -- parses `weekday_text` lines ("Monday: 9:00 AM – 8:00 PM"), filters malformed
- `mapCompetitor()` -- maps nearby result to CompetitorInfo, defaults 0 for rating/reviewCount

### google-maps.provider.spec.ts (356 lines)
Follows FacebookProvider test patterns:

**enrich (6 tests)**
- Structured data from valid place -- 3 sequential fetch mocks (findplace, details, nearby)
- Empty object when no GOOGLE_MAPS_API_KEY -- deletes env var, asserts fetch not called
- Empty object on API error -- mockRejectedValue
- Empty object when findplace returns no candidates -- ZERO_RESULTS status
- Empty object when place details fail -- NOT_FOUND status
- Empty competitors when nearbysearch fails -- 500 status, but reviews/photos still returned

**buildPhotoUrls (3 tests)**
- Photo URL construction with maxwidth, photoreference, api key
- Empty array for undefined photos
- Empty array for empty photos array

**mapReviews (4 tests)**
- Map Google reviews to EnrichmentReview[] with all fields
- "Anonymous" fallback for missing author_name
- Filter out reviews without text or author_name
- Empty array for undefined reviews

**mapHours (4 tests)**
- Parse weekday_text into day/open/close
- Skip malformed lines without proper separator
- Empty array for undefined hours
- Empty array for hours without weekday_text

**mapCompetitor (2 tests)**
- Map nearby result to CompetitorInfo with all fields
- Default rating and reviewCount to 0 when missing

## Google Maps API Endpoints Used
1. `findplacefromtext` -- text search to find place_id
2. `place/details` -- detailed business info (photos, reviews, hours, rating)
3. `nearbysearch` -- competitor discovery within 5km radius
4. `place/photo` -- photo URL construction (not called directly)

## Design Decisions
- `process.env` read in constructor (per task spec), not ConfigService
- Internal try-catch on every API call -- individual failures don't block entire enrichment
- Competitor `services` defaults to `[]` (nearbysearch doesn't provide service-level data)
- `websiteAnalysis`, `positioning`, `uniqueSellingPoints` left empty for competitors (nearbysearch data insufficient)
- `coverPhotoUrl` set to first photo URL when available
- `_url` parameter prefixed with underscore (unused by Google Maps, unlike Facebook)
