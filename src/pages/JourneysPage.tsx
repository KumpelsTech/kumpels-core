import { useState } from 'react'
import { JourneyCard } from '../components/journey/JourneyCard'
import { PATIENTS } from '../data/patients'
import { deriveEpisodeJourney } from '../utils/episodeJourney'
import { PRIORITY_ORDER } from '../utils/patient'
import { useReviewStore } from '../utils/reviewStore'
import { usePreparationStore } from '../utils/preparationStore'
import { useProductionStore } from '../utils/productionStore'
import { useCoordinatorStore } from '../utils/coordinatorStore'
import { useFulfillmentStore } from '../utils/fulfillmentStore'
import { useCareStore } from '../utils/careStore'
import { useAdministrationStore } from '../utils/administrationStore'

type Segment = 'todos' | 'atencion'

/**
 * Journeys — progresión OPERATIVA de cada episodio (no un directorio de pacientes).
 * Cada journey se DERIVA del estado real de los dominios (revisión, producción,
 * preparación, administración, cumplimiento, seguimiento) — no duplica el flujo.
 */
export function JourneysPage() {
  // Suscripción a los dominios de los que se deriva el journey (re-render reactivo).
  useReviewStore(); usePreparationStore(); useProductionStore(); useCoordinatorStore()
  useFulfillmentStore(); useCareStore(); useAdministrationStore()
  const [segment, setSegment] = useState<Segment>('todos')

  const source = [...PATIENTS].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  const journeys = source.map(deriveEpisodeJourney)
  const shown = segment === 'atencion' ? journeys.filter((j) => j.blocked) : journeys
  const attentionCount = journeys.filter((j) => j.blocked).length

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Journeys de tratamiento</h1>
          <div className="page-sub">Progresión operativa de cada episodio: dónde está, qué sigue y quién es responsable.</div>
        </div>
        <div className="page-meta">
          <strong>{journeys.length} episodios activos</strong>
          {attentionCount} bloqueado{attentionCount === 1 ? '' : 's'}
        </div>
      </div>

      <div className="toolbar">
        <div className="subtle">Cada tarjeta proyecta el estado real del episodio y su próximo responsable.</div>
        <div className="seg" role="tablist" aria-label="Filtro de journeys">
          <button type="button" className={segment === 'todos' ? 'on' : ''} onClick={() => setSegment('todos')}>Todos</button>
          <button type="button" className={segment === 'atencion' ? 'on' : ''} onClick={() => setSegment('atencion')}>Bloqueados</button>
        </div>
      </div>

      <div className="jcards">
        {shown.map((jv) => (
          <JourneyCard key={jv.patientId} journey={jv} />
        ))}
      </div>
    </>
  )
}
