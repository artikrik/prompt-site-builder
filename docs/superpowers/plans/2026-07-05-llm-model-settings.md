# LLM Model Expansion + WebUI Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand LLM models from 4+1 to 10+4 across 6 providers, add DB-backed settings with encryption, WebUI settings page with API keys + model selection, per-lead payment/booking config.

**Architecture:** Key/value `Setting` DB table (already exists) becomes primary config source with env fallback. New `EncryptionService` for API key encryption (AES-256-GCM). Static `MODEL_REGISTRY` in shared package. Three new strategies (Gemini, Imagen, Flux). Per-lead payment/booking fields on `Lead` model. Frontend: Svelte 5 runes, cascading provider→model dropdowns, masked API key inputs.

**Tech Stack:** NestJS 11, Prisma, SvelteKit 2 + Svelte 5 runes, Vitest, Playwright, OpenAI SDK, Anthropic SDK

## Global Constraints

- All existing tests must continue passing
- Backend 112 tests, frontend 17 tests — no regressions
- CI pipeline: `lint` → `typecheck` → `test` → `build` — all must pass
- Caveman mode for communication, RTK prefix for all shell commands
- TDD: write failing test first, then implement
- Immutability: never mutate existing objects, always create new
- Files: max 800 lines, functions max 50 lines
- API keys in DB must be AES-256-GCM encrypted
- ENCRYPTION_KEY only in `.env`, never in DB
- Env vars remain as fallback after DB migration
- Svelte 5 runes: `$state`, `$derived`, `onMount` — no Svelte 4 stores

---

### Task 1: Model Registry — Shared Types + Constants

**Files:**
- Create: `packages/shared/src/types/models.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `ContentModel`, `ImageModel`, `MODEL_REGISTRY`, `getModelsByProvider(provider)`, `getDefaultModel(provider, type)`

- [ ] **Step 1: Write the model registry types and data**

```typescript
// packages/shared/src/types/models.ts

export interface ContentModel {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'mimo';
  label: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  role: string;
}

export interface ImageModel {
  id: string;
  provider: 'openai' | 'google' | 'bfl';
  label: string;
  pricePerImage: string;
  role: string;
}

export type ContentProvider = ContentModel['provider'];
export type ImageProvider = ImageModel['provider'];

