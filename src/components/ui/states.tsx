import { AlertTriangle, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import './ui.css';

export function LoadingState({ variant = 'rows', label = 'Carregando...', rows = 3 }: { variant?: 'rows' | 'inline'; label?: string; rows?: number }) {
  if (variant === 'inline') {
    return (
      <div className="ui-loading-inline" role="status" aria-live="polite">
        <span className="ui-spinner" aria-hidden />
        {label}
      </div>
    );
  }
  return (
    <div className="ui-loading-rows" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <span key={i} className="ui-skeleton" style={{ width: `${100 - i * 9}%` }} />)}
    </div>
  );
}

function StateBox({ icon: Icon, title, message, tone, children }: { icon: LucideIcon; title: string; message?: string; tone: 'danger' | 'muted'; children?: ReactNode }) {
  return (
    <div className={`ui-state ui-state--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={24} aria-hidden />
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {children}
    </div>
  );
}

export function ErrorState({ message, title = 'Não foi possível carregar', onRetry, retryLabel = 'Tentar novamente' }: { message?: string; title?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <StateBox icon={AlertTriangle} title={title} message={message} tone="danger">
      {onRetry ? <button type="button" className="secondary-button" onClick={onRetry}>{retryLabel}</button> : null}
    </StateBox>
  );
}

export function NoPermissionState({ title = 'Sem permissão', message = 'Você não tem acesso a este conteúdo. Fale com um administrador se precisar dele.' }: { title?: string; message?: string }) {
  return <StateBox icon={Lock} title={title} message={message} tone="muted" />;
}
