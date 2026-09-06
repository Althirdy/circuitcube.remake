import type { ComponentInstance, LedMount, Point3, SocketDefinition } from '../types/workspace';

export const SOCKET_PITCH = 0.00254;
export const BOARD_SURFACE = 0.008765;
export const WIRE_COLORS = { black: '#303740', red: '#df4444', blue: '#2675dd', green: '#1d9b68', yellow: '#d9ad16', orange: '#e98025' } as const;

// Coordinates measured from the current 400-contact GLB, BEFORE its 0.1 runtime transform.
// The older scripts/create_breadboard.py describes a different, 830-hole asset.
export function sourceSockets(): SocketDefinition[] {
  const sockets: SocketDefinition[] = [];
  const rows = [0.1476, 0.1222, 0.0968, 0.0714, 0.046, -0.046, -0.0714, -0.0968, -0.1222, -0.1476];
  rows.forEach((z, index) => {
    const row = String.fromCharCode(97 + index);
    for (let column = 1; column <= 30; column++) sockets.push({ id: `${row}${column}`, row, column, groupId: `${index < 5 ? 'ae' : 'fj'}-${column}`, position: [-0.3683 + (column - 1) * 0.0254, 0.04015, z], direction: [0, 1, 0] });
  });
  for (const [rail, z] of [['bottom-negative', 0.192], ['bottom-positive', 0.227], ['top-positive', -0.192], ['top-negative', -0.227]] as const) {
    for (let i = 0; i < 25; i++) sockets.push({ id: `${rail}-${i + 1}`, groupId: rail, position: [-0.3328 + Math.floor(i / 5) * 0.141 + (i % 5) * 0.0254, 0.04015, z], direction: [0, 1, 0] });
  }
  return sockets;
}

export const BREADBOARD_SOCKETS = sourceSockets().map(socket => ({ ...socket, position: [socket.position[0] * 0.1, BOARD_SURFACE, socket.position[2] * 0.1] as Point3 }));
export const socketById = (sockets: SocketDefinition[], id: string) => sockets.find(socket => socket.id === id);
export function localToWorld(board: ComponentInstance, point: Point3): Point3 {
  const c = Math.cos(board.rotation), s = Math.sin(board.rotation);
  return [board.position[0] + c * point[0] + s * point[2], point[1], board.position[1] - s * point[0] + c * point[2]];
}
export function worldToLocal(board: ComponentInstance, point: Point3): Point3 {
  const x = point[0] - board.position[0], z = point[2] - board.position[1], c = Math.cos(board.rotation), s = Math.sin(board.rotation);
  return [c * x - s * z, point[1], s * x + c * z];
}
export function mountPosition(mount: LedMount, instances: ComponentInstance[], sockets: SocketDefinition[]): { position: Point3; rotation: number } | null {
  const board = instances.find(instance => instance.id === mount.breadboardId && instance.modelId === 'breadboard');
  const anode = socketById(sockets, mount.anode), cathode = socketById(sockets, mount.cathode);
  if (!board || !anode || !cathode) return null;
  return { position: localToWorld(board, [(anode.position[0] + cathode.position[0]) / 2, anode.position[1], anode.position[2]]), rotation: board.rotation + (anode.position[0] > cathode.position[0] ? 0 : Math.PI) };
}
