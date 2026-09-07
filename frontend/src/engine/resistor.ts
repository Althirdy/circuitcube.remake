import type { ComponentInstance, Point3, ResistorMount, SocketSource } from '../types/workspace';
import { localToWorld, socketById, socketsFor } from './breadboard';

export const RESISTANCE_VALUES = [220, 330, 470, 1000, 4700, 10000] as const;
export const DEFAULT_RESISTANCE = 330;
export const DEFAULT_VOLTAGE = 5;
export const resistanceLabel = (ohms: number) => ohms >= 1000 ? `${ohms / 1000} kΩ` : `${ohms} Ω`;
export function validVoltage(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 12 && Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
}
export const BAND_COLORS = ['#181818', '#704026', '#dc3434', '#ef832c', '#e9c832', '#368650', '#3267b5', '#884aa0', '#81858a', '#f4f1e7'];
export function resistorBandColors(ohms: number): string[] {
  const exponent = Math.floor(Math.log10(ohms)) - 1;
  const digits = Math.round(ohms / 10 ** exponent);
  return [BAND_COLORS[Math.floor(digits / 10)], BAND_COLORS[digits % 10], BAND_COLORS[exponent], '#c7a348'];
}
export function resistorMountPosition(mount: ResistorMount, instances: ComponentInstance[], source: SocketSource): { position: Point3; rotation: number } | null {
  const board = instances.find(instance => instance.id === mount.breadboardId);
  const [left, right] = mount.pins.map(id => socketById(socketsFor(board, source), id));
  if (!board || !left || !right) return null;
  return { position: localToWorld(board, [(left.position[0] + right.position[0]) / 2, left.position[1], left.position[2]]), rotation: board.rotation + (left.position[0] < right.position[0] ? 0 : Math.PI) };
}
