import type { KeyboardEvent, ReactNode } from 'react';

import './ui.css';
import { LoadingState } from './states';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  hideOnMobile?: boolean;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: ReactNode;
  dense?: boolean;
  caption?: string;
};

export function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, empty, dense, caption }: DataTableProps<T>) {
  if (loading) return <LoadingState />;
  if (!rows.length) return <>{empty ?? null}</>;
  const clickable = Boolean(onRowClick);
  const onKey = (row: T) => (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick?.(row); }
  };
  return (
    <div className={`ui-table-wrap${dense ? ' ui-table-wrap--dense' : ''}`}>
      <table className="ui-table">
        {caption ? <caption className="ui-sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={{ width: c.width, textAlign: c.align }} className={c.hideOnMobile ? 'ui-hide-mobile' : undefined}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={clickable ? 'ui-table__row--clickable' : undefined}
              onClick={clickable ? () => onRowClick?.(row) : undefined}
              onKeyDown={clickable ? onKey(row) : undefined}
              tabIndex={clickable ? 0 : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} style={{ textAlign: c.align }} className={c.hideOnMobile ? 'ui-hide-mobile' : undefined}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
