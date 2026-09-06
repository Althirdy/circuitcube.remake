import { useLayoutEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { Color, InstancedMesh, Matrix4, Vector3 } from 'three';
import type { Workspace } from '../../store/useWorkspace';
import type { MountCandidate, Point3, TerminalRef } from '../../types/workspace';
import { localToWorld, socketById, WIRE_COLORS } from '../../engine/breadboard';
import { canConnect, occupiedSockets, terminalKey } from '../../engine/connections';
import { terminalLead, terminalPosition, wirePoints } from '../../lib/wireGeometry';
import { Wire } from './Wire';
import { routingSurface, terminalLabel } from '../../engine/terminals';
import { terminalStatusLabels } from '../../engine/power';

export function Connections({ workspace }: { workspace: Workspace }) {
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
    <group name="wire-handles">{wires.filter(wire => selection?.kind !== 'component' && selection?.id === wire.id).flatMap(wire => {
      const board = instances.find(instance => instance.id === wire.from.componentId)!;
      return wire.bends.map((bend, index) => <mesh key={`${wire.id}-${index}`} position={localToWorld(board, bend)} userData={{ wireId: wire.id, bendIndex: index }}>
        <sphereGeometry args={[0.00125, 12, 8]} />
        <meshBasicMaterial color={selection?.kind === 'bend' && selection.index === index ? '#f59e0b' : '#2780ee'} depthTest={false} />
      </mesh>);
    })}</group>
    {preview.length > 1 && <Wire preview points={preview} color={draft?.target && !canConnect(workspace, draft.from, draft.target, sockets, powerTerminals) ? '#df4444' : WIRE_COLORS[workspace.wireColor]} />}
  </>;
}

export function SocketFeedback({ workspace, hover, candidate }: { workspace: Workspace; hover: TerminalRef | null; candidate: MountCandidate | null }) {
  const mesh = useRef<InstancedMesh>(null);
  const occupied = occupiedSockets(workspace);
  const rings = useMemo(() => {
    const points: { point: Point3; color: string }[] = [];
    if (hover) {
      const board = workspace.instances.find(instance => instance.id === hover.componentId);
      const socket = socketById(workspace.sockets, hover.terminalId);
      if (board && socket) for (const member of workspace.sockets.filter(item => item.groupId === socket.groupId)) points.push({ point: localToWorld(board, member.position), color: member.id === socket.id ? '#1672f3' : '#94baf0' });
    }
    if (candidate?.mount) {
      const board = workspace.instances.find(instance => instance.id === candidate.mount!.breadboardId);
      if (board) for (const id of [candidate.mount.anode, candidate.mount.cathode]) { const socket = socketById(workspace.sockets, id); if (socket) points.push({ point: localToWorld(board, socket.position), color: candidate.valid ? '#16a36a' : '#e34646' }); }
    }
    return points;
  }, [workspace.instances, workspace.sockets, hover, candidate]);
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
  const position = hover ? terminalPosition(hover, workspace.instances, workspace.sockets, workspace.powerTerminals) : rings[0]?.point;
  const powerHover = hover && workspace.instances.find(instance => instance.id === hover.componentId)?.modelId === 'power';
  const hoverStatus = hover ? workspace.power.terminals[terminalKey(hover)] ?? 'unconnected' : 'unconnected';
  return <>
    <instancedMesh ref={mesh} args={[undefined, undefined, 30]} raycast={() => null}>
      <ringGeometry args={[0.00055, 0.001, 16]} /><meshBasicMaterial depthTest={false} transparent opacity={0.8} />
    </instancedMesh>
    {position && powerHover && <mesh position={[position[0], position[1], position[2]]} raycast={() => null}><sphereGeometry args={[0.002, 12, 8]} /><meshBasicMaterial color="#2680ef" transparent opacity={0.45} depthWrite={false} /></mesh>}
    {position && <Html position={[position[0], position[1] + 0.005, position[2]]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><span className={`socket-label ${candidate && !candidate.valid ? 'invalid' : ''}`}>{candidate ? candidate.reason : `${terminalLabel(hover!.terminalId)}${occupied.has(terminalKey(hover!)) ? ' · occupied' : ''} · ${terminalStatusLabels[hoverStatus]}`}</span></Html>}
    {candidate && !position && <Html fullscreen style={{ pointerEvents: 'none' }}><span className="mount-feedback invalid">{candidate.reason}</span></Html>}
  </>;
}
