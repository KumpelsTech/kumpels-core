import type { ReactNode } from 'react'

/**
 * PageHeader — encabezado de página reutilizable (UX-03).
 * Título display + subtítulo/contexto + acción primaria contextual opcional.
 * Las páginas lo adoptarán en tareas UX posteriores; sin CTA innecesario.
 */
interface PageHeaderProps {
  title: ReactNode
  sub?: ReactNode
  /** acción primaria contextual (solo cuando es válida) */
  action?: ReactNode
  /** acción secundaria opcional */
  secondary?: ReactNode
  /** meta a la derecha (p. ej. reloj / contador) cuando no hay acción */
  meta?: ReactNode
}

export function PageHeader({ title, sub, action, secondary, meta }: PageHeaderProps) {
  return (
    <header className="page-head">
      <div className="ph-main">
        <h1 className="page-title">{title}</h1>
        {sub ? <div className="page-sub">{sub}</div> : null}
      </div>
      {(action || secondary || meta) ? (
        <div className="ph-actions">
          {meta ? <div className="page-meta">{meta}</div> : null}
          {secondary}
          {action}
        </div>
      ) : null}
    </header>
  )
}
