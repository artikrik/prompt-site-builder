# LLM Model Expansion + WebUI Settings

**Date:** 2026-07-05
**Status:** Approved
**Branch:** TBD

---

## Overview

Expand LLM model selection from 4 content + 1 image model to 10 content + 4 image models across 6 providers.
Move API key management and model selection from `.env`-only to DB-backed WebUI settings with live save.

## Goals

1. 10 content models across OpenAI, Anthropic, Google, DeepSeek, Mimo
2. 4 image models across OpenAI, Google, BFL
3. DB-backed settings via key/value table, env vars as fallback
4. WebUI: API keys section + model defaults section
5. Live settings (no restart)
6. Model override at generation time (default from settings, optionally override per-generation)
7. Pricing and role label displayed in UI for each model

## Non-Goals

- Removing `.env` entirely — DB is primary, env remains as fallback + initial bootstrap
- Runtime hot-reload of API keys for already-initialized strategy instances
- Multi-tenant settings
- Model fine-tuning or custom prompts per model

---

## Architecture

### Database

New Prisma model:

```prisma
model Setting {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String   // JSON string: plain for config, encrypted for API keys
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Settings keys:**

| Key | Value Type | Encrypted | Example |
|-----|-----------|-----------|---------|
| `llm_provider` | string | No | `"openai"` |
| `llm_model` | string | No | `"gpt-4o-mini"` |
| `image_provider` | string | No | `"openai"` |
| `image_model` | string | No | `"dall-e-3"` |
| `openai_api_key` | string | **Yes** (AES-256-GCM) | `"sk-..."` |
| `anthropic_api_key` | string | **Yes** (AES-256-GCM) | `"sk-ant-..."` |
| `google_api_key` | string | **Yes** (AES-256-GCM) | `"AIza..."` |
| `deepseek_api_key` | string | **Yes** (AES-256-GCM) | `"sk-..."` |
| `mimo_api_key` | string | **Yes** (AES-256-GCM) | `"..."` |
| `bfl_api_key` | string | **Yes** (AES-256-GCM) | `"..."` |

### Settings Read Logic

```
SettingsService.get(key):
  1. Try DB (Setting table)
  2. If missing → process.env[VAR_NAME]
  3. If missing → default (for providers/models) or null (for keys)
```

### Encryption

- `EncryptionService` — AES-256-GCM using `ENCRYPTION_KEY` from `.env`
- API keys encrypted before DB write, decrypted before use
- `ENCRYPTION_KEY` exists **only** in `.env`, never stored in DB
- If `ENCRYPTION_KEY` is not set at startup, encryption is no-op (dev mode)

### Model Registry

Static registry in `packages/shared/src/models.ts` — single source of truth.
Models are code, not DB records. Settings DB stores only the **selection** (`llm_model`, `image_model`).

```typescript
export interface ContentModel {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'mimo';
  label: string;
  inputPrice: number;   // USD per 1M tokens
  outputPrice: number;  // USD per 1M tokens
  contextWindow: number;
  role: string;         // human-readable role label
}

export interface ImageModel {
  id: string;
  provider: 'openai' | 'google' | 'bfl';
  label: string;
  pricePerImage: string; // price range or fixed
  role: string;
}

export const MODEL_REGISTRY: {
  content: ContentModel[];
  image: ImageModel[];
} = {
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
  ]
} as const;
```

---

## Backend Changes

### New Files

| File | Purpose |
|------|---------|
| `apps/backend/src/modules/settings/settings.repository.ts` | Prisma CRUD for `Setting` table |
| `apps/backend/src/modules/settings/encryption.service.ts` | AES-256-GCM encrypt/decrypt for API keys |
| `apps/backend/src/modules/generation/strategies/gemini.strategy.ts` | Gemini 2.5 Pro/Flash via Google AI SDK (OpenAI-compat) |
| `apps/backend/src/modules/generation/strategies/imagen.strategy.ts` | Imagen 4 via Google Vertex AI / Gemini API |
| `apps/backend/src/modules/generation/strategies/flux.strategy.ts` | FLUX.1 Pro via BFL API (FAL.AI) |

### Modified Files

| File | Change |
|------|--------|
| `settings.service.ts` | DB-first read with env fallback, encrypt on write, decrypt on read |
| `settings.controller.ts` | `PUT /settings` — real persistence, `GET /settings/models` — model registry with pricing |
| `llm-strategy.factory.ts` | Support Google provider, read model from Settings, pass model override |
| `image-strategy.factory.ts` | **New** — factory for image generation (currently hardcoded DallE3Strategy) |
| `prisma/schema.prisma` | Add `Setting` model |
| `env.validation.ts` | Add `GOOGLE_API_KEY`, `BFL_API_KEY`, `ENCRYPTION_KEY`, `MIMO_MODEL` |
| `.env.example` | Add all missing vars: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`, `GOOGLE_API_KEY`, `BFL_API_KEY`, `ENCRYPTION_KEY`, `LLM_PROVIDER`, `IMAGE_PROVIDER` |

### Strategy Updates

Each existing strategy (OpenAI, Anthropic, DeepSeek, Mimo) must:
1. Accept `model` option from Settings at construction (currently hardcoded or env-only)
2. Read API key from SettingsService (DB → env fallback), not directly from `ConfigService`

