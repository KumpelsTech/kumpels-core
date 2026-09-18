import { useNavigate, useParams } from 'react-router-dom'
import { getPatient } from '../data/patients'
import { EpisodeJourneyView } from '../components/journey/EpisodeJourneyView'
import { CategoryChip, PriorityBadge, Tag } from '../components/Badge'
import { Icon } from '../components/Icon'

/**
 * Detalle de Journey — una sola vista operativa continua (sin pestañas):
 * contexto del paciente → journey horizontal → etapa actual/siguiente → bloqueos →
 * WorkItems → actividad. Comparte la proyección con Patient 360.
 */
export function JourneyDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const patient = patientId ? getPatient(patientId) : undefined

  if (!patient) {
    return (
      <div className="card" style={{ padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Episodio no encontrado</div>
        <button type="button" className="btn primary" style={{ marginTop: 16 }} onClick={() => navigate('/journeys')}>Ir a Journeys</button>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <button type="button" className="btn ghost sm" onClick={() => navigate('/journeys')}>
          <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevR" size={13} /></span>
          Journeys
        </button>
        <button type="button" className="btn sm" onClick={() => navigate(`/patients/${patient.id}`)}>Abrir Patient 360 <Icon name="chevR" size={12} /></button>
      </div>

      {/* Contexto del paciente / episodio */}
      <div className="card jd-context">
        <div className="jd-idn">
          <span className="jd-name">{patient.name}</span>
          <span className="did mono">{patient.id}</span>
          <CategoryChip category={patient.category} />
          <PriorityBadge priority={patient.priority} />
        </div>
        <div className="jd-tags">
          {patient.dx ? <Tag icon="drop">{patient.dx}</Tag> : null}
          <Tag icon="pill">{patient.modality}</Tag>
          {patient.protocol ? <Tag icon="shield">{patient.protocol}</Tag> : null}
          {patient.cycle && patient.cycle !== 'Continuo' ? <Tag icon="refresh">Ciclo {patient.cycle}</Tag> : null}
          <Tag icon="home">{patient.facility}</Tag>
        </div>
      </div>

      {/* Journey operativo continuo */}
      <div className="card">
        <EpisodeJourneyView patient={patient} />
      </div>
    </>
  )
}
