import { expect, test } from '@playwright/test';
import { BREADBOARD_SOCKETS, LARGE_BREADBOARD_SOCKETS } from '../src/engine/breadboard';
import { evaluatePower } from '../src/engine/power';
import { validVoltage } from '../src/engine/resistor';
import type { Layout, TerminalDefinition, WireInstance } from '../src/types/workspace';

const sockets = { breadboard: BREADBOARD_SOCKETS, 'breadboard-large': LARGE_BREADBOARD_SOCKETS };
const terminals: TerminalDefinition[] = [
  { id: 'positive', position: [0, 0.03, 0], direction: [0, 0, 1] },
  { id: 'negative', position: [0.01, 0.03, 0], direction: [0, 0, 1] },
];
const ref = (terminalId: string, componentId = 'board') => ({ componentId, terminalId });
const wire = (id: string, from: ReturnType<typeof ref>, to: ReturnType<typeof ref>): WireInstance => ({ id, from, to, bends: [], color: 'green', height: 0.005 });
function circuit(voltage = 5, resistanceOhms = 330): Layout {
  return { instances: [
    { id: 'board', modelId: 'breadboard-large', position: [0, 0], rotation: 0 },
    { id: 'supply', modelId: 'power', position: [-0.2, 0], rotation: 0, voltage, outputEnabled: true },
    { id: 'r', modelId: 'resistor', position: [0, 0], rotation: 0, resistanceOhms, powerRatingWatts: 0.25, resistorMount: { breadboardId: 'board', pins: ['e10', 'e15'] } },
    { id: 'led', modelId: 'led', position: [0, 0], rotation: 0, mount: { breadboardId: 'board', anode: 'h20', cathode: 'h21' } },
  ], wires: [wire('feed', ref('positive', 'supply'), ref('a10')), wire('middle', ref('a15'), ref('j20')), wire('return', ref('j21'), ref('negative', 'supply'))] };
}
const evaluate = (layout: Layout) => evaluatePower(layout, sockets, terminals);

test('5 V and 330 ohms calculate current, drop, power, brightness and wire potentials', () => {
  const result = evaluate(circuit());
  expect(result.leds.led).toBe('on');
  expect(result.components.r.current).toBeCloseTo(3 / 330, 10);
  expect(result.components.r.voltageDrop).toBeCloseTo(3);
  expect(result.components.r.dissipation).toBeCloseTo(9 / 330, 10);
  expect(result.components.led.brightness).toBeCloseTo(3 / 330 / 0.02);
  expect(result.wires.feed.voltage).toBeCloseTo(5);
  expect(result.wires.middle.voltage).toBeCloseTo(2);
  expect(result.wires.return.voltage).toBeCloseTo(0);
  for (const reading of Object.values(result.wires)) { expect(reading.current).toBeCloseTo(3 / 330, 10); expect(reading.supplyId).toBe('supply'); }
});

test('12 V causes both warnings; 1 kilohm recovers without a reset or altering topology', () => {
  const layout = circuit(12);
  let result = evaluate(layout);
  expect(result.components.r.dissipation).toBeCloseTo(100 / 330, 10);
  expect(result.components.r.warning).toBe('Resistor overload');
  expect(result.leds.led).toBe('overcurrent');
  expect(result.components.led.brightness).toBe(0);
  expect(result.wires.feed.estimatedUnsafe).toBe(true);
  expect(result.wires.feed.current).toBeCloseTo(10 / 330, 10);
  layout.instances[2].resistanceOhms = 1000;
  result = evaluate(layout);
  expect(result.leds.led).toBe('on');
  expect(result.components.r.current).toBeCloseTo(0.01);
  expect(result.components.r.dissipation).toBeCloseTo(0.1);
  expect(result.components.r.warning).toBeNull();
  expect(result.wires.feed.estimatedUnsafe).toBe(false);
});

test('strict warning boundaries distinguish LED overcurrent from resistor overload', () => {
  expect(evaluate(circuit(6.4, 220)).leds.led).toBe('on'); // exactly 20 mA
  expect(evaluate(circuit(6.5, 220)).leds.led).toBe('overcurrent');
  expect(evaluate(circuit(9, 220)).components.r.warning).toBeNull();
  const layout = circuit(5, 100); // domain boundary fixture, not a selectable preset
  layout.instances = layout.instances.filter(instance => instance.id !== 'led');
  layout.wires = [wire('feed', ref('positive', 'supply'), ref('a10')), wire('return', ref('a15'), ref('negative', 'supply'))];
  expect(evaluate(layout).components.r.dissipation).toBeCloseTo(0.25);
  expect(evaluate(layout).components.r.warning).toBeNull();
  layout.instances[1].voltage = 5.1;
  expect(evaluate(layout).components.r.warning).toBe('Resistor overload');
});

test('resistor orientation and resistor placement on either side of the LED are equivalent', () => {
  const layout = circuit();
  layout.instances[2].resistorMount!.pins.reverse();
  expect(evaluate(layout).components.r.current).toBeCloseTo(3 / 330, 10);
  layout.wires = [wire('feed', ref('positive', 'supply'), ref('j20')), wire('middle', ref('j21'), ref('a10')), wire('return', ref('a15'), ref('negative', 'supply'))];
  expect(evaluate(layout).leds.led).toBe('on');
  expect(evaluate(layout).components.r.current).toBeCloseTo(3 / 330, 10);
  expect(evaluate(layout).wires.middle.voltage).toBeCloseTo(3);
});

