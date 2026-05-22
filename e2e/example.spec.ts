import { test, expect } from '@playwright/test';

test('has title or heading', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Lumina|Ngerti/);
});

test('redirects from dashboard to sign-in when unauthenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('can navigate to sign-in page', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});

test('can navigate to sign-up page', async ({ page }) => {
  await page.goto('/sign-up');
  await expect(page.getByRole('heading', { name: /let's get started/i })).toBeVisible();
});

test('shows error on mismatched passwords during sign-up', async ({ page }) => {
  await page.goto('/sign-up');
  
  await page.getByPlaceholder('John Doe').fill('Test User');
  await page.getByPlaceholder('m@example.com').fill('test@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.locator('input[name="confirmPassword"]').fill('password456');
  
  await page.getByRole('button', { name: /sign up/i }).click();
  
  await expect(page.getByText(/passwords don't match/i)).toBeVisible();
});

test('shows error on invalid email during sign-in', async ({ page }) => {
  await page.goto('/sign-in');
  
  // Disable browser validation to let Zod handle it
  await page.locator('form').evaluate((form) => form.setAttribute('novalidate', 'true'));
  
  await page.getByPlaceholder('m@example.com').fill('invalid-email');
  await page.getByPlaceholder('********').fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();
  
  await expect(page.getByText(/invalid email/i)).toBeVisible();
});

test('shows error on invalid email during sign-up', async ({ page }) => {
  await page.goto('/sign-up');
  
  // Disable browser validation
  await page.locator('form').evaluate((form) => form.setAttribute('novalidate', 'true'));
  
  await page.getByPlaceholder('m@example.com').fill('invalid-email');
  await page.getByRole('button', { name: /sign up/i }).click();
  
  await expect(page.getByText(/invalid email/i)).toBeVisible();
});

test('shows error on missing password during sign-in', async ({ page }) => {
  await page.goto('/sign-in');
  
  await page.getByPlaceholder('m@example.com').fill('test@example.com');
  await page.getByRole('button', { name: /sign in/i }).click();
  
  await expect(page.getByText(/password is required/i)).toBeVisible();
});
