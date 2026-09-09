import type { ComponentInstance, GroundPosition, IcMount, LedMount, ModelId, ResistorMount, SwitchMount } from '../types/workspace';
import { isLogicIc } from './digital/logicIcDefinitions';
import { DEFAULT_RESISTANCE, DEFAULT_VOLTAGE } from './resistor';

export function createComponent(id: string, modelId: ModelId, position: GroundPosition, rotation = 0): ComponentInstance {
  const base = { id, position, rotation };
  if (isLogicIc(modelId)) return { ...base, modelId };
  if (modelId === 'power') return { ...base, modelId, voltage: DEFAULT_VOLTAGE, outputEnabled: false };
  if (modelId === 'resistor') return { ...base, modelId, resistanceOhms: DEFAULT_RESISTANCE, tolerancePercent: 5, powerRatingWatts: 0.25 };
  if (modelId === 'slide-switch') return { ...base, modelId, switchPosition: 'left' };
  return { ...base, modelId };
}
export function withMount(instance: ComponentInstance, mount?: LedMount, switchMount?: SwitchMount, resistorMount?: ResistorMount, icMount?: IcMount): ComponentInstance {
  if (isLogicIc(instance.modelId)) return { id: instance.id, modelId: instance.modelId, position: instance.position, rotation: instance.rotation, icMount };
  return { ...instance, modelId: instance.modelId, mount, switchMount, resistorMount, icMount: undefined };
}
