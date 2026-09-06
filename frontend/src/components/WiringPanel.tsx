import type { Workspace } from '../store/useWorkspace';
import type { WireColor } from '../types/workspace';
import { WIRE_COLORS } from '../engine/breadboard';
import { routingSurface, terminalLabel } from '../engine/terminals';

export function WiringPanel({ workspace }: { workspace: Workspace }) {
  const { selection, draft, contextMenu } = workspace;
  const wire = selection && selection.kind !== 'component' ? workspace.wires.find(item => item.id === selection.id) : null;
  const selectedBend = selection?.kind === 'bend' ? selection.index : undefined;
  const height = wire ? selectedBend === undefined ? wire.height * 1000 : (wire.bends[selectedBend][1] - routingSurface(wire.from, workspace.instances, workspace.sockets)) * 1000 : workspace.height;
  const from = draft?.from ?? wire?.from;
  const supplySource = from && workspace.instances.find(instance => instance.id === from.componentId)?.modelId === 'power';
  return <>
    {(draft || wire) && <section className="wiring-panel" aria-label="Wire properties">
      <div className="wiring-heading"><strong>{draft ? 'Drawing wire' : selectedBend === undefined ? 'Jumper wire' : `Bend ${selectedBend + 1}`}</strong><span>{draft ? `${terminalLabel(draft.from.terminalId)} → …` : `${terminalLabel(wire!.from.terminalId)} → ${terminalLabel(wire!.to.terminalId)}`}</span></div>
      <div className="wire-colors" aria-label="Wire color">{(Object.keys(WIRE_COLORS) as WireColor[]).map(color => <button key={color} aria-label={`${color} wire`} aria-pressed={(wire?.color ?? workspace.wireColor) === color} title={color} style={{ background: WIRE_COLORS[color] }} onClick={() => workspace.changeColor(color)} />)}</div>
      <label className="wire-height">{draft ? 'Next bend height' : selectedBend === undefined ? 'Route height' : 'Bend height'}<input aria-label="Wire height in millimeters" type="number" min={2} max={30} step={1} value={Math.round(height)} onChange={event => workspace.changeHeight(Number(event.target.value))} /><span>mm</span></label>
      <small className="height-reference">Above {supplySource ? 'workplane' : 'breadboard socket surface'}; connector exits stay attached.</small>
      {draft ? <>
        <div className="wire-actions"><button disabled={!draft.preview} onClick={workspace.addDraftBend}>Add bend <kbd>Enter</kbd></button><button onClick={() => workspace.setPlacing(null)}>Cancel</button></div>
        <small>{draft.bends.length} bends · Backspace removes last · Esc cancels</small>
      </> : <>
        <div className="wire-actions"><button onClick={() => workspace.sceneApi.current?.command('selection')}>Focus wire</button><button onClick={workspace.remove}>{selectedBend === undefined ? 'Delete wire' : 'Remove bend'}</button></div>
        <div className="bend-list">{wire!.bends.map((_, index) => <button key={index} aria-pressed={selectedBend === index} onClick={() => workspace.selectWire(wire!.id, index)}>Bend {index + 1}</button>)}</div>
        <small>Drag a blue handle. Right-click a segment to add a bend.</small>
      </>}
    </section>}
    {contextMenu && <div className="wire-context" role="menu" style={{ left: Math.min(contextMenu.x, window.innerWidth - 190), top: Math.min(contextMenu.y, window.innerHeight - 100) }}>
      {contextMenu.bendIndex === undefined ? <button role="menuitem" onClick={() => workspace.addBend(contextMenu.wireId, contextMenu.insertIndex, contextMenu.point)}>Add bend here</button> : <button role="menuitem" onClick={workspace.remove}>Remove bend</button>}
      <button role="menuitem" onClick={() => workspace.setContextMenu(null)}>Close</button>
    </div>}
    <div className="connection-message" role="status">{workspace.message}</div>
  </>;
}
