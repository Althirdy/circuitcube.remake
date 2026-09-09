import type { ModelId } from '../types/workspace';
import type { IconName } from '../components/Icon';
export type ComponentCategory = 'boards' | 'power' | 'basic' | 'logic';
export const categoryByModel: Record<ModelId, ComponentCategory> = {
  breadboard: 'boards', 'breadboard-large': 'boards', power: 'power', resistor: 'basic', led: 'basic', 'slide-switch': 'basic',
  'ic-7408': 'logic', 'ic-7432': 'logic', 'ic-7404': 'logic',
};
export const componentCategories: { id: ComponentCategory; label: string; icon: IconName }[] = [
  { id: 'boards', label: 'Boards', icon: 'board' }, { id: 'power', label: 'Power', icon: 'power' },
  { id: 'basic', label: 'Basic components', icon: 'resistor' }, { id: 'logic', label: 'Logic ICs', icon: 'chip' },
];
