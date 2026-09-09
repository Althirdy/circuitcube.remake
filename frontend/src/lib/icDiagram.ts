import type { LogicIcInstance } from '../types/workspace';
import { IC_GROUND_PIN, IC_SUPPLY_PIN, icPinRole, logicIcDefinitions } from '../engine/digital/logicIcDefinitions';

export function icDiagram(instance: LogicIcInstance) {
  const definition = logicIcDefinitions[instance.modelId];
  const gate = definition.gates[0];
  return { label: definition.label, pins: Array.from({ length: 14 }, (_, index) => {
    const number = index + 1;
    const left = number <= 7;
    let role = 'other', label = `Pin ${number}`;
    if (number === IC_SUPPLY_PIN) { role = 'vcc'; label = 'VCC +5 V'; }
    else if (number === IC_GROUND_PIN) { role = 'ground'; label = 'GND 0 V'; }
    else if (gate.inputs.includes(number)) { role = 'input'; label = `Input ${gate.inputs.indexOf(number) === 0 ? 'A' : 'B'}`; }
    else if (gate.output === number) { role = 'output'; label = 'Output Y'; }
    return { number, left, y: 72 + (left ? index : 14 - number) * 40, role, label, description: icPinRole(instance.modelId, number), socket: instance.icMount?.pins[index] ?? null };
  }) };
}
