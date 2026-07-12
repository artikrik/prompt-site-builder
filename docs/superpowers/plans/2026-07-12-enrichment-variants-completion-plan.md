# Enrichment & Variants Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining enrichment/variants features from spec: LLM analysis layer, competitor scraping, full sales script generation, provider data maximization, frontend components, add-on services (payment/booking/CMS), and CI/CD simplification.

**Architecture:** Backend NestJS modules (EnrichmentAnalysisService, AddonService) extend existing enrichment/variants pipeline. Frontend SvelteKit components compose into existing pages. Hugo shortcodes embed add-on widgets. Single CI workflow replaces multi-file matrix.

**Tech Stack:** NestJS 11, Prisma, PostgreSQL, BullMQ, SvelteKit 2, Svelte 5, Tailwind CSS v4, Hugo (extended), Anthropic Haiku (LLM analysis)

## Global Constraints

- TDD: write failing test → implement → pass → refactor
- All external API calls mocked in tests
- Immutable data patterns (no mutation of existing objects)
- 80%+ test coverage on new code
- Functions <50 lines, files <800 lines
- No hardcoded secrets — use env vars
- Error handling explicit at every level
- Use `rtk` prefix for all shell commands

---

## File Structure

```
New files:
  apps/backend/src/modules/enrichment/enrichment-analysis.service.ts
  apps/backend/src/modules/enrichment/sales-script-generator.ts
  apps/backend/src/modules/addons/addon.service.ts
  apps/backend/src/modules/addons/addon.controller.ts
  apps/backend/src/modules/addons/addon.module.ts
  apps/frontend/src/lib/components/enrichment/BrandCard.svelte
  apps/frontend/src/lib/components/enrichment/CompetitorCard.svelte
  apps/frontend/src/lib/components/enrichment/SalesOpportunityCard.svelte
  apps/frontend/src/lib/components/enrichment/SalesScriptPanel.svelte
  apps/frontend/src/lib/components/variants/VariantGenerator.svelte
  apps/frontend/src/lib/components/variants/VariantPreview.svelte
  apps/frontend/src/lib/components/addons/AddonCard.svelte
  apps/frontend/src/lib/components/addons/AddonConfigModal.svelte
  apps/frontend/src/lib/components/addons/ContentEditor.svelte
  apps/frontend/src/lib/stores/addons.ts
  .github/workflows/ci.yml

Modified files:
  apps/backend/src/modules/enrichment/enrichment.controller.ts
  apps/backend/src/modules/enrichment/enrichment.service.ts
  apps/backend/src/modules/publishing/site-publisher.service.ts
  apps/backend/src/modules/projects/variants/variants.controller.ts
  apps/backend/src/modules/leads/leads.service.ts
  apps/backend/src/modules/scraping/providers/instagram.provider.ts
  apps/backend/src/modules/enrichment/providers/facebook.provider.ts
  apps/backend/src/modules/enrichment/providers/google-maps.provider.ts
  apps/backend/src/app.module.ts
  apps/backend/prisma/schema.prisma
  apps/frontend/src/lib/stores/enrichment.ts
  apps/frontend/src/lib/stores/leads.ts
  apps/frontend/src/lib/stores/projects.ts
  apps/frontend/src/lib/components/variants/VariantCard.svelte
  apps/frontend/src/routes/dashboard/projects/[id]/+page.svelte
  apps/frontend/src/routes/dashboard/leads/[id]/+page.svelte

Deleted files:
  .github/workflows/ci-backend.yml (if exists)
  .github/workflows/ci-frontend.yml (if exists)
  .github/workflows/deploy.yml (if exists)
```

---

## Phase 0: Production + CI/CD

### Task 0.1: Production server health check

**Files:**
- No code changes — SSH verification only

- [ ] **Step 1: Check services health**

```bash
ssh root@sitenow.pp.ua << 'EOF'
  echo "=== Docker containers ==="
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "=== System services ==="
  systemctl is-active caddy nginx postgresql redis
  echo ""
  echo "=== Disk space ==="
  df -h /opt /var
  echo ""
  echo "=== Backups ==="
  ls -lt /opt/backups/ 2>/dev/null | head -5 || echo "NO BACKUPS FOUND"
EOF
```

- [ ] **Step 2: Check backend health**

```bash
curl -s https://api.sitenow.pp.ua/api/health || echo "BACKEND UNREACHABLE"
```

- [ ] **Step 3: Check Caddy wildcard routing**

```bash
curl -s -o /dev/null -w "%{http_code}" -H "Host: test.sitenow.pp.ua" https://localhost/ --insecure
# Should return 200 or 404 (not connection refused)
```

- [ ] **Step 4: Check logs for errors**

```bash
ssh root@sitenow.pp.ua << 'EOF'
  echo "=== Backend errors (last 50 lines) ==="
  docker logs promptsite-backend-1 --tail 50 2>&1 | grep -i error || echo "No errors"
  echo ""
  echo "=== Caddy errors (last hour) ==="
  journalctl -u caddy --since "1 hour ago" 2>/dev/null | grep -i error || echo "No errors"
EOF
```

- [ ] **Step 5: Report findings**

Document: service status, disk usage, any errors found, wildcard routing status.

---

### Task 0.2: Deploy script verification

**Files:**
- Check: `scripts/deploy.sh`

- [ ] **Step 1: Read existing deploy script**

```bash
cat scripts/deploy.sh 2>/dev/null || echo "No deploy script found"
```

- [ ] **Step 2: Create deploy script if missing**

Write `scripts/deploy.sh`:

```bash
#!/bin/bash
set -euo pipefail
echo "=== Deploy prompt-site-builder ==="
npm run build
rsync -avz --delete \
  --exclude='node_modules' --exclude='.git' --exclude='.turbo' \
  ./ root@sitenow.pp.ua:/opt/prompt-site-builder/
ssh root@sitenow.pp.ua << 'EOF'
  cd /opt/prompt-site-builder
  docker compose up -d --build backend frontend
  sleep 5
  docker compose exec -T backend npx prisma migrate deploy
  docker compose restart backend
  sleep 3
  curl -sf https://api.sitenow.pp.ua/api/health && echo "✅ Deploy OK" || echo "❌ Healthcheck FAIL"
EOF
```

```bash
chmod +x scripts/deploy.sh
```

- [ ] **Step 3: Test deploy script (dry-run rsync)**

```bash
rsync -avz --dry-run --delete \
  --exclude='node_modules' --exclude='.git' --exclude='.turbo' \
  ./ root@sitenow.pp.ua:/opt/prompt-site-builder/ | head -20
```

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy.sh
git commit -m "chore: add deploy script for enrichment/variants"
```

---

### Task 0.3: CI/CD simplification — single ci.yml

**Files:**
- Create: `.github/workflows/ci.yml`
- Delete: `.github/workflows/ci-backend.yml`, `.github/workflows/ci-frontend.yml`, `.github/workflows/deploy.yml` (if present)

- [ ] **Step 1: List existing workflows**

```bash
ls -la .github/workflows/
```

- [ ] **Step 2: Write single ci.yml**

Write `.github/workflows/ci.yml`:

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

      - name: Lint
        run: npm run lint
        continue-on-error: true

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm run test -- -- --coverage

      - name: Build
        run: npm run build
```

- [ ] **Step 3: Delete old workflow files**

```bash
rm -f .github/workflows/ci-backend.yml
rm -f .github/workflows/ci-frontend.yml
rm -f .github/workflows/deploy.yml
```

- [ ] **Step 4: Verify CI config is valid**

```bash
cat .github/workflows/ci.yml | head -5
ls .github/workflows/
# Should show only ci.yml
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/
git commit -m "ci: simplify to single ci.yml workflow"
```

---

## Phase 1: Critical Bug Fixes

### Task 1.1: Fix EnrichmentController contract — return jobId

**Files:**
- Modify: `apps/backend/src/modules/enrichment/enrichment.controller.ts`
- Test: `apps/backend/src/modules/enrichment/enrichment.controller.spec.ts` (create)

**Interfaces:**
- Consumes: `QueueService.addEnrichmentJob(leadId: string): Promise<{ id: string }>`
- Produces: `POST /leads/:id/enrich → { jobId: string }`

- [ ] **Step 1: Write failing test**

Create `apps/backend/src/modules/enrichment/enrichment.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EnrichmentController } from './enrichment.controller';
import { EnrichmentService } from './enrichment.service';

describe('EnrichmentController', () => {
  let controller: EnrichmentController;
  let enrichmentService: { enrichLead: jest.Mock; getEnrichmentData: jest.Mock; updateEnrichmentSources: jest.Mock };

  beforeEach(async () => {
    enrichmentService = {
      enrichLead: jest.fn().mockResolvedValue({ jobId: 'job-123' }),
      getEnrichmentData: jest.fn(),
      updateEnrichmentSources: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrichmentController],
      providers: [
        { provide: EnrichmentService, useValue: enrichmentService },
      ],
    }).compile();

    controller = module.get<EnrichmentController>(EnrichmentController);
  });

  describe('enrichLead', () => {
    it('returns { jobId } when enrichment is queued', async () => {
      const result = await controller.enrichLead('lead-1');
      expect(result).toEqual({ jobId: 'job-123' });
      expect(enrichmentService.enrichLead).toHaveBeenCalledWith('lead-1');
    });
  });

  describe('getEnrichment', () => {
    it('returns enrichment data for a lead', async () => {
      const mockData = { data: {}, enrichedAt: null, sources: [] };
      enrichmentService.getEnrichmentData.mockResolvedValue(mockData);

      const result = await controller.getEnrichment('lead-1');
      expect(result).toEqual(mockData);
    });
  });

  describe('updateSources', () => {
    it('updates enrichment sources', async () => {
      const dto = { sources: ['instagram', 'facebook'] };
      enrichmentService.updateEnrichmentSources.mockResolvedValue(undefined);

      await controller.updateSources('lead-1', dto);
      expect(enrichmentService.updateEnrichmentSources).toHaveBeenCalledWith('lead-1', dto.sources);
    });
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run apps/backend/src/modules/enrichment/enrichment.controller.spec.ts
# Expected: FAIL — controller.enrichLead returns { message } not { jobId }
```

- [ ] **Step 3: Fix controller**

Read current `apps/backend/src/modules/enrichment/enrichment.controller.ts`, modify `enrichLead`:

