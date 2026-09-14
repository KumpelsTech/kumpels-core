import { Icon, type IconName } from './Icon'

/**
 * Estado vacío compartido — patrón único, calmado y consistente para "no hay …".
 * Evita mensajes ad-hoc con estilos distintos por pantalla.
 */
export function EmptyState({ icon = 'check', title, hint }: { icon?: IconName; title: string; hint?: string }) {
  return (
    <div className="empty">
      <span className="empty-ico"><Icon name={icon} size={17} /></span>
      <div>
        <div className="empty-title">{title}</div>
        {hint ? <div className="empty-hint">{hint}</div> : null}
      </div>
    </div>
  )
}
