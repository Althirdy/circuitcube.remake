import { Box3, Object3D, Vector3 } from 'three';
import type { Group } from 'three';
import type { TerminalDefinition } from '../types/workspace';
import { POWER_TERMINALS } from '../engine/terminals';

export function preparePowerTerminals(object: Group): TerminalDefinition[] {
  const terminals: TerminalDefinition[] = [];
  object.updateMatrixWorld(true);
  for (const definition of POWER_TERMINALS) {
    const metal = object.getObjectByName(definition.mesh);
    if (!metal) continue;
    // The inspected Y-up asset's front panel faces +Z. Use its metal front
    // face after the same grounding and scale transform as the visible model.
    const bounds = new Box3().setFromObject(metal);
    const center = bounds.getCenter(new Vector3());
    const anchor = new Object3D();
    anchor.name = definition.anchor;
    anchor.position.copy(object.worldToLocal(new Vector3(center.x, center.y, bounds.max.z)));
    object.add(anchor);
    terminals.push({ id: definition.id, position: anchor.position.toArray(), direction: [0, 0, 1] });
    for (const name of [definition.mesh, definition.base]) {
      const part = object.getObjectByName(name);
      if (part) part.userData.terminalId = definition.id;
    }
  }
  const rocker = object.getObjectByName('Power_Switch');
  if (rocker) rocker.userData.powerSwitch = true;
  for (const name of ['Display_Voltage', 'Display_Unit']) {
    const part = object.getObjectByName(name);
    if (part) part.visible = false;
  }
  return terminals;
}
