import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { modelCatalog } from '../src/lib/modelCatalog';
import { prepareModel } from '../src/lib/modelAssets';
import { componentBounds, componentPose } from '../src/lib/componentPose';
import { createResistorVisuals } from '../src/lib/resistorVisuals';
import { BREADBOARD_SOCKETS, LARGE_BREADBOARD_SOCKETS, localToWorld, socketById } from '../src/engine/breadboard';
import { canConnect, detachMounted, mountLed, mountResistor, occupiedSockets, removeComponent, resistorMountError } from '../src/engine/connections';
import { mountingCandidate } from '../src/engine/mounting';
import { resistorBandColors, resistorMountPosition } from '../src/engine/resistor';
import type { BoardModelId, Layout, ModelId, ResistorMount } from '../src/types/workspace';

const sockets = { breadboard: BREADBOARD_SOCKETS, 'breadboard-large': LARGE_BREADBOARD_SOCKETS };
const initial = (modelId: BoardModelId): Layout => ({ instances: [
  { id: 'board', modelId, position: [0.1, 0.2], rotation: Math.PI / 2 },
  { id: 'r', modelId: 'resistor', position: [0, 0], rotation: 0, resistanceOhms: 470, tolerancePercent: 5, powerRatingWatts: 0.25 },
  { id: 'led', modelId: 'led', position: [0, 0], rotation: 0 },
], wires: [] });
async function asset(id: ModelId) {
  const filename = id === 'resistor' ? 'resistors' : id;
  const bytes = await readFile(new URL(`../../models/${filename}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return { ...prepareModel(gltf.scene, modelCatalog.find(model => model.id === id)!), thumbnail: '' };
}

for (const modelId of ['breadboard', 'breadboard-large'] as const) test(`${modelId}: fixed resistor span, occupancy, relocation, reversal and cleanup`, () => {
  const mount: ResistorMount = { breadboardId: 'board', pins: ['e10', 'e15'] };
  let layout = mountResistor(initial(modelId), 'r', mount, sockets);
  expect(occupiedSockets(layout)).toEqual(new Set(['board:e10', 'board:e15']));
  expect(canConnect(layout, { componentId: 'board', terminalId: 'e10' }, { componentId: 'board', terminalId: 'a20' }, sockets)).toBe(false);
  expect(canConnect(layout, { componentId: 'board', terminalId: 'e12' }, { componentId: 'board', terminalId: 'a20' }, sockets)).toBe(true);
  expect(canConnect(layout, { componentId: 'r', terminalId: 'left' }, { componentId: 'board', terminalId: 'a20' }, sockets)).toBe(false);
  expect(mountLed(layout, 'led', { breadboardId: 'board', anode: 'e10', cathode: 'e11' }, sockets)).toBe(layout);
  const end = modelId === 'breadboard' ? 30 : 63;
  for (const pins of [['e10', 'e14'], ['e10', 'f15'], ['top-positive-1', 'top-positive-6'], [`e${end - 4}`, `e${end + 1}`]]) {
    expect(resistorMountError(layout, { breadboardId: 'board', pins: pins as ResistorMount['pins'] }, sockets, 'r')).not.toBeNull();
  }
  expect(resistorMountError(layout, { breadboardId: 'board', pins: [`j${end - 5}`, `j${end}`] }, sockets, 'r')).toBeNull();
  const candidate = mountingCandidate(layout, 'resistor', layout.instances[0], socketById(sockets[modelId], 'j20')!.position, sockets, true, 'r');
  expect(candidate.resistorMount!.pins).toEqual(['j25', 'j20']);
  expect(candidate.valid).toBe(true);
  layout = mountResistor(layout, 'r', candidate.resistorMount!, sockets);
  expect(occupiedSockets(layout).has('board:e10')).toBe(false);
  const pose = resistorMountPosition(layout.instances[1].resistorMount!, layout.instances, sockets)!;
  expect(pose.rotation).toBeCloseTo(Math.PI * 1.5);
  const detached = detachMounted(layout, 'r', sockets);
  expect(detached.instances[1].position).toEqual([pose.position[0], pose.position[2]]);
  expect(detached.instances[1].resistanceOhms).toBe(470);
  expect(occupiedSockets(detached).size).toBe(0);
  const deleted = removeComponent(layout, 'board', sockets);
  expect(deleted.instances[0].resistorMount).toBeUndefined();
  expect(deleted.instances[0].position).toEqual(detached.instances[1].position);
  expect(occupiedSockets(removeComponent(layout, 'r', sockets)).size).toBe(0);
});

test('actual resistor anchors seat 1 mm deep without changing body or lead geometry', async () => {
  const resistor = await asset('resistor');
  for (const modelId of ['breadboard', 'breadboard-large'] as const) {
    const board = await asset(modelId), definitions = { ...sockets, [modelId]: board.sockets! };
    for (const pins of [['e10', 'e15'], ['e15', 'e10']] as [string, string][]) {
      const layout = mountResistor(initial(modelId), 'r', { breadboardId: 'board', pins }, definitions);
      const pose = componentPose(layout.instances[1], resistor, layout.instances, definitions);
      const clone = resistor.object.clone(true), wrapper = new Group();
      wrapper.add(clone); wrapper.position.copy(pose.position); wrapper.rotation.y = pose.rotation; wrapper.updateMatrixWorld(true);
      for (const [index, name] of ['Resistor_Left_Anchor', 'Resistor_Right_Anchor'].entries()) {
        const point = clone.getObjectByName(name)!.getWorldPosition(new Vector3());
        const target = new Vector3(...localToWorld(layout.instances[0], socketById(board.sockets!, pins[index])!.position)).add(new Vector3(0, -0.001, 0));
        expect(point.distanceTo(target)).toBeLessThan(0.000001);
      }
      const body = clone.getObjectByName('Resistor_Body') as Mesh;
      expect(new Box3().setFromObject(body).min.y - board.sockets![0].position[1]).toBeCloseTo(0.00085, 6);
      for (const name of ['Resistor_Body', 'Resistor_Lead_Left', 'Resistor_Lead_Left_Down', 'Resistor_Lead_Right_Down']) {
        const original = resistor.object.getObjectByName(name) as Mesh, mounted = clone.getObjectByName(name) as Mesh;
        expect(mounted.geometry).toBe(original.geometry); expect(mounted.scale.toArray()).toEqual(original.scale.toArray());
      }
      expect(componentBounds(layout.instances[1], resistor, layout.instances, definitions).isEmpty()).toBe(false);
    }
  }
});

test('six resistance choices produce four-band codes and own only per-instance band materials', async () => {
  const resistor = await asset('resistor');
  const first = resistor.object.clone(true), second = resistor.object.clone(true);
  const visual = createResistorVisuals(first), other = createResistorVisuals(second);
  const expected = [
    [220, ['#dc3434', '#dc3434', '#704026', '#c7a348']],
    [330, ['#ef832c', '#ef832c', '#704026', '#c7a348']],
    [470, ['#e9c832', '#884aa0', '#704026', '#c7a348']],
    [1000, ['#704026', '#181818', '#dc3434', '#c7a348']],
    [4700, ['#e9c832', '#884aa0', '#dc3434', '#c7a348']],
    [10000, ['#704026', '#181818', '#ef832c', '#c7a348']],
  ] as const;
  other.apply(330);
  for (const [value, colors] of expected) { expect(resistorBandColors(value)).toEqual(colors); visual.apply(value); }
  const firstBand = (first.getObjectByName('Resistor_Band_2') as Mesh).material as MeshStandardMaterial;
  const secondBand = (second.getObjectByName('Resistor_Band_2') as Mesh).material as MeshStandardMaterial;
  expect(firstBand).not.toBe(secondBand);
  expect(firstBand.color.getHexString()).toBe('181818');
  expect(secondBand.color.getHexString()).toBe('ef832c');
  expect((first.getObjectByName('Resistor_Body') as Mesh).material).toBe((resistor.object.getObjectByName('Resistor_Body') as Mesh).material);
  let disposed = false; firstBand.addEventListener('dispose', () => { disposed = true; });
  visual.dispose(); other.dispose(); expect(disposed).toBe(true);
});
