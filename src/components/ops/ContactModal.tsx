import { useEffect, useState } from 'react'
import type { CommState } from '../../types/fulfillment'
import { Icon } from '../Icon'

const RESULT_TO_STATE: { label: string; state: CommState }[] = [
  { label: 'Contactado', state: 'contactado' },
  { label: 'Paciente informado', state: 'informado' },
  { label: 'Entrega / aplicación coordinada', state: 'coordinado' },
]

/** Registro ligero de contacto con el paciente (no es un CRM). */
export function ContactModal({
  patientName, onSave, onClose,
}: {
  patientName: string
  onSave: (entry: { channel: string; result: string; nextStep?: string }, state: CommState) => void
  onClose: () => void
}) {
  const [channel, setChannel] = useState('Teléfono')
  const [result, setResult] = useState<CommState>('contactado')
  const [note, setNote] = useState('')
  const [nextStep, setNextStep] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    const label = RESULT_TO_STATE.find((r) => r.state === result)?.label ?? 'Contactado'
    onSave({ channel, result: note.trim() || label, nextStep: nextStep.trim() || undefined }, result)
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Registrar contacto" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="phone" size={16} /></span>
          <div>
            <div className="mh-title">Registrar contacto</div>
            <div className="mh-sub">{patientName} · Hoy</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Canal</label>
            <select className="fsel-el" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {['Teléfono', 'WhatsApp', 'Presencial'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Resultado del contacto</label>
            <select className="fsel-el" value={result} onChange={(e) => setResult(e.target.value as CommState)}>
              {RESULT_TO_STATE.map((r) => <option key={r.state} value={r.state}>{r.label}</option>)}
            </select>
          </div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Nota breve <span className="fu-hint">· opcional</span></label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resultado del contacto…" />
          </div>
          <div className="fu-field">
            <label>Próximo paso <span className="fu-hint">· opcional</span></label>
            <input type="text" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="p. ej. Reconfirmar disponibilidad" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Registro operativo ligero.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" onClick={save}>Guardar contacto</button>
        </div>
      </div>
    </div>
  )
}
