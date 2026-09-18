import { useEffect, useState } from 'react'
import type { PreparationOrder } from '../../types/preparation'
import { Icon } from '../Icon'

/**
 * Reemplazo CONTROLADO de una preparación verificada/liberada. No edita la
 * anterior: la marca como reemplazada y crea una nueva con la dosis corregida,
 * conservando la genealogía. Requiere motivo.
 */
export function ReplaceModal({
  order, onSave, onClose,
}: {
  order: PreparationOrder
  onSave: (opts: { reason: string; correctedDose?: string; sourceChange?: string }) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [correctedDose, setCorrectedDose] = useState(order.approvedDose ?? order.prescribedDose)
  const [sourceChange, setSourceChange] = useState('Cambio de tratamiento')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canSave = reason.trim().length > 0
  const save = () => { if (canSave) onSave({ reason: reason.trim(), correctedDose: correctedDose.trim() || undefined, sourceChange: sourceChange.trim() || undefined }) }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Reemplazar preparación" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="refresh" size={16} /></span>
          <div>
            <div className="mh-title">Reemplazar preparación</div>
            <div className="mh-sub">{order.id} · {order.medication}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="coherence-warn" style={{ marginBottom: 14 }}><Icon name="alert" size={13} /> La preparación actual quedará <b>reemplazada</b> (inmutable); se creará una nueva. La genealogía de {order.id} se conserva.</div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Dosis de la nueva preparación</label>
            <input type="text" value={correctedDose} onChange={(e) => setCorrectedDose(e.target.value)} />
          </div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Origen del cambio <span className="fu-hint">· opcional</span></label>
            <input type="text" value={sourceChange} onChange={(e) => setSourceChange(e.target.value)} placeholder="p. ej. Nueva orden médica" />
          </div>
          <div className="fu-field">
            <label>Motivo <span className="fu-hint">· obligatorio</span></label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="p. ej. Ajuste de dosis por peso actualizado" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Reemplazo trazable · conserva la anterior y su genealogía.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" disabled={!canSave} onClick={save} style={!canSave ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Crear reemplazo</button>
        </div>
      </div>
    </div>
  )
}
