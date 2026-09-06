import { useEffect, useMemo } from "react";
import { Edges } from "@react-three/drei";
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { ComponentInstance, LoadedAsset, SocketDefinition } from "../../types/workspace";
import { componentPose, seatLedPins } from '../../lib/componentPose';
import { createPowerVisuals } from '../../lib/powerVisuals';
import { usePowerAnimation } from '../../scene/usePowerAnimation';

type Props = {
  instance: ComponentInstance;
  asset: LoadedAsset;
  selected?: boolean;
  preview?: boolean;
  invalid?: boolean;
  instances?: ComponentInstance[];
  sockets?: SocketDefinition[];
  powered?: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
};

export function ModelInstance({
  instance,
  asset,
  selected,
  preview,
  invalid,
  instances = [],
  sockets = [],
  powered = false,
  onPointerDown,
}: Props) {
  const mounted = !!instance.mount;
  const modelId = instance.modelId;
  const { object, material, bounds, visuals } = useMemo(() => {
    const object = asset.object.clone(true);
    if (mounted) seatLedPins(object);
    const material = preview
      ? new MeshStandardMaterial({
          color: invalid ? '#ef4444' : "#3684ef",
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        })
      : null;
    if (material)
      object.traverse((child) => {
        if (child instanceof Mesh) child.material = material;
      });
    const visuals = !preview && modelId !== 'breadboard' ? createPowerVisuals(object, modelId) : null;
    return { object, material, bounds: new Box3().setFromObject(object), visuals };
  }, [asset, preview, mounted, invalid, modelId]);
  usePowerAnimation(visuals, !!instance.outputEnabled, powered);
  useEffect(() => () => material?.dispose(), [material]);
  const { x, y, z } = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const pose = componentPose(instance, asset, instances, sockets);
  return (
    <group
      position={pose.position}
      rotation={[0, pose.rotation, 0]}
      onPointerDown={onPointerDown}
    >
      <primitive object={object} dispose={null} />
      {!preview && (
        <mesh position={center} userData={{ pickBounds: true }}>
          <boxGeometry args={[Math.max(x, 0.002), y, Math.max(z, 0.002)]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
          />
        </mesh>
      )}
      {selected && (
        <mesh position={center} raycast={() => null}>
          <boxGeometry args={[x + 0.0008, y + 0.0008, z + 0.0008]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color="#2563eb" raycast={() => null} />
        </mesh>
      )}
    </group>
  );
}
