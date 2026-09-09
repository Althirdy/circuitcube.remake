import { Vector3 } from 'three';
import type { Group } from 'three';
import type { LogicIcModelId } from '../types/workspace';
import { logicIcDefinitions } from '../engine/digital/logicIcDefinitions';

export const IC_INSERTION_DEPTH = 0.002;
// Exported DIP rows span 7.62 mm; these boards have a 9.2 mm e/f gap.
// Adapt only cloned pin/anchor transforms, keeping the body and source intact.
export function seatIcPins(object: Group, modelId: LogicIcModelId, rowSpacing: number) {
  const prefix = logicIcDefinitions[modelId].prefix;
  object.updateMatrixWorld(true);
  const first = object.getObjectByName(`${prefix}_Anchor_1`);
  const last = object.getObjectByName(`${prefix}_Anchor_14`);
  if (!first || !last) return;
  const firstPosition = first.getWorldPosition(new Vector3());
  const lastPosition = last.getWorldPosition(new Vector3());
  const centerZ = (firstPosition.z + lastPosition.z) / 2;
  for (let pin = 1; pin <= 14; pin++) {
    const anchor = object.getObjectByName(`${prefix}_Anchor_${pin}`);
    const metal = object.getObjectByName(`${prefix}_Pin_${pin}`);
    if (!anchor || !metal) continue;
    const current = anchor.getWorldPosition(new Vector3());
    const displacement = centerZ + (pin <= 7 ? 1 : -1) * rowSpacing / 2 - current.z;
    for (const node of [anchor, metal]) {
      const target = node.getWorldPosition(new Vector3()).add(new Vector3(0, 0, displacement));
      node.position.copy(node.parent ? node.parent.worldToLocal(target) : target);
    }
  }
  object.updateMatrixWorld(true);
}

export function validateIcAnchors(object: Group, modelId: LogicIcModelId) {
  const prefix = logicIcDefinitions[modelId].prefix;
  for (let pin = 1; pin <= 14; pin++) {
    if (!object.getObjectByName(`${prefix}_Anchor_${pin}`) || !object.getObjectByName(`${prefix}_Pin_${pin}`)) throw new Error(`${modelId}: missing pin ${pin} asset anchor or mesh`);
  }
}
