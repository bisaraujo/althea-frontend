import type { ReactNode } from 'react';

type StatusPillProps = {
  children?: ReactNode;
  status?: string;
  tone?: 'default' | 'success' | 'warning' | 'muted';
};

export function StatusPill({ children, status, tone = 'default' }: StatusPillProps) {
  const rawValue = children ?? status;
  const value = typeof rawValue === 'string' ? rawValue : '';
  const labels: Record<string, string> = {
    active: 'Ativo', approved: 'Aprovado', archived: 'Arquivado', changes_requested: 'Ajustes solicitados',
    completed: 'Concluído', draft: 'Rascunho', in_review: 'Em revisão', paused: 'Pausado',
    pending: 'Pendente', pending_approval: 'Aguardando aprovação', planned: 'Planejado', published: 'Publicado',
    submitted: 'Enviado', validated: 'Validado', blocked: 'Bloqueado', inactive: 'Inativo',
    employee: 'Colaboradores', manager: 'Gestores', all: 'Todos', company: 'Empresa',
  };
  const inferredTone = ['active', 'approved', 'completed', 'published', 'validated'].includes(value)
    ? 'success'
    : ['draft', 'in_review', 'pending', 'pending_approval', 'planned', 'changes_requested'].includes(value)
      ? 'warning'
      : ['archived', 'inactive'].includes(value) ? 'muted' : tone;
  // So a primeira letra em maiuscula: nomes como "Canal de Integridade" mantem a grafia certa.
  const text = labels[value] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : rawValue);
  return <span className={`status-pill status-pill--${inferredTone}`}>{text}</span>;
}
