import type { ReactNode } from 'react';

import './ui.css';

type EntityRowProps = {
  /** Icon or avatar node; always rendered in a fixed 36px column. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Badges/status shown before the actions. */
  badges?: ReactNode;
  /** Buttons; right-aligned. */
  actions?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
};

export function EntityRow({ leading, title, subtitle, badges, actions, onClick, selected, className }: EntityRowProps) {
  const clickable = Boolean(onClick);
  return (
    <div
      className={`ui-entity${clickable ? ' ui-entity--clickable' : ''}${selected ? ' is-selected' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.(); } } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <span className="ui-entity__leading">{leading}</span>
      <span className="ui-entity__copy">
        <strong className="ui-entity__title">{title}</strong>
        {subtitle ? <span className="ui-entity__subtitle">{subtitle}</span> : null}
      </span>
      {badges ? <span className="ui-entity__badges">{badges}</span> : null}
      {actions ? <span className="ui-entity__actions" onClick={(e) => e.stopPropagation()}>{actions}</span> : null}
    </div>
  );
}

/** Vertical stack of EntityRows with consistent gap. */
export function EntityList({ children }: { children: ReactNode }) {
  return <div className="ui-entity-list">{children}</div>;
}

export { EntityRow as EntityCard };
