import { test, expect } from '@playwright/test';
import {
  mockAuthLogin,
  mockSettings,
  mockHealthCheck,
  setAuthCookie,
  DEFAULT_SETTINGS,
} from '../fixtures/api-mocks';

test.describe('Settings @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockHealthCheck(page);
    await mockAuthLogin(page);
    await mockSettings(page, DEFAULT_SETTINGS);

    await setAuthCookie(page);

    // Login
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email address').fill('admin@promptsite.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');

    // Navigate to settings via sidebar
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.waitForURL('/dashboard/settings');
  });

  test('should display settings page', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Settings');
  });

  test('should display LLM provider setting', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Provider');
  });

  test('should display base domain setting', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Domain');
  });

  test('should have save button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
  });
});
