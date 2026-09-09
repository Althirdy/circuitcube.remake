import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BoardModelId, Layout, LogicIcModelId, TerminalDefinition, WireInstance } from '../src/types/workspace';
import { BREADBOARD_SOCKETS, LARGE_BREADBOARD_SOCKETS, localToWorld, socketById } from '../src/engine/breadboard';
import { detachMounted, occupiedSockets, removeComponent } from '../src/engine/connections';
import { icMountError, icMountPosition, icPinSockets, mountIc, rotateIc } from '../src/engine/icMounting';
import { mountingCandidate } from '../src/engine/mounting';
import { evaluateGate } from '../src/engine/digital/gates';
import { logicLevel } from '../src/engine/digital/logicLevels';
import { logicIcDefinitions } from '../src/engine/digital/logicIcDefinitions';
import { evaluateCircuit } from '../src/engine/evaluateCircuit';
import { prepareModel } from '../src/lib/modelAssets';
import { modelCatalog } from '../src/lib/modelCatalog';
import { componentPose } from '../src/lib/componentPose';
import { seatIcPins } from '../src/lib/icAsset';

const sockets = { breadboard: BREADBOARD_SOCKETS, 'breadboard-large': LARGE_BREADBOARD_SOCKETS };
const terminals: TerminalDefinition[] = [
  { id: 'positive', position: [0, 0, 0], direction: [0, 0, 1] },
  { id: 'negative', position: [0.01, 0, 0], direction: [0, 0, 1] },
];
function wire(layout: Layout, from: string, to: string, component = 'board') {
  const next: WireInstance = { id: `wire-${layout.wires.length}`, from: { componentId: component, terminalId: from }, to: { componentId: 'board', terminalId: to }, color: 'green', bends: [], height: 0.005 };
  layout.wires.push(next);
  return next;
}
function circuit(modelId: LogicIcModelId = 'ic-7408', boardId: BoardModelId = 'breadboard-large'): Layout {
  const layout: Layout = { instances: [
    { id: 'board', modelId: boardId, position: [0, 0], rotation: 0 },
    { id: 'supply', modelId: 'power', position: [-0.2, 0], rotation: 0, outputEnabled: true, voltage: 5 },
    { id: 'ic', modelId, position: [0, 0], rotation: 0, icMount: { breadboardId: 'board', pins: icPinSockets(10, false) } },
  ], wires: [] };
  wire(layout, 'positive', 'j10', 'supply');
  wire(layout, 'negative', 'a16', 'supply');
  return layout;
}
const evaluate = (layout: Layout) => evaluateCircuit(layout, sockets, terminals);
const pin = (layout: Layout, number: number) => layout.instances.find(instance => instance.id === 'ic')!.icMount!.pins[number - 1];
const accessible = (id: string) => `${id[0] === 'e' ? 'a' : 'j'}${id.slice(1)}`;

test('TTL thresholds and partial truth tables retain unknown and fault distinctions', () => {
  expect([0, 0.8, 0.9, 1.9, 2, 5, 5.1, -0.1].map(value => logicLevel(value))).toEqual(['low', 'low', 'unknown', 'unknown', 'high', 'high', 'fault', 'fault']);
  expect(logicLevel(null)).toBe('unknown');
  expect(evaluateGate('and', ['unknown', 'low'])).toBe('low');
  expect(evaluateGate('or', ['unknown', 'high'])).toBe('high');
  expect(evaluateGate('not', ['unknown'])).toBe('unknown');
  expect(evaluateGate('and', ['fault', 'low'])).toBe('fault');
});

