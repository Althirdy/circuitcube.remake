import type { Layout, LedMount, SocketDefinition, TerminalDefinition, TerminalRef, WireInstance } from '../types/workspace';
import { mountPosition, socketById } from './breadboard';
import { terminalDefinition } from './terminals';

export const terminalKey = (ref: TerminalRef) => `${ref.componentId}:${ref.terminalId}`;
export function occupiedSockets(layout: Layout, ignoreLedId?: string): Set<string> {
  const occupied = new Set<string>();
  for (const wire of layout.wires) { occupied.add(terminalKey(wire.from)); occupied.add(terminalKey(wire.to)); }
  for (const instance of layout.instances) if (instance.mount && instance.id !== ignoreLedId) {
    occupied.add(terminalKey({ componentId: instance.mount.breadboardId, terminalId: instance.mount.anode }));
    occupied.add(terminalKey({ componentId: instance.mount.breadboardId, terminalId: instance.mount.cathode }));
  }
  return occupied;
}
export function canConnect(layout: Layout, from: TerminalRef, to: TerminalRef, sockets: SocketDefinition[], powerTerminals: TerminalDefinition[] = []): boolean {
  const occupied = occupiedSockets(layout);
  const components = [from, to].map(ref => layout.instances.find(instance => instance.id === ref.componentId));
  return components.some(component => component?.modelId === 'breadboard') && terminalKey(from) !== terminalKey(to) && [from, to].every((ref, index) => !occupied.has(terminalKey(ref)) && !!terminalDefinition(components[index], ref.terminalId, sockets, powerTerminals));
}
export function mountError(layout: Layout, mount: LedMount, sockets: SocketDefinition[], ignoreLedId?: string): string | null {
  if (!layout.instances.some(instance => instance.id === mount.breadboardId && instance.modelId === 'breadboard')) return 'Breadboard unavailable';
  const anode = socketById(sockets, mount.anode), cathode = socketById(sockets, mount.cathode);
  if (!anode?.row || !cathode?.row) return 'Use two terminal holes, not the rails';
  if (anode.row !== cathode.row || Math.abs(anode.column! - cathode.column!) !== 1 || anode.groupId === cathode.groupId) return 'Legs must use adjacent numbered columns';
  const occupied = occupiedSockets(layout, ignoreLedId);
  if ([mount.anode, mount.cathode].some(terminalId => occupied.has(terminalKey({ componentId: mount.breadboardId, terminalId })))) return 'One or both holes are occupied';
  return null;
}
export function connectWire(layout: Layout, wire: WireInstance, sockets: SocketDefinition[], powerTerminals: TerminalDefinition[] = []): Layout {
  return canConnect(layout, wire.from, wire.to, sockets, powerTerminals) ? { ...layout, wires: [...layout.wires, wire] } : layout;
}
export function mountLed(layout: Layout, id: string, mount: LedMount, sockets: SocketDefinition[]): Layout {
  if (mountError(layout, mount, sockets, id)) return layout;
  return { ...layout, instances: layout.instances.map(instance => instance.id === id && instance.modelId === 'led' ? { ...instance, mount, rotation: socketById(sockets, mount.anode)!.column! > socketById(sockets, mount.cathode)!.column! ? 0 : Math.PI } : instance) };
}
export function detachLed(layout: Layout, id: string, sockets: SocketDefinition[]): Layout {
  return { ...layout, instances: layout.instances.map(instance => {
    if (instance.id !== id || !instance.mount) return instance;
    const pose = mountPosition(instance.mount, layout.instances, sockets);
    return { ...instance, mount: undefined, position: pose ? [pose.position[0], pose.position[2]] : instance.position, rotation: pose?.rotation ?? instance.rotation };
  }) };
}
export function removeComponent(layout: Layout, id: string, sockets: SocketDefinition[]): Layout {
  let next = layout;
  for (const instance of layout.instances) if (instance.mount?.breadboardId === id) next = detachLed(next, instance.id, sockets);
  return { instances: next.instances.filter(instance => instance.id !== id), wires: next.wires.filter(wire => wire.from.componentId !== id && wire.to.componentId !== id) };
}
