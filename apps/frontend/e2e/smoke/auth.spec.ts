import { test, expect } from '@playwright/test';
import { mockAuthLogin, mockAuthRegister, mockAuthError } from '../fixtures/api-mocks';

test.describe('Authentication @smoke', () => {
  test.describe('Login Page', () => {
    test('should display login form with all elements', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');

      // "Sign in to your account" is plain text, NOT a heading element
      await expect(page.getByText('Sign in to your account')).toBeVisible();
      // Labels and inputs
      await expect(page.getByLabel('Email address')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      // Button
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    });

    test('should have link to register page', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');

      const registerLink = page.getByRole('link', { name: 'create a new account' });
      await expect(registerLink).toBeVisible();
      await expect(registerLink).toHaveAttribute('href', '/auth/register');
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await mockAuthError(page, 'login');

      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Email address').fill('wrong@example.com');
      await page.getByLabel('Password').fill('wrongpassword');
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page.getByText('Invalid credentials')).toBeVisible();
    });

    test('should redirect to dashboard on successful login', async ({ page }) => {
      await mockAuthLogin(page);

      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Email address').fill('admin@promptsite.com');
      await page.getByLabel('Password').fill('admin123');
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Register Page', () => {
    test('should display register form with all elements', async ({ page }) => {
      await page.goto('/auth/register');
      await page.waitForLoadState('networkidle');

      // "Create your account" is plain text, NOT a heading element
      await expect(page.getByText('Create your account')).toBeVisible();
      // Labels and inputs
      await expect(page.getByLabel('Full name')).toBeVisible();
      await expect(page.getByLabel('Email address')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      // Button
      await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    });

    test('should have link to login page', async ({ page }) => {
      await page.goto('/auth/register');
      await page.waitForLoadState('networkidle');

      const loginLink = page.getByRole('link', { name: 'sign in to existing account' });
      await expect(loginLink).toBeVisible();
      await expect(loginLink).toHaveAttribute('href', '/auth/login');
    });

    test('should redirect to dashboard on successful registration', async ({ page }) => {
      await mockAuthRegister(page);

      await page.goto('/auth/register');
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Full name').fill('Test User');
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('password123');
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Unauthenticated access', () => {
    test('should redirect /dashboard to login', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/auth/login');
    });

    test('should redirect /dashboard/leads to login', async ({ page }) => {
      await page.goto('/dashboard/leads');
      await expect(page).toHaveURL('/auth/login');
    });

    test('should redirect /dashboard/projects to login', async ({ page }) => {
      await page.goto('/dashboard/projects');
      await expect(page).toHaveURL('/auth/login');
    });

    test('should redirect /dashboard/settings to login', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await expect(page).toHaveURL('/auth/login');
    });
  });
});
