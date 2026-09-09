import type { ComponentInstance, IcMount, IcPins, Layout, MountCandidate, Point3, SocketSource } from '../types/workspace';
import { isBreadboard, localToWorld, socketById, socketsFor, SOCKET_PITCH } from './breadboard';
import { occupiedSockets } from './connections';
import { isLogicIcInstance } from './digital/logicIcDefinitions';

export function icPinSockets(column: number, flipped: boolean): IcPins {
  const front = Array.from({ length: 7 }, (_, index) => `e${column + index}`);
  const back = Array.from({ length: 7 }, (_, index) => `f${column + 6 - index}`);
  return (flipped ? [...back, ...front] : [...front, ...back]) as IcPins;
}
export function icMountError(layout: Layout, mount: IcMount, source: SocketSource, ignoreId?: string): string | null {
  const board = layout.instances.find(instance => instance.id === mount.breadboardId && isBreadboard(instance.modelId));
  if (!board) return 'Breadboard unavailable';
  const definitions = socketsFor(board, source);
  const first = socketById(definitions, mount.pins[0]);
  if (!first?.column || (first.row !== 'e' && first.row !== 'f')) return 'Place the IC across the center gap, in rows e and f';
  const flipped = first.row === 'f';
  const expected = icPinSockets(first.column - (flipped ? 6 : 0), flipped);
  if (mount.pins.length !== 14 || mount.pins.some((pin, index) => pin !== expected[index] || !socketById(definitions, pin))) return 'The IC needs seven consecutive columns within the board';
  const occupied = occupiedSockets(layout, ignoreId);
  if (mount.pins.some(pin => occupied.has(`${board.id}:${pin}`))) return 'An IC pin would enter an occupied hole; choose seven free columns';
  return null;
}
export function icMountCandidate(layout: Layout, board: ComponentInstance, point: Point3, source: SocketSource, flipped: boolean, ignoreId?: string): MountCandidate {
  const definitions = socketsFor(board, source);
  const row = definitions.filter(socket => socket.row === 'e');
  const nearest = row.reduce<typeof row[number] | undefined>((best, socket) => !best || Math.abs(socket.position[0] - point[0]) < Math.abs(best.position[0] - point[0]) ? socket : best, undefined);
  const opposite = nearest && socketById(definitions, `f${nearest.column}`);
  if (!nearest?.column || !opposite || point[2] > nearest.position[2] + SOCKET_PITCH * 0.7 || point[2] < opposite.position[2] - SOCKET_PITCH * 0.7) return { kind: 'invalid', mount: null, valid: false, reason: 'Move over the center gap between rows e and f' };
  const icMount = { breadboardId: board.id, pins: icPinSockets(nearest.column, flipped) };
  const error = icMountError(layout, icMount, source, ignoreId);
  return { kind: 'ic', mount: null, icMount, valid: !error, reason: error ?? `IC: e/f${nearest.column}–${nearest.column + 6} · pin 1: ${icMount.pins[0]}` };
}
export function icMountPosition(mount: IcMount, instances: ComponentInstance[], source: SocketSource): { position: Point3; rotation: number } | null {
  const board = instances.find(instance => instance.id === mount.breadboardId);
  const definitions = socketsFor(board, source);
  const first = socketById(definitions, mount.pins[0]);
  const opposite = socketById(definitions, mount.pins[7]);
  if (!board || !first || !opposite) return null;
  return { position: localToWorld(board, [(first.position[0] + opposite.position[0]) / 2, first.position[1], (first.position[2] + opposite.position[2]) / 2]), rotation: board.rotation + (first.row === 'f' ? Math.PI : 0) };
}
export function mountIc(layout: Layout, id: string, mount: IcMount, source: SocketSource): Layout {
  if (icMountError(layout, mount, source, id)) return layout;
  return { ...layout, instances: layout.instances.map(instance => instance.id === id && isLogicIcInstance(instance) ? { ...instance, icMount: mount, rotation: mount.pins[0].startsWith('f') ? Math.PI : 0 } : instance) };
}
export function rotateIc(instance: ComponentInstance): ComponentInstance {
  if (!isLogicIcInstance(instance)) return instance;
  const pins = instance.icMount?.pins;
  return { ...instance, rotation: (instance.rotation + Math.PI) % (Math.PI * 2), icMount: pins ? { breadboardId: instance.icMount!.breadboardId, pins: [...pins.slice(7), ...pins.slice(0, 7)] as IcPins } : undefined };
}
