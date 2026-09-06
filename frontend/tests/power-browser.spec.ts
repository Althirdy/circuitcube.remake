import { expect, test } from '@playwright/test';
import { powerView } from './helpers/powerView';

test('supply leads in both directions light an inserted LED and react to switch, polarity and deletion', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const scene = await powerView(page);
  await page.getByRole('button', { name: 'Place LED', exact: true }).click();
  await scene.click('e10');
  await expect(page.locator('.mounted-info')).toContainText('+ e11');
  for (const [from, to] of [['positive', 'top-positive-1'], ['top-negative-1', 'negative'], ['top-positive-2', 'a11'], ['top-negative-2', 'a10']]) {
    await scene.click(from);
    await expect(page.locator('.wiring-panel')).toContainText('Drawing wire');
    if (from === 'positive') await expect(page.locator('.height-reference')).toContainText('workplane');
    await scene.click(to);
    await expect(page.locator('.wiring-panel')).not.toContainText('Drawing wire');
  }
  await expect(page.locator('.wire-item')).toHaveCount(4);
  await page.locator('.scene-item').last().click();
  await expect(page.locator('.led-power-state')).toHaveAttribute('data-state', 'supply-off');
  await page.mouse.click(scene.switchPoint.x, scene.switchPoint.y);
  await expect(page.locator('.power-output-state')).toHaveAttribute('data-state', 'on');
  await page.locator('.scene-item').last().click();
  await expect(page.locator('.led-power-state')).toHaveAttribute('data-state', 'on');
  await page.keyboard.press('r');
  await expect(page.locator('.led-power-state')).toHaveAttribute('data-state', 'reversed');
  await page.keyboard.press('r');
  await expect(page.locator('.led-power-state')).toHaveAttribute('data-state', 'on');
  await page.getByRole('button', { name: 'Focus selected component' }).click();
  await page.screenshot({ path: 'artifacts/powered-led.png' });
  await page.getByRole('button', { name: 'Fit all components' }).click();
  await page.screenshot({ path: 'artifacts/powered-workspace.png' });
  await page.locator('.wire-item').first().click();
  await page.getByRole('button', { name: 'Focus wire', exact: true }).click();
  await page.getByRole('button', { name: 'Delete wire', exact: true }).click();
  await page.locator('.scene-item').last().click();
  await expect(page.locator('.led-power-state')).toHaveAttribute('data-state', 'unconnected');
  await page.locator('.scene-item').filter({ hasText: 'Bench DC Power Supply' }).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.wire-item')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('a short circuit displays a fault and output recovers after deleting the short', async ({ page }) => {
  const scene = await powerView(page);
  for (const [from, to] of [['positive', 'top-positive-1'], ['negative', 'top-positive-2']]) {
    await scene.click(from); await scene.click(to);
  }
  await page.locator('.scene-item').filter({ hasText: 'Bench DC Power Supply' }).click();
  await page.getByRole('button', { name: 'Output on/off' }).click();
  await expect(page.locator('.power-output-state')).toHaveAttribute('data-state', 'short-circuit');
  await expect(page.locator('.power-faults')).toContainText('Short circuit');
  await page.locator('.wire-item').last().click();
  await page.getByRole('button', { name: 'Delete wire', exact: true }).click();
  await expect(page.locator('.power-faults')).toHaveCount(0);
  await page.locator('.scene-item').filter({ hasText: 'Bench DC Power Supply' }).click();
  await expect(page.locator('.power-output-state')).toHaveAttribute('data-state', 'on');
});

test('rocker clicks toggle, dragging does not toggle, and keyboard output controls work on narrow screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const scene = await powerView(page, true);
  const before = await page.locator('canvas').screenshot();
  await page.mouse.click(scene.switchPoint.x, scene.switchPoint.y);
  await expect(page.getByRole('button', { name: 'Output on/off' })).toHaveAttribute('aria-pressed', 'true');
  expect((await page.locator('canvas').screenshot()).equals(before)).toBe(false);
  const position = await page.locator('.selection-position').innerText();
  await page.mouse.move(scene.switchPoint.x, scene.switchPoint.y); await page.mouse.down();
  await page.mouse.move(1300, scene.switchPoint.y + 40, { steps: 8 }); await page.mouse.up();
  await expect(page.locator('.selection-position')).not.toHaveText(position);
  await expect(page.getByRole('button', { name: 'Output on/off' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Output on/off' }).click();
  await expect(page.locator('.power-output-state')).toHaveAttribute('data-state', 'off');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Focus selected component' }).click();
  const toggle = page.getByRole('button', { name: 'Output on/off' });
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(page.locator('.power-output-state')).toHaveAttribute('data-state', 'on');
  await page.screenshot({ path: 'artifacts/power-narrow.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await toggle.click({ clickCount: 3, delay: 20 });
  await expect(page.locator('.power-output-state')).toHaveAttribute('data-state', 'off');
});
