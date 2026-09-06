import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BREADBOARD_SOCKETS as sockets, localToWorld } from '../src/engine/breadboard';
import { canConnect, connectWire, detachLed, removeComponent } from '../src/engine/connections';
import { evaluatePower } from '../src/engine/power';
import { routingSurface } from '../src/engine/terminals';
import { prepareModel } from '../src/lib/modelAssets';
import { createPowerVisuals, transitionValue } from '../src/lib/powerVisuals';
import { terminalPosition, wirePoints } from '../src/lib/wireGeometry';
import type { Layout, ModelId, TerminalDefinition, TerminalRef, WireInstance } from '../src/types/workspace';

const terminals: TerminalDefinition[] = [
  { id: 'positive', position: [0.01, 0.03, 0.07], direction: [0, 0, 1] },
  { id: 'negative', position: [-0.018, 0.03, 0.07], direction: [0, 0, 1] },
];
const ref = (componentId: string, terminalId: string): TerminalRef => ({ componentId, terminalId });
const wire = (id: string, from: TerminalRef, to: TerminalRef): WireInstance => ({ id, from, to, color: 'green', height: 0.005, bends: [] });
function circuit(prefix = ''): Layout {
  const board = `${prefix}board`, supply = `${prefix}supply`, led = `${prefix}led`;
  return {
    instances: [
      { id: board, modelId: 'breadboard', position: [0, 0], rotation: 0 },
      { id: supply, modelId: 'power', position: [-0.2, 0], rotation: 0, outputEnabled: true },
      { id: led, modelId: 'led', position: [0, 0], rotation: 0, mount: { breadboardId: board, anode: 'e11', cathode: 'e10' } },
    ],
    wires: [
      wire(`${prefix}positive`, ref(supply, 'positive'), ref(board, 'top-positive-1')),
      wire(`${prefix}negative`, ref(board, 'top-negative-1'), ref(supply, 'negative')),
      wire(`${prefix}anode`, ref(board, 'top-positive-2'), ref(board, 'a11')),
      wire(`${prefix}cathode`, ref(board, 'top-negative-2'), ref(board, 'a10')),
    ],
  };
}

test('a complete polarized circuit lights an LED; open, reversed and disabled circuits do not', () => {
  const layout = circuit();
  expect(evaluatePower(layout, sockets, terminals).leds.led).toBe('on');
  expect(evaluatePower(layout, sockets, terminals).terminals['board:d11']).toBe('positive');
  expect(evaluatePower(layout, sockets, terminals).terminals['board:e10']).toBe('negative');
  for (const connection of layout.wires) expect(evaluatePower({ ...layout, wires: layout.wires.filter(w => w.id !== connection.id) }, sockets, terminals).leds.led).toBe('unconnected');
  layout.instances[1].outputEnabled = false;
  expect(evaluatePower(layout, sockets, terminals).leds.led).toBe('supply-off');
  expect(evaluatePower(layout, sockets, terminals).terminals['board:e11']).toBe('unconnected');
  layout.instances[1].outputEnabled = true;
  layout.instances[2].mount = { breadboardId: 'board', anode: 'e10', cathode: 'e11' };
  expect(evaluatePower(layout, sockets, terminals).leds.led).toBe('reversed');
  layout.instances[2].mount = { breadboardId: 'board', anode: 'e12', cathode: 'e13' };
  expect(evaluatePower(layout, sockets, terminals).leds.led).toBe('unconnected');
});

test('rail markings and crossing bend positions do not determine power or connect nets', () => {
  const layout = circuit();
  layout.wires = layout.wires.map(w => ({ ...w, bends: [[0, 0.015, 0] as [number, number, number]] }));
  const swap = (terminal: TerminalRef) => ({ ...terminal, terminalId: terminal.terminalId.replace('top-positive', 'temporary').replace('top-negative', 'top-positive').replace('temporary', 'top-negative') });
  layout.wires = layout.wires.map(w => ({ ...w, from: swap(w.from), to: swap(w.to) }));
  const state = evaluatePower(layout, sockets, terminals);
  expect(state.leds.led).toBe('on');
  expect(state.terminals['board:top-negative-25']).toBe('positive');
  expect(state.terminals['board:top-positive-25']).toBe('negative');
});

