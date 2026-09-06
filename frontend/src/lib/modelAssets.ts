import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
} from "three";
import type { Object3D, WebGLRenderer } from "three";
import type { ModelDefinition } from "../types/workspace";
import { sourceSockets } from '../engine/breadboard';
import type { Point3 } from '../types/workspace';
import { preparePowerTerminals } from './powerAsset';

export function prepareModel(scene: Object3D, model: ModelDefinition) {
  const transformed = new Group();
  transformed.add(scene.clone(true));
  transformed.scale.setScalar(model.scale);
  transformed.rotation.set(...model.rotation);
  const bounds = new Box3().setFromObject(transformed);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  transformed.position.set(-center.x, -bounds.min.y, -center.z);
  const object = new Group();
  object.add(transformed);
  object.updateMatrixWorld(true);
  const sockets = model.id === 'breadboard' ? sourceSockets().map(socket => ({ ...socket, position: new Vector3(...socket.position).applyMatrix4(transformed.matrixWorld).toArray() as Point3 })) : undefined;
  const flange = object.getObjectByName('LED_BaseFlange');
  const ledBaseY = flange ? new Box3().setFromObject(flange).min.y : undefined;
  const terminals = model.id === 'power' ? preparePowerTerminals(object) : sockets;
  return { object, size, sockets, terminals, ledBaseY };
}

// Reuse the workspace renderer for a single offscreen frame per asset.
export function renderThumbnail(
  renderer: WebGLRenderer,
  object: Group,
  size: Vector3,
): string {
  const scene = new Scene();
  scene.background = new Color("#f4f6f8");
  scene.add(object.clone(true), new AmbientLight("#ffffff", 2.1));
  const key = new DirectionalLight("#ffffff", 3.2);
  key.position.set(2, 4, 3);
  scene.add(key);
  const fill = new DirectionalLight("#d8e8ff", 1.5);
  fill.position.set(-3, 1, -2);
  scene.add(fill);
  const radius = size.length() / 2;
  const camera = new PerspectiveCamera(35, 1.6, radius / 20, radius * 100);
  const center = new Vector3(0, size.y / 2, 0);
  camera.position
    .copy(center)
    .add(
      new Vector3(1, 0.9, 1.5)
        .normalize()
        .multiplyScalar((radius / Math.sin((35 * Math.PI) / 360)) * 1.12),
    );
  camera.lookAt(center);
  const width = 384,
    height = 240;
  const target = new WebGLRenderTarget(width, height);
  target.texture.colorSpace = SRGBColorSpace;
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return "";
    const data = context.createImageData(width, height);
    for (let row = 0; row < height; row++)
      data.data.set(
        pixels.subarray(
          (height - 1 - row) * width * 4,
          (height - row) * width * 4,
        ),
        row * width * 4,
      );
    context.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    renderer.setRenderTarget(previous);
    target.dispose();
  }
}
