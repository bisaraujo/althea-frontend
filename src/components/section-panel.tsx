import type { PropsWithChildren, ReactNode } from 'react';

type SectionPanelProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}>;

export function SectionPanel({ title, eyebrow, action, children }: SectionPanelProps) {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          {eyebrow ? <span className="panel__eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {action ? <div>{action}</div> : null}
      </header>
      <div className="panel__content">{children}</div>
    </section>
  );
}