test('short circuits suppress output, recover after removal, and same-net LED legs stay off', () => {
  const layout = circuit();
  const short = wire('short', ref('board', 'b10'), ref('board', 'b11'));
  layout.wires.push(short);
  let state = evaluatePower(layout, sockets, terminals);
  expect(state.supplies.supply).toBe('short-circuit');
  expect(state.leds.led).toBe('fault');
  expect(state.terminals['board:a10']).toBe('fault');
  layout.instances[1].outputEnabled = false;
  expect(evaluatePower(layout, sockets, terminals).leds.led).toBe('same-network');
  layout.instances[1].outputEnabled = true;
  layout.wires.pop();
  state = evaluatePower(layout, sockets, terminals);
  expect(state.supplies.supply).toBe('on'); expect(state.leds.led).toBe('on');
});

test('independent supplies work; shared circuits fault only while multiple supplies are enabled', () => {
  const first = circuit(), second = circuit('second-');
  const layout = { instances: [...first.instances, ...second.instances], wires: [...first.wires, ...second.wires] };
  let state = evaluatePower(layout, sockets, terminals);
  expect(state.leds).toEqual({ led: 'on', 'second-led': 'on' });
  layout.wires.push(wire('bridge', ref('board', 'top-negative-3'), ref('second-board', 'top-negative-3')));
  state = evaluatePower(layout, sockets, terminals);
  expect(state.supplies).toEqual({ supply: 'multiple-supplies', 'second-supply': 'multiple-supplies' });
  expect(state.leds).toEqual({ led: 'fault', 'second-led': 'fault' });
  layout.instances.find(i => i.id === 'second-supply')!.outputEnabled = false;
  state = evaluatePower(layout, sockets, terminals);
  expect(state.leds.led).toBe('on'); expect(state.leds['second-led']).toBe('supply-off');
  layout.wires.push(wire('positive-bridge', ref('board', 'top-positive-3'), ref('second-board', 'top-positive-3')));
  layout.instances.find(i => i.id === 'supply')!.outputEnabled = false;
  layout.instances.find(i => i.id === 'second-supply')!.outputEnabled = true;
  expect(evaluatePower(layout, sockets, terminals).leds).toEqual({ led: 'on', 'second-led': 'on' });
});

test('supply wiring enforces occupancy and deletion releases endpoints and power', () => {
  const layout = circuit();
  expect(canConnect({ ...layout, wires: [] }, ref('supply', 'positive'), ref('board', 'a1'), sockets, terminals)).toBe(true);
  expect(canConnect({ ...layout, wires: [] }, ref('board', 'a1'), ref('supply', 'negative'), sockets, terminals)).toBe(true);
  expect(canConnect(layout, ref('supply', 'positive'), ref('board', 'a1'), sockets, terminals)).toBe(false);
  expect(canConnect({ ...layout, wires: [] }, ref('supply', 'positive'), ref('supply', 'negative'), sockets, terminals)).toBe(false);
  expect(canConnect(layout, ref('led', 'positive'), ref('board', 'a1'), sockets, terminals)).toBe(false);
  expect(connectWire(layout, wire('duplicate', ref('supply', 'positive'), ref('board', 'b1')), sockets, terminals).wires).toHaveLength(4);
  const removed = removeComponent(layout, 'supply', sockets);
  expect(removed.wires).toHaveLength(2); expect(evaluatePower(removed, sockets, terminals).leds.led).toBe('unconnected');
  expect(evaluatePower(detachLed(layout, 'led', sockets), sockets, terminals).leds.led).toBe('unmounted');
  const boardDeleted = removeComponent(layout, 'board', sockets);
  expect(boardDeleted.wires).toHaveLength(0); expect(evaluatePower(boardDeleted, sockets, terminals).leds.led).toBe('unmounted');
});

