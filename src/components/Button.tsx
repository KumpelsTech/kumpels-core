import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

/**
 * Button — primitiva de acción (UX-02) sobre las clases `.btn`.
 * Variantes semánticas; la primaria es el azul de acción #274AFE.
 * Envuelve el patrón existente sin romper los usos de `.btn` en las páginas.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  block?: boolean
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'secondary', size = 'md', icon, block, loading, disabled,
  className, children, ...rest
}: ButtonProps) {
  const cls = [
    'btn', variant,
    size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : '',
    block ? 'block' : '', loading ? 'loading' : '', className,
  ].filter(Boolean).join(' ')
  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="btn-spin" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
      {children}
    </button>
  )
}
