import { Html } from '@react-three/drei';
import type { Workspace } from '../../store/useWorkspace';
import { componentPose } from '../../lib/componentPose';

export function ElectricalWarnings({ workspace }: { workspace: Workspace }) {
  return <>{workspace.instances.map(instance => {
    const chip = workspace.digital.chips[instance.id];
    const warning = workspace.power.components[instance.id]?.warning ?? (chip?.status === 'fault' ? 'IC wiring fault · select the IC for details' : null);
    const state = workspace.assets[instance.modelId];
    if (!warning || state.status !== 'ready') return null;
    const pose = componentPose(instance, state.asset, workspace.instances, workspace.sockets);
    return <Html key={instance.id} position={[pose.position.x, pose.position.y + state.asset.size.y + 0.004, pose.position.z]} center style={{ pointerEvents: 'none' }}>
      <span className="electrical-warning" role="status">⚠ {warning}</span>
    </Html>;
  })}</>;
}
