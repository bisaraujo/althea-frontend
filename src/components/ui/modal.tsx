import { X } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import './ui.css';
import { useOverlay } from './use-overlay';

export type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
};

export function Modal({ open, onClose, title, description, footer, size = 'md', children }: OverlayProps) {
  const titleId = useId();
  const descId = useId();
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="ui-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className={`ui-modal ui-modal--${size}`}
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
        {children ? <div className="ui-modal__body">{children}</div> : null}
        {footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
