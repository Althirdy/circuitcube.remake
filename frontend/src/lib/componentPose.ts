import { Box3, Mesh, Vector3 } from 'three';
import type { Group } from 'three';
import type { ComponentInstance, LoadedAsset, SocketSource } from '../types/workspace';
import { resistorMountPosition } from '../engine/resistor';
import { mountPosition, switchMountPosition } from '../engine/breadboard';

export function componentPose(instance: ComponentInstance, asset: LoadedAsset, instances: ComponentInstance[], sockets: SocketSource) {
  if (instance.resistorMount) {
    const mounted = resistorMountPosition(instance.resistorMount, instances, sockets);
    const left = asset.object.getObjectByName('Resistor_Left_Anchor'), right = asset.object.getObjectByName('Resistor_Right_Anchor');
    if (mounted && left && right) {
      asset.object.updateMatrixWorld(true);
      const center = left.getWorldPosition(new Vector3()).add(right.getWorldPosition(new Vector3())).multiplyScalar(0.5).applyAxisAngle(new Vector3(0, 1, 0), mounted.rotation);
      return { position: new Vector3(...mounted.position).add(new Vector3(0, -0.001, 0)).sub(center), rotation: mounted.rotation };
    }
  }
  if (instance.switchMount) {
    const mounted = switchMountPosition(instance.switchMount, instances, sockets);
    const anchor = asset.object.getObjectByName('SlideSwitch_Anchor_2');
    if (mounted && anchor) {
      asset.object.updateMatrixWorld(true);
      const offset = anchor.getWorldPosition(new Vector3()).applyAxisAngle(new Vector3(0, 1, 0), mounted.rotation);
      return { position: new Vector3(...mounted.position).add(new Vector3(0, -0.002, 0)).sub(offset), rotation: mounted.rotation };
    }
  }
  const mount = instance.mount ? mountPosition(instance.mount, instances, sockets) : null;
  return mount ? { position: new Vector3(mount.position[0], mount.position[1] + 0.002 - (asset.ledBaseY ?? 0.02495), mount.position[2]), rotation: mount.rotation } : { position: new Vector3(instance.position[0], 0, instance.position[1]), rotation: instance.rotation };
}

// Change only cloned node transforms. Geometry, materials and the source GLB stay shared.
export function seatLedPins(object: Group) {
  for (const name of ['LED_Anode_Pin', 'LED_Cathode_Pin']) {
    const pin = object.getObjectByName(name);
    if (!(pin instanceof Mesh)) continue;
    pin.geometry.computeBoundingBox();
    const bounds = pin.geometry.boundingBox!;
    const top = pin.position.y + bounds.max.y * pin.scale.y;
    const height = top + 0.04;
    pin.scale.y = height / (bounds.max.y - bounds.min.y);
    pin.position.y = top - bounds.max.y * pin.scale.y;
  }
  for (const name of ['Anode_Wire_Anchor', 'Cathode_Wire_Anchor']) {
    const anchor = object.getObjectByName(name);
    if (anchor) anchor.position.y = -0.04;
  }
  object.updateMatrixWorld(true);
}

export function componentBounds(instance: ComponentInstance, asset: LoadedAsset, instances: ComponentInstance[], sockets: SocketSource) {
  const pose = componentPose(instance, asset, instances, sockets);
  const object = asset.object.clone(true);
  if (instance.mount) seatLedPins(object);
  const wrapper = object.clone(false);
  wrapper.clear(); wrapper.add(object); wrapper.position.copy(pose.position); wrapper.rotation.y = pose.rotation;
  return new Box3().setFromObject(wrapper);
}
