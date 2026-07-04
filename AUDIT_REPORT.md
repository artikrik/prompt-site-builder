# 🔍 Audit Report — Prompt Site Builder

**Дата:** 2026-07-04
**Проект:** SaaS-платформа AI-генерації B2B-сайтів
**Стек:** NestJS + SvelteKit 2 (Svelte 5) + Prisma/PostgreSQL + Redis + Hugo + Caddy + Docker

---

## 1. РІЗНИЦЯ: ВИМОГИ ↔ ІМПЛЕМЕНТАЦІЯ

### 1.1. Виконані вимоги ✅

| # | Вимога | Статус | Де реалізовано |
|---|--------|--------|----------------|
| 1 | Backend API на NestJS | ✅ | `apps/backend/` — 8 модулів, ~59 source-файлів |
| 2 | PostgreSQL + Prisma | ✅ | `apps/backend/prisma/schema.prisma` — 7 моделей, 7 enum |
| 3 | Redis + BullMQ | ✅ | `@nestjs/bullmq` + `bullmq` — черги для generation (3 retries) і scraping (2 retries) |
| 4 | Hugo генератор | ✅ | `hugo-compiler.service.ts` — 314 рядків, git clone тем, fallback-теми |
| 5 | Caddy reverse proxy | ✅ | `docker-compose.yml` + `docker/Caddyfile` — on-demand TLS для `*.sitenow.pp.ua` |
| 6 | Docker Compose | ✅ | `docker-compose.yml` — 5 сервісів + `docker/backend.Dockerfile` + `docker/frontend.Dockerfile` |
| 7 | CI/CD GitHub Actions | ✅ | `.github/workflows/` — ci.yml, deploy.yml, setup-runner.yml |
| 8 | Google Maps скрапінг (Apify) | ✅ | `scraping/providers/apify.provider.ts` |
| 9 | Instagram збагачення | ✅ | `scraping/providers/instagram.provider.ts` |
| 10 | LLM Strategy патерн | ✅ | `strategies/` — `ILLMStrategy` + `IImageGenerationStrategy` + Factory |
| 11 | Anthropic + OpenAI | ✅ | `anthropic.strategy.ts` + `openai.strategy.ts` |
| 12 | DALL-E 3 медіа | ✅ | `strategies/dalle3.strategy.ts` + placeholder SVG fallback |
| 13 | EasyWeek віджет | ✅ | `widgets/booking-widget.service.ts` — HTML генерація |
| 14 | WayForPay + Monobank | ⚠️ | `payment-widget.service.ts` — HTML є, але Monobank — порожній div без скрипта |
| 15 | SvelteKit Frontend | ✅ | `apps/frontend/` — 7 сторінок, 10 компонентних родин (43 `.svelte` файлів) |
| 16 | JWT Auth (access + refresh) | ✅ | `auth/` — register, login, refresh token |
| 17 | Role-based access | ✅ | `RolesGuard` + `@Roles()` декоратор — `ADMIN`, `OPERATOR` |
| 18 | Hugo теми (10 шт.) | ✅ | `theme-registry.ts` — zen, ananke, up-business, universal, corporio, hugoplate, blowfish, congo, stack, PaperMod |
| 19 | Hugo валідація | ✅ | `hugo-validator.service.ts` + spec |
| 20 | ENV валідація (Zod) | ✅ | `env.validation.ts` — 29 змінних, `z.object()` |
| 21 | ESLint + Prettier | ✅ | `.eslintrc.js` (no-unused-vars error, no-explicit-any error) + `.prettierrc` |
| 22 | TypeScript strict mode | ✅ | `tsconfig.base.json` — `strict: true` |
| 23 | Self-Hosted Runner CI | ✅ | `deploy.yml` + `setup-runner.yml` |
| 24 | Генерація placeholder при помилці DALL-E | ✅ | `generation.service.ts:generatePlaceholderSvg()` |

### 1.2. Частково виконані ⚠️

| # | Вимога | Проблема |
|---|--------|----------|
| 1 | **GDPR compliance** | Згадано в REQUIREMENTS.md:27. Жодного GDPR-коду: немає consent API, data export, right-to-delete |
| 2 | **Модель "сайт під ключ до моменту продажу"** | Немає CRM-логіки cold sales pipeline (дзвінки, email-кампанії, конверсії) |
| 3 | **Онлайн-бронювання (EasyWeek)** | Widget HTML генерується, але немає callback-ендпоінтів для підтвердження бронювання |
| 4 | **Платіжний шлюз (WayForPay/Monobank)** | HTML генерується, але немає IPN callback верифікації платежів. Monobank: порожній div без JS |
| 5 | **Фронтенд: Клієнтський портал** | Dashboard для операторів є. Клієнтський портал для перегляду сайту відсутній |
| 6 | **RolesGuard не підключено** | `RolesGuard` + `@Roles()` декоратор є, але **не зареєстровані в app.module.ts** і не використовуються на жодному ендпоінті. Усі JWT-користувачі мають однаковий доступ |
| 7 | **Caddy Admin API** | Caddyfile статичний. Динамічна реєстрація піддоменів через Caddy API не реалізована |

