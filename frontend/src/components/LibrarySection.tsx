import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function LibrarySection({ label, icon, count, selected = false, errors = 0, initiallyOpen = false, children }: {
  label: string; icon: IconName; count: number; selected?: boolean; errors?: number; initiallyOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();
  return <section className="library-section">
    <h3><button className="library-disclosure" aria-label={label} aria-describedby={`${id}-metadata`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span id={`${id}-metadata`} className="sr-only">{count} items{selected ? ', contains selected item' : ''}{errors ? `, ${errors} models failed to load` : ''}</span>
      <Icon name={icon} /><span>{label}</span><span className="section-count">{count}</span>
      {!open && selected && <span className="section-selected">Selected</span>}
      {errors > 0 && <span className="section-error" role="status">{errors} failed</span>}
      <span className={`disclosure-chevron${open ? ' expanded' : ''}`}><Icon name="chevron" size={16} /></span>
    </button></h3>
    <div id={id} hidden={!open}>{children}</div>
  </section>;
}
