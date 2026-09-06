import type { Workspace } from "../store/useWorkspace";
import { Icon } from "./Icon";

export function WorkspaceToolbar({
  workspace,
  toggleLibrary,
  libraryOpen,
}: {
  workspace: Workspace;
  toggleLibrary: () => void;
  libraryOpen: boolean;
}) {
  const selected = !!workspace.selectedId && !workspace.placing;
  return (
    <div className="workspace-toolbar" aria-label="Workspace tools">
      <div className="toolbar-group">
        <span className="tool-mode">
          <Icon name="pointer" size={16} />
          {workspace.draft ? 'Wire' : workspace.placing ? "Place" : "Select"}
        </span>
        <span className="toolbar-divider" />
        <button
          disabled={!selected && workspace.placing !== 'led'}
          onClick={workspace.rotate}
          aria-label="Rotate component"
          title="Rotate (R); LEDs flip polarity 180°"
        >
          <Icon name="rotate" />
          <span>Rotate</span>
        </button>
        <button
          disabled={!workspace.selection || !!workspace.placing || !!workspace.draft}
          onClick={workspace.remove}
          aria-label={workspace.selection?.kind === 'component' ? 'Delete component' : 'Delete selection'}
          title="Delete component (Delete)"
        >
          <Icon name="trash" />
          <span>Delete</span>
        </button>
      </div>
      <div className="toolbar-group">
        <button
          className={`snap-button ${workspace.snap ? "active" : ""}`}
          aria-label="Snap to grid"
          aria-pressed={workspace.snap}
          onClick={() => workspace.setSnap(!workspace.snap)}
        >
          <Icon name="grid" size={16} />
          <span>Snap to grid</span>
          <span className="toggle-track">
            <span />
          </span>
        </button>
        <span className="toolbar-divider" />
        <button
          className="library-toggle"
          aria-label="Toggle component library"
          aria-controls="component-library"
          aria-expanded={libraryOpen}
          onClick={toggleLibrary}
        >
          <Icon name="panel" />
          <span>Components</span>
        </button>
      </div>
    </div>
  );
}
