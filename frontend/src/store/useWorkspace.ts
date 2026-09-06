import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { snapPosition } from '../lib/placement';
import { BREADBOARD_SOCKETS, socketById } from '../engine/breadboard';
import { canConnect, connectWire, detachLed, mountError, mountLed, occupiedSockets, removeComponent, terminalKey } from '../engine/connections';
import type { GroundPosition, InteractionMode, Layout, LedMount, LoadedAsset, ModelId, Point3, SceneApi, Selection, TerminalRef, WireColor, WireContextMenu, WireInstance } from '../types/workspace';
import { initialWorkspace, workspaceReducer } from './workspaceReducer';
import { evaluatePower } from '../engine/power';
import { routingSurface, terminalDefinition, terminalLabel } from '../engine/terminals';
import type { TerminalDefinition } from '../types/workspace';

const NO_TERMINALS: TerminalDefinition[] = [];

export function useWorkspace() {
  const [{ assets, instances, wires, initialized }, dispatch] = useReducer(workspaceReducer, initialWorkspace);
  const updateLayout = useCallback((update: (layout: Layout) => Layout) => dispatch({ type: 'layout', update }), []);
  const [selection, setSelection] = useState<Selection>(null);
  const [mode, setMode] = useState<InteractionMode>({ kind: 'idle' });
  const [snap, setSnap] = useState(true);
  const [wireColor, setWireColor] = useState<WireColor>('green');
  const [height, setHeight] = useState(5);
  const [message, setMessage] = useState('Click a breadboard hole to start a wire.');
  const [contextMenu, setContextMenu] = useState<WireContextMenu | null>(null);
  const sceneApi = useRef<SceneApi | null>(null);
  const selectedId = selection?.kind === 'component' ? selection.id : null;
  const placing = mode.kind === 'component-placement' ? mode.modelId : null;
  const draft = mode.kind === 'wire-drawing' ? mode.draft : null;
  const board = assets.breadboard;
  const sockets = board.status === 'ready' ? board.asset.sockets ?? BREADBOARD_SOCKETS : BREADBOARD_SOCKETS;
  const powerTerminals = assets.power.status === 'ready' ? assets.power.asset.terminals ?? NO_TERMINALS : NO_TERMINALS;
  const power = useMemo(() => evaluatePower({ instances, wires }, sockets, powerTerminals), [instances, wires, sockets, powerTerminals]);
  const togglePower = (id: string) => updateLayout(current => ({ ...current, instances: current.instances.map(instance => instance.id === id && instance.modelId === 'power' ? { ...instance, outputEnabled: !instance.outputEnabled } : instance) }));
  const width = board.status === 'ready' ? Math.max(board.asset.size.x, board.asset.size.z) : 0.084;
  const spacing = width / 10;
  const layout = { instances, wires };
  const loaded = useCallback((id: ModelId, asset: LoadedAsset) => dispatch({ type: 'loaded', id, asset }), []);
  const failed = useCallback((id: ModelId) => dispatch({ type: 'failed', id }), []);
  const retry = (id: ModelId) => dispatch({ type: 'retry', id });
  const select = (id: string | null) => { setSelection(id ? { kind: 'component', id } : null); setContextMenu(null); };
  const selectWire = (id: string, index?: number) => { setSelection(index === undefined ? { kind: 'wire', id } : { kind: 'bend', id, index }); setContextMenu(null); };
  const setPlacing = (modelId: ModelId | null) => {
    setMode(modelId ? { kind: 'component-placement', modelId, flipped: false } : { kind: 'idle' });
    setContextMenu(null);
  };
  const move = (id: string, position: GroundPosition) => updateLayout(current => ({ ...current, instances: current.instances.map(instance => instance.id === id ? { ...instance, position: snapPosition(position, spacing, snap) } : instance) }));
  const add = (modelId: ModelId, position: GroundPosition, mount?: LedMount) => {
    if (assets[modelId].status !== 'ready' || !initialized) return;
    if (mount) { const error = mountError(layout, mount, sockets); if (error) { setMessage(error); return; } }
    const id = crypto.randomUUID();
    const rotation = mode.kind === 'component-placement' && mode.flipped ? Math.PI : 0;
    updateLayout(current => {
      const next = { ...current, instances: [...current.instances, { id, modelId, position: snapPosition(position, spacing, snap), rotation, outputEnabled: modelId === 'power' ? false : undefined }] };
      return mount ? mountLed(next, id, mount, sockets) : next;
    });
    select(id); setMode({ kind: 'idle' });
  };
  const attach = (id: string, mount: LedMount) => {
    const error = mountError(layout, mount, sockets, id);
    if (error) { setMessage(error); return; }
    updateLayout(current => mountLed(current, id, mount, sockets));
    setMessage(`LED inserted: + ${mount.anode}, − ${mount.cathode}`);
  };
  const detach = (id: string, position?: GroundPosition) => {
    updateLayout(current => {
      const next = detachLed(current, id, sockets);
      return position ? { ...next, instances: next.instances.map(instance => instance.id === id ? { ...instance, position: snapPosition(position, spacing, snap) } : instance) } : next;
    });
    setMessage('LED detached. Original legs restored.');
  };
  const rotate = () => {
    if (mode.kind === 'component-placement' && mode.modelId === 'led') { setMode({ ...mode, flipped: !mode.flipped }); return; }
    updateLayout(current => ({ ...current, instances: current.instances.map(instance => {
      if (instance.id !== selectedId) return instance;
      return { ...instance, rotation: (instance.rotation + (instance.modelId === 'led' ? Math.PI : Math.PI / 2)) % (Math.PI * 2), mount: instance.mount ? { ...instance.mount, anode: instance.mount.cathode, cathode: instance.mount.anode } : undefined };
    }) }));
  };
  const editWire = (id: string, update: (wire: WireInstance) => WireInstance) => updateLayout(current => ({ ...current, wires: current.wires.map(wire => wire.id === id ? update(wire) : wire) }));
  const editBend = (id: string, index: number, point: Point3) => editWire(id, wire => ({ ...wire, bends: wire.bends.map((bend, i) => i === index ? point : bend) }));
  const addBend = (id: string, index: number, point: Point3) => { editWire(id, wire => ({ ...wire, bends: [...wire.bends.slice(0, index), point, ...wire.bends.slice(index)] })); selectWire(id, index); };
  const remove = () => {
    if (!selection) return;
    if (selection.kind === 'component') updateLayout(current => removeComponent(current, selection.id, sockets));
    else if (selection.kind === 'bend') { editWire(selection.id, wire => ({ ...wire, bends: wire.bends.filter((_, i) => i !== selection.index) })); selectWire(selection.id); return; }
    else updateLayout(current => ({ ...current, wires: current.wires.filter(wire => wire.id !== selection.id) }));
    select(null); setMode({ kind: 'idle' });
  };
  const beginWire = (from: TerminalRef) => {
    if (!terminalDefinition(instances.find(instance => instance.id === from.componentId), from.terminalId, sockets, powerTerminals)) return;
    if (occupiedSockets(layout).has(terminalKey(from))) { setMessage(`${terminalLabel(from.terminalId)} is occupied`); return; }
    setSelection(null); setContextMenu(null); setHeight(5);
    setMode({ kind: 'wire-drawing', draft: { from, bends: [], preview: null, target: null, height: 0.005 } });
    setMessage(`From ${terminalLabel(from.terminalId)}: click a free terminal to finish. Right-click adds a bend.`);
  };
  const previewWire = (preview: Point3, target: TerminalRef | null) => setMode(current => current.kind === 'wire-drawing' ? { ...current, draft: { ...current.draft, preview, target } } : current);
  const addDraftBend = () => setMode(current => {
    if (current.kind !== 'wire-drawing' || !current.draft.preview) return current;
    const { preview, bends } = current.draft;
    if (bends.length && bends[bends.length - 1].every((v, i) => Math.abs(v - preview[i]) < 0.00001)) return current;
    return { ...current, draft: { ...current.draft, bends: [...bends, preview] } };
  });
  const completeWire = (to: TerminalRef) => {
    if (!draft) return;
    if (!canConnect(layout, draft.from, to, sockets, powerTerminals)) { setMessage('Choose a different, unoccupied socket. Supply leads must connect to a breadboard.'); return; }
    const wire: WireInstance = { id: crypto.randomUUID(), from: draft.from, to, color: wireColor, bends: draft.bends, height: draft.height };
    updateLayout(current => connectWire(current, wire, sockets, powerTerminals));
    setMode({ kind: 'idle' }); selectWire(wire.id); setMessage(`Connected ${terminalLabel(wire.from.terminalId)} to ${terminalLabel(to.terminalId)}`);
  };
  const changeColor = (color: WireColor) => { setWireColor(color); if (selection && selection.kind !== 'component') editWire(selection.id, wire => ({ ...wire, color })); };
  const changeHeight = (value: number) => {
    const mm = Math.min(30, Math.max(2, Math.round(value))); setHeight(mm);
    if (draft) {
      const y = routingSurface(draft.from, instances, sockets) + mm / 1000;
      setMode({ kind: 'wire-drawing', draft: { ...draft, preview: draft.preview ? [draft.preview[0], y, draft.preview[2]] : null } });
    } else if (selection && selection.kind !== 'component') editWire(selection.id, wire => {
      const y = routingSurface(wire.from, instances, sockets) + mm / 1000;
      return { ...wire, height: selection.kind === 'wire' ? mm / 1000 : wire.height, bends: wire.bends.map((bend, i) => selection.kind === 'wire' || i === selection.index ? [bend[0], y, bend[2]] : bend) };
    });
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') { setMode({ kind: 'idle' }); setSelection(null); setContextMenu(null); setMessage('Cancelled.'); return; }
      if (draft) {
        if (event.key === 'Enter') { event.preventDefault(); addDraftBend(); }
        if (event.key === 'Backspace') { event.preventDefault(); setMode({ kind: 'wire-drawing', draft: { ...draft, bends: draft.bends.slice(0, -1) } }); }
        return;
      }
      if (event.key.toLowerCase() === 'r') { event.preventDefault(); rotate(); }
      if (placing) return;
      if (event.key === 'Delete') { event.preventDefault(); remove(); }
      const delta: Record<string, GroundPosition> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const instance = instances.find(item => item.id === selectedId);
      if (!delta[event.key] || !instance) return;
      event.preventDefault(); const [x, z] = delta[event.key];
      if (instance.mount) {
        const shift = (id: string) => { const socket = socketById(sockets, id)!; const row = 'abcdefghij'.indexOf(socket.row!) - z; return `${'abcdefghij'[row] ?? '?'}${socket.column! + x}`; };
        attach(instance.id, { ...instance.mount, anode: shift(instance.mount.anode), cathode: shift(instance.mount.cathode) });
      } else { const step = spacing * (snap ? 1 : 0.1); move(instance.id, [instance.position[0] + x * step, instance.position[1] + z * step]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return { assets, instances, wires, sockets, powerTerminals, power, togglePower, selection, selectedId, select, selectWire, mode, setMode, placing, setPlacing, draft, snap, setSnap, spacing, width, initialized, sceneApi, loaded, failed, retry, move, add, rotate, remove, attach, detach, beginWire, previewWire, addDraftBend, completeWire, editBend, addBend, wireColor, changeColor, height, changeHeight, message, setMessage, contextMenu, setContextMenu };
}
export type Workspace = ReturnType<typeof useWorkspace>;
