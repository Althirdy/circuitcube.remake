import type { Layout, SocketSource, TerminalDefinition } from '../types/workspace';
import { adjacency, circuitGraph, Groups, idealWireCurrent } from './circuitGraph';
import type { Load } from './circuitGraph';
import { DEFAULT_RESISTANCE, DEFAULT_VOLTAGE } from './resistor';

export type SupplyStatus = 'off' | 'on' | 'short-circuit' | 'multiple-supplies';
export type TerminalStatus = 'unconnected' | 'positive' | 'negative' | 'voltage' | 'fault';
export type LedStatus = 'on' | 'unmounted' | 'unconnected' | 'supply-off' | 'reversed' | 'same-network' | 'fault' | 'below-forward' | 'missing-resistor' | 'overcurrent' | 'resistor-overload' | 'unsupported';
export type ComponentReading = { current: number | null; voltageDrop: number | null; dissipation: number | null; brightness: number; warning: string | null; reason: string | null; estimatedUnsafe: boolean };
export type WireReading = { voltage: number | null; current: number | null; supplyId: string | null; reason: string | null; currentReason: string | null; estimatedUnsafe: boolean };
export type PowerResult = {
  supplies: Record<string, SupplyStatus>;
  terminals: Record<string, TerminalStatus>;
  leds: Record<string, LedStatus>;
  components: Record<string, ComponentReading>;
  wires: Record<string, WireReading>;
};
export const powerLabels = { off: 'Output OFF', on: 'Output ON', 'short-circuit': 'Short circuit', 'multiple-supplies': 'Multiple supplies connected' };
export const ledLabels: Record<LedStatus, string> = {
  on: 'LED ON', unmounted: 'LED OFF · insert into breadboard', unconnected: 'LED OFF · incomplete circuit',
  'supply-off': 'LED OFF · supply is off', reversed: 'LED OFF · reversed polarity', 'same-network': 'LED OFF · legs share one network',
  fault: 'LED OFF · circuit fault', 'below-forward': 'LED OFF · below forward voltage',
  'missing-resistor': 'Missing current-limiting resistor', overcurrent: 'LED overcurrent',
  'resistor-overload': 'LED OFF · resistor overload', unsupported: 'Unsupported circuit topology',
};
export const terminalStatusLabels: Record<TerminalStatus, string> = {
  unconnected: 'Unconnected / no active power', positive: 'Positive (+)', negative: 'Negative (−)', voltage: 'Intermediate potential', fault: 'Circuit fault',
};
const emptyReading = (reason: string | null = null): ComponentReading => ({ current: null, voltageDrop: null, dissipation: null, brightness: 0, warning: null, reason, estimatedUnsafe: false });
type NetReading = { voltage: number | null; supplyId: string | null; reason: string | null; knownCurrent: boolean; estimatedUnsafe: boolean };
const unavailable = (reason: string): NetReading => ({ voltage: null, supplyId: null, reason, knownCurrent: false, estimatedUnsafe: false });

