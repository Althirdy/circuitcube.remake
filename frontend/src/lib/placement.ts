import type { ComponentInstance, GroundPosition } from "../types/workspace";

export function snapPosition(
  position: GroundPosition,
  spacing: number,
  enabled: boolean,
): GroundPosition {
  return enabled
    ? (position.map(
        (value) => Math.round(value / spacing) * spacing,
      ) as GroundPosition)
    : position;
}

export function createDemo(width: number): ComponentInstance[] {
  return [
    {
      id: "demo-breadboard",
      modelId: "breadboard",
      position: [width * 0.45, width * 0.35],
      rotation: 0,
    },
    {
      id: "demo-power",
      modelId: "power",
      outputEnabled: false,
      position: [-width * 1.65, -width * 0.35],
      rotation: 0,
    },
    {
      id: "demo-led",
      modelId: "led",
      position: [width * 1.2, width * 0.35],
      rotation: 0,
    },
  ];
}
