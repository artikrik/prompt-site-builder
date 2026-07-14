# Prompt Site Builder — Повний опис проекту для аналізу

## 1. Що це за проект

**Prompt Site Builder** — це B2B SaaS-платформа для автоматичного створення сайтів-візиток для українського малого бізнесу. Платформа дозволяє:

1. Знаходити бізнеси через скрапінг Google Maps та Instagram
2 Збагатувати дані з кількох джерел (Google Maps, Facebook, Instagram)
3. Генерувати повноцінні сайти за допомогою AI (LLM + Hugo SSG)
4. Публікувати сайти на піддоменах (*.sitenow.pp.ua) з автоматичним TLS

**Цільова аудиторія**: український малий бізнес — салони краси, медичні клініки, будівельні компанії, автосервіси, логістичні компанії.

**Стек**: NestJS 11 + SvelteKit 2 + PostgreSQL + Redis + BullMQ + Hugo SSG + Caddy

---

## 2. Архітектура

### Монорепозиторій (Turborepo)

```
prompt-site-builder_mimo2/
├── apps/
│   ├── backend/          # NestJS 11 API сервер
│   └── frontend/         # SvelteKit 2 адмін-панель
├── packages/
│   └── shared/           # Спільні типи та енуми
├── client-sites/         # Hugo-зібрані сайти клієнтів (обслуговуються Caddy)
├── docker/               # Dockerfile, Caddyfile
├── scripts/              # Dev/CI/deploy скрипти
└── docs/                 # Документація
```

### Інфраструктура (Docker Compose — 5 сервісів)

| Сервіс | Образ | Порт | Призначення |
|--------|-------|------|-------------|
| `caddy` | caddy:2-alpine | 80, 443 | Реверсний проксі, TLS, обслуговування статичних файлів |
| `postgres` | postgres:16-alpine | 5432 | База даних |
| `redis` | redis:7-alpine | 6379 | Кеш + BullMQ брокер завдань |
| `backend` | Docker backend | 3000 | NestJS API + Hugo компілятор |
| `frontend` | Docker frontend | 5173 | SvelteKit дашборд |

Спільний volume: `./var/www/client-sites` — вихідні дані Hugo, обслуговуються Caddy.

---

## 3. База даних (Prisma — 12 моделей)

### Основні моделі

| Модель | Призначення | Ключові поля |
|--------|-------------|-------------|
| **User** | Акаунти адміністраторів/операторів | id, email, passwordHash, name, role (ADMIN/OPERATOR) |
| **Lead** | Бізнес-ліди | id, businessName, slug (унікальний), phone, email, address, city, category, source, status (NEW→CONTACTED→QUALIFIED→CONVERTED→REJECTED), scrapedData, enrichmentData, конфіг оплати (easyweek/wayforpay/monobank) |
| **Project** | Проєкти сайтів, прив'язані до лідів | id, leadId, slug (унікальний), status (DRAFT→GENERATING→GENERATED→PUBLISHING→PUBLISHED→FAILED), hugoConfig, publishedUrl, activeVariantId |
| **SiteVariant** | A/B-варіанти згенерованих сайтів | id, projectId, variantName, status, hugoConfig, content, modelUsed, themeName, previewUrl |
| **GenerationJob** | Завдання з генерації/скрапінгу/збагачення | id, projectId, variantId, type (SCRAPE_LEAD/ENRICH_LEAD/GENERATE_SITE/PUBLISH_SITE), status, result, error, attempts |
| **ProjectAddon** | Активні додатки проєкту | id, projectId, addonType (ONLINE_PAYMENT/ONLINE_BOOKING/CONTENT_MANAGEMENT), status, config |
| **SiteAsset** | Зображення для сайтів | id, projectId, variantId, filePath, assetType (HERO/LOGO/THUMBNAIL/GALLERY) |
| **Setting** | Налаштування додатку (key-value) | id, key (унікальний), value, category |
| **ClientWidget** | Віджети для клієнтських сайтів | id, projectId, type (BOOKING/PAYMENT), config, enabled |
| **CategoryPrompt** | Кастомні AI-промпти за категоріями | id, category (унікальний), contentPrompt, designPrompt, competitorPrompt |
| **SystemLog** | Логи додатку | id, level, module, message, details |
| **ScrapingLog** | Логи операцій скрапінгу | id, leadId, jobId, source, action, status, duration |