### 1.3. Не виконані ❌

| # | Вимога | Деталі |
|---|--------|--------|
| 1 | **Ізольовані мікросервіси (Clean Architecture)** | Моноліт NestJS. Немає message broker між модулями, немає мікросервісів |
| 2 | **Integration Testing** | Жодного integration-тесту. Тільки unit + 4 E2E |
| 3 | **Mocking зовнішніх API (КРИТИЧНА ВИМОГА)** | `generation.service.ts` — найскладніший сервіс (384 рядки) — 0 тестів. Інші тести мокають не все |
| 4 | **Frontend unit-тести** | CI очікує `test --workspace=apps/frontend`, але в `src/` 0 `.spec.ts` файлів |
| 5 | **Go бекенд (альтернатива)** | Вимоги: "NestJS або Go". Go відсутній |
| 6 | **Drizzle ORM (альтернатива)** | Вимоги: "Prisma (або Drizzle)". Тільки Prisma |

---

## 2. БАГИ ТА ПРОБЛЕМИ 🐛

### 2.1. Критичні (Runtime / Security)

| # | Файл:Рядок | Проблема | Фікс |
|---|-----------|----------|------|
| **B1** | `publishing/site-publisher.service.ts:77-81` | `fullPath.substring(0, fullPath.lastIndexOf('/'))` — на Windows `/` відсутній → `lastIndexOf` → -1 → `substring(0,-1)` → порожній рядок → `mkdir('')` → помилка | `path.dirname(fullPath)` |
| **B2** | `publishing/site-publisher.service.ts:85-89` | Аналогічно в `writeFileBinary()` | `path.dirname()` |
| **B3** | `generation/generation.service.ts:128` | `publishedUrl` хардкоджене: `http://localhost:3000/sites/${slug}`. В production має бути `https://${slug}.${BASE_DOMAIN}` | `https://${slug}.${this.configService.get('BASE_DOMAIN')}` |
| **B4** | `auth/auth.service.ts:81-86` | Refresh token підписується тим самим `JWT_SECRET` що й access token | Окремий `JWT_REFRESH_SECRET` |
| **B5** | `frontend/src/lib/stores/auth.ts:47` | Токени в `localStorage` — XSS-вразливість | httpOnly cookies з backend |
| **B6** | `frontend/src/routes/dashboard/+layout.svelte:12-17` | Auth guard клієнтський — flash контенту перед redirect. Немає `hooks.server.ts` | Server-side `hooks.server.ts` |
| **B7** | `shared/config/env.validation.ts:54` | `validateEnv()` визначено але **ніколи не викликається**. `ConfigModule` читає `.env` без валідації | Викликати в `main.ts` перед `app.listen()` |
| **B8** | `widgets/payment-widget.service.ts:71` | WayForPay використовує **HMAC-MD5** — криптографічно слабкий алгоритм | HMAC-SHA256 |

### 2.2. Середні

| # | Файл:Рядок | Проблема | Фікс |
|---|-----------|----------|------|
| **B9** | `generation/generation.service.ts:205-261` | `getDefaultHugoContent()` — український текст транслітерований латиницею ("Profesijna komanda fakhivtsiv") | Справжня українська |
| **B10** | `widgets/widgets.service.ts:95-97` | Monobank widget: порожній `<div id="monobank-widget"></div>` без конфігурації, без JS-скрипта | Додати Monobank SDK |
| **B11** | `leads/leads.service.ts:52-53` | `JSON.stringify(filter)` — нестабільний порядок ключів → різні cache keys | `JSON.stringify(filter, Object.keys(filter).sort())` |
| **B12** | `generation/generation.service.ts:356-376` | `mdToSimpleHtml()` — regex `[\s\S]*?` з backtracking на великих файлах | `marked` бібліотека |
| **B13** | `frontend/src/lib/api/client.ts:28-32` | Немає `cache: 'no-store'`, немає retry логіки, немає timeout | AbortController + retry |
| **B14** | `frontend/src/lib/stores/auth.ts` | `refreshToken` зберігається в localStorage але **ніколи не використовується** | Token refresh interceptor |
| **B15** | `widgets/widget-api.controller.ts:101` | `// TODO: Update project/order status based on payment confirmation` — єдиний TODO | Реалізувати IPN callback |
| **B16** | `backend/package.json` | `class-validator` + `class-transformer` є в deps але не використовуються. DTO — plain TypeScript interfaces без декораторів | Або видалити, або додати `@IsEmail`, `@IsString` тощо |

