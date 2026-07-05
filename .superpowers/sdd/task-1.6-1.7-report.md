# Task 1.6-1.7: EnrichmentFactory + EnrichmentService

## Status: DONE (code written, tests NOT run — Bash unavailable)

## Files Created

### 1. EnrichmentFactory
- `apps/backend/src/modules/enrichment/providers/enrichment-factory.ts` -- 49 lines
- `apps/backend/src/modules/enrichment/providers/enrichment-factory.spec.ts` -- 43 lines

### 2. EnrichmentService
- `apps/backend/src/modules/enrichment/enrichment.service.ts` -- 74 lines
- `apps/backend/src/modules/enrichment/enrichment.service.spec.ts` -- 184 lines

## What Was Built

### EnrichmentFactory (Task 1.6)
- `createForProvider(source)` -- maps `EnrichmentSource` to provider instance
  - `'facebook'` -> FacebookProvider (direct)
  - `'googleMaps'` -> GoogleMapsProvider (direct)
  - `'instagram'` -> wrapped IEnrichmentProvider adapter. InstagramProvider.enrichFromProfile maps to EnrichmentData shape (photos, logoUrl, stats, sourceUrls)
  - invalid source -> null
- DI constructor: InstagramProvider, FacebookProvider, GoogleMapsProvider

### EnrichmentService (Task 1.7)
- `enrichLead(leadId)` -- orchestrates multi-source enrichment:
  1. Fetches lead from Prisma
  2. Iterates `lead.enrichmentSources` array
  3. Calls `factory.createForProvider()` for each source
  4. Tries each provider, catches errors individually (one failure does not block others)
  5. Merges all results via `mergeResults()`
  6. Updates lead with `enrichmentData` + `enrichedAt`
- `mergeResults()` -- reduces array of Partial\<EnrichmentData\>:
  - Scalar fields: last write wins (spread)
  - Array fields: concatenated (services, reviews, photos, videos, competitors, salesOpportunities, workingHours, faq)
- Graceful handling: missing lead (logs warn, returns), empty sources (logs warn, returns), unknown source (logs warn, continues), provider throws (catches, continues)

### Tests Coverage

#### Factory (4 tests)
- facebook returns correct instance
- googleMaps returns correct instance
- instagram returns wrapped adapter with source + enrich function
- unknown source returns null

#### Service (8 tests)
- lead not found -- no update called
- happy path with facebook + googleMaps -- providers called, results merged, lead updated
- no enrichment sources -- early return, no provider calls
- provider failure -- continues with remaining, partial results saved
- unknown source -- skips gracefully, empty enrichment data saved
- mergeResults concatenates arrays
- mergeResults empty array returns {}
- mergeResults handles mixed scalar + array fields

## TODO (pending Bash availability)
- [ ] Run tests: `npx vitest run src/modules/enrichment/providers/enrichment-factory.spec.ts src/modules/enrichment/enrichment.service.spec.ts`
- [ ] Fix any type errors / failing tests
- [ ] Commit: `git add apps/backend/src/modules/enrichment/ && git commit -m "feat: add EnrichmentFactory and EnrichmentService -- multi-source data collection and merge"`