test('series resistors add; resistor-only circuits calculate without an LED', () => {
  const layout = circuit();
  layout.instances.push({ id: 'r2', modelId: 'resistor', position: [0, 0], rotation: 0, resistanceOhms: 470, resistorMount: { breadboardId: 'board', pins: ['d15', 'd20'] } });
  layout.wires[1].from = ref('a20');
  expect(evaluate(layout).components.r.current).toBeCloseTo(3 / 800, 10);
  expect(evaluate(layout).components.r2.dissipation).toBeCloseTo((3 / 800) ** 2 * 470, 10);
  layout.instances = layout.instances.filter(instance => instance.id !== 'led');
  layout.wires = [layout.wires[0], wire('return', ref('a20'), ref('negative', 'supply'))];
  expect(evaluate(layout).components.r.current).toBeCloseTo(5 / 800, 10);
});

test('open, reversed, off and low-voltage circuits carry zero current', () => {
  const open = circuit(); open.wires.pop();
  expect(evaluate(open).components.r.current).toBe(0);
  expect(evaluate(open).leds.led).toBe('unconnected');
  const reversed = circuit(); reversed.instances[3].mount = { breadboardId: 'board', anode: 'h21', cathode: 'h20' };
  expect(evaluate(reversed).leds.led).toBe('reversed');
  expect(evaluate(reversed).wires.feed.current).toBe(0);
  const off = circuit(); off.instances[1].outputEnabled = false;
  expect(evaluate(off).wires.feed.voltage).toBeNull();
  expect(evaluate(off).wires.feed.current).toBe(0);
  expect(evaluate(off).leds.led).toBe('supply-off');
  expect(evaluate(circuit(2)).leds.led).toBe('below-forward');
  expect(evaluate(circuit(0)).components.r.current).toBe(0);
});

test('missing limiter, ideal shorts and unsupported branches omit fabricated readings', () => {
  const missing = circuit(); missing.instances = missing.instances.filter(instance => instance.id !== 'r');
  missing.wires[0].to = ref('j20'); missing.wires.splice(1, 1);
  expect(evaluate(missing).leds.led).toBe('missing-resistor');
  expect(evaluate(missing).components.led.current).toBeNull();
  expect(evaluate(missing).wires.feed.current).toBeNull();
  const short = circuit(); short.wires.push(wire('short', ref('b10'), ref('i21')));
  expect(evaluate(short).supplies.supply).toBe('short-circuit');
  expect(evaluate(short).wires.feed.voltage).toBeNull();
  const parallel = circuit(); parallel.instances.push({ ...parallel.instances[2], id: 'parallel', resistorMount: { breadboardId: 'board', pins: ['d10', 'd15'] } });
  expect(evaluate(parallel).leds.led).toBe('unsupported');
  expect(evaluate(parallel).components.r.current).toBeNull();
  expect(evaluate(parallel).wires.feed.voltage).toBeNull();
  const twoLeds = circuit(); twoLeds.instances.push({ ...twoLeds.instances[3], id: 'second', mount: { breadboardId: 'board', anode: 'g20', cathode: 'g21' } });
  expect(evaluate(twoLeds).leds.led).toBe('unsupported');
});

test('unused branches read zero; ideal wire loops are ambiguous; floating nodes stay unavailable', () => {
  const layout = circuit();
  layout.wires.push(wire('unused', ref('b10'), ref('a30')));
  expect(evaluate(layout).wires.unused.current).toBe(0);
  expect(evaluate(layout).wires.unused.voltage).toBe(5);
  layout.wires.push(wire('redundant', ref('b15'), ref('i20')));
  const result = evaluate(layout);
  expect(result.wires.middle.current).toBeNull();
  expect(result.wires.redundant.currentReason).toContain('redundant conductive loop');
  expect(result.wires.middle.voltage).toBeCloseTo(2);
  expect(result.wires.feed.current).toBeCloseTo(3 / 330, 10);
  layout.wires.push(wire('floating', ref('a40'), ref('a41')));
  expect(evaluate(layout).wires.floating.voltage).toBeNull();
  expect(evaluate(layout).wires.floating.reason).toBe('Floating circuit');
});

test('switching both ends of a series load to negative gives zero bias without a false source fault', () => {
  const layout = circuit();
  layout.instances.push({ id: 'switch', modelId: 'slide-switch', position: [0, 0], rotation: 0, switchPosition: 'right', switchMount: { breadboardId: 'board', pins: ['e30', 'e31', 'e32'] } });
  layout.wires[0].to = ref('a30');
  layout.wires.push(wire('common', ref('a31'), ref('a10')), wire('negative-throw', ref('a32'), ref('i21')));
  expect(evaluate(layout).leds.led).toBe('below-forward');
  expect(evaluate(layout).components.r.current).toBe(0);
  expect(evaluate(layout).supplies.supply).toBe('on');
  layout.instances.at(-1)!.switchPosition = 'left';
  expect(evaluate(layout).leds.led).toBe('on');
});

test('voltage validation rejects blank-derived nonfinite and out-of-range or fractional-step values', () => {
  for (const voltage of [0, 3.3, 5, 9, 12]) expect(validVoltage(voltage)).toBe(true);
  for (const voltage of [-0.1, 12.1, 3.35, NaN, Infinity]) expect(validVoltage(voltage)).toBe(false);
});
