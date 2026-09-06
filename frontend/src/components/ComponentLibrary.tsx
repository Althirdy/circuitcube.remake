import { modelCatalog, modelLabel } from "../lib/modelCatalog";
import type { Workspace } from "../store/useWorkspace";
import { Icon } from "./Icon";
import { terminalLabel } from '../engine/terminals';

export function ComponentLibrary({
  workspace,
  close,
}: {
  workspace: Workspace;
  close: () => void;
}) {
  return (
    <aside
      className="component-library"
      aria-label="Component library"
      id="component-library"
    >
      <div className="library-heading">
        <div>
          <span className="eyebrow">YOUR TOOLKIT</span>
          <h2>
            Components <span>03</span>
          </h2>
        </div>
        <button
          className="icon-button close-library"
          aria-label="Close component library"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
      <p className="library-intro">
        A few parts. Endless possibilities.
        <br />
        Choose a component to get started.
      </p>
      <div className="library-category">
        <Icon name="layers" size={16} />
        <span>Basic electronics</span>
        <span className="category-count">3</span>
      </div>
      <div className="model-list">
        {modelCatalog.map((model, index) => {
          const state = workspace.assets[model.id];
          return (
            <article
              className={`model-card ${workspace.placing === model.id ? "is-placing" : ""}`}
              key={model.id}
            >
              <button
                className="model-choice"
                disabled={state.status !== "ready" || !workspace.initialized}
                aria-label={`Place ${model.label}`}
                aria-pressed={workspace.placing === model.id}
                onClick={() => {
                  workspace.setPlacing(model.id);
                  close();
                }}
              >
                <div className="model-thumbnail">
                  <span className="model-number">0{index + 1}</span>
                  {state.status === "ready" && state.asset.thumbnail ? (
                    <img
                      src={state.asset.thumbnail}
                      alt={`${model.label} 3D preview`}
                    />
                  ) : (
                    <span className="asset-placeholder">
                      {state.status === "error"
                        ? "Preview unavailable"
                        : "Loading model…"}
                    </span>
                  )}
                  <span className="add-indicator">
                    <Icon name="plus" size={16} />
                  </span>
                </div>
                <div className="model-copy">
                  <h3>{model.label}</h3>
                  <p>{model.description}</p>
                </div>
              </button>
              {state.status === "error" ? (
                <div className="asset-error" role="alert">
                  <span>Model could not load.</span>
                  <button onClick={() => workspace.retry(model.id)}>
                    Retry
                  </button>
                </div>
              ) : (
                <button
                  className="add-center"
                  disabled={state.status !== "ready" || !workspace.initialized}
                  onClick={() =>
                    workspace.add(
                      model.id,
                      workspace.sceneApi.current?.viewCenter() ?? [0, 0],
                    )
                  }
                >
                  <Icon name="plus" size={13} />
                  Add at view center
                </button>
              )}
            </article>
          );
        })}
      </div>
      <div className="scene-list">
        <div className="scene-list-heading">
          <span className="eyebrow">ON THE WORKPLANE</span>
          <span>{workspace.instances.length}</span>
        </div>
        {workspace.instances.length === 0 ? (
          <p>Your next idea starts here.</p>
        ) : (
          workspace.instances.map((instance, index) => (
            <button
              key={instance.id}
              className={
                workspace.selectedId === instance.id
                  ? "scene-item selected"
                  : "scene-item"
              }
              aria-pressed={workspace.selectedId === instance.id}
              onClick={() => {
                workspace.setPlacing(null);
                workspace.select(instance.id);
              }}
            >
              <Icon name="cube" size={15} />
              <span>{modelLabel(instance.modelId)}</span>
              <span className="instance-number">
                {String(index + 1).padStart(2, "0")}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="library-note">
        <span className="note-dot" />
        Click a socket or supply terminal to wire it.
        <br />
        <span>Logical power · no voltage or current calculations.</span>
      </div>
      {workspace.wires.length > 0 && <div className="scene-list wire-list">
        <div className="scene-list-heading"><span className="eyebrow">JUMPER WIRES</span><span>{workspace.wires.length}</span></div>
        {workspace.wires.map((wire, index) => <button className="wire-item" key={wire.id} aria-pressed={workspace.selection?.kind !== 'component' && workspace.selection?.id === wire.id} onClick={() => { workspace.setPlacing(null); workspace.selectWire(wire.id); close(); }}>Wire {index + 1}: {terminalLabel(wire.from.terminalId)} → {terminalLabel(wire.to.terminalId)}</button>)}
      </div>}
    </aside>
  );
}
