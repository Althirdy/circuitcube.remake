import type { Layout, SocketSource, TerminalDefinition } from '../types/workspace';
import { socketsFor } from './breadboard';
import { terminalKey } from './connections';

export type SupplyStatus = 'off' | 'on' | 'short-circuit' | 'multiple-supplies';
export type TerminalStatus = 'unconnected' | 'positive' | 'negative' | 'fault';
export type LedStatus = 'on' | 'unmounted' | 'unconnected' | 'supply-off' | 'reversed' | 'same-network' | 'fault';
export type PowerResult = {
  supplies: Record<string, SupplyStatus>;
  terminals: Record<string, TerminalStatus>;
  leds: Record<string, LedStatus>;
};
export const powerLabels = {
  off: 'Output OFF', on: 'Output ON', 'short-circuit': 'Short circuit', 'multiple-supplies': 'Multiple supplies connected',
};
export const ledLabels: Record<LedStatus, string> = {
  on: 'LED ON', unmounted: 'LED OFF · insert into breadboard', unconnected: 'LED OFF · incomplete circuit',
  'supply-off': 'LED OFF · supply is off', reversed: 'LED OFF · reversed polarity',
  'same-network': 'LED OFF · legs share one network', fault: 'LED OFF · circuit fault',
};
export const terminalStatusLabels: Record<TerminalStatus, string> = {
  unconnected: 'Unconnected / no active power', positive: 'Positive (+)', negative: 'Negative (−)', fault: 'Circuit fault',
};

class Groups {
  private parents = new Map<string, string>();
  find(id: string): string {
    if (!this.parents.has(id)) this.parents.set(id, id);
    const parent = this.parents.get(id)!;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parents.set(id, root);
    return root;
  }
  join(a: string, b: string) { this.parents.set(this.find(a), this.find(b)); }
}

// Conducting groups exclude LED junctions. Circuit membership includes LEDs only
// to detect connected sources; LEDs never short positive and negative nets together.
export function evaluatePower(layout: Layout, sockets: SocketSource, powerTerminals: TerminalDefinition[]): PowerResult {
  const nets = new Groups();
  const keys: string[] = [];
  const available = new Set<string>();
  for (const instance of layout.instances) {
    const definitions = instance.modelId === 'power' ? powerTerminals : socketsFor(instance, sockets);
    for (const terminal of definitions) {
      const key = terminalKey({ componentId: instance.id, terminalId: terminal.id });
      keys.push(key); available.add(key); nets.find(key);
      if ('groupId' in terminal) nets.join(key, `${instance.id}:group:${terminal.groupId}`);
    }
  }
  for (const wire of layout.wires) {
    const from = terminalKey(wire.from), to = terminalKey(wire.to);
    if (available.has(from) && available.has(to)) nets.join(from, to);
  }
  for (const instance of layout.instances) if (instance.modelId === 'slide-switch' && instance.switchMount) {
    const { breadboardId, pins } = instance.switchMount;
    const contact = instance.switchPosition === 'right' ? pins[2] : pins[0];
    const common = `${breadboardId}:${pins[1]}`, selected = `${breadboardId}:${contact}`;
    if (available.has(common) && available.has(selected)) nets.join(common, selected);
  }
  const supplies = layout.instances.filter(instance => instance.modelId === 'power').map(instance => ({
    id: instance.id,
    enabled: !!instance.outputEnabled && available.has(`${instance.id}:positive`) && available.has(`${instance.id}:negative`),
    positive: nets.find(`${instance.id}:positive`), negative: nets.find(`${instance.id}:negative`),
  }));
  const mounted = layout.instances.filter(instance => instance.modelId === 'led' && instance.mount).map(instance => ({
    id: instance.id,
    anode: nets.find(`${instance.mount!.breadboardId}:${instance.mount!.anode}`),
    cathode: nets.find(`${instance.mount!.breadboardId}:${instance.mount!.cathode}`),
  }));
  const circuits = new Groups();
  for (const key of keys) circuits.find(nets.find(key));
  for (const led of mounted) circuits.join(led.anode, led.cathode);
  for (const supply of supplies) if (supply.enabled) circuits.join(supply.positive, supply.negative);
  const sources = new Map<string, number>();
  const shorts = new Set<string>();
  for (const supply of supplies) if (supply.enabled) {
    const circuit = circuits.find(supply.positive);
    sources.set(circuit, (sources.get(circuit) ?? 0) + 1);
    if (supply.positive === supply.negative) shorts.add(circuit);
  }
  const faulty = (net: string) => shorts.has(circuits.find(net)) || (sources.get(circuits.find(net)) ?? 0) > 1;
  const result: PowerResult = { supplies: {}, terminals: {}, leds: {} };
  for (const supply of supplies) {
    result.supplies[supply.id] = !supply.enabled ? 'off' : shorts.has(circuits.find(supply.positive)) ? 'short-circuit' : (sources.get(circuits.find(supply.positive)) ?? 0) > 1 ? 'multiple-supplies' : 'on';
  }
  for (const key of keys) {
    const net = nets.find(key);
    result.terminals[key] = faulty(net) ? 'fault' : supplies.some(supply => result.supplies[supply.id] === 'on' && supply.positive === net) ? 'positive' : supplies.some(supply => result.supplies[supply.id] === 'on' && supply.negative === net) ? 'negative' : 'unconnected';
  }
  for (const instance of layout.instances) if (instance.modelId === 'led') result.leds[instance.id] = 'unmounted';
  for (const led of mounted) {
    const forward = supplies.filter(supply => supply.positive === led.anode && supply.negative === led.cathode);
    const reversed = supplies.find(supply => supply.negative === led.anode && supply.positive === led.cathode);
    result.leds[led.id] = faulty(led.anode) || faulty(led.cathode) ? 'fault'
      : led.anode === led.cathode ? 'same-network'
      : forward.some(supply => result.supplies[supply.id] === 'on') ? 'on'
      : forward.length > 0 ? 'supply-off'
      : reversed ? 'reversed' : 'unconnected';
  }
  return result;
}
