import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { powerView } from './helpers/powerView';
import { focusBoard } from './helpers/boardView';
import { prepareModel } from '../src/lib/modelAssets';
import { componentPose } from '../src/lib/componentPose';
import { createSlideVisuals } from '../src/lib/slideVisuals';
import type { ComponentInstance, SwitchMount } from '../src/types/workspace';

test('slider picking, valid and invalid drops, pin reversal, detachment and board cleanup', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const board = await focusBoard(page);
  await page.getByRole('button', { name: 'Place Slide Switch', exact: true }).click();
  await board.click('top-positive-1');
  await expect(page.locator('.connection-message')).toContainText('not rails');
  await board.click('e62');
  await expect(page.locator('.placement-banner')).toBeVisible();
  await expect(page.locator('.connection-message')).toContainText('within the board');
  await board.hover('e10');
  await expect(page.locator('.socket-label')).toContainText('2 common: e11');
  await board.click('e10');
  await expect(page.locator('.switch-state')).toHaveAttribute('data-state', 'left');

  const bytes = await readFile(new URL('../../models/slide-switch.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const asset = { ...prepareModel(gltf.scene, { id: 'slide-switch', scale: 1, rotation: [Math.PI / 2, 0, 0], url: '', label: '', description: '' }), thumbnail: '' };
  const grip = (pins: SwitchMount['pins'], right = false) => {
    const instance: ComponentInstance = { id: 'switch', modelId: 'slide-switch', position: [0, 0], rotation: 0, switchMount: { breadboardId: board.board.id, pins } };
    const pose = componentPose(instance, asset, [board.board, instance], { breadboard: [], 'breadboard-large': board.asset.sockets! });
    const clone = asset.object.clone(true); createSlideVisuals(clone).apply(right ? 1 : 0, 0);
    const wrapper = new Group(); wrapper.add(clone); wrapper.position.copy(pose.position); wrapper.rotation.y = pose.rotation; wrapper.updateMatrixWorld(true);
    return board.worldProject(new Box3().setFromObject(clone.getObjectByName('SlideSwitch_Slider_Grip')!).getCenter(new Vector3()).toArray());
  };
  let point = grip(['e10', 'e11', 'e12']);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.switch-state')).toHaveAttribute('data-state', 'right');
  // Let the visible grip settle before grabbing its destination position.
  await expect.poll(async () => {
    const image = await page.locator('canvas').screenshot();
    return (await page.locator('canvas').screenshot()).equals(image);
  }).toBe(true);
  point = grip(['e10', 'e11', 'e12'], true);
  const destination = board.socket('e20');
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(destination.x, destination.y, { steps: 10 }); await page.mouse.up();
  await expect(page.locator('.mounted-info')).toContainText('1 e20 / 2 common e21 / 3 e22');
  await expect(page.locator('.switch-state')).toHaveAttribute('data-state', 'right');
  point = grip(['e20', 'e21', 'e22'], true);
  const rail = board.socket('top-positive-10');
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(rail.x, rail.y, { steps: 10 }); await page.mouse.up();
  await expect(page.locator('.mounted-info')).toContainText('1 e20 / 2 common e21 / 3 e22');
  await page.keyboard.press('r'); await page.keyboard.press('ArrowRight');
  await expect(page.locator('.mounted-info')).toContainText('1 e23 / 2 common e22 / 3 e21');
  await page.screenshot({ path: 'artifacts/slide-switch-desktop.png' });
  await page.getByRole('button', { name: 'Detach switch', exact: true }).click();
  await expect(page.locator('.mounted-info')).toHaveCount(0);
  await expect(page.locator('.switch-state')).toHaveAttribute('data-state', 'right');
  // Delete the loose switch, then verify deleting its board detaches a new mount.
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'Place Slide Switch', exact: true }).click(); await board.click('e10');
  await page.locator('.scene-item').filter({ hasText: 'Full-Size Breadboard' }).click(); await page.keyboard.press('Delete');
  await page.locator('.scene-item').filter({ hasText: 'Slide Switch' }).click();
  await expect(page.locator('.mounted-info')).toHaveCount(0);
  await expect(page.locator('.switch-state')).toContainText('Loose');
  await page.getByRole('button', { name: 'Fit all components' }).click();
  expect(errors).toEqual([]);
});

test('accessible switch state, rapid toggles, reduced motion and narrow-screen controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const board = await focusBoard(page);
  await page.getByRole('button', { name: 'Place Slide Switch', exact: true }).click(); await board.click('e10');
  const toggle = page.getByRole('button', { name: 'Switch position', exact: true });
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Focus selected component' }).click();
  await expect(toggle).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Detach switch', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'artifacts/slide-switch-narrow.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await toggle.click({ clickCount: 3, delay: 20 });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Delete');
  await expect(page.locator('.switch-state')).toHaveCount(0);
});

test('a mounted switch changes common polarity and the LED reacts immediately', async ({ page }) => {
  const board = await powerView(page);
  await page.getByRole('button', { name: 'Place Slide Switch', exact: true }).click(); await board.click('e10');
  await page.getByRole('button', { name: 'Place LED', exact: true }).click(); await board.click('h20');
  await page.keyboard.press('r'); // anode h20, cathode h21
  for (const [from, to] of [['positive', 'a10'], ['a12', 'negative'], ['b11', 'j20'], ['b12', 'j21']]) {
    await board.click(from); await board.click(to);
  }
  await expect(page.locator('.wire-item')).toHaveCount(4);
  await page.locator('.scene-item').filter({ hasText: 'Bench DC Power Supply' }).click();
  await page.getByRole('button', { name: 'Output on/off', exact: true }).click();
  await page.locator('.scene-item').filter({ hasText: 'LED' }).last().click();
  await expect(page.locator('.led-power-state')).toHaveAttribute('data-state', 'on');
  await page.locator('.scene-item').filter({ hasText: 'Slide Switch' }).click();
  await expect(page.locator('.switch-state')).toContainText('1 ↔ 2');
  await expect(page.locator('.switch-state')).toContainText('Positive');
  await page.getByRole('button', { name: 'Switch position', exact: true }).click();
  await expect(page.locator('.switch-state')).toContainText('2 ↔ 3');
  await expect(page.locator('.switch-state')).toContainText('Negative');
  await page.locator('.scene-item').filter({ hasText: 'LED' }).last().click();
  await expect(page.locator('.led-power-state')).toHaveAttribute('data-state', 'same-network');
  await page.locator('.scene-item').filter({ hasText: 'Slide Switch' }).click();
  await page.getByRole('button', { name: 'Switch position', exact: true }).click();
  await page.locator('.scene-item').filter({ hasText: 'LED' }).last().click();
  await expect(page.locator('.led-power-state')).toHaveAttribute('data-state', 'on');
  await page.locator('.wire-item').last().click();
  await page.getByRole('button', { name: 'Delete wire', exact: true }).click();
  await page.locator('.scene-item').filter({ hasText: 'LED' }).last().click();
  await expect(page.locator('.led-power-state')).toHaveAttribute('data-state', 'unconnected');
});
