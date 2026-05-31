import { test, expect } from '@playwright/test';

test('landing page has title and get started button', async ({ page }) => {
  await page.goto('/');

  // Expect a title "Your Personal AI Study Tutor"
  await expect(page.getByRole('heading', { name: /Your Personal AI Study Tutor/i })).toBeVisible();

  // Expect a "Get Started!" button
  const getStarted = page.getByRole('link', { name: /Get Started!/i });
  await expect(getStarted).toBeVisible();
  
  // Clicking "Get Started!" should take us to sign-in page
  await getStarted.click();
  await expect(page).toHaveURL(/\/sign-in/, { timeout: 15000 });
});