New strategies:
- **GeminiStrategy** — OpenAI SDK with `baseURL: "https://generativelanguage.googleapis.com/v1beta"`, model param
- **ImagenStrategy** — Google AI SDK imagemodel, accepts model name from settings
- **FluxStrategy** — HTTP POST to `https://fal.run/fal-ai/flux-pro`, BFL API key auth

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/settings` | admin | All settings (keys masked: `sk-...AbC1`) |
| `PUT` | `/settings` | admin | Save settings, encrypt API keys |
| `GET` | `/settings/models` | auth | MODEL_REGISTRY with pricing and roles |

---

## Frontend Changes

### Settings Page (`/dashboard/settings`)

Two sections, single Save button, live apply.

**Section 1: API Keys**

| Field | Type | Display |
|-------|------|---------|
| OpenAI API Key | password input | `sk-...AbC1` if exists, empty if not |
| Anthropic API Key | password input | `sk-ant-...XyZ2` if exists |
| Google API Key | password input | `AIza...BcD3` if exists |
| DeepSeek API Key | password input | `sk-...EfG4` if exists |
| Mimo API Key | password input | `...HtU5` if exists |
| BFL API Key | password input | `...JkW6` if exists |

Each field:
- Placeholder: "Enter key" or "••••••••" if key exists
- Show masked version when key is saved: prefix + `...` + last 4 chars
- Clear button to remove stored key

**Section 2: Model Defaults**

- **Content Provider** dropdown → **Content Model** dropdown
  - Provider: OpenAI / Anthropic / Google / DeepSeek / Mimo
  - Model dropdown filters by selected provider
  - Each model shows: `label` + `role` tag + price badge (`$2.50/$10.00 per 1M`)
- **Image Provider** dropdown → **Image Model** dropdown
  - Provider: OpenAI / Google / BFL
  - Model dropdown filters by selected provider
  - Each model shows: `label` + `role` tag + price badge (`$0.05/image`)

**Section 3: Integrations** (existing, unchanged)
- EasyWeek status, WayForPay status, Monobank status

### Generation Override

When triggering generation (existing lead → generate flow):
- Show current default model (from settings) as pre-selected
- Dropdown to override: same provider → model cascade as Settings
- If no override selected, use default

### New Components

| File | Purpose |
|------|---------|
| `apps/frontend/src/lib/components/settings/ModelSelector.svelte` | Provider → Model cascading dropdowns with pricing badges |
| `apps/frontend/src/lib/components/settings/ApiKeyInput.svelte` | Password field with masked display + clear button |

---

## Data Flow

### Settings Read

```
Browser → GET /settings → SettingsController → SettingsService
  ↓
SettingsService.get('llm_provider'):
  1. this.repository.findByKey('llm_provider')  → DB query
  2. if null → process.env.LLM_PROVIDER          → env fallback
  3. if null → 'openai'                          → default
  ↓
Response: { key: 'llm_provider', value: 'openai', source: 'db' | 'env' | 'default' }
```

### Settings Write

```
Browser → PUT /settings { openai_api_key: 'sk-new-key', llm_model: 'gpt-4o-mini' }
  ↓
SettingsController → SettingsService.update(dto)
  ↓
For each field:
  - If key is an API key → encrypt(value) → upsert Setting row
  - If key is config → value → upsert Setting row
  ↓
Response: { saved: ['openai_api_key', 'llm_model'] }
```

### Generation with Model Selection

```
Lead → "Generate Site" → modal shows default model from settings
  ↓
User optionally overrides model
  ↓
POST /generation/generate { leadId, model?: 'gpt-4o-mini', imageModel?: 'flux-1-pro' }
  ↓
GenerationService:
  llmModel = model || settingsService.get('llm_model')
  imageModel = imageModel || settingsService.get('image_model')
  ↓
LLMStrategyFactory.create(provider, { model: llmModel })
ImageStrategyFactory.create(provider, { model: imageModel })
```

---

## Migration

### Prisma Migration

```sql
CREATE TABLE "Setting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Data Migration (manual)

No automatic migration. On first deployment:
1. DB is empty → all settings fall back to `.env`
2. Admin enters API keys + model preferences in WebUI
3. Settings saved to DB → DB becomes primary source
4. `.env` values remain as fallback if DB row is deleted

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| API key leak via DB dump | AES-256-GCM encryption, `ENCRYPTION_KEY` only in `.env` |
| New strategy fails on first use | Keep existing strategies unchanged, add new as separate classes, fallback to known-good models |
| WebUI UX complexity | Two clear sections, cascading dropdowns prevent invalid combinations |
| DB unavailable → settings lost | Env fallback ensures service continues to work |
| `ENCRYPTION_KEY` rotation | Manual: decrypt old, re-encrypt new. Out of scope for this PR. |

---

## Testing

### Unit Tests

- `EncryptionService`: encrypt/decrypt round-trip, wrong key fails, empty key no-op
- `SettingsService`: DB read → env fallback → default chain, write encrypts keys, read decrypts
- `SettingsRepository`: CRUD operations
- Each new strategy: construction with API key + model, API call format

### Integration Tests

- `GET /settings`: returns masked keys, model registry
- `PUT /settings`: saves encrypted, reads decrypted
- `GET /settings/models`: returns full registry with pricing
- DB fallback: delete row → reads from env

### E2E Tests (Playwright)

- Settings page: fill API key → save → reload → masked key shown
- Settings page: select provider → model dropdown filters
- Settings page: change model → save → generation uses new default

---

## Rollout

1. Prisma migration for `Setting` table
2. Backend: encryption + settings repository + service updates
3. Backend: new strategies (Gemini, Imagen, Flux)
4. Backend: updated controllers + factories
5. Frontend: new settings page components
6. Frontend: generation override modal
7. `.env.example` update
8. CI check (`lint`, `typecheck`, `test`, `build`)
