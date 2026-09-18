import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

/**
 * StatTile — métrica compacta (UX-02). Para uso posterior en Hoy,
 * Coordinador y Central de Mezclas. No es clicable por defecto:
 * pásale `onClick` solo cuando la métrica navega a algo.
 */
export type StatTone = 'default' | 'crit' | 'warn' | 'ok' | 'progress'

interface StatTileProps {
  value: ReactNode
  label: string
  unit?: string
  foot?: ReactNode
  icon?: IconName
  tone?: StatTone
  tint?: boolean
  onClick?: () => void
  className?: string
}

export function StatTile({ value, label, unit, foot, icon, tone = 'default', tint, onClick, className }: StatTileProps) {
  const cls = ['stat-tile', tone !== 'default' ? tone : '', tint ? 'tint' : '', className]
    .filter(Boolean).join(' ')
  const interactive = typeof onClick === 'function'
  return (
    <div
      className={cls}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!() } } : undefined}
    >
      <div className="st-top">
        {icon ? <Icon name={icon} size={13} className="st-ico" /> : null}
        <span className="st-k">{label}</span>
      </div>
      <div className="st-v">{value}{unit ? <span className="st-unit">{unit}</span> : null}</div>
      {foot ? <div className="st-foot">{foot}</div> : null}
    </div>
  )
}