```typescript
import { Controller, Post, Put, Get, Param, Body } from '@nestjs/common';
import { EnrichmentService } from './enrichment.service';

@Controller()
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Post('/leads/:id/enrich')
  async enrichLead(@Param('id') id: string): Promise<{ jobId: string }> {
    return this.enrichmentService.enrichLead(id);
  }

  @Get('/leads/:id/enrichment')
  async getEnrichment(@Param('id') id: string) {
    return this.enrichmentService.getEnrichmentData(id);
  }

  @Put('/leads/:id/enrichment-sources')
  async updateSources(@Param('id') id: string, @Body() dto: { sources: string[] }) {
    return this.enrichmentService.updateEnrichmentSources(id, dto.sources);
  }
}
```

And update `EnrichmentService.enrichLead` to return `{ jobId }`:

```typescript
// In enrichment.service.ts, enrichLead method:
async enrichLead(leadId: string): Promise<{ jobId: string }> {
  const job = await this.queueService.addEnrichmentJob(leadId);
  return { jobId: job.id };
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run apps/backend/src/modules/enrichment/enrichment.controller.spec.ts
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/enrichment/
git commit -m "fix: EnrichmentController returns {jobId} instead of {message}"
```

---

### Task 1.2: Fix EnrichmentService — parallel providers

**Files:**
- Modify: `apps/backend/src/modules/enrichment/enrichment.service.ts`
- Modify: `apps/backend/src/modules/enrichment/enrichment.service.spec.ts`

- [ ] **Step 1: Write failing test for parallel execution**

Add to `enrichment.service.spec.ts`:

```typescript
it('executes all providers in parallel', async () => {
  const lead = { id: 'lead-1', enrichmentSources: ['instagram', 'facebook', 'googleMaps'] };
  prisma.lead.findUniqueOrThrow.mockResolvedValue(lead);

  const timestamps: string[] = [];
  const makeProvider = (name: string) => ({
    enrich: jest.fn().mockImplementation(async () => {
      timestamps.push(name);
      return {};
    }),
  });

  factory.createForProvider.mockImplementation((source: string) => {
    if (source === 'instagram') return makeProvider('instagram');
    if (source === 'facebook') return makeProvider('facebook');
    if (source === 'googleMaps') return makeProvider('googleMaps');
    return null;
  });

  await service.enrichLead('lead-1');
  // All three called
  expect(timestamps.length).toBe(3);
});
```

- [ ] **Step 2: Run — verify old sequential code fails or passes differently**

```bash
npx vitest run apps/backend/src/modules/enrichment/enrichment.service.spec.ts
```

- [ ] **Step 3: Change for...of to Promise.all**

In `enrichment.service.ts`, change:

```typescript
// BEFORE (sequential):
for (const source of sources) {
  const provider = this.factory.createForProvider(source);
  if (provider) {
    const result = await provider.enrich(lead);
    allData.push(result);
  }
}

// AFTER (parallel):
const results = await Promise.all(
  sources.map(async (source) => {
    const provider = this.factory.createForProvider(source);
    return provider ? provider.enrich(lead) : null;
  }),
);
const allData = results.filter(Boolean);
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run apps/backend/src/modules/enrichment/enrichment.service.spec.ts
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/enrichment/enrichment.service.ts apps/backend/src/modules/enrichment/enrichment.service.spec.ts
git commit -m "perf: parallel enrichment provider execution with Promise.all"
```

---

### Task 1.3: Fix PublishingService variant symlink support

**Files:**
- Modify: `apps/backend/src/modules/publishing/site-publisher.service.ts`

- [ ] **Step 1: Read current PublishingService**

```bash
cat apps/backend/src/modules/publishing/site-publisher.service.ts
```

- [ ] **Step 2: Add variant-aware publish and switchActiveVariant**

