import { expect, test } from '@playwright/test';
import { focusBoard } from './helpers/boardView';
import { powerView } from './helpers/powerView';

for (const label of ['7408 AND IC', '7432 OR IC', '7404 NOT IC']) test(`${label}: placement guidance, pin map, keyboard movement and detachment`, async ({ page }) => {
  const board = await focusBoard(page);
  await page.getByRole('button', { name: `Place ${label}`, exact: true }).click();
  await expect(page.locator('.placement-banner')).toContainText('center gap');
  await board.click('a10');
  await expect(page.locator('.placement-banner')).toBeVisible();
  await board.click('e20');
  await expect(page.locator('.ic-status')).toContainText('No power');
  await expect(page.locator('.ic-pin-table tbody tr')).toHaveCount(14);
  await expect(page.locator('.ic-all-pins')).not.toHaveAttribute('open', '');
  await expect(page.locator('.ic-guide')).toContainText('5 V');
  await page.keyboard.press('r');
  await expect(page.locator('.ic-details .mounted-info')).toContainText('Pin 1: f26');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.ic-details .mounted-info')).toContainText('Pin 1: f27');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.connection-message')).toContainText('center gap');
  await page.getByRole('button', { name: 'Detach IC', exact: true }).click();
  await expect(page.locator('.ic-status')).toContainText('Not inserted');
});

test('student can power a NOT gate, see its output and recover a floating input', async ({ page }) => {
  const scene = await powerView(page);
  await page.getByRole('button', { name: 'Place 7404 NOT IC', exact: true }).click();
  await scene.click('e20');
  await page.keyboard.press('Escape');
  for (const [from, to] of [['positive', 'j20'], ['negative', 'a26'], ['b26', 'a20']]) {
    await scene.click(from);
    await scene.click(to);
    await expect(page.getByRole('complementary', { name: '7404 NOT IC wiring guide' })).toBeVisible();
  }
  await page.locator('.scene-item').filter({ hasText: 'Bench DC Power Supply' }).click();
  await page.getByRole('button', { name: 'Output on/off' }).click();
  await page.locator('.scene-item').filter({ hasText: '7404 NOT IC' }).click();
  await expect(page.locator('.ic-status')).toHaveText('Powered');
  await expect(page.locator('.ic-pin-table tbody tr').nth(1)).toContainText('HIGH');
  await expect(page.getByRole('status').filter({ hasText: 'Gate 1' })).toContainText('HIGH');
  await page.locator('.wire-item').last().click();
  await page.getByRole('button', { name: 'Delete wire', exact: true }).click();
  await page.locator('.scene-item').filter({ hasText: '7404 NOT IC' }).click();
  await expect(page.locator('.ic-pin-table tbody tr').nth(1)).toContainText('UNKNOWN');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.ic-status')).toBeVisible();
  await expect(page.locator('.ic-guide summary')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
