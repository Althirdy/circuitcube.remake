import { useState } from 'react';
import type { LogicIcInstance } from '../types/workspace';
import type { Workspace } from '../store/useWorkspace';
import { modelLabel } from '../lib/modelCatalog';
import { IcWiringGuide } from './IcWiringGuide';

export function PersistentIcGuide({ instance, workspace }: { instance: LogicIcInstance; workspace: Workspace }) {
  const [expanded, setExpanded] = useState(() => !matchMedia('(max-width: 800px)').matches);
  return <aside className="ic-floating-guide" aria-label={`${modelLabel(instance.modelId)} wiring guide`}>
    <div className="ic-floating-guide-heading"><strong>{modelLabel(instance.modelId)} · wiring guide</strong><button onClick={workspace.closeIcGuide} aria-label="Close IC wiring guide">Close</button></div>
    <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary>{expanded ? 'Hide wiring steps' : 'Show wiring steps'}</summary>
      <IcWiringGuide instance={instance} workspace={workspace} />
    </details>
  </aside>;
}
