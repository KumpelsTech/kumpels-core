import { useEffect, useState } from 'react'
import type { RejectionReasonDef } from '../../config/rejectionReasons'
import { REJECTION_REASONS } from '../../config/rejectionReasons'
import { Icon } from '../Icon'

/**
 * Rechazo de Enfermería sobre una preparación liberada (barrera final). Motivo
 * estructurado; comentario obligatorio si "Otro". No cancela la preparación: la
 * pone en HOLD y enruta la resolución al equipo responsable según el motivo.
 */
export function RejectionModal({
  medication, patientName, onSave, onClose,
}: {
  medication: string
  patientName: string
  onSave: (reason: RejectionReasonDef, comment?: string) => void
  onClose: () => void
}) {
  const [code, setCode] = useState(REJECTION_REASONS[0].code)
  const [comment, setComment] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const def = REJECTION_REASONS.find((r) => r.code === code)!
  const needsComment = code === 'otro'
  const canSave = !needsComment || comment.trim().length > 0

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Rechazar preparación" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="alert" size={16} /></span>
          <div>
            <div className="mh-title">Rechazar / No aceptar preparación</div>
            <div className="mh-sub">{patientName} · {medication}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="coherence-warn" style={{ marginBottom: 14 }}><Icon name="shield" size={13} /> Enfermería es la barrera final. La preparación no se administra; pasa a espera y se genera trabajo de resolución para <b>{def.ownerLabel}</b>.</div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Motivo del rechazo</label>
            <select className="fsel-el" value={code} onChange={(e) => setCode(e.target.value as typeof code)}>
              {REJECTION_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </div>
          <div className="fu-field">
            <label>Comentario {needsComment ? <span className="fu-hint">· obligatorio</span> : <span className="fu-hint">· opcional</span>}</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Detalle del hallazgo…" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Rechazo trazable · enfermera, fecha y hora exactas.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" disabled={!canSave} onClick={() => canSave && onSave(def, comment.trim() || undefined)} style={!canSave ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Registrar rechazo</button>
        </div>
      </div>
    </div>
  )
}
