import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/auth/login');
  });

  test('should redirect to login on dashboard sub-routes', async ({ page }) => {
    await page.goto('/dashboard/leads');
    await expect(page).toHaveURL('/auth/login');
  });
});
