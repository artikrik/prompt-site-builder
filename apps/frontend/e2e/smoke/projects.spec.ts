import { test, expect } from '@playwright/test';
import {
  mockAuthLogin,
  mockProjects,
  mockThemes,
  mockHealthCheck,
  setAuthCookie,
  createMockProject,
} from '../fixtures/api-mocks';

test.describe('Projects @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockHealthCheck(page);
    await mockAuthLogin(page);
    await mockProjects(page, [
      createMockProject({ slug: 'acme-website', status: 'PUBLISHED' }),
      createMockProject({ slug: 'globex-site', status: 'DRAFT' }),
    ]);
    await mockThemes(page);

    await setAuthCookie(page);

    // Login
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email address').fill('admin@promptsite.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');

    // Navigate to projects via sidebar
    await page.getByRole('link', { name: 'Projects' }).click();
    await page.waitForURL('/dashboard/projects');
  });

  test('should display projects page', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Projects');
  });

  test('should display project data', async ({ page }) => {
    // The projects table shows lead.businessName and slug
    await expect(page.getByText('acme-website')).toBeVisible();
    await expect(page.getByText('globex-site')).toBeVisible();
  });
});
