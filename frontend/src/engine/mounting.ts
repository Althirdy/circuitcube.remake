import type { ComponentInstance, Layout, ModelId, MountCandidate, Point3, SocketSource } from '../types/workspace';
import { mountPosition, socketById, socketsFor, SOCKET_PITCH, switchMountPosition } from './breadboard';
import { mountError, resistorMountError, switchMountError } from './connections';
import { resistorMountPosition } from './resistor';

export const mountedBoardId = (instance: ComponentInstance) => instance.mount?.breadboardId ?? instance.switchMount?.breadboardId ?? instance.resistorMount?.breadboardId;
export function mountedPosition(instance: ComponentInstance, instances: ComponentInstance[], sockets: SocketSource) {
  return instance.resistorMount ? resistorMountPosition(instance.resistorMount, instances, sockets)
    : instance.switchMount ? switchMountPosition(instance.switchMount, instances, sockets)
    : instance.mount ? mountPosition(instance.mount, instances, sockets) : null;
}
export function mountFlipped(instance: ComponentInstance | undefined, layout: Layout, source: SocketSource) {
  if (!instance) return false;
  const definitions = socketsFor(layout.instances.find(board => board.id === mountedBoardId(instance)), source);
  const pins = instance.resistorMount?.pins ?? instance.switchMount?.pins;
  if (pins) return (socketById(definitions, pins[0])?.column ?? 0) > (socketById(definitions, pins.at(-1)!)?.column ?? 0);
  if (instance.mount) return (socketById(definitions, instance.mount.anode)?.column ?? 0) < (socketById(definitions, instance.mount.cathode)?.column ?? 0);
  return Math.cos(instance.rotation) < 0;
}
export function mountingCandidate(layout: Layout, modelId: ModelId, board: ComponentInstance, point: Point3, source: SocketSource, flipped: boolean, ignoreId?: string): MountCandidate {
  const definitions = socketsFor(board, source);
  const nearest = [...definitions].sort((a, b) => Math.hypot(a.position[0] - point[0], a.position[2] - point[2]) - Math.hypot(b.position[0] - point[0], b.position[2] - point[2]))[0];
  if (!nearest?.row) return { mount: null, valid: false, reason: 'Use terminal holes, not rails' };
  if (Math.hypot(nearest.position[0] - point[0], nearest.position[2] - point[2]) > SOCKET_PITCH * 0.72) return { mount: null, valid: false, reason: 'Move onto a terminal strip; the trench is not a socket' };
  const id = (offset: number) => `${nearest.row}${nearest.column! + offset}`;
  if (modelId === 'resistor') {
    const pins: [string, string] = flipped ? [id(5), nearest.id] : [nearest.id, id(5)];
    const resistorMount = { breadboardId: board.id, pins };
    const error = resistorMountError(layout, resistorMount, source, ignoreId);
    return { mount: null, resistorMount, valid: !error, reason: error ?? `Resistor: ${pins[0]} ↔ ${pins[1]} · non-polarized` };
  }
  if (modelId === 'slide-switch') {
    const pins: [string, string, string] = flipped ? [id(2), id(1), nearest.id] : [nearest.id, id(1), id(2)];
    const switchMount = { breadboardId: board.id, pins };
    const error = switchMountError(layout, switchMount, source, ignoreId);
    return { mount: null, switchMount, valid: !error, reason: error ?? `1: ${pins[0]} / 2 common: ${pins[1]} / 3: ${pins[2]}` };
  }
  const mount = { breadboardId: board.id, anode: flipped ? nearest.id : id(1), cathode: flipped ? id(1) : nearest.id };
  const error = !socketById(definitions, id(1)) ? 'The pair extends past the last column' : mountError(layout, mount, source, ignoreId);
  return { mount, valid: !error, reason: error ?? `Anode + ${mount.anode} / Cathode − ${mount.cathode}` };
}
