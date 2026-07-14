# Logs, Enrichment & Scraping Visibility Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three observability issues: empty system logs page, empty enrichment tab on lead detail, and missing scraping activity logs.

**Architecture:** Three independent fixes that share no code between them — wire PrismaLogger into NestJS bootstrap, fix EnrichmentPanel empty-state rendering, add ScrapingLog model + logging + UI tab.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Svelte 5, shadcn-svelte, BullMQ

## Global Constraints

- Pre-commit CI: `bash scripts/ci-local.sh` (lint → typecheck → test → build)
- Hugo themes via git submodule — never commit theme code
- External API calls MUST be mocked in tests
- No force pushes, no deletions

---

## Task 1: Wire PrismaLogger into NestJS bootstrap

**Covers:** System logs page showing data

**Files:**
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/shared/logging/prisma-logger.service.ts`
- Test: `apps/backend/src/shared/logging/prisma-logger.service.spec.ts` (create)

**Interfaces:**
- Consumes: `PrismaService` (existing)
- Produces: Global NestJS logger that persists WARN/ERROR/INFO to `systemLog` table

- [ ] **Step 1: Write the failing test**

```typescript
// apps/backend/src/shared/logging/prisma-logger.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaLogger } from './prisma-logger.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PrismaLogger', () => {
  let logger: PrismaLogger;
  let prisma: { systemLog: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = { systemLog: { create: jest.fn().mockResolvedValue({}) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaLogger,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    logger = module.get(PrismaLogger);
  });

  it('should save INFO logs to database', async () => {
    await logger.log('test message', 'TestModule');
    // Give saveLog time to complete (fire-and-forget)
    await new Promise(r => setTimeout(r, 10));
    expect(prisma.systemLog.create).toHaveBeenCalledWith({
      data: {
        level: 'INFO',
        module: 'TestModule',
        message: 'test message',
        details: undefined,
      },
    });
  });

  it('should save WARN logs to database', async () => {
    await logger.warn('warning message', 'TestModule');
    await new Promise(r => setTimeout(r, 10));
    expect(prisma.systemLog.create).toHaveBeenCalledWith({
      data: {
        level: 'WARN',
        module: 'TestModule',
        message: 'warning message',
        details: undefined,
      },
    });
  });

  it('should save ERROR logs with trace to database', async () => {
    await logger.error('error message', 'stack trace', 'TestModule');
    await new Promise(r => setTimeout(r, 10));
    expect(prisma.systemLog.create).toHaveBeenCalledWith({
      data: {
        level: 'ERROR',
        module: 'TestModule',
        message: 'error message',
        details: { trace: 'stack trace' },
      },
    });
  });

  it('should not crash when database write fails', async () => {
    prisma.systemLog.create.mockRejectedValue(new Error('DB down'));
    await expect(logger.error('fail', 'trace', 'Mod')).resolves.not.toThrow();
    await new Promise(r => setTimeout(r, 10));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=prisma-logger.service.spec --no-cache`
Expected: FAIL — `log()` does not call `prisma.systemLog.create`

- [ ] **Step 3: Update PrismaLogger to save INFO logs**

```typescript
// apps/backend/src/shared/logging/prisma-logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaLogger implements LoggerService {
  constructor(private readonly prisma: PrismaService) {}

  log(message: string, context?: string) {
    console.log(`[${context || 'App'}] ${message}`);
    this.saveLog('INFO', message, context).catch(() => {});
  }

  warn(message: string, context?: string) {
    console.warn(`[${context || 'App'}] ${message}`);
    this.saveLog('WARN', message, context).catch(() => {});
  }

  error(message: string, trace?: string, context?: string) {
    console.error(`[${context || 'App'}] ${message}`, trace);
    this.saveLog('ERROR', message, context, trace).catch(() => {});
  }

  private async saveLog(level: string, message: string, context?: string, trace?: string) {
    try {
      await this.prisma.systemLog.create({
        data: {
          level,
          module: context || 'App',
          message: message.slice(0, 1000),
          details: trace ? { trace: trace.slice(0, 5000) } : undefined,
        },
      });
    } catch {
      // Don't let logging failures crash the app
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=prisma-logger.service.spec --no-cache`
Expected: PASS

- [ ] **Step 5: Wire PrismaLogger into main.ts bootstrap**

```typescript
// apps/backend/src/main.ts — add import and app.useLogger()
import { PrismaLogger } from './shared/logging/prisma-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const prismaLogger = app.get(PrismaLogger);
  app.useLogger(prismaLogger);

  // ... rest of bootstrap unchanged
}
```

Also add `PrismaLogger` to `AppModule` providers so it can be injected:

```typescript
// apps/backend/src/app.module.ts — add PrismaLogger to providers
import { PrismaLogger } from './shared/logging/prisma-logger.service';

@Module({
  providers: [
    // ... existing providers
    PrismaLogger,
  ],
})
```

- [ ] **Step 6: Run full CI**

Run: `bash scripts/ci-local.sh`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/main.ts apps/backend/src/app.module.ts apps/backend/src/shared/logging/
git commit -m "fix: wire PrismaLogger into NestJS bootstrap so system logs persist to DB"
```

---

## Task 2: Fix EnrichmentPanel empty-state rendering

**Covers:** Enrichment tab showing data on lead detail page

**Files:**
- Modify: `apps/frontend/src/lib/components/enrichment/EnrichmentPanel.svelte`

**Interfaces:**
- Consumes: `EnrichmentData` type from `$lib/stores/enrichment`
- Produces: Visible enrichment config + empty-state message when no data

- [ ] **Step 1: Fix EnrichmentPanel to handle empty object**

The current code checks `{#if !data}` which is truthy for `{}`. Fix: check if data has any meaningful content.

```svelte
<!-- apps/frontend/src/lib/components/enrichment/EnrichmentPanel.svelte -->
<script lang="ts">
  import type { EnrichmentData } from '$lib/stores/enrichment';
  import Card from '$lib/components/ui/card/card.svelte';
  import CardHeader from '$lib/components/ui/card/card-header.svelte';
  import CardTitle from '$lib/components/ui/card/card-title.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';

  interface Props {
    data: EnrichmentData | null;
    sources: string[];
    enrichedAt: string | null;
  }

  let { data, sources, enrichedAt }: Props = $props();

  function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function toneEmoji(usage: string): string {
    switch (usage) {
      case 'none': return '—';
      case 'sparse': return '🙂';
      case 'moderate': return '✨';
      case 'heavy': return '🎉';
      default: return '—';
    }
  }

  let hasData = $derived(data && (
    (data.services && data.services.length > 0) ||
    (data.reviews && data.reviews.length > 0) ||
    (data.photos && data.photos.length > 0) ||
    (data.brandColors && Object.keys(data.brandColors).length > 0) ||
    (data.toneOfVoice) ||
    (data.competitors && data.competitors.length > 0) ||
    (data.salesOpportunities && data.salesOpportunities.length > 0) ||
    (data.salesScript) ||
    (data.customerJourney) ||
    (data.stats && Object.keys(data.stats).length > 0) ||
    (data.businessHours && Object.keys(data.businessHours).length > 0) ||
    (data.marketGap)
  ));
</script>

<Card>
  <CardHeader>
    <CardTitle>Enrichment Data</CardTitle>
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Sources: {sources.length > 0 ? sources.join(', ') : 'None configured'}</span>
      <span>•</span>
      <span>Last enriched: {formatDate(enrichedAt)}</span>
    </div>
  </CardHeader>
  <CardContent>
    {#if !hasData}
      <p class="text-sm text-muted-foreground py-4 text-center">
        No enrichment data yet. Configure sources and click "Enrich".
      </p>
    {:else}
      <div class="grid gap-4">
        <!-- ... existing sections unchanged ... -->
      </div>
    {/if}
  </CardContent>
</Card>
```

- [ ] **Step 2: Run frontend typecheck**

Run: `npm run typecheck --workspace=apps/frontend`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/lib/components/enrichment/EnrichmentPanel.svelte
git commit -m "fix: show enrichment empty-state when data is empty object"
```

---

## Task 3: Add ScrapingLog model and backend logging

**Covers:** Scraping activity logs visible in UI

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/src/modules/logs/logs.service.ts`
- Modify: `apps/backend/src/modules/logs/logs.controller.ts`
- Modify: `apps/backend/src/modules/scraping/scraping.service.ts`
- Modify: `apps/backend/src/modules/scraping/processors/scraping.processor.ts`
- Modify: `apps/backend/src/modules/enrichment/enrichment.service.ts`
- Modify: `apps/backend/src/modules/enrichment/processors/enrichment.processor.ts`

**Interfaces:**
- Consumes: `PrismaService`, existing scraping/enrichment services
- Produces: `ScrapingLog` model, `LogsController` scraping-logs endpoint

- [ ] **Step 1: Add ScrapingLog model to Prisma schema**

```prisma
// apps/backend/prisma/schema.prisma — add after SystemLog model
model ScrapingLog {
  id          String   @id @default(uuid())
  leadId      String?
  jobId       String?
  source      String   // instagram, facebook, googleMaps, apify
  action      String   // enrich, scrape, search, api_call
  status      String   // started, completed, failed
  message     String?
  details     Json?
  duration    Int?     // milliseconds
  createdAt   DateTime @default(now())

  @@index([leadId])
  @@index([source])
  @@index([createdAt])
  @@index([status])
}
```

- [ ] **Step 2: Run Prisma migration**

Run: `npx prisma migrate dev --name add-scraping-logs`
Expected: Migration created successfully

- [ ] **Step 3: Add LogsService with scraping log methods**

```typescript
// apps/backend/src/modules/logs/logs.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

export interface CreateScrapingLogDto {
  leadId?: string;
  jobId?: string;
  source: string;
  action: string;
  status: 'started' | 'completed' | 'failed';
  message?: string;
  details?: Record<string, unknown>;
  duration?: number;
}

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async logScraping(data: CreateScrapingLogDto) {
    return this.prisma.scrapingLog.create({ data });
  }

  async getScrapingLogs(params: {
    leadId?: string;
    source?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.leadId) where.leadId = params.leadId;
    if (params.source) where.source = params.source;
    if (params.status) where.status = params.status;

    const [logs, total] = await Promise.all([
      this.prisma.scrapingLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.scrapingLog.count({ where }),
    ]);

    return { logs, total };
  }
}
```

- [ ] **Step 4: Update LogsController with scraping-logs endpoint**

```typescript
// apps/backend/src/modules/logs/logs.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LogsService } from './logs.service';

@ApiTags('Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logsService: LogsService,
  ) {}

  @Get('generation')
  @ApiOperation({ summary: 'Get generation job logs' })
  async getGenerationLogs(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const jobs = await this.prisma.generationJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 50,
      include: { project: { select: { slug: true } } },
    });

    return { jobs };
  }

  @Get('system')
  @ApiOperation({ summary: 'Get system logs' })
  async getSystemLogs(
    @Query('level') level?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { module: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit, 10) : 50,
        skip: offset ? parseInt(offset, 10) : 0,
      }),
      this.prisma.systemLog.count({ where }),
    ]);

    return { logs, total };
  }

  @Get('scraping')
  @ApiOperation({ summary: 'Get scraping activity logs' })
  async getScrapingLogs(
    @Query('leadId') leadId?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.logsService.getScrapingLogs({
      leadId,
      source,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}
```

- [ ] **Step 5: Update LogsModule to provide LogsService**

```typescript
// apps/backend/src/modules/logs/logs.module.ts
import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
```

- [ ] **Step 6: Add logging to ScrapingProcessor**

```typescript
// apps/backend/src/modules/scraping/processors/scraping.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScrapingService } from '../scraping.service';
import { LogsService } from '../../logs/logs.service';

@Processor('scraping')
export class ScrapingProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapingProcessor.name);

  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly logsService: LogsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'scrape-leads') return;

    if (job.data.leadId && job.data.platforms?.length > 0) {
      this.logger.log(`Processing per-lead scraping job ${job.id} for lead ${job.data.leadId}, platforms: ${job.data.platforms.join(', ')}`);

      const startTime = Date.now();
      for (const platform of job.data.platforms) {
        await this.logsService.logScraping({
          leadId: job.data.leadId,
          jobId: job.id,
          source: platform,
          action: 'scrape',
          status: 'started',
          message: `Starting ${platform} scraping for lead ${job.data.leadId}`,
        });
      }

      try {
        await job.updateProgress(10);
        await this.scrapingService.scrapeLead(job.data.leadId, job.data.platforms);
        await job.updateProgress(100);

        const duration = Date.now() - startTime;
        for (const platform of job.data.platforms) {
          await this.logsService.logScraping({
            leadId: job.data.leadId,
            jobId: job.id,
            source: platform,
            action: 'scrape',
            status: 'completed',
            message: `Completed ${platform} scraping for lead ${job.data.leadId}`,
            duration,
          });
        }
        this.logger.log(`Per-lead scraping job ${job.id} completed for lead ${job.data.leadId}`);
      } catch (error) {
        const duration = Date.now() - startTime;
        for (const platform of job.data.platforms) {
          await this.logsService.logScraping({
            leadId: job.data.leadId,
            jobId: job.id,
            source: platform,
            action: 'scrape',
            status: 'failed',
            message: `Failed ${platform} scraping: ${error}`,
            duration,
          });
        }
        this.logger.error(`Per-lead scraping job ${job.id} failed: ${error}`);
        throw error;
      }
      return;
    }

    // Bulk scraping
    const startTime = Date.now();
    await this.logsService.logScraping({
      source: 'apify',
      action: 'bulk_scrape',
      status: 'started',
      message: `Bulk scraping: ${job.data.city}/${job.data.category}`,
    });

    try {
      await job.updateProgress(10);
      const result = await this.scrapingService.scrapeAndCreateLeads(job.data);
      await job.updateProgress(100);

      const duration = Date.now() - startTime;
      await this.logsService.logScraping({
        source: 'apify',
        action: 'bulk_scrape',
        status: 'completed',
        message: `Bulk scraping completed: ${result.created} leads created`,
        details: { scraped: result.scraped, created: result.created, skipped: result.skipped },
        duration,
      });
      this.logger.log(`Bulk scraping job ${job.id} completed: ${result.created} leads created`);
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.logsService.logScraping({
        source: 'apify',
        action: 'bulk_scrape',
        status: 'failed',
        message: `Bulk scraping failed: ${error}`,
        duration,
      });
      this.logger.error(`Bulk scraping job ${job.id} failed: ${error}`);
      throw error;
    }
  }
}
```

- [ ] **Step 7: Add logging to EnrichmentProcessor**

```typescript
// apps/backend/src/modules/enrichment/processors/enrichment.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EnrichmentService } from '../enrichment.service';
import { LogsService } from '../../logs/logs.service';

@Processor('enrichment')
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly logsService: LogsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'ENRICH_LEAD') return;

    const leadId = job.data.leadId;
    const startTime = Date.now();

    await this.logsService.logScraping({
      leadId,
      jobId: job.id,
      source: 'enrichment',
      action: 'enrich',
      status: 'started',
      message: `Starting enrichment for lead ${leadId}`,
    });

    try {
      await this.enrichmentService.enrichLead(leadId);
      const duration = Date.now() - startTime;

      await this.logsService.logScraping({
        leadId,
        jobId: job.id,
        source: 'enrichment',
        action: 'enrich',
        status: 'completed',
        message: `Enrichment completed for lead ${leadId}`,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.logsService.logScraping({
        leadId,
        jobId: job.id,
        source: 'enrichment',
        action: 'enrich',
        status: 'failed',
        message: `Enrichment failed for lead ${leadId}: ${error}`,
        duration,
      });
      throw error;
    }
  }
}
```

- [ ] **Step 8: Add provider-level logging to enrichment service**

```typescript
// apps/backend/src/modules/enrichment/enrichment.service.ts — update enrichLeadWithSources
// Add LogsService injection and per-provider logging

import { LogsService } from '../logs/logs.service';

// In constructor, add:
// private readonly logsService: LogsService,

// In enrichLeadWithSources, update the provider loop:
const providerResults = await Promise.all(
  sources.map(async (source) => {
    const provider = this.factory.createForProvider(source as EnrichmentSource);
    if (!provider) {
      this.logger.warn(`No provider for source: ${source}`);
      return null;
    }
    const startTime = Date.now();
    await this.logsService.logScraping({
      leadId,
      source,
      action: 'api_call',
      status: 'started',
      message: `Calling ${source} API for lead ${leadId}`,
    });
    try {
      this.logger.log(`Enriching lead ${leadId} from ${source}`);
      const data = await provider.enrich(lead.businessName, lead.city || undefined);
      const duration = Date.now() - startTime;
      await this.logsService.logScraping({
        leadId,
        source,
        action: 'api_call',
        status: 'completed',
        message: `${source} API call completed for lead ${leadId}`,
        duration,
        details: { dataKeys: Object.keys(data || {}) },
      });
      return { source, data };
    } catch (err) {
      const duration = Date.now() - startTime;
      await this.logsService.logScraping({
        leadId,
        source,
        action: 'api_call',
        status: 'failed',
        message: `${source} API failed for lead ${leadId}: ${err}`,
        duration,
      });
      this.logger.warn(`Provider ${source} failed for lead ${leadId}: ${err}`);
      return null;
    }
  }),
);
```

- [ ] **Step 9: Run full CI**

Run: `bash scripts/ci-local.sh`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/src/modules/logs/ apps/backend/src/modules/scraping/ apps/backend/src/modules/enrichment/
git commit -m "feat: add ScrapingLog model and audit logging throughout enrichment/scraping pipeline"
```

---

## Task 4: Add Scraping Logs tab to frontend

**Covers:** Scraping logs visible in UI

**Files:**
- Modify: `apps/frontend/src/routes/dashboard/logs/+page.svelte`
- Modify: `apps/frontend/src/lib/i18n/uk.ts` (add translations)

**Interfaces:**
- Consumes: `GET /logs/scraping` endpoint from Task 3
- Produces: Scraping logs tab in the logs page

- [ ] **Step 1: Add scraping tab to logs page**

```svelte
<!-- apps/frontend/src/routes/dashboard/logs/+page.svelte — add scraping tab -->
<script lang="ts">
  // ... existing imports and state ...

  // Scraping logs
  let scrapeLogs = $state<Array<Record<string, unknown>>>([]);
  let scrapeTotal = $state(0);
  let scrapeLoading = $state(false);
  let scrapeSource = $state('');
  let scrapeStatus = $state('');
  let scrapeOffset = $state(0);

  const sourceOptions = [
    { value: '', label: t.logs.allSources || 'All sources' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'googleMaps', label: 'Google Maps' },
    { value: 'apify', label: 'Apify' },
    { value: 'enrichment', label: 'Enrichment' },
  ];

  const scrapeStatusOptions = [
    { value: '', label: t.logs.allStatuses },
    { value: 'started', label: t.status.STARTED || 'Started' },
    { value: 'completed', label: t.status.COMPLETED },
    { value: 'failed', label: t.status.FAILED },
  ];

  async function loadScrapingLogs() {
    scrapeLoading = true;
    try {
      const parts: string[] = [];
      if (scrapeSource) parts.push(`source=${encodeURIComponent(scrapeSource)}`);
      if (scrapeStatus) parts.push(`status=${encodeURIComponent(scrapeStatus)}`);
      parts.push(`limit=${PAGE_SIZE}`);
      parts.push(`offset=${scrapeOffset}`);
      const query = parts.join('&');
      const data = await api.get<{ logs: Array<Record<string, unknown>>; total: number }>(`/logs/scraping?${query}`);
      scrapeLogs = data.logs || [];
      scrapeTotal = data.total || 0;
    } catch { scrapeLogs = []; }
    scrapeLoading = false;
  }

  // Update onMount to also load scraping logs when tab is selected
</script>

<!-- Update tab buttons to include scraping -->
<div class="flex border-b gap-1">
  <button class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
    {activeTab === 'generation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}"
    onclick={() => { activeTab = 'generation'; }}>
    {t.logs.generationLogs}
  </button>
  <button class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
    {activeTab === 'system' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}"
    onclick={() => { activeTab = 'system'; loadSystemLogs(); }}>
    {t.logs.systemLogs}
  </button>
  <button class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
    {activeTab === 'scraping' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}"
    onclick={() => { activeTab = 'scraping'; loadScrapingLogs(); }}>
    {t.logs.scrapingLogs || 'Scraping Logs'}
  </button>
</div>

<!-- Add scraping logs section -->
{#if activeTab === 'scraping'}
  <div class="flex items-center gap-4 mb-4">
    <Select.Root type="single" bind:value={scrapeSource} onValueChange={() => { scrapeOffset = 0; loadScrapingLogs(); }}>
      <Select.Trigger class="w-40">{sourceOptions.find(o => o.value === scrapeSource)?.label || 'All sources'}</Select.Trigger>
      <Select.Content>
        {#each sourceOptions as o (o.value)}
          <Select.Item value={o.value}>{o.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <Select.Root type="single" bind:value={scrapeStatus} onValueChange={() => { scrapeOffset = 0; loadScrapingLogs(); }}>
      <Select.Trigger class="w-32">{scrapeStatusOptions.find(o => o.value === scrapeStatus)?.label || t.logs.allStatuses}</Select.Trigger>
      <Select.Content>
        {#each scrapeStatusOptions as o (o.value)}
          <Select.Item value={o.value}>{o.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <Button variant="outline" size="sm" onclick={loadScrapingLogs}>
      <RefreshCw class="size-4 mr-1" /> {t.logs.refresh}
    </Button>
    <span class="text-sm text-muted-foreground">{t.logs.total} {scrapeTotal}</span>
  </div>

  <Card.Root>
    <Card.Content class="pt-6">
      {#if scrapeLoading}
        <div class="text-center py-12 text-muted-foreground">{t.common.loading}</div>
      {:else if scrapeLogs.length === 0}
        <div class="text-center py-12 text-muted-foreground">{t.common.noResults}</div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>{t.logs.time}</Table.Head>
              <Table.Head>{t.logs.source || 'Source'}</Table.Head>
              <Table.Head>{t.logs.action || 'Action'}</Table.Head>
              <Table.Head>{t.logs.status}</Table.Head>
              <Table.Head>{t.logs.message}</Table.Head>
              <Table.Head>{t.logs.duration || 'Duration'}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each scrapeLogs as log, i (i)}
              <Table.Row>
                <Table.Cell class="text-sm">{formatDate(log.createdAt as string)}</Table.Cell>
                <Table.Cell><Badge variant="outline">{log.source as string}</Badge></Table.Cell>
                <Table.Cell class="text-sm">{log.action as string}</Table.Cell>
                <Table.Cell>
                  <Badge variant={log.status === 'completed' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                    {log.status as string}
                  </Badge>
                </Table.Cell>
                <Table.Cell class="text-sm max-w-64 truncate">{log.message as string || '—'}</Table.Cell>
                <Table.Cell class="text-sm">{log.duration ? `${log.duration}ms` : '—'}</Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
        <div class="flex justify-between mt-4">
          <Button variant="outline" size="sm" disabled={scrapeOffset === 0} onclick={() => { scrapeOffset -= PAGE_SIZE; loadScrapingLogs(); }}>{t.logs.prev}</Button>
          <Button variant="outline" size="sm" disabled={scrapeLogs.length < PAGE_SIZE} onclick={() => { scrapeOffset += PAGE_SIZE; loadScrapingLogs(); }}>{t.logs.next}</Button>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
{/if}
```

- [ ] **Step 2: Add translations**

```typescript
// apps/frontend/src/lib/i18n/uk.ts — add to logs section
logs: {
  // ... existing
  scrapingLogs: 'Логи скрапингу',
  allSources: 'Усі джерела',
  source: 'Джерело',
  action: 'Дія',
  duration: 'Тривалість',
},
```

- [ ] **Step 3: Run frontend typecheck**

Run: `npm run typecheck --workspace=apps/frontend`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/routes/dashboard/logs/+page.svelte apps/frontend/src/lib/i18n/uk.ts
git commit -m "feat: add scraping logs tab to dashboard logs page"
```

---

## Task 5: Full CI verification

**Files:** None (verification only)

- [ ] **Step 1: Run full CI**

Run: `bash scripts/ci-local.sh`
Expected: lint → typecheck → test → build all pass

- [ ] **Step 2: Final commit if needed**

If any fixes were needed during CI, commit them.