---

## 4. Backend (NestJS 11) — 14 модулів

### Модулі

| Модуль | Призначення |
|--------|-------------|
| **auth** | Реєстрація, логін, JWT-токени, refresh-токени через httpOnly cookies. Перший користувач отримує роль ADMIN. |
| **leads** | CRUD для бізнес-лідів. Генерація slug з кирилиці. Шифрування полів оплати. Автозбагачення при створенні. Фільтрація/пошук. |
| **projects** | CRUD для проєктів сайтів, прив'язаних до лідів. Управління життєвим циклом. Підмодуль variants для A/B-тестування. |
| **generation** | **Ядро платформи** — пайплайн AI-генерації сайтів: LLM-генерація контенту → створення зображень → Hugo-компіляція → публікація. |
| **publishing** | Публікація сайтів через символічні посилання. Управління маппінгом slug→variant-директорія. |
| **scraping** | Веб-скрапінг через Apify (Google Maps) та Instagram. Створення лідів зі скрапованих даних. |
| **enrichment** | Багатоджерельне збагачення даних (Google Maps, Facebook, Instagram). Злиття результатів, AI-аналіз, генерація sales-скриптів. |
| **queue** | Черги BullMQ для generation, scraping, enrichment. Створення та статуси завдань. |
| **settings** | Налаштування додатку з fallback: DB → env → defaults. Шифрування API-ключів. |
| **categories** | Управління категоріями бізнесу з кастомними AI-промптами (контент, дизайн, конкуренти). |
| **addons** | Система додатків: ONLINE_PAYMENT (WayForPay/MonoBank), ONLINE_BOOKING (EasyWeek), CONTENT_MANAGEMENT. Ін'єкція віджетів у згенеровані сайти. |
| **widgets** | Конфігурація віджетів для клієнтських сайтів (бронювання, оплата). |
| **health** | Health-check: перевірка БД, Redis, Hugo binary. |
| **logs** | Системне логування в БД. Логи скрапінгу з трекінгом тривалості. |

### Ключові сервіси

| Сервіс | Роль |
|--------|------|
| `GenerationService` | Оркеструє повний пайплайн: LLM → Hugo → зображення → публікація |
| `HugoCompilerService` | Створює Hugo-проєкт, встановлює теми, запускає `hugo --minify`, копіює вихід |
| `HugoValidatorService` | Валідація згенерованого Hugo-контенту |
| `SitePublisherService` | Файлова публікація з символічними посиланнями |
| `PromptBuilder` | Будує AIDA-промпти з тематичними та категоричними гайдами |
| `DefaultContentBuilder` | Fallback-контент українською мовою при помилці LLM |
| `ThemeService` / `ThemeSelector` | Реєстр тем (13 Hugo-тем) та AI-вибір теми |
| `LLMStrategyFactory` | Стратегії LLM: OpenAI, Anthropic, DeepSeek, MiMo, Gemini, OpenRouter |
| `ImageStrategyFactory` | Стратегії зображень: DALL-E 3, Flux/BFL, Imagen |
| `EnrichmentFactory` | Провайдери збагачення: Google Maps, Facebook |
| `AddonInjectorService` | Ін'єкція payment/booking/CMS шорткодів у згенеровані сайти |
| `EncryptionService` | AES-256 шифрування API-ключів та секретів оплати |
| `CacheService` | Redis-кеш з TTL та prefix-інвалідацією |
| `QueueService` | Управління 3 чергами BullMQ (generation, scraping, enrichment) |

### Guards

| Guard | Стан |
|-------|------|
| `JwtAuthGuard` | Активний — використовується на більшості контролерів |
| `RolesGuard` | Існує, але **НЕ підключений** в app.module.ts |
| `ThrottlerGuard` | Активний — 20 запитів/60с глобально; auth має жорсткіші ліміти |

---

## 5. Frontend (SvelteKit 2) — Адмін-панель

### Маршрути

