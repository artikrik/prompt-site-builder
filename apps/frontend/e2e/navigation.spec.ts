import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should display landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'AI-Powered B2B Website Generation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Dashboard' })).toBeVisible();
  });

  test('should navigate to login from landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page).toHaveURL('/auth/login');
  });
});
