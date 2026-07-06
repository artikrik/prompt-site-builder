# Testing

## Coverage: 80%+ required
- Unit/Integration: vitest (backend + frontend)
- E2E frontend: playwright test
- E2E backend: vitest run --config vitest.e2e.config.ts
- Hugo build: hugo --source ./client-sites/<slug> (build validation)

## TDD
RED → GREEN → IMPROVE. Use superpowers tdd-guide agent.
1. Write test (should FAIL)
2. Minimal implementation (should PASS)
3. Refactor
4. Verify 80%+ coverage

## AAA Pattern
```typescript
test('descriptive name of behavior', () => {
  // Arrange
  const input = ...
  // Act
  const result = functionUnderTest(input)
  // Assert
  expect(result).toBe(expected)
})
```

## Test Names
Descriptive: "returns empty array when no markets match query", "throws error when API key is missing"

## Rules
- External API calls MUST be mocked.
- If test fails: check isolation → verify mocks → fix implementation (not tests, unless tests wrong).
- CI: bash scripts/ci-local.sh (lint → typecheck → test → build).
