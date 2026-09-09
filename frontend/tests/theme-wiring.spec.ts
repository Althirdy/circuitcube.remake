import { expect, test } from '@playwright/test';
import { focusBoard } from './helpers/boardView';

test('changing theme retains the canvas and an in-progress wire', async ({ page }) => {
  const board = await focusBoard(page);
  await page.locator('canvas').evaluate(canvas => { canvas.dataset.themeTestIdentity = 'same-canvas'; });
  await board.click('a1');
  await expect(page.locator('.wiring-heading')).toContainText('Drawing wire');
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-theme-test-identity', 'same-canvas');
  await expect(page.locator('.wiring-heading')).toContainText('Drawing wire');
  await board.click('a2');
  await expect(page.locator('.wire-item')).toHaveCount(1);
  await expect(page.locator('.wiring-heading')).toContainText('Jumper wire');
});

test('collapsed categories expose asset errors before they are opened', async ({ page }) => {
  await page.route('**/models/ic-7408-and.glb*', route => route.abort());
  await page.goto('/');
  const category = page.getByRole('button', { name: 'Logic ICs', exact: true });
  await expect(category).toHaveAttribute('aria-expanded', 'false');
  await expect(category).toContainText('1 failed');
  await category.click();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});
