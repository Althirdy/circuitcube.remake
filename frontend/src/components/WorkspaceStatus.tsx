import { modelLabel } from "../lib/modelCatalog";
import type { Workspace } from "../store/useWorkspace";
export function WorkspaceStatus({ workspace }: { workspace: Workspace }) {
  const selected = workspace.instances.find(
    (instance) => instance.id === workspace.selectedId,
  );
  return (
    <>
      <footer className="status-bar">
        <div>
          <span className="status-dot" />
          <span>{workspace.instances.length} components · {workspace.wires.length} wires</span>
          <span className="status-separator">/</span>
          <span>
            {workspace.draft ? 'Click a free socket · Right-click adds a bend' : workspace.selection?.kind === 'wire' || workspace.selection?.kind === 'bend' ? 'Drag bend handles · Delete to remove' : workspace.placing
              ? "Click to place · Esc to cancel"
              : selected
                ? "Arrow keys to move · R to rotate · Delete to remove"
                : "Ready to create"}
          </span>
        </div>
        <span>
          Local workspace <span className="status-separator">·</span> Refresh
          resets the scene
        </span>
      </footer>
      <span className="sr-only" role="status" aria-live="polite">
        {selected
          ? `${modelLabel(selected.modelId)} selected. ${Math.round((selected.rotation * 180) / Math.PI)} degrees.`
          : `${workspace.instances.length} components on workplane.`}
      </span>
    </>
  );
}
