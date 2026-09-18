import { useEffect } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * Drawer GENÉRICO de historial ("Ver historial"). Reutilizable por hallazgos,
 * contactos, preparación, lotes, administración… Mantiene Patient 360 continuo
 * (sin nueva pestaña global): el detalle vive en un drawer sobre el objeto.
 *
 * Renderiza entradas append-only más recientes primero. No muta nada.
 */
export type HistoryTone = 'ok' | 'warn' | 'info' | 'plain'

export interface HistoryEntry {
  id: string
  when: string
  title: string
  detail?: string
  actor?: string
  role?: string
  /** Transición previo→nuevo, cuando aplica (correcciones/ediciones). */
  transition?: { from?: string; to: string }
  reason?: string
  tone?: HistoryTone
}

export function HistoryDrawer({
  title, subtitle, icon = 'clock', entries, onClose,
}: {
  title: string
  subtitle?: string
  icon?: IconName
  entries: HistoryEntry[]
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="hist-drawer" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="fu-head">
          <span className="mh-ico"><Icon name={icon} size={17} /></span>
          <div>
            <div className="mh-title">{title}</div>
            {subtitle ? <div className="mh-sub">{subtitle}</div> : null}
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>

        <div className="hist-body">
          {entries.length === 0 ? (
            <div className="subtle" style={{ padding: '8px 2px' }}>Sin registros todavía.</div>
          ) : (
            <div className="hist-list">
              {entries.map((e) => (
                <div className={`hist-entry ${e.tone ?? 'plain'}`} key={e.id}>
                  <span className="he-dot" />
                  <div className="he-main">
                    <div className="he-top">
                      <span className="he-title">{e.title}</span>
                      <span className="he-when mono">{e.when}</span>
                    </div>
                    {e.transition ? (
                      <div className="he-trans">
                        {e.transition.from ? <><span className="he-prev">{e.transition.from}</span> <Icon name="arrow" size={12} /> </> : null}
                        <b>{e.transition.to}</b>
                      </div>
                    ) : null}
                    {e.detail ? <div className="he-detail">{e.detail}</div> : null}
                    {e.reason ? <div className="he-detail">Motivo: {e.reason}</div> : null}
                    {e.actor ? <div className="he-actor"><Icon name="users" size={11} /> {e.actor}{e.role ? ` · ${e.role}` : ''}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fu-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Registro append-only · no se edita ni borra la historia.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cerrar</button>
        </div>
      </aside>
    </div>
  )
}
