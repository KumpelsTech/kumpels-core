import type { HTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

/**
 * Card / Surface — contenedor base (UX-02). Superficie blanca, borde
 * sutil, radio 10px, sin sombra en reposo. Para anidar, preferir
 * `level` (surface-low / surface-high) en vez de tarjeta-dentro-de-tarjeta.
 */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  level?: 'base' | 'low' | 'high'
  elevation?: 0 | 1 | 2 | 3
  children?: ReactNode
}

export function Card({ level = 'base', elevation = 0, className, children, ...rest }: CardProps) {
  const levelCls = level === 'low' ? 'surface-low' : level === 'high' ? 'surface-high' : 'surface'
  const cls = [levelCls, elevation ? `elev-${elevation}` : '', className].filter(Boolean).join(' ')
  return <div className={cls} {...rest}>{children}</div>
}

interface CardHeaderProps {
  title: ReactNode
  icon?: IconName
  sub?: ReactNode
  right?: ReactNode
}

/** Encabezado de sección reutilizable (icono + título display + meta a la derecha). */
export function CardHeader({ title, icon, sub, right }: CardHeaderProps) {
  return (
    <div className="section-head">
      <div className="section-title">
        {icon ? <Icon name={icon} size={16} /> : null}
        {title}
        {sub ? <span className="st-sub">{sub}</span> : null}
      </div>
      {right ? <div className="subtle">{right}</div> : null}
    </div>
  )
}
