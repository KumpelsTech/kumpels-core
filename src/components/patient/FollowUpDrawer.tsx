import { useEffect, useState } from 'react'
import type { Patient } from '../../types/patient'
import type { FollowUpAssessment, PharmaceuticalCareEnrollment } from '../../types/careFollowup'
import { getTherapy } from '../../data/therapy'
import { Icon } from '../Icon'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="fu-field">
      <label>{label}{hint ? <span className="fu-hint"> · {hint}</span> : null}</label>
      {children}
    </div>
  )
}

/**
 * Drawer de seguimiento farmacoterapéutico. Kumpels precarga el contexto conocido
 * y el profesional confirma/completa solo lo relevante. Sirve también como
 * "Entrevista inicial" (mismo modelo, estado inicial). No es una intervención.
 */
export function FollowUpDrawer({
  patient, enrollment, existing, reviewer, onSave, onClose,
}: {
  patient: Patient
  enrollment: PharmaceuticalCareEnrollment
  existing?: FollowUpAssessment
  reviewer: string
  onSave: (a: FollowUpAssessment) => void
  onClose: () => void
}) {
  const t = getTherapy(patient.id)
  const initial = enrollment.mode === 'entrevista-inicial'
  const selfAdmin = patient.modality === 'Oral' || patient.modality === 'SC'
  const adherWarn = enrollment.domains.find((x) => x.key === 'adherencia')?.state === 'warn'

  const accesoDefault =
    patient.category === 'PENDIENTE' ? 'Dispensación pendiente'
      : patient.category === 'AUTORIZACIÓN' ? 'Autorización pendiente'
        : patient.category === 'REABASTECIMIENTO' ? 'Reabastecimiento pendiente' : 'Ninguna'

  const [continuidad, setContinuidad] = useState(existing?.continuidad ?? (initial ? 'Inicia tratamiento' : 'Activo'))
  const [uso, setUso] = useState(existing?.usoReportado ?? (adherWarn ? 'Uso no confirmado' : 'Sin omisiones reportadas'))
  const [seguridad, setSeguridad] = useState(existing?.seguridad ?? '')
  const [cambios, setCambios] = useState(existing?.cambios ?? (/cambio/i.test(patient.status) ? 'Cambio de esquema (06 Sep)' : 'Sin cambios'))
  const [acceso, setAcceso] = useState(existing?.acceso ?? accesoDefault)
  const [observation, setObservation] = useState(existing?.observation ?? '')
  const [next, setNext] = useState(existing?.nextFollowUp ?? (initial ? 'Programar primer ciclo · seguimiento en 14 días' : enrollment.nextFollowUp))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const needsReview = seguridad.trim().length > 0
  const save = () => {
    onSave({
      patientId: patient.id, mode: enrollment.mode, at: 'Hoy', by: reviewer,
      continuidad, usoReportado: selfAdmin ? uso : undefined, seguridad: seguridad.trim() || undefined,
      cambios, acceso, observation: observation.trim() || undefined, nextFollowUp: next, needsProfessionalReview: needsReview,
    })
  }

  const prefillMeds = t ? t.medications.map((m) => m.name).join(' + ') : patient.med
  const prefillAccess = t?.access?.availability ?? patient.auth.status

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="fu-drawer" role="dialog" aria-modal="true" aria-label="Seguimiento farmacoterapéutico" onClick={(e) => e.stopPropagation()}>
        <div className="fu-head">
          <span className="mh-ico"><Icon name="refresh" size={17} /></span>
          <div>
            <div className="mh-title">{initial ? 'Entrevista inicial' : 'Seguimiento farmacoterapéutico'}</div>
            <div className="mh-sub">{patient.name} · {patient.id}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>

        <div className="fu-body">
          <div className="fu-prefill">
            <div className="fp-head"><Icon name="spark" size={13} /> Kumpels preparó este {initial ? 'onboarding' : 'seguimiento'}</div>
            <div className="fp-chips">
              <div className="fp-chip">Tratamiento: <b>{prefillMeds}</b></div>
              <div className="fp-chip">Último contacto: <b>{enrollment.lastAssessment ?? 'sin contacto previo'}</b></div>
              <div className="fp-chip">Contexto clínico: <b>{patient.clinical.labs ?? '—'}</b></div>
              <div className="fp-chip">Acceso: <b>{prefillAccess}</b></div>
            </div>
          </div>

          <div className="mb-lead"><Icon name="stethoscope" size={13} /> Confirma solo lo relevante</div>

          <Field label="Continuidad del tratamiento">
            <select className="fsel-el" value={continuidad} onChange={(e) => setContinuidad(e.target.value)}>
              {(initial ? ['Inicia tratamiento'] : ['Activo', 'En pausa', 'Interrumpido']).map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>

          {selfAdmin ? (
            <Field label="Uso / dosis omitidas" hint="reportado por el paciente">
              <select className="fsel-el" value={uso} onChange={(e) => setUso(e.target.value)}>
                {['Sin omisiones reportadas', 'Algunas omisiones', 'Uso no confirmado'].map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
          ) : null}

          <Field label="Síntomas o problemas de seguridad" hint="reportado por el paciente">
            <textarea value={seguridad} onChange={(e) => setSeguridad(e.target.value)} placeholder="Ninguno reportado — o describe el síntoma/problema…" />
          </Field>

          <Field label="Cambios de medicamentos">
            <input type="text" value={cambios} onChange={(e) => setCambios(e.target.value)} />
          </Field>

          <Field label="Barreras de acceso">
            <select className="fsel-el" value={acceso} onChange={(e) => setAcceso(e.target.value)}>
              {['Ninguna', 'Dispensación pendiente', 'Autorización pendiente', 'Reabastecimiento pendiente', 'Otra'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Observación profesional">
            <textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Nota breve del seguimiento…" />
          </Field>

          <Field label="Próximo seguimiento">
            <input type="text" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>

          {needsReview ? (
            <div className="mini-warn"><Icon name="alert" size={13} /> Se registrará como <b>Revisión profesional requerida</b> por el síntoma reportado.</div>
          ) : null}
        </div>

        <div className="fu-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Lo reportado por el paciente queda identificado como tal. Kumpels no toma decisiones de tratamiento.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" onClick={save}>Guardar seguimiento</button>
        </div>
      </aside>
    </div>
  )
}
