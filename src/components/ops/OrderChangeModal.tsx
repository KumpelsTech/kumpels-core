import { useEffect, useState } from 'react'
import type { OrderChangeType } from '../../types/orderChange'
import { Icon } from '../Icon'
import { Segmented } from '../Segmented'

const TYPES: { value: OrderChangeType; label: string }[] = [
  { value: 'MODIFIED', label: 'Modificar' }, { value: 'SUSPENDED', label: 'Suspender' },
  { value: 'CANCELLED', label: 'Cancelar' }, { value: 'REPLACED', label: 'Reemplazar' },
]

/**
 * Registro de cambio de orden de medicación. Requiere capacidad
 * MEDICATION_ORDER_CHANGE. Dispara la evaluación de impacto aguas abajo.
 */
export function OrderChangeModal({
  orderId, medication, onSave, onClose,
}: {
  orderId: string
  medication: string
  onSave: (input: { changeType: OrderChangeType; reason: string }) => void
  onClose: () => void
}) {
  const [changeType, setChangeType] = useState<OrderChangeType>('MODIFIED')
  const [reason, setReason] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const canSave = reason.trim().length > 0
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Cambio de orden" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="refresh" size={16} /></span>
          <div>
            <div className="mh-title">Registrar cambio de orden</div>
            <div className="mh-sub">{orderId} · {medication}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="coherence-warn" style={{ marginBottom: 14 }}><Icon name="alert" size={13} /> El cambio evaluará automáticamente el impacto sobre preparación, entrega y administración aguas abajo.</div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Tipo de cambio</label>
            <Segmented value={changeType} options={TYPES} onChange={setChangeType} ariaLabel="Tipo de cambio" size="sm" />
          </div>
          <div className="fu-field">
            <label>Motivo <span className="fu-hint">· obligatorio</span></label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="p. ej. Ajuste de dosis por función renal" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Cambio trazable · evalúa el trabajo aguas abajo.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" disabled={!canSave} onClick={() => canSave && onSave({ changeType, reason: reason.trim() })} style={!canSave ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Registrar cambio</button>
        </div>
      </div>
    </div>
  )
}
