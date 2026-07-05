import type { Page, Route } from '@playwright/test';

/**
 * API response mocks for smoke testing.
 * All tests run against mocked backend — no database required.
 *
 * CRITICAL: Route patterns use http://localhost:3000 prefix to target
 * the backend API only. Using ** glob would also intercept the frontend
 * page URLs on port 5173, breaking page loads.
 */

const API = 'http://localhost:3000';

// ── Auth mocks ──────────────────────────────────────────────

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR';
}

export const DEFAULT_USER: MockUser = {
  id: 'mock-user-1',
  email: 'admin@promptsite.com',
  name: 'Test Admin',
  role: 'ADMIN',
};

export async function mockAuthLogin(page: Page, user: MockUser = DEFAULT_USER) {
  await page.route(`${API}/auth/login`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'mock-jwt-token',
      }),
      headers: {
        'Set-Cookie':
          'refresh_token=mock-refresh-token; Path=/; HttpOnly; SameSite=Strict',
      },
    });
  });

  await page.route(`${API}/auth/me`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });

  await page.route(`${API}/auth/refresh`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'mock-jwt-token-refreshed',
      }),
    });
  });
}

export async function mockAuthRegister(page: Page, user: MockUser = DEFAULT_USER) {
  await page.route(`${API}/auth/register`, async (route: Route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'mock-jwt-token',
      }),
    });
  });
}

export async function mockAuthError(page: Page, endpoint: 'login' | 'register' | 'me' | 'refresh') {
  // Use 400 instead of 401 — 401 triggers token refresh logic in ApiClient,
  // which would retry the request instead of showing the error.
  await page.route(`${API}/auth/${endpoint}`, async (route: Route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Invalid credentials',
      }),
    });
  });
}

export async function mockSessionExpired(page: Page) {
  // Return 401 for all API calls to trigger session expiry
  await page.route(`${API}/auth/refresh`, async (route: Route) => {
    await route.fulfill({ status: 401 });
  });
  await page.route(`${API}/auth/me`, async (route: Route) => {
    await route.fulfill({ status: 401 });
  });
}

// ── Dashboard stats mock ────────────────────────────────────

export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  activeProjects: number;
  publishedSites: number;
}

export const DEFAULT_STATS: DashboardStats = {
  totalLeads: 125,
  newLeads: 12,
  activeProjects: 8,
  publishedSites: 34,
};

export async function mockDashboardStats(page: Page, stats: DashboardStats = DEFAULT_STATS) {
  await page.route(`${API}/leads`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
  await page.route(`${API}/projects`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

// ── Leads mocks ──────────────────────────────────────────────

export interface MockLead {
  id: string;
  businessName: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  description: string | null;
  source: string;
  status: string;
  tags: string[];
  createdAt: string;
}

export function createMockLead(overrides: Partial<MockLead> = {}): MockLead {
  const id = overrides.id ?? `lead-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    businessName: 'Acme Corp',
    slug: 'acme-corp',
    phone: '+1-555-0100',
    email: 'john@acme.com',
    address: '123 Main St',
    city: 'New York',
    category: 'Technology',
    description: 'A tech company',
    source: 'Google Maps',
    status: 'NEW',
    tags: ['tech', 'b2b'],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export async function mockLeads(page: Page, leads: MockLead[] = []) {
  await page.route(`${API}/leads`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(leads),
      });
    } else if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createMockLead(body)),
      });
    } else {
      await route.continue();
    }
  });

  // Mock individual lead endpoints
  await page.route(`${API}/leads/*`, async (route: Route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(leads[0] ?? createMockLead()),
      });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(leads[0] ?? createMockLead()),
      });
    }
  });
}

// ── Projects mocks ──────────────────────────────────────────

export interface MockProject {
  id: string;
  leadId: string;
  slug: string;
  status: string;
  hugoConfig: Record<string, unknown>;
  publishedUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  lead?: {
    id: string;
    businessName: string;
    category: string | null;
  };
}

export function createMockProject(overrides: Partial<MockProject> = {}): MockProject {
  const id = overrides.id ?? `proj-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    leadId: 'lead-1',
    slug: 'acme-website',
    status: 'PUBLISHED',
    hugoConfig: { theme: 'hugo-theme-zen' },
    publishedUrl: 'https://acme.sitenow.pp.ua',
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    lead: {
      id: 'lead-1',
      businessName: 'Acme Corp',
      category: 'Technology',
    },
    ...overrides,
  };
}

export async function mockProjects(page: Page, projects: MockProject[] = []) {
  await page.route(`${API}/projects`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(projects),
      });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createMockProject()),
      });
    } else {
      await route.continue();
    }
  });

  // Mock individual project endpoints
  await page.route(`${API}/projects/*`, async (route: Route) => {
    const url = route.request().url();
    if (url.includes('/generate')) {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'gen-job-1', status: 'PENDING' }),
      });
    } else if (url.includes('/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
    } else if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(projects[0] ?? createMockProject()),
      });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(projects[0] ?? createMockProject()),
      });
    }
  });
}

// ── Settings mocks ──────────────────────────────────────────

export interface MockSettings {
  llmProvider: string;
  baseDomain: string;
  widgets: {
    easyweek: { enabled: boolean; accountId: string };
    wayforpay: { enabled: boolean; merchantId: string };
    monobank: { enabled: boolean; token: string };
  };
}

export const DEFAULT_SETTINGS: MockSettings = {
  llmProvider: 'anthropic',
  baseDomain: 'sitenow.pp.ua',
  widgets: {
    easyweek: { enabled: false, accountId: '' },
    wayforpay: { enabled: false, merchantId: '' },
    monobank: { enabled: false, token: '' },
  },
};

export async function mockSettings(page: Page, settings: MockSettings = DEFAULT_SETTINGS) {
  await page.route(`${API}/settings`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(settings),
      });
    } else if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...settings, ...body }),
      });
    } else {
      await route.continue();
    }
  });
}

// ── Theme / Generation mocks ────────────────────────────────

export async function mockThemes(page: Page) {
  await page.route(`${API}/generation/themes`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        themes: [
          { id: 'hugo-theme-zen', name: 'Zen', category: 'Minimal' },
          { id: 'ananke', name: 'Ananke', category: 'Business' },
          { id: 'blowfish', name: 'Blowfish', category: 'Minimal' },
          { id: 'hugoplate', name: 'Hugoplate', category: 'Landing' },
        ],
      }),
    });
  });
}

// ── Health check mock ───────────────────────────────────────

export async function mockHealthCheck(page: Page) {
  await page.route(`${API}/health`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        database: true,
        redis: true,
        hugo: 'hugo v0.139.0',
      }),
    });
  });
}

// ── Convenience: mock everything needed for full app ─────────

export async function mockAllApi(page: Page) {
  await mockHealthCheck(page);
  await mockAuthLogin(page);
  await mockAuthRegister(page);
  await mockDashboardStats(page);
  await mockLeads(page);
  await mockProjects(page);
  await mockSettings(page);
  await mockThemes(page);
}

// ── Session helpers ─────────────────────────────────────────

/**
 * Set auth cookie directly to simulate logged-in state without login flow.
 */
export async function setAuthCookie(page: Page) {
  await page.context().addCookies([
    {
      name: 'refresh_token',
      value: 'mock-refresh-token',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ]);
}
