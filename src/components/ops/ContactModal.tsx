import { useEffect, useState } from 'react'
import type { ContactMethod, ContactResult, ContactedParty } from '../../types/fulfillment'
import type { ContactInput } from '../../repositories/types'
import type { ContactEntry } from '../../types/fulfillment'
import { CONTACTED_PARTY_LABEL } from '../../utils/fulfillmentStore'
import { Icon } from '../Icon'
import { Segmented } from '../Segmented'
import { HistoryDrawer, type HistoryEntry } from '../HistoryDrawer'

const METHODS: { value: ContactMethod; label: string }[] = [
  { value: 'telefono', label: 'Teléfono' }, { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' }, { value: 'presencial', label: 'Presencial' }, { value: 'otro', label: 'Otro' },
]
const PARTIES: { value: ContactedParty; label: string }[] = [
  { value: 'paciente', label: 'Paciente' }, { value: 'familiar', label: 'Familiar' },
  { value: 'cuidador', label: 'Cuidador' }, { value: 'representante', label: 'Representante' }, { value: 'otro', label: 'Otro' },
]
const RESULTS: { value: ContactResult; label: string }[] = [
  { value: 'contactado', label: 'Contactado' }, { value: 'sin-respuesta', label: 'Sin respuesta' },
  { value: 'reprogramado', label: 'Reprogramado' }, { value: 'reintentar', label: 'Otro intento' }, { value: 'otro', label: 'Otro' },
]

/**
 * Registro de un intento de contacto — método, con quién, resultado y actor.
 * No asume contacto exitoso. Conserva los intentos previos ("Ver historial").
 */
export function ContactModal({
  patientName, previous = [], onSave, onClose,
}: {
  patientName: string
  previous?: ContactEntry[]
  onSave: (entry: ContactInput) => void
  onClose: () => void
}) {
  const [method, setMethod] = useState<ContactMethod>('telefono')
  const [party, setParty] = useState<ContactedParty>('paciente')
  const [outcome, setOutcome] = useState<ContactResult>('contactado')
  const [comment, setComment] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [partyName, setPartyName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [reference, setReference] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const notPatient = party !== 'paciente'
  const save = () => {
    onSave({
      method, party, outcome,
      comment: comment.trim() || undefined,
      nextStep: nextStep.trim() || undefined,
      partyName: notPatient ? (partyName.trim() || undefined) : undefined,
      relationship: notPatient ? (relationship.trim() || undefined) : undefined,
      reference: notPatient ? (reference.trim() || undefined) : undefined,
    })
  }

  const histEntries: HistoryEntry[] = previous.map((c) => ({
    id: c.id, when: c.at, title: `${c.channel} · ${c.result}`, detail: c.nextStep ? `Siguiente: ${c.nextStep}` : undefined,
    actor: c.actorName ?? c.actorId, role: c.actorRole,
    tone: c.outcome === 'contactado' || c.outcome === 'reprogramado' ? 'ok' : 'warn',
  }))

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Registrar contacto" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="phone" size={16} /></span>
          <div>
            <div className="mh-title">Registrar contacto</div>
            <div className="mh-sub">{patientName}</div>
          </div>
          {previous.length ? (
            <button type="button" className="link-mini" style={{ marginLeft: 'auto', marginRight: 8 }} onClick={() => setShowHistory(true)}>
              <Icon name="clock" size={12} /> Intentos ({previous.length})
            </button>
          ) : null}
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Medio</label>
            <Segmented value={method} options={METHODS} onChange={setMethod} ariaLabel="Medio" size="sm" />
          </div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Se contactó a</label>
            <Segmented value={party} options={PARTIES} onChange={setParty} ariaLabel="Contactado" size="sm" />
          </div>
          {notPatient ? (
            <div className="disclose-box">
              <div className="fu-field" style={{ marginBottom: 10 }}>
                <label>Nombre <span className="fu-hint">· {CONTACTED_PARTY_LABEL[party].toLowerCase()}</span></label>
                <input type="text" value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Nombre de quien atendió" />
              </div>
              <div className="two-col">
                <div className="fu-field">
                  <label>Parentesco / relación</label>
                  <input type="text" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="p. ej. Hija" />
                </div>
                <div className="fu-field">
                  <label>Identificación / referencia <span className="fu-hint">· opcional</span></label>
                  <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Documento / referencia" />
                </div>
              </div>
            </div>
          ) : null}
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Resultado</label>
            <Segmented value={outcome} options={RESULTS} onChange={setOutcome} ariaLabel="Resultado" size="sm" />
          </div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Comentario <span className="fu-hint">· opcional</span></label>
            <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Detalle del contacto…" />
          </div>
          <div className="fu-field">
            <label>Próximo paso <span className="fu-hint">· opcional</span></label>
            <input type="text" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="p. ej. Reconfirmar disponibilidad" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Registro operativo trazable · fecha y hora exactas.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" onClick={save}>Guardar contacto</button>
        </div>
      </div>
      {showHistory ? (
        <HistoryDrawer title="Historial de contactos" subtitle={patientName} icon="phone" entries={histEntries.reverse()} onClose={() => setShowHistory(false)} />
      ) : null}
    </div>
  )
}
