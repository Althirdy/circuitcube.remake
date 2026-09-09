import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prepareModel } from '../../src/lib/modelAssets';
import { componentBounds } from '../../src/lib/componentPose';
import { createDemo } from '../../src/lib/placement';
import { localToWorld } from '../../src/engine/breadboard';
import type { LoadedAsset, ModelId, Point3 } from '../../src/types/workspace';
import { openLibrarySections } from './library';

export async function powerView(page: Page, focusPower = false) {
  await page.goto('/');
  await expect(page.locator('.model-thumbnail img')).toHaveCount(9);
  await openLibrarySections(page);
  const models = {} as Record<ModelId, LoadedAsset>;
  for (const id of ['breadboard', 'breadboard-large', 'power', 'led'] as const) {
    const bytes = await readFile(new URL(`../../../models/${id}.glb`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    models[id] = { ...prepareModel(gltf.scene, { id, scale: 0.1, rotation: [0, 0, 0], url: '', label: id, description: '' }), thumbnail: '' };
  }
  const instances = createDemo(models['breadboard-large'].size.x, models.power.size.x, models.led.size.x);
  const bounds = new Box3();
  if (focusPower) {
    await page.locator('.scene-item').filter({ hasText: 'Bench DC Power Supply' }).click();
    await page.getByRole('button', { name: 'Front', exact: true }).click();
    await page.getByRole('button', { name: 'Focus selected component' }).click();
  } else {
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Fit all components' }).click();
  }
  for (const instance of instances) if (!focusPower || instance.modelId === 'power') bounds.union(componentBounds(instance, models[instance.modelId], instances, models['breadboard-large'].sockets!));
  bounds.expandByScalar(0.0005);
  const canvas = (await page.locator('canvas').boundingBox())!;
  const camera = new PerspectiveCamera(38, canvas.width / canvas.height, 0.00001, 100);
  const center = bounds.getCenter(new Vector3()), fov = 38 * Math.PI / 180;
  const distance = bounds.getSize(new Vector3()).length() / 2 / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * camera.aspect)) / 2) * 1.18;
  const direction = focusPower ? new Vector3(0, 0.05, 1) : new Vector3(0.2, 1.05, 1.55);
  camera.position.copy(center).addScaledVector(direction.normalize(), distance); camera.lookAt(center); camera.updateMatrixWorld(true);
  const project = (id: ModelId, local: Point3) => {
    const point = new Vector3(...localToWorld(instances.find(instance => instance.modelId === id)!, local)).project(camera);
    return { x: canvas.x + (point.x + 1) / 2 * canvas.width, y: canvas.y + (1 - point.y) / 2 * canvas.height };
  };
  const terminal = (id: string) => id === 'positive' || id === 'negative'
    ? project('power', models.power.terminals!.find(terminal => terminal.id === id)!.position)
    : project('breadboard-large', models['breadboard-large'].sockets!.find(socket => socket.id === id)!.position);
  const click = async (id: string) => { const point = terminal(id); await page.mouse.click(point.x, point.y); };
  const switchPoint = project('power', new Box3().setFromObject(models.power.object.getObjectByName('Power_Switch')!).getCenter(new Vector3()).toArray());
  return { click, terminal, switchPoint };
}
