import { useEffect, useState } from 'react'
import type { AdministrationResult, RemainderStatus } from '../../types/administration'
import type { AdministrationInput } from '../../repositories/types'
import { stampFromInput } from '../../utils/datetime'
import { REMAINDER_STATUS_LABEL } from '../../utils/administrationStore'
import { Icon } from '../Icon'
import { Segmented } from '../Segmented'

const RESULTS: { value: AdministrationResult; label: string }[] = [
  { value: 'administrada', label: 'Administrada' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'detenida', label: 'Detenida' },
  { value: 'no-administrada', label: 'No administrada' },
]

const REASONS = [
  'Condición clínica', 'Intolerancia / reacción', 'Acceso vascular', 'Dispositivo',
  'Nueva orden médica', 'Traslado', 'Rechazo del paciente', 'Otro',
]
const REMAINDER_OPTS: RemainderStatus[] = ['RETURNED', 'DISCARDED', 'HELD_FOR_REVIEW', 'REUSABLE_PER_POLICY', 'DESTROYED', 'UNKNOWN', 'OTHER']

const numOf = (s: string) => { const m = s.match(/[\d.]+/); return m ? parseFloat(m[0]) : NaN }
const unitOf = (s: string) => { const m = s.match(/[a-zA-Z%]+/); return m ? m[0] : '' }
const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const todayDate = () => new Date().toISOString().slice(0, 10)

/**
 * Registro de administración (enfermería). Distingue NO ADMINISTRADA (nunca
 * inició) de PARCIAL/DETENIDA (inició pero no completó). Para infusión captura
 * planificado vs administrado vs remanente + disposición del remanente. Crea una
 * MedicationAdministration canónica; no genera evento adverso (tarea futura).
 */
