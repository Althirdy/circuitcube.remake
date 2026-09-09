import { modelCatalog, modelLabel } from "../lib/modelCatalog";
import type { Workspace } from "../store/useWorkspace";
import { Icon } from "./Icon";
import { terminalLabel } from '../engine/terminals';
import { categoryByModel, componentCategories } from '../lib/componentCategories';
import { LibrarySection } from './LibrarySection';

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
            Components <span>{String(modelCatalog.length).padStart(2, '0')}</span>
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
      {componentCategories.map(category => <LibrarySection key={category.id} label={category.label} icon={category.icon} count={modelCatalog.filter(model => categoryByModel[model.id] === category.id).length} initiallyOpen={category.id === 'boards'} selected={workspace.instances.some(instance => instance.id === workspace.selectedId && categoryByModel[instance.modelId] === category.id) || (!!workspace.placing && categoryByModel[workspace.placing] === category.id)} errors={modelCatalog.filter(model => categoryByModel[model.id] === category.id && workspace.assets[model.id].status === 'error').length}>
      <div className="model-list">
        {modelCatalog.filter(model => categoryByModel[model.id] === category.id).map((model) => {
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
      </LibrarySection>)}
      <div className="circuit-contents-heading"><Icon name="layers" size={16} />Your circuit</div>
      <LibrarySection label="On the workplane" icon="cube" count={workspace.instances.length} selected={!!workspace.selectedId}>
      <div className="scene-list">
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
      </LibrarySection>
      <div className="library-note">
        <span className="note-dot" />
        Click a socket or supply terminal to wire it.
        <br />
        <span>Series DC + 5 V logic ICs · use resistors with LEDs.</span>
      </div>
      <LibrarySection label="Jumper wires" icon="wire" count={workspace.wires.length} selected={workspace.selection?.kind === 'wire' || workspace.selection?.kind === 'bend'}>
      <div className="scene-list wire-list">
        {!workspace.wires.length && <p>No wires yet. Click a free socket or supply terminal, then another endpoint.</p>}
        {workspace.wires.map((wire, index) => <button className="wire-item" key={wire.id} aria-pressed={workspace.selection?.kind !== 'component' && workspace.selection?.id === wire.id} onClick={() => { workspace.setPlacing(null); workspace.selectWire(wire.id); close(); }}>Wire {index + 1}: {terminalLabel(wire.from.terminalId)} → {terminalLabel(wire.to.terminalId)}</button>)}
      </div>
      </LibrarySection>
    </aside>
  );
}
