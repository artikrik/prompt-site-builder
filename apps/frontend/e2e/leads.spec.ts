import { test, expect } from '@playwright/test';

test.describe('Leads', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
    await page.goto('/auth/login');
    await page.getByLabel('Email address').fill('admin@promptsite.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/dashboard/leads');
  });

  test('should display leads page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Lead' })).toBeVisible();
  });

  test('should open create lead modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Lead' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Lead' })).toBeVisible();
  });
});
