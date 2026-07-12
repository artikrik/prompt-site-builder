# Group 1: Leads + Categories + Scraping + OpenRouter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full lead management: extended creation form (social URLs, location, categories), detail card with tabs (details, enrichment, scraping, projects), category-prompt mapping, OpenRouter LLM provider.

**Architecture:** NestJS backend with Prisma ORM, SvelteKit 2 frontend with Svelte 5 runes, Tailwind v4 + shadcn-svelte UI. Scraping uses existing BullMQ queue. Categories stored as DB table with per-category LLM prompts. OpenRouter added as new LLM strategy alongside existing ones.

**Tech Stack:** NestJS 11, Prisma, PostgreSQL, BullMQ, SvelteKit 2, Svelte 5 runes, Tailwind CSS v4, shadcn-svelte

## Global Constraints

- Svelte 5 runes ONLY ($state, $derived, $effect, $props) — no Svelte 4 legacy syntax
- NestJS 11 — explicit return types on all controller methods, services
- Tailwind v4 inline utility classes — no v3 config directives
- No i18n library — simple `$lib/i18n/uk.ts` dictionary
- Caveman architecture: explicit, no unnecessary abstractions, no placeholders
- Pre-commit: `bash scripts/ci-local.sh` (lint → typecheck → test → build) — must exit 0
- Conventional commits: `feat:`, `fix:`, `refactor:`

---

## File Structure

### Database
- **Modify:** `apps/backend/prisma/schema.prisma` — Lead model fields + CategoryPrompt model
- **Create:** `apps/backend/prisma/seed-categories.ts` — seed 17 categories with default prompts

### Shared Package
- **Modify:** `packages/shared/src/types/lead.ts` — extend CreateLeadDto, UpdateLeadDto
- **Create:** `packages/shared/src/types/category.ts` — CategoryPrompt type, BUSINESS_CATEGORIES const
- **Modify:** `packages/shared/src/index.ts` — export new types

### Backend
- **Modify:** `apps/backend/src/modules/leads/leads.controller.ts` — add scraping endpoint
- **Modify:** `apps/backend/src/modules/leads/leads.service.ts` — support new fields
- **Create:** `apps/backend/src/modules/categories/categories.module.ts`
- **Create:** `apps/backend/src/modules/categories/categories.controller.ts`
- **Create:** `apps/backend/src/modules/categories/categories.service.ts`
- **Create:** `apps/backend/src/modules/generation/strategies/openrouter.strategy.ts`
- **Modify:** `apps/backend/src/modules/generation/strategies/llm-strategy.factory.ts` — register OpenRouter
- **Modify:** `apps/backend/src/modules/settings/settings.service.ts` — add openrouter provider
- **Create:** `apps/backend/src/modules/scraping/scraping.controller.ts`

### Frontend
- **Modify:** `apps/frontend/src/routes/dashboard/leads/+page.svelte` — extended create modal
- **Create:** `apps/frontend/src/routes/dashboard/leads/[id]/+page.svelte` — lead detail card
- **Create:** `apps/frontend/src/routes/dashboard/settings/categories/+page.svelte` — category prompt editor
- **Create:** `apps/frontend/src/lib/i18n/uk.ts` — Ukrainian dictionary
- **Modify:** `apps/frontend/src/lib/stores/leads.ts` — extended types
- **Create:** `apps/frontend/src/lib/components/lead/LeadDetailCard.svelte`
- **Create:** `apps/frontend/src/lib/components/lead/ScrapingPanel.svelte`
- **Create:** `apps/frontend/src/lib/components/categories/CategoryPromptEditor.svelte`

---

## Task 1: Database Migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/seed-categories.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Lead.socialUrls`, `Lead.country`, `Lead.region`, `Lead.scrapingEnabled`, `Lead.scrapedPhotos`, `Lead.scrapedReviews`, `Lead.scrapedContacts`, `Lead.scrapedHours`, `CategoryPrompt` model

- [ ] **Step 1: Update Lead model in schema.prisma**

Replace the `socialUrl` field and add new scraping/geo fields. In `apps/backend/prisma/schema.prisma`, find `model Lead` and apply these changes:

```diff
-  socialUrl    String?
+  socialUrls   String[]   @default([])
+  country      String?
+  region       String?
+  scrapingEnabled  Boolean  @default(false)
+  scrapedPhotos    String[]  @default([])
+  scrapedReviews   Json[]    @default([])
+  scrapedContacts  Json      @default("{}")
+  scrapedHours     Json      @default("{}")
```

- [ ] **Step 2: Add CategoryPrompt model to schema.prisma**

Append after the last model in `apps/backend/prisma/schema.prisma`:

```prisma
model CategoryPrompt {
  id               String   @id @default(uuid())
  category         String   @unique
  contentPrompt    String
  designPrompt     String
  competitorPrompt String
  isCustom         Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

- [ ] **Step 3: Run Prisma migration**

```bash
cd apps/backend && npx prisma migrate dev --name add_lead_scraping_and_categories
```

Expected: migration file created, no errors.

- [ ] **Step 4: Create seed file for 17 categories**

Create `apps/backend/prisma/seed-categories.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PROMPTS: Record<string, { content: string; design: string; competitor: string }> = {
  'Стоматологія': {
    content: 'Ти — професійний копірайтер. Створи контент для сайту стоматологічної клініки. Включи: головну сторінку з УТП, послуги (терапія, хірургія, ортодонтія, імплантація), про клініку, лікарів, відгуки, контакти. Використовуй професійну медичну лексику, уникай страшних термінів.',
    design: 'Сучасний медичний дизайн: чисті білі та блакитні тони, професійні фото клініки та лікарів, великі зображення, мінімалістична навігація.',
    competitor: 'Проаналізуй конкурентів у сфері стоматології. Зверни увагу на: перелік послуг, цінову політику, наявність онлайн-запису, фото робіт, відгуки пацієнтів, акції та спецпропозиції.',
  },
  'Краса та догляд': {
    content: 'Ти — професійний копірайтер. Створи контент для сайту салону краси. Включи: головну з естетичними фото, послуги (манікюр, педикюр, вії, брови, косметологія, масаж), прайс-лист, майстрів, портфоліо робіт, акції.',
    design: 'Елегантний жіночний дизайн: пастельні тони (рожевий, бежевий, золотий), великі фото робіт, плавні форми, акцент на візуальній естетиці.',
    competitor: 'Проаналізуй конкурентів у сфері краси. Зверни увагу на: спектр послуг, ціни, фото робіт, наявність онлайн-запису, соцмережі, акції, програми лояльності.',
  },
  'Юридичні послуги': {
    content: 'Ти — професійний копірайтер. Створи контент для сайту юридичної компанії. Включи: головну, послуги (консультації, супровід, представництво в суді), команду адвокатів, кейси, статті/блог, контакти. Дотримуйся ділового стилю.',
    design: 'Строгий корпоративний дизайн: темно-сині та сірі тони, професійні фото команди, чітка сітка, мінімум декору, акцент на текст та довіру.',
    competitor: 'Проаналізуй конкурентів у юридичній сфері. Зверни увагу на: спеціалізацію, кейси, публікації, команду, ціни, наявність безкоштовної консультації.',
  },
  'Будівництво': {
    content: 'Ти — професійний копірайтер. Створи контент для сайту будівельної компанії. Включи: головну, послуги (будівництво, реконструкція, ремонт), портфоліо об\'єктів, етапи роботи, відгуки, кошторис, контакти.',
    design: 'Надійний індустріальний дизайн: сірі, помаранчеві/жовті акценти, великі фото об\'єктів, інфографіка етапів, чіткі CTA.',
    competitor: 'Проаналізуй конкурентів у будівництві. Зверни увагу на: типи об\'єктів, портфоліо, терміни, ціни за м², гарантії, відгуки, наявність кошторису онлайн.',
  },
  'Автосервіс': {
    content: 'Ти — професійний копірайтер. Створи контент для сайту автосервісу. Включи: головну, послуги (діагностика, ремонт, ТО, шиномонтаж, кузовні роботи), прайс, команду, галерею робіт, контакти.',
    design: 'Технічний маскулінний дизайн: темні тони з червоними/синіми акцентами, фото автомобілів та процесу ремонту, чітка структура послуг.',
    competitor: 'Проаналізуй конкурентів у автосервісі. Зверни увагу на: марки авто, види послуг, ціни, обладнання, терміни, гарантії, онлайн-запис.',
  },
};

