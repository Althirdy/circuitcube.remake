import { CurvePath, LineCurve3, QuadraticBezierCurve3, Vector3 } from 'three';
import { localToWorld } from '../engine/breadboard';
import { routingSurface, terminalDefinition } from '../engine/terminals';
import type { ComponentInstance, Point3, SocketDefinition, TerminalDefinition, WireInstance, TerminalRef } from '../types/workspace';

export function terminalPosition(ref: TerminalRef, instances: ComponentInstance[], sockets: SocketDefinition[], powerTerminals: TerminalDefinition[] = []): Point3 | null {
  const component = instances.find(instance => instance.id === ref.componentId);
  const terminal = terminalDefinition(component, ref.terminalId, sockets, powerTerminals);
  return component && terminal ? localToWorld(component, terminal.position) : null;
}

// Each lead has three points: inserted tip, face center and outward exit.
// Keeping these slots fixed also keeps the segment-to-bend editor consistent.
export function terminalLead(ref: TerminalRef, routeY: number, instances: ComponentInstance[], sockets: SocketDefinition[], powerTerminals: TerminalDefinition[] = []): Point3[] {
  const component = instances.find(instance => instance.id === ref.componentId);
  const terminal = terminalDefinition(component, ref.terminalId, sockets, powerTerminals);
  if (!component || !terminal) return [];
  const face = new Vector3(...terminal.position);
  const direction = new Vector3(...terminal.direction);
  const tip = face.clone().addScaledVector(direction, -0.001);
  const exit = component.modelId === 'power' ? face.clone().addScaledVector(direction, 0.005) : new Vector3(face.x, Math.max(face.y + 0.002, routeY), face.z);
  return [tip, face, exit].map(point => localToWorld(component, point.toArray()));
}

export function wirePoints(wire: WireInstance, instances: ComponentInstance[], sockets: SocketDefinition[], powerTerminals: TerminalDefinition[] = []): Point3[] {
  const source = instances.find(instance => instance.id === wire.from.componentId);
  if (!source) return [];
  const routeY = routingSurface(wire.from, instances, sockets) + wire.height;
  const from = terminalLead(wire.from, routeY, instances, sockets, powerTerminals);
  const to = terminalLead(wire.to, wire.bends.at(-1)?.[1] ?? routeY, instances, sockets, powerTerminals);
  if (!from.length || !to.length) return [];
  return [...from, ...wire.bends.map(point => localToWorld(source, point)), ...to.reverse()];
}
export function roundedWireCurve(points: Point3[]): CurvePath<Vector3> {
  const vectors = points.map(point => new Vector3(...point)).filter((point, index, all) => index === 0 || point.distanceTo(all[index - 1]) > 0.000001);
  const path = new CurvePath<Vector3>();
  if (vectors.length < 2) { path.add(new LineCurve3(new Vector3(), new Vector3(0, 0.000001, 0))); return path; }
  let previous = vectors[0];
  for (let i = 1; i < vectors.length - 1; i++) {
    const before = vectors[i - 1], corner = vectors[i], after = vectors[i + 1];
    const radius = Math.min(0.001, before.distanceTo(corner) / 4, corner.distanceTo(after) / 4);
    const entry = corner.clone().lerp(before, radius / corner.distanceTo(before));
    const exit = corner.clone().lerp(after, radius / corner.distanceTo(after));
    path.add(new LineCurve3(previous, entry));
    path.add(new QuadraticBezierCurve3(entry, corner, exit));
    previous = exit;
  }
  path.add(new LineCurve3(previous, vectors.at(-1)!));
  return path;
}
