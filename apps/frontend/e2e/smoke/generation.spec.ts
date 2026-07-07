import { test, expect } from '@playwright/test';
import {
  mockAuthLogin,
  mockAuthRegister,
  mockHealthCheck,
  mockProjects,
  mockThemes,
  mockVariants,
  mockGeneration,
  setAuthCookie,
  createMockProject,
  createMockVariant,
} from '../fixtures/api-mocks';

test.describe('Generation Flow @smoke', () => {
  const testProject = createMockProject({
    id: 'proj-gen-1',
    slug: 'acme-website',
    status: 'DRAFT',
    lead: { id: 'lead-1', businessName: 'Acme Corp', category: 'Technology' },
  });

  const testVariant = createMockVariant({
    id: 'var-gen-1',
    projectId: 'proj-gen-1',
    variantName: 'Variant Alpha',
    status: 'GENERATED',
    modelUsed: 'claude-sonnet-5',
    themeName: 'ananke',
  });

  test.beforeEach(async ({ page }) => {
    await mockHealthCheck(page);
    await mockAuthLogin(page);
    await mockAuthRegister(page);
    await mockProjects(page, [testProject]);
    await mockThemes(page);
    await mockVariants(page, [testVariant]);
    await mockGeneration(page);

    await setAuthCookie(page);

    // Login
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email address').fill('admin@promptsite.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');
  });

  /**
   * Helper: navigate to project detail page.
   * Projects page uses an eye icon button (last button in row) for navigation.
   */
  async function goToProjectDetail(page: import('@playwright/test').Page, slug: string) {
    await page.getByRole('link', { name: 'Projects' }).click();
    await page.waitForURL('/dashboard/projects');

    // Click the eye icon button (last button in the row containing the slug)
    const row = page.locator('tr', { hasText: slug });
    await row.getByRole('button').last().click();
    await page.waitForURL(/\/dashboard\/projects\//);
  }

  test('should display project detail with variants section', async ({ page }) => {
    await goToProjectDetail(page, 'acme-website');

    // Verify project info
    await expect(page.getByText('Acme Corp')).toBeVisible();

    // Verify variants section
    await expect(page.getByText('Variants')).toBeVisible();
    await expect(page.getByText('Variant Alpha')).toBeVisible();

    // Verify generate controls
    await expect(page.getByRole('button', { name: 'Generate Site' })).toBeVisible();
  });

  test('should display generate button and theme selector', async ({ page }) => {
    await goToProjectDetail(page, 'acme-website');

    // Theme selector visible (shadcn-svelte select trigger)
    await expect(page.locator('[data-slot="select-trigger"]')).toBeVisible();

    // Generate button enabled for DRAFT project
    const generateBtn = page.getByRole('button', { name: 'Generate Site' });
    await expect(generateBtn).toBeEnabled();
  });

  test('should list variants for project', async ({ page }) => {
    await goToProjectDetail(page, 'acme-website');

    // Variant appears in list with name and status
    await expect(page.getByText('Variant Alpha')).toBeVisible();
    await expect(page.getByText('GENERATED')).toBeVisible();
  });

  test('should display correct project status and live site button', async ({ page }) => {
    const publishedProject = createMockProject({
      id: 'proj-pub-1',
      slug: 'published-site',
      status: 'PUBLISHED',
      publishedUrl: 'https://published-site.sitenow.pp.ua',
      lead: { id: 'lead-2', businessName: 'Published Co', category: 'Consulting' },
    });

    // Override the mock for this test
    await mockProjects(page, [publishedProject]);

    await page.getByRole('link', { name: 'Projects' }).click();
    await page.waitForURL('/dashboard/projects');

    const row = page.locator('tr', { hasText: 'published-site' });
    await row.getByRole('button').last().click();
    await page.waitForURL(/\/dashboard\/projects\//);

    // Published status badge and View Live Site button
    await expect(page.locator('[data-slot="badge"]').filter({ hasText: 'PUBLISHED' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Live Site' })).toBeVisible();
  });
});