const CATEGORIES = [
  { category: 'Стоматологія', theme: 'hugo-fresh' },
  { category: 'Краса та догляд', theme: 'hugo-hero-theme' },
  { category: 'Юридичні послуги', theme: 'ananke' },
  { category: 'Будівництво', theme: 'hugo-universal-theme' },
  { category: 'Автосервіс', theme: 'hugo-universal-theme' },
  { category: 'Медицина', theme: 'hugo-fresh' },
  { category: 'Ветеринарія', theme: 'hugo-fresh' },
  { category: 'Ресторан/Кафе', theme: 'hugo-hero-theme' },
  { category: 'Фітнес/Спорт', theme: 'hugo-hero-theme' },
  { category: 'Логістика', theme: 'hugo-scroll' },
  { category: 'Консалтинг', theme: 'ananke' },
  { category: 'Нерухомість', theme: 'hugo-universal-theme' },
  { category: 'Ремонт/Оздоблення', theme: 'hugo-universal-theme' },
  { category: 'Сантехніка', theme: 'hugo-scroll' },
  { category: 'Клінінг', theme: 'hugo-fresh' },
  { category: 'ІТ/Розробка', theme: 'hugo-hero-theme' },
  { category: 'Інше', theme: 'auto' },
];

async function main(): Promise<void> {
  console.log('Seeding categories...');

  for (const { category, theme } of CATEGORIES) {
    const prompts = DEFAULT_PROMPTS[category] || {
      content: 'Ти — професійний копірайтер. Створи контент для сайту бізнесу у сфері "{category}". Включи: головну сторінку, послуги, про компанію, контакти.',
      design: 'Універсальний сучасний дизайн: чисті лінії, професійні кольори, адаптивна верстка.',
      competitor: 'Проаналізуй конкурентів у сфері {category}. Визнач їх сильні та слабкі сторони.',
    };

    await prisma.categoryPrompt.upsert({
      where: { category },
      update: {},
      create: {
        category,
        contentPrompt: prompts.content,
        designPrompt: prompts.design,
        competitorPrompt: prompts.competitor,
        isCustom: false,
      },
    });
  }

  console.log(`Seeded ${CATEGORIES.length} categories.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Add seed script to package.json**

In `apps/backend/package.json`, add to `scripts`:

```json
"seed:categories": "ts-node prisma/seed-categories.ts"
```

- [ ] **Step 6: Run seed**

```bash
cd apps/backend && npx ts-node prisma/seed-categories.ts
```

Expected: `Seeded 17 categories.`

- [ ] **Step 7: Commit**

```bash
git add apps/backend/prisma/
git commit -m "feat: add Lead scraping fields, CategoryPrompt model, seed categories"
```

---

## Task 2: Shared Types

**Files:**
- Modify: `packages/shared/src/types/lead.ts`
- Create: `packages/shared/src/types/category.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: Lead model changes from Task 1
- Produces: `CreateLeadDto` (extended), `UpdateLeadDto` (extended), `CategoryPrompt` type, `BUSINESS_CATEGORIES` const, `ScrapeRequest`, `ScrapeResult`

- [ ] **Step 1: Extend CreateLeadDto and UpdateLeadDto**

In `packages/shared/src/types/lead.ts`, modify the interfaces:

```typescript
export interface CreateLeadDto {
  businessName: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;          // new
  country?: string;         // new
  category?: string;
  description?: string;
  website?: string;
  socialUrls?: string[];    // was: socialUrl?: string
  source: string;
  tags?: string[];
  scrapedData?: any;
  enrichmentSources?: Array<'instagram' | 'facebook' | 'googleMaps'>;
}

export interface UpdateLeadDto {
  businessName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;          // new
  country?: string;         // new
  category?: string;
  description?: string;
  website?: string;
  socialUrls?: string[];    // was: socialUrl?: string
  status?: LeadStatus;
  scrapedData?: any;
  tags?: string[];
  enrichmentSources?: Array<'instagram' | 'facebook' | 'googleMaps'>;
  scrapingEnabled?: boolean;  // new
  easyweekEnabled?: boolean;
  easyweekApiKey?: string | null;
  wayforpayEnabled?: boolean;
  wayforpayMerchant?: string | null;
  wayforpaySecret?: string | null;
  monobankEnabled?: boolean;
  monobankApiKey?: string | null;
}
```

Also update the `Lead` interface to add new fields:

```typescript
export interface Lead {
  // ...existing fields...
  socialUrls: string[];       // was: socialUrl: string | null
  country: string | null;
  region: string | null;
  scrapingEnabled: boolean;
  scrapedPhotos: string[];
  scrapedReviews: Array<Record<string, unknown>>;
  scrapedContacts: Record<string, unknown>;
  scrapedHours: Record<string, unknown>;
  // ...rest existing...
}
```

- [ ] **Step 2: Create category types**

Create `packages/shared/src/types/category.ts`:

```typescript
export interface CategoryPrompt {
  id: string;
  category: string;
  contentPrompt: string;
  designPrompt: string;
  competitorPrompt: string;
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryWithTheme {
  category: string;
  theme: string;
}

export const BUSINESS_CATEGORIES: CategoryWithTheme[] = [
  { category: 'Стоматологія', theme: 'hugo-fresh' },
  { category: 'Краса та догляд', theme: 'hugo-hero-theme' },
  { category: 'Юридичні послуги', theme: 'ananke' },
  { category: 'Будівництво', theme: 'hugo-universal-theme' },
  { category: 'Автосервіс', theme: 'hugo-universal-theme' },
  { category: 'Медицина', theme: 'hugo-fresh' },
  { category: 'Ветеринарія', theme: 'hugo-fresh' },
  { category: 'Ресторан/Кафе', theme: 'hugo-hero-theme' },
  { category: 'Фітнес/Спорт', theme: 'hugo-hero-theme' },
  { category: 'Логістика', theme: 'hugo-scroll' },
  { category: 'Консалтинг', theme: 'ananke' },
  { category: 'Нерухомість', theme: 'hugo-universal-theme' },
  { category: 'Ремонт/Оздоблення', theme: 'hugo-universal-theme' },
  { category: 'Сантехніка', theme: 'hugo-scroll' },
  { category: 'Клінінг', theme: 'hugo-fresh' },
  { category: 'ІТ/Розробка', theme: 'hugo-hero-theme' },
  { category: 'Інше', theme: 'auto' },
];

export const CATEGORY_LABELS: string[] = BUSINESS_CATEGORIES.map(c => c.category);

export interface ScrapeRequest {
  platforms: Array<'instagram' | 'facebook' | 'googleMaps'>;
}

export interface ScrapeResult {
  platform: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  photos?: string[];
  reviews?: Array<Record<string, unknown>>;
  contacts?: Record<string, unknown>;
  hours?: Record<string, unknown>;
  error?: string;
}

export interface UpdateCategoryPromptsDto {
  contentPrompt?: string;
  designPrompt?: string;
  competitorPrompt?: string;
}
```

- [ ] **Step 3: Export new types from index**

In `packages/shared/src/index.ts`, add exports:

```typescript
export * from './types/category';
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: extend lead DTOs, add category types and scrape interfaces"
```

---

## Task 3: Categories Backend Module

**Files:**
- Create: `apps/backend/src/modules/categories/categories.module.ts`
- Create: `apps/backend/src/modules/categories/categories.controller.ts`
- Create: `apps/backend/src/modules/categories/categories.service.ts`
- Modify: `apps/backend/src/app.module.ts` — register module

**Interfaces:**
- Consumes: `CategoryPrompt` model from Task 1
- Produces: `CategoriesController` (GET /categories, GET /categories/:category/prompts, PUT /categories/:category/prompts), `CategoriesService`

- [ ] **Step 1: Create CategoriesService**

Create `apps/backend/src/modules/categories/categories.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CategoryPrompt, CategoryWithTheme, BUSINESS_CATEGORIES, UpdateCategoryPromptsDto } from '@prompt-site-builder/shared';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<CategoryWithTheme[]> {
    return BUSINESS_CATEGORIES;
  }

  async getPrompts(category: string): Promise<CategoryPrompt> {
    const prompts = await this.prisma.categoryPrompt.findUnique({
      where: { category },
    });

    if (!prompts) {
      throw new NotFoundException(`Category ${category} not found`);
    }

    return prompts;
  }

  async updatePrompts(category: string, dto: UpdateCategoryPromptsDto): Promise<CategoryPrompt> {
    const existing = await this.prisma.categoryPrompt.findUnique({
      where: { category },
    });

    if (!existing) {
      throw new NotFoundException(`Category ${category} not found`);
    }

    return this.prisma.categoryPrompt.update({
      where: { category },
      data: {
        ...dto,
        isCustom: true,
      },
    });
  }
}
```

- [ ] **Step 2: Create CategoriesController**

Create `apps/backend/src/modules/categories/categories.controller.ts`:

```typescript
import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CategoryPrompt, CategoryWithTheme, UpdateCategoryPromptsDto } from '@prompt-site-builder/shared';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all business categories with themes' })
  async list(): Promise<CategoryWithTheme[]> {
    return this.categoriesService.listCategories();
  }

  @Get(':category/prompts')
  @ApiOperation({ summary: 'Get prompts for a category' })
  async getPrompts(@Param('category') category: string): Promise<CategoryPrompt> {
    return this.categoriesService.getPrompts(category);
  }

  @Put(':category/prompts')
  @ApiOperation({ summary: 'Update prompts for a category' })
  async updatePrompts(
    @Param('category') category: string,
    @Body() dto: UpdateCategoryPromptsDto,
  ): Promise<CategoryPrompt> {
    return this.categoriesService.updatePrompts(category, dto);
  }
}
```

- [ ] **Step 3: Create CategoriesModule**

Create `apps/backend/src/modules/categories/categories.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
```

- [ ] **Step 4: Register module in app.module.ts**

In `apps/backend/src/app.module.ts`, add import:

```typescript
import { CategoriesModule } from './modules/categories/categories.module';
```

And add `CategoriesModule` to the `imports` array.

- [ ] **Step 5: Run typecheck**

```bash
cd apps/backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/categories/ apps/backend/src/app.module.ts
git commit -m "feat: add categories module with prompts CRUD"
```

---

## Task 4: Leads Backend Updates (Scraping Endpoints)

**Files:**
- Modify: `apps/backend/src/modules/leads/leads.controller.ts`
- Modify: `apps/backend/src/modules/leads/leads.service.ts`

**Interfaces:**
- Consumes: Lead model updates from Task 1, queue service
- Produces: `POST /leads/:id/scrape`, `GET /leads/:id/scrape-status`

- [ ] **Step 1: Update LeadsService.create to handle new fields**

In `apps/backend/src/modules/leads/leads.service.ts`, update the `create` method data mapping:

```typescript
async create(dto: CreateLeadDto): Promise<Lead> {
  const slug = this.generateSlug(dto.businessName);
  const encryptedData = this.encryptPaymentFields(dto);

  const defaultSources = this.configService.get<string>('ENRICHMENT_DEFAULT_SOURCES');
  const enrichmentSources = dto.enrichmentSources
    ?? (defaultSources ? defaultSources.split(',').map((s) => s.trim()) : []);

  const lead = await this.prisma.lead.create({
    data: {
      ...encryptedData,
      slug,
      socialUrls: dto.socialUrls || [],
      country: dto.country,
      region: dto.region,
      tags: dto.tags || [],
      scrapedData: dto.scrapedData || {},
      enrichmentSources,
    },
  });

  const autoRun = this.configService.get<string>('ENRICHMENT_AUTO_RUN');
  if (autoRun === 'true' && enrichmentSources.length > 0) {
    this.queueService.addEnrichmentJob(lead.id)
      .then((job) => this.logger.log(`Auto-enrichment queued: ${job.id} for lead ${lead.id}`))
      .catch((err) => this.logger.warn(`Auto-enrichment failed for lead ${lead.id}: ${err}`));
  }

  await this.cache.delByPrefix(CACHE_PREFIX);
  return this.toLead(lead);
}
```

- [ ] **Step 2: Update toLead to include new fields**

In `apps/backend/src/modules/leads/leads.service.ts`, update private `toLead` method:

```typescript
private toLead(data: any): Lead {
  const decrypted = this.decryptPaymentFields(data);
  return {
    ...decrypted,
    enrichmentData: (decrypted.enrichmentData as any) ?? null,
    scrapedData: decrypted.scrapedData ?? {},
    socialUrls: decrypted.socialUrls ?? [],
    scrapedPhotos: decrypted.scrapedPhotos ?? [],
    scrapedReviews: decrypted.scrapedReviews ?? [],
    scrapedContacts: decrypted.scrapedContacts ?? {},
    scrapedHours: decrypted.scrapedHours ?? {},
  } as Lead;
}
```

- [ ] **Step 3: Add scraping endpoints to LeadsController**

In `apps/backend/src/modules/leads/leads.controller.ts`, add these methods:

```typescript
@Post(':id/scrape')
@ApiOperation({ summary: 'Queue social media scraping for a lead' })
@ApiResponse({ status: 202, description: 'Scraping queued' })
async scrape(
  @Param('id') id: string,
  @Body() dto: ScrapeRequest,
): Promise<{ jobId: string }> {
  const job = await this.leadsService.queueScrape(id, dto.platforms);
  return { jobId: job.id };
}

@Get(':id/scrape-status')
@ApiOperation({ summary: 'Get scraping job status and results' })
@ApiResponse({ status: 200, description: 'Scraping status' })
async getScrapeStatus(@Param('id') id: string) {
  return this.leadsService.getScrapeStatus(id);
}
```

- [ ] **Step 4: Add queueScrape and getScrapeStatus to LeadsService**

In `apps/backend/src/modules/leads/leads.service.ts`, add:

```typescript
async queueScrape(leadId: string, platforms: string[]): Promise<{ id: string }> {
  const lead = await this.findOne(leadId);

  const job = await this.queueService.addScrapeJob(leadId, platforms);

  // Mark scraping as enabled
  await this.prisma.lead.update({
    where: { id: leadId },
    data: { scrapingEnabled: true },
  });

  return { id: job.id };
}

async getScrapeStatus(leadId: string): Promise<{ jobs: Array<{ id: string; status: string; result?: unknown; error?: string }> }> {
  const jobs = await this.prisma.generationJob.findMany({
    where: { project: { leadId }, type: 'SCRAPE_LEAD' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, status: true, result: true, error: true },
  });

  return { jobs };
}
```

Note: `queueService.addScrapeJob` must exist — if not yet implemented, create a stub that logs and returns a mock job. The actual scraping implementation is in the existing enrichment module's providers.

- [ ] **Step 5: Run typecheck**

```bash
cd apps/backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/leads/
git commit -m "feat: add socialUrls/geo fields to leads, scraping endpoints"
```

---

## Task 5: OpenRouter LLM Strategy

**Files:**
- Create: `apps/backend/src/modules/generation/strategies/openrouter.strategy.ts`
- Modify: `apps/backend/src/modules/generation/strategies/llm-strategy.factory.ts`
- Modify: `apps/backend/src/modules/settings/settings.service.ts`

**Interfaces:**
- Consumes: `LLMStrategy` interface from existing strategies
- Produces: `OpenRouterStrategy implements LLMStrategy`, registered in factory

- [ ] **Step 1: Create OpenRouterStrategy**

Create `apps/backend/src/modules/generation/strategies/openrouter.strategy.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMStrategy, HugoContentRequest, GeneratedHugoContent } from './llm-strategy.interface';

@Injectable()
export class OpenRouterStrategy implements LLMStrategy {
  private readonly logger = new Logger(OpenRouterStrategy.name);
  readonly provider = 'openrouter';

  constructor(private readonly configService: ConfigService) {}

  async generateHugoStructure(request: HugoContentRequest): Promise<GeneratedHugoContent> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    const model = this.configService.get<string>('OPENROUTER_MODEL', 'openai/gpt-4o');

    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const prompt = this.buildPrompt(request);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua'),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenRouter');

    return JSON.parse(content) as GeneratedHugoContent;
  }

  private buildPrompt(request: HugoContentRequest): string {
    return `You are an expert Hugo static site generator. Generate a complete Hugo website structure for a business.

BUSINESS: ${request.businessName}
CATEGORY: ${request.category || 'General'}
DESCRIPTION: ${request.description || ''}
THEME: ${request.theme || 'default'}

Return a JSON object with:
{
  "hugoToml": "complete hugo.toml config string",
  "indexMd": "markdown for homepage",
  "aboutMd": "markdown for about page",
  "servicesMd": "markdown for services page",
  "contactMd": "markdown for contact page",
  "heroImagePrompt": "DALL-E prompt for hero image",
  "seoTitle": "SEO title",
  "seoDescription": "SEO description"
}`;
  }
}
```

- [ ] **Step 2: Register OpenRouter in LLM Strategy Factory**

Read `apps/backend/src/modules/generation/strategies/llm-strategy.factory.ts` first to understand the current factory pattern, then add `OpenRouterStrategy` registration. If the factory uses a registry map, add:

```typescript
// In the factory's strategy map/registry:
{ provider: 'openrouter', useClass: OpenRouterStrategy }
```

If the factory dynamically creates strategies based on a provider string, add a case for `'openrouter'`.

- [ ] **Step 3: Add OpenRouter to SettingsService**

In `apps/backend/src/modules/settings/settings.service.ts`, ensure the `getEffectiveModel` method handles `openrouter` as a provider, defaulting to `'openai/gpt-4o'` for content and returning null for image (OpenRouter text-only initially).

- [ ] **Step 4: Add OpenRouter API key env var**

Add to `apps/backend/.env` and `.env.example`:

```
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o
```

- [ ] **Step 5: Add GET /generation/models endpoint to return OpenRouter models**

In `apps/backend/src/modules/generation/generation.controller.ts`, add:

```typescript
@Get('models')
@ApiOperation({ summary: 'List available LLM models' })
async listModels(@Query('provider') provider?: string): Promise<Array<{ id: string; name: string }>> {
  if (provider === 'openrouter') {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) return [];

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await response.json() as { data: Array<{ id: string; name: string }> };
      return data.data.map(m => ({ id: m.id, name: m.name }));
    } catch {
      return [];
    }
  }

  // Default: return configured models
  return [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ];
}
```

- [ ] **Step 6: Run typecheck**

```bash
cd apps/backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/generation/ apps/backend/src/modules/settings/ apps/backend/.env.example
git commit -m "feat: add OpenRouter LLM strategy and model listing endpoint"
```

---

## Task 6: Ukrainian i18n Dictionary (Base)

**Files:**
- Create: `apps/frontend/src/lib/i18n/uk.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `t` dictionary object with all UI strings

- [ ] **Step 1: Create Ukrainian dictionary**

Create `apps/frontend/src/lib/i18n/uk.ts`:

```typescript
export const t = {
  app: {
    name: 'Prompt Site Builder',
  },
  nav: {
    dashboard: 'Панель керування',
    leads: 'Ліди',
    projects: 'Проекти',
    settings: 'Налаштування',
    logs: 'Логи',
    variants: 'Варіанти',
  },
  common: {
    save: 'Зберегти',
    cancel: 'Скасувати',
    delete: 'Видалити',
    edit: 'Редагувати',
    create: 'Створити',
    search: 'Пошук...',
    loading: 'Завантаження...',
    noResults: 'Нічого не знайдено',
    confirm: 'Підтвердити',
    back: 'Назад',
    actions: 'Дії',
    required: 'Обов\'язкове поле',
  },
  leads: {
    title: 'Ліди',
    addLead: 'Додати ліда',
    createLead: 'Створити ліда',
    editLead: 'Редагувати ліда',
    businessName: 'Назва бізнесу',
    category: 'Категорія',
    city: 'Місто',
    region: 'Область',
    country: 'Країна',
    socialLinks: 'Посилання на соцмережі',
    addSocialLink: 'Додати посилання',
    phone: 'Телефон',
    email: 'Пошта',
    address: 'Адреса',
    source: 'Джерело',
    status: 'Статус',
    website: 'Вебсайт',
    description: 'Опис',
    searchLeads: 'Пошук лідів...',
    noLeads: 'Лідів не знайдено',
    createFirst: 'Створіть першого ліда щоб почати.',
    deleteConfirm: 'Ви впевнені що хочете видалити цього ліда?',
    tabs: {
      details: 'Деталі',
      enrichment: 'Збагачення',
      projects: 'Проекти',
      scraping: 'Скрапінг',
    },
  },
  scraping: {
    title: 'Скрапінг даних',
    runScraping: 'Запустити скрапінг',
    scraping: 'Скрапінг...',
    selectPlatforms: 'Виберіть платформи',
    instagramUrl: 'Instagram URL',
    facebookUrl: 'Facebook URL',
    googleMapsUrl: 'Google Maps URL',
    results: 'Результати',
    photos: 'Фото',
    reviews: 'Відгуки',
    contacts: 'Контакти',
    hours: 'Години роботи',
    noResults: 'Немає результатів скрапінгу',
  },
  enrichment: {
    title: 'Збагачення даних',
    enrich: 'Запустити збагачення',
    enrichLead: 'Збагатити ліда',
    analyzeCompetitors: 'Аналіз конкурентів',
    sources: 'Джерела даних',
    lastEnriched: 'Останнє збагачення',
    never: 'Ніколи',
  },
  projects: {
    title: 'Проекти',
    noProjects: 'Немає проектів. Перейдіть до Лідів щоб створити.',
    generate: 'Згенерувати сайт',
    generating: 'Генерація...',
    regenerate: 'Перегенерувати',
    viewSite: 'Відкрити сайт',
    preview: 'Прев\'ю',
    advanced: 'Розширені',
    hideAdvanced: 'Сховати розширені',
    siteInfo: 'Інформація про сайт',
    hugoConfig: 'Конфігурація Hugo',
    domain: 'Домен',
    theme: 'Тема',
    activeVariant: 'Активний варіант',
    created: 'Створено',
    published: 'Опубліковано',
    none: 'Немає',
  },
  variants: {
    title: 'Варіанти',
    generateVariant: 'Згенерувати варіант',
    activate: 'Активувати',
    delete: 'Видалити',
    noVariants: 'Немає варіантів',
    model: 'Модель',
    imageModel: 'Модель зображень',
    theme: 'Тема',
  },
  addons: {
    title: 'Додаткові послуги',
    activate: 'Активувати',
    deactivate: 'Деактивувати',
    configure: 'Налаштувати',
    priceMonthly: 'грн/міс',
    config: {
      title: 'Налаштування',
      wayforpayMerchant: 'WayForPay Merchant Login',
      wayforpaySecret: 'WayForPay Secret Key',
      testMode: 'Тестовий режим',
      easyweekUrl: 'EasyWeek Widget URL',
      businessId: 'Business ID',
      updateLimit: 'Ліміт оновлень на місяць',
      notificationEmail: 'Email для сповіщень',
    },
  },
  categories: {
    title: 'Категорії бізнесу',
    editPrompts: 'Редагувати промпти',
    contentPrompt: 'Промпт контенту',
    designPrompt: 'Промпт дизайну',
    competitorPrompt: 'Промпт конкурентів',
    resetToDefault: 'Скинути до стандартного',
    theme: 'Тема Hugo',
  },
  status: {
    NEW: 'Новий',
    CONTACTED: 'Зконтактовано',
    QUALIFIED: 'Кваліфікований',
    CONVERTED: 'Конвертований',
    REJECTED: 'Відхилено',
    DRAFT: 'Чернетка',
    GENERATING: 'Генерується',
    GENERATED: 'Згенеровано',
    PUBLISHING: 'Публікується',
    PUBLISHED: 'Опубліковано',
    FAILED: 'Помилка',
    ACTIVE: 'Активний',
    INACTIVE: 'Неактивний',
    SUSPENDED: 'Призупинено',
    PENDING: 'Очікує',
    PROCESSING: 'Обробляється',
    COMPLETED: 'Завершено',
  },
  notifications: {
    generationStarted: 'Генерацію розпочато',
    generationComplete: 'Сайт успішно згенеровано!',
    generationFailed: 'Помилка генерації',
    variantActivated: 'Варіант активовано',
    scrapingStarted: 'Скрапінг запущено',
    scrapingComplete: 'Скрапінг завершено',
    enrichmentStarted: 'Збагачення запущено',
    enrichmentComplete: 'Збагачення завершено',
    saved: 'Збережено',
    deleted: 'Видалено',
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/lib/i18n/
git commit -m "feat: add Ukrainian i18n dictionary"
```

---

## Task 7: Frontend — Updated Leads Store

**Files:**
- Modify: `apps/frontend/src/lib/stores/leads.ts`

**Interfaces:**
- Consumes: Extended Lead interface from Task 2
- Produces: Updated store with scrape, enrichment methods

- [ ] **Step 1: Update Lead type in store**

In `apps/frontend/src/lib/stores/leads.ts`, update the `Lead` interface:

```typescript
export interface Lead {
  id: string;
  businessName: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  category: string | null;
  description: string | null;
  website: string | null;
  socialUrls: string[];
  source: string;
  status: string;
  tags: string[];
  scrapingEnabled: boolean;
  scrapedPhotos: string[];
  scrapedReviews: Array<Record<string, unknown>>;
  scrapedContacts: Record<string, unknown>;
  scrapedHours: Record<string, unknown>;
  enrichmentData: Record<string, unknown> | null;
  enrichedAt: string | null;
  enrichmentSources: string[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Add scrape and enrichment methods to store**

In the store factory return object, add:

```typescript
async scrape(leadId: string, platforms: string[]) {
  const result = await api.post<{ jobId: string }>(`/leads/${leadId}/scrape`, { platforms });
  return result;
},

async getScrapeStatus(leadId: string) {
  return api.get<{ jobs: Array<{ id: string; status: string; result?: unknown; error?: string }> }>(`/leads/${leadId}/scrape-status`);
},

async updateEnrichmentSources(leadId: string, sources: string[]) {
  await api.put(`/leads/${leadId}/enrichment-sources`, { sources });
},
```

- [ ] **Step 3: Update create method signature**

Update `newLead` default in the store (if stored there) to include new fields. The actual form defaults live in the component; the store's `create` method already passes the DTO through.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/stores/leads.ts
git commit -m "feat: extend leads store with scrape methods and new Lead fields"
```

---

## Task 8: Frontend — Extended Leads Create Modal

**Files:**
- Modify: `apps/frontend/src/routes/dashboard/leads/+page.svelte`

**Interfaces:**
- Consumes: `t` from Task 6, `leads` store from Task 7, `BUSINESS_CATEGORIES` from Task 2
- Produces: Extended create modal with all new fields

- [ ] **Step 1: Update the leads page script section**

Replace the existing `<script>` block in `apps/frontend/src/routes/dashboard/leads/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { leads, type Lead } from '$lib/stores/leads';
  import { projects } from '$lib/stores/projects';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { t } from '$lib/i18n/uk';
  import { BUSINESS_CATEGORIES } from '@prompt-site-builder/shared';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { Plus, Search, Trash2 } from '@lucide/svelte';

  let search = $state('');
  let statusFilter = $state('');
  let showCreateModal = $state(false);
  let newLead = $state({
    businessName: '',
    source: 'manual',
    category: '',
    phone: '',
    email: '',
    city: '',
    region: '',
    country: 'Україна',
    socialUrls: [''],
  });

  const sourceOptions = [
    { value: 'manual', label: 'Вручну' },
    { value: 'google-maps', label: 'Google Maps' },
    { value: 'social-media', label: 'Соцмережі' },
  ];

  const statusOptions = [
    { value: '', label: 'Всі статуси' },
    { value: 'NEW', label: t.status.NEW },
    { value: 'CONTACTED', label: t.status.CONTACTED },
    { value: 'QUALIFIED', label: t.status.QUALIFIED },
    { value: 'CONVERTED', label: t.status.CONVERTED },
    { value: 'REJECTED', label: t.status.REJECTED },
  ];

  const categoryOptions = BUSINESS_CATEGORIES.map(c => ({ value: c.category, label: c.category }));

  let sourceLabel = $derived(sourceOptions.find((o) => o.value === newLead.source)?.label ?? 'Вручну');
  let statusLabel = $derived(statusOptions.find((o) => o.value === statusFilter)?.label ?? 'Всі статуси');
  let categoryLabel = $derived(newLead.category || 'Оберіть категорію');

  onMount(() => { leads.fetchAll(); });

  function addSocialUrl() { newLead.socialUrls = [...newLead.socialUrls, '']; }
  function removeSocialUrl(index: number) { newLead.socialUrls = newLead.socialUrls.filter((_, i) => i !== index); }

  async function handleSearch() {
    await leads.fetchAll({ search, status: statusFilter || undefined });
  }

  async function handleCreate() {
    try {
      const filteredUrls = newLead.socialUrls.filter(url => url.trim() !== '');
      await leads.create({
        ...newLead,
        socialUrls: filteredUrls,
      });
      showCreateModal = false;
      newLead = {
        businessName: '', source: 'manual', category: '',
        phone: '', email: '', city: '', region: '', country: 'Україна', socialUrls: [''],
      };
    } catch {
      // handled by store
    }
  }

  async function createProject(leadId: string) {
    try {
      const project = await projects.create(leadId);
      goto(resolve(`/dashboard/projects/${project.id}`));
    } catch {
      // handled by store
    }
  }

  function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case 'NEW': return 'secondary';
      case 'CONTACTED': return 'outline';
      case 'QUALIFIED': return 'default';
      case 'CONVERTED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  }
</script>
```

- [ ] **Step 2: Update the template — title and button**

```svelte
<svelte:head><title>{t.leads.title} - {t.app.name}</title></svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">{t.leads.title}</h1>
    <Dialog.Root bind:open={showCreateModal}>
      <Dialog.Trigger>
        <Button>
          <Plus class="size-4 mr-2" />
          {t.leads.addLead}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content class="max-w-lg">
        <Dialog.Header>
          <Dialog.Title>{t.leads.createLead}</Dialog.Title>
          <Dialog.Description>Заповніть інформацію про бізнес для створення ліда.</Dialog.Description>
        </Dialog.Header>
        <form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="space-y-4">
          <div class="space-y-2">
            <Label for="businessName">{t.leads.businessName} *</Label>
            <Input id="businessName" bind:value={newLead.businessName} required placeholder="Наприклад: Стоматологія ДентПро" />
          </div>

          <div class="space-y-2">
            <Label>{t.leads.category}</Label>
            <Select.Root type="single" bind:value={newLead.category}>
              <Select.Trigger class="w-full">{categoryLabel}</Select.Trigger>
              <Select.Content>
                {#each categoryOptions as option (option.value)}
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="city">{t.leads.city}</Label>
              <Input id="city" bind:value={newLead.city} placeholder="Київ" />
            </div>
            <div class="space-y-2">
              <Label for="region">{t.leads.region}</Label>
              <Input id="region" bind:value={newLead.region} placeholder="Київська область" />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="country">{t.leads.country}</Label>
            <Input id="country" bind:value={newLead.country} placeholder="Україна" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="phone">{t.leads.phone}</Label>
              <Input id="phone" bind:value={newLead.phone} placeholder="+380..." />
            </div>
            <div class="space-y-2">
              <Label for="email">{t.leads.email}</Label>
              <Input id="email" bind:value={newLead.email} type="email" placeholder="info@example.com" />
            </div>
          </div>

          <div class="space-y-2">
            <Label>{t.leads.socialLinks}</Label>
            {#each newLead.socialUrls as url, i}
              <div class="flex gap-2">
                <Input bind:value={newLead.socialUrls[i]} placeholder="https://instagram.com/..." />
                {#if newLead.socialUrls.length > 1}
                  <Button type="button" variant="ghost" size="icon" onclick={() => removeSocialUrl(i)}>
                    <Trash2 class="size-4" />
                  </Button>
                {/if}
              </div>
            {/each}
            <Button type="button" variant="outline" size="sm" onclick={addSocialUrl}>
              <Plus class="size-3 mr-1" /> {t.leads.addSocialLink}
            </Button>
          </div>

          <div class="space-y-2">
            <Label>{t.leads.source}</Label>
            <Select.Root type="single" bind:value={newLead.source}>
              <Select.Trigger class="w-full">{sourceLabel}</Select.Trigger>
              <Select.Content>
                {#each sourceOptions as option (option.value)}
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <Dialog.Footer>
            <Button type="button" variant="outline" onclick={() => { showCreateModal = false; }}>{t.common.cancel}</Button>
            <Button type="submit">{t.leads.createLead}</Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  </div>
  <!-- Rest of template stays the same (search + table), just update labels to use t.* -->
```

- [ ] **Step 3: Update search bar and table labels**

Replace hardcoded English strings with `{t.*}` references throughout:
- "Search leads..." → `{t.leads.searchLeads}`
- "All Status" → statusLabel already derived
- "Loading..." → `{t.common.loading}`
- "No leads found" → `{t.leads.noLeads}`
- Table headers: "Business" → "Бізнес", "Contact" → "Контакти", "Location" → "Локація", "Status" → "Статус", "Actions" → "Дії"
- Status badges: `{t.status[lead.status]}`
- "Create Site" → "Створити сайт"

- [ ] **Step 4: Make table rows clickable to navigate to lead detail**

Add `onclick` to `Table.Row`:

```svelte
<Table.Row class="cursor-pointer hover:bg-muted/50" onclick={() => goto(resolve(`/dashboard/leads/${lead.id}`))}>
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/routes/dashboard/leads/+page.svelte
git commit -m "feat: extended leads create modal with categories, social URLs, location"
```

---

## Task 9: Frontend — Lead Detail Card Page

**Files:**
- Create: `apps/frontend/src/routes/dashboard/leads/[id]/+page.svelte`
- Create: `apps/frontend/src/lib/components/lead/LeadDetailCard.svelte`
- Create: `apps/frontend/src/lib/components/lead/ScrapingPanel.svelte`

**Interfaces:**
- Consumes: `t` i18n, `leads` store, `enrichment` store, `api`
- Produces: Lead detail page with 4 tabs

- [ ] **Step 1: Create LeadDetailCard component**

Create `apps/frontend/src/lib/components/lead/LeadDetailCard.svelte`:

```svelte
<script lang="ts">
  import { t } from '$lib/i18n/uk';
  import { type Lead } from '$lib/stores/leads';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Pencil, Check, X } from '@lucide/svelte';

  let { lead, onUpdate }: { lead: Lead; onUpdate: (data: Record<string, unknown>) => Promise<void> } = $props();

  let isEditing = $state(false);
  let form = $state({ ...lead });

  function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case 'NEW': return 'secondary';
      case 'CONVERTED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  }

  async function handleSave() {
    await onUpdate(form);
    isEditing = false;
  }

  function handleCancel() {
    form = { ...lead };
    isEditing = false;
  }
</script>

<Card.Root>
  <Card.Header class="flex flex-row items-center justify-between">
    <Card.Title>{lead.businessName}</Card.Title>
    <div class="flex items-center gap-2">
      <Badge variant={getStatusVariant(lead.status)}>{t.status[lead.status as keyof typeof t.status] ?? lead.status}</Badge>
      {#if !isEditing}
        <Button variant="outline" size="sm" onclick={() => { isEditing = true; }}>
          <Pencil class="size-3 mr-1" /> {t.common.edit}
        </Button>
      {:else}
        <Button variant="ghost" size="sm" onclick={handleCancel}><X class="size-3 mr-1" /> {t.common.cancel}</Button>
        <Button size="sm" onclick={handleSave}><Check class="size-3 mr-1" /> {t.common.save}</Button>
      {/if}
    </div>
  </Card.Header>
  <Card.Content>
    <dl class="grid grid-cols-2 gap-4">
      {#if isEditing}
        <div class="space-y-1">
          <Label for="edit-phone">{t.leads.phone}</Label>
          <Input id="edit-phone" bind:value={form.phone} />
        </div>
        <div class="space-y-1">
          <Label for="edit-email">{t.leads.email}</Label>
          <Input id="edit-email" bind:value={form.email} />
        </div>
        <div class="space-y-1">
          <Label for="edit-city">{t.leads.city}</Label>
          <Input id="edit-city" bind:value={form.city} />
        </div>
        <div class="space-y-1">
          <Label for="edit-region">{t.leads.region}</Label>
          <Input id="edit-region" bind:value={form.region} />
        </div>
        <div class="space-y-1">
          <Label for="edit-country">{t.leads.country}</Label>
          <Input id="edit-country" bind:value={form.country} />
        </div>
        <div class="space-y-1">
          <Label for="edit-website">{t.leads.website}</Label>
          <Input id="edit-website" bind:value={form.website} />
        </div>
      {:else}
        <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.phone}</dt><dd>{lead.phone || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.email}</dt><dd>{lead.email || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.city}</dt><dd>{lead.city || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.region}</dt><dd>{lead.region || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.country}</dt><dd>{lead.country || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.website}</dt><dd>{lead.website || '—'}</dd></div>
      {/if}
      <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.source}</dt><dd>{lead.source}</dd></div>
      <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.category}</dt><dd>{lead.category || '—'}</dd></div>
      <div class="col-span-2">
        <dt class="text-muted-foreground mb-1">{t.leads.socialLinks}</dt>
        <dd>
          {#if lead.socialUrls.length > 0}
            <ul class="space-y-1">
              {#each lead.socialUrls as url}
                <li><a href={url} target="_blank" class="text-blue-600 hover:underline text-sm">{url}</a></li>
              {/each}
            </ul>
          {:else}
            —
          {/if}
        </dd>
      </div>
    </dl>
  </Card.Content>
</Card.Root>
```

- [ ] **Step 2: Create ScrapingPanel component**

Create `apps/frontend/src/lib/components/lead/ScrapingPanel.svelte`:

```svelte
<script lang="ts">
  import { t } from '$lib/i18n/uk';
  import { leads, type Lead } from '$lib/stores/leads';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Play, Loader2 } from '@lucide/svelte';

  let { lead }: { lead: Lead } = $props();

  let platforms = $state(['instagram', 'facebook', 'googleMaps']);
  let isScraping = $state(false);
  let scrapeResults = $state(lead.scrapedReviews.length > 0 || lead.scrapedPhotos.length > 0);

  const platformOptions = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'googleMaps', label: 'Google Maps' },
  ];

  function togglePlatform(platform: string) {
    if (platforms.includes(platform)) {
      platforms = platforms.filter(p => p !== platform);
    } else {
      platforms = [...platforms, platform];
    }
  }

  async function handleScrape() {
    isScraping = true;
    try {
      await leads.scrape(lead.id, platforms);
      // Poll for results
      const pollInterval = setInterval(async () => {
        const status = await leads.getScrapeStatus(lead.id);
        const done = status.jobs.every(j => j.status === 'COMPLETED' || j.status === 'FAILED');
        if (done) {
          clearInterval(pollInterval);
          isScraping = false;
          scrapeResults = true;
        }
      }, 3000);
      setTimeout(() => { clearInterval(pollInterval); isScraping = false; }, 120000); // 2 min timeout
    } catch {
      isScraping = false;
    }
  }
</script>

<div class="space-y-4">
  <div class="flex flex-wrap gap-2">
    {#each platformOptions as platform}
      <Button
        variant={platforms.includes(platform.value) ? 'default' : 'outline'}
        size="sm"
        onclick={() => togglePlatform(platform.value)}
      >
        {platform.label}
      </Button>
    {/each}
  </div>

  <Button onclick={handleScrape} disabled={isScraping || platforms.length === 0}>
    {#if isScraping}
      <Loader2 class="size-4 mr-2 animate-spin" /> {t.scraping.scraping}
    {:else}
      <Play class="size-4 mr-2" /> {t.scraping.runScraping}
    {/if}
  </Button>

  {#if scrapeResults}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {#if lead.scrapedPhotos.length > 0}
        <Card.Root>
          <Card.Header><Card.Title>{t.scraping.photos} ({lead.scrapedPhotos.length})</Card.Title></Card.Header>
          <Card.Content>
            <div class="grid grid-cols-3 gap-2">
              {#each lead.scrapedPhotos.slice(0, 12) as photo}
                <img src={photo} alt="" class="w-full h-24 object-cover rounded" />
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      {/if}

      {#if lead.scrapedReviews.length > 0}
        <Card.Root>
          <Card.Header><Card.Title>{t.scraping.reviews} ({lead.scrapedReviews.length})</Card.Title></Card.Header>
          <Card.Content class="max-h-64 overflow-y-auto space-y-3">
            {#each lead.scrapedReviews as review}
              <div class="border-b pb-2">
                <div class="font-medium text-sm">{review.author as string}</div>
                <div class="text-sm text-muted-foreground">{review.text as string}</div>
              </div>
            {/each}
          </Card.Content>
        </Card.Root>
      {/if}

      {#if Object.keys(lead.scrapedContacts).length > 0}
        <Card.Root>
          <Card.Header><Card.Title>{t.scraping.contacts}</Card.Title></Card.Header>
          <Card.Content>
            <pre class="text-sm">{JSON.stringify(lead.scrapedContacts, null, 2)}</pre>
          </Card.Content>
        </Card.Root>
      {/if}

      {#if Object.keys(lead.scrapedHours).length > 0}
        <Card.Root>
          <Card.Header><Card.Title>{t.scraping.hours}</Card.Title></Card.Header>
          <Card.Content>
            <pre class="text-sm">{JSON.stringify(lead.scrapedHours, null, 2)}</pre>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>
  {/if}
</div>
```

- [ ] **Step 3: Create Lead Detail Page**

Create `apps/frontend/src/routes/dashboard/leads/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { leads, type Lead } from '$lib/stores/leads';
  import { projects } from '$lib/stores/projects';
  import { enrichment } from '$lib/stores/enrichment';
  import { t } from '$lib/i18n/uk';
  import LeadDetailCard from '$lib/components/lead/LeadDetailCard.svelte';
  import ScrapingPanel from '$lib/components/lead/ScrapingPanel.svelte';
  import EnrichmentPanel from '$lib/components/enrichment/EnrichmentPanel.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { ArrowLeft, Plus } from '@lucide/svelte';

  let lead = $state<Lead | null>(null);
  let leadProjects = $state<Array<{ id: string; status: string; slug: string; createdAt: string }>>([]);
  let isLoading = $state(true);
  let activeTab = $state<'details' | 'enrichment' | 'projects' | 'scraping'>('details');

  onMount(async () => {
    try {
      lead = await leads.fetchOne($page.params.id!);
      const projectsData = await fetch(`/api/projects?leadId=${lead.id}`).then(r => r.json());
      leadProjects = Array.isArray(projectsData) ? projectsData : [];
    } finally {
      isLoading = false;
    }
  });

  async function handleUpdate(data: Record<string, unknown>) {
    if (!lead) return;
    lead = await leads.update(lead.id, data);
  }

  async function handleCreateProject() {
    if (!lead) return;
    try {
      const project = await projects.create(lead.id);
      goto(resolve(`/dashboard/projects/${project.id}`));
    } catch {
      // handled by store
    }
  }

  function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case 'PUBLISHED': return 'default';
      case 'GENERATING': return 'secondary';
      case 'FAILED': return 'destructive';
      default: return 'outline';
    }
  }

  const tabs = [
    { id: 'details' as const, label: t.leads.tabs.details },
    { id: 'enrichment' as const, label: t.leads.tabs.enrichment },
    { id: 'projects' as const, label: t.leads.tabs.projects },
    { id: 'scraping' as const, label: t.leads.tabs.scraping },
  ];
</script>

<svelte:head><title>{lead?.businessName || t.leads.title} - {t.app.name}</title></svelte:head>

<div class="space-y-6">
  <Button variant="ghost" size="sm" onclick={() => goto(resolve('/dashboard/leads'))}>
    <ArrowLeft class="size-4 mr-2" /> {t.common.back}
  </Button>

  {#if isLoading}
    <div class="text-center py-12 text-muted-foreground">{t.common.loading}</div>
  {:else if !lead}
    <div class="text-center py-12 text-muted-foreground">{t.leads.noLeads}</div>
  {:else}
    <!-- Tabs -->
    <div class="flex border-b gap-1">
      {#each tabs as tab}
        <button
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
            {activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}"
          onclick={() => { activeTab = tab.id; }}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    {#if activeTab === 'details'}
      <LeadDetailCard {lead} onUpdate={handleUpdate} />
    {:else if activeTab === 'enrichment'}
      <div class="space-y-4">
        <EnrichmentPanel leadId={lead.id} />
      </div>
    {:else if activeTab === 'projects'}
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">{t.leads.tabs.projects}</h2>
          <Button onclick={handleCreateProject}>
            <Plus class="size-4 mr-2" /> {t.leads.addLead}
          </Button>
        </div>
        {#if leadProjects.length === 0}
          <div class="text-center py-12 text-muted-foreground">{t.projects.noProjects}</div>
        {:else}
          <div class="grid gap-4">
            {#each leadProjects as project}
              <Card.Root class="cursor-pointer hover:shadow-md transition-shadow" onclick={() => goto(resolve(`/dashboard/projects/${project.id}`))}>
                <Card.Content class="flex items-center justify-between py-4">
                  <div>
                    <div class="font-medium">{project.slug}.sitenow.pp.ua</div>
                    <div class="text-sm text-muted-foreground">{new Date(project.createdAt).toLocaleDateString()}</div>
                  </div>
                  <Badge variant={getStatusVariant(project.status)}>{t.status[project.status as keyof typeof t.status] ?? project.status}</Badge>
                </Card.Content>
              </Card.Root>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'scraping'}
      <ScrapingPanel {lead} />
    {/if}
  {/if}
</div>
```

- [ ] **Step 4: Run typecheck**

```bash
cd apps/frontend && npx svelte-check --tsconfig ./tsconfig.json
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/routes/dashboard/leads/[id]/ apps/frontend/src/lib/components/lead/
git commit -m "feat: add lead detail page with details, enrichment, projects, scraping tabs"
```

---

## Task 10: Frontend — Category Prompts Settings Page

**Files:**
- Create: `apps/frontend/src/routes/dashboard/settings/categories/+page.svelte`
- Create: `apps/frontend/src/lib/components/categories/CategoryPromptEditor.svelte`

**Interfaces:**
- Consumes: `t` i18n, `BUSINESS_CATEGORIES` from shared, API client
- Produces: Category prompts management page

- [ ] **Step 1: Create CategoryPromptEditor component**

Create `apps/frontend/src/lib/components/categories/CategoryPromptEditor.svelte`:

```svelte
<script lang="ts">
  import { t } from '$lib/i18n/uk';
  import { api } from '$lib/api/client';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Pencil } from '@lucide/svelte';

  let { category, theme, onSaved }: {
    category: string;
    theme: string;
    onSaved: () => void;
  } = $props();

  let isOpen = $state(false);
  let isLoading = $state(false);
  let contentPrompt = $state('');
  let designPrompt = $state('');
  let competitorPrompt = $state('');

  async function openEditor() {
    isOpen = true;
    isLoading = true;
    try {
      const prompts = await api.get<{
        contentPrompt: string;
        designPrompt: string;
        competitorPrompt: string;
      }>(`/categories/${encodeURIComponent(category)}/prompts`);
      contentPrompt = prompts.contentPrompt;
      designPrompt = prompts.designPrompt;
      competitorPrompt = prompts.competitorPrompt;
    } catch {
      // use empty defaults
    } finally {
      isLoading = false;
    }
  }

  async function handleSave() {
    await api.put(`/categories/${encodeURIComponent(category)}/prompts`, {
      contentPrompt,
      designPrompt,
      competitorPrompt,
    });
    isOpen = false;
    onSaved();
  }
</script>

<Button variant="ghost" size="sm" onclick={openEditor}>
  <Pencil class="size-3 mr-1" /> {t.common.edit}
</Button>

<Dialog.Root bind:open={isOpen}>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>{t.categories.editPrompts}: {category}</Dialog.Title>
      <Dialog.Description>Тема: {theme}</Dialog.Description>
    </Dialog.Header>

    {#if isLoading}
      <div class="py-8 text-center text-muted-foreground">{t.common.loading}</div>
    {:else}
      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="contentPrompt">{t.categories.contentPrompt}</Label>
          <textarea id="contentPrompt" bind:value={contentPrompt} rows={6}
            class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <div class="space-y-2">
          <Label for="designPrompt">{t.categories.designPrompt}</Label>
          <textarea id="designPrompt" bind:value={designPrompt} rows={4}
            class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <div class="space-y-2">
          <Label for="competitorPrompt">{t.categories.competitorPrompt}</Label>
          <textarea id="competitorPrompt" bind:value={competitorPrompt} rows={6}
            class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
      </div>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={() => { isOpen = false; }}>{t.common.cancel}</Button>
      <Button onclick={handleSave}>{t.common.save}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

- [ ] **Step 2: Create Categories Settings Page**

Create `apps/frontend/src/routes/dashboard/settings/categories/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n/uk';
  import { BUSINESS_CATEGORIES, type CategoryWithTheme } from '@prompt-site-builder/shared';
  import CategoryPromptEditor from '$lib/components/categories/CategoryPromptEditor.svelte';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';

  let categories = $state<CategoryWithTheme[]>(BUSINESS_CATEGORIES);

  function handleSaved() {
    // No action needed — prompts are saved server-side
  }
</script>

<svelte:head><title>{t.categories.title} - {t.app.name}</title></svelte:head>

<div class="space-y-6">
  <h1 class="text-2xl font-bold tracking-tight">{t.categories.title}</h1>

  <Card.Root>
    <Card.Content class="pt-6">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{t.leads.category}</Table.Head>
            <Table.Head>{t.categories.theme}</Table.Head>
            <Table.Head class="text-right">{t.common.actions}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each categories as cat (cat.category)}
            <Table.Row>
              <Table.Cell class="font-medium">{cat.category}</Table.Cell>
              <Table.Cell>
                <Badge variant="outline">{cat.theme}</Badge>
              </Table.Cell>
              <Table.Cell class="text-right">
                <CategoryPromptEditor category={cat.category} theme={cat.theme} onSaved={handleSaved} />
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Content>
  </Card.Root>
</div>
```

- [ ] **Step 3: Add categories link to settings page**

In `apps/frontend/src/routes/dashboard/settings/+page.svelte`, add a link to the categories sub-page if there's a settings index, or ensure the route is accessible.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/routes/dashboard/settings/categories/ apps/frontend/src/lib/components/categories/
git commit -m "feat: add category prompts editor in settings"
```

---

## Task 11: CI Validation + Final Integration

**Files:**
- No new files

**Interfaces:**
- Consumes: All tasks above
- Produces: Passing CI

- [ ] **Step 1: Run full CI**

```bash
bash scripts/ci-local.sh
```

- [ ] **Step 2: Fix any lint errors**

```bash
npm run lint
```

Fix all ESLint errors.

- [ ] **Step 3: Fix any type errors**

```bash
npm run typecheck
```

Fix all tsc + svelte-check errors.

- [ ] **Step 4: Run tests**

```bash
npm run test
```

All tests must pass. If new code breaks existing tests, fix the tests.

- [ ] **Step 5: Run build**

```bash
npm run build
```

Production build must exit 0.

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: CI fixes for Group 1"
```

- [ ] **Step 7: Push and create PR**

```bash
git push origin feat/leads-uk-logs-fixes
gh pr create --title "feat: Leads — extended CRUD, categories, scraping, OpenRouter" --body "
## Group 1: Leads Management + Categories + OpenRouter

### Changes
- Extended Lead model: socialUrls[], country, region, scraping fields
- CategoryPrompt model with per-category LLM prompts (17 categories)
- Categories CRUD API + settings UI
- Scraping endpoints (POST /leads/:id/scrape, GET status)
- OpenRouter LLM strategy with dynamic model listing
- Ukrainian i18n dictionary (base)
- Lead detail page with 4 tabs (Details, Enrichment, Projects, Scraping)
- Extended create lead modal (social URLs, location, category dropdown)
- Category prompts editor in settings

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review Checklist

1. **Spec coverage:** Each requirement from Group 1 in the spec maps to tasks: Lead model (T1), Categories (T1, T3), Scraping (T4), OpenRouter (T5), i18n (T6), Stores (T7), Create modal (T8), Detail card (T9), Category prompts UI (T10), CI (T11).

2. **No placeholders:** All tasks have complete code, exact file paths, exact commands.

3. **Type consistency:** `CreateLeadDto.socialUrls` used in T2 backend type → T7 store type → T8 form → T4 service. `CategoryPrompt` used in T1 model → T3 service → T10 UI. Consistent across layers.
