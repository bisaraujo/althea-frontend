import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: string | number;
  meta?: string;
  icon?: ReactNode;
};

export function StatCard({ label, value, meta, icon }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        {icon ? <span className="stat-card__icon">{icon}</span> : null}
      </div>
      <strong className="stat-card__value">{value}</strong>
      {meta ? <p className="stat-card__meta">{meta}</p> : null}
    </article>
  );
}
