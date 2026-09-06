import { Box3, Vector3 } from "three";

/**
 * A stable composition around the breadboard working area. The bounds extend
 * left far enough to keep the power supply at the edge without letting its
 * much larger body determine the zoom level.
 */
export function createHomeBounds(width: number) {
  return new Box3().setFromCenterAndSize(
    new Vector3(-0.02, width * 0.175, 0),
    new Vector3(width + 0.12, width * 0.35, Math.max(0.08, width * 0.7)),
  );
}
