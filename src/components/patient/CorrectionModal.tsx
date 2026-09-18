import { useEffect, useState } from 'react'
import type { MedicationAdministration, AdministrationResult } from '../../types/administration'
import type { CorrectionType } from '../../types/correction'
import type { AdministrationCorrectionInput } from '../../services/administrationService'
import { ADMIN_RESULT_LABEL } from '../../utils/administrationStore'
import { Icon } from '../Icon'
import { Segmented } from '../Segmented'

const TYPES: { value: CorrectionType; label: string }[] = [
  { value: 'DATA_CORRECTION', label: 'Corrección de dato' },
  { value: 'AMENDMENT', label: 'Enmienda' },
  { value: 'ENTERED_IN_ERROR', label: 'Registrado por error' },
]
const RESULTS: { value: AdministrationResult; label: string }[] = [
  { value: 'administrada', label: 'Administrada' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'detenida', label: 'Detenida' },
  { value: 'no-administrada', label: 'No administrada' },
]

/**
 * Corrección CONTROLADA de una administración (no es "Editar"). El registro
 * original se conserva; esta acción crea una corrección trazable con motivo,
 * actor y fecha/hora exactas. "Registrado por error" anula la administración
 * (FHIR entered-in-error) sin borrar el original.
 */
export function CorrectionModal({
  administration, onSave, onClose,
}: {
  administration: MedicationAdministration
  onSave: (input: AdministrationCorrectionInput) => void
  onClose: () => void
}) {
  const [type, setType] = useState<CorrectionType>('DATA_CORRECTION')
  const [result, setResult] = useState<AdministrationResult>(administration.result)
  const [dose, setDose] = useState(administration.dose)
  const [observation, setObservation] = useState(administration.observation ?? '')
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isError = type === 'ENTERED_IN_ERROR'
  const canSave = reason.trim().length > 0
  const save = () => {
    if (!canSave) return
    onSave({
      correctionType: type,
      corrected: isError ? undefined : { result, dose: dose.trim() || undefined, observation: observation.trim() || undefined },
      reason: reason.trim(), comment: comment.trim() || undefined,
    })
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Registrar corrección" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="refresh" size={16} /></span>
          <div>
            <div className="mh-title">Registrar corrección</div>
            <div className="mh-sub">Administración · {administration.medication}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="prev-decision">
            <Icon name="clock" size={12} /> Registro vigente · <b>{ADMIN_RESULT_LABEL[administration.result]}</b> · {administration.dose} · {administration.performerName} · <span className="mono">{administration.at}</span>
            <div className="pd-hint">El registro original se conserva en el historial; esta corrección no lo borra.</div>
          </div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Tipo de corrección</label>
            <Segmented value={type} options={TYPES} onChange={setType} ariaLabel="Tipo" size="sm" />
          </div>
          {!isError ? (
            <>
              <div className="fu-field" style={{ marginBottom: 14 }}>
                <label>Resultado corregido</label>
                <Segmented value={result} options={RESULTS} onChange={setResult} ariaLabel="Resultado" size="sm" />
              </div>
              <div className="fu-field" style={{ marginBottom: 14 }}>
                <label>Dosis corregida</label>
                <input type="text" value={dose} onChange={(e) => setDose(e.target.value)} />
              </div>
              <div className="fu-field" style={{ marginBottom: 14 }}>
                <label>Observación corregida <span className="fu-hint">· opcional</span></label>
                <input type="text" value={observation} onChange={(e) => setObservation(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="coherence-warn" style={{ marginBottom: 14 }}><Icon name="alert" size={13} /> La administración se marcará como registrada por error (anulada). El registro original permanece en el historial.</div>
          )}
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Motivo <span className="fu-hint">· obligatorio</span></label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="p. ej. Dosis registrada por error de digitación" />
          </div>
          <div className="fu-field">
            <label>Comentario <span className="fu-hint">· opcional</span></label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Detalle de la corrección…" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Corrección trazable · actor, fecha y hora exactas. No borra el original.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" disabled={!canSave} onClick={save} style={!canSave ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Guardar corrección</button>
        </div>
      </div>
    </div>
  )
}
