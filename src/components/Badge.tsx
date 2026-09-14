import type { ReactNode } from 'react'
import type { Category, Priority } from '../types/patient'
import { categoryColors, PRIORITY_META } from '../utils/patient'
import { Icon, type IconName } from './Icon'

type BadgeVariant = 'hi' | 'action' | 'monitor' | 'ok' | 'info' | 'plain'

export function Badge({ variant = 'plain', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return <span className={`badge ${variant}`}>{children}</span>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority]
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>
}

export function CategoryChip({ category }: { category: Category }) {
  const { bg, fg } = categoryColors(category)
  return (
    <span className="cat" style={{ background: bg, color: fg }}>
      {category}
    </span>
  )
}

export function Tag({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <span className="tag">
      {icon ? <span className="t-ico"><Icon name={icon} size={12} /></span> : null}
      {children}
    </span>
  )
}
