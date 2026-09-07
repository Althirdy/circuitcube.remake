import type { Layout, LedMount, ResistorMount, SocketSource, SwitchMount, TerminalDefinition, TerminalRef, WireInstance } from '../types/workspace';
import { isBreadboard, mountPosition, socketById, socketsFor, switchMountPosition } from './breadboard';
import { resistorMountPosition } from './resistor';
import { terminalDefinition } from './terminals';

export const terminalKey = (ref: TerminalRef) => `${ref.componentId}:${ref.terminalId}`;
export function occupiedSockets(layout: Layout, ignoreLedId?: string): Set<string> {
  const occupied = new Set<string>();
  for (const wire of layout.wires) { occupied.add(terminalKey(wire.from)); occupied.add(terminalKey(wire.to)); }
  for (const instance of layout.instances) if (instance.mount && instance.id !== ignoreLedId) {
    occupied.add(terminalKey({ componentId: instance.mount.breadboardId, terminalId: instance.mount.anode }));
    occupied.add(terminalKey({ componentId: instance.mount.breadboardId, terminalId: instance.mount.cathode }));
  }
  for (const instance of layout.instances) if (instance.switchMount && instance.id !== ignoreLedId) {
    for (const terminalId of instance.switchMount.pins) occupied.add(terminalKey({ componentId: instance.switchMount.breadboardId, terminalId }));
  }
  for (const instance of layout.instances) if (instance.resistorMount && instance.id !== ignoreLedId) {
    for (const terminalId of instance.resistorMount.pins) occupied.add(terminalKey({ componentId: instance.resistorMount.breadboardId, terminalId }));
  }
  return occupied;
}
export function canConnect(layout: Layout, from: TerminalRef, to: TerminalRef, sockets: SocketSource, powerTerminals: TerminalDefinition[] = []): boolean {
  const occupied = occupiedSockets(layout);
  const components = [from, to].map(ref => layout.instances.find(instance => instance.id === ref.componentId));
  return components.some(component => component && isBreadboard(component.modelId)) && terminalKey(from) !== terminalKey(to) && [from, to].every((ref, index) => !occupied.has(terminalKey(ref)) && !!terminalDefinition(components[index], ref.terminalId, sockets, powerTerminals));
}
export function mountError(layout: Layout, mount: LedMount, sockets: SocketSource, ignoreLedId?: string): string | null {
  const board = layout.instances.find(instance => instance.id === mount.breadboardId && isBreadboard(instance.modelId));
  if (!board) return 'Breadboard unavailable';
  const definitions = socketsFor(board, sockets);
  const anode = socketById(definitions, mount.anode), cathode = socketById(definitions, mount.cathode);
  if (!anode?.row || !cathode?.row) return 'Use two terminal holes, not the rails';
  if (anode.row !== cathode.row || Math.abs(anode.column! - cathode.column!) !== 1 || anode.groupId === cathode.groupId) return 'Legs must use adjacent numbered columns';
  const occupied = occupiedSockets(layout, ignoreLedId);
  if ([mount.anode, mount.cathode].some(terminalId => occupied.has(terminalKey({ componentId: mount.breadboardId, terminalId })))) return 'One or both holes are occupied';
  return null;
}
export function connectWire(layout: Layout, wire: WireInstance, sockets: SocketSource, powerTerminals: TerminalDefinition[] = []): Layout {
  return canConnect(layout, wire.from, wire.to, sockets, powerTerminals) ? { ...layout, wires: [...layout.wires, wire] } : layout;
}
export function mountLed(layout: Layout, id: string, mount: LedMount, sockets: SocketSource): Layout {
  if (mountError(layout, mount, sockets, id)) return layout;
  const definitions = socketsFor(layout.instances.find(instance => instance.id === mount.breadboardId), sockets);
  return { ...layout, instances: layout.instances.map(instance => instance.id === id && instance.modelId === 'led' ? { ...instance, mount, rotation: socketById(definitions, mount.anode)!.column! > socketById(definitions, mount.cathode)!.column! ? 0 : Math.PI } : instance) };
}
export function detachMounted(layout: Layout, id: string, sockets: SocketSource): Layout {
  return { ...layout, instances: layout.instances.map(instance => {
    if (instance.id !== id || (!instance.mount && !instance.switchMount && !instance.resistorMount)) return instance;
    const pose = instance.resistorMount ? resistorMountPosition(instance.resistorMount, layout.instances, sockets) : instance.switchMount ? switchMountPosition(instance.switchMount, layout.instances, sockets) : mountPosition(instance.mount!, layout.instances, sockets);
    return { ...instance, mount: undefined, switchMount: undefined, resistorMount: undefined, position: pose ? [pose.position[0], pose.position[2]] : instance.position, rotation: pose?.rotation ?? instance.rotation };
  }) };
}
// Retained for callers of the original LED mounting API.
export const detachLed = detachMounted;

