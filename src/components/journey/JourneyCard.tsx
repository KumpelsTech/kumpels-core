import { useNavigate } from 'react-router-dom'
import type { JourneyView, ProcessTrack } from '../../types/journey'
import { CategoryChip, PriorityBadge, Tag } from '../Badge'
import { Icon } from '../Icon'
import { JourneyTimeline } from '../JourneyTimeline'

const STATE_TEXT: Record<ProcessTrack['state'], string> = {
  done: 'Completado', active: 'En curso', warning: 'Requiere atención', blocked: 'Bloqueado', pending: 'Pendiente', na: 'No aplica',
}

function ProcessPill({ p }: { p: ProcessTrack }) {
  return (
    <span className={`ptrack ${p.state}`} title={`${p.name}: ${STATE_TEXT[p.state]}`}>
      <span className="pt-dot" />
      <span className="pt-name">{p.name}</span>
      <span className="pt-state">· {p.note ?? STATE_TEXT[p.state]}</span>
    </span>
  )
}

/** Tarjeta de un episodio de tratamiento (journey). Abre Patient 360 al clic. */
export function JourneyCard({ journey }: { journey: JourneyView }) {
  const navigate = useNavigate()
  const open = () => navigate(`/patients/${journey.patientId}`)

  return (
    <div className="jcard" onClick={open} role="button" tabIndex={0}
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
        {journey.dx ? <Tag icon="drop">{journey.dx}</Tag> : null}
        <Tag icon="pill">{journey.modality}</Tag>
        {journey.protocol ? <Tag icon="shield">{journey.protocol}</Tag> : null}
        {journey.cycleLabel ? <Tag icon="refresh">{journey.cycleLabel}</Tag> : null}
      </div>

      <div className="jc-journey">
        <JourneyTimeline stages={journey.stages} />
      </div>

      {/* Procesos que pueden estar activos de forma independiente */}
      <div className="ptracks" aria-label="Procesos del episodio">
        {journey.processes.map((p) => (
          <ProcessPill key={p.name} p={p} />
        ))}
      </div>

      <div className="jc-foot">
        <div className="jc-next">
          <span className="lbl">Etapa en foco · próxima acción</span>
          <span className="val"><Icon name="arrow" size={14} /> {journey.currentStage} → {journey.next}</span>
          <span className="who">{journey.owner}{journey.due ? ` · ${journey.due}` : ''}</span>
        </div>
        {journey.exception ? (
          <div className={`jc-exc ${journey.exception.kind}`}>
            <span className="exc-ico"><Icon name="alert" size={13} /></span>
            {journey.exception.text}
          </div>
        ) : null}
      </div>
    </div>
  )
}
