import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BREADBOARD_SOCKETS, LARGE_BREADBOARD_SOCKETS, localToWorld, socketById, socketsFor, switchMountPosition } from '../src/engine/breadboard';
import { canConnect, connectWire, detachMounted, mountLed, mountSwitch, occupiedSockets, removeComponent, switchMountError, toggleSlideSwitch } from '../src/engine/connections';
import { evaluatePower } from '../src/engine/power';
import { prepareModel } from '../src/lib/modelAssets';
import { modelCatalog } from '../src/lib/modelCatalog';
import { componentBounds, componentPose } from '../src/lib/componentPose';
import { createSlideVisuals } from '../src/lib/slideVisuals';
import { transitionValue } from '../src/lib/powerVisuals';
import { createDemo } from '../src/lib/placement';
import { createHomeBounds } from '../src/lib/cameraFraming';
import { terminalPosition, wirePoints } from '../src/lib/wireGeometry';
import type { BoardModelId, Layout, ModelId, SwitchMount, TerminalDefinition, WireInstance } from '../src/types/workspace';

const sockets = { breadboard: BREADBOARD_SOCKETS, 'breadboard-large': LARGE_BREADBOARD_SOCKETS };
const terminals: TerminalDefinition[] = [
  { id: 'positive', position: [0.01, 0.03, 0.07], direction: [0, 0, 1] },
  { id: 'negative', position: [-0.018, 0.03, 0.07], direction: [0, 0, 1] },
];
const mount: SwitchMount = { breadboardId: 'board', pins: ['e10', 'e11', 'e12'] };
const initial = (modelId: BoardModelId = 'breadboard-large'): Layout => ({ instances: [
  { id: 'board', modelId, position: [0, 0], rotation: 0 },
  { id: 'switch', modelId: 'slide-switch', position: [0.1, 0], rotation: 0 },
  { id: 'other', modelId: 'slide-switch', position: [0.2, 0], rotation: 0 },
  { id: 'supply', modelId: 'power', position: [-0.2, 0], rotation: 0, outputEnabled: true },
  { id: 'led', modelId: 'led', position: [0.3, 0], rotation: 0 },
], wires: [] });
const ref = (terminalId: string, componentId = 'board') => ({ componentId, terminalId });
const wire = (id: string, from: ReturnType<typeof ref>, to: ReturnType<typeof ref>): WireInstance => ({ id, from, to, color: 'green', height: 0.005, bends: [] });
async function asset(id: ModelId) {
  const bytes = await readFile(new URL(`../../models/${id}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return { ...prepareModel(gltf.scene, modelCatalog.find(model => model.id === id)!), thumbnail: '' };
}

test('large rails split at the center while terminal groups and small rails remain correct', () => {
  expect(sockets['breadboard-large']).toHaveLength(830);
  expect(sockets.breadboard).toHaveLength(400);
  for (const rail of ['top-positive', 'top-negative', 'bottom-positive', 'bottom-negative']) {
    const definitions = sockets['breadboard-large'];
    expect(definitions.filter(socket => socket.groupId === `${rail}-left`)).toHaveLength(25);
    expect(definitions.filter(socket => socket.groupId === `${rail}-right`)).toHaveLength(25);
    expect(socketById(definitions, `${rail}-26`)!.position[0] - socketById(definitions, `${rail}-25`)!.position[0]).toBeCloseTo(0.00744, 7);
    expect(sockets.breadboard.filter(socket => socket.groupId === rail)).toHaveLength(25);
  }
  expect(socketById(sockets['breadboard-large'], 'e63')!.groupId).toBe('ae-63');
  expect(socketById(sockets['breadboard-large'], 'f63')!.groupId).toBe('fj-63');
  let layout = initial();
  layout = connectWire(layout, wire('feed', ref('positive', 'supply'), ref('top-positive-1')), sockets, terminals);
  expect(evaluatePower(layout, sockets, terminals).terminals['board:top-positive-25']).toBe('positive');
  expect(evaluatePower(layout, sockets, terminals).terminals['board:top-positive-26']).toBe('unconnected');
  layout = connectWire(layout, wire('bridge', ref('top-positive-25'), ref('top-positive-26')), sockets, terminals);
  expect(evaluatePower(layout, sockets, terminals).terminals['board:top-positive-50']).toBe('positive');
});

for (const modelId of ['breadboard', 'breadboard-large'] as const) test(`${modelId} switch occupancy, edges, relocation, rotation and cleanup`, () => {
  let layout = mountSwitch(initial(modelId), 'switch', mount, sockets);
  expect(occupiedSockets(layout).size).toBe(3);
  expect(canConnect(layout, ref('e11'), ref('a20'), sockets)).toBe(false);
  expect(canConnect(layout, ref('1', 'other'), ref('a20'), sockets)).toBe(false);
  expect(mountSwitch(layout, 'other', mount, sockets)).toBe(layout);
  const end = modelId === 'breadboard' ? 30 : 63;
  for (const pins of [['e10', 'f10', 'g10'], ['e10', 'e12', 'e14'], ['top-positive-1', 'top-positive-2', 'top-positive-3'], [`e${end - 1}`, `e${end}`, `e${end + 1}`]]) {
    expect(switchMountError(layout, { breadboardId: 'board', pins: pins as SwitchMount['pins'] }, sockets, 'switch')).not.toBeNull();
  }
  layout = toggleSlideSwitch(layout, 'switch');
  expect(layout.instances.find(instance => instance.id === 'other')!.switchPosition).toBeUndefined();
  const reversed: SwitchMount = { breadboardId: 'board', pins: ['j22', 'j21', 'j20'] };
  layout = mountSwitch(layout, 'switch', reversed, sockets);
  expect(occupiedSockets(layout).has('board:e10')).toBe(false);
  expect(switchMountPosition(reversed, layout.instances, sockets)!.rotation).toBe(Math.PI);
  layout.instances[0] = { ...layout.instances[0], position: [0.2, 0.3], rotation: Math.PI / 2 };
  const pose = switchMountPosition(reversed, layout.instances, sockets)!;
  expect(pose.rotation).toBeCloseTo(Math.PI * 1.5);
  const detached = detachMounted(layout, 'switch', sockets);
  expect(occupiedSockets(detached).size).toBe(0);
  expect(detached.instances[1].switchPosition).toBe('right');
  expect(detached.instances[1].position).toEqual([pose.position[0], pose.position[2]]);
  const deleted = removeComponent(layout, 'board', sockets);
  expect(deleted.instances.find(instance => instance.id === 'switch')!.switchMount).toBeUndefined();
  expect(deleted.instances.find(instance => instance.id === 'switch')!.position).toEqual(detached.instances[1].position);
  expect(occupiedSockets(removeComponent(layout, 'switch', sockets)).size).toBe(0);
});

test('common selects positive or negative without shorting the outer contacts', () => {
  let layout = mountSwitch(initial(), 'switch', mount, sockets);
  layout = mountLed(layout, 'led', { breadboardId: 'board', anode: 'd11', cathode: 'd12' }, sockets);
  layout = connectWire(layout, wire('positive', ref('positive', 'supply'), ref('a10')), sockets, terminals);
  layout = connectWire(layout, wire('negative', ref('negative', 'supply'), ref('a12')), sockets, terminals);
  expect(evaluatePower(layout, sockets, terminals).leds.led).toBe('on');
  for (let index = 0; index < 20; index++) {
    layout = toggleSlideSwitch(layout, 'switch');
    const power = evaluatePower(layout, sockets, terminals);
    expect(power.supplies.supply).toBe('on');
    expect(power.leds.led).toBe(index % 2 === 0 ? 'same-network' : 'on');
    expect(power.terminals['board:b11']).toBe(index % 2 === 0 ? 'negative' : 'positive');
  }
  const short = connectWire(layout, wire('short', ref('b11'), ref('b12')), sockets, terminals);
  expect(evaluatePower(short, sockets, terminals).supplies.supply).toBe('short-circuit');
  expect(evaluatePower(toggleSlideSwitch(short, 'switch'), sockets, terminals).supplies.supply).toBe('on');
  expect(evaluatePower(detachMounted(layout, 'switch', sockets), sockets, terminals).leds.led).toBe('unconnected');
  expect(evaluatePower(removeComponent(layout, 'switch', sockets), sockets, terminals).leds.led).toBe('unconnected');
  expect(evaluatePower(removeComponent(layout, 'supply', sockets), sockets, terminals).leds.led).toBe('unconnected');
});

test('mixed board endpoints use their own coordinates and remain attached after movement', () => {
  const layout = initial();
  layout.instances.push({ id: 'small', modelId: 'breadboard', position: [0.2, 0.1], rotation: Math.PI / 2 });
  const connection = wire('cross', ref('j63'), ref('a30', 'small'));
  connection.bends = [[0.1, 0.02, 0.05]];
  expect(canConnect(layout, connection.from, connection.to, sockets)).toBe(true);
  expect(canConnect(layout, connection.from, ref('a31', 'small'), sockets)).toBe(false);
  layout.instances[0] = { ...layout.instances[0], position: [-0.1, 0.3], rotation: Math.PI };
  const points = wirePoints(connection, layout.instances, sockets);
  expect(points[1]).toEqual(terminalPosition(connection.from, layout.instances, sockets));
  expect(points.at(-2)).toEqual(terminalPosition(connection.to, layout.instances, sockets));
  expect(points[3]).toEqual(localToWorld(layout.instances[0], connection.bends[0]));
});

test('independent switch circuits stay isolated and a shared active source circuit is suppressed', () => {
  let first = mountSwitch(initial(), 'switch', mount, sockets);
  first = mountLed(first, 'led', { breadboardId: 'board', anode: 'd11', cathode: 'd12' }, sockets);
  first = connectWire(first, wire('positive', ref('positive', 'supply'), ref('a10')), sockets, terminals);
  first = connectWire(first, wire('negative', ref('negative', 'supply'), ref('a12')), sockets, terminals);
  const second: Layout = {
    instances: first.instances.map(instance => ({ ...instance, id: `second-${instance.id}`, switchMount: instance.switchMount ? { ...instance.switchMount, breadboardId: 'second-board' } : undefined, mount: instance.mount ? { ...instance.mount, breadboardId: 'second-board' } : undefined })),
    wires: first.wires.map(connection => ({ ...connection, id: `second-${connection.id}`, from: { ...connection.from, componentId: `second-${connection.from.componentId}` }, to: { ...connection.to, componentId: `second-${connection.to.componentId}` } })),
  };
  const both = { instances: [...first.instances, ...second.instances], wires: [...first.wires, ...second.wires] };
  const toggled = toggleSlideSwitch(both, 'switch');
  expect(evaluatePower(toggled, sockets, terminals).leds.led).toBe('same-network');
  expect(evaluatePower(toggled, sockets, terminals).leds['second-led']).toBe('on');
  const joined = connectWire(both, wire('shared', ref('b11'), ref('b11', 'second-board')), sockets, terminals);
  expect(evaluatePower(joined, sockets, terminals).supplies.supply).toBe('multiple-supplies');
  expect(evaluatePower(joined, sockets, terminals).supplies['second-supply']).toBe('multiple-supplies');
});

test('all switch pin anchors seat rigidly 2 mm into either board at both orientations', async () => {
  const switchAsset = await asset('slide-switch');
  for (const modelId of ['breadboard', 'breadboard-large'] as const) {
    const board = await asset(modelId);
    const definitions = { ...sockets, [modelId]: board.sockets! };
    for (const pins of [mount.pins, [...mount.pins].reverse() as SwitchMount['pins']]) {
      const layout = mountSwitch(initial(modelId), 'switch', { ...mount, pins }, definitions);
      layout.instances[0] = { ...layout.instances[0], position: [0.1, -0.2], rotation: Math.PI / 2 };
      const pose = componentPose(layout.instances[1], switchAsset, layout.instances, definitions);
      const clone = switchAsset.object.clone(true), wrapper = new Group();
      wrapper.add(clone); wrapper.position.copy(pose.position); wrapper.rotation.y = pose.rotation; wrapper.updateMatrixWorld(true);
      for (let pin = 1; pin <= 3; pin++) {
        const anchor = clone.getObjectByName(`SlideSwitch_Anchor_${pin}`)!.getWorldPosition(new Vector3());
        const target = new Vector3(...localToWorld(layout.instances[0], socketById(socketsFor(layout.instances[0], definitions), pins[pin - 1])!.position));
        expect(anchor.distanceTo(target.add(new Vector3(0, -0.002, 0)))).toBeLessThan(0.000001);
        const original = switchAsset.object.getObjectByName(`SlideSwitch_Pin_${pin}`) as Mesh;
        const mounted = clone.getObjectByName(`SlideSwitch_Pin_${pin}`) as Mesh;
        expect(mounted.geometry).toBe(original.geometry);
        expect(mounted.scale.toArray()).toEqual(original.scale.toArray());
      }
      const bounds = componentBounds(layout.instances[1], switchAsset, layout.instances, definitions);
      expect(bounds.isEmpty()).toBe(false);
      expect(bounds.min.y).toBeGreaterThan(0);
    }
  }
});

test('slider and grip animate together independently and cleanup leaves source resources intact', async () => {
  const prepared = await asset('slide-switch');
  const first = prepared.object.clone(true), second = prepared.object.clone(true);
  const firstVisuals = createSlideVisuals(first), secondVisuals = createSlideVisuals(second);
  const name = 'SlideSwitch_Slider', gripName = 'SlideSwitch_Slider_Grip';
  const start = first.getObjectByName(name)!.position.clone();
  const gripStart = first.getObjectByName(gripName)!.position.clone();
  const housing = first.getObjectByName('SlideSwitch_Body')!.position.clone();
  firstVisuals.apply(transitionValue(0, 1, 75, 150), 0);
  const half = first.getObjectByName(name)!.position.x - start.x;
  expect(half).toBeCloseTo(0.00125, 7);
  expect(first.getObjectByName(gripName)!.position.x - gripStart.x).toBeCloseTo(half, 8);
  firstVisuals.apply(transitionValue(0.5, 0, 150, 150), 0);
  expect(first.getObjectByName(name)!.position.toArray()).toEqual(start.toArray());
  firstVisuals.apply(transitionValue(0, 1, 0, 0), 0); // reduced-motion endpoint
  expect(first.getObjectByName(name)!.position.x - start.x).toBeCloseTo(0.0025, 7);
  expect(second.getObjectByName(name)!.position.toArray()).toEqual(start.toArray());
  expect(first.getObjectByName('SlideSwitch_Body')!.position.toArray()).toEqual(housing.toArray());
  firstVisuals.dispose(); secondVisuals.dispose();
  expect(first.getObjectByName(name)!.position.toArray()).toEqual(start.toArray());
  expect(prepared.object.getObjectByName(name)!.position.toArray()).toEqual(start.toArray());
});

test('startup bounds use physical gaps and Home stays centered on the large work area', async () => {
  const board = await asset('breadboard-large'), supply = await asset('power'), led = await asset('led');
  const demo = createDemo(board.size.x, supply.size.x, led.size.x);
  const boardBounds = componentBounds(demo[0], board, demo, sockets);
  const supplyBounds = componentBounds(demo[1], supply, demo, sockets);
  const ledBounds = componentBounds(demo[2], led, demo, sockets);
  expect(boardBounds.min.x - supplyBounds.max.x).toBeCloseTo(0.02, 7);
  expect(ledBounds.min.x - boardBounds.max.x).toBeCloseTo(0.015, 7);
  expect(createHomeBounds(board.size.x).containsBox(boardBounds)).toBe(true);
  expect(createHomeBounds(board.size.x).containsBox(ledBounds)).toBe(true);
  const all = new Box3().union(boardBounds).union(supplyBounds).union(ledBounds);
  expect(all.getSize(new Vector3()).x).toBeGreaterThan(createHomeBounds(board.size.x).getSize(new Vector3()).x);
});
