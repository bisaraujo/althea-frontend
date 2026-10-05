import { X } from 'lucide-react';
import { useId } from 'react';
import { createPortal } from 'react-dom';

import './ui.css';
import type { OverlayProps } from './modal';
import { useOverlay } from './use-overlay';

export function Drawer({ open, onClose, title, description, footer, size = 'md', children }: OverlayProps) {
  const titleId = useId();
  const descId = useId();
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="ui-overlay ui-overlay--drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside
        ref={ref}
        className={`ui-drawer ui-drawer--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <header className="ui-modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descId}>{description}</p> : null}
          </div>
          <button type="button" className="ui-icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>
        <div className="ui-modal__body ui-drawer__body">{children}</div>
        {footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  );
}