test('terminal exits, source-relative bends and both endpoints survive component transforms', () => {
  const layout = circuit();
  const lead = { ...layout.wires[0], bends: [[0.08, 0.012, 0.1] as [number, number, number]] };
  layout.instances[1].rotation = Math.PI / 2;
  layout.instances[0].rotation = Math.PI;
  layout.instances[0].position = [0.3, 0.4];
  const points = wirePoints(lead, layout.instances, sockets, terminals);
  const face = terminalPosition(lead.from, layout.instances, sockets, terminals)!;
  expect(points[1]).toEqual(face);
  expect(points[2][0] - face[0]).toBeCloseTo(0.005);
  expect(points[2][1]).toBeCloseTo(face[1]);
  expect(points[3]).toEqual(localToWorld(layout.instances[1], lead.bends[0]));
  expect(points.at(-2)).toEqual(terminalPosition(lead.to, layout.instances, sockets, terminals));
  expect(routingSurface(lead.from, layout.instances, sockets)).toBe(0);
  expect(routingSurface(lead.to, layout.instances, sockets)).toBeCloseTo(0.008765);
});

async function loadAsset(id: ModelId) {
  const bytes = await readFile(new URL(`../../models/${id}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return { source: gltf.scene, ...prepareModel(gltf.scene, { id, scale: 0.1, rotation: [0, 0, 0], url: '', label: id, description: '' }) };
}

test('power anchors match actual metal faces and animated switches stay independent', async () => {
  const asset = await loadAsset('power');
  for (const [id, name] of [['positive', 'Positive'], ['negative', 'Negative']]) {
    const terminal = asset.terminals!.find(t => t.id === id)!;
    const box = new Box3().setFromObject(asset.object.getObjectByName(`${name}_Terminal_Metal`)!);
    const center = box.getCenter(new Vector3());
    expect(terminal.position).toEqual([center.x, center.y, box.max.z]);
    expect(asset.object.getObjectByName(`${name}_Wire_Anchor`)!.position.toArray()).toEqual(terminal.position);
    expect(asset.source.getObjectByName(`${name}_Wire_Anchor`)).toBeUndefined();
  }
  const first = asset.object.clone(true), second = asset.object.clone(true);
  const firstVisual = createPowerVisuals(first, 'power'), secondVisual = createPowerVisuals(second, 'power');
  firstVisual.apply(1, 1);
  expect(first.getObjectByName('Power_Switch')!.rotation.x).toBeCloseTo(8 * Math.PI / 180);
  expect(second.getObjectByName('Power_Switch')!.rotation.x).toBeCloseTo(-8 * Math.PI / 180);
  expect(first.getObjectByName('Power_Switch_Housing')!.rotation.x).toBe(0);
  expect(asset.source.getObjectByName('Display_Voltage')!.visible).toBe(true);
  firstVisual.dispose(); secondVisual.dispose();
});

test('LED glow materials are per instance, preserve geometry, and dispose on removal', async () => {
  const asset = await loadAsset('led');
  const first = asset.object.clone(true), second = asset.object.clone(true);
  const firstVisual = createPowerVisuals(first, 'led'), secondVisual = createPowerVisuals(second, 'led');
  const lens = first.getObjectByName('LED_Lens') as Mesh;
  const other = second.getObjectByName('LED_Lens') as Mesh;
  const source = asset.object.getObjectByName('LED_Lens') as Mesh;
  expect(lens.geometry).toBe(source.geometry); expect(lens.material).not.toBe(source.material);
  firstVisual.apply(0, 1);
  expect((lens.material as MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(0);
  expect((other.material as MeshStandardMaterial).emissiveIntensity).toBe(0);
  let disposed = false;
  (lens.material as MeshStandardMaterial).addEventListener('dispose', () => { disposed = true; });
  firstVisual.dispose(); secondVisual.dispose(); expect(disposed).toBe(true);
});

test('transition timing is bounded, reversible from the current value, and immediate for reduced motion', () => {
  expect(transitionValue(0, 1, 0, 180)).toBe(0);
  const halfway = transitionValue(0, 1, 90, 180);
  expect(halfway).toBeCloseTo(0.5);
  expect(transitionValue(halfway, 0, 0, 180)).toBe(halfway);
  expect(transitionValue(halfway, 0, 180, 180)).toBe(0);
  expect(transitionValue(0, 1, 1000, 150)).toBe(1);
  expect(transitionValue(0, 1, 0, 0)).toBe(1);
});