export const MODEL_REGISTRY = {
  content: [
    { id: 'gpt-4.1', provider: 'openai', label: 'GPT-4.1', inputPrice: 2.00, outputPrice: 8.00, contextWindow: 1_000_000, role: 'Новий флагман' },
    { id: 'gpt-4o', provider: 'openai', label: 'GPT-4o', inputPrice: 2.50, outputPrice: 10.00, contextWindow: 128_000, role: 'Флагман' },
    { id: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o Mini', inputPrice: 0.15, outputPrice: 0.60, contextWindow: 128_000, role: 'Економ' },
    { id: 'claude-opus-4', provider: 'anthropic', label: 'Claude Opus 4', inputPrice: 15.00, outputPrice: 75.00, contextWindow: 200_000, role: 'Макс. якість' },
    { id: 'claude-sonnet-4', provider: 'anthropic', label: 'Claude Sonnet 4', inputPrice: 3.00, outputPrice: 15.00, contextWindow: 200_000, role: 'Преміум якість' },
    { id: 'claude-haiku-4-5', provider: 'anthropic', label: 'Claude Haiku 4.5', inputPrice: 0.80, outputPrice: 4.00, contextWindow: 200_000, role: 'Економ' },
    { id: 'gemini-2.5-pro', provider: 'google', label: 'Gemini 2.5 Pro', inputPrice: 1.25, outputPrice: 10.00, contextWindow: 1_000_000, role: 'Дешевий флагман' },
    { id: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash', inputPrice: 0.15, outputPrice: 0.60, contextWindow: 1_000_000, role: 'Найдешевший' },
    { id: 'deepseek-chat', provider: 'deepseek', label: 'DeepSeek Chat', inputPrice: 0.27, outputPrice: 1.10, contextWindow: 128_000, role: 'Бюджет' },
    { id: 'mimo-v2.5', provider: 'mimo', label: 'MiMo v2.5', inputPrice: 0.14, outputPrice: 0.28, contextWindow: 1_000_000, role: 'Найдешевший + multimodal' },
  ],
  image: [
    { id: 'gpt-image-1', provider: 'openai', label: 'GPT-image-1', pricePerImage: '0.02–0.12', role: 'Новий OpenAI image' },
    { id: 'dall-e-3', provider: 'openai', label: 'DALL-E 3', pricePerImage: '0.04–0.08', role: 'Поточний default' },
    { id: 'imagen-4', provider: 'google', label: 'Imagen 4', pricePerImage: '0.02–0.04', role: 'Дешевий + якісний' },
    { id: 'flux-1-pro', provider: 'bfl', label: 'FLUX.1 Pro', pricePerImage: '0.05', role: 'Найкращий фотореалізм' },
  ],
} as const;

export function getModelsByProvider(provider: string, type: 'content' | 'image') {
  const models = MODEL_REGISTRY[type] as readonly (ContentModel | ImageModel)[];
  return models.filter((m) => m.provider === provider);
}

export function getDefaultModel(provider: string, type: 'content' | 'image'): string {
  const models = getModelsByProvider(provider, type);
  return models.length > 0 ? models[0].id : '';
}
```

- [ ] **Step 2: Export from shared barrel**

```typescript
// packages/shared/src/index.ts — add line:
export * from './types/models';
```

- [ ] **Step 3: Run typecheck to verify**

```bash
rtk turbo typecheck
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
rtk git add packages/shared/src/types/models.ts packages/shared/src/index.ts
rtk git commit -m "feat: add MODEL_REGISTRY with 10 content + 4 image models across 6 providers"
```

---

### Task 2: Prisma Migration — Lead Model Payment Fields

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (Lead model)
- Create: migration via `prisma migrate dev`

**Interfaces:**
- Produces: `Lead.easyweekEnabled`, `Lead.easyweekApiKey`, `Lead.wayforpayEnabled`, `Lead.wayforpayMerchant`, `Lead.wayforpaySecret`, `Lead.monobankEnabled`, `Lead.monobankApiKey`

- [ ] **Step 1: Add payment/booking fields to Lead model**

Edit `apps/backend/prisma/schema.prisma` — add after `scrapedData` line, before `createdAt`:

```prisma
model Lead {
  // ... existing fields ...
  scrapedData  Json       @default("{}")
  // Payment & Booking — per-lead config with individual API keys
  easyweekEnabled  Boolean  @default(false)
  easyweekApiKey   String?
  wayforpayEnabled Boolean  @default(false)
  wayforpayMerchant String?
  wayforpaySecret  String?
  monobankEnabled  Boolean  @default(false)
  monobankApiKey   String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  // ... rest unchanged ...
}
```

- [ ] **Step 2: Run migration**

```bash
cd apps/backend && rtk npx prisma migrate dev --name add_lead_payment_fields
```
Expected: migration created and applied successfully

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd apps/backend && rtk npx prisma generate
```
Expected: client regenerated without errors

- [ ] **Step 4: Verify migration with typecheck**

```bash
rtk turbo typecheck
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
rtk git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
rtk git commit -m "feat: add payment/booking fields to Lead model (EasyWeek, WayForPay, Monobank)"
```

---

### Task 3: Encryption Service

**Files:**
- Create: `apps/backend/src/modules/settings/encryption.service.ts`
- Create: `apps/backend/src/modules/settings/encryption.service.spec.ts`

**Interfaces:**
- Consumes: `ENCRYPTION_KEY` from env/ConfigService
- Produces: `EncryptionService.encrypt(plaintext: string): string`, `EncryptionService.decrypt(ciphertext: string): string`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/backend/src/modules/settings/encryption.service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  describe('with ENCRYPTION_KEY set', () => {
    beforeEach(() => {
      service = new EncryptionService('my-secret-32-byte-key-here-ok');
    });

    it('should encrypt and decrypt a plaintext string', () => {
      const plaintext = 'sk-test-api-key-12345';
      const encrypted = service.encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':'); // format: iv:ciphertext:authTag
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'sk-test-key';
      const enc1 = service.encrypt(plaintext);
      const enc2 = service.encrypt(plaintext);
      expect(enc1).not.toBe(enc2);
      expect(service.decrypt(enc1)).toBe(plaintext);
      expect(service.decrypt(enc2)).toBe(plaintext);
    });

    it('should throw when decrypting with wrong key', () => {
      const encrypted = service.encrypt('test');
      const otherService = new EncryptionService('different-32-byte-key-here!!');
      expect(() => otherService.decrypt(encrypted)).toThrow();
    });

    it('should throw when decrypting invalid format', () => {
      expect(() => service.decrypt('not-valid-encrypted')).toThrow();
    });
  });

  describe('with empty ENCRYPTION_KEY (dev mode)', () => {
    beforeEach(() => {
      service = new EncryptionService('');
    });

    it('should return plaintext as-is on encrypt (no-op)', () => {
      const plaintext = 'sk-test';
      const result = service.encrypt(plaintext);
      expect(result).toBe(plaintext);
    });

    it('should return ciphertext as-is on decrypt (no-op)', () => {
      const result = service.decrypt('sk-test');
      expect(result).toBe('sk-test');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && rtk npx vitest run encryption.service.spec.ts
```
Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement EncryptionService**

```typescript
// apps/backend/src/modules/settings/encryption.service.ts
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class EncryptionService {
  private readonly key: Buffer | null;

  constructor(encryptionKey: string) {
    if (!encryptionKey) {
      this.key = null;
      return;
    }
    // Use SHA-256 to derive 32-byte key from any-length input
    const { createHash } = require('crypto');
    this.key = createHash('sha256').update(encryptionKey).digest();
  }

  encrypt(plaintext: string): string {
    if (!this.key) return plaintext; // dev mode no-op

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    if (!this.key) return ciphertext; // dev mode no-op

    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, encryptedHex, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/backend && rtk npx vitest run encryption.service.spec.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
rtk git add apps/backend/src/modules/settings/encryption.service.ts apps/backend/src/modules/settings/encryption.service.spec.ts
rtk git commit -m "feat: add EncryptionService — AES-256-GCM encrypt/decrypt for API keys"
```

---

### Task 4: Settings Repository

**Files:**
- Create: `apps/backend/src/modules/settings/settings.repository.ts`
- Create: `apps/backend/src/modules/settings/settings.repository.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`
- Produces: `SettingsRepository.findByKey(key)`, `SettingsRepository.upsert(key, value)`, `SettingsRepository.deleteByKey(key)`, `SettingsRepository.findAll()`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/backend/src/modules/settings/settings.repository.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsRepository } from './settings.repository';

describe('SettingsRepository', () => {
  let repo: SettingsRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      setting: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
      },
    };
    repo = new SettingsRepository(mockPrisma);
  });

  describe('findByKey', () => {
    it('should call prisma.setting.findUnique with correct key', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue({ key: 'llm_provider', value: 'openai' });
      const result = await repo.findByKey('llm_provider');
      expect(mockPrisma.setting.findUnique).toHaveBeenCalledWith({ where: { key: 'llm_provider' } });
      expect(result).toEqual({ key: 'llm_provider', value: 'openai' });
    });

    it('should return null when key not found', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);
      const result = await repo.findByKey('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should call prisma.setting.upsert with key and value', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({ key: 'test_key', value: 'test_value' });
      const result = await repo.upsert('test_key', 'test_value');
      expect(mockPrisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: 'test_key' },
        update: { value: 'test_value' },
        create: { key: 'test_key', value: 'test_value' },
      });
      expect(result).toEqual({ key: 'test_key', value: 'test_value' });
    });
  });

  describe('findAll', () => {
    it('should return all settings', async () => {
      const mockSettings = [
        { key: 'llm_provider', value: 'openai' },
        { key: 'llm_model', value: 'gpt-4o' },
      ];
      mockPrisma.setting.findMany.mockResolvedValue(mockSettings);
      const result = await repo.findAll();
      expect(result).toEqual(mockSettings);
    });
  });

  describe('deleteByKey', () => {
    it('should call prisma.setting.delete with correct key', async () => {
      await repo.deleteByKey('test_key');
      expect(mockPrisma.setting.delete).toHaveBeenCalledWith({ where: { key: 'test_key' } });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && rtk npx vitest run settings.repository.spec.ts
```
Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement SettingsRepository**

```typescript
// apps/backend/src/modules/settings/settings.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByKey(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  async upsert(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async findAll() {
    return this.prisma.setting.findMany();
  }

  async deleteByKey(key: string) {
    return this.prisma.setting.delete({ where: { key } });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/backend && rtk npx vitest run settings.repository.spec.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
rtk git add apps/backend/src/modules/settings/settings.repository.ts apps/backend/src/modules/settings/settings.repository.spec.ts
rtk git commit -m "feat: add SettingsRepository — Prisma CRUD for Setting table"
```

---

### Task 5: Update Shared Types — AppSettings + Lead DTOs

**Files:**
- Create: `packages/shared/src/types/settings.ts`
- Modify: `packages/shared/src/types/lead.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `AppSettings` interface, `UpdateSettingsDto`, `SettingsResponse`, `Lead` (updated with payment fields), `UpdateLeadDto` (updated)

- [ ] **Step 1: Create AppSettings shared type**

```typescript
// packages/shared/src/types/settings.ts
import type { ContentProvider, ImageProvider } from './models';

export interface AppSettings {
  llmProvider: ContentProvider;
  llmModel: string;
  imageProvider: ImageProvider;
  imageModel: string;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  googleApiKey: string | null;
  deepseekApiKey: string | null;
  mimoApiKey: string | null;
  bflApiKey: string | null;
  easyweekEnabled: boolean;
  easyweekApiKey: string | null;
  wayforpayEnabled: boolean;
  wayforpayMerchant: string | null;
  wayforpaySecret: string | null;
  monobankEnabled: boolean;
  monobankApiKey: string | null;
}

export interface UpdateSettingsDto {
  llmProvider?: string;
  llmModel?: string;
  imageProvider?: string;
  imageModel?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  deepseekApiKey?: string;
  mimoApiKey?: string;
  bflApiKey?: string;
}

export interface SettingsResponse {
  settings: AppSettings;
  source: Record<string, 'db' | 'env' | 'default'>;
}

export interface SettingsModelsResponse {
  content: Array<{
    id: string;
    provider: string;
    label: string;
    inputPrice: number;
    outputPrice: number;
    contextWindow: number;
    role: string;
  }>;
  image: Array<{
    id: string;
    provider: string;
    label: string;
    pricePerImage: string;
    role: string;
  }>;
}
```

- [ ] **Step 2: Update Lead types with payment fields**

```typescript
// In packages/shared/src/types/lead.ts — add to Lead interface:
export interface Lead {
  // ... existing fields stay the same ...
  easyweekEnabled: boolean;
  easyweekApiKey: string | null;
  wayforpayEnabled: boolean;
  wayforpayMerchant: string | null;
  wayforpaySecret: string | null;
  monobankEnabled: boolean;
  monobankApiKey: string | null;
}

// Add to UpdateLeadDto:
export interface UpdateLeadDto {
  // ... existing fields stay the same ...
  easyweekEnabled?: boolean;
  easyweekApiKey?: string | null;
  wayforpayEnabled?: boolean;
  wayforpayMerchant?: string | null;
  wayforpaySecret?: string | null;
  monobankEnabled?: boolean;
  monobankApiKey?: string | null;
}
```

- [ ] **Step 3: Export from barrel**

```typescript
// packages/shared/src/index.ts — add:
export * from './types/settings';
```

- [ ] **Step 4: Run typecheck**

```bash
rtk turbo typecheck
```
Expected: 0 errors (may have downstream errors in settings.service.ts — expected, will fix in Task 6)

- [ ] **Step 5: Commit**

```bash
rtk git add packages/shared/
rtk git commit -m "feat: add shared AppSettings, UpdateSettingsDto + payment fields to Lead types"
```

---

### Task 6: Refactor SettingsService — DB-First with Env Fallback

**Files:**
- Modify: `apps/backend/src/modules/settings/settings.service.ts`
- Modify: `apps/backend/src/modules/settings/settings.service.spec.ts`

**Interfaces:**
- Consumes: `SettingsRepository`, `EncryptionService`, `ConfigService`
- Produces: `SettingsService.get(key, defaultValue?)`, `SettingsService.getSettings()`, `SettingsService.updateSettings(dto)`

- [ ] **Step 1: Rewrite settings.service.spec.ts**

```typescript
// apps/backend/src/modules/settings/settings.service.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let mockRepo: any;
  let mockEncryption: any;
  let mockConfig: any;

  beforeEach(() => {
    mockRepo = {
      findByKey: vi.fn(),
      upsert: vi.fn(),
      findAll: vi.fn(),
    };
    mockEncryption = {
      encrypt: vi.fn((v: string) => `enc_${v}`),
      decrypt: vi.fn((v: string) => v.startsWith('enc_') ? v.slice(4) : v),
    };
    // Mock env vars for fallback testing
    const env: Record<string, string> = {
      LLM_PROVIDER: 'anthropic',
      OPENAI_API_KEY: 'sk-env-key',
    };
    mockConfig = {
      get: vi.fn((key: string) => env[key] ?? null),
    };
    service = new SettingsService(mockRepo, mockEncryption, mockConfig);
  });

  describe('get', () => {
    it('should return DB value when present', async () => {
      mockRepo.findByKey.mockResolvedValue({ key: 'llm_provider', value: 'openai' });
      const result = await service.get('llm_provider');
      expect(result.value).toBe('openai');
      expect(result.source).toBe('db');
    });

    it('should fallback to env when DB is null', async () => {
      mockRepo.findByKey.mockResolvedValue(null);
      const result = await service.get('llm_provider');
      expect(result.value).toBe('anthropic');
      expect(result.source).toBe('env');
    });

    it('should fallback to default when both DB and env are null', async () => {
      mockRepo.findByKey.mockResolvedValue(null);
      const result = await service.get('google_api_key');
      expect(result.value).toBeNull();
      expect(result.source).toBe('default');
    });

    it('should decrypt API key values from DB', async () => {
      mockRepo.findByKey.mockResolvedValue({ key: 'openai_api_key', value: 'enc_sk-db-key' });
      const result = await service.get('openai_api_key');
      expect(result.value).toBe('sk-db-key');
      expect(result.source).toBe('db');
    });

    it('should NOT decrypt plain config values from DB', async () => {
      mockRepo.findByKey.mockResolvedValue({ key: 'llm_provider', value: 'openai' });
      await service.get('llm_provider');
      expect(mockEncryption.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('getSettings', () => {
    it('should return full AppSettings with masked API keys', async () => {
      mockRepo.findAll.mockResolvedValue([
        { key: 'llm_provider', value: 'anthropic' },
        { key: 'openai_api_key', value: 'enc_sk-db-key' },
      ]);
      const result = await service.getSettings();
      expect(result.llmProvider).toBe('anthropic');
      expect(result.openaiApiKey).toBe('sk-...bKey');
    });
  });

  describe('updateSettings', () => {
    it('should encrypt API keys before saving to DB', async () => {
      await service.updateSettings({ openaiApiKey: 'sk-new-key', llmModel: 'gpt-4o-mini' });
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('sk-new-key');
      expect(mockRepo.upsert).toHaveBeenCalledWith('openai_api_key', 'enc_sk-new-key');
      expect(mockRepo.upsert).toHaveBeenCalledWith('llm_model', 'gpt-4o-mini');
    });

    it('should skip empty API key values', async () => {
      await service.updateSettings({ openaiApiKey: '', llmModel: 'gpt-4o' });
      expect(mockEncryption.encrypt).not.toHaveBeenCalled();
      expect(mockRepo.upsert).toHaveBeenCalledWith('llm_model', 'gpt-4o');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && rtk npx vitest run settings.service.spec.ts
```
Expected: FAIL — multiple failures

- [ ] **Step 3: Rewrite SettingsService**

```typescript
// apps/backend/src/modules/settings/settings.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsRepository } from './settings.repository';
import { EncryptionService } from './encryption.service';
import type { AppSettings, UpdateSettingsDto } from '@prompt-site-builder/shared';
import { getDefaultModel } from '@prompt-site-builder/shared';

const ENCRYPTED_KEYS = new Set([
  'openai_api_key', 'anthropic_api_key', 'google_api_key',
  'deepseek_api_key', 'mimo_api_key', 'bfl_api_key',
]);

const ENV_KEY_MAP: Record<string, string> = {
  openai_api_key: 'OPENAI_API_KEY',
  anthropic_api_key: 'ANTHROPIC_API_KEY',
  google_api_key: 'GOOGLE_API_KEY',
  deepseek_api_key: 'DEEPSEEK_API_KEY',
  mimo_api_key: 'MIMO_API_KEY',
  bfl_api_key: 'BFL_API_KEY',
  llm_provider: 'LLM_PROVIDER',
  image_provider: 'IMAGE_PROVIDER',
};

const DEFAULTS: Record<string, string | null> = {
  llm_provider: 'openai',
  image_provider: 'openai',
  llm_model: 'gpt-4o',
  image_model: 'dall-e-3',
};

function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly repo: SettingsRepository,
    private readonly encryption: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  async get(key: string): Promise<{ value: string | null; source: 'db' | 'env' | 'default' }> {
    // 1. Try DB
    const record = await this.repo.findByKey(key);
    if (record) {
      const value = ENCRYPTED_KEYS.has(key) ? this.encryption.decrypt(record.value) : record.value;
      return { value, source: 'db' };
    }

    // 2. Try env
    const envKey = ENV_KEY_MAP[key] ?? key.toUpperCase();
    const envValue = this.configService.get<string>(envKey);
    if (envValue !== undefined && envValue !== null && envValue !== '') {
      return { value: envValue, source: 'env' };
    }

    // 3. Default
    const defaultVal = DEFAULTS[key] ?? null;
    return { value: defaultVal, source: 'default' };
  }

  async getSettings(): Promise<AppSettings> {
    const keys = [
      'llm_provider', 'llm_model', 'image_provider', 'image_model',
      'openai_api_key', 'anthropic_api_key', 'google_api_key',
      'deepseek_api_key', 'mimo_api_key', 'bfl_api_key',
    ];

    const results = await Promise.all(keys.map((k) => this.get(k)));
    const values: Record<string, string | null> = {};
    for (let i = 0; i < keys.length; i++) {
      values[keys[i]] = results[i].value;
    }

    return {
      llmProvider: values.llm_provider ?? 'openai',
      llmModel: values.llm_model ?? 'gpt-4o',
      imageProvider: values.image_provider ?? 'openai',
      imageModel: values.image_model ?? 'dall-e-3',
      openaiApiKey: maskApiKey(values.openai_api_key),
      anthropicApiKey: maskApiKey(values.anthropic_api_key),
      googleApiKey: maskApiKey(values.google_api_key),
      deepseekApiKey: maskApiKey(values.deepseek_api_key),
      mimoApiKey: maskApiKey(values.mimo_api_key),
      bflApiKey: maskApiKey(values.bfl_api_key),
      easyweekEnabled: false,
      easyweekApiKey: null,
      wayforpayEnabled: false,
      wayforpayMerchant: null,
      wayforpaySecret: null,
      monobankEnabled: false,
      monobankApiKey: null,
    };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<{ saved: string[] }> {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    const saved: string[] = [];

    for (const [camelKey, value] of entries) {
      // Convert camelCase to snake_case
      const key = camelKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      if (value === null || value === '') {
        await this.repo.deleteByKey(key).catch(() => {});
        saved.push(key);
        continue;
      }

      const dbValue = ENCRYPTED_KEYS.has(key) ? this.encryption.encrypt(value as string) : (value as string);
      await this.repo.upsert(key, dbValue);
      saved.push(key);
    }

    this.logger.log(`Settings updated: ${saved.join(', ')}`);
    return { saved };
  }

  async getApiKey(provider: string): Promise<string | null> {
    const keyName = `${provider}_api_key`;
    const { value } = await this.get(keyName);
    return value;
  }

  async getEffectiveModel(provider: string, type: 'content' | 'image'): Promise<string> {
    const modelKey = type === 'content' ? 'llm_model' : 'image_model';
    const { value } = await this.get(modelKey);
    if (value) return value;
    return getDefaultModel(provider, type);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend && rtk npx vitest run settings.service.spec.ts
```
Expected: all tests PASS

- [ ] **Step 5: Fix downstream test in existing settings.service.spec.ts if needed — but we rewrote it, so old tests are replaced**

- [ ] **Step 6: Commit**

```bash
rtk git add apps/backend/src/modules/settings/
rtk git commit -m "feat: refactor SettingsService — DB-first with env fallback, encrypted API keys"
```

---

### Task 7: Update Env Validation — Add New Variables

**Files:**
- Modify: `apps/backend/src/shared/config/env.validation.ts`

**Interfaces:**
- Produces: `GOOGLE_API_KEY`, `BFL_API_KEY`, `ENCRYPTION_KEY`, `MIMO_MODEL` env vars in schema

- [ ] **Step 1: Add new env vars to zod schema**

Edit `apps/backend/src/shared/config/env.validation.ts`:

```typescript
// In LLM APIs section, add:
GOOGLE_API_KEY: z.string().optional(),
BFL_API_KEY: z.string().optional(),
ENCRYPTION_KEY: z.string().optional(),
// MIMO_MODEL already exists — verify it's there

// Ensure LLM_PROVIDER enum includes google:
LLM_PROVIDER: z.enum(['openai', 'anthropic', 'deepseek', 'mimo', 'google']).default('openai'),

// Ensure IMAGE_PROVIDER enum is:
IMAGE_PROVIDER: z.enum(['dall-e-3', 'openai', 'google', 'bfl']).default('openai'),
```

- [ ] **Step 2: Run typecheck**

```bash
rtk turbo typecheck
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
rtk git add apps/backend/src/shared/config/env.validation.ts
rtk git commit -m "feat: add GOOGLE_API_KEY, BFL_API_KEY, ENCRYPTION_KEY to env validation"
```

---

### Task 8: Update Existing Strategies — Use SettingsService for Keys + Model

**Files:**
- Modify: `apps/backend/src/modules/generation/strategies/openai.strategy.ts`
- Modify: `apps/backend/src/modules/generation/strategies/anthropic.strategy.ts`
- Modify: `apps/backend/src/modules/generation/strategies/deepseek.strategy.ts`
- Modify: `apps/backend/src/modules/generation/strategies/mimo.strategy.ts`
- Modify: `apps/backend/src/modules/generation/strategies/dalle3.strategy.ts`

**Interfaces:**
- Consumes: `SettingsService` (replaces `ConfigService` for keys + model)
- Produces: Updated strategies that accept model from settings

- [ ] **Step 1: Update OpenAIStrategy**

Change constructor to accept `SettingsService` instead of `ConfigService`:

```typescript
// apps/backend/src/modules/generation/strategies/openai.strategy.ts
import OpenAI from 'openai';
import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import type { ILLMStrategy, BusinessData, HugoGeneratedContent, LLMGenerateOptions, LLMResponse } from './llm-strategy.interface';

@Injectable()
export class OpenAIStrategy implements ILLMStrategy {
  private readonly logger = new Logger(OpenAIStrategy.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getClient(): Promise<OpenAI> {
    const apiKey = await this.settingsService.getApiKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not configured');
    return new OpenAI({ apiKey });
  }

  private async getModel(): Promise<string> {
    return this.settingsService.getEffectiveModel('openai', 'content');
  }

  async generateContent(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const client = await this.getClient();
    const model = options?.model || (await this.getModel());
    // ... rest of method unchanged ...
  }

  // generateHugoStructure, buildHugoPrompt, generateDefaultStructure — unchanged
}
```

Apply same pattern to: `anthropic.strategy.ts`, `deepseek.strategy.ts`, `mimo.strategy.ts`, `dalle3.strategy.ts`

- [ ] **Step 2: Update generation.module.ts to inject SettingsService into strategies**

```typescript
// apps/backend/src/modules/generation/generation.module.ts
// Add import:
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PublishingModule, ProjectsModule, PrismaModule, QueueModule, SettingsModule],
  // ... rest unchanged
})
```

- [ ] **Step 3: Run all backend tests to catch regressions**

```bash
cd apps/backend && rtk npx vitest run
```
Expected: existing tests may need mock updates for SettingsService

- [ ] **Step 4: Update strategy test mocks to use SettingsService**

For each strategy spec file, replace `ConfigService` mock with `SettingsService` mock:

```typescript
const mockSettingsService = {
  getApiKey: vi.fn().mockResolvedValue('sk-test-key'),
  getEffectiveModel: vi.fn().mockResolvedValue('gpt-4o'),
};
const strategy = new OpenAIStrategy(mockSettingsService as any);
```

- [ ] **Step 5: Run tests to verify all pass**

```bash
cd apps/backend && rtk npx vitest run
```
Expected: all 112 tests PASS

- [ ] **Step 6: Commit**

```bash
rtk git add apps/backend/src/modules/generation/
rtk git commit -m "feat: refactor strategies to use SettingsService for API keys + model selection"
```

---

### Task 9: LLM Strategy Factory — Add Google Provider

**Files:**
- Modify: `apps/backend/src/modules/generation/strategies/llm-strategy.factory.ts`
- Modify: `apps/backend/src/modules/generation/strategies/llm-strategy.factory.spec.ts`

**Interfaces:**
- Consumes: `GeminiStrategy` (will be created in Task 10)
- Produces: `LLMStrategyFactory.create()` supports 'google'

- [ ] **Step 1: Update factory**

```typescript
// apps/backend/src/modules/generation/strategies/llm-strategy.factory.ts
import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { OpenAIStrategy } from './openai.strategy';
import { AnthropicStrategy } from './anthropic.strategy';
import { DeepseekStrategy } from './deepseek.strategy';
import { MimoStrategy } from './mimo.strategy';
import { GeminiStrategy } from './gemini.strategy';
import type { ILLMStrategy } from './llm-strategy.interface';

@Injectable()
export class LLMStrategyFactory {
  constructor(
    private readonly openaiStrategy: OpenAIStrategy,
    private readonly anthropicStrategy: AnthropicStrategy,
    private readonly deepseekStrategy: DeepseekStrategy,
    private readonly mimoStrategy: MimoStrategy,
    private readonly geminiStrategy: GeminiStrategy,
  ) {}

  create(provider?: string): ILLMStrategy {
    const map: Record<string, ILLMStrategy> = {
      openai: this.openaiStrategy,
      anthropic: this.anthropicStrategy,
      deepseek: this.deepseekStrategy,
      mimo: this.mimoStrategy,
      google: this.geminiStrategy,
    };
    const p = provider || 'anthropic';
    return map[p] || this.anthropicStrategy;
  }
}
```

- [ ] **Step 2: Update factory test**

```typescript
// Add google case:
it('should return GeminiStrategy for google provider', () => {
  const strategy = factory.create('google');
  expect(strategy).toBe(geminiStrategy);
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/backend && rtk npx vitest run llm-strategy.factory.spec.ts
```
Expected: PASS (4 tests — will fail until GeminiStrategy is created in Task 10)

- [ ] **Step 4: Temporarily skip — commit after Task 10**

---

### Task 10: New Strategies — Gemini, Imagen, Flux

**Files:**
- Create: `apps/backend/src/modules/generation/strategies/gemini.strategy.ts`
- Create: `apps/backend/src/modules/generation/strategies/gemini.strategy.spec.ts`
- Create: `apps/backend/src/modules/generation/strategies/imagen.strategy.ts`
- Create: `apps/backend/src/modules/generation/strategies/imagen.strategy.spec.ts`
- Create: `apps/backend/src/modules/generation/strategies/flux.strategy.ts`
- Create: `apps/backend/src/modules/generation/strategies/flux.strategy.spec.ts`

**Interfaces:**
- Consumes: `SettingsService`, `ILLMStrategy`, `IImageGenerationStrategy`
- Produces: `GeminiStrategy`, `ImagenStrategy`, `FluxStrategy`

- [ ] **Step 1: Write GeminiStrategy test**

```typescript
// apps/backend/src/modules/generation/strategies/gemini.strategy.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiStrategy } from './gemini.strategy';

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Generated content' } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      },
    },
  })),
}));

describe('GeminiStrategy', () => {
  let strategy: GeminiStrategy;
  let mockSettings: any;

  beforeEach(() => {
    mockSettings = {
      getApiKey: vi.fn().mockResolvedValue('test-gemini-key'),
      getEffectiveModel: vi.fn().mockResolvedValue('gemini-2.5-pro'),
    };
    strategy = new GeminiStrategy(mockSettings);
  });

  it('should construct with settings service', () => {
    expect(strategy).toBeDefined();
  });

  it('should generate content via Gemini API', async () => {
    const result = await strategy.generateContent('Test prompt');
    expect(result.content).toBe('Generated content');
  });

  it('should use override model when provided', async () => {
    const result = await strategy.generateContent('Test', { model: 'gemini-2.5-flash' });
    expect(result.content).toBe('Generated content');
  });
});
```

- [ ] **Step 2: Implement GeminiStrategy**

```typescript
// apps/backend/src/modules/generation/strategies/gemini.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SettingsService } from '../../settings/settings.service';
import type { ILLMStrategy, BusinessData, HugoGeneratedContent, LLMGenerateOptions, LLMResponse } from './llm-strategy.interface';

@Injectable()
export class GeminiStrategy implements ILLMStrategy {
  private readonly logger = new Logger(GeminiStrategy.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getClient(): Promise<OpenAI> {
    const apiKey = await this.settingsService.getApiKey('google');
    if (!apiKey) throw new Error('Google API key not configured');
    return new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
  }

  private async getModel(): Promise<string> {
    return this.settingsService.getEffectiveModel('google', 'content');
  }

  async generateContent(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const client = await this.getClient();
    const model = options?.model || (await this.getModel());

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });

      return {
        content: completion.choices[0]?.message?.content || '',
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
        },
        model,
        provider: 'google',
      };
    } catch (error: any) {
      this.logger.error(`Gemini generation failed: ${error.message}`);
      throw error;
    }
  }

  async generateHugoStructure(businessData: BusinessData): Promise<HugoGeneratedContent> {
    const prompt = this.buildHugoPrompt(businessData);
    const response = await this.generateContent(prompt);

    try {
      const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) return JSON.parse(jsonMatch[1]);
      return JSON.parse(response.content);
    } catch {
      this.logger.warn('Failed to parse Gemini JSON response, using defaults');
      return this.generateDefaultStructure(businessData);
    }
  }

  private buildHugoPrompt(data: BusinessData): string {
    return `You are a Hugo static site generator. Generate content for a business website.
Business: ${data.businessName}
Category: ${data.category || 'General'}
Description: ${data.description || ''}

Generate the following Hugo content structure as valid JSON:
{...}`;
  }

  private generateDefaultStructure(data: BusinessData): HugoGeneratedContent {
    return {
      config: `baseURL = "/"\nlanguageCode = "en-us"\ntitle = "${data.businessName}"\ntheme = "hugo-theme-zen"`,
      content: [],
      layouts: [],
      static: [],
      assets: [],
    };
  }
}
```

- [ ] **Step 3: Implement ImagenStrategy**

```typescript
// apps/backend/src/modules/generation/strategies/imagen.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SettingsService } from '../../settings/settings.service';
import type { IImageGenerationStrategy, ImageGenerationOptions, ImageGenerationResponse } from './image-strategy.interface';

@Injectable()
export class ImagenStrategy implements IImageGenerationStrategy {
  private readonly logger = new Logger(ImagenStrategy.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getClient(): Promise<OpenAI> {
    const apiKey = await this.settingsService.getApiKey('google');
    if (!apiKey) throw new Error('Google API key not configured');
    return new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
  }

  async generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    const client = await this.getClient();
    const model = options?.model || 'imagen-4';

    const response = await client.images.generate({
      model,
      prompt,
      n: 1,
      size: (options?.size as any) || '1024x1024',
    });

    return {
      url: response.data[0]?.url || '',
      provider: 'google',
      model,
    };
  }

  async generateHeroImage(businessName: string, category: string | null): Promise<ImageGenerationResponse> {
    const prompt = `Professional hero image for ${businessName}${category ? `, a ${category} business` : ''}. Clean, modern, high-quality.`;
    return this.generateImage(prompt);
  }

  async generatePlaceholder(category: string): Promise<ImageGenerationResponse> {
    return this.generateImage(`Simple placeholder image for ${category} category`);
  }
}
```

- [ ] **Step 4: Implement FluxStrategy**

```typescript
// apps/backend/src/modules/generation/strategies/flux.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import type { IImageGenerationStrategy, ImageGenerationOptions, ImageGenerationResponse } from './image-strategy.interface';

@Injectable()
export class FluxStrategy implements IImageGenerationStrategy {
  private readonly logger = new Logger(FluxStrategy.name);
  private readonly baseUrl = 'https://fal.run';

  constructor(private readonly settingsService: SettingsService) {}

  async generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    const apiKey = await this.settingsService.getApiKey('bfl');
    if (!apiKey) throw new Error('BFL API key not configured');

    const response = await fetch(`${this.baseUrl}/fal-ai/flux-pro`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: options?.size || 'landscape_4_3',
        num_images: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Flux API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return {
      url: data.images?.[0]?.url || '',
      provider: 'bfl',
      model: 'flux-1-pro',
    };
  }

  async generateHeroImage(businessName: string, category: string | null): Promise<ImageGenerationResponse> {
    const prompt = `Professional hero banner image for ${businessName}${category ? `, a ${category} business` : ''}. Modern, photorealistic, high-quality.`;
    return this.generateImage(prompt);
  }

  async generatePlaceholder(category: string): Promise<ImageGenerationResponse> {
    return this.generateImage(`Generic placeholder image for ${category} category, clean, simple`);
  }
}
```

- [ ] **Step 5: Create ImageStrategyFactory**

```typescript
// apps/backend/src/modules/generation/strategies/image-strategy.factory.ts
import { Injectable } from '@nestjs/common';
import { DallE3Strategy } from './dalle3.strategy';
import { ImagenStrategy } from './imagen.strategy';
import { FluxStrategy } from './flux.strategy';
import type { IImageGenerationStrategy } from './image-strategy.interface';

@Injectable()
export class ImageStrategyFactory {
  constructor(
    private readonly dalle3: DallE3Strategy,
    private readonly imagen: ImagenStrategy,
    private readonly flux: FluxStrategy,
  ) {}

  create(provider?: string): IImageGenerationStrategy {
    const map: Record<string, IImageGenerationStrategy> = {
      openai: this.dalle3,
      google: this.imagen,
      bfl: this.flux,
    };
    return map[provider || 'openai'] || this.dalle3;
  }
}
```

- [ ] **Step 6: Register new strategies in generation.module.ts**

```typescript
// Add to providers array:
GeminiStrategy, ImagenStrategy, FluxStrategy, ImageStrategyFactory
```

- [ ] **Step 7: Run all tests**

```bash
cd apps/backend && rtk npx vitest run
```
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
rtk git add apps/backend/src/modules/generation/strategies/
rtk git commit -m "feat: add GeminiStrategy, ImagenStrategy, FluxStrategy + ImageStrategyFactory"
```

---

### Task 11: Update Settings Controller

**Files:**
- Modify: `apps/backend/src/modules/settings/settings.controller.ts`

**Interfaces:**
- Consumes: `SettingsService`
- Produces: `GET /settings`, `PUT /settings`, `GET /settings/models`

- [ ] **Step 1: Update controller with new endpoints**

```typescript
// apps/backend/src/modules/settings/settings.controller.ts
import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prompt-site-builder/shared';
import { SettingsService } from './settings.service';
import type { AppSettings, UpdateSettingsDto, SettingsModelsResponse } from '@prompt-site-builder/shared';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings (API keys masked)' })
  @ApiResponse({ status: 200, description: 'Settings retrieved' })
  async getSettings(): Promise<AppSettings> {
    return this.settingsService.getSettings();
  }

  @Put()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(@Body() updates: UpdateSettingsDto): Promise<{ saved: string[] }> {
    return this.settingsService.updateSettings(updates);
  }

  @Get('models')
  @ApiOperation({ summary: 'Get available models with pricing' })
  @ApiResponse({ status: 200, description: 'Model registry' })
  getModels(): SettingsModelsResponse {
    const { MODEL_REGISTRY } = require('@prompt-site-builder/shared');
    return {
      content: MODEL_REGISTRY.content,
      image: MODEL_REGISTRY.image,
    };
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
rtk turbo typecheck
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
rtk git add apps/backend/src/modules/settings/settings.controller.ts
rtk git commit -m "feat: update SettingsController — real save + GET /settings/models"
```

---

### Task 12: Update Leads Controller + Service — Payment Config

**Files:**
- Modify: `apps/backend/src/modules/leads/leads.service.ts`
- Modify: `apps/backend/src/modules/leads/leads.controller.ts`
- Modify: `apps/backend/src/modules/leads/leads.service.spec.ts`

**Interfaces:**
- Consumes: `EncryptionService`
- Produces: `LeadsService` with encrypt/decrypt for payment fields

- [ ] **Step 1: Update LeadsService**

Add encryption for payment fields on create/update, decryption on read:

```typescript
// In apps/backend/src/modules/leads/leads.service.ts
import { EncryptionService } from '../settings/encryption.service';

const ENCRYPTED_LEAD_FIELDS = ['easyweekApiKey', 'wayforpaySecret', 'monobankApiKey'];

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly encryption: EncryptionService,
  ) {}

  // In create/update methods, encrypt payment fields before storing:
  private encryptPaymentFields(dto: any): any {
    const result = { ...dto };
    for (const field of ENCRYPTED_LEAD_FIELDS) {
      if (result[field]) {
        result[field] = this.encryption.encrypt(result[field]);
      }
    }
    return result;
  }

  private decryptPaymentFields(lead: any): any {
    const result = { ...lead };
    for (const field of ENCRYPTED_LEAD_FIELDS) {
      if (result[field]) {
        try {
          result[field] = this.encryption.decrypt(result[field]);
        } catch {
          // If decryption fails, leave as-is (might be plaintext from env)
        }
      }
    }
    return result;
  }
}
```

- [ ] **Step 2: Update LeadsController** — no changes needed, DTOs already updated in Task 5

- [ ] **Step 3: Update tests**

```typescript
// Add mock EncryptionService to leads.service.spec.ts:
const mockEncryption = {
  encrypt: vi.fn((v: string) => `enc_${v}`),
  decrypt: vi.fn((v: string) => v.startsWith('enc_') ? v.slice(4) : v),
};
```

- [ ] **Step 4: Run tests**

```bash
cd apps/backend && rtk npx vitest run leads.service.spec.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
rtk git add apps/backend/src/modules/leads/
rtk git commit -m "feat: add payment field encryption to LeadsService"
```

---

### Task 13: Update Generation Service — Use Settings for Model, Lead for Services

**Files:**
- Modify: `apps/backend/src/modules/generation/generation.service.ts`

**Interfaces:**
- Consumes: `SettingsService`, `ImageStrategyFactory`, `LeadsService`
- Produces: Updated `generateSite()` that reads model from settings + services from lead

- [ ] **Step 1: Update generateSite to accept optional model overrides and use lead services**

```typescript
// In generation.service.ts, update SiteGenerationRequest type usage:
// Read model from settings if not in request:
const llmProvider = (await this.settingsService.get('llm_provider')).value || 'openai';
const llmModel = request.model || (await this.settingsService.getEffectiveModel(llmProvider, 'content'));

// Read image provider/model from settings:
const imageProvider = (await this.settingsService.get('image_provider')).value || 'openai';
const imageModel = request.imageModel || (await this.settingsService.getEffectiveModel(imageProvider, 'image'));

// Read lead payment config:
const lead = await this.leadsService.findOne(request.leadId);
// Pass lead.easyweekEnabled, lead.wayforpayEnabled, lead.monobankEnabled to Hugo generation
```

- [ ] **Step 2: Run existing tests, update mocks**

```bash
cd apps/backend && rtk npx vitest run generation.service.spec.ts
```
Expected: may fail until mocks include SettingsService + LeadsService

- [ ] **Step 3: Commit**

```bash
rtk git add apps/backend/src/modules/generation/generation.service.ts
rtk git commit -m "feat: update GenerationService to use settings for models + lead for services"
```

---

### Task 14: Frontend — ApiKeyInput Component

**Files:**
- Create: `apps/frontend/src/lib/components/settings/ApiKeyInput.svelte`

**Interfaces:**
- Produces: Reusable masked password input with clear button

- [ ] **Step 1: Create ApiKeyInput component**

```svelte
<!-- apps/frontend/src/lib/components/settings/ApiKeyInput.svelte -->
<script lang="ts">
  interface Props {
    label: string;
    placeholder: string;
    value: string;
    maskedPreview: string;
    onChange: (value: string) => void;
  }

  let { label, placeholder, value, maskedPreview, onChange }: Props = $props();

  let isEditing = $state(false);
  let inputValue = $state('');

  function startEditing() {
    inputValue = '';
    isEditing = true;
  }

  function saveKey() {
    onChange(inputValue);
    isEditing = false;
  }

  function clearKey() {
    onChange('');
    isEditing = false;
  }
</script>

<div class="space-y-2">
  <label class="text-sm font-medium">{label}</label>
  {#if isEditing}
    <div class="flex gap-2">
      <input
        type="password"
        bind:value={inputValue}
        placeholder={placeholder}
        class="flex-1 rounded-md border px-3 py-2 text-sm"
      />
      <button onclick={saveKey} class="rounded-md bg-primary px-3 py-2 text-sm text-white">Save</button>
      <button onclick={() => (isEditing = false)} class="rounded-md border px-3 py-2 text-sm">Cancel</button>
    </div>
  {:else if maskedPreview}
    <div class="flex items-center gap-2">
      <code class="flex-1 rounded-md bg-muted px-3 py-2 text-sm">{maskedPreview}</code>
      <button onclick={startEditing} class="rounded-md border px-3 py-2 text-sm">Change</button>
      <button onclick={clearKey} class="rounded-md border px-3 py-2 text-sm text-destructive">Clear</button>
    </div>
  {:else}
    <div class="flex gap-2">
      <input
        type="password"
        bind:value={inputValue}
        placeholder={placeholder}
        class="flex-1 rounded-md border px-3 py-2 text-sm"
      />
      <button onclick={saveKey} class="rounded-md bg-primary px-3 py-2 text-sm text-white">Save</button>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/frontend/src/lib/components/settings/ApiKeyInput.svelte
rtk git commit -m "feat: add ApiKeyInput component — masked password with edit/clear"
```

---

### Task 15: Frontend — ModelSelector Component

**Files:**
- Create: `apps/frontend/src/lib/components/settings/ModelSelector.svelte`

**Interfaces:**
- Produces: Cascading provider→model dropdowns with pricing badges

- [ ] **Step 1: Create ModelSelector component**

```svelte
<!-- apps/frontend/src/lib/components/settings/ModelSelector.svelte -->
<script lang="ts">
  import type { ContentModel, ImageModel } from '@prompt-site-builder/shared';

  interface Props {
    type: 'content' | 'image';
    provider: string;
    model: string;
    models: (ContentModel | ImageModel)[];
    onProviderChange: (provider: string) => void;
    onModelChange: (model: string) => void;
  }

  let { type, provider, model, models, onProviderChange, onModelChange }: Props = $props();

  let providers = $derived([...new Set(models.map((m) => m.provider))]);
  let filteredModels = $derived(models.filter((m) => m.provider === provider));

  let providerLabels: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    deepseek: 'DeepSeek',
    mimo: 'MiMo',
    bfl: 'BFL',
  };

  function formatPrice(m: ContentModel | ImageModel): string {
    if (type === 'content') {
      const cm = m as ContentModel;
      return `$${cm.inputPrice}/$${cm.outputPrice} per 1M`;
    }
    const im = m as ImageModel;
    return `$${im.pricePerImage}/image`;
  }
</script>

<div class="space-y-4">
  <div>
    <label class="text-sm font-medium">{type === 'content' ? 'Provider' : 'Image Provider'}</label>
    <select
      value={provider}
      onchange={(e) => onProviderChange(e.currentTarget.value)}
      class="w-full rounded-md border px-3 py-2 text-sm"
    >
      {#each providers as p}
        <option value={p}>{providerLabels[p] ?? p}</option>
      {/each}
    </select>
  </div>

  <div>
    <label class="text-sm font-medium">{type === 'content' ? 'Model' : 'Image Model'}</label>
    <select
      value={model}
      onchange={(e) => onModelChange(e.currentTarget.value)}
      class="w-full rounded-md border px-3 py-2 text-sm"
    >
      {#each filteredModels as m}
        <option value={m.id}>
          {m.label} — {m.role} ({formatPrice(m)})
        </option>
      {/each}
    </select>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/frontend/src/lib/components/settings/ModelSelector.svelte
rtk git commit -m "feat: add ModelSelector component — provider→model cascade with pricing"
```

---

### Task 16: Frontend — PaymentProviderCard Component

**Files:**
- Create: `apps/frontend/src/lib/components/lead/PaymentProviderCard.svelte`

**Interfaces:**
- Produces: Toggle + API key fields + webhook URL per provider

- [ ] **Step 1: Create PaymentProviderCard component**

```svelte
<!-- apps/frontend/src/lib/components/lead/PaymentProviderCard.svelte -->
<script lang="ts">
  interface Props {
    name: string;
    enabled: boolean;
    apiKey: string;
    apiKeyMasked: string;
    apiKeyLabel: string;
    extraFields: Array<{ label: string; value: string; onChange: (v: string) => void }>;
    webhookUrl: string;
    onToggle: (enabled: boolean) => void;
    onApiKeyChange: (key: string) => void;
  }

  let {
    name, enabled, apiKey, apiKeyMasked, apiKeyLabel,
    extraFields, webhookUrl, onToggle, onApiKeyChange,
  }: Props = $props();

  let isEditingKey = $state(false);
  let keyInput = $state('');
</script>

<div class="rounded-lg border p-4 space-y-3">
  <div class="flex items-center justify-between">
    <h3 class="font-semibold">{name}</h3>
    <button
      onclick={() => onToggle(!enabled)}
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
      class:bg-primary={enabled}
      class:bg-muted={!enabled}
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
        class:translate-x-6={enabled}
        class:translate-x-1={!enabled}
      />
    </button>
  </div>

  {#if enabled}
    <div class="space-y-2">
      <!-- API Key -->
      <div>
        <label class="text-sm">{apiKeyLabel}</label>
        {#if isEditingKey}
          <div class="flex gap-2 mt-1">
            <input type="password" bind:value={keyInput} class="flex-1 rounded-md border px-2 py-1 text-sm" />
            <button onclick={() => { onApiKeyChange(keyInput); isEditingKey = false; }} class="text-sm text-primary">Save</button>
          </div>
        {:else if apiKey}
          <div class="flex gap-2 mt-1">
            <code class="flex-1 rounded-md bg-muted px-2 py-1 text-sm">{apiKeyMasked}</code>
            <button onclick={() => { keyInput = ''; isEditingKey = true; }} class="text-sm">Change</button>
          </div>
        {:else}
          <div class="flex gap-2 mt-1">
            <input type="password" bind:value={keyInput} placeholder="Enter API key" class="flex-1 rounded-md border px-2 py-1 text-sm" />
            <button onclick={() => { onApiKeyChange(keyInput); keyInput = ''; }} class="text-sm text-primary">Save</button>
          </div>
        {/if}
      </div>

      <!-- Extra fields (e.g., WayForPay Merchant) -->
      {#each extraFields as field}
        <div>
          <label class="text-sm">{field.label}</label>
          <input
            type="text"
            value={field.value}
            oninput={(e) => field.onChange(e.currentTarget.value)}
            class="w-full rounded-md border px-2 py-1 text-sm mt-1"
          />
        </div>
      {/each}

      <!-- Webhook URL -->
      <div>
        <label class="text-sm">Webhook URL</label>
        <code class="block rounded-md bg-muted px-2 py-1 text-xs mt-1 break-all">{webhookUrl}</code>
      </div>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/frontend/src/lib/components/lead/PaymentProviderCard.svelte
rtk git commit -m "feat: add PaymentProviderCard component — per-lead toggle + API key + webhook"
```

---

### Task 17: Frontend — Rewrite Settings Page

**Files:**
- Modify: `apps/frontend/src/routes/dashboard/settings/+page.svelte`
- Create: `apps/frontend/src/routes/dashboard/settings/+page.ts` (if needed for load data)

**Interfaces:**
- Consumes: `ApiKeyInput`, `ModelSelector` components, `GET /settings`, `PUT /settings`, `GET /settings/models`

- [ ] **Step 1: Rewrite settings page**

```svelte
<!-- apps/frontend/src/routes/dashboard/settings/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ApiKeyInput from '$lib/components/settings/ApiKeyInput.svelte';
  import ModelSelector from '$lib/components/settings/ModelSelector.svelte';
  import type { AppSettings } from '@prompt-site-builder/shared';

  let settings = $state<AppSettings | null>(null);
  let models = $state<any>({ content: [], image: [] });
  let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle');

  onMount(async () => {
    settings = await api.get<any>('/settings');
    const modelData = await api.get<any>('/settings/models');
    models = modelData;
  });

  async function saveSettings() {
    if (!settings) return;
    saveStatus = 'saving';
    await api.put('/settings', {
      llmProvider: settings.llmProvider,
      llmModel: settings.llmModel,
      imageProvider: settings.imageProvider,
      imageModel: settings.imageModel,
    });
    saveStatus = 'saved';
    setTimeout(() => (saveStatus = 'idle'), 2000);
  }

  async function saveApiKey(key: string, value: string) {
    if (!settings) return;
    await api.put('/settings', { [key]: value });
  }

  function handleProviderChange(provider: string) {
    if (!settings) return;
    settings.llmProvider = provider;
    // Auto-reset model to provider's first model
    const providerModels = models.content.filter((m: any) => m.provider === provider);
    if (providerModels.length > 0) {
      settings.llmModel = providerModels[0].id;
    }
  }

  function handleImageProviderChange(provider: string) {
    if (!settings) return;
    settings.imageProvider = provider;
    const providerModels = models.image.filter((m: any) => m.provider === provider);
    if (providerModels.length > 0) {
      settings.imageModel = providerModels[0].id;
    }
  }
</script>

<div class="space-y-8 p-6">
  <h1 class="text-2xl font-bold">Settings</h1>

  {#if settings}
    <!-- Section 1: API Keys -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">API Keys</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <ApiKeyInput
          label="OpenAI API Key"
          placeholder="sk-..."
          value=""
          maskedPreview={settings.openaiApiKey ?? ''}
          onChange={(v: string) => saveApiKey('openaiApiKey', v)}
        />
        <ApiKeyInput
          label="Anthropic API Key"
          placeholder="sk-ant-..."
          value=""
          maskedPreview={settings.anthropicApiKey ?? ''}
          onChange={(v: string) => saveApiKey('anthropicApiKey', v)}
        />
        <ApiKeyInput
          label="Google API Key"
          placeholder="AIza..."
          value=""
          maskedPreview={settings.googleApiKey ?? ''}
          onChange={(v: string) => saveApiKey('googleApiKey', v)}
        />
        <ApiKeyInput
          label="DeepSeek API Key"
          placeholder="sk-..."
          value=""
          maskedPreview={settings.deepseekApiKey ?? ''}
          onChange={(v: string) => saveApiKey('deepseekApiKey', v)}
        />
        <ApiKeyInput
          label="MiMo API Key"
          placeholder="..."
          value=""
          maskedPreview={settings.mimoApiKey ?? ''}
          onChange={(v: string) => saveApiKey('mimoApiKey', v)}
        />
        <ApiKeyInput
          label="BFL API Key"
          placeholder="..."
          value=""
          maskedPreview={settings.bflApiKey ?? ''}
          onChange={(v: string) => saveApiKey('bflApiKey', v)}
        />
      </div>
    </section>

    <!-- Section 2: Model Defaults -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Model Defaults</h2>
      <div class="grid gap-6 md:grid-cols-2">
        <ModelSelector
          type="content"
          provider={settings.llmProvider}
          model={settings.llmModel}
          models={models.content}
          onProviderChange={handleProviderChange}
          onModelChange={(m: string) => (settings.llmModel = m)}
        />
        <ModelSelector
          type="image"
          provider={settings.imageProvider}
          model={settings.imageModel}
          models={models.image}
          onProviderChange={handleImageProviderChange}
          onModelChange={(m: string) => (settings.imageModel = m)}
        />
      </div>
    </section>

    <!-- Section 3: Integrations Status -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Integrations Status</h2>
      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-lg border p-4">
          <h3 class="font-medium">EasyWeek</h3>
          <p class="text-sm text-muted-foreground">Per-lead configuration</p>
        </div>
        <div class="rounded-lg border p-4">
          <h3 class="font-medium">WayForPay</h3>
          <p class="text-sm text-muted-foreground">Per-lead configuration</p>
        </div>
        <div class="rounded-lg border p-4">
          <h3 class="font-medium">Monobank</h3>
          <p class="text-sm text-muted-foreground">Per-lead configuration</p>
        </div>
      </div>
    </section>

    <button
      onclick={saveSettings}
      disabled={saveStatus === 'saving'}
      class="rounded-md bg-primary px-6 py-2 text-white"
    >
      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Settings'}
    </button>
  {/if}
</div>
```

- [ ] **Step 2: Run frontend typecheck**

```bash
cd apps/frontend && rtk npx svelte-check
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
rtk git add apps/frontend/src/routes/dashboard/settings/
rtk git commit -m "feat: rewrite settings page — API keys, model defaults, live save"
```

---

### Task 18: Frontend — Lead Detail Page (New)

**Files:**
- Create: `apps/frontend/src/routes/dashboard/leads/[id]/+page.svelte`
- Create: `apps/frontend/src/routes/dashboard/leads/[id]/+page.ts` (optional load function)

**Interfaces:**
- Consumes: `PaymentProviderCard`, `GET /leads/:id`, `PUT /leads/:id`

- [ ] **Step 1: Create lead detail page with payment config section**

```svelte
<!-- apps/frontend/src/routes/dashboard/leads/[id]/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api/client';
  import PaymentProviderCard from '$lib/components/lead/PaymentProviderCard.svelte';
  import type { Lead } from '@prompt-site-builder/shared';

  let lead = $state<Lead | null>(null);
  let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle');

  let leadId = $derived($page.params.id);

  onMount(async () => {
    lead = await api.get<Lead>(`/leads/${leadId}`);
  });

  function maskApiKey(key: string | null): string {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 3)}...${key.slice(-4)}`;
  }

  async function savePaymentConfig() {
    if (!lead) return;
    saveStatus = 'saving';
    await api.put(`/leads/${lead.id}`, {
      easyweekEnabled: lead.easyweekEnabled,
      easyweekApiKey: lead.easyweekApiKey,
      wayforpayEnabled: lead.wayforpayEnabled,
      wayforpayMerchant: lead.wayforpayMerchant,
      wayforpaySecret: lead.wayforpaySecret,
      monobankEnabled: lead.monobankEnabled,
      monobankApiKey: lead.monobankApiKey,
    });
    saveStatus = 'saved';
    setTimeout(() => (saveStatus = 'idle'), 2000);
  }

  function getWebhookUrl(provider: string): string {
    return `https://sitenow.pp.ua/api/webhooks/${provider}/${leadId}`;
  }
</script>

<div class="space-y-6 p-6">
  <button onclick={() => goto('/dashboard/leads')} class="text-sm text-primary">&larr; Back to Leads</button>

  {#if lead}
    <h1 class="text-2xl font-bold">{lead.businessName}</h1>

    <!-- Lead Info -->
    <section class="grid gap-4 md:grid-cols-2">
      <div><label class="text-sm text-muted-foreground">Phone</label><p>{lead.phone || '—'}</p></div>
      <div><label class="text-sm text-muted-foreground">Email</label><p>{lead.email || '—'}</p></div>
      <div><label class="text-sm text-muted-foreground">Category</label><p>{lead.category || '—'}</p></div>
      <div><label class="text-sm text-muted-foreground">Status</label><p>{lead.status}</p></div>
    </section>

    <!-- Payment & Booking Configuration -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Site Services</h2>

      <PaymentProviderCard
        name="EasyWeek (Online Booking)"
        enabled={lead.easyweekEnabled}
        apiKey={lead.easyweekApiKey ?? ''}
        apiKeyMasked={maskApiKey(lead.easyweekApiKey)}
        apiKeyLabel="API Key"
        extraFields={[]}
        webhookUrl={getWebhookUrl('easyweek')}
        onToggle={(v: boolean) => (lead.easyweekEnabled = v)}
        onApiKeyChange={(k: string) => (lead.easyweekApiKey = k)}
      />

      <PaymentProviderCard
        name="WayForPay (Payment)"
        enabled={lead.wayforpayEnabled}
        apiKey={lead.wayforpaySecret ?? ''}
        apiKeyMasked={maskApiKey(lead.wayforpaySecret)}
        apiKeyLabel="Secret Key"
        extraFields={[{
          label: 'Merchant ID',
          value: lead.wayforpayMerchant ?? '',
          onChange: (v: string) => (lead.wayforpayMerchant = v),
        }]}
        webhookUrl={getWebhookUrl('wayforpay')}
        onToggle={(v: boolean) => (lead.wayforpayEnabled = v)}
        onApiKeyChange={(k: string) => (lead.wayforpaySecret = k)}
      />

      <PaymentProviderCard
        name="Monobank (Payment)"
        enabled={lead.monobankEnabled}
        apiKey={lead.monobankApiKey ?? ''}
        apiKeyMasked={maskApiKey(lead.monobankApiKey)}
        apiKeyLabel="API Key"
        extraFields={[]}
        webhookUrl={getWebhookUrl('monobank')}
        onToggle={(v: boolean) => (lead.monobankEnabled = v)}
        onApiKeyChange={(k: string) => (lead.monobankApiKey = k)}
      />
    </section>

    <button
      onclick={savePaymentConfig}
      disabled={saveStatus === 'saving'}
      class="rounded-md bg-primary px-6 py-2 text-white"
    >
      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Services'}
    </button>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/frontend/src/routes/dashboard/leads/[id]/
rtk git commit -m "feat: add lead detail page with per-lead payment/booking config"
```

---

### Task 19: Frontend — Generation Trigger Modal

**Files:**
- Create: `apps/frontend/src/lib/components/generation/GenerateModal.svelte`
- Modify: `apps/frontend/src/routes/dashboard/projects/[id]/+page.svelte` (or wherever Generate button lives)

**Interfaces:**
- Consumes: ModelSelector, lead payment status, `POST /generation/generate`

- [ ] **Step 1: Create GenerateModal**

```svelte
<!-- apps/frontend/src/lib/components/generation/GenerateModal.svelte -->
<script lang="ts">
  import ModelSelector from '$lib/components/settings/ModelSelector.svelte';
  import type { Lead } from '@prompt-site-builder/shared';

  interface Props {
    open: boolean;
    lead: Lead;
    projectId: string;
    defaultContentProvider: string;
    defaultContentModel: string;
    defaultImageProvider: string;
    defaultImageModel: string;
    models: { content: any[]; image: any[] };
    onClose: () => void;
  }

  let {
    open, lead, projectId,
    defaultContentProvider, defaultContentModel,
    defaultImageProvider, defaultImageModel,
    models, onClose,
  }: Props = $props();

  let contentProvider = $state(defaultContentProvider);
  let contentModel = $state(defaultContentModel);
  let imageProvider = $state(defaultImageProvider);
  let imageModel = $state(defaultImageModel);
  let isGenerating = $state(false);

  async function generate() {
    isGenerating = true;
    await fetch('/api/generation/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        leadId: lead.id,
        model: contentModel,
        imageModel: imageModel,
      }),
    });
    onClose();
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={onClose}>
    <div class="w-full max-w-lg rounded-lg bg-white p-6 space-y-4" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-bold">Generate Site</h2>

      <!-- AI Models -->
      <ModelSelector
        type="content"
        provider={contentProvider}
        model={contentModel}
        models={models.content}
        onProviderChange={(p: string) => { contentProvider = p; contentModel = models.content.find((m: any) => m.provider === p)?.id ?? ''; }}
        onModelChange={(m: string) => (contentModel = m)}
      />
      <ModelSelector
        type="image"
        provider={imageProvider}
        model={imageModel}
        models={models.image}
        onProviderChange={(p: string) => { imageProvider = p; imageModel = models.image.find((m: any) => m.provider === p)?.id ?? ''; }}
        onModelChange={(m: string) => (imageModel = m)}
      />

      <!-- Site Services (read-only from lead) -->
      <div>
        <h3 class="text-sm font-medium mb-2">Site Services</h3>
        <div class="grid gap-2 text-sm">
          <div class="flex justify-between">
            <span>EasyWeek (Booking)</span>
            <span class={lead.easyweekEnabled ? 'text-green-600' : 'text-muted-foreground'}>
              {lead.easyweekEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div class="flex justify-between">
            <span>WayForPay (Payment)</span>
            <span class={lead.wayforpayEnabled ? 'text-green-600' : 'text-muted-foreground'}>
              {lead.wayforpayEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div class="flex justify-between">
            <span>Monobank (Payment)</span>
            <span class={lead.monobankEnabled ? 'text-green-600' : 'text-muted-foreground'}>
              {lead.monobankEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <button onclick={onClose} class="rounded-md border px-4 py-2 text-sm">Cancel</button>
        <button onclick={generate} disabled={isGenerating} class="rounded-md bg-primary px-4 py-2 text-sm text-white">
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/frontend/src/lib/components/generation/
rtk git commit -m "feat: add GenerateModal with model override + service status"
```

---

### Task 20: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add all missing env vars**

```bash
# .env.example — add:

# LLM Provider Selection
LLM_PROVIDER=openai
IMAGE_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google
GOOGLE_API_KEY=...

# DeepSeek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com

# MiMo
MIMO_API_KEY=...
MIMO_BASE_URL=https://api.mimo.ai/v1
MIMO_MODEL=mimo-v2.5

# BFL (Flux image generation)
BFL_API_KEY=...

# Encryption key for stored API keys (min 16 chars for AES-256)
ENCRYPTION_KEY=change-me-to-a-random-32-char-string
```

- [ ] **Step 2: Commit**

```bash
rtk git add .env.example
rtk git commit -m "chore: update .env.example with all LLM/image providers + ENCRYPTION_KEY"
```

---

### Task 21: Update SettingsModule — Register New Providers

**Files:**
- Modify: `apps/backend/src/modules/settings/settings.module.ts`
- Modify: `apps/backend/src/modules/generation/generation.module.ts`

- [ ] **Step 1: Update settings.module.ts to provide EncryptionService + SettingsRepository**

```typescript
// apps/backend/src/modules/settings/settings.module.ts
import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SettingsRepository } from './settings.repository';
import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [SettingsController],
  providers: [
    SettingsService,
    SettingsRepository,
    {
      provide: EncryptionService,
      useFactory: (config: ConfigService) => {
        return new EncryptionService(config.get<string>('ENCRYPTION_KEY') || '');
      },
      inject: [ConfigService],
    },
  ],
  exports: [SettingsService, EncryptionService],
})
export class SettingsModule {}
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/backend/src/modules/settings/settings.module.ts
rtk git commit -m "feat: register EncryptionService + SettingsRepository in SettingsModule"
```

---

### Task 22: Integration Test — Settings API

**Files:**
- Modify: `apps/backend/src/modules/settings/settings.service.spec.ts` (add integration-style tests)
- Create: `apps/backend/src/modules/settings/settings.controller.spec.ts`

- [ ] **Step 1: Write controller spec**

```typescript
// apps/backend/src/modules/settings/settings.controller.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsController } from './settings.controller';

describe('SettingsController', () => {
  let controller: SettingsController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      getSettings: vi.fn().mockResolvedValue({ llmProvider: 'openai', llmModel: 'gpt-4o' }),
      updateSettings: vi.fn().mockResolvedValue({ saved: ['llm_model'] }),
    };
    controller = new SettingsController(mockService);
  });

  it('should return settings', async () => {
    const result = await controller.getSettings();
    expect(result.llmProvider).toBe('openai');
  });

  it('should update settings', async () => {
    const result = await controller.updateSettings({ llmModel: 'gpt-4o-mini' });
    expect(result.saved).toContain('llm_model');
  });

  it('should return model registry', () => {
    const result = controller.getModels();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.image.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd apps/backend && rtk npx vitest run settings.controller.spec.ts
```
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
rtk git add apps/backend/src/modules/settings/
rtk git commit -m "test: add SettingsController unit tests"
```

---

### Task 23: Full CI Check

- [ ] **Step 1: Run lint**

```bash
rtk turbo lint
```
Expected: 0 errors

- [ ] **Step 2: Run typecheck**

```bash
rtk turbo typecheck
```
Expected: 0 errors

- [ ] **Step 3: Run all tests**

```bash
rtk turbo test
```
Expected: all 129 tests PASS (112 backend + 17 frontend)

- [ ] **Step 4: Run build**

```bash
rtk turbo build
```
Expected: builds successfully

- [ ] **Step 5: Run E2E tests if available**

```bash
cd apps/frontend && rtk npx playwright test
```
Expected: existing tests pass, new tests may need writing

- [ ] **Step 6: Commit any final fixes**

```bash
rtk git add -A
rtk git commit -m "fix: CI fixes — lint, typecheck, test, build all green"
```

---

### Task 24: Final Cleanup — Verify Everything

- [ ] **Step 1: Verify settings page loads correctly** — manual check in browser
- [ ] **Step 2: Verify API keys are encrypted in DB** — query `SELECT * FROM "Setting"` — confirm values are not plaintext
- [ ] **Step 3: Verify env fallback works** — delete a setting from DB, restart, verify value comes from `.env`
- [ ] **Step 4: Verify per-lead payment config saves and displays correctly**
- [ ] **Step 5: Run `bash scripts/ci-local.sh` to simulate full CI pipeline**

---

## Rollout Order

1. Task 1 → Shared model registry
2. Task 3 → Encryption service
3. Task 4 → Settings repository
4. Task 5 → Shared types update
5. Task 2 → DB migration
6. Task 6 → SettingsService refactor
7. Task 7 → Env validation
8. Task 21 → Module registration
9. Task 8 → Strategy refactors
10. Task 10 → New strategies
11. Task 9 → Factory update
12. Task 11 → Settings controller
13. Task 12 → Leads service payment encryption
14. Task 13 → Generation service update
15. Task 14 → ApiKeyInput component
16. Task 15 → ModelSelector component
17. Task 16 → PaymentProviderCard component
18. Task 17 → Settings page rewrite
19. Task 19 → GenerateModal
20. Task 18 → Lead detail page (depends on 16)
21. Task 20 → .env.example
22. Task 22 → Controller tests
23. Task 23 → CI check
24. Task 24 → Manual verification
