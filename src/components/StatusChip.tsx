import { Icon } from './Icon'
import type { IconName } from './Icon'

/**
 * StatusChip — sistema de estado reutilizable (UX-02).
 * Nunca depende solo del color: siempre icono + label + color.
 * Las variantes son semánticas, no cosméticas.
 */
export type StatusKind =
  | 'neutral' | 'info' | 'in_progress' | 'success' | 'warning' | 'critical' | 'blocked'

interface KindMeta { cls: string; icon: IconName | 'dot' }

const META: Record<StatusKind, KindMeta> = {
  neutral:     { cls: 'neutral',  icon: 'dot' },
  info:        { cls: 'info',     icon: 'info' },
  in_progress: { cls: 'progress', icon: 'dot' },   // ● En preparación
  success:     { cls: 'ok',       icon: 'check' }, // ✓ Liberado
  warning:     { cls: 'warn',     icon: 'alert' }, // ! Requiere atención
  critical:    { cls: 'crit',     icon: 'alert' },
  blocked:     { cls: 'blocked',  icon: 'x' },     // × Bloqueado
}

interface StatusChipProps {
  status: StatusKind
  label: string
  /** relleno sólido en vez de tinta suave (para máxima prominencia) */
  solid?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function StatusChip({ status, label, solid = false, size = 'md', className }: StatusChipProps) {
  const meta = META[status]
  const cls = ['chip', meta.cls, solid ? 'solid' : '', size === 'sm' ? 'sm' : '', className]
    .filter(Boolean).join(' ')
  return (
    <span className={cls}>
      {meta.icon === 'dot'
        ? <span className="chip-dot" aria-hidden="true" />
        : <Icon name={meta.icon} size={size === 'sm' ? 11 : 12} className="chip-ico" />}
      {label}
    </span>
  )
}
