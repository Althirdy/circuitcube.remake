import type { LogicIcInstance } from '../types/workspace';
import type { Workspace } from '../store/useWorkspace';
import { logicIcDefinitions } from '../engine/digital/logicIcDefinitions';
import { voltageLabel } from '../lib/electricalFormatting';
import { IcWiringGuide } from './IcWiringGuide';

export function IcDetails({ instance, workspace }: { instance: LogicIcInstance; workspace: Workspace }) {
  const reading = workspace.digital.chips[instance.id];
  if (!reading) return null;
  const definition = logicIcDefinitions[instance.modelId];
  const firstGate = definition.gates[0];
  const unknownInputs = reading.pins.filter(pin => pin.role.includes('input') && pin.level === 'unknown');
  const statusLabel = { ready: 'Powered', unmounted: 'Not inserted', unpowered: 'No power', fault: 'Check wiring' }[reading.status];
  return <section className="ic-details" aria-label={`${definition.label} pin details`}>
    <p className={`ic-status ic-status-${reading.status}`} role="status">{statusLabel}{reading.reason ? ` · ${reading.reason}` : ''}</p>
    <p>{definition.kind === 'and' ? 'AND: output is HIGH only when both inputs are HIGH.' : definition.kind === 'or' ? 'OR: output is HIGH when either input is HIGH.' : 'NOT: a LOW input gives HIGH; a HIGH input gives LOW.'}</p>
    {instance.icMount && <p className="mounted-info">Pin 1: {instance.icMount.pins[0]} · notch at the pin 1 end. Left/Right moves one column; R turns the IC 180°.</p>}
    <div className="ic-gate-summary" aria-label="Gate 1 live states" role="status">
      <strong>Gate 1</strong>
      {[...firstGate.inputs, firstGate.output].map(number => {
        const pin = reading.pins[number - 1];
        return <span key={number}>{number === firstGate.output ? 'Output Y' : `Input ${firstGate.inputs.indexOf(number) === 0 ? 'A' : 'B'}`} · pin {number}: <span className={`logic-state logic-${pin.level}`}>{pin.level.toUpperCase()}</span></span>;
      })}
    </div>
    <p>UNKNOWN means the simulator cannot determine HIGH or LOW; it does not mean LOW.</p>
    {reading.status === 'ready' && unknownInputs.length > 0 && <p className="ic-input-hint">{unknownInputs.length} input{unknownInputs.length === 1 ? ' is' : 's are'} UNKNOWN. Connect the inputs of the gate you use to HIGH or LOW. Unused gates do not stop other gates.</p>}
    <details className="ic-guide" open={reading.status !== 'ready'}>
      <summary>How to wire this IC</summary>
      <IcWiringGuide instance={instance} workspace={workspace} />
    </details>
    <p className="ic-guide-persistence">This guide stays available when you select a wire or another component. Close it when you no longer need it.</p>
    <details className="ic-all-pins">
      <summary>All 14 pins · states and wiring details</summary>
    <table className="ic-pin-table">
      <caption>Pin map · socket names rotate with the IC</caption>
      <thead><tr><th scope="col">Pin</th><th scope="col">Function</th><th scope="col">Socket</th><th scope="col">State</th></tr></thead>
      <tbody>{reading.pins.map(pin => <tr key={pin.pin}>
        <th scope="row">{pin.pin}</th><td>{pin.role}</td><td>{pin.socket ?? '—'}</td>
        <td><span className={`logic-state logic-${pin.level}`}>{pin.level.toUpperCase()}</span><small>{voltageLabel(pin.voltage)}</small>{pin.reason && <details className="ic-pin-reason"><summary aria-label={`Why pin ${pin.pin} is ${pin.level}`}>Why?</summary><span>{pin.reason}</span></details>}</td>
      </tr>)}</tbody>
    </table>
    </details>
    <p className="ic-model-note">Educational TTL: LOW ≤0.8 V, HIGH ≥2 V; values between them are UNKNOWN. Use a 4.75–5.25 V supply. Outputs are idealized; IC current limits, input current and timing are not modeled.</p>
  </section>;
}
