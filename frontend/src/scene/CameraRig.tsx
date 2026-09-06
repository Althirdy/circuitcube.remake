import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { RefObject } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Workspace } from "../store/useWorkspace";
import type { CameraAction } from "../types/workspace";
import { createHomeBounds } from "../lib/cameraFraming";
import { componentBounds } from '../lib/componentPose';
import { wirePoints } from '../lib/wireGeometry';

function updateClipping(orbit: OrbitControlsImpl, width: number) {
  const camera = orbit.object;
  if (camera instanceof PerspectiveCamera) {
    // Scale the clip range with viewing distance to preserve tiny surface details.
    camera.near = Math.max(
      width / 10000,
      camera.position.distanceTo(orbit.target) / 80,
    );
    camera.far = width * 400;
    camera.updateProjectionMatrix();
  }
}

export function CameraRig({
  workspace,
  controls,
}: {
  workspace: Workspace;
  controls: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, invalidate, size } = useThree();
  const framed = useRef(false);
  const { instances, assets, selectedId, selection, wires, sockets, powerTerminals, width, initialized, sceneApi } =
    workspace;

  const frame = useCallback(
    (action: CameraAction) => {
      const orbit = controls.current;
      if (!orbit || !(camera instanceof PerspectiveCamera)) return;
      if (action === "in" || action === "out") {
        const offset = camera.position.clone().sub(orbit.target);
        offset.setLength(
          Math.max(
            orbit.minDistance,
            Math.min(
              orbit.maxDistance,
              offset.length() * (action === "in" ? 0.75 : 1.33),
            ),
          ),
        );
        camera.position.copy(orbit.target).add(offset);
      } else {
        const bounds =
          action === "home" ? createHomeBounds(width) : new Box3();
        if (action !== "home") {
          for (const instance of instances) {
            if (action === "selection" && instance.id !== selectedId) continue;
            const state = assets[instance.modelId];
            if (state.status !== "ready") continue;
            const modelBounds = componentBounds(instance, state.asset, instances, sockets);
            bounds.union(modelBounds);
          }
          for (const wire of wires) {
            if (action === 'selection' && (selection?.kind === 'component' || selection?.id !== wire.id)) continue;
            for (const point of wirePoints(wire, instances, sockets, powerTerminals)) bounds.expandByPoint(new Vector3(...point));
          }
          if (!bounds.isEmpty()) bounds.expandByScalar(0.0005);
        }
        if (bounds.isEmpty())
          bounds.setFromCenterAndSize(
            new Vector3(),
            new Vector3(width * 2, width, width * 2),
          );
        const center = bounds.getCenter(new Vector3());
        const radius = bounds.getSize(new Vector3()).length() / 2;
        const verticalFov = (camera.fov * Math.PI) / 180;
        const horizontalFov =
          2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
        const distance =
          (radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2)) * 1.18;
        let direction = camera.position.clone().sub(orbit.target).normalize();
        if (action === "home")
          direction = new Vector3(0.2, 1.05, 1.55).normalize();
        if (action === "top") direction = new Vector3(0, 1, 0.0001).normalize();
        if (action === "front") direction = new Vector3(0, 0.05, 1).normalize();
        orbit.target.copy(center);
        camera.position.copy(center).addScaledVector(direction, distance);
      }
      orbit.update();
      invalidate();
    },
    [assets, camera, controls, instances, invalidate, selectedId, selection, wires, sockets, powerTerminals, width],
  );

  useImperativeHandle(
    sceneApi,
    () => ({
      command: frame,
      viewCenter: () => [
        controls.current?.target.x ?? 0,
        controls.current?.target.z ?? 0,
      ],
    }),
    [controls, frame],
  );
  useEffect(() => {
    if (initialized && !framed.current) {
      framed.current = true;
      frame("home");
    }
  }, [initialized, frame]);
  useEffect(() => {
    invalidate();
  }, [size, invalidate]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      screenSpacePanning={false}
      minPolarAngle={0.0001}
      maxPolarAngle={Math.PI / 2 - 0.015}
      minDistance={width / 100}
      maxDistance={width * 150}
      zoomSpeed={0.85}
      target={[0, 0, 0]}
      onChange={() => {
        if (controls.current) updateClipping(controls.current, width);
      }}
    />
  );
}
