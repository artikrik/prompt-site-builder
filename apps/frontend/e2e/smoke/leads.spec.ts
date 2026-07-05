import { test, expect } from '@playwright/test';
import {
  mockAuthLogin,
  mockLeads,
  mockHealthCheck,
  setAuthCookie,
  createMockLead,
} from '../fixtures/api-mocks';

test.describe('Leads @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockHealthCheck(page);
    await mockAuthLogin(page);
    await mockLeads(page, [
      createMockLead({ businessName: 'Acme Corp', status: 'NEW' }),
      createMockLead({ businessName: 'Globex Inc', status: 'CONTACTED' }),
      createMockLead({ businessName: 'Initech', status: 'QUALIFIED' }),
    ]);

    await setAuthCookie(page);

    // Login
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email address').fill('admin@promptsite.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');

    // Navigate to leads via sidebar
    await page.getByRole('link', { name: 'Leads' }).click();
    await page.waitForURL('/dashboard/leads');
  });

  test('should display leads page', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Leads');
    await expect(page.getByRole('button', { name: 'Add Lead' }).first()).toBeVisible();
  });

  test('should display lead data in table', async ({ page }) => {
    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Globex Inc')).toBeVisible();
    await expect(page.getByText('Initech')).toBeVisible();
  });

  test('should open create lead modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Lead' }).first().click();
    await expect(page.getByText('Add New Lead')).toBeVisible();
  });
});
