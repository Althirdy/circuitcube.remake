import { Box3, CanvasTexture, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';
import type { Group, Material } from 'three';
import type { ModelId } from '../types/workspace';

export function transitionValue(from: number, to: number, elapsed: number, duration: number) {
  const progress = duration === 0 ? 1 : Math.min(1, Math.max(0, elapsed / duration));
  return from + (to - from) * progress * progress * (3 - 2 * progress);
}

export type PowerVisuals = { apply: (switchAmount: number, lightAmount: number) => void; dispose: () => void; setVoltage?: (voltage: number) => void };

export function createPowerVisuals(object: Group, modelId: ModelId): PowerVisuals {
  const materials = new Set<Material>();
  const ledMaterials: MeshStandardMaterial[] = [];
  const clones = new Map<Material, Material>();
  if (modelId === 'led') {
    for (const name of ['LED_Lens', 'LED_Dome']) {
      const mesh = object.getObjectByName(name);
      if (!(mesh instanceof Mesh)) continue;
      const clone = (material: Material) => {
        if (!(material instanceof MeshStandardMaterial)) return material;
        if (!clones.has(material)) {
          const owned = material.clone();
          owned.emissive.set('#ff1808'); owned.emissiveIntensity = 0;
          clones.set(material, owned); materials.add(owned); ledMaterials.push(owned);
        }
        return clones.get(material)!;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    }
  }
  const rocker = modelId === 'power' ? object.getObjectByName('Power_Switch') : undefined;
  const restRotation = rocker?.rotation.x ?? 0;
  let display: Mesh<PlaneGeometry, MeshBasicMaterial> | undefined;
  let texture: CanvasTexture | undefined;
  let setVoltage: ((voltage: number) => void) | undefined;
  const glass = modelId === 'power' ? object.getObjectByName('Display_Glass') : undefined;
  if (glass && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
    const context = canvas.getContext('2d');
    if (context) {
      texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
      setVoltage = voltage => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#9affbc'; context.font = 'bold 62px monospace';
        context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(`${voltage.toFixed(1)} V`, 128, 49);
        texture!.needsUpdate = true;
      };
      setVoltage(5);
      const bounds = new Box3().setFromObject(glass), size = bounds.getSize(new Vector3());
      const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      display = new Mesh(new PlaneGeometry(size.x * 0.8, size.y * 0.8), material);
      display.name = 'Power_Output_Display';
      display.position.copy(object.worldToLocal(bounds.getCenter(new Vector3()).setZ(bounds.max.z + 0.00004)));
      object.add(display); materials.add(material);
    }
  }
  const apply = (switchAmount: number, lightAmount: number) => {
    if (rocker) rocker.rotation.x = restRotation + (-8 + 16 * switchAmount) * Math.PI / 180;
    if (display) display.material.opacity = lightAmount;
    for (const material of ledMaterials) material.emissiveIntensity = lightAmount * 1.6;
  };
  apply(0, 0);
  return {
    apply,
    setVoltage,
    dispose: () => { display?.geometry.dispose(); texture?.dispose(); for (const material of materials) material.dispose(); },
  };
}