### 2.3. Низькі

| # | Файл:Рядок | Проблема |
|---|-----------|----------|
| **B14** | `hugo-compiler.service.ts:92-97` | `git clone` без перевірки наявності git у системі |
| **B15** | `frontend/src/routes/dashboard/leads/+page.svelte:50` | `alert('Failed to create lead')` — неприйнятно для production UI |
| **B16** | `frontend/src/routes/dashboard/settings/+page.svelte:75` | `<Label>LLM Provider</Label>` без `for` — не асоційовано з Select |
| **B17** | `frontend/src/routes/dashboard/+layout.svelte:33` | Sidebar 256px фіксований — немає mobile hamburger/collapse |
| **B18** | Весь фронтенд | Жодного `aria-label`, немає `role="main"`, немає skip-to-content |

---

## 3. ПРОГАЛИНИ В ТЕСТАХ 🧪

### 3.1. Покриття

| Шар | Source-файлів | Тестів | Покриття |
|-----|--------------|--------|----------|
| Backend services | 18 | 18 spec | 100% файлів |
| Backend controllers | 9 | 0 e2e | **0%** |
| HugoCompilerService | 1 | **0** | **0%** |
| LLM Strategies (4) | 4 | 1 (factory) | 25% |
| Frontend unit (stores/pages) | 7 | **0** | **0%** |
| Frontend E2E | 4 pages | 4 spec (8 tests) | Мінімальне |

### 3.2. Критично відсутні тести

| # | Що | Чому |
|---|-----|------|
| T1 | `hugo-compiler.service.ts` (314 рядків) | Child process spawn, git clone, файлова система — без тестів |
| T2 | `auth.controller.ts` | Login/register/refresh endpoints без controller E2E |
| T3 | `projects.controller.ts` | CRUD без контролерних тестів |
| T4 | `scraping.controller.ts` | Скрапінг без тестів |
| T5 | `widget-api.controller.ts` | Публічні Booking/Payment API без тестів |

---

## 4. ПОКРАЩЕННЯ ТА РЕКОМЕНДАЦІЇ 📈

### 4.1. Архітектура

| # | Пропозиція | Обґрунтування |
|---|------------|---------------|
| A1 | **Caddy Admin API** | Динамічна реєстрація піддоменів через `POST /config` замість статичного Caddyfile |
| A2 | **BullMQ замість EventEmitter** | Повноцінні черги з retry, backoff, scheduled jobs, dead letter queue |
| A3 | **Message broker між модулями** | Redis Pub/Sub для подій: `lead.created` → `scraping.enrich` → `generation.start` |
| A4 | **GDPR модуль** | Consent storage, data export API, right-to-delete |
| A5 | **Webhook callback endpoints** | EasyWeek booking confirm, WayForPay/Monobank IPN payment verify |
| A6 | **API versioning** | `/api/v1/...` префікс для майбутньої сумісності |

### 4.2. Безпека

| # | Пропозиція | Priority |
|---|------------|----------|
| S1 | Refresh token → httpOnly cookie (backend встановлює) | P0 |
| S2 | Окремий `JWT_REFRESH_SECRET` | P0 |
| S3 | Rate limiting на `/auth/login` (brute-force) | P1 |
| S4 | Helmet.js security headers | P1 |
| S5 | CSRF protection для dashboard | P1 |
| S6 | Input sanitization для phone/email/website | P1 |
| S7 | `hooks.server.ts` для server-side auth guard | P0 |

### 4.3. Якість коду

| # | Пропозиція |
|---|------------|
| Q1 | `site-publisher.service.ts` — `path.dirname()` замість `substring(lastIndexOf)` |
| Q2 | `getDefaultHugoContent()` — український контент |
| Q3 | Monobank widget — повна інтеграція з SDK |
| Q4 | Стабільний cache key: `JSON.stringify(filter, Object.keys(filter).sort())` |
| Q5 | `marked` бібліотека замість regex `mdToSimpleHtml()` |
| Q6 | `class-validator` + `class-transformer` є в deps але не використовуються — або видалити, або застосувати DTO валідацію |

### 4.4. Frontend

