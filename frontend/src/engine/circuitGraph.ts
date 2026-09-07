import type { ComponentInstance, Layout, SocketSource, TerminalDefinition } from '../types/workspace';
import { socketsFor } from './breadboard';
import { terminalKey } from './connections';

export class Groups {
  private parents = new Map<string, string>();
  find(id: string): string {
    const path: string[] = [];
    let root = id;
    while (this.parents.has(root) && this.parents.get(root) !== root) { path.push(root); root = this.parents.get(root)!; }
    this.parents.set(root, root);
    for (const member of path) this.parents.set(member, root);
    return root;
  }
  join(a: string, b: string) { this.parents.set(this.find(a), this.find(b)); }
}
export type Edge = { id: string; a: string; b: string };
export type Load = Edge & { instance: ComponentInstance; kind: 'led' | 'resistor'; terminalA: string; terminalB: string };

export function circuitGraph(layout: Layout, sockets: SocketSource, powerTerminals: TerminalDefinition[]) {
  // Physical breadboard groups are single ideal junctions. Keep wires as edges
  // before collapsing ideal nets so their individual currents can be inspected.
  const terminalNodes = new Map<string, string>();
  const nets = new Groups();
  for (const instance of layout.instances) {
    for (const terminal of instance.modelId === 'power' ? powerTerminals : socketsFor(instance, sockets)) {
      const key = terminalKey({ componentId: instance.id, terminalId: terminal.id });
      const node = 'groupId' in terminal ? `${instance.id}:group:${terminal.groupId}` : key;
      terminalNodes.set(key, node); nets.find(node);
    }
  }
  const ideal: Edge[] = [];
  for (const wire of layout.wires) {
    const a = terminalNodes.get(terminalKey(wire.from)), b = terminalNodes.get(terminalKey(wire.to));
    if (a && b) ideal.push({ id: `wire:${wire.id}`, a, b });
  }
  for (const instance of layout.instances) if (instance.modelId === 'slide-switch' && instance.switchMount) {
    const { breadboardId, pins } = instance.switchMount;
    const a = terminalNodes.get(`${breadboardId}:${pins[1]}`);
    const b = terminalNodes.get(`${breadboardId}:${instance.switchPosition === 'right' ? pins[2] : pins[0]}`);
    if (a && b) ideal.push({ id: `switch:${instance.id}`, a, b });
  }
  for (const edge of ideal) nets.join(edge.a, edge.b);
  const loads: Load[] = [];
  for (const instance of layout.instances) {
    const refs = instance.modelId === 'led' && instance.mount ? [instance.mount.breadboardId, instance.mount.anode, instance.mount.cathode]
      : instance.modelId === 'resistor' && instance.resistorMount ? [instance.resistorMount.breadboardId, ...instance.resistorMount.pins] : null;
    if (!refs) continue;
    const terminalA = terminalNodes.get(`${refs[0]}:${refs[1]}`), terminalB = terminalNodes.get(`${refs[0]}:${refs[2]}`);
    if (terminalA && terminalB) loads.push({ id: instance.id, instance, kind: instance.modelId as 'led' | 'resistor', a: nets.find(terminalA), b: nets.find(terminalB), terminalA, terminalB });
  }
  const supplies = layout.instances.filter(instance => instance.modelId === 'power').flatMap(instance => {
    const terminalA = terminalNodes.get(`${instance.id}:positive`), terminalB = terminalNodes.get(`${instance.id}:negative`);
    return terminalA && terminalB ? [{ instance, a: nets.find(terminalA), b: nets.find(terminalB), terminalA, terminalB }] : [];
  });
  const circuits = new Groups();
  for (const node of terminalNodes.values()) circuits.find(nets.find(node));
  for (const load of loads) circuits.join(load.a, load.b);
  for (const supply of supplies) if (supply.instance.outputEnabled) circuits.join(supply.a, supply.b);
  return { terminalNodes, nets, ideal, loads, supplies, circuits };
}

export function adjacency<T extends Edge>(edges: T[]) {
  const result = new Map<string, T[]>();
  for (const edge of edges) for (const node of [edge.a, edge.b]) result.set(node, [...(result.get(node) ?? []), edge]);
  return result;
}

// A bridge has a unique current: the sum of injections on its source side.
// An ideal conductive loop does not specify how current divides among its wires.
export function idealWireCurrent(edge: Edge, graph: Map<string, Edge[]>, injections: Map<string, number>): number | null {
  const seen = new Set<string>([edge.a]), pending = [edge.a];
  while (pending.length) {
    const node = pending.pop()!;
    for (const other of graph.get(node) ?? []) {
      if (other.id === edge.id) continue;
      const next = other.a === node ? other.b : other.a;
      if (!seen.has(next)) { seen.add(next); pending.push(next); }
    }
  }
  if (seen.has(edge.b)) return null;
  return [...seen].reduce((sum, node) => sum + (injections.get(node) ?? 0), 0);
}
