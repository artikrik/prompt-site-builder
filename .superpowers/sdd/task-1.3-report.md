# Task 1.3: Extend InstagramProvider with full enrichment capabilities

## Status: IMPLEMENTED (tests not run — no Bash available)

## Changes

### File: `apps/backend/src/modules/scraping/providers/instagram.provider.ts`
- Added `InstagramEnrichment` interface (lines 3-25)
- Added `enrichFull(username)` method (lines 79-107): reuses `enrichFromProfile`, extracts structured business data
- Added `extractServices(text)` private method (lines 109-136): parses price patterns `₴|грн|USD|EUR|$`
- Added `collectPhotos(profile)` private method (lines 138-144): collects profile pic URL
- Added `detectCustomerJourney(text)` private method (lines 146-187): detects booking channels, payment methods, messaging apps
- Added `analyzeTone(text, bio)` private method (lines 189-230): detects emoji usage, formality (Ви/ти), style

### File: `apps/backend/src/modules/scraping/providers/instagram.provider.spec.ts` (NEW)
- 22 test cases across 5 describe blocks:
  - `enrichFull` (4 tests): valid profile, null on 404, null on network error, minimal profile
  - `extractServices` (4 tests): UAH prices, USD/EUR, lines without prices, skip short/long lines
  - `detectCustomerJourney` (4 tests): booking channels, payment methods, messaging apps, empty arrays
  - `analyzeTone` (7 tests): emoji moderate, emoji none, formal (Ви), informal (ти), mixed, sampleBio truncation, empty text
  - `extractUsernameFromUrl` (2 tests): valid URLs, non-Instagram URLs
- All external fetch calls mocked via `globalThis.fetch`

## Test execution
NOT RUN — Bash tool unavailable in this context. Steps 4 (run tests) and 5 (commit) not executed.

Manual steps required:
```bash
cd apps/backend && npx vitest run src/modules/scraping/providers/instagram.provider.spec.ts
git add apps/backend/src/modules/scraping/providers/
git commit -m "feat: extend InstagramProvider with enrichFull — services, photos, tone, customer journey"
```

## Files modified
- `apps/backend/src/modules/scraping/providers/instagram.provider.ts` — +176 lines
- `apps/backend/src/modules/scraping/providers/instagram.provider.spec.ts` — +312 lines (new)
