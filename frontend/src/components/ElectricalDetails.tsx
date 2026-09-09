import { useState } from 'react';
import type { ComponentInstance } from '../types/workspace';
import type { Workspace } from '../store/useWorkspace';
import { DEFAULT_RESISTANCE, DEFAULT_VOLTAGE, RESISTANCE_VALUES, resistanceLabel, validVoltage } from '../engine/resistor';

import { currentLabel, voltageLabel } from '../lib/electricalFormatting';
import { isLogicIcInstance } from '../engine/digital/logicIcDefinitions';
import { IcDetails } from './IcDetails';

function VoltageControl({ instance, workspace }: { instance: ComponentInstance; workspace: Workspace }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const voltage = instance.voltage ?? DEFAULT_VOLTAGE;
  const commit = () => {
    if (draft === null) return;
    const value = Number(draft);
    const valid = draft.trim() !== '' && validVoltage(value);
    if (valid) workspace.setVoltage(instance.id, value);
    setError(!valid); setDraft(null);
  };
  return <div className="voltage-control">
    <label>Supply voltage <input aria-label="Supply voltage in volts" type="number" min={0} max={12} step={0.1} value={draft ?? voltage.toFixed(1)} aria-invalid={error} onChange={event => { setDraft(event.target.value); setError(false); }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} /> V</label>
    <div className="voltage-presets">{[3.3, 5, 9, 12].map(value => <button key={value} aria-label={`Set supply to ${value} volts`} aria-pressed={voltage === value} onClick={() => { workspace.setVoltage(instance.id, value); setDraft(null); setError(false); }}>{value} V</button>)}</div>
    <small>Enter or leave the field to apply.</small>
    {error && <small role="alert">Use 0–12 V in 0.1 V steps. Previous value retained.</small>}
  </div>;
}

export function ElectricalDetails({ instance, workspace }: { instance: ComponentInstance; workspace: Workspace }) {
  const reading = workspace.power.components[instance.id];
  if (isLogicIcInstance(instance)) return <IcDetails instance={instance} workspace={workspace} />;
  return <>
    {instance.modelId === 'power' && <VoltageControl key={instance.id} instance={instance} workspace={workspace} />}
    {instance.modelId === 'resistor' && <div className="resistor-control">
      <label>Resistance <select aria-label="Resistance" value={instance.resistanceOhms ?? DEFAULT_RESISTANCE} onChange={event => workspace.setResistance(instance.id, Number(event.target.value))}>{RESISTANCE_VALUES.map(value => <option key={value} value={value}>{resistanceLabel(value)}</option>)}</select></label>
      <small>±5% · 0.25 W · 1 kΩ = 1,000 Ω</small>
    </div>}
    {instance.modelId === 'led' && <small className="electrical-assumption">Model: 2 V forward drop · 20 mA warning threshold</small>}
    {reading && <div className="component-readings" aria-label="Component electrical readings">
      <span>Current: {currentLabel(reading.current)}</span>
      <span>Voltage drop: {voltageLabel(reading.voltageDrop === null ? null : Math.abs(reading.voltageDrop))}</span>
      {instance.modelId === 'resistor' && <span>Power: {reading.dissipation === null ? 'Unavailable' : `${reading.dissipation.toFixed(3)} W`}</span>}
      {reading.warning && <strong className="component-warning" role="status">{reading.warning}</strong>}
      {reading.estimatedUnsafe && <small>Estimated unsafe operating values</small>}
      {reading.reason && <small>{reading.reason}</small>}
    </div>}
  </>;
}
