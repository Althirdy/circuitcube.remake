import { Vector3 } from 'three';
import type { Group } from 'three';
import type { PowerVisuals } from './powerVisuals';

// The two moving meshes retain their original offset from the left anchor.
// Only cloned node transforms change; no geometry or material is owned here.
export function createSlideVisuals(object: Group): PowerVisuals {
  const left = object.getObjectByName('SlideSwitch_Slider_Left_Anchor');
  const right = object.getObjectByName('SlideSwitch_Slider_Right_Anchor');
  object.updateMatrixWorld(true);
  const parts = ['SlideSwitch_Slider', 'SlideSwitch_Slider_Grip'].flatMap(name => {
    const node = object.getObjectByName(name);
    if (!node?.parent || !left || !right) return [];
    const start = node.parent.worldToLocal(left.getWorldPosition(new Vector3()));
    const end = node.parent.worldToLocal(right.getWorldPosition(new Vector3()));
    return [{ node, original: node.position.clone(), delta: end.sub(start) }];
  });
  return {
    apply(amount: number) {
      for (const { node, original, delta } of parts) node.position.copy(original).addScaledVector(delta, amount);
      object.updateMatrixWorld(true);
    },
    dispose() {
      for (const { node, original } of parts) node.position.copy(original);
    },
  };
}