for (const modelId of ['ic-7408', 'ic-7432', 'ic-7404'] as const) {
  test(`${modelId}: all package gates follow every binary truth-table row`, () => {
    const definition = logicIcDefinitions[modelId];
    for (const gate of definition.gates) {
      for (let combination = 0; combination < 2 ** gate.inputs.length; combination++) {
        const layout = circuit(modelId);
        const bits = gate.inputs.map((input, index) => {
          const high = (combination & (1 << index)) !== 0;
          wire(layout, high ? 'i10' : 'b16', accessible(pin(layout, input)));
          return high;
        });
        const result = evaluate(layout);
        const expected = definition.kind === 'and' ? bits.every(Boolean) : definition.kind === 'or' ? bits.some(Boolean) : !bits[0];
        expect(result.digital.chips.ic.status).toBe('ready');
        expect(result.digital.chips.ic.pins[gate.output - 1].level).toBe(expected ? 'high' : 'low');
      }
    }
  });
  test(`${modelId}: exported anchors seat in all 14 sockets after rotation without modifying the source`, async () => {
    const model = modelCatalog.find(model => model.id === modelId)!;
    const filename = model.url.split('/').at(-1)!;
    const bytes = await readFile(new URL(`../../models/${filename}`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const asset = { ...prepareModel(gltf.scene, model), thumbnail: '' };
    for (const boardId of ['breadboard', 'breadboard-large'] as const) for (const flipped of [false, true]) {
      const layout = circuit(modelId, boardId);
      layout.instances[0].rotation = Math.PI / 2;
      layout.instances[0].position = [0.1, 0.2];
      if (flipped) layout.instances[2] = rotateIc(layout.instances[2]);
      const instance = layout.instances[2];
      const clone = asset.object.clone(true);
      const prefix = logicIcDefinitions[modelId].prefix;
      const originalAnchor = asset.object.getObjectByName(`${prefix}_Anchor_1`)!.position.clone();
      seatIcPins(clone, modelId, 0.0092);
      const pose = componentPose(instance, asset, layout.instances, sockets);
      const wrapper = new Group();
      wrapper.add(clone);
      wrapper.position.copy(pose.position);
      wrapper.rotation.y = pose.rotation;
      wrapper.updateMatrixWorld(true);
      for (let index = 0; index < 14; index++) {
        const anchor = clone.getObjectByName(`${prefix}_Anchor_${index + 1}`)!.getWorldPosition(new Vector3());
        const socket = socketById(sockets[boardId], instance.icMount!.pins[index])!;
        const target = new Vector3(...localToWorld(layout.instances[0], socket.position)).add(new Vector3(0, -0.002, 0));
        expect(anchor.distanceTo(target)).toBeLessThan(0.000001);
      }
      expect(asset.object.getObjectByName(`${prefix}_Anchor_1`)!.position.equals(originalAnchor)).toBe(true);
    }
  });
}

for (const boardId of ['breadboard', 'breadboard-large'] as const) test(`${boardId}: DIP occupancy, validation, relocation, reversal and cleanup`, () => {
  let layout = circuit('ic-7408', boardId);
  layout.wires = [];
  expect(occupiedSockets(layout).size).toBe(14);
  const mount = { breadboardId: 'board', pins: icPinSockets(20, false) };
  expect(icMountError(layout, mount, sockets, 'ic')).toBeNull();
  layout = mountIc(layout, 'ic', mount, sockets);
  expect(occupiedSockets(layout).has('board:e10')).toBe(false);
  layout.instances[2] = rotateIc(layout.instances[2]);
  expect(layout.instances[2].icMount!.pins[0]).toBe('f26');
  expect(layout.instances[2].icMount!.pins[13]).toBe('e26');
  const lastColumn = boardId === 'breadboard' ? 30 : 63;
  expect(icMountError(layout, { ...mount, pins: icPinSockets(lastColumn - 5, false) }, sockets, 'ic')).not.toBeNull();
  const occupied = { ...mount, pins: icPinSockets(20, false) };
  expect(icMountError(layout, occupied, sockets)).toContain('occupied');
  expect(mountingCandidate(layout, 'ic-7408', layout.instances[0], socketById(sockets[boardId], 'a10')!.position, sockets, false).valid).toBe(false);
  const pose = icMountPosition(layout.instances[2].icMount!, layout.instances, sockets)!;
  const detached = detachMounted(layout, 'ic', sockets);
  expect(detached.instances[2].icMount).toBeUndefined();
  expect(detached.instances[2].position).toEqual([pose.position[0], pose.position[2]]);
  expect(occupiedSockets(detached).size).toBe(0);
  expect(removeComponent(layout, 'board', sockets).instances.find(instance => instance.id === 'ic')!.icMount).toBeUndefined();
  expect(occupiedSockets(removeComponent(layout, 'ic', sockets)).size).toBe(0);
});

test('missing, off, reversed and out-of-range supplies recover without stored logic state', () => {
  const layout = circuit();
  expect(evaluate(layout).digital.chips.ic.status).toBe('ready');
  layout.instances[1].outputEnabled = false;
  expect(evaluate(layout).digital.chips.ic.status).toBe('unpowered');
  layout.instances[1].outputEnabled = true;
  for (const voltage of [3.3, 9, 12]) {
    layout.instances[1].voltage = voltage;
    expect(evaluate(layout).digital.chips.ic.status).toBe('fault');
  }
  layout.instances[1].voltage = 5;
  expect(evaluate(layout).digital.chips.ic.status).toBe('ready');
  [layout.wires[0].to, layout.wires[1].to] = [layout.wires[1].to, layout.wires[0].to];
  expect(evaluate(layout).digital.chips.ic.status).toBe('fault');
  layout.wires = [];
  expect(evaluate(layout).digital.chips.ic.status).toBe('unpowered');
});

test('chained inverters resolve; feedback and contention clear when their wire is removed', () => {
  const layout = circuit('ic-7404');
  wire(layout, 'i10', 'a10'); // gate 1 HIGH -> LOW
  wire(layout, 'b11', 'a12'); // gate 1 output -> gate 2 input
  wire(layout, 'b13', 'a14'); // gate 2 output -> gate 3 input
  let result = evaluate(layout);
  expect([2, 4, 6].map(pin => result.digital.chips.ic.pins[pin - 1].level)).toEqual(['low', 'high', 'low']);
  const conflict = wire(layout, 'b11', 'b13');
  expect(evaluate(layout).digital.chips.ic.status).toBe('fault');
  layout.wires = layout.wires.filter(wire => wire.id !== conflict.id);
  expect(evaluate(layout).digital.chips.ic.status).toBe('ready');
  layout.wires = layout.wires.slice(0, 2);
  wire(layout, 'b11', 'a10');
  result = evaluate(layout);
  expect(result.digital.chips.ic.pins[1].level).toBe('unknown');
  expect(result.digital.chips.ic.pins[1].reason).toContain('Feedback loop');
});

test('outputs chain between packages while unrelated circuits remain independent', () => {
  const layout = circuit('ic-7404');
  layout.instances.push({ id: 'second', modelId: 'ic-7408', position: [0, 0], rotation: 0, icMount: { breadboardId: 'board', pins: icPinSockets(30, false) } });
  wire(layout, 'i10', 'j30');
  wire(layout, 'b16', 'a36');
  wire(layout, 'b16', 'a10'); // inverter LOW -> HIGH
  wire(layout, 'b11', 'a30');
  wire(layout, 'h10', 'a31');
  expect(evaluate(layout).digital.chips.second.pins[2].level).toBe('high');
  wire(layout, 'c11', 'h10'); // same HIGH rail is not contradictory yet
  expect(evaluate(layout).digital.chips.second.pins[2].level).toBe('high');
  layout.wires[4].from = { componentId: 'board', terminalId: 'g10' };
  expect(evaluate(layout).digital.chips.ic.status).toBe('fault');
});

function ledCircuit(sink: boolean): Layout {
  const layout = circuit('ic-7404');
  wire(layout, sink ? 'i10' : 'b16', 'a10');
  layout.instances.push(
    { id: 'r', modelId: 'resistor', position: [0, 0], rotation: 0, resistanceOhms: 330, resistorMount: { breadboardId: 'board', pins: ['e40', 'e45'] } },
    { id: 'led', modelId: 'led', position: [0, 0], rotation: 0, mount: { breadboardId: 'board', anode: 'h50', cathode: 'h51' } },
  );
  wire(layout, sink ? 'h10' : 'b11', 'a40');
  wire(layout, 'a45', 'j50');
  wire(layout, 'j51', sink ? 'b11' : 'c16');
  return layout;
}
for (const sink of [false, true]) test(`IC ${sink ? 'sinks' : 'sources'} LED current and clears overloads`, () => {
  const layout = ledCircuit(sink);
  let result = evaluate(layout);
  expect(result.power.leds.led).toBe('on');
  expect(result.power.components.r.current).toBeCloseTo(3 / 330);
  expect(result.power.wires['wire-4'].voltage).toBeCloseTo(2);
  expect(result.power.wires['wire-4'].current).toBeCloseTo(3 / 330);
  expect(result.power.wires['wire-0'].current).toBeNull();
  layout.instances.find(instance => instance.id === 'r')!.resistanceOhms = 100;
  result = evaluate(layout);
  expect(result.power.leds.led).toBe('overcurrent');
  expect(result.power.components.led.brightness).toBe(0);
  layout.instances.find(instance => instance.id === 'r')!.resistanceOhms = 1000;
  expect(evaluate(layout).power.leds.led).toBe('on');
  layout.wires.pop();
  expect(evaluate(layout).power.components.r.current).toBe(0);
});

test('output loads reject missing resistors, parallel paths and reversed LEDs explicitly', () => {
  const missing = ledCircuit(false);
  missing.instances = missing.instances.filter(instance => instance.id !== 'r');
  missing.wires = missing.wires.filter(wire => !['wire-3', 'wire-4'].includes(wire.id));
  wire(missing, 'b11', 'j50');
  expect(evaluate(missing).power.leds.led).toBe('missing-resistor');
  expect(evaluate(missing).power.components.led.current).toBeNull();

  const parallel = ledCircuit(false);
  parallel.instances.push({ id: 'parallel', modelId: 'resistor', position: [0, 0], rotation: 0, resistanceOhms: 330, resistorMount: { breadboardId: 'board', pins: ['d40', 'd45'] } });
  expect(evaluate(parallel).power.leds.led).toBe('unsupported');
  expect(evaluate(parallel).power.components.r.current).toBeNull();

  const reversed = ledCircuit(false);
  reversed.instances.find(instance => instance.id === 'led')!.mount = { breadboardId: 'board', anode: 'h51', cathode: 'h50' };
  expect(evaluate(reversed).power.leds.led).toBe('reversed');
  expect(evaluate(reversed).power.components.r.current).toBe(0);
});

test('bench-only evaluation is preserved in the presence of an independent IC', () => {
  const layout = ledCircuit(false);
  layout.instances.push(
    { id: 'other-board', modelId: 'breadboard', position: [0.3, 0], rotation: 0 },
    { id: 'other-supply', modelId: 'power', position: [0.5, 0], rotation: 0, voltage: 5, outputEnabled: true },
    { id: 'other-r', modelId: 'resistor', position: [0, 0], rotation: 0, resistanceOhms: 1000, resistorMount: { breadboardId: 'other-board', pins: ['e10', 'e15'] } },
  );
  for (const [terminalId, socket] of [['positive', 'a10'], ['negative', 'a15']]) layout.wires.push({ id: `other-${terminalId}`, from: { componentId: 'other-supply', terminalId }, to: { componentId: 'other-board', terminalId: socket }, color: 'green', bends: [], height: 0.005 });
  const result = evaluate(layout);
  expect(result.power.components['other-r'].current).toBeCloseTo(0.005);
  expect(result.power.wires['other-positive'].current).toBeCloseTo(0.005);
  expect(result.power.components.r.current).toBeCloseTo(3 / 330);
});
