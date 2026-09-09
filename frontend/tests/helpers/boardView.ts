import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prepareModel } from '../../src/lib/modelAssets';
import { createDemo } from '../../src/lib/placement';
import { localToWorld, socketById } from '../../src/engine/breadboard';
import type { Point3 } from '../../src/types/workspace';
import { openLibrarySections } from './library';

export async function focusBoard(page: Page) {
  await page.goto('/');
  await expect(page.locator('.model-thumbnail img')).toHaveCount(9);
  await openLibrarySections(page);
  if (!(await page.getByRole('complementary').isVisible())) await page.getByRole('button', { name: 'Toggle component library' }).click();
  await page.locator('.scene-item').filter({ hasText: 'Full-Size Breadboard' }).click();
  const close = page.getByRole('complementary').getByRole('button', { name: 'Close component library' });
  if (await close.isVisible()) await close.click();
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await page.getByRole('button', { name: 'Focus selected component' }).click();
  const bytes = await readFile(new URL('../../../models/breadboard-large.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const asset = prepareModel(gltf.scene, { id: 'breadboard-large', label: '', description: '', url: '', scale: 0.1, rotation: [0, 0, 0] });
  const board = createDemo(Math.max(asset.size.x, asset.size.z))[0];
  const canvas = (await page.locator('canvas').boundingBox())!;
  const bounds = new Box3().setFromObject(asset.object).translate(new Vector3(board.position[0], 0, board.position[1])).expandByScalar(0.0005);
  const camera = new PerspectiveCamera(38, canvas.width / canvas.height, 0.00001, 100);
  const center = bounds.getCenter(new Vector3());
  const fov = 38 * Math.PI / 180;
  const distance = bounds.getSize(new Vector3()).length() / 2 / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * camera.aspect)) / 2) * 1.18;
  camera.position.copy(center).addScaledVector(new Vector3(0, 1, 0.0001).normalize(), distance); camera.lookAt(center); camera.updateMatrixWorld(true);
  const project = (point: Point3) => { const p = new Vector3(...localToWorld(board, point)).project(camera); return { x: canvas.x + (p.x + 1) / 2 * canvas.width, y: canvas.y + (1 - p.y) / 2 * canvas.height }; };
  const socket = (id: string) => project(socketById(asset.sockets!, id)!.position);
  const click = async (id: string) => { const p = socket(id); await page.mouse.click(p.x, p.y); };
  const hover = async (id: string) => { const p = socket(id); await page.mouse.move(p.x, p.y); };
  const worldProject = (point: Point3) => { const p = new Vector3(...point).project(camera); return { x: canvas.x + (p.x + 1) / 2 * canvas.width, y: canvas.y + (1 - p.y) / 2 * canvas.height }; };
  return { worldProject, project, socket, click, hover, surface: asset.sockets![0].position[1], asset, board, canvas };
}
