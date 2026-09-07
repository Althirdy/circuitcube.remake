import { Mesh, MeshStandardMaterial } from 'three';
import type { Group } from 'three';
import { resistorBandColors } from '../engine/resistor';

export function createResistorVisuals(object: Group) {
  const bands: { material: MeshStandardMaterial; index: number }[] = [];
  for (let index = 0; index < 4; index++) {
    const mesh = object.getObjectByName(`Resistor_Band_${index + 1}`);
    if (!(mesh instanceof Mesh)) continue;
    const clone = (material: MeshStandardMaterial) => {
      const owned = material.clone(); bands.push({ material: owned, index }); return owned;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(material => material instanceof MeshStandardMaterial ? clone(material) : material) : mesh.material instanceof MeshStandardMaterial ? clone(mesh.material) : mesh.material;
  }
  return {
    apply(ohms: number) { const colors = resistorBandColors(ohms); for (const band of bands) band.material.color.set(colors[band.index]); },
    dispose() { for (const band of bands) band.material.dispose(); },
  };
}
