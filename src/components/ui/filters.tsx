import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import './ui.css';

export function FilterBar({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ui-filterbar">
      <div className="ui-filterbar__filters">{children}</div>
      {actions ? <div className="ui-filterbar__actions">{actions}</div> : null}
    </div>
  );
}

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Debounce in ms applied to onChange (0 = immediate). */
  debounceMs?: number;
  label?: string;
};

export function SearchInput({ value, onChange, placeholder = 'Buscar...', debounceMs = 0, label = 'Buscar' }: SearchInputProps) {
  const [local, setLocal] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const push = (next: string) => {
    setLocal(next);
    window.clearTimeout(timer.current);
    if (debounceMs > 0) timer.current = window.setTimeout(() => onChange(next), debounceMs);
    else onChange(next);
  };
  return (
    <div className="ui-search">
      <Search size={15} aria-hidden />
      <input type="text" value={local} placeholder={placeholder} aria-label={label} onChange={(e) => push(e.target.value)} />
      {local ? (
        <button type="button" className="ui-search__clear" aria-label="Limpar busca" onClick={() => push('')}><X size={14} /></button>
      ) : null}
    </div>
  );
}

export type SegmentedOption<V extends string = string> = { value: V; label: string; count?: number };

type SegmentedFilterProps<V extends string> = {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  label?: string;
};

export function SegmentedFilter<V extends string>({ options, value, onChange, label = 'Filtro' }: SegmentedFilterProps<V>) {
  return (
    <div className="ui-segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} className={o.value === value ? 'is-active' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined ? <span>{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
