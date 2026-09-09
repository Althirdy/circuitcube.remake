export type LogicLevel = 'high' | 'low' | 'unknown' | 'fault';
export const TTL_SUPPLY_MIN = 4.75;
export const TTL_SUPPLY_MAX = 5.25;
export const TTL_LOW_MAX = 0.8;
export const TTL_HIGH_MIN = 2;
export function logicLevel(voltage: number | null, supplyVoltage = 5): LogicLevel {
  if (voltage === null || !Number.isFinite(voltage)) return 'unknown';
  if (voltage < 0 || voltage > supplyVoltage) return 'fault';
  if (voltage <= TTL_LOW_MAX) return 'low';
  return voltage >= TTL_HIGH_MIN ? 'high' : 'unknown';
}
