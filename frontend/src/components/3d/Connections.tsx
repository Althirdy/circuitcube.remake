import { useLayoutEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { Color, InstancedMesh, Matrix4, Vector3 } from 'three';
import type { Workspace } from '../../store/useWorkspace';
import type { MountCandidate, Point3, TerminalRef } from '../../types/workspace';
import { localToWorld, socketById, socketsFor, switchMountPosition, WIRE_COLORS } from '../../engine/breadboard';
import { canConnect, occupiedSockets, terminalKey } from '../../engine/connections';
import { terminalLead, terminalPosition, wirePoints } from '../../lib/wireGeometry';
import { Wire } from './Wire';
import { routingSurface, terminalLabel } from '../../engine/terminals';
import { terminalStatusLabels } from '../../engine/power';
import { useTheme, sceneColors } from '../../lib/theme';

export function Connections({ workspace }: { workspace: Workspace }) {
  const { theme } = useTheme();
  const colors = sceneColors[theme];
  const { wires, instances, sockets, powerTerminals, selection, draft } = workspace;
  let preview: Point3[] = [];
  if (draft?.preview) {
    if (draft.target) preview = wirePoints({ id: 'draft', ...draft, to: draft.target, color: workspace.wireColor }, instances, sockets, powerTerminals);
    else {
      const board = instances.find(instance => instance.id === draft.from.componentId)!;
      preview = [...terminalLead(draft.from, routingSurface(draft.from, instances, sockets) + draft.height, instances, sockets, powerTerminals), ...[...draft.bends, draft.preview].map(point => localToWorld(board, point))];
    }
  }
  return <>
    <group name="placed-wires">{wires.map(wire => <Wire key={wire.id} id={wire.id} points={wirePoints(wire, instances, sockets, powerTerminals)} color={WIRE_COLORS[wire.color]} selected={selection?.kind !== 'component' && selection?.id === wire.id} />)}</group>
    <group name="selected-wire-endpoints">{wires.filter(wire => selection?.kind !== 'component' && selection?.id === wire.id).flatMap(wire => [wire.from, wire.to].map((ref, index) => {
      const point = terminalPosition(ref, instances, sockets, powerTerminals);
      return point ? <mesh key={`${wire.id}-endpoint-${index}`} position={point} raycast={() => null}><sphereGeometry args={[0.0012, 12, 8]} /><meshBasicMaterial color={colors.selected} transparent opacity={0.75} depthTest={false} depthWrite={false} /></mesh> : null;
    }))}</group>
    <group name="wire-handles">{wires.filter(wire => selection?.kind !== 'component' && selection?.id === wire.id).flatMap(wire => {
      const board = instances.find(instance => instance.id === wire.from.componentId)!;
      return wire.bends.map((bend, index) => <mesh key={`${wire.id}-${index}`} position={localToWorld(board, bend)} userData={{ wireId: wire.id, bendIndex: index }}>
        <sphereGeometry args={[0.00125, 12, 8]} />
        <meshBasicMaterial color={selection?.kind === 'bend' && selection.index === index ? colors.hover : colors.selected} depthTest={false} />
      </mesh>);
    })}</group>
    {preview.length > 1 && <Wire preview points={preview} color={draft?.target && !canConnect(workspace, draft.from, draft.target, sockets, powerTerminals) ? '#df4444' : WIRE_COLORS[workspace.wireColor]} />}
  </>;
}

export function SocketFeedback({ workspace, hover, candidate, hoverSwitch }: { workspace: Workspace; hover: TerminalRef | null; candidate: MountCandidate | null; hoverSwitch?: string }) {
  const { theme } = useTheme();
  const colors = sceneColors[theme];
  const mesh = useRef<InstancedMesh>(null);
  const occupied = occupiedSockets(workspace);
  const rings = useMemo(() => {
    const points: { point: Point3; color: string }[] = [];
    if (hover) {
      const board = workspace.instances.find(instance => instance.id === hover.componentId);
      const definitions = socketsFor(board, workspace.sockets);
      const socket = socketById(definitions, hover.terminalId);
      if (board && socket) for (const member of definitions.filter(item => item.groupId === socket.groupId)) points.push({ point: localToWorld(board, member.position), color: member.id === socket.id ? colors.selected : colors.hover });
    }
    if (candidate?.mount || candidate?.switchMount || candidate?.resistorMount || candidate?.icMount) {
      const board = workspace.instances.find(instance => instance.id === (candidate.icMount?.breadboardId ?? candidate.mount?.breadboardId ?? candidate.switchMount?.breadboardId ?? candidate.resistorMount?.breadboardId));
      const ids = candidate.icMount?.pins ?? candidate.resistorMount?.pins ?? candidate.switchMount?.pins ?? [candidate.mount!.anode, candidate.mount!.cathode];
      if (board) for (const id of ids) { const socket = socketById(socketsFor(board, workspace.sockets), id); if (socket) points.push({ point: localToWorld(board, socket.position), color: candidate.valid ? colors.selected : colors.invalid }); }
    }
    return points;
  }, [workspace.instances, workspace.sockets, hover, candidate, colors]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    mesh.current.count = rings.length;
    rings.forEach(({ point, color }, index) => {
      mesh.current!.setMatrixAt(index, new Matrix4().makeRotationX(-Math.PI / 2).setPosition(new Vector3(point[0], point[1] + 0.00017, point[2])));
      mesh.current!.setColorAt(index, new Color(color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [rings]);
  const hoveredSwitch = workspace.instances.find(instance => instance.id === hoverSwitch && instance.modelId === 'slide-switch');
  const switchPose = hoveredSwitch?.switchMount ? switchMountPosition(hoveredSwitch.switchMount, workspace.instances, workspace.sockets) : null;
  const commonStatus = hoveredSwitch?.switchMount ? workspace.power.terminals[`${hoveredSwitch.switchMount.breadboardId}:${hoveredSwitch.switchMount.pins[1]}`] ?? 'unconnected' : 'unconnected';
  const position = hover ? terminalPosition(hover, workspace.instances, workspace.sockets, workspace.powerTerminals) : rings[0]?.point;
  const powerHover = hover && workspace.instances.find(instance => instance.id === hover.componentId)?.modelId === 'power';
  const hoverStatus = hover ? workspace.power.terminals[terminalKey(hover)] ?? 'unconnected' : 'unconnected';
  return <>
    {hoveredSwitch && <Html position={switchPose ? [switchPose.position[0], switchPose.position[1] + 0.015, switchPose.position[2]] : [hoveredSwitch.position[0], 0.015, hoveredSwitch.position[1]]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><span className="socket-label">{hoveredSwitch.switchPosition === 'right' ? '2 ↔ 3' : '1 ↔ 2'} · Common: {terminalStatusLabels[commonStatus]}</span></Html>}
    <instancedMesh ref={mesh} args={[undefined, undefined, 30]} raycast={() => null}>
      <ringGeometry args={[0.00055, 0.001, 16]} /><meshBasicMaterial depthTest={false} transparent opacity={0.8} />
    </instancedMesh>
    {position && powerHover && <mesh position={[position[0], position[1], position[2]]} raycast={() => null}><sphereGeometry args={[0.002, 12, 8]} /><meshBasicMaterial color="#2680ef" transparent opacity={0.45} depthWrite={false} /></mesh>}
    {position && <Html position={[position[0], position[1] + 0.005, position[2]]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><span className={`socket-label ${candidate && !candidate.valid ? 'invalid' : ''}`}>{candidate ? candidate.reason : `${terminalLabel(hover!.terminalId)}${occupied.has(terminalKey(hover!)) ? ' · occupied' : ''} · ${terminalStatusLabels[hoverStatus]}`}</span></Html>}
    {candidate && !position && <Html fullscreen style={{ pointerEvents: 'none' }}><span className="mount-feedback invalid">{candidate.reason}</span></Html>}
  </>;
}
