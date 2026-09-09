import { expect, test } from '@playwright/test';
import { icDiagram } from '../src/lib/icDiagram';
import { icPinSockets, rotateIc } from '../src/engine/icMounting';
import { isLogicIcInstance } from '../src/engine/digital/logicIcDefinitions';
import type { LogicIcInstance } from '../src/types/workspace';

test('categories and circuit lists collapse independently without removing instances', async ({ page }) => {
  await page.goto('/');
  const library = page.getByRole('complementary', { name: 'Component library', exact: true });
  await expect(library.getByRole('button', { name: 'Boards', exact: true })).toHaveAttribute('aria-expanded', 'true');
  for (const label of ['Power', 'Basic components', 'Logic ICs', 'On the workplane', 'Jumper wires']) await expect(library.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.scene-item')).toHaveCount(3);
  const contents = library.getByRole('button', { name: 'On the workplane', exact: true });
  await contents.focus();
  await page.keyboard.press('Enter');
  await page.locator('.scene-item').first().click();
  await contents.click();
  await expect(contents).toContainText('Selected');
  await expect(page.locator('.scene-item')).toHaveCount(3);
  await expect(page.locator('.selection-panel')).toContainText('Full-Size Breadboard');
  await library.getByRole('button', { name: 'Jumper wires', exact: true }).click();
  await expect(page.locator('.wire-list')).toContainText('No wires yet');
});

test('theme follows system until overridden, persists and keeps selection and placement', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'On the workplane', exact: true }).click();
  await page.locator('.scene-item').first().click();
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.selection-panel')).toContainText('Full-Size Breadboard');
  await page.getByRole('button', { name: 'Place Breadboard', exact: true }).click();
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.locator('.placement-banner')).toContainText('Breadboard');
  await expect(page.locator('.scene-item')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const modelId of ['ic-7408', 'ic-7432', 'ic-7404'] as const) test(`${modelId} diagram follows physical pins after rotation`, () => {
  const instance: LogicIcInstance = { id: 'ic', modelId, position: [0, 0], rotation: 0, icMount: { breadboardId: 'board', pins: icPinSockets(10, false) } };
  const before = icDiagram(instance);
  expect(before.pins).toHaveLength(14);
  expect(before.pins[13]).toMatchObject({ number: 14, role: 'vcc', socket: 'f10', left: false });
  expect(before.pins[6]).toMatchObject({ number: 7, role: 'ground', socket: 'e16', left: true });
  expect(before.pins.find(pin => pin.role === 'output')?.number).toBe(modelId === 'ic-7404' ? 2 : 3);
  const rotated = rotateIc(instance);
  if (!isLogicIcInstance(rotated)) throw new Error('Rotation changed the component kind');
  const after = icDiagram(rotated);
  expect(after.pins[0].socket).toBe('f16');
  expect(after.pins[13].socket).toBe('e16');
  expect(after.pins.map(pin => [pin.number, pin.left, pin.y])).toEqual(before.pins.map(pin => [pin.number, pin.left, pin.y]));
});

for (const colorScheme of ['light', 'dark'] as const) test(`${colorScheme}: narrow drawer, pin diagram and theme switch remain accessible`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.goto('/');
  await expect(page.getByRole('switch', { name: 'Dark mode' })).toBeInViewport();
  await page.getByRole('button', { name: 'Toggle component library' }).click();
  await page.getByRole('button', { name: 'Logic ICs', exact: true }).click();
  const card = page.locator('.model-card').filter({ has: page.getByRole('button', { name: 'Place 7408 AND IC', exact: true }) });
  await card.getByRole('button', { name: 'Add at view center' }).click();
  await page.getByRole('complementary', { name: 'Component library', exact: true }).getByRole('button', { name: 'Close component library' }).click();
  await page.getByText('Pin picture · find VCC (+) and GND (−)', { exact: true }).click();
  await expect(page.getByRole('img', { name: /7408 AND: pin 14 VCC positive/ })).toBeVisible();
  await expect(page.locator('.ic-diagram')).toContainText('GND (0 V / supply −)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
