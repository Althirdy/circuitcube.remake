import type { Layout } from '../../types/workspace';
import type { CircuitGraph } from '../circuitGraph';
import { DEFAULT_VOLTAGE } from '../resistor';
import { evaluateGate } from './gates';
import { IC_GROUND_PIN, IC_SUPPLY_PIN, icPinRole, isLogicIcInstance, logicIcDefinitions } from './logicIcDefinitions';
import type { LogicLevel } from './logicLevels';
import { logicLevel, TTL_SUPPLY_MAX, TTL_SUPPLY_MIN } from './logicLevels';

export type DigitalSignal = { level: LogicLevel; voltage: number | null; supplyId: string | null; reason: string | null };
export type IcPinReading = DigitalSignal & { pin: number; role: string; socket: string | null };
export type IcReading = { status: 'ready' | 'unmounted' | 'unpowered' | 'fault'; reason: string | null; pins: IcPinReading[] };
export type OutputDriver = { id: string; componentId: string; pin: number; node: string; net: string; supplyId: string | null };
export type DigitalResult = {
  chips: Record<string, IcReading>;
  nets: Map<string, DigitalSignal>;
  outputs: OutputDriver[];
  railNets: Set<string>;
};
const unknown = (reason: string): DigitalSignal => ({ level: 'unknown', voltage: null, supplyId: null, reason });
const fault = (reason: string): DigitalSignal => ({ ...unknown(reason), level: 'fault' });

