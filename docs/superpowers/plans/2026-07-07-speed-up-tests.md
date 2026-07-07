# Speed Up Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce CI test time from ~9min to ~2-3min by removing cache overhead, unnecessary Docker services, and optimizing vitest.

**Architecture:** Modify CI workflow to skip npm cache upload/download (self-hosted runner has local disk), remove PostgreSQL/Redis containers (tests use mocks), add persistent node_modules cache, and tune vitest pool settings.

**Tech Stack:** GitHub Actions, vitest 2.1, NestJS 11, SvelteKit 2

## Global Constraints

- Self-hosted runner at `/opt/prompt-site-builder/`
- Tests use mocked PrismaService — no real DB needed
- Turbo cache already at `/opt/prompt-site-builder/.turbo-cache`
- Pre-commit CI must pass: `bash scripts/ci-local.sh`

---

### Task 1: CI Workflow — remove cache: npm from setup-node

**Files:**
- Modify: `.github/workflows/cicd.yml`

**Interfaces:**
- Produces: CI jobs no longer download/upload npm cache from GitHub cloud

- [ ] **Step 1: Remove `cache: npm` from all `actions/setup-node@v4` steps**

In every job that has `actions/setup-node@v4` with `cache: npm`, remove the `cache` line.

Currently there are 4 occurrences:
1. `lint` job (line ~43)
2. `typecheck` job (line ~64)
3. `test-backend` job (line ~104)
4. `test-frontend` job (line ~172)
5. `build` job (line ~205)

Each currently has:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22.22.3
    cache: npm          # ← remove this line
```

Change to:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22.22.3
```

- [ ] **Step 2: Commit**

---

### Task 2: CI Workflow — remove Docker PostgreSQL/Redis from test-backend

**Files:**
- Modify: `.github/workflows/cicd.yml`

- [ ] **Step 1: Remove Docker steps from test-backend job**

Delete these steps entirely:
- "Start PostgreSQL" (lines 107-123)
- "Start Redis" (lines 125-138)
- "Cleanup services" (lines 152-154)

- [ ] **Step 2: Remove DB/Redis env vars from test-backend**

Delete these env vars from test-backend:
```yaml
DATABASE_URL: postgresql://promptsite:testpassword@localhost:5434/promptsite_test
REDIS_HOST: localhost
REDIS_PORT: 6381
```

- [ ] **Step 3: Commit**

---

### Task 3: CI Workflow — remove prisma steps from test-backend

**Files:**
- Modify: `.github/workflows/cicd.yml`

- [ ] **Step 1: Delete prisma generate and migrate steps**

Remove:
```yaml
- run: npx prisma generate --schema=apps/backend/prisma/schema.prisma
- run: npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
```

- [ ] **Step 2: Commit**

---

### Task 4: CI Workflow — add persistent node_modules cache

**Files:**
- Modify: `.github/workflows/cicd.yml`

- [ ] **Step 1: Add restore step before `npm ci` in ALL jobs (lint, typecheck, test-backend, test-frontend, build)**

Insert before the `npm ci` step in each job:
```yaml
- name: Restore node_modules cache
  run: |
    mkdir -p /opt/prompt-site-builder/.node_modules_cache
    if [ -d /opt/prompt-site-builder/.node_modules_cache/node_modules ]; then
      cp -r /opt/prompt-site-builder/.node_modules_cache/node_modules ./
      cp -r /opt/prompt-site-builder/.node_modules_cache/packages_shared_node_modules packages/shared/node_modules 2>/dev/null || true
      echo "✅ node_modules restored from cache"
    else
      echo "⏭️ No node_modules cache found"
    fi
```

- [ ] **Step 2: Add save step after `npm ci` in ALL jobs**

Insert after the `npm ci` step in each job:
```yaml
- name: Save node_modules cache
  if: always()
  run: |
    rm -rf /opt/prompt-site-builder/.node_modules_cache/node_modules
    cp -r node_modules /opt/prompt-site-builder/.node_modules_cache/node_modules
    mkdir -p /opt/prompt-site-builder/.node_modules_cache/packages_shared_node_modules
    rm -rf /opt/prompt-site-builder/.node_modules_cache/packages_shared_node_modules/*
    cp -r packages/shared/node_modules /opt/prompt-site-builder/.node_modules_cache/packages_shared_node_modules/ 2>/dev/null || true
    echo "✅ node_modules saved to cache"
```

- [ ] **Step 3: Commit**

---

### Task 5: Vitest config — pool optimization

**Files:**
- Modify: `apps/backend/vitest.config.ts`
- Modify: `apps/frontend/vite.config.ts`

- [ ] **Step 1: Update backend vitest.config.ts**

Add pool and server.deps config:
```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['src/**/*.spec.ts'],
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/**/*.module.ts'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 2: Update frontend vite.config.ts test section**

Add pool config to the existing `test` block:
```ts
test: {
  include: ['src/**/*.{test,spec}.{js,ts}'],
  environment: 'jsdom',
  pool: 'forks',
  poolOptions: {
    forks: {
      minForks: 1,
      maxForks: 2,
    },
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    thresholds: {
      lines: 60,
      statements: 60,
    },
  },
},
```

- [ ] **Step 3: Run tests locally to verify**

```bash
cd apps/backend && npx vitest run
cd apps/frontend && npx vitest run
```

- [ ] **Step 4: Commit**
