import { useState } from "react";
import { Workplane } from "./components/Workplane";
import { WorkspaceStatus } from "./components/WorkspaceStatus";
import { ComponentLibrary } from "./components/ComponentLibrary";
import { WorkspaceToolbar } from "./components/WorkspaceToolbar";
import { Icon } from "./components/Icon";
import { useWorkspace } from "./store/useWorkspace";
import "./App.css";
import { useTheme } from './lib/theme';
import { ThemeProvider } from './components/ThemeProvider';
import './theme.css';

function App() {
  return <ThemeProvider><WorkspaceApp /></ThemeProvider>;
}
function WorkspaceApp() {
  const { theme, toggle } = useTheme();
  const workspace = useWorkspace();
  const [libraryOpen, setLibraryOpen] = useState(false);
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="./" aria-label="CircuitCube home">
          <span className="brand-mark">
            <Icon name="cube" size={24} />
          </span>
          <span>
            Circuit<span className="brand-light">Cube</span>
          </span>
        </a>
        <div className="project-name">
          <span>Workspace</span>
          <Icon name="chevron" size={13} />
          <h1>Untitled circuit</h1>
        </div>
        <button className="theme-toggle" role="switch" aria-label="Dark mode" aria-checked={theme === 'dark'} onClick={toggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} /><span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
        <div className="session-badge">
          <span />
          Session only
        </div>
      </header>
      <WorkspaceToolbar
        workspace={workspace}
        libraryOpen={libraryOpen}
        toggleLibrary={() => setLibraryOpen(!libraryOpen)}
      />
      <div className={`workspace-layout ${libraryOpen ? "library-open" : ""}`}>
        <Workplane workspace={workspace} />
        {libraryOpen && (
          <button
            className="library-scrim"
            aria-label="Close component library"
            onClick={() => setLibraryOpen(false)}
          />
        )}
        <ComponentLibrary
          workspace={workspace}
          close={() => setLibraryOpen(false)}
        />
      </div>
      <WorkspaceStatus workspace={workspace} />
    </div>
  );
}
export default App;
