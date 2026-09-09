import type { LogicIcInstance } from '../types/workspace';
import type { Workspace } from '../store/useWorkspace';
import { logicIcDefinitions } from '../engine/digital/logicIcDefinitions';
import { occupiedSockets } from '../engine/connections';
import { socketById, socketsFor } from '../engine/breadboard';
import { IcPinDiagram } from './IcPinDiagram';

export function IcWiringGuide({ instance, workspace }: { instance: LogicIcInstance; workspace: Workspace }) {
  const board = workspace.instances.find(board => board.id === instance.icMount?.breadboardId);
  const sockets = socketsFor(board, workspace.sockets);
  const occupied = occupiedSockets(workspace);
  const connection = (pin: number) => {
    const socket = socketById(sockets, instance.icMount?.pins[pin - 1] ?? '');
    const free = sockets.find(other => other.groupId === socket?.groupId && !occupied.has(`${board?.id}:${other.id}`));
    return free ? `pin ${pin} via ${free.id}` : `pin ${pin}${socket ? ` (${socket.id} strip)` : ''}`;
  };
  const gate = logicIcDefinitions[instance.modelId].gates[0];
  return <div className="ic-guide-content">
    <ol>
      <li>Insert across the center gap (rows e and f), covering seven columns.</li>
      <li>Set 5 V. Supply + → {connection(14)} (VCC). Supply − → {connection(7)} (GND). Turn output on.</li>
      <li>Gate 1: connect {gate.inputs.map(connection).join(' and ')} to +5 V (HIGH) or ground (LOW). A slide switch can select between them.</li>
      <li>Output {connection(gate.output)} → 330 Ω resistor → LED anode (+). LED cathode (−) → ground. The LED lights for HIGH.</li>
    </ol>
    <details className="ic-picture-disclosure"><summary>Pin picture · find VCC (+) and GND (−)</summary><IcPinDiagram instance={instance} /></details>
    <p>Use a free hole in the pin’s numbered column and on the same side of the gap. The pin’s own hole is occupied. Suggested free holes update as you wire; already connected wires can stay in place. Never join two outputs.</p>
    <details><summary>Light an LED when the output is LOW</summary><p>Supply +5 V → 330 Ω resistor → LED anode (+). LED cathode (−) → output {connection(gate.output)}. This is called sinking current.</p></details>
  </div>;
}
