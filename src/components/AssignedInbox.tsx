import { useNavigate } from 'react-router-dom'
import type { WorkItem } from '../types/work'
import { useCoordinatorStore } from '../utils/coordinatorStore'
import { usePersona } from '../utils/personaStore'
import { buildPriorityQueue, LEVEL_TONE, slaMinutesOf } from '../utils/priorityQueue'
import { hasCapability } from '../utils/eligibility'
import { acceptProductionRequest } from '../utils/productionActions'
import { services } from '../services'
import { Icon } from './Icon'

const LEVEL_ES: Record<string, string> = { 'CRÍTICO': 'CRÍTICA', ALTA: 'ALTA', MEDIA: 'MEDIA', BAJA: 'BAJA' }

/**
 * Bandeja "ASIGNADO A TI" — el trabajo delegado explícitamente al usuario activo.
 * Muestra qué, por qué, prioridad (la misma de la cola), vencimiento, quién asignó
 * y cuándo. "Tomar tarea" registra el acuse (ASSIGNED → ACKNOWLEDGED).
 */
export function AssignedInbox({ items }: { items: WorkItem[] }) {
  const { assignmentsForUser } = useCoordinatorStore()
  const { userId, user, actor } = usePersona()
  const navigate = useNavigate()

  const mine = assignmentsForUser(userId)
  if (!mine.length) return null
  const byId = new Map(items.map((i) => [i.id, i]))

  return (
    <div className="card inbox">
      <div className="section-head">
        <div className="section-title"><Icon name="users" size={14} /> Asignado a ti <span className="st-sub">{mine.length}</span></div>
      </div>
      <div className="inbox-list">
        {mine.map((a) => {
          const item = byId.get(a.workItemId)
          if (!item) return null
          const pr = buildPriorityQueue([item])[0]
          const sla = slaMinutesOf(item)
          const acked = a.status === 'acknowledged' || a.status === 'in-progress'
          // Aceptación del handoff de producción (Central de Mezclas).
          const canAccept = item.actionKey === 'aceptar-solicitud' && !!item.refId && !!user && hasCapability(user, 'PRODUCTION_REQUEST_ACCEPT')
          const isSend = item.actionKey === 'enviar-produccion'
          return (
            <div className={`inbox-card ${LEVEL_TONE[pr.level]}`} key={a.workItemId}>
              <div className="ib-top">
                <span className={`pqc-level ${LEVEL_TONE[pr.level]}`}>{LEVEL_ES[pr.level] ?? pr.level}</span>
                <span className="ib-name">{item.patientName}</span>
                {item.patientId ? <span className="pq-id mono">{item.patientId}</span> : null}
                {acked ? <span className="ib-ack"><Icon name="check" size={11} /> Tomada</span> : null}
              </div>
              <div className="ib-what">{item.nextAction} · {item.statusLabel}</div>
              {a.instruction ? <div className="ib-why"><Icon name="doc" size={11} /> {a.instruction}</div> : null}
              <div className="ib-meta">
                {a.dueAt ? <span><Icon name="clock" size={11} /> Vence: {a.dueAt}</span> : null}
                {sla != null && sla >= 0 ? <span className="ib-sla">Tiempo restante: {sla} min</span> : null}
                <span><Icon name="users" size={11} /> Asignado por: {a.assignedByName ?? '—'}</span>
                {a.assignedAt ? <span className="mono">{a.assignedAt}</span> : null}
              </div>
              <div className="ib-actions">
                {!acked ? (
                  <button type="button" className="btn sm primary" onClick={() => { void services.coordinator.acknowledge(item, actor()) }}>Tomar tarea</button>
                ) : null}
                {canAccept ? (
                  <button type="button" className="btn sm primary" onClick={() => { if (item.refId && item.patientId) void acceptProductionRequest(item.refId, item.patientId, actor()) }}>
                    <Icon name="check" size={12} /> Aceptar solicitud
                  </button>
                ) : null}
                {isSend ? (
                  <button type="button" className="btn sm" onClick={() => navigate('/today')}>Ir a planeación <Icon name="chevR" size={12} /></button>
                ) : (
                  <button type="button" className="btn sm" onClick={() => navigate(item.href)}>Ver caso <Icon name="chevR" size={12} /></button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
