import { HelpCircle } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import './feedback.css';

const BUBBLE_WIDTH = 260;
const EDGE = 12;

/**
 * "?" com explicacao. Abre ao passar o mouse, ao focar pelo teclado ou com um toque (celular).
 * O balao so existe aberto e e posicionado dentro da tela, entao nunca cria rolagem lateral.
 */
export function InfoTooltip({ text, label = 'Mais informações' }: { text: string; label?: string }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  function open() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(BUBBLE_WIDTH, window.innerWidth - EDGE * 2);
    const centered = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(EDGE, Math.min(centered, window.innerWidth - width - EDGE));
    setPosition({ top: rect.bottom + 8, left });
  }
  function close() {
    setPosition(null);
  }

  useEffect(() => {
    if (!position) return;
    const dismiss = (event: Event) => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
      if (event.type === 'pointerdown' && triggerRef.current?.contains(event.target as Node)) return;
      close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [position]);

  return (
    <span className="info-tooltip" onMouseEnter={open} onMouseLeave={close}>
      <button
        ref={triggerRef}
        type="button"
        className="info-tooltip__trigger"
        aria-label={label}
        aria-describedby={position ? id : undefined}
        aria-expanded={Boolean(position)}
        onFocus={open}
        onBlur={close}
        onClick={() => (position ? close() : open())}
      >
        <HelpCircle size={15} />
      </button>
      {position ? (
        <span className="info-tooltip__bubble" role="tooltip" id={id} style={{ top: position.top, left: position.left, maxWidth: Math.min(BUBBLE_WIDTH, window.innerWidth - EDGE * 2) }}>
          {text}
        </span>
      ) : null}
    </span>
  );
}
