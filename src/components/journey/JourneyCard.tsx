import { useNavigate } from 'react-router-dom'
import type { EpisodeJourney, StageOwner } from '../../types/journeyStage'
import { CategoryChip, PriorityBadge, Tag } from '../Badge'
import { Icon } from '../Icon'
import { JourneyStepper } from './JourneyStepper'

const JOURNEY_LABEL: Record<EpisodeJourney['journeyType'], string> = {
  'oncology-iv': 'Oncología IV', oral: 'Terapia oral', fulfillment: 'Dispensación',
}
const ownerText = (o?: StageOwner) => {
  if (!o) return '—'
  const un = !o.assignment || o.assignment === 'UNASSIGNED'
  return `${o.label}${un ? ' · Sin asignar' : ''}`
}

/**
 * Tarjeta compacta de un episodio (lista de Journeys). Muestra lo mínimo legible:
 * paciente, tratamiento, progreso horizontal compacto, etapa actual + responsable,
 * próxima acción, indicador de vencimiento/retraso y bloqueo. Abre el detalle.
 */
export function JourneyCard({ journey }: { journey: EpisodeJourney }) {
  const navigate = useNavigate()
  const open = () => navigate(journey.href)
  const cur = journey.currentStage

  return (
    <div className={`jcard ${journey.blocked ? 'blocked' : ''}`} onClick={open} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}>
      <div className="jc-head">
        <div className="jc-idn">
          <span className="jc-name">{journey.patientName}</span>
          <span className="did mono">{journey.patientId}</span>
        </div>
        <div className="jc-badges">
          <CategoryChip category={journey.category} />
          <PriorityBadge priority={journey.priority} />
        </div>
      </div>

      <div className="jc-episode">
        <Tag icon="route">{JOURNEY_LABEL[journey.journeyType]}</Tag>
        {journey.dx ? <Tag icon="drop">{journey.dx}</Tag> : null}
        <Tag icon="pill">{journey.modality}</Tag>
        {journey.protocol ? <Tag icon="shield">{journey.protocol}</Tag> : null}
      </div>

      <div className="jc-journey">
        <JourneyStepper stages={journey.stages} size="sm" />
      </div>

      {/* Fila compacta: etapa actual · responsable · siguiente · próxima acción */}
      <div className="jc-compact">
        <div className="jcx">
          <span className="jcx-k">Etapa actual</span>
          <span className="jcx-v">{cur?.label ?? 'Al día'} <span className="jcx-o">· {ownerText(journey.currentOwner)}</span></span>
        </div>
        <div className="jcx">
          <span className="jcx-k">Siguiente</span>
          <span className="jcx-v">{journey.nextStage?.label ?? 'Cierre'} <span className="jcx-o">· {journey.nextOwner?.label ?? '—'}</span></span>
        </div>
      </div>

      <div className="jc-foot2">
        <span className="jc-na"><Icon name="spark" size={12} /> {journey.nextAction ?? 'Sin acción pendiente'}</span>
        {journey.delay ? (
          <span className={`jc-delay ${journey.delay.severe ? 'severe' : ''}`}><Icon name={journey.delay.severe ? 'alert' : 'clock'} size={11} /> {journey.delay.text}</span>
        ) : cur?.dueAt ? (
          <span className="jc-delay"><Icon name="clock" size={11} /> {cur.dueAt.replace('Hoy ', '')}</span>
        ) : null}
      </div>

      {journey.blocked && cur?.blocker ? (
        <div className="jc-blk-line"><Icon name="alert" size={12} /> {cur.blocker.label}{cur.blocker.responsible ? ` · ${cur.blocker.responsible}` : ''}</div>
      ) : null}
    </div>
  )
}
