import { useId } from 'react';
import type { LogicIcInstance } from '../types/workspace';
import { icDiagram } from '../lib/icDiagram';

export function IcPinDiagram({ instance }: { instance: LogicIcInstance }) {
  const id = useId();
  const diagram = icDiagram(instance);
  return <figure className="ic-diagram">
    <figcaption>Top view · {diagram.label}</figcaption>
    <svg viewBox="0 0 340 350" role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <title id={`${id}-title`}>{diagram.label}: pin 14 VCC positive, pin 7 ground</title>
      <desc id={`${id}-description`}>Fixed notch-up reference, not the current camera view. Pin 1 is at the upper left; numbering runs down the left and up the right. Pin 14 connects to +5 volts; pin 7 to supply negative at 0 volts. {diagram.pins.map(pin => `Pin ${pin.number}: ${pin.description}${pin.socket ? `, socket ${pin.socket}` : ', not mounted'}.`).join(' ')}</desc>
      <rect className="diagram-body" x="126" y="43" width="88" height="294" rx="9" />
      <path className="diagram-notch" d="M156 43a14 14 0 0 0 28 0" />
      <circle className="diagram-dot" cx="143" cy="53" r="4" />
      <text x="170" y="26" textAnchor="middle" className="diagram-label">Notch</text>
      <text x="170" y="185" textAnchor="middle" className="diagram-chip-label">{diagram.label.split(' ')[0]}</text>
      {diagram.pins.map(pin => <g key={pin.number} className={`diagram-pin diagram-${pin.role}`}>
        <rect x={pin.left ? 108 : 214} y={pin.y - 9} width="18" height="18" rx="2" />
        <text x={pin.left ? 138 : 202} y={pin.y + 5} textAnchor="middle" className="diagram-number">{pin.number}</text>
        <text x={pin.left ? 101 : 239} y={pin.y - 2} textAnchor={pin.left ? 'end' : 'start'} className="diagram-label">{pin.label}</text>
        <text x={pin.left ? 101 : 239} y={pin.y + 17} textAnchor={pin.left ? 'end' : 'start'} className="diagram-socket">{pin.socket ?? '—'}</text>
      </g>)}
    </svg>
    <p><strong>14: VCC (+5 V)</strong> · <strong>7: GND (0 V / supply −)</strong></p>
    {!instance.icMount && <p>Socket — means the IC is not inserted yet.</p>}
    <p>Intended connections, not live power. Find the notch and pin-1 dot on your IC. This is a fixed reference, not the current camera view; socket names update when you turn the IC.</p>
  </figure>;
}
