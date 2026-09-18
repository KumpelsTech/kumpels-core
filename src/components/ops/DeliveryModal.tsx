import { useEffect, useState } from 'react'
import type { RecipientType, ReceiptEvidenceType } from '../../types/fulfillment'
import type { DeliveryInput } from '../../repositories/types'
import { CONTACTED_PARTY_LABEL } from '../../utils/fulfillmentStore'
import { Icon } from '../Icon'
import { Segmented } from '../Segmented'

const RECIPIENTS: { value: RecipientType; label: string }[] = [
  { value: 'paciente', label: 'Paciente' }, { value: 'familiar', label: 'Familiar' },
  { value: 'cuidador', label: 'Cuidador' }, { value: 'representante', label: 'Representante' }, { value: 'otro', label: 'Otro' },
]
const EVIDENCE: { value: ReceiptEvidenceType; label: string }[] = [
  { value: 'firma', label: 'Firma' }, { value: 'otp', label: 'OTP' }, { value: 'acuse-electronico', label: 'Acuse electrónico' },
  { value: 'documento', label: 'Documento' }, { value: 'ninguno', label: 'Sin evidencia' },
]

/**
 * Registro de ENTREGA con acuse de recibo. Captura quién recibió realmente y el
 * tipo de evidencia (placeholder — sin firma electrónica todavía). Resuelve el
 * pendiente registrando la recepción (vía válida §8).
 */
export function DeliveryModal({
  patientName, medicationLabel, remaining, unitLabel, onSave, onClose,
}: {
  patientName: string
  medicationLabel: string
  remaining: number
  unitLabel: string
  onSave: (delivery: DeliveryInput) => void
  onClose: () => void
}) {
  const [recipientType, setRecipientType] = useState<RecipientType>('paciente')
  const [recipientName, setRecipientName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [reference, setReference] = useState('')
  const [evidenceType, setEvidenceType] = useState<ReceiptEvidenceType>('firma')
  const [evidenceRef, setEvidenceRef] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const notPatient = recipientType !== 'paciente'
  const save = () => {
    onSave({
      recipientType,
      recipientName: notPatient ? (recipientName.trim() || undefined) : undefined,
      relationship: notPatient ? (relationship.trim() || undefined) : undefined,
      reference: notPatient ? (reference.trim() || undefined) : undefined,
      comment: comment.trim() || undefined,
      deliveredBy: '', // lo asigna el servicio (actor)
      evidence: { type: evidenceType, reference: evidenceRef.trim() || undefined },
    })
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Registrar entrega" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="box" size={16} /></span>
          <div>
            <div className="mh-title">Registrar entrega</div>
            <div className="mh-sub">{patientName} · {remaining} {unitLabel} · {medicationLabel}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Recibe</label>
            <Segmented value={recipientType} options={RECIPIENTS} onChange={setRecipientType} ariaLabel="Recibe" size="sm" />
          </div>
          {notPatient ? (
            <div className="disclose-box">
              <div className="fu-field" style={{ marginBottom: 10 }}>
                <label>Nombre <span className="fu-hint">· {CONTACTED_PARTY_LABEL[recipientType].toLowerCase()}</span></label>
                <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nombre de quien recibe" />
              </div>
              <div className="two-col">
                <div className="fu-field">
                  <label>Parentesco / relación</label>
                  <input type="text" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="p. ej. Esposo" />
                </div>
                <div className="fu-field">
                  <label>Identificación / referencia <span className="fu-hint">· opcional</span></label>
                  <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Documento / referencia" />
                </div>
              </div>
            </div>
          ) : null}
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Evidencia de recepción</label>
            <Segmented value={evidenceType} options={EVIDENCE} onChange={setEvidenceType} ariaLabel="Evidencia" size="sm" />
          </div>
          {evidenceType !== 'ninguno' ? (
            <div className="fu-field" style={{ marginBottom: 14 }}>
              <label>Referencia de evidencia <span className="fu-hint">· opcional</span></label>
              <input type="text" value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} placeholder="p. ej. folio / código OTP" />
            </div>
          ) : null}
          <div className="fu-field">
            <label>Comentario <span className="fu-hint">· opcional</span></label>
            <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nota de la entrega…" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Se registra quién recibió · fecha y hora exactas.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" onClick={save}>Registrar entrega</button>
        </div>
      </div>
    </div>
  )
}
