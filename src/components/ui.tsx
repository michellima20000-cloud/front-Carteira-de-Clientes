import { useEffect, type ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/* Cabeçalho de página                                                 */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading page-heading--with-actions">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-heading__actions">{actions}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {(title || actions) && (
        <div className="panel__header">
          <div>
            {title && <h2 className="panel__title">{title}</h2>}
            {description && <p className="panel__description">{description}</p>}
          </div>
          {actions && <div className="panel__actions">{actions}</div>}
        </div>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */

export function Feedback({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <div className={tone === 'error' ? 'error-notice error-notice--simple' : 'success-notice'}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Estado vazio                                                        */
/* ------------------------------------------------------------------ */

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 7h16v12H4z" />
          <path d="M4 11h16" />
        </svg>
      </span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Paginação                                                           */
/* ------------------------------------------------------------------ */
export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return <p className="pagination__info">{total} registro(s)</p>;
  }

  return (
    <div className="pagination">
      <span className="pagination__info">
        Página {page} de {totalPages} · {total} registro(s)
      </span>
      <div className="pagination__controls">
        <button
          className="button button--secondary button--small"
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          Anterior
        </button>
        <button
          className="button button--secondary button--small"
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Utilidades de formatação                                            */
/* ------------------------------------------------------------------ */