| Маршрут | Сторінка |
|---------|----------|
| `/` | Лендінг з hero, картками фіч, кнопками login/dashboard |
| `/auth/login` | Форма логіну (email + пароль) |
| `/auth/register` | Форма реєстрації |
| `/dashboard` | Огляд статистики (ліди, проєкти, сайти) + останні проєкти |
| `/dashboard/leads` | Список лідів з пошуком, фільтрами (статус, місто), CRUD |
| `/dashboard/leads/[id]` | Деталі ліда з табами: Details, Enrichment, Projects, Scraping |
| `/dashboard/projects` | Список проєктів з бейджами статусу |
| `/dashboard/projects/[id]` | Деталі проєкту: Hugo-конфіг, variants, generate/regenerate |
| `/dashboard/variants/[variantId]` | Деталі variant |
| `/dashboard/logs` | Системні логи, логи генерації, логи скрапінгу |
| `/dashboard/settings` | Налаштування: вибір LLM/image провайдерів, API-ключі |
| `/dashboard/settings/categories` | Управління категоріями з кастомними промптами |

### Компоненти

| Компонент | Призначення |
|-----------|-------------|
| `GenerateModal` | Модалка запуску генерації з вибором теми |
| `PaymentProviderCard` | Конфігурація EasyWeek, WayForPay, MonoBank |
| `VariantCard` / `VariantList` / `VariantGenerator` / `VariantPreview` | Управління A/B-variant |
| `AddonCard` / `AddonList` | Активація/деактивація додатків |
| `EnrichmentPanel` / `EnrichButton` / `BrandCard` / `CompetitorCard` / `SalesScriptPanel` | Панель збагачення даних |
| `ApiKeyInput` / `ModelSelector` | Налаштування API-ключів та моделей |

UI-компоненти: shadcn-svelte (badge, button, card, dialog, input, label, select, separator, skeleton, table)

### Stores

| Store | Призначення |
|-------|-------------|
| `auth` | Логін, реєстрація, logout, refresh токенів, обробка закінчення сесії |
| `leads` | Fetch, create, update, delete, scrape лідів. Фільтри. |
| `projects` | Fetch, create, generate, delete проєктів |
| `variants` | Fetch, create, activate, delete variant |
| `enrichment` | Fetch даних збагачення, trigger enrichment |
| `addons` | Управління додатками |

### API-клієнт

- Автовизначення базового URL (localhost:3000 для dev, `/api` для продакшну через Caddy)
- JWT-менеджмент з автоматичним refresh при 401
- Подія session expiry

---

## 6. AI-пайплайн генерації сайтів

### Потік даних

```
Тригер (POST /generation/:projectId/generate)
    │
    ▼
Вибір теми (якщо "auto" → AI вибирає тему за категорією)
    │
    ▼
Черга BullMQ → GenerationService.generateSite()
    │
    ▼
┌─────────────────────────────────────────────────┐
│ 1. Розв'язання провайдерів: LLM + модель з Settings │
│ 2. Створення SiteVariant запису                   │
│ 3. LLM-виклик:                                    │
│    - PromptBuilder.buildHugoPrompt()              │
│      • Бізнес-контекст (назва, категорія, опис)    │
│      • Тематичний гайд (params, sections, frontmatter)│
│      • Категоричний гайд (салон, медицина, будівництво)│
│      • Технічні вимоги (hugo.toml, JSON-LD, SEO)    │
│      • Структура лендінгу (9 секцій: hero, problem/ │
│        solution, services, trust, how-it-works,     │
│        testimonials, FAQ, CTA, footer)              │
│    - LLM повертає JSON:                            │
│      { hugoToml, indexMd, aboutMd, servicesMd,    │
│        contactMd, heroImagePrompt, seoTitle,       │
│        seoDescription }                            │
│ 4. Fallback: DefaultContentBuilder (укр. контент)   │
│ 5. Ін'єкція додатків (payment/booking/CMS)         │
│ 6. Генерація hero-зображення (DALL-E 3 / Flux)    │
│ 7. Hugo-компіляція:                                │
│    - Створення Hugo-проєкту                        │
│    - Встановлення теми (git clone → tarball → stub) │
│    - hugo --minify (60s timeout)                   │
│    - Копіювання public/                            │
│ 8. Fallback: generateStaticSite() (plain HTML)     │
│ 9. Публікація: symlink slug → slug--variantId      │
│ 10. Оновлення записів (Project, Variant, Job)       │
└─────────────────────────────────────────────────┘
```

### Hugo-теми (13 зареєстрованих)

