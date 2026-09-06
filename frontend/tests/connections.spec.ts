import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BREADBOARD_SOCKETS as sockets, localToWorld, mountPosition, socketById, worldToLocal } from '../src/engine/breadboard';
import { canConnect, connectWire, detachLed, mountError, mountLed, occupiedSockets, removeComponent } from '../src/engine/connections';
import { prepareModel } from '../src/lib/modelAssets';
import { componentPose, seatLedPins } from '../src/lib/componentPose';
import { wirePoints } from '../src/lib/wireGeometry';
import type { Layout, ModelId, WireInstance } from '../src/types/workspace';

async function asset(id: ModelId) {
  const bytes = await readFile(new URL(`../../models/${id}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return { ...prepareModel(gltf.scene, { id, scale: 0.1, rotation: [0, 0, 0], url: '', label: id, description: '' }), thumbnail: '' };
}
const initial = (): Layout => ({ instances: [{ id: 'board', modelId: 'breadboard', position: [0, 0], rotation: 0 }, { id: 'second', modelId: 'breadboard', position: [0.2, 0], rotation: 0 }, { id: 'led', modelId: 'led', position: [0.1, 0], rotation: 0 }], wires: [] });
const ref = (terminalId: string, componentId = 'board') => ({ componentId, terminalId });
const jumper = (): WireInstance => ({ id: 'wire', from: ref('a1'), to: ref('top-positive-1'), color: 'green', height: 0.005, bends: [[0.01, 0.013765, 0.03]] });

for (const [modelId, count] of [['breadboard', 400], ['breadboard-large', 830]] as const) test(`all ${count} targets match connected socket meshes in ${modelId}.glb`, async () => {
  const board = await asset(modelId);
  const contacts = board.object.getObjectByName('Socket_Contacts') as Mesh;
  expect(contacts).toBeDefined();
  const positions = contacts.geometry.getAttribute('position');
  const indices = contacts.geometry.index;
  const parent = new Map<string, string>();
  const vertices: string[] = [], points = new Map<string, Vector3>();
  for (let i = 0; i < positions.count; i++) {
    const point = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(contacts.matrixWorld);
    const key = point.toArray().map(n => n.toFixed(7)).join(',');
    vertices.push(key); points.set(key, point); parent.set(key, key);
  }
  const root = (key: string): string => { const next = parent.get(key)!; if (next === key) return key; const result = root(next); parent.set(key, result); return result; };
  for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
    const keys = [0, 1, 2].map(j => vertices[indices ? indices.getX(i + j) : i + j]);
    parent.set(root(keys[1]), root(keys[0])); parent.set(root(keys[2]), root(keys[0]));
  }
  const bounds = new Map<string, Box3>();
  for (const [key, point] of points) { const id = root(key); if (!bounds.has(id)) bounds.set(id, new Box3()); bounds.get(id)!.expandByPoint(point); }
  const centers = [...bounds.values()].map(box => box.getCenter(new Vector3()));
  expect(centers).toHaveLength(count);
  expect(board.sockets).toHaveLength(count);
  for (const socket of board.sockets!) expect(Math.min(...centers.map(center => center.distanceTo(new Vector3(...socket.position))))).toBeLessThan(0.000001);
  expect(new Set(board.sockets!.map(socket => socket.id)).size).toBe(count);
  expect(sockets.filter(socket => socket.groupId === 'ae-10').map(socket => socket.id)).toEqual(['a10', 'b10', 'c10', 'd10', 'e10']);
  expect(sockets.filter(socket => socket.groupId === 'top-positive')).toHaveLength(25);
  expect(socketById(sockets, 'top-positive-6')!.position[0] - socketById(sockets, 'top-positive-5')!.position[0]).toBeCloseTo(0.00394, 6);
});

test('occupancy, invalid pairs, independent wires and board deletion', () => {
  let layout = initial();
  layout = mountLed(layout, 'led', { breadboardId: 'board', anode: 'e11', cathode: 'e10' }, sockets);
  expect(occupiedSockets(layout).size).toBe(2);
  expect(canConnect(layout, ref('e10'), ref('a2'), sockets)).toBe(false);
  for (const [anode, cathode] of [['a1','b1'], ['e10','f10'], ['a30','a31'], ['top-positive-1','top-positive-2']]) expect(mountError(layout, { breadboardId: 'board', anode, cathode }, sockets, 'led')).not.toBeNull();
  expect(canConnect(layout, ref('a1'), ref('a1'), sockets)).toBe(false);
  layout = connectWire(layout, jumper(), sockets);
  expect(layout.wires).toHaveLength(1);
  expect(connectWire(layout, { ...jumper(), id: 'duplicate' }, sockets).wires).toHaveLength(1);
  layout = connectWire(layout, { ...jumper(), id: 'crossing', from: ref('b2'), to: ref('c3'), bends: jumper().bends }, sockets);
  expect(layout.wires).toHaveLength(2);
  expect(occupiedSockets(layout).size).toBe(6); // Crossing route points do not add terminals.
  const pose = mountPosition(layout.instances[2].mount!, layout.instances, sockets)!;
  layout = removeComponent(layout, 'board', sockets);
  expect(layout.wires).toHaveLength(0);
  expect(layout.instances.find(item => item.id === 'led')!.mount).toBeUndefined();
  expect(layout.instances.find(item => item.id === 'led')!.position).toEqual([pose.position[0], pose.position[2]]);
  expect(occupiedSockets(layout).size).toBe(0);
});

test('rotated boards carry mounts and routes; cross-board endpoints remain attached', () => {
  const layout = initial();
  layout.instances[0] = { ...layout.instances[0], position: [0.3, 0.4], rotation: Math.PI / 2 };
  const point = sockets[0].position;
  worldToLocal(layout.instances[0], localToWorld(layout.instances[0], point)).forEach((n, i) => expect(n).toBeCloseTo(point[i], 8));
  const wire = { ...jumper(), to: ref('a1', 'second') };
  const route = wirePoints(wire, layout.instances, sockets);
  expect(route[3]).toEqual(localToWorld(layout.instances[0], wire.bends[0]));
  expect(route.at(-2)).toEqual(localToWorld(layout.instances[1], sockets[0].position));
  const mounted = mountLed(layout, 'led', { breadboardId: 'board', anode: 'e11', cathode: 'e10' }, sockets);
  expect(mountPosition(mounted.instances[2].mount!, mounted.instances, sockets)!.rotation).toBeCloseTo(Math.PI / 2);
  expect(occupiedSockets(detachLed(mounted, 'led', sockets)).size).toBe(0);
});

test('mounted LED preserves body size and source pin meshes with 2 mm seating', async () => {
  const led = await asset('led');
  const board = await asset('breadboard');
  const layout = mountLed(initial(), 'led', { breadboardId: 'board', anode: 'e11', cathode: 'e10' }, board.sockets!);
  const instance = layout.instances[2];
  const original = new Box3().setFromObject(led.object.getObjectByName('LED_Anode_Pin')!).getSize(new Vector3());
  const clone = led.object.clone(true); seatLedPins(clone);
  const pose = componentPose(instance, led, layout.instances, board.sockets!);
  const wrapper = new Group(); wrapper.position.copy(pose.position); wrapper.rotation.y = pose.rotation; wrapper.add(clone); wrapper.updateMatrixWorld(true);
  const surface = board.sockets![0].position[1];
  expect(new Box3().setFromObject(clone.getObjectByName('LED_BaseFlange')!).min.y - surface).toBeCloseTo(0.002, 6);
  for (const name of ['LED_Anode_Pin', 'LED_Cathode_Pin']) expect(new Box3().setFromObject(clone.getObjectByName(name)!).min.y - surface).toBeCloseTo(-0.002, 6);
  expect(new Box3().setFromObject(led.object.getObjectByName('LED_Anode_Pin')!).getSize(new Vector3()).y).toBe(original.y);
  expect(new Box3().setFromObject(clone.getObjectByName('LED_Lens')!).getSize(new Vector3()).x).toBeCloseTo(new Box3().setFromObject(led.object.getObjectByName('LED_Lens')!).getSize(new Vector3()).x, 7);
});