// Deliberately limited series DC model. No nodal solver, thermal simulation,
// implicit resistor bypass, or fabricated current split through ideal loops.
export function evaluatePower(layout: Layout, sockets: SocketSource, terminals: TerminalDefinition[]): PowerResult {
  const { terminalNodes, nets, ideal, loads, supplies, circuits } = circuitGraph(layout, sockets, terminals);
  const result: PowerResult = { supplies: {}, terminals: {}, leds: {}, components: {}, wires: {} };
  const readings = new Map<string, NetReading>();
  const injections = new Map<string, number>();
  const inject = (node: string, current: number) => injections.set(node, (injections.get(node) ?? 0) + current);
  for (const instance of layout.instances) {
    if (instance.modelId === 'power') result.supplies[instance.id] = 'off';
    if (instance.modelId === 'led' || instance.modelId === 'resistor') result.components[instance.id] = emptyReading('Insert into breadboard');
    if (instance.modelId === 'led') result.leds[instance.id] = 'unmounted';
  }
  const netIds = [...new Set([...terminalNodes.values()].map(node => nets.find(node)))];
  const regions = new Map<string, string[]>();
  for (const net of netIds) { const id = circuits.find(net); regions.set(id, [...(regions.get(id) ?? []), net]); }
  for (const [region, regionNets] of regions) {
    const members = loads.filter(load => circuits.find(load.a) === region);
    const enabled = supplies.filter(supply => supply.instance.outputEnabled && circuits.find(supply.a) === region);
    const disabled = supplies.filter(supply => !supply.instance.outputEnabled && (circuits.find(supply.a) === region || circuits.find(supply.b) === region));
    const short = enabled.some(supply => supply.a === supply.b);
    const fault = short ? 'short-circuit' : enabled.length > 1 ? 'multiple-supplies' : null;
    for (const source of enabled) result.supplies[source.instance.id] = fault ?? 'on';
    for (const load of members) {
      result.components[load.id] = emptyReading('Incomplete circuit');
      if (load.kind === 'led') result.leds[load.id] = load.a === load.b ? 'same-network' : 'unconnected';
    }
    if (fault) {
      for (const net of regionNets) readings.set(net, unavailable(powerLabels[fault]));
      for (const load of members) {
        result.components[load.id] = { ...emptyReading(powerLabels[fault]), warning: powerLabels[fault] };
        if (load.kind === 'led') result.leds[load.id] = 'fault';
      }
      continue;
    }
    if (!enabled.length) {
      for (const net of regionNets) readings.set(net, { ...unavailable(disabled.length ? 'Supply is off; voltage reference unavailable' : 'Floating circuit'), knownCurrent: true });
      for (const load of members) {
        result.components[load.id] = { ...emptyReading(disabled.length ? 'Supply is off' : 'Floating circuit'), current: 0, dissipation: 0, voltageDrop: load.a === load.b || load.kind === 'resistor' ? 0 : null };
        if (load.kind === 'led') result.leds[load.id] = load.a === load.b ? 'same-network' : disabled.length ? 'supply-off' : 'unconnected';
      }
      continue;
    }
    const supply = enabled[0], voltage = supply.instance.voltage ?? DEFAULT_VOLTAGE;
    const activeLoads = members.filter(load => load.a !== load.b);
    const graph = adjacency(activeLoads);
    const cycle = new Groups();
    const invalidResistance = members.some(load => load.kind === 'resistor' && (!Number.isFinite(load.instance.resistanceOhms ?? DEFAULT_RESISTANCE) || (load.instance.resistanceOhms ?? DEFAULT_RESISTANCE) <= 0));
    let unsupported = members.filter(load => load.kind === 'led').length > 1;
    for (const load of activeLoads) {
      if (cycle.find(load.a) === cycle.find(load.b)) unsupported = true;
      cycle.join(load.a, load.b);
    }
    for (const [node, edges] of graph) if (edges.length > (node === supply.a || node === supply.b ? 1 : 2)) unsupported = true;
    // A switched-off series ring attached to just one source pole has no
    // excitation. Cutting its single LED leaves a resistor chain at one potential.
    const zeroBias = members.filter(load => load.kind === 'led').length === 1 && activeLoads.some(load => load.kind === 'resistor') && activeLoads.length === graph.size && [...graph.values()].every(edges => edges.length === 2) && graph.has(supply.a) !== graph.has(supply.b);
    if (invalidResistance || unsupported && !zeroBias) {
      for (const net of regionNets) readings.set(net, unavailable('Unsupported circuit topology'));
      for (const load of members) {
        result.components[load.id] = { ...emptyReading('Unsupported circuit topology'), warning: 'Unsupported circuit topology' };
        if (load.kind === 'led') result.leds[load.id] = 'unsupported';
      }
      continue;
    }
    for (const net of regionNets) readings.set(net, { voltage: null, supplyId: supply.instance.id, reason: 'Floating node', knownCurrent: true, estimatedUnsafe: false });
    const setVoltage = (net: string, value: number) => readings.set(net, { ...readings.get(net)!, voltage: Math.abs(value) < 1e-10 ? 0 : value, reason: null });
    setVoltage(supply.a, voltage); setVoltage(supply.b, 0);
    const path: { load: Load; from: string; to: string }[] = [];
    const visited = new Set<string>();
    let node = supply.a;
    while (node !== supply.b) {
      const load = (graph.get(node) ?? []).find(edge => !visited.has(edge.id));
      if (!load) break;
      visited.add(load.id);
      const to = load.a === node ? load.b : load.a;
      path.push({ load, from: node, to }); node = to;
    }
    const closed = node === supply.b;
    const ledStep = path.find(step => step.load.kind === 'led');
    const reversed = !!ledStep && ledStep.from !== ledStep.load.a;
    const resistance = path.reduce((sum, step) => sum + (step.load.kind === 'resistor' ? step.load.instance.resistanceOhms ?? DEFAULT_RESISTANCE : 0), 0);
    const missing = closed && !!ledStep && !reversed && resistance === 0 && voltage > 2;
    const current = missing ? null : !closed || reversed ? 0 : resistance > 0 ? Math.max(0, voltage - (ledStep ? 2 : 0)) / resistance : 0;
    for (const load of members) {
      result.components[load.id] = { ...emptyReading(closed ? null : zeroBias ? 'No voltage across load' : 'Incomplete circuit'), current: load.a === load.b ? 0 : current, voltageDrop: load.a === load.b || current === 0 && load.kind === 'resistor' ? 0 : null, dissipation: load.kind === 'resistor' ? (load.a === load.b ? 0 : current === null ? null : current ** 2 * (load.instance.resistanceOhms ?? DEFAULT_RESISTANCE)) : null };
    }
    if (closed && current !== null) {
      let potential = voltage;
      inject(supply.terminalA, current); inject(supply.terminalB, -current);
      for (const step of path) {
        const { load, from, to } = step;
        const drop = load.kind === 'resistor' ? current * (load.instance.resistanceOhms ?? DEFAULT_RESISTANCE) : current > 0 ? 2 : voltage;
        setVoltage(from, potential); potential -= drop; setVoltage(to, potential);
        const reading = result.components[load.id];
        reading.voltageDrop = drop * (from === load.a ? 1 : -1);
        inject(from === load.a ? load.terminalA : load.terminalB, -current);
        inject(from === load.a ? load.terminalB : load.terminalA, current);
      }
    } else if (!closed) {
      // With zero current, resistors have no drop. Only propagate a potential
      // from an actual source terminal; do not ground floating islands.
      const queue = [supply.a, supply.b], seen = new Set(queue);
      while (queue.length) {
        const from = queue.shift()!;
        for (const load of graph.get(from) ?? []) if (load.kind === 'resistor') {
          const to = load.a === from ? load.b : load.a;
          if (!seen.has(to)) { seen.add(to); setVoltage(to, readings.get(from)!.voltage!); queue.push(to); }
        }
      }
    }
    let resistorOverload = false;
    for (const load of members) if (load.kind === 'resistor') {
      const reading = result.components[load.id];
      if ((reading.dissipation ?? 0) > (load.instance.powerRatingWatts ?? 0.25) + 1e-12) {
        reading.warning = 'Resistor overload'; reading.estimatedUnsafe = true; resistorOverload = true;
      }
    }
    const overcurrent = !!ledStep && current !== null && current > 0.02 + 1e-12;
    for (const load of members) result.components[load.id].estimatedUnsafe = overcurrent || resistorOverload;
    for (const load of members) if (load.kind === 'led') {
      const anodeVoltage = readings.get(load.a)?.voltage, cathodeVoltage = readings.get(load.b)?.voltage;
      if (anodeVoltage != null && cathodeVoltage != null) result.components[load.id].voltageDrop = anodeVoltage - cathodeVoltage;
      const state: LedStatus = load.a === load.b ? 'same-network' : zeroBias ? 'below-forward' : !closed ? 'unconnected' : missing ? 'missing-resistor' : reversed ? 'reversed' : overcurrent ? 'overcurrent' : resistorOverload ? 'resistor-overload' : current === 0 ? 'below-forward' : 'on';
      result.leds[load.id] = state;
      const reading = result.components[load.id];
      reading.brightness = state === 'on' ? Math.min(1, (current ?? 0) / 0.02) : 0;
      reading.warning = ['missing-resistor', 'overcurrent', 'resistor-overload'].includes(state) ? ledLabels[state] : null;
      reading.estimatedUnsafe = overcurrent || resistorOverload;
    }
    for (const net of regionNets) readings.set(net, { ...readings.get(net)!, knownCurrent: current !== null, estimatedUnsafe: overcurrent || resistorOverload, reason: readings.get(net)!.reason ?? (missing ? 'Missing current-limiting resistor' : !closed ? zeroBias ? 'No voltage across load' : 'Open circuit' : null) });
  }
  for (const [key, node] of terminalNodes) {
    const reading = readings.get(nets.find(node));
    const source = supplies.find(supply => supply.instance.id === reading?.supplyId);
    result.terminals[key] = reading?.reason === 'Short circuit' || reading?.reason === 'Multiple supplies connected' ? 'fault'
      : reading?.voltage == null ? 'unconnected' : Math.abs(reading.voltage) < 1e-9 ? 'negative'
      : source && Math.abs(reading.voltage - (source.instance.voltage ?? DEFAULT_VOLTAGE)) < 1e-9 ? 'positive' : 'voltage';
  }
  const idealGraph = adjacency(ideal);
  for (const wire of layout.wires) {
    const edge = ideal.find(item => item.id === `wire:${wire.id}`);
    const reading = edge ? readings.get(nets.find(edge.a)) : undefined;
    const current = edge && reading?.knownCurrent ? idealWireCurrent(edge, idealGraph, injections) : null;
    result.wires[wire.id] = {
      voltage: reading?.voltage ?? null, current: current === null ? null : Math.abs(current), supplyId: reading?.supplyId ?? null,
      reason: reading?.reason ?? (edge ? null : 'Endpoint unavailable'),
      currentReason: current === null ? reading?.knownCurrent ? 'Current unavailable · redundant conductive loop' : reading?.reason ?? 'Current unavailable' : null,
      estimatedUnsafe: reading?.estimatedUnsafe ?? false,
    };
  }
  return result;
}
