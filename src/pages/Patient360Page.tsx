import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ActiveAttention } from '../components/patient/ActiveAttention'
import { FarmacoterapiaTab } from '../components/patient/FarmacoterapiaTab'
import { FollowUpSection } from '../components/patient/FollowUpSection'
import { NextAction } from '../components/patient/NextAction'
import { OperationSection } from '../components/patient/OperationSection'
import { PreparationStatus } from '../components/patient/PreparationStatus'
import { PatientHeader } from '../components/patient/PatientHeader'
import { RecentActivity } from '../components/patient/RecentActivity'
import { getPatient } from '../data/patients'
import { usePersona } from '../utils/personaStore'

/** Deep-link ?tab= (p. ej. desde Revisión Clínica) → sección a la que desplazar. */
const TAB_TO_SECTION: Record<string, string> = {
  resumen: 'ahora', revision: 'atencion', farmacoterapia: 'tratamiento', seguimiento: 'seguimiento', historial: 'actividad',
}

/**
 * Patient 360 — un único workspace clínico continuo. Sin pestañas ni navegación
 * interna: el usuario simplemente desplaza por el contexto del paciente.
 */
export function Patient360Page() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { sees, profile } = usePersona()
  const patient = patientId ? getPatient(patientId) : undefined

  // Deep-link: si llega ?tab=, desplazar suavemente a la sección equivalente.
  useEffect(() => {
    const tab = searchParams.get('tab')
    const target = tab ? TAB_TO_SECTION[tab] : null
    if (target) {
      const t = setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140)
      return () => clearTimeout(t)
    }
  }, [searchParams, patientId])

  if (!patient) {
    return (
      <div className="card" style={{ padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Paciente no encontrado</div>
        <div className="subtle" style={{ margin: '8px auto 18px', maxWidth: '44ch' }}>
          No existe un episodio con el identificador <span className="mono">{patientId}</span>.
        </div>
        <button type="button" className="btn primary" onClick={() => navigate('/patients')}>Ir a Pacientes</button>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <button type="button" className="btn ghost sm" onClick={() => navigate(-1)}>
          <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevR" size={13} /></span>
          Volver
        </button>
        <span className="p360-lens"><Icon name="users" size={12} /> Vista · {profile.short}</span>
      </div>

      {/* Contexto del paciente */}
      <PatientHeader patient={patient} />

      {/* Ahora / próxima acción */}
      <section id="ahora" className="p360-section p360-first">
        <NextAction patient={patient} />
      </section>

      {/* Atención activa (revisión clínica) */}
      {sees('atencion') ? (
        <section id="atencion" className="p360-section">
          <div className="section-lead"><Icon name="stethoscope" size={13} /> Atención activa</div>
          <ActiveAttention patient={patient} />
        </section>
      ) : null}

      {/* Tratamiento (el acceso vive en Operación) */}
      {sees('tratamiento') ? (
        <section id="tratamiento" className="p360-section">
          <div className="section-lead"><Icon name="pill" size={13} /> Tratamiento</div>
          <FarmacoterapiaTab patient={patient} showAccess={false} />
        </section>
      ) : null}

      {/* Operación / estado operativo */}
      {sees('operacion') ? (
        <section id="operacion" className="p360-section">
          <div className="section-lead"><Icon name="box" size={13} /> Operación</div>
          <PreparationStatus patient={patient} />
          <OperationSection patient={patient} />
        </section>
      ) : null}

      {/* Seguimiento farmacoterapéutico */}
      {sees('seguimiento') ? (
        <section id="seguimiento" className="p360-section">
          <div className="section-lead"><Icon name="refresh" size={13} /> Seguimiento farmacoterapéutico</div>
          <FollowUpSection patient={patient} />
        </section>
      ) : null}

      {/* Actividad reciente */}
      {sees('actividad') ? (
        <section id="actividad" className="p360-section">
          <div className="section-lead"><Icon name="clock" size={13} /> Actividad reciente</div>
          <RecentActivity patient={patient} />
        </section>
      ) : null}
    </>
  )
}
