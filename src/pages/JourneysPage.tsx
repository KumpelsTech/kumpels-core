import { useMemo, useState } from 'react'
import { JourneyCard } from '../components/journey/JourneyCard'
import { PATIENTS } from '../data/patients'
import { deriveJourney, hasActiveException } from '../utils/journey'
import { PRIORITY_ORDER } from '../utils/patient'

type Segment = 'todos' | 'atencion'

/**
 * Journeys — episodios de tratamiento activos y su avance.
 * Responde "¿cómo avanza este episodio y qué ocurre ahora?".
 * Deriva cada journey del paciente compartido (no es otro directorio).
 */
export function JourneysPage() {
  const [segment, setSegment] = useState<Segment>('todos')

  const journeys = useMemo(() => {
    const source = [...PATIENTS].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    const filtered = segment === 'atencion' ? source.filter(hasActiveException) : source
    return filtered.map(deriveJourney)
  }, [segment])

  const attentionCount = PATIENTS.filter(hasActiveException).length

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Journeys de tratamiento</h1>
          <div className="page-sub">Seguimiento longitudinal de los episodios oncológicos activos y su progresión.</div>
        </div>
        <div className="page-meta">
          <strong>{PATIENTS.length} episodios activos</strong>
          {attentionCount} con excepción
        </div>
      </div>

      <div className="toolbar">
        <div className="subtle">Cada tarjeta muestra el avance del episodio y los procesos activos.</div>
        <div className="seg" role="tablist" aria-label="Filtro de journeys">
          <button type="button" className={segment === 'todos' ? 'on' : ''} onClick={() => setSegment('todos')}>Todos</button>
          <button type="button" className={segment === 'atencion' ? 'on' : ''} onClick={() => setSegment('atencion')}>Requieren atención</button>
        </div>
      </div>

      <div className="jcards">
        {journeys.map((jv) => (
          <JourneyCard key={jv.patientId} journey={jv} />
        ))}
      </div>
    </>
  )
}