| # | Пропозиція |
|---|------------|
| F1 | Server-side auth guard (`hooks.server.ts`) — прибрати flash контенту |
| F2 | Token refresh interceptor в `ApiClient` |
| F3 | `alert()` → toast-нотифікації (bits-ui toast/sonner) |
| F4 | Mobile sidebar hamburger menu |
| F5 | SvelteKit form actions замість клієнтських fetch для auth |
| F6 | `aria-label` на інтерактивних елементах, семантичні landmark-и |
| F7 | Клієнтський портал для перегляду згенерованого сайту |

### 4.5. DevOps

| # | Пропозиція |
|---|------------|
| D1 | `.dockerignore` файл |
| D2 | Healthcheck для backend контейнера в docker-compose |
| D3 | Pre-commit hooks (Husky + lint-staged) |
| D4 | `docker/Caddyfile` — додати rate limiting |

---

## 5. НОВІ ФІЧІ 🚀

### Бізнес

| # | Фіча | Цінність |
|---|------|----------|
| N1 | **AI-скоринг лідів** — ML-оцінка "готовності до продажу" перед генерацією | Висока |
| N2 | **A/B варіанти сайтів** — 2-3 дизайни на вибір | Висока |
| N3 | **Авто-email ліду** — "ваш сайт готовий" після публікації | Висока |
| N4 | **Telegram-бот для операторів** — швидкий перегляд + публікація | Середня |
| N5 | **Вбудована аналітика (Plausible/Umami)** у кожен сайт | Середня |
| N6 | **White-label клієнтський портал** | Середня |
| N7 | **Auto-SEO аудит** після публікації | Середня |
| N8 | **Масовий CSV-імпорт лідів** | Середня |
| N9 | **Кастомні Hugo теми** — upload власних шаблонів | Низька |

### Технічні

| # | Фіча |
|---|------|
| N10 | Webhook-нотифікації (Slack/Discord) при зміні статусу |
| N11 | Графік масової генерації на ніч |
| N12 | Multi-tenant ізоляція (оператор бачить тільки своїх лідів) |
| N13 | Audit log (хто/коли змінював ліда/проект) |
| N14 | PDF-експорт звіту по ліду для cold sales |

---

## 6. МЕТРИКИ

| Метрика | Значення |
|---------|----------|
| Backend source-файлів | 59 |
| Frontend source-файлів | 66 (.svelte + .ts) |
| Unit тестів (backend) | 18 spec |
| E2E тестів (frontend) | 4 spec (8 тестів) |
| Controller E2E тестів | 0 |
| API ендпоінтів | 25 |
| Prisma моделей | 7 |
| Hugo тем у реєстрі | 10 |
| LLM провайдерів | 4 (Anthropic, OpenAI, DeepSeek, Mimo) |
| Зовнішніх API інтеграцій | 10 |
| Docker сервісів | 5 |
| CI/CD workflows | 3 |
| TODO в коді | 1 |

---

## 7. ПРІОРИТЕТИ ВИПРАВЛЕНЬ

### P0 — Блокує продакшн
1. **B1, B2**: `path.dirname()` у `site-publisher.service.ts`
2. **B3**: Production `publishedUrl`
3. **B4, S2**: Окремий `JWT_REFRESH_SECRET`
4. **B5, S1**: httpOnly cookies для токенів
5. **B7**: `validateEnv()` не викликається — `ConfigModule` читає `.env` без валідації
6. **B8**: WayForPay HMAC-MD5 → HMAC-SHA256
7. **T1**: Тести для `hugo-compiler.service.ts`

### P1 — Важливо
1. **RolesGuard**: Підключити в `app.module.ts` + додати `@Roles(ADMIN)` на критичні ендпоінти
2. **B9**: Український контент у default-шаблонах
3. **B10**: Monobank widget
4. **S7**: Server-side auth guard (`hooks.server.ts`)
5. **B14**: Token refresh interceptor
6. **B16**: Додати `class-validator` декоратори до DTO або видалити пакети

### P2 — Покращення
1. **A1**: Caddy Admin API
2. **N1-N9**: Бізнес-фічі
3. **F3**: Toast-нотифікації
4. **F6**: Accessibility
5. **D3**: Husky pre-commit hooks

---

## 8. ПІДСУМОК

**Загальна оцінка: 7/10**

Солідна архітектура, правильні патерни (Strategy, Factory, Module), повний CI/CD, хороша структура коду. Усі ключові вимоги реалізовані. Основні проблеми: відсутність тестів для критичного бізнес-пайплайну (GenerationService), небезпечне зберігання токенів у localStorage, використання EventEmitter замість BullMQ для черг, і неповна інтеграція з Caddy API для динамічних піддоменів. Frontend потребує server-side auth guard, token refresh логіки, accessibility-покращень та mobile-responsive sidebar.
