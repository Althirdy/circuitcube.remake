import type { ComponentInstance, LogicIcInstance, LogicIcModelId, ModelId } from '../../types/workspace';

export type GateKind = 'and' | 'or' | 'not';
export type GateDefinition = { inputs: readonly number[]; output: number };
export type LogicIcDefinition = { label: string; prefix: string; kind: GateKind; gates: readonly GateDefinition[] };
export const IC_GROUND_PIN = 7;
export const IC_SUPPLY_PIN = 14;
export const IC_PIN_COUNT = 14;
const quadGates: readonly GateDefinition[] = [
  { inputs: [1, 2], output: 3 }, { inputs: [4, 5], output: 6 },
  { inputs: [9, 10], output: 8 }, { inputs: [12, 13], output: 11 },
];
export const logicIcDefinitions: Record<LogicIcModelId, LogicIcDefinition> = {
  'ic-7408': { label: '7408 AND', prefix: 'IC7408', kind: 'and', gates: quadGates },
  'ic-7432': { label: '7432 OR', prefix: 'IC7432', kind: 'or', gates: quadGates },
  'ic-7404': { label: '7404 NOT', prefix: 'IC7404', kind: 'not', gates: [
    { inputs: [1], output: 2 }, { inputs: [3], output: 4 }, { inputs: [5], output: 6 },
    { inputs: [9], output: 8 }, { inputs: [11], output: 10 }, { inputs: [13], output: 12 },
  ] },
};
export const isLogicIc = (id: ModelId): id is LogicIcModelId => id === 'ic-7408' || id === 'ic-7432' || id === 'ic-7404';
export const isLogicIcInstance = (instance: ComponentInstance): instance is LogicIcInstance => isLogicIc(instance.modelId);
export function icPinRole(modelId: LogicIcModelId, pin: number): string {
  if (pin === IC_SUPPLY_PIN) return 'VCC · supply +';
  if (pin === IC_GROUND_PIN) return 'GND · supply −';
  for (const [index, gate] of logicIcDefinitions[modelId].gates.entries()) {
    if (gate.output === pin) return `Gate ${index + 1} · output Y`;
    const input = gate.inputs.indexOf(pin);
    if (input >= 0) return `Gate ${index + 1} · input ${input === 0 ? 'A' : 'B'}`;
  }
  return 'Unused';
}
