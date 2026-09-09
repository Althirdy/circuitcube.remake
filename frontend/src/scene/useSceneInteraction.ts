import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Line3, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { OrbitControls } from 'three-stdlib';
import type { ComponentInstance, GroundPosition, MountCandidate, Point3, TerminalRef } from '../types/workspace';
import type { Workspace } from '../store/useWorkspace';
import { snapPosition } from '../lib/placement';
import { isBreadboard, isMountable, socketsFor, SOCKET_PITCH, worldToLocal } from '../engine/breadboard';
import { mountFlipped, mountedPosition, mountingCandidate } from '../engine/mounting';
import { wirePoints } from '../lib/wireGeometry';
import { routingSurface } from '../engine/terminals';
import { createComponent, withMount } from '../engine/componentFactory';

type Feedback = { preview: ComponentInstance | null; candidate: MountCandidate | null; hover: TerminalRef | null; hiddenId?: string; hoverSwitch?: string };
type Hit = { id: string; point: Vector3; distance: number; bendIndex?: number };
export function useSceneInteraction(workspace: Workspace, controlsRef: RefObject<OrbitControls | null>) {
  const { camera, gl, scene, invalidate } = useThree();
  const latest = useRef(workspace);
  const refreshPreview = useRef<(() => void) | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ preview: null, candidate: null, hover: null });
  useLayoutEffect(() => { latest.current = workspace; });
  const flipped = workspace.mode.kind === 'component-placement' && workspace.mode.flipped;
  useEffect(() => { refreshPreview.current?.(); }, [flipped]);
  useEffect(() => {
    if (controlsRef.current) controlsRef.current.enabled = !workspace.placing;
  }, [workspace.placing, controlsRef]);
  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    let drag: { id: string; pointerId: number; startX: number; startY: number; offset: GroundPosition; moved: boolean; bendIndex?: number; y?: number; switchClick?: boolean } | null = null;
    let emptyDown: { x: number; y: number } | null = null;
    let rightDown: { x: number; y: number; hit: Hit | null } | null = null;
    let dropFeedback: Feedback | null = null;
    const ray = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    };
    const onPlane = (y = 0) => raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -y), new Vector3());
    const hit = (group: string, key: string): Hit | null => {
      const objects = scene.getObjectByName(group);
      if (!objects) return null;
      for (const intersection of raycaster.intersectObject(objects, true)) {
        let object: Object3D | null = intersection.object;
        while (object) {
          if (typeof object.userData[key] === 'string') return { id: object.userData[key] as string, point: intersection.point, distance: intersection.distance, bendIndex: object.userData.bendIndex as number | undefined };
          object = object.parent;
        }
      }
      return null;
    };
    const boardAtPointer = () => {
      const current = latest.current;
      for (const board of [...current.instances].reverse()) {
        if (!isBreadboard(board.modelId)) continue;
        const asset = current.assets[board.modelId];
        if (asset.status !== 'ready') continue;
        const sockets = socketsFor(board, current.sockets);
        const point = onPlane(sockets[0].position[1]);
        if (!point) continue;
        const size = asset.asset.size;
        const local = worldToLocal(board, point.toArray());
        if (Math.abs(local[0]) < size.x / 2 && Math.abs(local[2]) < size.z / 2) return { board, local, point };
      }
      return null;
    };
    const interactivePartHit = (): { id: string; terminalId?: string; switchClick: boolean } | null => {
      const group = scene.getObjectByName('placed-components');
      if (!group) return null;
      for (const intersection of raycaster.intersectObject(group, true)) {
        if (intersection.object.userData.pickBounds) continue;
        let object: Object3D | null = intersection.object;
        let id: string | undefined, terminalId: string | undefined, switchClick = false, visible = true;
        while (object) {
          visible = visible && object.visible;
          if (typeof object.userData.instanceId === 'string') id = object.userData.instanceId;
          if (typeof object.userData.terminalId === 'string') terminalId = object.userData.terminalId;
          switchClick = switchClick || (object.userData.powerSwitch === true || object.userData.slideSwitch === true);
          object = object.parent;
        }
        if (!visible) continue;
        // The first real surface occludes parts behind it; invisible selection
        // boxes must not intercept the terminal or rocker meshes.
        return id && latest.current.instances.some(instance => instance.id === id && (instance.modelId === 'power' || instance.modelId === 'slide-switch')) ? { id, terminalId, switchClick } : null;
      }
      return null;
    };
    const socketHit = (): TerminalRef | null => {
      const power = interactivePartHit();
      if (power?.terminalId) return { componentId: power.id, terminalId: power.terminalId };
      const boardHit = boardAtPointer();
      if (!boardHit) return null;
      const obstruction = hit('placed-components', 'instanceId');
      if (obstruction && obstruction.id !== boardHit.board.id && obstruction.distance < raycaster.ray.origin.distanceTo(boardHit.point) - 0.0001) return null;
      const nearest = socketsFor(boardHit.board, latest.current.sockets).find(socket => Math.hypot(socket.position[0] - boardHit.local[0], socket.position[2] - boardHit.local[2]) < 0.0011);
      return nearest ? { componentId: boardHit.board.id, terminalId: nearest.id } : null;
    };
    const mountCandidate = (ignoreId?: string): MountCandidate | null => {
      const boardHit = boardAtPointer();
      if (!boardHit) return null;
      const current = latest.current;
      const previous = current.instances.find(instance => instance.id === ignoreId);
      const flipped = current.mode.kind === 'component-placement' ? current.mode.flipped : mountFlipped(previous, current, current.sockets);
      return mountingCandidate(current, current.placing ?? previous?.modelId ?? 'led', boardHit.board, boardHit.local, current.sockets, flipped, ignoreId);
    };
    const snappedBend = (board: ComponentInstance, point: Vector3): Point3 => {
      const local = worldToLocal(board, point.toArray());
      if (latest.current.snap) {
        const origin = socketsFor(board, latest.current.sockets)[0]?.position ?? [0, 0, 0];
        local[0] = origin[0] + Math.round((local[0] - origin[0]) / SOCKET_PITCH) * SOCKET_PITCH;
        local[2] = origin[2] + Math.round((local[2] - origin[2]) / SOCKET_PITCH) * SOCKET_PITCH;
      }
      return local;
    };
    const updatePreview = () => {
      const current = latest.current;
      if (current.draft) {
        const board = current.instances.find(instance => instance.id === current.draft!.from.componentId)!;
        const point = onPlane(routingSurface(current.draft.from, current.instances, current.sockets) + current.height / 1000);
        if (point) current.previewWire(snappedBend(board, point), socketHit());
        setFeedback({ preview: null, candidate: null, hover: socketHit() });
        return;
      }
      const dragged = drag ? current.instances.find(instance => instance.id === drag!.id) : undefined;
      const draggingMountable = drag && dragged && isMountable(dragged.modelId) && drag.moved;
      if (current.placing || draggingMountable) {
        const ground = onPlane();
        const modelId = current.placing ?? dragged!.modelId;
        const candidate = isMountable(modelId) ? mountCandidate(draggingMountable ? drag!.id : undefined) : null;
        const position = ground ? snapPosition([ground.x + (draggingMountable ? drag!.offset[0] : 0), ground.z + (draggingMountable ? drag!.offset[1] : 0)], current.spacing, current.snap) : [0, 0] as GroundPosition;
        const rotation = draggingMountable ? current.instances.find(instance => instance.id === drag!.id)!.rotation : current.mode.kind === 'component-placement' && current.mode.flipped ? Math.PI : 0;
        const base = dragged ? { ...dragged, id: 'preview', position, rotation } : createComponent('preview', modelId, position, rotation);
        const preview = ground ? withMount(base, candidate?.valid ? candidate.mount ?? undefined : undefined, candidate?.valid ? candidate.switchMount : undefined, candidate?.valid ? candidate.resistorMount : undefined, candidate?.valid ? candidate.icMount : undefined) : null;
        dropFeedback = { preview, candidate, hover: null, hiddenId: draggingMountable ? drag!.id : undefined };
        setFeedback(dropFeedback);
      } else { const part = interactivePartHit(); setFeedback({ preview: null, candidate: null, hover: socketHit(), hoverSwitch: part?.switchClick ? part.id : undefined }); }
    };
    refreshPreview.current = updatePreview;
    const finish = () => {
      const old = drag; drag = null; dropFeedback = null;
      if (old && canvas.hasPointerCapture(old.pointerId)) canvas.releasePointerCapture(old.pointerId);
      if (old) latest.current.setMode({ kind: 'idle' });
      if (controlsRef.current) controlsRef.current.enabled = !latest.current.placing;
      canvas.style.cursor = latest.current.placing || latest.current.draft ? 'crosshair' : 'grab';
      setFeedback({ preview: null, candidate: null, hover: null }); invalidate();
    };
    const stop = (event: PointerEvent) => { event.stopImmediatePropagation(); event.preventDefault(); };
    const down = (event: PointerEvent) => {
      ray(event); const current = latest.current;
      if (event.button === 2) { rightDown = { x: event.clientX, y: event.clientY, hit: hit('wire-handles', 'wireId') ?? hit('placed-wires', 'wireId') }; return; }
      if (event.button !== 0 || event.shiftKey) return;
      canvas.closest<HTMLElement>('.workplane')?.focus({ preventScroll: true });
      current.setContextMenu(null);
      if (current.draft) { stop(event); const target = socketHit(); if (target) current.completeWire(target); return; }
      if (current.placing) {
        stop(event); updatePreview();
        if (dropFeedback?.candidate && !dropFeedback.candidate.valid) { current.setMessage(dropFeedback.candidate.reason); return; }
        if (dropFeedback?.preview) current.add(current.placing, dropFeedback.preview.position, dropFeedback.preview.mount, dropFeedback.preview.switchMount, dropFeedback.preview.resistorMount, dropFeedback.preview.icMount);
        setFeedback({ preview: null, candidate: null, hover: null }); return;
      }
      const handle = hit('wire-handles', 'wireId');
      const switchPart = interactivePartHit();
      const socket = socketHit();
      const wire = handle ?? (socket || switchPart?.switchClick ? null : hit('placed-wires', 'wireId'));
      if (wire) {
        stop(event); current.selectWire(wire.id, wire.bendIndex);
        if (wire.bendIndex !== undefined) {
          const instance = current.wires.find(item => item.id === wire.id)!;
          drag = { id: wire.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offset: [0, 0], moved: false, bendIndex: wire.bendIndex, y: instance.bends[wire.bendIndex][1] };
          current.setMode({ kind: 'bend-editing', wireId: wire.id, index: wire.bendIndex });
        }
      } else if (socket) { stop(event); current.beginWire(socket); return; }
      else {
        const component = switchPart?.switchClick ? { id: switchPart.id } : hit('placed-components', 'instanceId'); const ground = onPlane();
        if (!component || !ground) { emptyDown = { x: event.clientX, y: event.clientY }; return; }
        stop(event); current.select(component.id);
        const instance = current.instances.find(item => item.id === component.id)!;
        const mount = mountedPosition(instance, current.instances, current.sockets);
        const position = mount ? [mount.position[0], mount.position[2]] : instance.position;
        drag = { id: component.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offset: [position[0] - ground.x, position[1] - ground.z], moved: false, switchClick: switchPart?.id === component.id && switchPart.switchClick };
      }
      if (drag) { if (controlsRef.current) controlsRef.current.enabled = false; canvas.setPointerCapture(event.pointerId); }
    };
    const move = (event: PointerEvent) => {
      ray(event); const current = latest.current;
      if (drag) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= 3 && !drag.moved) return;
        drag.moved = true;
        if (drag.bendIndex !== undefined) {
          const wire = current.wires.find(item => item.id === drag!.id);
          if (!wire || !wire.bends[drag.bendIndex]) { finish(); return; }
          const board = current.instances.find(item => item.id === wire.from.componentId)!;
          const point = onPlane(drag.y);
          if (point) current.editBend(wire.id, drag.bendIndex, snappedBend(board, point));
        } else {
          const instance = current.instances.find(item => item.id === drag!.id);
          if (!instance) { finish(); return; }
          if (isMountable(instance.modelId)) { current.setMode({ kind: 'component-mounting', componentId: instance.id }); updatePreview(); }
          else { const point = onPlane(); if (point) current.move(drag.id, [point.x + drag.offset[0], point.z + drag.offset[1]]); current.setMode({ kind: 'component-dragging', componentId: drag.id }); }
        }
      } else { updatePreview(); canvas.style.cursor = current.draft || current.placing || socketHit() || hit('placed-wires', 'wireId') || hit('placed-components', 'instanceId') ? 'pointer' : 'grab'; }
    };
    const up = (event: PointerEvent) => {
      ray(event); const current = latest.current;
      if (event.button === 2 && rightDown) {
        if (Math.hypot(event.clientX - rightDown.x, event.clientY - rightDown.y) < 4) {
          if (current.draft) current.addDraftBend();
          else if (rightDown.hit) {
            const wireHit = rightDown.hit;
            const wire = current.wires.find(item => item.id === wireHit.id);
            if (!wire) { rightDown = null; return; }
            const board = current.instances.find(item => item.id === wire.from.componentId)!;
            const points = wirePoints(wire, current.instances, current.sockets, current.powerTerminals);
            let nearest = Infinity, insertIndex = 0;
            for (let i = 2; i < points.length - 3; i++) {
              const distance = new Line3(new Vector3(...points[i]), new Vector3(...points[i + 1])).closestPointToPoint(wireHit.point, true, new Vector3()).distanceTo(wireHit.point);
              if (distance < nearest) { nearest = distance; insertIndex = i - 2; }
            }
            const local = snappedBend(board, wireHit.point);
            const surface = routingSurface(wire.from, current.instances, current.sockets);
            local[1] = Math.min(surface + 0.03, Math.max(surface + 0.002, local[1]));
            current.selectWire(wire.id, wireHit.bendIndex);
            current.setContextMenu({ x: event.clientX, y: event.clientY, wireId: wire.id, point: local, insertIndex, bendIndex: wireHit.bendIndex });
          }
        }
        rightDown = null; return;
      }
      if (event.button !== 0 || (drag && event.pointerId !== drag.pointerId)) return;
      if (drag?.switchClick && !drag.moved) {
        const part = interactivePartHit();
        if (part?.id === drag.id && part.switchClick) {
          if (current.instances.find(instance => instance.id === drag!.id)?.modelId === 'slide-switch') current.toggleSwitch(drag.id);
          else current.togglePower(drag.id);
        }
      }
      if (drag?.moved && drag.bendIndex === undefined && current.instances.some(item => item.id === drag!.id && isMountable(item.modelId))) {
        updatePreview();
        if (dropFeedback?.candidate) {
          if (dropFeedback.candidate.valid && dropFeedback.candidate.icMount) current.attachIc(drag.id, dropFeedback.candidate.icMount);
          else if (dropFeedback.candidate.valid && dropFeedback.candidate.resistorMount) current.attachResistor(drag.id, dropFeedback.candidate.resistorMount);
          else if (dropFeedback.candidate.valid && dropFeedback.candidate.switchMount) current.attachSwitch(drag.id, dropFeedback.candidate.switchMount);
          else if (dropFeedback.candidate.valid && dropFeedback.candidate.mount) current.attach(drag.id, dropFeedback.candidate.mount);
          else current.setMessage(dropFeedback.candidate.reason);
        } else if (dropFeedback?.preview) current.detach(drag.id, dropFeedback.preview.position);
      }
      if (emptyDown && event.button === 0 && Math.hypot(event.clientX - emptyDown.x, event.clientY - emptyDown.y) < 4) current.select(null);
      emptyDown = null; if (drag) finish();
    };
    const leave = () => { if (!drag) setFeedback({ preview: null, candidate: null, hover: null }); };
    const cancel = () => { emptyDown = null; rightDown = null; finish(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    const context = (event: MouseEvent) => event.preventDefault();
    canvas.addEventListener('pointerdown', down, true);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('contextmenu', context);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key);
    return () => {
      refreshPreview.current = null;
      canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('contextmenu', context);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key);
    };
  }, [camera, controlsRef, gl, invalidate, scene]);
  return feedback;
}
