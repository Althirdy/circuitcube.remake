import type { CircuitGraph, Load } from '../circuitGraph';
import { adjacency } from '../circuitGraph';
import type { ComponentReading, LedStatus } from '../power';
import { DEFAULT_RESISTANCE } from '../resistor';
import type { DigitalResult, DigitalSignal } from './evaluateDigital';

const LED_FORWARD_VOLTAGE = 2;
const LED_MAX_CURRENT = 0.02;
const DEFAULT_RESISTOR_RATING = 0.25;
export type OutputLoadResult = {
  handled: Set<string>;
  components: Record<string, ComponentReading>;
  leds: Record<string, LedStatus>;
  nets: Map<string, DigitalSignal>;
  injections: Map<string, number>;
  uncertainNets: Set<string>;
  unsafeNets: Set<string>;
};

// Cut passive paths at independently driven nets. This supports a series load
// per output without introducing a general parallel/nodal DC solver.
export function evaluateOutputLoads(graph: CircuitGraph, digital: DigitalResult): OutputLoadResult {
  const result: OutputLoadResult = { handled: new Set(), components: {}, leds: {}, nets: new Map(), injections: new Map(), uncertainNets: new Set(), unsafeNets: new Set() };
  const outputNets = new Set(digital.outputs.map(output => output.net));
  const boundaries = new Set([...digital.railNets, ...outputNets]);
  const links = adjacency(graph.loads);
  const visited = new Set<string>();
  const groups: Load[][] = [];
  for (const first of graph.loads) {
    if (visited.has(first.id)) continue;
    const group: Load[] = [];
    const pending = [first];
    while (pending.length) {
      const load = pending.pop()!;
      if (visited.has(load.id)) continue;
      visited.add(load.id);
      group.push(load);
      for (const net of [load.a, load.b]) if (!boundaries.has(net)) pending.push(...(links.get(net) ?? []).filter(next => !visited.has(next.id)));
    }
    if (group.some(load => outputNets.has(load.a) || outputNets.has(load.b))) groups.push(group);
  }
  const outputUse = new Map<string, number>();
  for (const group of groups) {
    const nets = new Set(group.flatMap(load => [load.a, load.b]));
    for (const net of nets) if (outputNets.has(net)) outputUse.set(net, (outputUse.get(net) ?? 0) + 1);
  }
  const inject = (node: string, current: number) => result.injections.set(node, (result.injections.get(node) ?? 0) + current);
  for (const group of groups) {
    const nets = new Set(group.flatMap(load => [load.a, load.b]));
    const ends = [...nets].filter(net => boundaries.has(net));
    const paths = adjacency(group);
    const signal = (net: string) => digital.nets.get(net);
    const outputEnds = ends.filter(net => outputNets.has(net));
    const invalidResistance = group.some(load => load.kind === 'resistor' && (!Number.isFinite(load.instance.resistanceOhms ?? DEFAULT_RESISTANCE) || (load.instance.resistanceOhms ?? DEFAULT_RESISTANCE) <= 0));
    const branched = [...paths].some(([net, edges]) => edges.length > (boundaries.has(net) ? 1 : 2));
    const unsupported = invalidResistance || branched || group.filter(load => load.kind === 'led').length > 1 || ends.length > 2 || outputEnds.length > 1 || outputEnds.some(net => (outputUse.get(net) ?? 0) > 1);
    let reason: string | null = unsupported ? 'Unsupported output load: use one series resistor/LED path from an output to VCC or ground.' : null;
    const badSignal = ends.map(signal).find(value => value?.level === 'fault' || value?.voltage === null);
    if (!reason && badSignal) reason = badSignal.reason ?? 'Output is unresolved';
    if (!reason && ends.length === 2 && signal(ends[0])?.supplyId !== signal(ends[1])?.supplyId) reason = 'Output load must use the IC’s own supply reference.';
    const closed = ends.length === 2;
    const start = [...ends].sort((a, b) => (signal(b)?.voltage ?? 0) - (signal(a)?.voltage ?? 0))[0];
    const end = ends.find(net => net !== start);
    const steps: { load: Load; from: string; to: string }[] = [];
    let node = start;
    const seen = new Set<string>();
    while (node !== undefined) {
      const load = paths.get(node)?.find(load => !seen.has(load.id));
      if (!load) break;
      seen.add(load.id);
      const to = load.a === node ? load.b : load.a;
      steps.push({ load, from: node, to });
      node = to;
      if (node === end) break;
    }
    if (!reason && (seen.size !== group.length || (closed && node !== end))) reason = 'Unsupported output load: remove branches or loops.';
    const voltage = closed ? Math.abs((signal(start)?.voltage ?? 0) - (signal(end!)?.voltage ?? 0)) : 0;
    const led = steps.find(step => step.load.kind === 'led');
    const reversed = !!led && led.from !== led.load.a;
    const resistance = group.reduce((sum, load) => sum + (load.kind === 'resistor' ? load.instance.resistanceOhms ?? DEFAULT_RESISTANCE : 0), 0);
    const missing = closed && !!led && !reversed && resistance === 0 && voltage > LED_FORWARD_VOLTAGE;
    if (missing && !reason) reason = 'Missing current-limiting resistor';
    const current = reason ? null : !closed || reversed ? 0 : resistance > 0 ? Math.max(0, voltage - (led ? LED_FORWARD_VOLTAGE : 0)) / resistance : 0;
    const overcurrent = !!led && current !== null && current > LED_MAX_CURRENT + 1e-12;
    const overload = current !== null && group.some(load => load.kind === 'resistor' && current ** 2 * (load.instance.resistanceOhms ?? DEFAULT_RESISTANCE) > (load.instance.powerRatingWatts ?? DEFAULT_RESISTOR_RATING) + 1e-12);
    const unsafe = overcurrent || overload;
    if (unsafe) for (const net of nets) result.unsafeNets.add(net);
    for (const load of group) {
      result.handled.add(load.id);
      const resistorPower = load.kind === 'resistor' && current !== null ? current ** 2 * (load.instance.resistanceOhms ?? DEFAULT_RESISTANCE) : null;
      const warning = reason ?? (resistorPower !== null && resistorPower > (load.instance.powerRatingWatts ?? DEFAULT_RESISTOR_RATING) + 1e-12 ? 'Resistor overload' : null);
      result.components[load.id] = { current, voltageDrop: null, dissipation: resistorPower, brightness: 0, warning, reason: reason ?? (!closed ? 'Incomplete output circuit' : null), estimatedUnsafe: unsafe };
      if (load.kind === 'led') {
        const state = outputLedStatus({ missing, reason, unsupported, signal: badSignal, closed, reversed, overcurrent, overload, current });
        result.leds[load.id] = state;
        result.components[load.id].brightness = state === 'on' ? Math.min(1, (current ?? 0) / LED_MAX_CURRENT) : 0;
        if (overcurrent) result.components[load.id].warning = 'LED overcurrent';
        else if (overload) result.components[load.id].warning = 'Resistor overload';
      }
    }
    if (current === null) {
      for (const net of nets) {
        result.uncertainNets.add(net);
        if (!boundaries.has(net)) result.nets.set(net, { level: badSignal?.level === 'fault' ? 'fault' : 'unknown', voltage: null, supplyId: signal(start)?.supplyId ?? null, reason });
      }
      continue;
    }
    let potential = signal(start)?.voltage ?? null;
    for (const step of steps) {
      const drop = step.load.kind === 'resistor' ? current * (step.load.instance.resistanceOhms ?? DEFAULT_RESISTANCE) : closed ? current > 0 ? LED_FORWARD_VOLTAGE : voltage : null;
      result.components[step.load.id].voltageDrop = drop === null ? null : drop * (step.from === step.load.a ? 1 : -1);
      const fromVoltage = potential;
      potential = potential !== null && drop !== null ? potential - drop : null;
      for (const [net, value] of [[step.from, fromVoltage], [step.to, potential]] as const) if (!boundaries.has(net)) {
        result.nets.set(net, { level: 'unknown', voltage: value, supplyId: signal(start)?.supplyId ?? null, reason: closed ? null : 'Incomplete output circuit' });
      }
      inject(step.from === step.load.a ? step.load.terminalA : step.load.terminalB, -current);
      inject(step.from === step.load.a ? step.load.terminalB : step.load.terminalA, current);
    }
    for (const net of outputEnds) {
      const driver = digital.outputs.find(driver => driver.net === net);
      if (driver) inject(driver.node, net === start ? current : -current);
    }
  }
  return result;
}

function outputLedStatus(state: { missing: boolean; reason: string | null; unsupported: boolean; signal: DigitalSignal | undefined; closed: boolean; reversed: boolean; overcurrent: boolean; overload: boolean; current: number | null }): LedStatus {
  if (state.missing) return 'missing-resistor';
  if (state.reason) {
    if (state.signal?.level === 'fault') return 'fault';
    if (!state.unsupported && state.signal?.voltage === null) return 'logic-unknown';
    return 'unsupported';
  }
  if (!state.closed) return 'unconnected';
  if (state.current === 0 && !state.reversed) return 'below-forward';
  if (state.reversed) return 'reversed';
  if (state.overcurrent) return 'overcurrent';
  if (state.overload) return 'resistor-overload';
  return 'on';
}
