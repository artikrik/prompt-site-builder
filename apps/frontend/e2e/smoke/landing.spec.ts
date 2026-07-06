import { test, expect } from '@playwright/test';

test.describe('Landing Page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display main heading and hero section', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'AI-Powered B2B Website Generation' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Prompt Site Builder', level: 1 }),
    ).toBeVisible();
  });

  test('should display CTA buttons in hero', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Learn More' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  });

  test('should display feature cards', async ({ page }) => {
    await expect(page.getByText('Lead Discovery')).toBeVisible();
    await expect(page.getByText('AI Generation')).toBeVisible();
    await expect(page.getByText('One-Click Publish')).toBeVisible();
  });

  test('should display footer with copyright', async ({ page }) => {
    await expect(
      page.getByText('© 2024 Prompt Site Builder. All rights reserved.'),
    ).toBeVisible();
  });

  test('"Open Dashboard" navigates to dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Dashboard' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('"Get Started" navigates to login', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page).toHaveURL('/auth/login');
  });

  test('"Login" header button navigates to login', async ({ page }) => {
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/auth/login');
  });

  test('landing page has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const realErrors = errors.filter(
      (e) => !e.includes('Failed to load resource') && !e.includes('net::ERR_CONNECTION_REFUSED'),
    );
    expect(realErrors).toEqual([]);
  });
});