export function AdministrationDrawer({
  context, onSave, onClose,
}: {
  context: {
    patientId: string; patientName: string; preparationOrderId?: string; medicationOrderId?: string
    medication: string; dose: string; route: string; scheduledAt?: string; preparationRef?: string; lotReference?: string
  }
  onSave: (input: AdministrationInput) => void
  onClose: () => void
}) {
  const [result, setResult] = useState<AdministrationResult>('administrada')
  const [startTime, setStartTime] = useState(nowTime())
  const [endTime, setEndTime] = useState(nowTime())
  const [reasonCode, setReasonCode] = useState(REASONS[0])
  const [reasonOther, setReasonOther] = useState('')
  const [observation, setObservation] = useState('')
  const [planned, setPlanned] = useState(context.dose)
  const [administered, setAdministered] = useState('')
  const [remStatus, setRemStatus] = useState<RemainderStatus>('HELD_FOR_REVIEW')
  const [remComment, setRemComment] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const started = result !== 'no-administrada'
  const partial = result === 'parcial' || result === 'detenida'
  const needsReason = result !== 'administrada'
  const reasonText = reasonCode === 'Otro' ? reasonOther.trim() : reasonCode
  const canSave = !needsReason || (reasonCode !== 'Otro' || reasonOther.trim().length > 0)

  const pn = numOf(planned), an = numOf(administered)
  const remainingCalc = partial && !Number.isNaN(pn) && !Number.isNaN(an) ? `${Math.max(0, +(pn - an).toFixed(2))} ${unitOf(planned)}`.trim() : undefined

  const save = () => {
    if (!canSave) return
    const date = todayDate()
    onSave({
      patientId: context.patientId, preparationOrderId: context.preparationOrderId, medicationOrderId: context.medicationOrderId,
      medication: context.medication, dose: context.dose, route: context.route,
      preparationRef: context.preparationRef, lotReference: context.lotReference, scheduledAt: context.scheduledAt,
      startedAt: started ? stampFromInput(date, startTime).label : undefined,
      completedAt: result === 'administrada' ? stampFromInput(date, endTime).label : undefined,
      stoppedAt: partial ? stampFromInput(date, endTime).label : undefined,
      plannedVolume: partial ? planned.trim() || undefined : undefined,
      administeredVolume: partial ? administered.trim() || undefined : undefined,
      remainingVolume: remainingCalc,
      remainder: partial ? { quantity: remainingCalc, status: remStatus, comment: remComment.trim() || undefined } : undefined,
      result,
      reason: needsReason ? reasonText : undefined,
      observation: observation.trim() || undefined,
    })
  }

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="fu-drawer" role="dialog" aria-modal="true" aria-label="Registrar administración" onClick={(e) => e.stopPropagation()}>
        <div className="fu-head">
          <span className="mh-ico"><Icon name="syringe" size={17} /></span>
          <div>
            <div className="mh-title">Registrar administración</div>
            <div className="mh-sub">{context.patientName} · {context.patientId}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>

        <div className="fu-body">
          <div className="fu-prefill">
            <div className="fp-head"><Icon name="pill" size={13} /> Tratamiento a administrar</div>
            <div className="fp-chips">
              <div className="fp-chip">Medicamento: <b>{context.medication}</b></div>
              <div className="fp-chip">Dosis: <b>{context.dose}</b></div>
              <div className="fp-chip">Vía: <b>{context.route}</b></div>
              {context.scheduledAt ? <div className="fp-chip">Programada: <b>{context.scheduledAt}</b></div> : null}
              {context.preparationRef ? <div className="fp-chip">Preparación: <b>{context.preparationRef}</b></div> : null}
              {context.lotReference ? <div className="fp-chip">Lote: <b>{context.lotReference}</b></div> : null}
            </div>
          </div>

          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Resultado</label>
            <Segmented value={result} options={RESULTS} onChange={setResult} ariaLabel="Resultado" size="sm" />
            {result === 'no-administrada' ? <div className="fu-hint" style={{ marginTop: 4 }}>Nunca inició.</div> : partial ? <div className="fu-hint" style={{ marginTop: 4 }}>Inició pero no se completó.</div> : null}
          </div>

          {started ? (
            <div className="two-col">
              <div className="fu-field">
                <label>Hora de inicio</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="fu-field">
                <label>{result === 'administrada' ? 'Hora de finalización' : 'Hora de detención'}</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          ) : null}

          {partial ? (
            <div className="disclose-box" style={{ marginTop: 14 }}>
              <div className="two-col">
                <div className="fu-field"><label>Dosis/volumen planificado</label><input type="text" value={planned} onChange={(e) => setPlanned(e.target.value)} /></div>
                <div className="fu-field"><label>Administrado</label><input type="text" value={administered} onChange={(e) => setAdministered(e.target.value)} placeholder="p. ej. 60 mL" /></div>
              </div>
              <div className="fu-field" style={{ marginTop: 10 }}>
                <label>Remanente</label>
                <div className="rem-calc">{remainingCalc ?? 'Se calcula al indicar planificado y administrado'}</div>
              </div>
              <div className="two-col" style={{ marginTop: 10 }}>
                <div className="fu-field">
                  <label>Disposición del remanente</label>
                  <select className="fsel-el" value={remStatus} onChange={(e) => setRemStatus(e.target.value as RemainderStatus)}>
                    {REMAINDER_OPTS.map((o) => <option key={o} value={o}>{REMAINDER_STATUS_LABEL[o]}</option>)}
                  </select>
                </div>
                <div className="fu-field"><label>Nota del remanente <span className="fu-hint">· opcional</span></label><input type="text" value={remComment} onChange={(e) => setRemComment(e.target.value)} /></div>
              </div>
            </div>
          ) : null}

          {needsReason ? (
            <>
              <div className="fu-field" style={{ marginTop: 14 }}>
                <label>Motivo</label>
                <select className="fsel-el" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                  {REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              {reasonCode === 'Otro' ? (
                <div className="fu-field" style={{ marginTop: 10 }}>
                  <label>Especificar <span className="fu-hint">· obligatorio</span></label>
                  <input type="text" value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} />
                </div>
              ) : null}
            </>
          ) : null}

          <div className="fu-field" style={{ marginTop: 14 }}>
            <label>Observación <span className="fu-hint">· opcional</span></label>
            <textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Nota de enfermería…" />
          </div>
          <div className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="shield" size={12} /> El registro no genera un evento adverso automáticamente.</div>
        </div>

        <div className="fu-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Se registra con actor, fecha y hora exactas. Trazable y auditable.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" disabled={!canSave} onClick={save} style={!canSave ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Guardar</button>
        </div>
      </aside>
    </div>
  )
}
