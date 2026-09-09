import type { BoardModelId, ComponentInstance, LedMount, ModelId, Point3, SocketDefinition, SocketSource, SwitchMount } from '../types/workspace';
import { isLogicIc } from './digital/logicIcDefinitions';

export const SOCKET_PITCH = 0.00254;
export const BOARD_SURFACE = 0.008765;
export const WIRE_COLORS = { black: '#303740', red: '#df4444', blue: '#2675dd', green: '#1d9b68', yellow: '#d9ad16', orange: '#e98025' } as const;

// Coordinates measured from the exported 400- and 830-contact GLBs, before
// their 0.1 runtime transform. The older Blender generator is not authoritative.
export const isBreadboard = (id: ModelId): id is BoardModelId => id === 'breadboard' || id === 'breadboard-large';
export const isMountable = (id: ModelId) => id === 'led' || id === 'slide-switch' || id === 'resistor' || isLogicIc(id);
export function sourceSockets(modelId: BoardModelId = 'breadboard'): SocketDefinition[] {
  const large = modelId === 'breadboard-large';
  const sockets: SocketDefinition[] = [];
  const rows = [0.1476, 0.1222, 0.0968, 0.0714, 0.046, -0.046, -0.0714, -0.0968, -0.1222, -0.1476];
  rows.forEach((z, index) => {
    const row = String.fromCharCode(97 + index);
    for (let column = 1; column <= (large ? 63 : 30); column++) sockets.push({ id: `${row}${column}`, row, column, groupId: `${index < 5 ? 'ae' : 'fj'}-${column}`, position: [(large ? -0.7874 : -0.3683) + (column - 1) * 0.0254, 0.04015, z], direction: [0, 1, 0] });
  });
  for (const [rail, z] of [['bottom-negative', 0.192], ['bottom-positive', 0.227], ['top-positive', -0.192], ['top-negative', -0.227]] as const) {
    for (let i = 0; i < (large ? 50 : 25); i++) {
      const offset = large ? (i < 25 ? -0.7028 : 0.0372) : -0.3328;
      const index = i % 25;
      sockets.push({ id: `${rail}-${i + 1}`, groupId: large ? `${rail}-${i < 25 ? 'left' : 'right'}` : rail, position: [offset + Math.floor(index / 5) * 0.141 + (index % 5) * 0.0254, 0.04015, z], direction: [0, 1, 0] });
    }
  }
  return sockets;
}

export const BREADBOARD_SOCKETS = sourceSockets().map(socket => ({ ...socket, position: [socket.position[0] * 0.1, BOARD_SURFACE, socket.position[2] * 0.1] as Point3 }));
export const LARGE_BREADBOARD_SOCKETS = sourceSockets('breadboard-large').map(socket => ({ ...socket, position: [socket.position[0] * 0.1, BOARD_SURFACE, socket.position[2] * 0.1] as Point3 }));
export function socketsFor(board: ComponentInstance | undefined, source: SocketSource): SocketDefinition[] {
  if (!board || !isBreadboard(board.modelId)) return [];
  return Array.isArray(source) ? (board.modelId === 'breadboard' ? source : LARGE_BREADBOARD_SOCKETS) : source[board.modelId];
}
export const socketById = (sockets: SocketDefinition[], id: string) => sockets.find(socket => socket.id === id);
export function localToWorld(board: ComponentInstance, point: Point3): Point3 {
  const c = Math.cos(board.rotation), s = Math.sin(board.rotation);
  return [board.position[0] + c * point[0] + s * point[2], point[1], board.position[1] - s * point[0] + c * point[2]];
}
export function worldToLocal(board: ComponentInstance, point: Point3): Point3 {
  const x = point[0] - board.position[0], z = point[2] - board.position[1], c = Math.cos(board.rotation), s = Math.sin(board.rotation);
  return [c * x - s * z, point[1], s * x + c * z];
}
export function mountPosition(mount: LedMount, instances: ComponentInstance[], source: SocketSource): { position: Point3; rotation: number } | null {
  const board = instances.find(instance => instance.id === mount.breadboardId && isBreadboard(instance.modelId));
  const sockets = socketsFor(board, source);
  const anode = socketById(sockets, mount.anode), cathode = socketById(sockets, mount.cathode);
  if (!board || !anode || !cathode) return null;
  return { position: localToWorld(board, [(anode.position[0] + cathode.position[0]) / 2, anode.position[1], anode.position[2]]), rotation: board.rotation + (anode.position[0] > cathode.position[0] ? 0 : Math.PI) };
}
export function switchMountPosition(mount: SwitchMount, instances: ComponentInstance[], source: SocketSource): { position: Point3; rotation: number } | null {
  const board = instances.find(instance => instance.id === mount.breadboardId && isBreadboard(instance.modelId));
  const sockets = socketsFor(board, source);
  const [first, common, last] = mount.pins.map(id => socketById(sockets, id));
  if (!board || !first || !common || !last) return null;
  return { position: localToWorld(board, common.position), rotation: board.rotation + (first.position[0] < last.position[0] ? 0 : Math.PI) };
}
