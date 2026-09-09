import type { GateKind } from './logicIcDefinitions';
import type { LogicLevel } from './logicLevels';

export function evaluateGate(kind: GateKind, inputs: readonly LogicLevel[]): LogicLevel {
  if (inputs.some(input => input === 'fault')) return 'fault';
  if (kind === 'and' && inputs.includes('low')) return 'low';
  if (kind === 'or' && inputs.includes('high')) return 'high';
  if (inputs.includes('unknown') || !inputs.length) return 'unknown';
  if (kind === 'not') return inputs[0] === 'high' ? 'low' : 'high';
  return kind === 'and' ? 'high' : 'low';
}