export function removeComponent(layout: Layout, id: string, sockets: SocketSource): Layout {
  let next = layout;
  for (const instance of layout.instances) if (instance.mount?.breadboardId === id || instance.switchMount?.breadboardId === id || instance.resistorMount?.breadboardId === id) next = detachMounted(next, instance.id, sockets);
  return { instances: next.instances.filter(instance => instance.id !== id), wires: next.wires.filter(wire => wire.from.componentId !== id && wire.to.componentId !== id) };
}

export function switchMountError(layout: Layout, mount: SwitchMount, source: SocketSource, ignoreId?: string): string | null {
  const board = layout.instances.find(instance => instance.id === mount.breadboardId && isBreadboard(instance.modelId));
  if (!board) return 'Breadboard unavailable';
  const definitions = socketsFor(board, source);
  const [first, common, last] = mount.pins.map(id => socketById(definitions, id));
  if (!first?.row || !common?.row || !last?.row) return 'Use three terminal holes within the board';
  if (first.row !== common.row || last.row !== common.row || Math.abs(first.column! - common.column!) !== 1 || last.column! - common.column! !== common.column! - first.column!) return 'Pins must use three adjacent numbered columns in one row';
  const occupied = occupiedSockets(layout, ignoreId);
  if (mount.pins.some(terminalId => occupied.has(terminalKey({ componentId: board.id, terminalId })))) return 'One or more holes are occupied';
  return null;
}

export function mountSwitch(layout: Layout, id: string, mount: SwitchMount, source: SocketSource): Layout {
  if (switchMountError(layout, mount, source, id)) return layout;
  return { ...layout, instances: layout.instances.map(instance => instance.id === id && instance.modelId === 'slide-switch' ? { ...instance, switchMount: mount } : instance) };
}

export function toggleSlideSwitch(layout: Layout, id: string): Layout {
  return { ...layout, instances: layout.instances.map(instance => instance.id === id && instance.modelId === 'slide-switch' ? { ...instance, switchPosition: instance.switchPosition === 'right' ? 'left' : 'right' } : instance) };
}

export function resistorMountError(layout: Layout, mount: ResistorMount, source: SocketSource, ignoreId?: string): string | null {
  const board = layout.instances.find(instance => instance.id === mount.breadboardId && isBreadboard(instance.modelId));
  if (!board) return 'Breadboard unavailable';
  const [left, right] = mount.pins.map(id => socketById(socketsFor(board, source), id));
  if (!left?.row || !right?.row) return 'Use terminal holes within the board, not rails';
  if (left.row !== right.row || Math.abs(left.column! - right.column!) !== 5) return 'Resistor endpoints need five column intervals in one row';
  const occupied = occupiedSockets(layout, ignoreId);
  return mount.pins.some(terminalId => occupied.has(terminalKey({ componentId: board.id, terminalId }))) ? 'One or both holes are occupied' : null;
}
export function mountResistor(layout: Layout, id: string, mount: ResistorMount, source: SocketSource): Layout {
  if (resistorMountError(layout, mount, source, id)) return layout;
  return { ...layout, instances: layout.instances.map(instance => instance.id === id && instance.modelId === 'resistor' ? { ...instance, resistorMount: mount } : instance) };
}
