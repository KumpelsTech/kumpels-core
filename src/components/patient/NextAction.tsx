import type { Patient } from '../../types/patient'
import { deriveNextAction } from '../../utils/resumen'
import { useReviewStore } from '../../utils/reviewStore'
import { usePreparationStore } from '../../utils/preparationStore'
import { useFulfillmentStore } from '../../utils/fulfillmentStore'
import { useCareStore } from '../../utils/careStore'
import { Icon } from '../Icon'

/**
 * Panel "Próxima acción" — DERIVADO del estado vivo del flujo (revisión,
 * preparación, cumplimiento, seguimiento). Coherente con las pantallas
 * operativas: se actualiza a medida que avanza el workflow. Responde qué / por
 * qué / cuándo / responsable con una sola acción primaria.
 */
export function NextAction({ patient }: { patient: Patient }) {
  // Suscripción a los dominios de los que depende la próxima acción.
  useReviewStore(); usePreparationStore(); useFulfillmentStore(); useCareStore()
  const na = deriveNextAction(patient)

  return (
    <div className="hero-action">
      <div>
        <div className="ha-lbl">Próxima acción</div>
        <div className="ha-title">{na.title}</div>
        <div className="ha-when">
          {na.due ? <span className="hero-pill"><Icon name="clock" size={13} /> {na.due}</span> : null}
          <span className="hero-pill"><Icon name="users" size={13} /> {na.owner}</span>
        </div>
        <div className="ha-reason">{na.reason}</div>
      </div>
      <div className="ha-cta">
        <button type="button" className="btn hero"
          onClick={() => document.getElementById('journey')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {na.verb}
        </button>
        <div className="ha-status"><Icon name="shield" size={13} /> {na.statusNote}</div>
      </div>
    </div>
  )
}
