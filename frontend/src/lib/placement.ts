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

export function createDemo(width: number, supplyWidth = 0.2, ledWidth = 0.0058): ComponentInstance[] {
  return [
    {
      id: "demo-breadboard",
      modelId: "breadboard-large",
      position: [0, 0],
      rotation: 0,
    },
    {
      id: "demo-power",
      modelId: "power",
      outputEnabled: false,
      position: [-width / 2 - supplyWidth / 2 - 0.02, 0],
      rotation: 0,
    },
    {
      id: "demo-led",
      modelId: "led",
      position: [width / 2 + ledWidth / 2 + 0.015, 0],
      rotation: 0,
    },
  ];
}
