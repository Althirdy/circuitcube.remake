import { useEffect, useMemo } from "react";
import { Edges } from "@react-three/drei";
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { useThree } from '@react-three/fiber';
import { createResistorVisuals } from '../../lib/resistorVisuals';
import { DEFAULT_RESISTANCE, DEFAULT_VOLTAGE } from '../../engine/resistor';
import type { ThreeEvent } from "@react-three/fiber";
import type { ComponentInstance, LoadedAsset, SocketSource } from "../../types/workspace";
import { componentPose, seatLedPins } from '../../lib/componentPose';
import { isBreadboard } from '../../engine/breadboard';
import { createSlideVisuals } from '../../lib/slideVisuals';
import { createPowerVisuals } from '../../lib/powerVisuals';
import { usePowerAnimation } from '../../scene/usePowerAnimation';
import { isLogicIc } from '../../engine/digital/logicIcDefinitions';
import { socketById, socketsFor } from '../../engine/breadboard';
import { seatIcPins } from '../../lib/icAsset';
import { useTheme, sceneColors } from '../../lib/theme';

type Props = {
  instance: ComponentInstance;
  asset: LoadedAsset;
  selected?: boolean;
  preview?: boolean;
  invalid?: boolean;
  instances?: ComponentInstance[];
  sockets?: SocketSource;
  powered?: boolean;
  brightness?: number;
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
  brightness = 0,
  onPointerDown,
}: Props) {
  const invalidate = useThree(state => state.invalidate);
  const { theme } = useTheme();
  const colors = sceneColors[theme];
  const mounted = !!instance.mount;
  const modelId = instance.modelId;
  const boardSockets = socketsFor(instances.find(board => board.id === instance.icMount?.breadboardId), sockets);
  const firstPin = instance.icMount && socketById(boardSockets, instance.icMount.pins[0]);
  const lastPin = instance.icMount && socketById(boardSockets, instance.icMount.pins[13]);
  const icRowSpacing = firstPin && lastPin ? Math.abs(firstPin.position[2] - lastPin.position[2]) : null;
  const previewSwitchRight = !!preview && instance.switchPosition === 'right';
  const { object, material, bounds, visuals, resistorVisuals } = useMemo(() => {
    const object = asset.object.clone(true);
    if (isLogicIc(modelId) && icRowSpacing !== null) seatIcPins(object, modelId, icRowSpacing);
    if (mounted) seatLedPins(object);
    if (preview && modelId === 'slide-switch') createSlideVisuals(object).apply(previewSwitchRight ? 1 : 0, 0);
    const material = preview
      ? new MeshStandardMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        })
      : null;
    if (material)
      object.traverse((child) => {
        if (child instanceof Mesh) child.material = material;
      });
    const visuals = !preview && !isBreadboard(modelId) && modelId !== 'resistor' && !isLogicIc(modelId) ? modelId === 'slide-switch' ? createSlideVisuals(object) : createPowerVisuals(object, modelId) : null;
    const resistorVisuals = !preview && modelId === 'resistor' ? createResistorVisuals(object) : null;
    return { object, material, bounds: new Box3().setFromObject(object), visuals, resistorVisuals };
  }, [asset, preview, mounted, modelId, previewSwitchRight, icRowSpacing]);
  useEffect(() => {
    if (material) material.color.set(invalid ? colors.invalid : colors.selected);
    invalidate();
  }, [material, invalid, colors, invalidate]);
  usePowerAnimation(visuals, modelId === 'slide-switch' ? instance.switchPosition === 'right' : !!instance.outputEnabled, modelId === 'led' ? brightness : Number(powered), modelId === 'slide-switch' ? 150 : 180);
  const voltage = instance.voltage ?? DEFAULT_VOLTAGE;
  const resistance = instance.resistanceOhms ?? DEFAULT_RESISTANCE;
  useEffect(() => { visuals?.setVoltage?.(voltage); resistorVisuals?.apply(resistance); invalidate(); }, [visuals, resistorVisuals, voltage, resistance, invalidate]);
  useEffect(() => () => resistorVisuals?.dispose(), [resistorVisuals]);
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
        <mesh position={center} userData={{ pickBounds: true }} raycast={() => null}>
          <boxGeometry args={[x + 0.0008, y + 0.0008, z + 0.0008]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color={colors.selected} raycast={() => null} />
        </mesh>
      )}
    </group>
  );
}