export function evaluateDigital(layout: Layout, graph: CircuitGraph): DigitalResult {
  const chips: DigitalResult['chips'] = {};
  const rails = new Map<string, DigitalSignal>();
  const supplyVoltages = new Map<string, number>();
  const pinNet = (id: string, pin: number) => {
    const node = graph.icPins.get(`${id}:${pin}`);
    return node ? graph.nets.find(node) : null;
  };
  for (const source of graph.supplies.filter(source => source.instance.outputEnabled)) {
    const members = graph.supplies.filter(other => other.instance.outputEnabled && graph.circuits.find(other.a) === graph.circuits.find(source.a));
    const reason = members.some(member => member.a === member.b) ? 'Supply short circuit; remove the short' : members.length > 1 ? 'Multiple supplies connected; use one supply' : null;
    const voltage = source.instance.voltage ?? DEFAULT_VOLTAGE;
    supplyVoltages.set(source.instance.id, voltage);
    for (const [net, potential] of [[source.a, voltage], [source.b, 0]] as const) {
      rails.set(net, reason ? fault(reason) : { level: potential === 0 ? 'low' : 'high', voltage: potential, supplyId: source.instance.id, reason: null });
    }
  }
  const instances = layout.instances.filter(isLogicIcInstance);
  const powered = new Map<string, string>();
  for (const instance of instances) {
    const vcc = rails.get(pinNet(instance.id, IC_SUPPLY_PIN) ?? '');
    const gnd = rails.get(pinNet(instance.id, IC_GROUND_PIN) ?? '');
    let status: IcReading['status'] = 'ready';
    let reason: string | null = null;
    if (!instance.icMount) { status = 'unmounted'; reason = 'Insert across rows e and f, then wire pin 14 to +5 V and pin 7 to ground.'; }
    else if (vcc?.level === 'fault' || gnd?.level === 'fault') { status = 'fault'; reason = vcc?.reason ?? gnd?.reason ?? 'Supply circuit fault'; }
    else if (vcc?.voltage == null || gnd?.voltage == null) { status = 'unpowered'; reason = 'Connect pin 14 to +5 V and pin 7 to supply −; turn the supply on.'; }
    else if (!vcc.supplyId || vcc.supplyId !== gnd.supplyId || gnd.voltage !== 0 || vcc.voltage < TTL_SUPPLY_MIN || vcc.voltage > TTL_SUPPLY_MAX) { status = 'fault'; reason = 'Invalid supply: use 4.75–5.25 V on pin 14 and the same supply’s negative on pin 7.'; }
    else powered.set(instance.id, vcc.supplyId);
    chips[instance.id] = { status, reason, pins: [] };
  }
  const outputs: OutputDriver[] = instances.flatMap(instance => logicIcDefinitions[instance.modelId].gates.flatMap(gate => {
    const node = graph.icPins.get(`${instance.id}:${gate.output}`);
    return node ? [{ id: `${instance.id}:${gate.output}`, componentId: instance.id, pin: gate.output, node, net: graph.nets.find(node), supplyId: powered.get(instance.id) ?? null }] : [];
  }));
  const byNet = new Map<string, OutputDriver[]>();
  for (const driver of outputs) byNet.set(driver.net, [...(byNet.get(driver.net) ?? []), driver]);
  const resolved = new Map<string, DigitalSignal>();
  const supplyFaults = new Map<string, string>();
  const visiting: string[] = [];
  const cyclic = new Set<string>();

  function readNet(net: string, reference: string | null): DigitalSignal {
    const drivers = (byNet.get(net) ?? []).filter(driver => driver.supplyId !== null);
    if (drivers.length > 1) return fault('Multiple outputs share this net; disconnect all but one output.');
    const rail = rails.get(net);
    const driven = drivers[0] ? resolveOutput(drivers[0]) : null;
    if (rail?.level === 'fault') return rail;
    if (rail && driven) {
      if (driven.level === 'fault') return driven;
      if (driven.voltage === null) return unknown('Output connected to a rail has an unresolved drive state; disconnect it.');
      if (driven.supplyId !== rail.supplyId || driven.voltage !== rail.voltage) return fault('Output conflicts with a supply rail; remove that wire.');
    }
    const signal = driven ?? rail ?? unknown('Floating input: connect to ground, +5 V, or a gate output.');
    if (reference && signal.supplyId && signal.supplyId !== reference) return fault('Input uses another supply reference; use the same supply.');
    if (signal.voltage === null) return signal;
    const level = logicLevel(signal.voltage, supplyVoltages.get(reference ?? signal.supplyId ?? '') ?? 5);
    return { ...signal, level, reason: level === 'unknown' ? 'Input is between LOW (≤0.8 V) and HIGH (≥2 V).' : level === 'fault' ? 'Input is outside the IC supply range.' : null };
  }
  function resolveOutput(driver: OutputDriver): DigitalSignal {
    const supplyFault = supplyFaults.get(driver.componentId);
    if (supplyFault) return fault(supplyFault);
    const saved = resolved.get(driver.id);
    if (saved) return saved;
    const cycleStart = visiting.indexOf(driver.id);
    if (cycleStart >= 0) {
      for (const id of visiting.slice(cycleStart)) cyclic.add(id);
      return unknown('Feedback loop: combinational cycles are unresolved.');
    }
    const instance = instances.find(instance => instance.id === driver.componentId);
    if (!instance || !driver.supplyId) return unknown(chips[driver.componentId]?.reason ?? 'IC is unpowered');
    const definition = logicIcDefinitions[instance.modelId];
    const gate = definition.gates.find(gate => gate.output === driver.pin);
    if (!gate) return unknown('Gate unavailable');
    visiting.push(driver.id);
    const inputs = gate.inputs.map(pin => {
      const net = pinNet(instance.id, pin);
      return net ? readNet(net, driver.supplyId) : unknown('Pin is not mounted');
    });
    visiting.pop();
    const level = cyclic.has(driver.id) ? 'unknown' : evaluateGate(definition.kind, inputs.map(input => input.level));
    const signal: DigitalSignal = {
      level, voltage: level === 'high' ? supplyVoltages.get(driver.supplyId) ?? null : level === 'low' ? 0 : null,
      supplyId: driver.supplyId,
      reason: cyclic.has(driver.id) ? 'Feedback loop: combinational cycles are unresolved.' : level === 'fault' || level === 'unknown' ? inputs.find(input => input.reason)?.reason ?? 'Unresolved input' : null,
    };
    // Diagnose the output net here too, so downstream gates inherit contention.
    const drivers = (byNet.get(driver.net) ?? []).filter(item => item.supplyId !== null);
    const rail = rails.get(driver.net);
    const outputFault = drivers.length > 1 ? 'Multiple outputs share this net; disconnect all but one output.' : rail?.level === 'fault' ? rail.reason : rail && signal.voltage !== null && (rail.supplyId !== signal.supplyId || rail.voltage !== signal.voltage) ? 'Output conflicts with a supply rail; remove that wire.' : null;
    const result = outputFault ? fault(outputFault) : signal;
    resolved.set(driver.id, result);
    return result;
  }
  // A contested rail invalidates every package powered from that rail. Re-run
  // only when a newly affected package is discovered; all faults clear next edit.
  for (let pass = 0; pass <= instances.length; pass++) {
    for (const driver of outputs) resolveOutput(driver);
    let changed = false;
    for (const instance of instances) {
      if (!powered.has(instance.id) || supplyFaults.has(instance.id)) continue;
      for (const pin of [IC_SUPPLY_PIN, IC_GROUND_PIN]) {
        const net = pinNet(instance.id, pin);
        const state = net ? readNet(net, powered.get(instance.id) ?? null) : null;
        if (state?.level === 'fault') {
          supplyFaults.set(instance.id, state.reason ?? 'IC supply rail is faulted');
          changed = true;
        }
      }
    }
    if (!changed) break;
    resolved.clear();
  }
  const nets = new Map(rails);
  for (const net of byNet.keys()) nets.set(net, readNet(net, null));
  for (const instance of instances) {
    const chip = chips[instance.id];
    chip.pins = Array.from({ length: 14 }, (_, index) => {
      const pin = index + 1;
      const net = pinNet(instance.id, pin);
      let signal = net ? readNet(net, powered.get(instance.id) ?? null) : unknown('Insert the IC to connect this pin');
      const isOutput = logicIcDefinitions[instance.modelId].gates.some(gate => gate.output === pin);
      if (isOutput && !powered.has(instance.id)) signal = unknown(chip.reason ?? 'IC is unpowered');
      return { ...signal, pin, role: icPinRole(instance.modelId, pin), socket: instance.icMount?.pins[index] ?? null };
    });
    if (chip.status === 'ready' && chip.pins.some(pin => pin.level === 'fault')) {
      chip.status = 'fault';
      chip.reason = chip.pins.find(pin => pin.level === 'fault')?.reason ?? 'Pin fault';
    }
  }
  return { chips, nets, outputs, railNets: new Set(rails.keys()) };
}
