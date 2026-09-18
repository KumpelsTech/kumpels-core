import { useNavigate } from 'react-router-dom'
import type { DelaySignal } from '../utils/delaySignals'
import { listDelaySignals, SEVERITY_TEXT, SEVERITY_TONE } from '../utils/delaySignals'
import { buildWorkItems } from '../utils/workItems'
import { usePersona } from '../utils/personaStore'
import { services } from '../services'
import { Icon } from './Icon'

/**
 * Panel de RETRASOS del Coordinador (§7). Vista transversal de journeys demorados,
 * derivada de `listDelaySignals` (misma fuente que Journey/Nursing — no recalcula).
 * Reutiliza las acciones existentes del Coordinador (escalar) y navega al Journey /
 * a la asignación existente; no inventa un segundo sistema.
 */
export function CoordinatorDelays() {
  const { user, actor } = usePersona()
  const navigate = useNavigate()
  const signals = listDelaySignals(user).filter((s) => s.severity === 'CRITICAL' || s.severity === 'LATE' || s.assignedNotAcked || s.noAssignee)
  if (!signals.length) return null

  const escalate = (s: DelaySignal) => {
    if (!s.workItemId) return
    const item = buildWorkItems().find((i) => i.id === s.workItemId)
    if (item) void services.coordinator.escalate(item, actor())
  }

  return (
    <div className="card cq-delays">
      <div className="section-head">
        <div className="section-title">Retrasos operativos <span className="st-sub">{signals.length} · journeys demorados o sin responsable</span></div>
      </div>
      <div className="cqd-list">
        {signals.map((s) => (
          <div className={`cqd-row ${SEVERITY_TONE[s.severity]}`} key={s.id}>
            <span className={`cqd-sev ${SEVERITY_TONE[s.severity]}`}>{SEVERITY_TEXT[s.severity]}</span>
            <div className="cqd-main">
              <div className="cqd-top">
                <span className="cqd-name">{s.patientName}</span>
                <span className="pq-id mono">{s.patientId}</span>
                <span className="cqd-stage">{s.stageLabel}</span>
              </div>
              <div className="cqd-sub">
                {s.reason}{s.minutesLate > 0 ? ` · Retraso: ${s.minutesLate} min` : ''}
                {s.dueAt ? ` · Programada ${s.dueAt.replace('Hoy ', '')}` : ''}
              </div>
              <div className="cqd-owner">
                <Icon name="users" size={11} /> Responsable · <b>{s.ownerLabel}</b>
                {s.noAssignee ? <span className="cqd-flag crit">Sin responsable asignado</span> : s.assignedNotAcked ? <span className="cqd-flag warn">Asignada, pendiente de aceptación</span> : null}
              </div>
            </div>
            <div className="cqd-act">
              <button type="button" className="btn sm" onClick={() => navigate(`/journeys/${s.patientId}`)}><Icon name="route" size={12} /> Ver Journey</button>
              <button type="button" className="btn sm" onClick={() => navigate(`/today`)}><Icon name="users" size={12} /> Asignar/Reasignar</button>
              <button type="button" className="btn sm" disabled={!s.workItemId} onClick={() => escalate(s)}><Icon name="alert" size={12} /> Escalar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