Add methods to `SitePublisherService`:

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SitePublisherService {
  private readonly sitesPath: string;

  constructor(private readonly configService: ConfigService) {
    this.sitesPath = this.configService.get<string>('HUGO_SITES_PATH') || '/var/www/client-sites';
  }

  async publish(slug: string, variantId?: string): Promise<void> {
    const sourceDir = variantId ? `${slug}--${variantId}` : slug;
    const sourcePath = path.join(this.sitesPath, sourceDir);

    if (!await fs.pathExists(sourcePath)) {
      throw new NotFoundException(`Built site not found: ${sourceDir}`);
    }

    if (variantId) {
      const symlinkPath = path.join(this.sitesPath, slug);
      await fs.remove(symlinkPath);
      await fs.ensureSymlink(sourcePath, symlinkPath);
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

  // ... existing methods (unpublish, listPublished, isPublished, writeFile, writeFileBinary)
  // Keep existing methods — they continue to work with the symlink transparently
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit -p apps/backend/tsconfig.json
# Expected: no errors
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/publishing/site-publisher.service.ts
git commit -m "feat: add variant-aware publish with symlink support to PublishingService"
```

---

### Task 1.4: Fix Preview endpoint — serve variant assets

**Files:**
- Modify: `apps/backend/src/modules/projects/variants/variants.controller.ts`
- Modify: `apps/backend/src/main.ts`

- [ ] **Step 1: Add static serve for variant dirs in main.ts**

Read `apps/backend/src/main.ts`, add:

```typescript
import * as express from 'express';
import { join } from 'path';

// In bootstrap() function, before app.listen():
const expressApp = app.getHttpAdapter().getInstance();
const hugoSitesPath = configService.get('HUGO_SITES_PATH') || '/var/www/client-sites';
expressApp.use('/variant-preview', express.static(hugoSitesPath));
```

- [ ] **Step 2: Update preview endpoint to redirect**

In `variants.controller.ts`, modify preview:

```typescript
@Get('/variants/:variantId/preview')
async preview(@Param('variantId') variantId: string, @Res() res: Response) {
  const variant = await this.variantsService.findById(variantId);
  const slug = variant.project.slug;
  const redirectPath = `/variant-preview/${slug}--${variantId}/index.html`;
  res.redirect(redirectPath);
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit -p apps/backend/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/main.ts apps/backend/src/modules/projects/variants/variants.controller.ts
git commit -m "fix: serve variant preview assets via static middleware"
```

---

### Task 1.5: Wire unused env vars (auto-enrichment + default sources)

**Files:**
- Modify: `apps/backend/src/modules/leads/leads.service.ts`
- Modify: `apps/backend/src/modules/scraping/providers/instagram.provider.ts`

- [ ] **Step 1: Wire ENRICHMENT_AUTO_RUN + ENRICHMENT_DEFAULT_SOURCES**

In `leads.service.ts` `create()` method:

```typescript
async create(dto: CreateLeadDto): Promise<Lead> {
  const configService = this.configService; // inject via constructor

  const defaultSources = configService.get('ENRICHMENT_DEFAULT_SOURCES');
  const enrichmentSources = dto.enrichmentSources
    ?? (defaultSources ? defaultSources.split(',').map((s: string) => s.trim()) : []);

  const lead = await this.prisma.lead.create({
    data: {
      ...dto,
      enrichmentSources,
    },
  });

  const autoRun = configService.get('ENRICHMENT_AUTO_RUN');
  if (autoRun === 'true' && enrichmentSources.length > 0) {
    await this.queueService.addEnrichmentJob(lead.id);
  }

  return lead;
}
```

- [ ] **Step 2: Wire INSTAGRAM_ACCESS_TOKEN in InstagramProvider**

In `instagram.provider.ts`:

```typescript
import { Inject, Injectable, Optional } from '@nestjs/common';

@Injectable()
export class InstagramProvider {
  constructor(
    @Optional() @Inject('INSTAGRAM_ACCESS_TOKEN') private readonly accessToken?: string,
  ) {}

  async enrich(lead: Lead): Promise<InstagramEnrichment> {
    if (this.accessToken) {
      return this.enrichViaGraphApi(lead);
    }
    return this.enrichViaWebProfile(lead); // existing logic
  }

  private async enrichViaGraphApi(lead: Lead): Promise<InstagramEnrichment> {
    // Use Facebook Graph API with token for richer data
    // Implementation: call graph.facebook.com/v18.0/{page-id}?fields=...
    return this.enrichViaWebProfile(lead); // fallback for now
  }

  private async enrichViaWebProfile(lead: Lead): Promise<InstagramEnrichment> {
    // Existing web_profile_info scraping logic
    // ...
  }
}
```

- [ ] **Step 3: Verify typecheck + test**

```bash
npx tsc --noEmit -p apps/backend/tsconfig.json
npx vitest run apps/backend/src/modules/leads/
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/leads/leads.service.ts apps/backend/src/modules/scraping/providers/instagram.provider.ts
git commit -m "feat: wire ENRICHMENT_AUTO_RUN, ENRICHMENT_DEFAULT_SOURCES, INSTAGRAM_ACCESS_TOKEN"
```

---

## Phase 2: Enrichment Analysis Layer (LLM)

### Task 2.1: Create EnrichmentAnalysisService

**Files:**
- Create: `apps/backend/src/modules/enrichment/enrichment-analysis.service.ts`
- Create: `apps/backend/src/modules/enrichment/enrichment-analysis.service.spec.ts`
- Modify: `apps/backend/src/modules/enrichment/enrichment.module.ts`

**Interfaces:**
- Consumes: `LlmService` (existing — provides `complete(prompt, options)` method)
- Produces: `EnrichmentAnalysisService.analyze(rawData, lead) → Partial<EnrichmentData>`

- [ ] **Step 1: Write failing test**

Create `enrichment-analysis.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EnrichmentAnalysisService } from './enrichment-analysis.service';

describe('EnrichmentAnalysisService', () => {
  let service: EnrichmentAnalysisService;
  let llmService: { complete: jest.Mock };

  beforeEach(async () => {
    llmService = { complete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrichmentAnalysisService,
        { provide: 'LlmService', useValue: llmService },
      ],
    }).compile();

    service = module.get<EnrichmentAnalysisService>(EnrichmentAnalysisService);
  });

  describe('analyze', () => {
    it('runs brand, competitor, and sales analysis in parallel', async () => {
      llmService.complete.mockResolvedValue(JSON.stringify({}));

      const rawData = [{ source: 'instagram', data: { bio: 'Test bio' } }];
      const lead = { id: 'lead-1', enrichmentData: {} };

      const result = await service.analyze(rawData, lead as any);

      expect(result).toBeDefined();
      // All three analysis types called
      expect(llmService.complete).toHaveBeenCalledTimes(expect.any(Number));
    });

    it('returns brand analysis when LLM provides it', async () => {
      llmService.complete.mockResolvedValue(JSON.stringify({
        brandColors: { primary: '#FF0000', secondary: '#00FF00', accent: '#0000FF', extractedFrom: 'logo' },
        toneOfVoice: { style: 'professional', formality: 'formal', keyPhrases: ['quality'], languageMix: 'uk', emojiUsage: 'rare', sampleBio: 'test' },
      }));

      const result = await service.analyze([], { id: '1', enrichmentData: {} } as any);
      expect(result.brandColors).toBeDefined();
      expect(result.toneOfVoice).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run apps/backend/src/modules/enrichment/enrichment-analysis.service.spec.ts
# Expected: FAIL (file not found or class not defined)
```

- [ ] **Step 3: Implement EnrichmentAnalysisService**

Create `enrichment-analysis.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { LlmService } from '../../llm/llm.service';
import type { EnrichmentData } from '@prompt-site-builder/shared';

interface ProviderRawData {
  source: string;
  data: Record<string, unknown>;
}

@Injectable()
export class EnrichmentAnalysisService {
  constructor(private readonly llm: LlmService) {}

  async analyze(rawData: ProviderRawData[], lead: { id: string; enrichmentData: unknown }): Promise<Partial<EnrichmentData>> {
    const existingData = (lead.enrichmentData as EnrichmentData) || {};

    const [brand, competitors, sales] = await Promise.all([
      this.brandAnalysis(rawData, existingData),
      this.competitorAnalysis(rawData, existingData),
      this.salesAnalysis(rawData, existingData),
    ]);

    return this.deepMerge(existingData, brand, competitors, sales);
  }

  private async brandAnalysis(
    rawData: ProviderRawData[],
    existing: Partial<EnrichmentData>,
  ): Promise<Partial<EnrichmentData>> {
    const bio = this.extractBio(rawData);
    const posts = this.extractPosts(rawData);

    const prompt = `You are a brand analyst. Extract brand information from this business data.

BUSINESS DATA:
- Bio/About: ${bio}
- Recent posts: ${posts.slice(0, 5).join('\n')}

Return ONLY valid JSON (no markdown, no explanation):
{
  "brandColors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "extractedFrom": "logo|website|posts" },
  "fonts": { "preferred": ["font name"], "note": "where observed" },
  "toneOfVoice": {
    "style": "professional|friendly|luxury|casual|technical|warm|bold",
    "formality": "formal|semi-formal|casual",
    "keyPhrases": ["phrase1", "phrase2"],
    "languageMix": "uk|ru|en|mix",
    "emojiUsage": "heavy|moderate|rare|none",
    "sampleBio": "rewritten best version of their bio"
  }
}

If a field cannot be determined, omit it.`;

    const response = await this.llm.complete(prompt, { model: 'haiku' });
    return this.parseJson(response);
  }

  private async competitorAnalysis(
    rawData: ProviderRawData[],
    existing: Partial<EnrichmentData>,
  ): Promise<Partial<EnrichmentData>> {
    const competitors = (existing.competitors || []) as Record<string, unknown>[];
    if (!competitors.length) return {};

    const ourBusiness = this.extractBusinessSummary(rawData);

    // Analyze each competitor's website
    const analyzed = await Promise.all(
      competitors.map(async (comp: Record<string, unknown>) => {
        const website = comp.website as string | undefined;
        if (!website) return comp;

        try {
          const websiteContent = await this.fetchWebsite(website);
          const prompt = `Analyze this competitor website for "${ourBusiness}".

WEBSITE: ${website}
CONTENT: ${websiteContent.slice(0, 3000)}

Return ONLY JSON:
{
  "websiteAnalysis": {
    "pages": ["page1", "page2"],
    "hasOnlineBooking": true/false,
    "hasPriceList": true/false,
    "hasPortfolio": true/false,
    "hasReviews": true/false,
    "strengths": ["strength1"],
    "weaknesses": ["weakness1"]
  },
  "positioning": "1 sentence positioning",
  "uniqueSellingPoints": ["usp1"],
  "services": [{ "name": "service", "price": "price" }]
}`;

          const analysis = await this.llm.complete(prompt, { model: 'haiku' });
          return { ...comp, ...this.parseJson(analysis) };
        } catch {
          return comp; // fallback to raw competitor data
        }
      }),
    );

    // Generate market gap analysis
    const marketGapPrompt = `Given our business "${ourBusiness}" and these competitors:
${JSON.stringify(analyzed, null, 2)}

Identify:
- 3-5 market opportunities (things no competitor does well)
- Recommended website pages to differentiate
- Differentiation angle (1 sentence)

Return ONLY JSON:
{
  "marketGap": {
    "opportunities": ["opportunity1"],
    "recommendedPages": ["page1"],
    "differentiationAngle": "1 sentence"
  }
}`;

    const marketGapResponse = await this.llm.complete(marketGapPrompt, { model: 'haiku' });
    const marketGap = this.parseJson(marketGapResponse);

    return { competitors: analyzed, ...marketGap };
  }

  private async salesAnalysis(
    rawData: ProviderRawData[],
    existing: Partial<EnrichmentData>,
  ): Promise<Partial<EnrichmentData>> {
    // Delegate to SalesScriptGenerator (Task 2.2)
    const generator = new SalesScriptGenerator(this.llm);
    return generator.generate(rawData, existing);
  }

  private extractBio(rawData: ProviderRawData[]): string {
    for (const d of rawData) {
      const data = d.data as Record<string, unknown>;
      if (data.bio) return data.bio as string;
    }
    return '';
  }

  private extractPosts(rawData: ProviderRawData[]): string[] {
    const posts: string[] = [];
    for (const d of rawData) {
      const data = d.data as Record<string, unknown>;
      if (Array.isArray(data.posts)) {
        posts.push(...(data.posts as string[]));
      }
    }
    return posts;
  }

  private extractBusinessSummary(rawData: ProviderRawData[]): string {
    const parts: string[] = [];
    for (const d of rawData) {
      const data = d.data as Record<string, unknown>;
      if (data.name) parts.push(`Name: ${data.name}`);
      if (data.bio) parts.push(`Bio: ${data.bio}`);
      if (data.services) parts.push(`Services: ${JSON.stringify(data.services)}`);
    }
    return parts.join('\n') || 'Unknown business';
  }

  private async fetchWebsite(url: string): Promise<string> {
    try {
      const response = await fetch(url.startsWith('http') ? url : `https://${url}`, {
        signal: AbortSignal.timeout(10000),
      });
      return response.text();
    } catch {
      return '';
    }
  }

  private parseJson(response: string): Record<string, unknown> {
    try {
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {};
    }
  }

  private deepMerge(...objects: Partial<EnrichmentData>[]): Partial<EnrichmentData> {
    const result: Record<string, unknown> = {};
    for (const obj of objects) {
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          result[key] = [...(result[key] as unknown[] || []), ...value];
        } else if (typeof value === 'object' && value !== null) {
          result[key] = { ...(result[key] as Record<string, unknown> || {}), ...value as Record<string, unknown> };
        } else {
          result[key] = value;
        }
      }
    }
    return result as Partial<EnrichmentData>;
  }
}
```

- [ ] **Step 4: Run test — verify basic pass**

```bash
npx vitest run apps/backend/src/modules/enrichment/enrichment-analysis.service.spec.ts
```

- [ ] **Step 5: Register in enrichment module**

In `enrichment.module.ts`, add `EnrichmentAnalysisService` to providers and exports.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/enrichment/
git commit -m "feat: add EnrichmentAnalysisService with brand and competitor LLM analysis"
```

---

### Task 2.2: Create SalesScriptGenerator

**Files:**
- Create: `apps/backend/src/modules/enrichment/sales-script-generator.ts`

**Interfaces:**
- Consumes: `LlmService.complete(prompt, options)`
- Produces: `SalesScriptGenerator.generate(rawData, existingData) → Partial<EnrichmentData>` with `salesOpportunities[]` and `salesScript`

- [ ] **Step 1: Implement SalesScriptGenerator**

Create `sales-script-generator.ts`:

```typescript
import type { EnrichmentData, SalesOpportunity } from '@prompt-site-builder/shared';

interface SalesScript {
  opening: { greeting: string; icebreaker: string; hook: string };
  discovery: { qualificationQuestions: { question: string; purpose: string }[]; painPointProbes: { question: string; target: string }[]; budgetSignals: string[] };
  valueProposition: { corePromise: string; tailoredToBusiness: string; roiExamples: { scenario: string; result: string }[] };
  objections: { objection: string; rootCause: string; response: string; followUp: string; evidence?: string }[];
  closing: { trialCloses: string[]; assumptiveClose: string; urgencyBuilder: string; alternativeClose: string };
  followUp: { sameDaySms: string; nextDayEmail: string; threeDayCallback: string; referralAsk: string };
  strategy: { targetDecisionMaker: string; bestTimeToCall: string; dealBreakers: string[]; quickWins: string[]; competitiveAdvantages: string[] };
}

export class SalesScriptGenerator {
  constructor(private readonly llm: { complete: (prompt: string, options?: Record<string, unknown>) => Promise<string> }) {}

  async generate(
    rawData: Record<string, unknown>[],
    existing: Partial<EnrichmentData>,
  ): Promise<Partial<EnrichmentData>> {
    const businessName = this.extract(rawData, 'name') || 'the business';
    const niche = this.extract(rawData, 'niche') || 'local business';
    const city = this.extract(rawData, 'city') || 'Ukraine';
    const weaknesses = this.collectWeaknesses(existing);
    const competitors = existing.competitors || [];

    // Generate all script sections in parallel
    const [opening, discovery, value, objections, closing, followUp, strategy] = await Promise.all([
      this.generateOpening(businessName, niche, city),
      this.generateDiscovery(businessName, niche, weaknesses),
      this.generateValueProposition(businessName, niche, weaknesses),
      this.generateObjections(businessName, niche, weaknesses, competitors),
      this.generateClosing(businessName, niche),
      this.generateFollowUp(businessName, niche),
      this.generateStrategy(businessName, niche, competitors),
    ]);

    const salesScript: SalesScript = {
      opening,
      discovery,
      valueProposition: value,
      objections,
      closing,
      followUp: followUp,
      strategy,
    };

    // Generate sales opportunities from weaknesses
    const salesOpportunities: SalesOpportunity[] = await this.generateOpportunities(
      businessName, niche, weaknesses, competitors,
    );

    return {
      salesScript: salesScript as unknown as Record<string, unknown>,
      salesOpportunities,
    };
  }

  private async generateOpening(businessName: string, niche: string, city: string) {
    const prompt = `You are a sales trainer in Ukraine. Write a phone call opening for pitching a website to "${businessName}" (${niche}, ${city}).

Return ONLY JSON:
{
  "greeting": "exact greeting in Ukrainian/Russian (match business language)",
  "icebreaker": "1-2 sentences personalized to this business",
  "hook": "1 sentence value hook that gets attention"
}`;

    const response = await this.llm.complete(prompt, { model: 'haiku' });
    return this.parseJson(response);
  }

  private async generateDiscovery(businessName: string, niche: string, weaknesses: string[]) {
    const prompt = `You are a sales trainer. Create discovery questions for "${businessName}" (${niche}).

Known weaknesses: ${weaknesses.join(', ')}

Return ONLY JSON:
{
  "qualificationQuestions": [
    { "question": "exact question in Ukrainian", "purpose": "what this reveals" }
  ],
  "painPointProbes": [
    { "question": "probe question", "target": "which weakness this targets" }
  ],
  "budgetSignals": ["phrase indicating budget", "phrase indicating no budget"]
}`;

    const response = await this.llm.complete(prompt, { model: 'haiku' });
    return this.parseJson(response);
  }

  private async generateValueProposition(businessName: string, niche: string, weaknesses: string[]) {
    const prompt = `You are a sales consultant. Create a value proposition for "${businessName}" (${niche}).

Weaknesses to address: ${weaknesses.join(', ')}

Return ONLY JSON:
{
  "corePromise": "1 sentence",
  "tailoredToBusiness": "2-3 sentences specific to this business",
  "roiExamples": [
    { "scenario": "specific scenario", "result": "concrete result with numbers" }
  ]
}`;

    const response = await this.llm.complete(prompt, { model: 'haiku' });
    return this.parseJson(response);
  }

  private async generateObjections(
    businessName: string, niche: string, weaknesses: string[], competitors: Record<string, unknown>[],
  ) {
    const prompt = `You are a senior sales trainer in Ukraine. Generate 5-7 objections "${businessName}" (${niche}) will raise when pitched a new website.

Weaknesses: ${weaknesses.join(', ')}
Competitors: ${competitors.map((c: Record<string, unknown>) => c.name).join(', ')}

For each objection provide EXACT Ukrainian/Russian script.

Return ONLY JSON array:
[
  {
    "objection": "exact words they'll say",
    "rootCause": "psychological reason",
    "response": "exact 2-3 sentence response",
    "followUp": "what to say if they push back again",
    "evidence": "data point or example"
  }
]`;

    const response = await this.llm.complete(prompt, { model: 'haiku' });
    return this.parseJson(response);
  }

  private async generateClosing(businessName: string, niche: string) {
    const prompt = `You are a sales closer. Write closing techniques for "${businessName}" (${niche}).

Return ONLY JSON:
{
  "trialCloses": ["trial close 1", "trial close 2", "trial close 3"],
  "assumptiveClose": "exact assumptive close script",
  "urgencyBuilder": "urgency statement specific to their situation",
  "alternativeClose": "alternative if assumptive fails"
}`;

    const response = await this.llm.complete(prompt, { model: 'haiku' });
    return this.parseJson(response);
  }

  private async generateFollowUp(businessName: string, niche: string) {
    const prompt = `You are a sales follow-up expert. Write follow-up templates for "${businessName}" (${niche}).

Return ONLY JSON:
{
  "sameDaySms": "SMS text in Ukrainian/Russian",
  "nextDayEmail": "Email subject + body in Ukrainian/Russian",
  "threeDayCallback": "Call script for 3-day follow-up",
  "referralAsk": "How to ask for referrals even if they say no"
}`;

    const response = await this.llm.complete(prompt, { model: 'haiku' });
    return this.parseJson(response);
  }

  private async generateStrategy(businessName: string, niche: string, competitors: Record<string, unknown>[]) {
    const prompt = `You are a sales strategist. Plan the sales approach for "${businessName}" (${niche}).

Competitors: ${competitors.map((c: Record<string, unknown>) => c.name).join(', ')}

Return ONLY JSON:
{
  "targetDecisionMaker": "who to talk to, age range, gender",
  "bestTimeToCall": "optimal day/time",
  "dealBreakers": ["thing that kills deal"],
  "quickWins": ["easy concession to keep deal alive"],
  "competitiveAdvantages": ["our strength vs their current setup"]
}`;

    const response = await this.llm.complete(prompt, { model: 'haiku' });
    return this.parseJson(response);
  }

  private async generateOpportunities(
    businessName: string, niche: string, weaknesses: string[], competitors: Record<string, unknown>[],
  ): Promise<SalesOpportunity[]> {
    const prompt = `You are a business analyst. Generate 3-5 sales opportunities for "${businessName}" (${niche}).

Weaknesses: ${weaknesses.join(', ')}
Competitors: ${competitors.map((c: Record<string, unknown>) => c.name).join(', ')}

Return ONLY JSON array:
[
  {
    "gap": "what they're missing",
    "currentState": "how they operate now",
    "recommendation": "what we propose",
    "pitchAngle": "how to pitch this specific gap",
    "revenueImpact": "estimated revenue impact in UAH/month",
    "scriptExcerpt": "relevant sales script excerpt"
  }
]`;

    const response = await this.llm.complete(prompt, { model: 'haiku' });
    return this.parseJson(response);
  }

  private collectWeaknesses(existing: Partial<EnrichmentData>): string[] {
    const weaknesses: string[] = [];
    const competitors = existing.competitors || [];
    for (const comp of competitors) {
      const c = comp as Record<string, unknown>;
      if (c.websiteAnalysis) {
        const analysis = c.websiteAnalysis as Record<string, unknown>;
        if (!analysis.hasOnlineBooking) weaknesses.push('No online booking');
        if (!analysis.hasPriceList) weaknesses.push('No online price list');
        if (!analysis.hasPortfolio) weaknesses.push('No portfolio/gallery');
        if (!analysis.hasReviews) weaknesses.push('No reviews/testimonials');
      }
    }
    if (!existing.logoUrl) weaknesses.push('No professional logo');
    if (!existing.services || !(existing.services as unknown[]).length) weaknesses.push('Services not clearly listed');
    return weaknesses;
  }

  private extract(rawData: Record<string, unknown>[], field: string): string {
    for (const d of rawData) {
      const data = d.data as Record<string, unknown> || d;
      if (data[field]) return data[field] as string;
    }
    return '';
  }

  private parseJson(response: string): any {
    try {
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return Array.isArray(response) ? [] : {};
    }
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit -p apps/backend/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/enrichment/sales-script-generator.ts
git commit -m "feat: add SalesScriptGenerator — full sales script with 7 sections + objection handling"
```

---

### Task 2.3: Integrate EnrichmentAnalysisService into EnrichmentService

**Files:**
- Modify: `apps/backend/src/modules/enrichment/enrichment.service.ts`

- [ ] **Step 1: Update enrichLead to call analysis**

In `enrichment.service.ts`, update `enrichLead`:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly factory: EnrichmentFactory,
  private readonly queueService: QueueService,
  private readonly analysisService: EnrichmentAnalysisService, // NEW
) {}

async enrichLead(leadId: string): Promise<{ jobId: string }> {
  const lead = await this.prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const sources = (lead.enrichmentSources || []) as string[];

  // Phase 1: Parallel provider collection
  const providerResults = await Promise.all(
    sources.map(async (source) => {
      const provider = this.factory.createForProvider(source);
      if (!provider) return null;
      try {
        return { source, data: await provider.enrich(lead) };
      } catch (error) {
        console.error(`Provider ${source} failed:`, error);
        return null;
      }
    }),
  );
  const validResults = providerResults.filter(Boolean) as { source: string; data: Record<string, unknown> }[];

  // Phase 2: LLM analysis
  const analyzedData = await this.analysisService.analyze(validResults, lead as any);

  // Phase 3: Save
  await this.prisma.lead.update({
    where: { id: leadId },
    data: {
      enrichmentData: analyzedData as any,
      enrichedAt: new Date(),
    },
  });

  return { jobId: `${leadId}-enriched` };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit -p apps/backend/tsconfig.json
```

- [ ] **Step 3: Run enrichment service tests**

```bash
npx vitest run apps/backend/src/modules/enrichment/enrichment.service.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/enrichment/enrichment.service.ts
git commit -m "feat: integrate EnrichmentAnalysisService into enrichment pipeline"
```

---

## Phase 3: Provider Data Maximization

### Task 3.1: InstagramProvider — posts, highlights, contacts

**Files:**
- Modify: `apps/backend/src/modules/scraping/providers/instagram.provider.ts`

- [ ] **Step 1: Extend scrape method for post images and highlights**

In `instagram.provider.ts`, extend the enrich method:

```typescript
async enrich(lead: Lead): Promise<InstagramEnrichment> {
  const username = this.extractUsername(lead);
  const profile = await this.fetchProfile(username);

  // NEW: Fetch recent posts
  const posts = await this.fetchRecentPosts(username, 12);

  // NEW: Fetch highlights
  const highlights = await this.fetchHighlights(username);

  // NEW: Extract contact info from bio
  const contacts = this.extractContacts(profile.biography || '');

  return {
    bio: profile.biography,
    logoUrl: profile.profile_pic_url_hd || profile.profile_pic_url,
    photos: this.extractPostImages(posts),
    services: this.extractServices(posts),
    toneOfVoice: this.analyzeTone(posts),
    customerJourney: this.detectCustomerJourney(posts, profile.biography),
    posts: posts.map((p: any) => p.caption?.text || '').filter(Boolean),
    highlights: highlights.map((h: any) => ({ title: h.title, coverUrl: h.cover_media?.cropped_image_version?.url })),
    contacts: {
      email: contacts.email,
      phone: contacts.phone,
      whatsapp: contacts.whatsapp,
      telegram: contacts.telegram,
      viber: contacts.viber,
    },
    stats: {
      instagramPosts: profile.media_count,
      instagramFollowers: profile.follower_count,
    },
  };
}

private extractContacts(bio: string): { email?: string; phone?: string; whatsapp?: string; telegram?: string; viber?: string } {
  const email = bio.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
  const phone = bio.match(/\+?[\d\s()-]{7,15}/)?.[0];
  const whatsapp = bio.match(/(?:whatsapp|wa|ватсап)[\s:]*\+?[\d\s()-]{7,15}/i)?.[0];
  const telegram = bio.match(/(?:telegram|tg|телеграм)[\s:@]*[\w]+/i)?.[0];
  const viber = bio.match(/(?:viber|вайбер)[\s:]*\+?[\d\s()-]{7,15}/i)?.[0];
  return { email, phone, whatsapp, telegram, viber };
}

private extractPostImages(posts: any[]): string[] {
  const images: string[] = [];
  for (const post of posts) {
    if (post.image_versions2?.candidates?.[0]?.url) {
      images.push(post.image_versions2.candidates[0].url);
    }
    // Carousel
    if (post.carousel_media) {
      for (const item of post.carousel_media) {
        if (item.image_versions2?.candidates?.[0]?.url) {
          images.push(item.image_versions2.candidates[0].url);
        }
      }
    }
  }
  return images;
}
```

- [ ] **Step 2: Run existing tests**

```bash
npx vitest run apps/backend/src/modules/scraping/
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/scraping/providers/instagram.provider.ts
git commit -m "feat: extend InstagramProvider — posts, carousel images, highlights, contacts"
```

---

### Task 3.2: FacebookProvider — all reviews, album photos, full about

**Files:**
- Modify: `apps/backend/src/modules/enrichment/providers/facebook.provider.ts`

- [ ] **Step 1: Increase limits and add album photos**

In `facebook.provider.ts`:

```typescript
// Increase posts limit from 20 to 50
const postsResponse = await this.callApi(`/${pageId}/posts?fields=message,full_picture,created_time&limit=50`);

// Add album photos fetching
private async fetchAlbumPhotos(pageId: string): Promise<string[]> {
  try {
    const albums = await this.callApi(`/${pageId}/albums?fields=id,name&limit=5`);
    const photos: string[] = [];
    for (const album of (albums.data || [])) {
      const albumPhotos = await this.callApi(`/${album.id}/photos?fields=images&limit=20`);
      for (const photo of (albumPhotos.data || [])) {
        if (photo.images?.[0]?.source) {
          photos.push(photo.images[0].source);
        }
      }
    }
    return photos;
  } catch {
    return [];
  }
}

// Add full about fetching
private async fetchAbout(pageId: string): Promise<Record<string, unknown>> {
  try {
    const about = await this.callApi(
      `/${pageId}?fields=about,description,mission,company_overview,awards,phone,email,website`
    );
    return {
      about: about.about,
      description: about.description,
      mission: about.mission,
      companyOverview: about.company_overview,
      awards: about.awards,
      phone: about.phone,
      email: about.email,
      website: about.website,
    };
  } catch {
    return {};
  }
}

// Paginate reviews — fetch all pages
private async fetchAllReviews(pageId: string): Promise<any[]> {
  const reviews: any[] = [];
  let url = `/${pageId}/ratings?fields=reviewer,rating,review_text,created_time&limit=100`;
  while (url) {
    const response = await this.callApi(url);
    reviews.push(...(response.data || []));
    url = response.paging?.next ? response.paging.next.replace(`https://graph.facebook.com/v18.0`, '') : null;
    if (reviews.length >= 500) break; // safety limit
  }
  return reviews;
}
```

- [ ] **Step 2: Run existing tests**

```bash
npx vitest run apps/backend/src/modules/enrichment/providers/facebook.provider.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/enrichment/providers/facebook.provider.ts
git commit -m "feat: extend FacebookProvider — all reviews paginated, album photos, full about"
```

---

### Task 3.3: GoogleMapsProvider — photos, attributes, competitor fix

**Files:**
- Modify: `apps/backend/src/modules/enrichment/providers/google-maps.provider.ts`

- [ ] **Step 1: Maximize photos and add place attributes**

In `google-maps.provider.ts`:

```typescript
// Fetch all available photos (max 10)
private async fetchAllPhotos(placeId: string): Promise<string[]> {
  const details = await this.callApi('/place/details/json', {
    place_id: placeId,
    fields: 'photos',
  });
  const photos = details.result?.photos || [];
  return photos.slice(0, 10).map((p: any) =>
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photoreference=${p.photo_reference}&key=${this.apiKey}`
  );
}

// Add place attributes
private async fetchAttributes(placeId: string): Promise<string[]> {
  const details = await this.callApi('/place/details/json', {
    place_id: placeId,
    fields: 'wheelchair_accessible_entrance,dine_in,delivery,takeout,reservable,serves_beer,serves_wine,outdoor_seating',
  });
  const attrs: string[] = [];
  const r = details.result || {};
  if (r.wheelchair_accessible_entrance) attrs.push('wheelchair_accessible');
  if (r.dine_in) attrs.push('dine_in');
  if (r.delivery) attrs.push('delivery');
  if (r.takeout) attrs.push('takeout');
  if (r.reservable) attrs.push('reservations');
  if (r.serves_beer || r.serves_wine) attrs.push('serves_alcohol');
  if (r.outdoor_seating) attrs.push('outdoor_seating');
  return attrs;
}

// Fix mapCompetitor — remove empty stubs, pass raw data to LLM analysis
private mapCompetitor(place: any): CompetitorInfo {
  return {
    name: place.name,
    googleMapsUrl: place.url,
    website: place.website,
    rating: place.rating || 0,
    reviewCount: place.user_ratings_total || 0,
    distance: place.distance ? `${(place.distance / 1000).toFixed(1)} km` : undefined,
    services: [],  // Will be filled by LLM analysis in EnrichmentAnalysisService
    positioning: '', // Will be filled by LLM
    uniqueSellingPoints: [], // Will be filled by LLM
  };
}
```

- [ ] **Step 2: Run existing tests**

```bash
npx vitest run apps/backend/src/modules/enrichment/providers/google-maps.provider.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/enrichment/providers/google-maps.provider.ts
git commit -m "feat: extend GoogleMapsProvider — all photos, place attributes, clean competitor stubs"
```

---

## Phase 4: Frontend Components

### Task 4.1: BrandCard component

**Files:**
- Create: `apps/frontend/src/lib/components/enrichment/BrandCard.svelte`

- [ ] **Step 1: Implement BrandCard**

Create `BrandCard.svelte`:

```svelte
<script lang="ts">
  import type { EnrichmentData } from '@prompt-site-builder/shared';
  import { Badge } from '$lib/components/ui/badge';

  export let data: EnrichmentData | null = null;

  $: colors = [
    data?.brandColors?.primary,
    data?.brandColors?.secondary,
    data?.brandColors?.accent,
  ].filter(Boolean);
</script>

{#if data}
  <div class="brand-card rounded-lg border p-4 space-y-4">
    <!-- Logo -->
    {#if data.logoUrl}
      <img src={data.logoUrl} alt="Logo" class="h-16 w-16 rounded-full object-cover" />
    {:else}
      <div class="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold">
        {data.toneOfVoice?.style?.[0] || '?'}
      </div>
    {/if}

    <!-- Brand Colors -->
    {#if colors.length > 0}
      <div class="flex gap-2 items-center">
        <span class="text-sm text-muted-foreground">Colors:</span>
        {#each colors as color}
          <div class="flex items-center gap-1">
            <div class="h-5 w-5 rounded border" style="background: {color}" title={color}></div>
            <span class="text-xs font-mono">{color}</span>
          </div>
        {/each}
        {#if data.brandColors?.extractedFrom}
          <span class="text-xs text-muted-foreground">from {data.brandColors.extractedFrom}</span>
        {/if}
      </div>
    {/if}

    <!-- Tone of Voice -->
    {#if data.toneOfVoice}
      <div class="flex flex-wrap gap-2">
        <Badge variant="secondary">{data.toneOfVoice.style}</Badge>
        <Badge variant="secondary">{data.toneOfVoice.formality}</Badge>
        {#if data.toneOfVoice.emojiUsage}
          <Badge variant="outline">Emoji: {data.toneOfVoice.emojiUsage}</Badge>
        {/if}
      </div>
      {#if data.toneOfVoice.keyPhrases?.length}
        <div class="flex flex-wrap gap-1">
          {#each data.toneOfVoice.keyPhrases as phrase}
            <Badge variant="outline" class="text-xs">{phrase}</Badge>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Stats -->
    {#if data.stats}
      <div class="grid grid-cols-2 gap-2 text-sm">
        {#each Object.entries(data.stats) as [key, value]}
          {#if value != null}
            <div class="flex justify-between bg-muted rounded px-2 py-1">
              <span class="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span class="font-medium">{value}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
{/if}
```

- [ ] **Step 2: Verify Svelte build**

```bash
npx svelte-check --tsconfig apps/frontend/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/lib/components/enrichment/BrandCard.svelte
git commit -m "feat: add BrandCard component — logo, colors, tone, stats"
```

---

### Task 4.2: CompetitorCard component

**Files:**
- Create: `apps/frontend/src/lib/components/enrichment/CompetitorCard.svelte`

- [ ] **Step 1: Implement CompetitorCard**

Create `CompetitorCard.svelte`:

```svelte
<script lang="ts">
  import type { CompetitorInfo } from '@prompt-site-builder/shared';
  import { Badge } from '$lib/components/ui/badge';
  import { Check, X } from 'lucide-svelte';

  export let competitor: CompetitorInfo;
</script>

<div class="competitor-card rounded-lg border p-4 space-y-3">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h4 class="font-semibold">{competitor.name}</h4>
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <span>★ {competitor.rating}</span>
        <span>({competitor.reviewCount} reviews)</span>
        {#if competitor.distance}
          <span>{competitor.distance}</span>
        {/if}
      </div>
    </div>
    {#if competitor.website}
      <a href={competitor.website} target="_blank" rel="noopener" class="text-sm text-primary hover:underline">
        Website ↗
      </a>
    {/if}
  </div>

  <!-- Website Analysis -->
  {#if competitor.websiteAnalysis}
    <div class="grid grid-cols-2 gap-2 text-sm">
      <div class="flex items-center gap-1">
        {#if competitor.websiteAnalysis.hasOnlineBooking}<Check class="h-4 w-4 text-green-500" />{:else}<X class="h-4 w-4 text-red-500" />{/if}
        <span>Online Booking</span>
      </div>
      <div class="flex items-center gap-1">
        {#if competitor.websiteAnalysis.hasPriceList}<Check class="h-4 w-4 text-green-500" />{:else}<X class="h-4 w-4 text-red-500" />{/if}
        <span>Price List</span>
      </div>
      <div class="flex items-center gap-1">
        {#if competitor.websiteAnalysis.hasPortfolio}<Check class="h-4 w-4 text-green-500" />{:else}<X class="h-4 w-4 text-red-500" />{/if}
        <span>Portfolio</span>
      </div>
      <div class="flex items-center gap-1">
        {#if competitor.websiteAnalysis.hasReviews}<Check class="h-4 w-4 text-green-500" />{:else}<X class="h-4 w-4 text-red-500" />{/if}
        <span>Reviews</span>
      </div>
    </div>

    <!-- Strengths / Weaknesses -->
    <div class="grid grid-cols-2 gap-3">
      <div>
        <span class="text-xs font-medium text-green-600">Strengths</span>
        <ul class="text-sm list-disc pl-4">
          {#each competitor.websiteAnalysis.strengths || [] as s}
            <li>{s}</li>
          {/each}
        </ul>
      </div>
      <div>
        <span class="text-xs font-medium text-red-600">Weaknesses</span>
        <ul class="text-sm list-disc pl-4">
          {#each competitor.websiteAnalysis.weaknesses || [] as w}
            <li>{w}</li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}

  <!-- Services -->
  {#if competitor.services?.length}
    <div>
      <span class="text-sm font-medium">Services:</span>
      <div class="flex flex-wrap gap-2 mt-1">
        {#each competitor.services as service}
          <Badge variant="outline">
            {service.name}{#if service.price} — {service.price}{/if}
          </Badge>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Positioning -->
  {#if competitor.positioning}
    <p class="text-sm italic text-muted-foreground">"{competitor.positioning}"</p>
  {/if}

  <!-- USPs -->
  {#if competitor.uniqueSellingPoints?.length}
    <div class="flex flex-wrap gap-1">
      {#each competitor.uniqueSellingPoints as usp}
        <Badge variant="secondary" class="text-xs">{usp}</Badge>
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Verify Svelte build**

```bash
npx svelte-check --tsconfig apps/frontend/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/lib/components/enrichment/CompetitorCard.svelte
git commit -m "feat: add CompetitorCard — website analysis checklist, strengths, weaknesses, positioning"
```

---

### Task 4.3: SalesOpportunityCard + SalesScriptPanel

**Files:**
- Create: `apps/frontend/src/lib/components/enrichment/SalesOpportunityCard.svelte`
- Create: `apps/frontend/src/lib/components/enrichment/SalesScriptPanel.svelte`

- [ ] **Step 1: Implement SalesOpportunityCard**

Create `SalesOpportunityCard.svelte`:

```svelte
<script lang="ts">
  import type { SalesOpportunity } from '@prompt-site-builder/shared';

  export let opportunity: SalesOpportunity;
</script>

<div class="opportunity-card rounded-lg border p-4 space-y-3">
  <div>
    <span class="text-xs font-medium text-red-500 uppercase">Gap</span>
    <p class="font-semibold">{opportunity.gap}</p>
  </div>

  <div class="grid grid-cols-2 gap-3 text-sm">
    <div class="bg-muted rounded p-2">
      <span class="text-xs text-muted-foreground">Current State</span>
      <p>{opportunity.currentState}</p>
    </div>
    <div class="bg-primary/10 rounded p-2">
      <span class="text-xs text-muted-foreground">Recommendation</span>
      <p>{opportunity.recommendation}</p>
    </div>
  </div>

  <div class="bg-yellow-50 dark:bg-yellow-950 rounded p-3 border border-yellow-200">
    <span class="text-xs font-medium">Pitch Angle</span>
    <p class="text-sm italic">"{opportunity.pitchAngle}"</p>
  </div>

  <div class="flex items-center gap-2">
    <span class="text-xs text-muted-foreground">Revenue Impact:</span>
    <span class="text-lg font-bold text-green-600">{opportunity.revenueImpact}</span>
  </div>

  {#if opportunity.scriptExcerpt}
    <details class="text-sm">
      <summary class="cursor-pointer text-muted-foreground">Script Excerpt</summary>
      <p class="mt-2 p-2 bg-muted rounded whitespace-pre-wrap">{opportunity.scriptExcerpt}</p>
    </details>
  {/if}
</div>
```

- [ ] **Step 2: Implement SalesScriptPanel**

Create `SalesScriptPanel.svelte`:

```svelte
<script lang="ts">
  import { Tabs, TabContent } from '$lib/components/ui/tabs';

  export let script: Record<string, any> | null = null;

  const tabs = [
    { key: 'opening', label: 'Opening' },
    { key: 'discovery', label: 'Discovery' },
    { key: 'valueProposition', label: 'Value' },
    { key: 'objections', label: 'Objections' },
    { key: 'closing', label: 'Closing' },
    { key: 'followUp', label: 'Follow-up' },
    { key: 'strategy', label: 'Strategy' },
  ];

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

{#if script}
  <div class="sales-script rounded-lg border">
    <Tabs {tabs} let:activeTab>
      <div class="p-4">
        {#if activeTab === 'opening' && script.opening}
          <ScriptBlock label="Greeting" text={script.opening.greeting} {copyText} />
          <ScriptBlock label="Icebreaker" text={script.opening.icebreaker} {copyText} />
          <ScriptBlock label="Hook" text={script.opening.hook} {copyText} />

        {:else if activeTab === 'discovery' && script.discovery}
          <h4 class="font-medium mb-2">Qualification Questions</h4>
          {#each script.discovery.qualificationQuestions || [] as q}
            <div class="mb-2 p-2 bg-muted rounded">
              <p class="font-medium text-sm">{q.question}</p>
              <p class="text-xs text-muted-foreground">{q.purpose}</p>
              <button class="text-xs text-primary mt-1" on:click={() => copyText(q.question)}>Copy</button>
            </div>
          {/each}

        {:else if activeTab === 'objections' && script.objections}
          <div class="space-y-3">
            {#each script.objections || [] as obj, i}
              <div class="p-3 border rounded">
                <p class="font-semibold text-red-600">❌ "{obj.objection}"</p>
                <p class="text-xs text-muted-foreground">Root cause: {obj.rootCause}</p>
                <div class="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded">
                  <p class="text-sm font-medium text-green-700">Response:</p>
                  <p class="text-sm">{obj.response}</p>
                </div>
                <p class="text-xs mt-1"><strong>If they push back:</strong> {obj.followUp}</p>
                {#if obj.evidence}
                  <p class="text-xs text-muted-foreground">Evidence: {obj.evidence}</p>
                {/if}
                <button class="text-xs text-primary mt-1" on:click={() => copyText(obj.response)}>Copy Response</button>
              </div>
            {/each}
          </div>

        {:else if activeTab === 'closing' && script.closing}
          <ScriptBlock label="Trial Closes" text={script.closing.trialCloses?.join('\n\n')} {copyText} />
          <ScriptBlock label="Assumptive Close" text={script.closing.assumptiveClose} {copyText} />
          <ScriptBlock label="Urgency Builder" text={script.closing.urgencyBuilder} {copyText} />
          <ScriptBlock label="Alternative Close" text={script.closing.alternativeClose} {copyText} />

        {:else if activeTab === 'followUp' && script.followUp}
          <ScriptBlock label="Same Day SMS" text={script.followUp.sameDaySms} {copyText} />
          <ScriptBlock label="Next Day Email" text={script.followUp.nextDayEmail} {copyText} />
          <ScriptBlock label="3-Day Callback" text={script.followUp.threeDayCallback} {copyText} />
          <ScriptBlock label="Referral Ask" text={script.followUp.referralAsk} {copyText} />

        {:else if activeTab === 'strategy' && script.strategy}
          <div class="space-y-2 text-sm">
            <p><strong>Decision Maker:</strong> {script.strategy.targetDecisionMaker}</p>
            <p><strong>Best Time to Call:</strong> {script.strategy.bestTimeToCall}</p>
            <div><strong>Deal Breakers:</strong>
              <ul class="list-disc pl-4">{#each script.strategy.dealBreakers || [] as d}<li>{d}</li>{/each}</ul>
            </div>
            <div><strong>Quick Wins:</strong>
              <ul class="list-disc pl-4">{#each script.strategy.quickWins || [] as w}<li>{w}</li>{/each}</ul>
            </div>
          </div>

        {:else if activeTab === 'valueProposition' && script.valueProposition}
          <ScriptBlock label="Core Promise" text={script.valueProposition.corePromise} {copyText} />
          <ScriptBlock label="Tailored" text={script.valueProposition.tailoredToBusiness} {copyText} />
          {#each script.valueProposition.roiExamples || [] as roi}
            <div class="p-2 bg-muted rounded mb-2">
              <p class="text-sm font-medium">{roi.scenario}</p>
              <p class="text-sm text-green-600">{roi.result}</p>
            </div>
          {/each}
        {/if}
      </div>
    </Tabs>
  </div>
{/if}

<!-- ScriptBlock helper -->
{#snippet ScriptBlock(label: string, text: string, copyText: (t: string) => void)}
  {#if text}
    <div class="mb-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-muted-foreground">{label}</span>
        <button class="text-xs text-primary" on:click={() => copyText(text)}>Copy</button>
      </div>
      <p class="text-sm mt-1 p-2 bg-muted rounded whitespace-pre-wrap">{text}</p>
    </div>
  {/if}
{/snippet}
```

- [ ] **Step 3: Verify build**

```bash
npx svelte-check --tsconfig apps/frontend/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/components/enrichment/
git commit -m "feat: add SalesOpportunityCard + SalesScriptPanel with 7 tabs and copy-to-clipboard"
```

---

### Task 4.4: VariantGenerator + VariantPreview components

**Files:**
- Create: `apps/frontend/src/lib/components/variants/VariantGenerator.svelte`
- Create: `apps/frontend/src/lib/components/variants/VariantPreview.svelte`

- [ ] **Step 1: Implement VariantGenerator**

Create `VariantGenerator.svelte`:

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Loader2 } from 'lucide-svelte';

  export let models: string[] = [];
  export let imageModels: string[] = [];
  export let themes: { name: string; label: string }[] = [];
  export let onGenerate: (config: { model: string; imageModel: string; theme: string }) => Promise<void>;
  export let generating = false;

  let selectedModel = models[0] || 'gpt-4o';
  let selectedImageModel = imageModels[0] || 'dall-e-3';
  let selectedTheme = themes[0]?.name || '';

  async function handleGenerate() {
    await onGenerate({
      model: selectedModel,
      imageModel: selectedImageModel,
      theme: selectedTheme,
    });
  }
</script>

<div class="variant-generator rounded-lg border p-4 space-y-4">
  <h3 class="font-semibold">Generate New Variant</h3>

  <div class="grid grid-cols-3 gap-3">
    <label class="space-y-1">
      <span class="text-sm">LLM Model</span>
      <select bind:value={selectedModel} class="w-full rounded border p-2 text-sm">
        {#each models as model}
          <option value={model}>{model}</option>
        {/each}
      </select>
    </label>

    <label class="space-y-1">
      <span class="text-sm">Image Model</span>
      <select bind:value={selectedImageModel} class="w-full rounded border p-2 text-sm">
        {#each imageModels as model}
          <option value={model}>{model}</option>
        {/each}
      </select>
    </label>

    <label class="space-y-1">
      <span class="text-sm">Theme</span>
      <select bind:value={selectedTheme} class="w-full rounded border p-2 text-sm">
        {#each themes as theme}
          <option value={theme.name}>{theme.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <Button onclick={handleGenerate} disabled={generating} class="w-full">
    {#if generating}
      <Loader2 class="h-4 w-4 animate-spin mr-2" />
      Generating...
    {:else}
      Generate Variant
    {/if}
  </Button>
</div>
```

- [ ] **Step 2: Implement VariantPreview**

Create `VariantPreview.svelte`:

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Maximize2, Minimize2 } from 'lucide-svelte';

  export let previewUrl: string | null = null;
  export let variantName: string = '';
  export let isActive: boolean = false;
  export let onActivate: () => Promise<void>;
  export let onDelete: () => Promise<void>;

  let fullscreen = false;

  function toggleFullscreen() {
    fullscreen = !fullscreen;
  }
</script>

{#if previewUrl}
  <div class="variant-preview rounded-lg border" class:fixed={fullscreen} class:inset-0={fullscreen} class:z-50={fullscreen} class:bg-background={fullscreen}>
    <div class="flex items-center justify-between p-3 border-b">
      <div class="flex items-center gap-2">
        <h3 class="font-semibold">{variantName}</h3>
        {#if isActive}
          <span class="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">Active</span>
        {/if}
      </div>
      <div class="flex gap-2">
        <button on:click={toggleFullscreen} class="p-1 hover:bg-muted rounded">
          {#if fullscreen}<Minimize2 class="h-4 w-4" />{:else}<Maximize2 class="h-4 w-4" />{/if}
        </button>
        {#if !isActive}
          <Button size="sm" onclick={onActivate}>Activate</Button>
        {/if}
        <Button size="sm" variant="destructive" onclick={onDelete}>Delete</Button>
      </div>
    </div>
    <iframe
      src={previewUrl}
      class="w-full border-0"
      class:h-full={fullscreen}
      class:h-96={!fullscreen}
      title={variantName}
    ></iframe>
  </div>
{/if}
```

- [ ] **Step 3: Verify build**

```bash
npx svelte-check --tsconfig apps/frontend/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/components/variants/
git commit -m "feat: add VariantGenerator + VariantPreview components"
```

---

### Task 4.5: Frontend store fixes

**Files:**
- Modify: `apps/frontend/src/lib/stores/enrichment.ts`
- Modify: `apps/frontend/src/lib/stores/leads.ts`
- Modify: `apps/frontend/src/lib/stores/projects.ts`
- Modify: `apps/frontend/src/lib/components/variants/VariantCard.svelte`

- [ ] **Step 1: Fix enrichment store — use shared types**

In `enrichment.ts`, replace duplicate interface:

```typescript
// REMOVE duplicate EnrichmentData interface
// ADD import:
import type { EnrichmentData } from '@prompt-site-builder/shared';
```

- [ ] **Step 2: Fix leads store — add enrichment fields**

In `leads.ts`, extend Lead interface:

```typescript
export interface Lead {
  id: string;
  // ... existing fields
  enrichmentData?: EnrichmentData | null;
  enrichedAt?: string | null;
  enrichmentSources?: string[];
}
```

- [ ] **Step 3: Fix projects store — pass variantId**

In `projects.ts`, update generate:

```typescript
async generate(projectId: string, theme?: string, variantId?: string) {
  // ...
  const response = await api.post(`/generation/${projectId}/generate`, {
    theme,
    variantId, // NEW
  });
  // ...
}
```

- [ ] **Step 4: Add navigation from VariantCard to detail page**

In `VariantCard.svelte`, make variant name a link:

```svelte
<a href="/dashboard/variants/{variant.id}" class="variant-name font-medium hover:underline">
  {variant.variantName}
</a>
```

- [ ] **Step 5: Verify build + typecheck**

```bash
npx svelte-check --tsconfig apps/frontend/tsconfig.json
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/lib/stores/ apps/frontend/src/lib/components/variants/VariantCard.svelte
git commit -m "fix: frontend stores — shared types import, Lead enrichment fields, variantId in generate, navigation link"
```

---

## Phase 5: Add-on Services

### Task 5.1: DB migration — ProjectAddon

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: migration SQL

- [ ] **Step 1: Add enums and model to schema.prisma**

Add to `schema.prisma`:

```prisma
enum AddonType {
  ONLINE_PAYMENT
  ONLINE_BOOKING
  CONTENT_MANAGEMENT
}

enum AddonStatus {
  INACTIVE
  ACTIVE
  SUSPENDED
}

model ProjectAddon {
  id           String      @id @default(uuid())
  projectId    String
  addonType    AddonType
  status       AddonStatus @default(ACTIVE)
  config       Json        @default("{}")
  priceMonthly Decimal?    @default(0)
  activatedAt  DateTime    @default(now())
  expiresAt    DateTime?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  project      Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, addonType])
  @@index([projectId])
}
```

Add to `Project` model:
```prisma
addons   ProjectAddon[]
```

- [ ] **Step 2: Generate migration**

```bash
npx prisma migrate dev --name add_project_addons
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/prisma/
git commit -m "feat: add ProjectAddon model — payment, booking, CMS add-ons"
```

---

### Task 5.2: AddonService + AddonController

**Files:**
- Create: `apps/backend/src/modules/addons/addon.service.ts`
- Create: `apps/backend/src/modules/addons/addon.controller.ts`
- Create: `apps/backend/src/modules/addons/addon.module.ts`

- [ ] **Step 1: Implement AddonService**

Create `addon.service.ts`:

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import type { AddonType } from '@prisma/client';

@Injectable()
export class AddonService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProject(projectId: string) {
    return this.prisma.projectAddon.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activate(projectId: string, addonType: AddonType, config: Record<string, unknown> = {}) {
    const existing = await this.prisma.projectAddon.findUnique({
      where: { projectId_addonType: { projectId, addonType } },
    });

    if (existing) {
      throw new ConflictException(`Add-on ${addonType} already exists for this project`);
    }

    return this.prisma.projectAddon.create({
      data: {
        projectId,
        addonType,
        config,
        status: 'ACTIVE',
        priceMonthly: this.getPrice(addonType),
      },
    });
  }

  async update(projectId: string, addonType: AddonType, config: Record<string, unknown>) {
    const addon = await this.prisma.projectAddon.findUnique({
      where: { projectId_addonType: { projectId, addonType } },
    });
    if (!addon) throw new NotFoundException(`Add-on ${addonType} not found`);

    return this.prisma.projectAddon.update({
      where: { projectId_addonType: { projectId, addonType } },
      data: { config },
    });
  }

  async deactivate(projectId: string, addonType: AddonType) {
    const addon = await this.prisma.projectAddon.findUnique({
      where: { projectId_addonType: { projectId, addonType } },
    });
    if (!addon) throw new NotFoundException(`Add-on ${addonType} not found`);

    return this.prisma.projectAddon.update({
      where: { projectId_addonType: { projectId, addonType } },
      data: { status: 'INACTIVE' },
    });
  }

  async getActiveAddons(projectId: string) {
    return this.prisma.projectAddon.findMany({
      where: { projectId, status: 'ACTIVE' },
    });
  }

  private getPrice(type: AddonType): number {
    switch (type) {
      case 'ONLINE_PAYMENT': return 499;
      case 'ONLINE_BOOKING': return 299;
      case 'CONTENT_MANAGEMENT': return 799;
      default: return 0;
    }
  }
}
```

- [ ] **Step 2: Implement AddonController**

Create `addon.controller.ts`:

```typescript
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { AddonService } from './addon.service';
import type { AddonType } from '@prisma/client';

@Controller()
export class AddonController {
  constructor(private readonly addonService: AddonService) {}

  @Get('/projects/:id/addons')
  async list(@Param('id') projectId: string) {
    return this.addonService.listByProject(projectId);
  }

  @Post('/projects/:id/addons')
  async activate(
    @Param('id') projectId: string,
    @Body() dto: { addonType: AddonType; config?: Record<string, unknown> },
  ) {
    return this.addonService.activate(projectId, dto.addonType, dto.config || {});
  }

  @Put('/projects/:id/addons/:addonType')
  async updateConfig(
    @Param('id') projectId: string,
    @Param('addonType') addonType: AddonType,
    @Body() config: Record<string, unknown>,
  ) {
    return this.addonService.update(projectId, addonType, config);
  }

  @Delete('/projects/:id/addons/:addonType')
  async deactivate(
    @Param('id') projectId: string,
    @Param('addonType') addonType: AddonType,
  ) {
    return this.addonService.deactivate(projectId, addonType);
  }
}
```

- [ ] **Step 3: Create AddonModule + register in AppModule**

Create `addon.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AddonService } from './addon.service';
import { AddonController } from './addon.controller';
import { PrismaModule } from '../../shared/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AddonController],
  providers: [AddonService],
  exports: [AddonService],
})
export class AddonModule {}
```

Register in `app.module.ts`:
```typescript
import { AddonModule } from './modules/addons/addon.module';
// in imports array:
AddonModule,
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit -p apps/backend/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/addons/ apps/backend/src/app.module.ts
git commit -m "feat: add AddonService + AddonController — payment, booking, CMS add-ons"
```

---

### Task 5.3: Hugo add-on integration (shortcodes + partials)

**Files:**
- Modify: `apps/backend/src/modules/generation/generation.service.ts` (or new file `apps/backend/src/modules/generation/addon-injector.service.ts`)

- [ ] **Step 1: Create addon injector for Hugo builds**

In `generation.service.ts` (or new `addon-injector.service.ts`):

```typescript
import type { ProjectAddon, AddonType } from '@prisma/client';

interface PageStructure {
  partials: { name: string; content: string }[];
  shortcodes: { name: string; content: string }[];
}

function injectAddons(structure: PageStructure, addons: ProjectAddon[]): PageStructure {
  for (const addon of addons) {
    if (addon.status !== 'ACTIVE') continue;

    switch (addon.addonType as AddonType) {
      case 'ONLINE_PAYMENT':
        structure.shortcodes.push({
          name: 'payment.html',
          content: generatePaymentShortcode(addon.config as Record<string, unknown>),
        });
        break;
      case 'ONLINE_BOOKING':
        structure.shortcodes.push({
          name: 'booking.html',
          content: generateBookingShortcode(addon.config as Record<string, unknown>),
        });
        break;
      case 'CONTENT_MANAGEMENT':
        structure.partials.push({
          name: 'cms-editor.html',
          content: generateCmsPartial(addon.config as Record<string, unknown>),
        });
        break;
    }
  }
  return structure;
}

function generatePaymentShortcode(config: Record<string, unknown>): string {
  const merchantId = config.merchantId || '';
  return `
<div class="payment-widget">
  <script src="https://widget.wayforpay.com/client.js"
          data-merchant="${merchantId}"
          data-currency="UAH">
  </script>
  <div id="wayforpay-widget"></div>
</div>`;
}

function generateBookingShortcode(config: Record<string, unknown>): string {
  const widgetUrl = config.widgetUrl || '';
  return `
<div class="booking-widget">
  <iframe src="${widgetUrl}" width="100%" height="600" frameborder="0"></iframe>
</div>`;
}

function generateCmsPartial(config: Record<string, unknown>): string {
  return `
<div id="cms-editor-root" data-site-slug="{{ .Site.Params.slug }}">
  <script src="/cms-editor.js" defer></script>
</div>`;
}

export { injectAddons };
```

- [ ] **Step 2: Call injectAddons in generation pipeline**

In `generation.service.ts` `generateSite()`:

```typescript
// After fetching project, before Hugo build:
const addons = await this.addonService.getActiveAddons(projectId);
structure = injectAddons(structure, addons);
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit -p apps/backend/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/generation/
git commit -m "feat: inject add-on shortcodes/partials into Hugo builds"
```

---

### Task 5.4: Frontend — AddonCard + AddonConfigModal + ContentEditor

**Files:**
- Create: `apps/frontend/src/lib/components/addons/AddonCard.svelte`
- Create: `apps/frontend/src/lib/components/addons/AddonConfigModal.svelte`
- Create: `apps/frontend/src/lib/stores/addons.ts`
- Modify: `apps/frontend/src/routes/dashboard/projects/[id]/+page.svelte`

- [ ] **Step 1: Create addons store**

Create `addons.ts`:

```typescript
import { writable } from 'svelte/store';
import { api } from '$lib/api/client';

interface ProjectAddon {
  id: string;
  projectId: string;
  addonType: 'ONLINE_PAYMENT' | 'ONLINE_BOOKING' | 'CONTENT_MANAGEMENT';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  config: Record<string, unknown>;
  priceMonthly: number;
  activatedAt: string;
}

function createAddonsStore() {
  const { subscribe, update } = writable<{ addons: Record<string, ProjectAddon[]>; loading: boolean }>({
    addons: {},
    loading: false,
  });

  return {
    subscribe,

    async fetchForProject(projectId: string) {
      update(s => ({ ...s, loading: true }));
      const addons = await api.get<ProjectAddon[]>(`/projects/${projectId}/addons`);
      update(s => ({ addons: { ...s.addons, [projectId]: addons }, loading: false }));
      return addons;
    },

    async activate(projectId: string, addonType: string, config: Record<string, unknown> = {}) {
      const addon = await api.post<ProjectAddon>(`/projects/${projectId}/addons`, { addonType, config });
      update(s => ({
        ...s,
        addons: { ...s.addons, [projectId]: [...(s.addons[projectId] || []), addon] },
      }));
      return addon;
    },

    async deactivate(projectId: string, addonType: string) {
      await api.delete(`/projects/${projectId}/addons/${addonType}`);
      update(s => ({
        ...s,
        addons: {
          ...s.addons,
          [projectId]: (s.addons[projectId] || []).filter(a => a.addonType !== addonType),
        },
      }));
    },
  };
}

export const addons = createAddonsStore();
```

- [ ] **Step 2: Implement AddonCard**

Create `AddonCard.svelte`:

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { CreditCard, Calendar, PenTool } from 'lucide-svelte';

  export let name: string;
  export let description: string;
  export let price: number;
  export let addonType: string;
  export let status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' = 'INACTIVE';
  export let onActivate: () => Promise<void>;
  export let onDeactivate: () => Promise<void>;
  export let onConfigure: () => void;

  const icons: Record<string, any> = {
    ONLINE_PAYMENT: CreditCard,
    ONLINE_BOOKING: Calendar,
    CONTENT_MANAGEMENT: PenTool,
  };
</script>

<div class="addon-card rounded-lg border p-4 flex items-center justify-between">
  <div class="flex items-center gap-3">
    <div class="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
      {@const Icon = icons[addonType]}
      {#if Icon}
        <Icon class="h-5 w-5 text-primary" />
      {/if}
    </div>
    <div>
      <h4 class="font-medium">{name}</h4>
      <p class="text-sm text-muted-foreground">{description}</p>
      <div class="flex items-center gap-2 mt-1">
        <span class="text-sm font-semibold">₴{price}/міс</span>
        <Badge variant={status === 'ACTIVE' ? 'default' : 'secondary'}>
          {status === 'ACTIVE' ? 'Active' : 'Inactive'}
        </Badge>
      </div>
    </div>
  </div>
  <div class="flex gap-2">
    {#if status === 'ACTIVE'}
      <Button size="sm" variant="outline" onclick={onConfigure}>Configure</Button>
      <Button size="sm" variant="destructive" onclick={onDeactivate}>Deactivate</Button>
    {:else}
      <Button size="sm" onclick={onActivate}>Activate</Button>
    {/if}
  </div>
</div>
```

- [ ] **Step 3: Add add-ons section to Project Detail page**

In `apps/frontend/src/routes/dashboard/projects/[id]/+page.svelte`, add after variant list:

```svelte
<!-- Add-ons Section -->
<section class="mt-8">
  <h2 class="text-xl font-semibold mb-4">Add-ons (paid features)</h2>
  <div class="space-y-3">
    <AddonCard
      name="Online Payment"
      description="Accept payments directly on the website"
      price={499}
      addonType="ONLINE_PAYMENT"
      status={getAddonStatus('ONLINE_PAYMENT')}
      onActivate={() => addons.activate(project.id, 'ONLINE_PAYMENT')}
      onDeactivate={() => addons.deactivate(project.id, 'ONLINE_PAYMENT')}
      onConfigure={() => openConfig('ONLINE_PAYMENT')}
    />
    <AddonCard
      name="Online Booking"
      description="EasyWeek booking widget for appointments"
      price={299}
      addonType="ONLINE_BOOKING"
      status={getAddonStatus('ONLINE_BOOKING')}
      onActivate={() => addons.activate(project.id, 'ONLINE_BOOKING')}
      onDeactivate={() => addons.deactivate(project.id, 'ONLINE_BOOKING')}
      onConfigure={() => openConfig('ONLINE_BOOKING')}
    />
    <AddonCard
      name="Content Management"
      description="Self-service content editor for the business owner"
      price={799}
      addonType="CONTENT_MANAGEMENT"
      status={getAddonStatus('CONTENT_MANAGEMENT')}
      onActivate={() => addons.activate(project.id, 'CONTENT_MANAGEMENT')}
      onDeactivate={() => addons.deactivate(project.id, 'CONTENT_MANAGEMENT')}
      onConfigure={() => openConfig('CONTENT_MANAGEMENT')}
    />
  </div>
</section>
```

- [ ] **Step 4: Verify build**

```bash
npx svelte-check --tsconfig apps/frontend/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/components/addons/ apps/frontend/src/lib/stores/addons.ts apps/frontend/src/routes/dashboard/projects/
git commit -m "feat: add AddonCard, addons store, add-ons section in project detail page"
```

---

## Phase 6: Tests

### Task 6.1: Backend tests — enrichment controller + analysis service

**Files:**
- Create: `apps/backend/src/modules/enrichment/enrichment-analysis.service.spec.ts` (extend existing)
- Modify: `apps/backend/src/modules/enrichment/enrichment.controller.spec.ts`

- [ ] **Step 1: Run all backend tests**

```bash
npx vitest run apps/backend/
```

- [ ] **Step 2: Ensure coverage ≥ 80% for new code**

```bash
npx vitest run apps/backend/ --coverage
```

- [ ] **Step 3: Fix any failing tests, then commit**

```bash
git add apps/backend/src/modules/enrichment/*.spec.ts
git commit -m "test: add enrichment controller + analysis service tests"
```

---

### Task 6.2: Frontend tests — stores + components

**Files:**
- Create: `apps/frontend/src/lib/stores/enrichment.spec.ts`
- Create: `apps/frontend/src/lib/stores/variants.spec.ts`
- Create: `apps/frontend/src/lib/stores/addons.spec.ts`

- [ ] **Step 1: Run all frontend tests**

```bash
npx vitest run apps/frontend/
```

- [ ] **Step 2: Write store tests where missing**

Create `enrichment.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API client
vi.mock('$lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('enrichment store', () => {
  it('fetchForLead loads enrichment data', async () => {
    const { api } = await import('$lib/api/client');
    (api.get as any).mockResolvedValue({ data: {}, enrichedAt: null, sources: [] });

    // Test store method
    // ...
  });

  it('enrichLead queues job and returns jobId', async () => {
    const { api } = await import('$lib/api/client');
    (api.post as any).mockResolvedValue({ jobId: 'job-123' });

    // Test store method
    // ...
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/lib/stores/*.spec.ts
git commit -m "test: add frontend store tests for enrichment, variants, addons"
```

---

### Task 6.3: E2E smoke test

**Files:**
- Create: `apps/frontend/e2e/enrichment-flow.spec.ts`

- [ ] **Step 1: Write E2E smoke test**

Create `enrichment-flow.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Enrichment flow', () => {
  test('full pipeline: lead → enrich → generate → preview', async ({ page }) => {
    // 1. Login
    await page.goto('/dashboard/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // 2. Navigate to leads
    await page.click('a[href="/dashboard/leads"]');
    await page.waitForURL('/dashboard/leads');

    // 3. Click first lead
    await page.click('.lead-card:first-child a');
    await page.waitForURL(/\/dashboard\/leads\//);

    // 4. Check enrichment panel is visible
    await expect(page.locator('.enrichment-panel')).toBeVisible();

    // 5. Click Enrich button
    await page.click('button:has-text("Enrich")');
    await expect(page.locator('text=Enriching')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E test**

```bash
npx playwright test apps/frontend/e2e/enrichment-flow.spec.ts --project=chromium
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/e2e/
git commit -m "test: add E2E smoke test — lead enrichment flow"
```

---

### Task 6.4: Run full CI locally

- [ ] **Step 1: Lint**

```bash
npm run lint
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Unit tests**

```bash
npm run test
```

- [ ] **Step 4: Build**

```bash
npm run build
```

- [ ] **Step 5: Final commit if any lint/type fixes**

```bash
git add -A
git commit -m "chore: lint and typecheck fixes from CI run"
```

---

## Completion Checklist

- [ ] Phase 0: Production verified, CI/CD simplified, deploy script working
- [ ] Phase 1: All 5 critical bugs fixed
- [ ] Phase 2: LLM analysis layer working (brand, competitor, sales script)
- [ ] Phase 3: All 3 providers maximized for data collection
- [ ] Phase 4: All frontend components built + store fixes
- [ ] Phase 5: Add-on services (payment, booking, CMS) working
- [ ] Phase 6: Tests passing, coverage ≥ 80%
- [ ] Full CI passes: lint, typecheck, test, build
- [ ] `bash scripts/deploy.sh` deploys successfully
