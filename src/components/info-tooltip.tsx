import { HelpCircle } from 'lucide-react';
import { useId } from 'react';

import './feedback.css';

export function InfoTooltip({ text, label = 'Mais informações' }: { text: string; label?: string }) {
  const id = useId();
  return (
    <span className="info-tooltip">
      <button type="button" className="info-tooltip__trigger" aria-label={label} aria-describedby={id}>
        <HelpCircle size={15} />
      </button>
      <span className="info-tooltip__bubble" role="tooltip" id={id}>{text}</span>
    </span>
  );
}
