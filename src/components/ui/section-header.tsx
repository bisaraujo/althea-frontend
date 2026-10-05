import type { ReactNode } from 'react';

import { InfoTooltip } from '../info-tooltip';
import './ui.css';

type SectionHeaderProps = {
  title: string;
  info?: string;
  count?: number;
  actions?: ReactNode;
  description?: string;
};

export function SectionHeader({ title, info, count, actions, description }: SectionHeaderProps) {
  return (
    <div className="ui-section-header">
      <div className="ui-section-header__main">
        <div className="ui-section-header__title">
          <h3>{title}</h3>
          {count !== undefined ? <span className="ui-count">{count}</span> : null}
          {info ? <InfoTooltip text={info} /> : null}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ui-section-header__actions">{actions}</div> : null}
    </div>
  );
}
