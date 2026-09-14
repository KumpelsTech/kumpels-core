import type { Patient } from '../../types/patient'
import { useEventStore } from '../../utils/eventStore'
import { projectEvents } from '../../utils/activityProjection'
import { EmptyState } from '../EmptyState'
import { Icon } from '../Icon'

/**
 * Actividad reciente — PROYECTADA desde el EventRepository compartido (no hay un
 * dataset de timeline aparte). Muestra los eventos del paciente, más recientes
 * primero, formateados a español por la capa de proyección.
 */
export function RecentActivity({ patient }: { patient: Patient }) {
  const { eventsForPatient } = useEventStore()
  const activity = projectEvents(eventsForPatient(patient.id, 6))

  if (!activity.length) {
    return (
      <div className="card">
        <EmptyState icon="clock" title="Sin actividad reciente registrada" />
      </div>
    )
  }

  return (
    <div className="card info-card">
      {activity.map((a) => (
        <div className={`act-row2 ${a.tone}`} key={a.id}>
          <span className={`act-ico ${a.tone}`}><Icon name={a.icon} size={13} /></span>
          <div className="act-main">
            <div className="act-title">{a.title}</div>
            {a.summary || a.actor ? (
              <div className="act-sub">{a.summary}{a.summary && a.actor ? ' · ' : ''}{a.actor ?? ''}</div>
            ) : null}
          </div>
          <span className="act-when mono">{a.when}</span>
        </div>
      ))}
    </div>
  )
}
