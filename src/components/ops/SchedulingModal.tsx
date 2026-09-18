import { useEffect, useState } from 'react'
import type { ScheduleChange } from '../../types/fulfillment'
import type { ScheduleInput } from '../../repositories/types'
import { formatDate } from '../../utils/datetime'
import { Icon } from '../Icon'
import { HistoryDrawer, type HistoryEntry } from '../HistoryDrawer'

/**
 * Reprogramación de disponibilidad — control de fecha/hora + motivo. Preserva la
 * fecha previa y el historial de cambios (no sobreescribe).
 */
export function SchedulingModal({
  patientName, currentLabel, history = [], onSave, onClose,
}: {
  patientName: string
  currentLabel?: string
  history?: ScheduleChange[]
  onSave: (change: ScheduleInput) => void
  onClose: () => void
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    if (!date) return
    const [y, m, d] = date.split('-').map(Number)
    const label = formatDate(new Date(y, (m ?? 1) - 1, d ?? 1))
    onSave({ newDate: label, newTime: time || undefined, reason: reason.trim() || undefined })
  }

  const histEntries: HistoryEntry[] = history.map((h) => ({
    id: h.id, when: h.at, title: h.newTime ? `${h.newDate} · ${h.newTime}` : h.newDate,
    transition: h.previousDate ? { from: h.previousDate, to: h.newTime ? `${h.newDate} · ${h.newTime}` : h.newDate } : undefined,
    reason: h.reason, actor: h.actorName ?? h.actorId, role: h.actorRole, tone: 'info' as const,
  })).reverse()

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Reprogramar disponibilidad" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="calendar" size={16} /></span>
          <div>
            <div className="mh-title">Reprogramar disponibilidad</div>
            <div className="mh-sub">{patientName}{currentLabel ? ` · actual: ${currentLabel}` : ''}</div>
          </div>
          {history.length ? (
            <button type="button" className="link-mini" style={{ marginLeft: 'auto', marginRight: 8 }} onClick={() => setShowHistory(true)}>
              <Icon name="clock" size={12} /> Historial ({history.length})
            </button>
          ) : null}
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="two-col">
            <div className="fu-field">
              <label>Nueva fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="fu-field">
              <label>Hora <span className="fu-hint">· opcional</span></label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="fu-field" style={{ marginTop: 14 }}>
            <label>Motivo del cambio <span className="fu-hint">· recomendado</span></label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="p. ej. Reabastecimiento del proveedor" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Se conserva la fecha previa en el historial.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" disabled={!date} onClick={save} style={!date ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Guardar</button>
        </div>
      </div>
      {showHistory ? (
        <HistoryDrawer title="Historial de reprogramaciones" subtitle={patientName} icon="calendar" entries={histEntries} onClose={() => setShowHistory(false)} />
      ) : null}
    </div>
  )
}
