import { test, expect } from '@playwright/test';

test('auth flows: sign-up and sign-in pages load', async ({ page }) => {
  // Check Sign Up page
  await page.goto('/sign-up');
  // Use text content check instead of just heading if needed, but "Let's Get Started!" is the h1
  await expect(page.getByRole('heading', { name: /Let's Get Started!/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Create an account/i)).toBeVisible();
  await expect(page.getByLabel(/Name/i)).toBeVisible();
  await expect(page.getByLabel(/Email/i)).toBeVisible();
  await expect(page.getByLabel(/^Password$/i)).toBeVisible();
  await expect(page.getByLabel(/Confirm Password/i)).toBeVisible();

  // Check navigation to Sign In from Sign Up
  await page.getByRole('link', { name: /Sign In/i }).click();
  await expect(page).toHaveURL(/\/sign-in/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
});
