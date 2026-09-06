import { lazy, Suspense } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { Icon } from "./Icon";
import { modelCatalog, modelLabel } from "../lib/modelCatalog";
import type { Workspace } from "../store/useWorkspace";
import type { CameraAction } from "../types/workspace";
import { WiringPanel } from './WiringPanel';
import { mountPosition, switchMountPosition } from '../engine/breadboard';
import { ledLabels, powerLabels, terminalStatusLabels } from '../engine/power';

const CircuitScene = lazy(() =>
  import("../scene/CircuitScene").then((module) => ({
    default: module.CircuitScene,
  })),
);

export function Workplane({ workspace }: { workspace: Workspace }) {
  const selected = workspace.instances.find(
    (instance) => instance.id === workspace.selectedId,
  );
  const mountedPose = selected?.switchMount ? switchMountPosition(selected.switchMount, workspace.instances, workspace.sockets) : selected?.mount ? mountPosition(selected.mount, workspace.instances, workspace.sockets) : null;
  const selectedPosition = mountedPose ? [mountedPose.position[0], mountedPose.position[2]] : selected?.position;
  const faults = workspace.instances.filter(instance => instance.modelId === 'power' && ['short-circuit', 'multiple-supplies'].includes(workspace.power.supplies[instance.id]));
  const ready = Object.values(workspace.assets).filter(
    (asset) => asset.status === "ready",
  ).length;
  const camera = (action: CameraAction) =>
    workspace.sceneApi.current?.command(action);
  return (
    <main
      className={`workplane ${workspace.placing ? "placement-mode" : ""}`}
      aria-label="Interactive 3D workplane"
      tabIndex={0}
    >
      <ErrorBoundary
        fallback={
          <div className="canvas-fallback" role="alert">
            <h2>Could not open the 3D view</h2>
            <p>Reload the workspace to try again.</p>
            <button onClick={() => window.location.reload()}>
              Reload workspace
            </button>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="canvas-fallback" role="status">
              Loading 3D workspace…
            </div>
          }
        >
          <CircuitScene workspace={workspace} />
        </Suspense>
      </ErrorBoundary>
      <div className="workplane-heading">
        <span className="eyebrow">LET'S MAKE SOMETHING</span>
        <span className="workplane-title">Your circuit starts here.</span>
      </div>
      <div className="view-presets" aria-label="Camera views">
        <button onClick={() => camera("home")} title="Home view">
          <Icon name="home" size={15} />
          Home
        </button>
        <button onClick={() => camera("top")}>Top</button>
        <button onClick={() => camera("front")}>Front</button>
      </div>
      <div className="camera-tools" aria-label="Camera controls">
        <button
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => camera("in")}
        >
          <Icon name="plus" />
        </button>
        <button
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => camera("out")}
        >
          <Icon name="minus" />
        </button>
        <span />
        <button
          aria-label="Fit all components"
          title="Fit all components"
          onClick={() => camera("fit")}
        >
          <Icon name="fit" />
        </button>
      </div>
      {!workspace.initialized && (
        <div className="loading-banner" role="status">
          <span className="loading-dot" />
          Preparing your workplane <span>{ready} / {modelCatalog.length}</span>
        </div>
      )}
      {workspace.placing && (
        <div className="placement-banner" role="status">
          <Icon name="plus" />
          <div>
            Placing <strong>{modelLabel(workspace.placing)}</strong>
            <small>{workspace.placing === 'slide-switch' ? 'Click three adjacent terminal holes to insert · R reverses pin order' : workspace.placing === 'led' ? 'Click two adjacent terminal holes to insert · R flips polarity' : 'Move onto the grid and click to place'}</small>
          </div>
          <button onClick={() => workspace.setPlacing(null)}>
            Cancel <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {selected && !workspace.placing && (
        <div className="selection-panel">
          <div>
            <span className="eyebrow">SELECTED COMPONENT</span>
            <strong>{modelLabel(selected.modelId)}</strong>
            {selected.switchMount && <span className="mounted-info">Inserted: 1 {selected.switchMount.pins[0]} / 2 common {selected.switchMount.pins[1]} / 3 {selected.switchMount.pins[2]}</span>}
            {selected.modelId === 'slide-switch' && <span className="switch-state" data-state={selected.switchPosition ?? 'left'} role="status">{selected.switchPosition === 'right' ? 'Right · 2 ↔ 3' : 'Left · 1 ↔ 2'}<br />Common: {selected.switchMount ? terminalStatusLabels[workspace.power.terminals[`${selected.switchMount.breadboardId}:${selected.switchMount.pins[1]}`] ?? 'unconnected'] : 'Loose · insert to connect'}</span>}
            {selected.mount && <span className="mounted-info">Inserted: + {selected.mount.anode} / − {selected.mount.cathode}</span>}
            {selected.modelId === 'led' && <span className="led-power-state" data-state={workspace.power.leds[selected.id] ?? 'unmounted'} role="status">{ledLabels[workspace.power.leds[selected.id] ?? 'unmounted']}</span>}
            {selected.modelId === 'power' && <span className="power-output-state" data-state={workspace.power.supplies[selected.id] ?? 'off'} role="status">{powerLabels[workspace.power.supplies[selected.id] ?? 'off']}{selected.outputEnabled && workspace.power.supplies[selected.id] !== 'on' ? ' · output suppressed' : ''}</span>}
            <span className="selection-position">
              X {(selectedPosition![0] / workspace.spacing).toFixed(1)} · Z{" "}
              {(selectedPosition![1] / workspace.spacing).toFixed(1)}{" "}
              <span>grid steps</span> ·{" "}
              {Math.round((selected.rotation * 180) / Math.PI)}°
            </span>
          </div>
          {selected.switchMount && <button className="detach-switch" onClick={() => workspace.detach(selected.id)}>Detach switch</button>}
          {selected.modelId === 'slide-switch' && <button className="switch-toggle" aria-label="Switch position" aria-pressed={selected.switchPosition === 'right'} onClick={() => workspace.toggleSwitch(selected.id)}>Slide {selected.switchPosition === 'right' ? 'left' : 'right'}</button>}
          {selected.mount && <button className="detach-led" onClick={() => workspace.detach(selected.id)}>Detach LED</button>}
          {selected.modelId === 'power' && <button className="power-toggle" aria-label="Output on/off" aria-pressed={!!selected.outputEnabled} disabled={workspace.assets.power.status !== 'ready'} onClick={() => workspace.togglePower(selected.id)}>{selected.outputEnabled ? 'Turn off' : 'Turn on'}</button>}
          <button
            aria-label="Focus selected component"
            title="Focus selected component"
            onClick={() => camera("selection")}
          >
            <Icon name="focus" />
          </button>
        </div>
      )}
      <WiringPanel workspace={workspace} />
      {faults.length > 0 && <div className="power-faults" role="alert">{faults.map(instance => <p key={instance.id}>Supply {workspace.instances.indexOf(instance) + 1}: {powerLabels[workspace.power.supplies[instance.id]]} — output suppressed. Fix the wiring or turn it off.</p>)}</div>}
      <div className="controls-hint">
        <Icon name="mouse" size={15} />
        <span>Drag to orbit</span>
        <i />
        <span>Right-drag to pan</span>
        <i />
        <span>Scroll to zoom</span>
      </div>
      <div className="axis-key" aria-hidden="true">
        <span className="axis-y">Y</span>
        <span className="axis-z">Z</span>
        <span className="axis-x">X</span>
        <span className="axis-origin" />
      </div>
    </main>
  );
}
