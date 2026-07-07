# Speed Up Tests — Design Doc

**Date:** 2026-07-07
**Problem:** CI tests take 8-10min. Actual test execution: 7s. Overhead: 99%.

## Root Cause

| Bottleneck | Duration | % |
|------------|----------|---|
| setup-node cache download (`cache: npm`) | 4m 16s | 47% |
| setup-node cache upload (post step) | 2m 2s | 22% |
| npm ci | 1m 31s | 17% |
| Docker PostgreSQL start | 29s | 5% |
| prisma generate + migrate | 5s | 1% |
| Actual tests | 7s | 1% |

Self-hosted runner. `cache: npm` uploads/downloads from GitHub cloud — wasteful when runner has local disk.

Tests mock PrismaService — PostgreSQL/Redis containers are unnecessary.

## Changes

### 1. CI Workflow (`cicd.yml`)

**Remove `cache: npm`** from all `actions/setup-node@v4`:
- Self-hosted runner has persistent `~/.npm`
- Saves 4-6min per job

**Remove Docker PostgreSQL/Redis** from test-backend:
- Delete "Start PostgreSQL", "Start Redis", "Cleanup services" steps
- Delete DB/Redis env vars
- Tests use mocked PrismaService

**Remove prisma steps** from test-backend:
- Delete `npx prisma generate` and `npx prisma migrate deploy`
- Not needed for mocked tests

**Add persistent node_modules cache:**
- Before `npm ci`: copy from `/opt/prompt-site-builder/.node_modules_cache/`
- After `npm ci`: save back to cache dir
- Turbo cache already uses `/opt/prompt-site-builder/.turbo-cache`

### 2. Vitest Config (`apps/backend/vitest.config.ts`)

```ts
pool: 'forks',
poolOptions: {
  forks: {
    minForks: 2,
    maxForks: 4,
  },
},
server: {
  deps: {
    inline: ['@nestjs/common', '@nestjs/core', '@nestjs/testing'],
  },
},
```

- `forks` pool: better isolation, faster teardown for NestJS
- `minForks: 2`: pre-warm workers, no cold start
- `server.deps.inline`: skip externalizing NestJS packages (they're already CJS, avoids dual-package hazard)

### 3. Vitest Config (`apps/frontend/vite.config.ts`)

Add pool config:
```ts
pool: 'forks',
poolOptions: {
  forks: {
    minForks: 1,
    maxForks: 2,
  },
},
```

## Expected Result

| Phase | Before | After |
|-------|--------|-------|
| Cache download | 4m 16s | 0s |
| npm ci | 1m 31s | 30s |
| Docker setup | 29s | 0s |
| prisma steps | 5s | 0s |
| vitest collect | 49s | 15s |
| Cache upload | 2m 2s | 0s |
| **Total** | **~9m** | **~2-3m** |
