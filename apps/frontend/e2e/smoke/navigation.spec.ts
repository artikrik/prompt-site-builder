import { test, expect } from '@playwright/test';

test.describe('Navigation @smoke', () => {
  test.describe('Cross-page navigation (public)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('landing page → login via "Get Started"', async ({ page }) => {
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page).toHaveURL('/auth/login');
    });

    test('landing page → login via "Login" header button', async ({ page }) => {
      await page.getByRole('button', { name: 'Login' }).click();
      await expect(page).toHaveURL('/auth/login');
    });

    test('landing page → login via "Open Dashboard"', async ({ page }) => {
      await page.getByRole('button', { name: 'Open Dashboard' }).click();
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('login page → register via link', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');
      await page.getByRole('link', { name: 'create a new account' }).click();
      await expect(page).toHaveURL('/auth/register');
    });

    test('register page → login via link', async ({ page }) => {
      await page.goto('/auth/register');
      await page.waitForLoadState('networkidle');
      await page.getByRole('link', { name: 'sign in to existing account' }).click();
      await expect(page).toHaveURL('/auth/login');
    });
  });

  test.describe('Responsive layout', () => {
    test('landing page on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByRole('heading', { name: 'AI-Powered B2B Website Generation' }),
      ).toBeVisible();
    });

    test('landing page on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByRole('heading', { name: 'AI-Powered B2B Website Generation' }),
      ).toBeVisible();
    });

    test('login page on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Sign in to your account')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    });
  });

  test.describe('Error pages', () => {
    test('404 page for unknown route', async ({ page }) => {
      const response = await page.goto('/nonexistent-page');
      if (response) {
        expect(response.status()).toBeGreaterThanOrEqual(404);
        expect(response.status()).toBeLessThan(500);
      }
    });
  });
});
