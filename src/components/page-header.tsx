import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** Cabecalho da pagina: direto no fundo (sem cartao), com rotulo, titulo, descricao e acoes opcionais. */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="tr-page-header">
      <div className="tr-page-header__copy">
        {eyebrow ? <span className="tr-page-header__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="tr-page-header__actions">{actions}</div> : null}
    </header>
  );
}
