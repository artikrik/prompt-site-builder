import { test, expect } from '@playwright/test';

test.describe('Leads', () => {
  test('should redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/leads');
    await expect(page).toHaveURL('/auth/login');
  });
});
