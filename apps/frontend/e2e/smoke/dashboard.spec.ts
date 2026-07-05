import { test, expect } from '@playwright/test';
import {
  mockAuthLogin,
  mockLeads,
  mockProjects,
  mockSettings,
  mockHealthCheck,
  setAuthCookie,
  createMockLead,
  createMockProject,
} from '../fixtures/api-mocks';

test.describe('Dashboard @smoke', () => {
  test.describe('Sidebar navigation (authenticated)', () => {
    test.beforeEach(async ({ page }) => {
      await mockHealthCheck(page);
      await mockAuthLogin(page);
      await mockLeads(page, [
        createMockLead({ businessName: 'Acme Corp' }),
        createMockLead({ businessName: 'Globex Inc', status: 'CONTACTED' }),
      ]);
      await mockProjects(page, [
        createMockProject({ slug: 'acme-website', status: 'PUBLISHED' }),
      ]);
      await mockSettings(page);

      // Set auth cookie so SvelteKit server hook allows dashboard access
      await setAuthCookie(page);

      // Login via mocked API to set in-memory auth state
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Email address').fill('admin@promptsite.com');
      await page.getByLabel('Password').fill('admin123');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL('/dashboard');
    });

    test('should display sidebar with all nav items', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: 'Prompt Site Builder' }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Leads' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    });

    test('should log out and redirect to login', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page).toHaveURL('/auth/login');
    });

    test('should navigate to leads via sidebar click', async ({ page }) => {
      // Use client-side navigation (click link, not page.goto)
      await page.getByRole('link', { name: 'Leads' }).click();
      await page.waitForURL('/dashboard/leads');
      await expect(page.locator('body')).toContainText('Leads');
    });

    test('should navigate to projects via sidebar click', async ({ page }) => {
      await page.getByRole('link', { name: 'Projects' }).click();
      await page.waitForURL('/dashboard/projects');
      await expect(page.locator('body')).toContainText('Projects');
    });

    test('should navigate to settings via sidebar click', async ({ page }) => {
      await page.getByRole('link', { name: 'Settings' }).click();
      await page.waitForURL('/dashboard/settings');
      await expect(page.locator('body')).toContainText('Settings');
    });

    test('should navigate back to overview via sidebar click', async ({ page }) => {
      // Go to leads first, then back to overview
      await page.getByRole('link', { name: 'Leads' }).click();
      await page.waitForURL('/dashboard/leads');
      await page.getByRole('link', { name: 'Overview' }).click();
      await page.waitForURL('/dashboard');
    });
  });

  test.describe('Auth guard', () => {
    test('should redirect to login when no auth cookie', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/auth/login');
    });

    test('should redirect to login from /dashboard/leads', async ({ page }) => {
      await page.goto('/dashboard/leads');
      await expect(page).toHaveURL('/auth/login');
    });

    test('should redirect to login from /dashboard/projects', async ({ page }) => {
      await page.goto('/dashboard/projects');
      await expect(page).toHaveURL('/auth/login');
    });
  });
});