| Тема | Категорія | Для кого |
|------|-----------|----------|
| hugo-theme-zen | minimal | Прості сайти, контент-фокус |
| ananke | business | Консалтинг, юридичні послуги |
| hugo-fresh | landing | Медицина, клінінг, ветеринарія |
| hugo-hero-theme | landing | Салони краси, спортзали |
| hugo-up-business | business | Корпоративні, B2B-послуги |
| hugo-universal-theme | business | Будівництво, нерухомість, авто |
| hugo-scroll | landing | Сантехніки, логістика |
| corporio | business | Агентства, консалтинг |
| hugoplate | landing | SaaS, стартапи |
| blowfish | minimal | Tech-компанії, портфоліо |
| congo | minimal | Простий бізнес, персональні бренди |
| hugo-theme-stack | blog | Контент-орієнтовані сайти |
| PaperMod | blog | Мінімалістичні, швидкі, SEO-оптимізовані |

### Маппінг категорія→тема

- Юриспруденція, Консалтинг → ananke
- Медицина, Клінінг, Ветеринарія → hugo-fresh
- Салони краси, Спортзали → hugo-hero-theme
- Будівництво, Нерухомість, Авто → hugo-universal-theme
- Сантехніки, Логістика → hugo-scroll

### Структура Hugo-проєкту

```
client-sites/<slug>/
├── hugo.toml              # AI-згенерований конфіг
├── content/
│   ├── index.md           # Головна (9-секційний лендінг)
│   ├── about.md           # Про компанію
│   ├── services.md        # Послуги з цінами
│   └── contact.md         # Контакти, карта, години роботи
├── layouts/
│   ├── partials/          # Хедери, футери, віджети
│   └── shortcodes/        # Payment, booking, CMS шорткоди
├── static/images/         # Hero-зображення (JPG або SVG-fallback)
├── archetypes/default.md
└── themes/<theme>/        # Git-клонована тема
```

---

## 7. Мережева архітектура (Caddy)

### Маршрутизація

| Домен | Маршрутизація |
|-------|---------------|
| `https://sitenow.pp.ua` | `/api/*` → backend:3000; `/variant-preview/*` → статичні файли; решта → frontend:5173 |
| `https://api.sitenow.pp.ua` | Проксі до backend:3000 |
| `https://*.sitenow.pp.ua` | On-Demand TLS, обслуговування з `/var/www/client-sites/{subdomain}` |

### Особливості

- On-Demand TLS — автоматичне видачення сертифікатів для нових піддоменів
- Precompressed gzip/br для статичних файлів
- SPA fallback для клієнтських сайтів
- Immutable cache headers
- HTTP → HTTPS редиректи

---

## 8. Аутентифікація та авторизація

### Потік

1. **Register** (`POST /auth/register`): access token + httpOnly refresh cookie
2. **Login** (`POST /auth/login`): access token + httpOnly refresh cookie
3. **Refresh** (`POST /auth/refresh`): читає refresh token з cookie → новий access token
4. **Logout** (`POST /auth/logout`): очищає refresh cookie

### Ліміти

- Реєстрація: 3/годину
- Логін: 5/хвилину
- Глобально: 20/хвилину

### RBAC

- `JwtAuthGuard` — активний на більшості контролерів
- `RolesGuard` — існує, але **не підключений** (potentian security issue)

---

## 9. Додатки (Add-ons)

| Додаток | Опис | Інтеграція |
|---------|------|-----------|
| **ONLINE_PAYMENT** | Онлайн-оплата | WayForPay (форма) + MonoBank (посилання) |
| **ONLINE_BOOKING** | Онлайн-запис | EasyWeek (форма бронювання) |
| **CONTENT_MANAGEMENT** | Управління контентом | CMS-панель з content-editable маркерами |

Додатки ін'єктуються через `AddonInjectorService` як шорткоди Hugo.

---

## 10. Конфігурація середовища

### Ключові змінні

| Змінна | Опис |
|--------|------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Секрет для JWT-токенів |
| `JWT_REFRESH_SECRET` | Секрет для refresh-токенів |
| `FRONTEND_URL` | URL фронтенду |
| `BASE_DOMAIN` | Базовий домен (sitenow.pp.ua) |
| `HUGO_SITES_PATH` | Шлях до Hugo-сайтів |
| `OPENAI_API_KEY` | API-ключ OpenAI |
| `ANTHROPIC_API_KEY` | API-ключ Anthropic |
| `DEEPSEEK_API_KEY` | API-ключ DeepSeek |

---

## 11. Технічні особливості

### LLM-провайдери

- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude)
- DeepSeek (deepseek-v4-flash, deepseek-v4-pro)
- MiMo (xiaomi/mimo-v2.5)
- Gemini (Google)
- OpenRouter (універсальний)

### Стратегії генерації зображень

- DALL-E 3 (OpenAI)
- Flux/BFL (BFL)
- Imagen (Google)

### Тестування

- **Backend**: Vitest (286 тестів — unit + E2E)
- **Frontend**: Vitest + Playwright E2E (17 тестів)
- **CI**: lint → typecheck → test → build (bash scripts/ci-local.sh)

### Деплой

- Docker Compose (основний)
- Coolify (альтернативний)
- GitHub Actions CI/CD
- SSH до production (192.168.31.22)

---

## 12. Відомі проблеми та TODO

1. **RolesGuard не підключений** — будь-хто з JWT може виконувати admin-дії
2. **validateEnv() не викликається при старті** — помилки конфігурації не ловляться рано
3. **Hugo build часто падає** через мережеві проблеми при git clone тем → fallback на plain HTML
4. **CSS генерується динамічно** в `getStaticFallbackCss()` — не використовується справжній Hugo темплейтинг
5. **Rolling hills SVG** на деяких темах — AI- tell, потребує заміни на реальні зображення

---

## 13. API Endpoints (повний список)

### Auth
- `POST /auth/register` — реєстрація
- `POST /auth/login` — логін
- `POST /auth/refresh` — оновлення токена
- `POST /auth/logout` — вихід
- `GET /auth/me` — поточний користувач

### Leads
- `GET /leads` — список лідів
- `POST /leads` — створення ліда
- `GET /leads/:id` — деталі ліда
- `PUT /leads/:id` — оновлення ліда
- `DELETE /leads/:id` — видалення ліда
- `POST /leads/:id/scrape` — запуск скрапінгу
- `GET /leads/:id/scrape-status` — статус скрапінгу

### Projects
- `GET /projects` — список проєктів
- `POST /projects` — створення проєкту
- `GET /projects/:id` — деталі проєкту
- `PUT /projects/:id` — оновлення проєкту
- `DELETE /projects/:id` — видалення проєкту

### Generation
- `POST /generation/:projectId/generate` — генерація сайту
- `GET /generation/themes` — список тем
- `GET /generation/models` — список моделей
- `GET /generation/:projectId/status` — статус генерації
- `GET /generation/:projectId/history` — історія генерацій

### Variants
- `GET /projects/:id/variants` — список variant
- `POST /projects/:id/variants` — створення variant
- `GET /variants/:id` — деталі variant
- `PUT /variants/:id` — оновлення variant
- `DELETE /variants/:id` — видалення variant
- `PUT /variants/:id/activate` — активація variant

### Settings & Categories
- `GET /settings` — отримання налаштувань
- `PUT /settings` — оновлення налаштувань
- `GET /categories` — список категорій
- `PUT /categories/:category` — оновлення категорії

### Addons
- `GET /addons/:projectId` — список додатків
- `POST /addons/:projectId/activate` — активація додатку
- `PUT /addons/:projectId/:type/config` — конфігурація додатку
- `DELETE /addons/:projectId/:type` — деактивація додатку

### Health & Logs
- `GET /health` — health-check
- `GET /logs` — системні логи + логи скрапінгу

---

## 14. Команди розробки

```bash
# Запуск розробки
turbo dev

# Збірка
turbo build

# Тести
turbo test

# Лінтинг
turbo lint

# Перевірка типів
turbo typecheck

# Локальний CI (обов'язково перед комітом)
bash scripts/ci-local.sh

# Генерація Hugo-сайту
hugo --source ./client-sites/<slug>
```

---

## 15. Branching та PR

### Гілки

- `feat/<name>` — нові фічі
- `fix/<name>` — фікси
- `refactor/<name>` — рефакторинг
- Тільки squash merge
- Status checks: lint, typecheck, test-backend, test-frontend
- Заборонені: force push, видалення гілок

### PR-процес (обов'язковий)

1. Відкрити PR
2. Code Review через `superpowers:requesting-code-review`
3. Виправити всі Critical та Important знахідки
4. Перезапустити CI — переконатися в зеленому статусі
5. Squash merge через `gh pr merge --squash --delete-branch`
