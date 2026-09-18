import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WorkItem } from '../types/work'
import type { Priority } from '../types/patient'
import type { AdminUser } from '../types/admin'
import { buildPriorityQueue, LEVEL_TONE, type PrioritizedItem } from '../utils/priorityQueue'
import { useCoordinatorStore } from '../utils/coordinatorStore'
import { eligibleUsers } from '../utils/eligibility'
import { usePersona } from '../utils/personaStore'
import { delaySignalFor, SEVERITY_TEXT, SEVERITY_TONE } from '../utils/delaySignals'
import { getFacility } from '../data/admin'
import { services } from '../services'
import { Icon } from './Icon'
import { Segmented } from './Segmented'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'HIGH', label: 'Alta' }, { value: 'ACTION', label: 'Media' }, { value: 'MONITOR', label: 'Baja' },
]
const ASSIGN_STATUS_LABEL: Record<string, string> = {
  assigned: 'Asignada · sin acuse', acknowledged: 'Tomada', 'in-progress': 'En curso',
  completed: 'Completada', reassigned: 'Reasignada', escalated: 'Escalada', cancelled: 'Cancelada', unassigned: 'Sin asignar',
}

function eligibleFor(item: WorkItem): AdminUser[] {
  if (!item.requiredCapability) return []
  return eligibleUsers({ capability: item.requiredCapability, facilityId: item.facilityId, programId: item.programId })
}

function Row({ p }: { p: PrioritizedItem }) {
  const navigate = useNavigate()
  const { actor } = usePersona()
  const { getAssignment } = useCoordinatorStore()
  const [manage, setManage] = useState(false)
  const [priority, setPriority] = useState<Priority>('HIGH')
  const [priorityReason, setPriorityReason] = useState('')
  const [instruction, setInstruction] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [note, setNote] = useState('')
  const [due, setDue] = useState('')
  const item = p.item
  const assignment = getAssignment(item.id)
  const eligibles = eligibleFor(item)
  const delay = item.patientId ? delaySignalFor(item.patientId) : undefined

  const doAssign = (u: AdminUser) => { void services.coordinator.assign(item, u, { instruction: instruction.trim() || undefined }, actor()); setInstruction('') }
  const doReassign = (u: AdminUser) => { if (!reassignReason.trim()) return; void services.coordinator.reassign(item, u, reassignReason.trim(), actor()); setReassignReason('') }

  return (
    <div className={`pq-card ${LEVEL_TONE[p.level]}`}>
      <div className="pqc-rank">
        <span className={`pqc-level ${LEVEL_TONE[p.level]}`}>{p.level}</span>
        {item.escalationState === 'escalated' ? <span className="esc-chip"><Icon name="alert" size={10} /> Escalado</span> : null}
      </div>
      <div className="pqc-main">
        <div className="pqc-top">
          <span className="pqc-name">{item.patientName}</span>
          {item.patientId ? <span className="pq-id mono">{item.patientId}</span> : null}
          <span className="pqc-status">{item.statusLabel}</span>
        </div>
        <ul className="pqc-why">
          {p.reasons.slice(0, 4).map((r, i) => <li key={i}><Icon name="chevR" size={10} /> {r}</li>)}
        </ul>
        {delay ? (
          <div className={`pqc-delay ${SEVERITY_TONE[delay.severity]}`}>
            <span className="pqcd-sev">{SEVERITY_TEXT[delay.severity]}{delay.minutesLate > 0 ? ` · ${delay.minutesLate} min` : ''}</span>
            <span className="pqcd-reason">{delay.reason}</span>
            <span className="pqcd-owner"><Icon name="users" size={10} /> Responsable · <b>{delay.ownerLabel}</b>{delay.noAssignee ? ' · Sin asignar' : delay.assignedNotAcked ? ' · pendiente de aceptación' : ''}</span>
          </div>
        ) : null}
        <div className="pqc-foot">
          <span className="pqc-resp"><Icon name="users" size={11} /> Responsable · <b>{item.owner?.label ?? 'Sin asignar'}</b></span>
          <span className="pqc-next"><Icon name="spark" size={11} /> Siguiente · <b>{item.nextAction}</b></span>
          {assignment && assignment.status !== 'unassigned' ? (
            <span className="pqc-asg"><Icon name="check" size={11} /> {ASSIGN_STATUS_LABEL[assignment.status]}{assignment.assignedToName ? ` · ${assignment.assignedToName}` : ''}</span>
          ) : null}
          {assignment?.note ? <span className="pqc-note"><Icon name="doc" size={11} /> {assignment.note}</span> : null}
        </div>
      </div>
      <div className="pqc-actions">
        {item.patientId ? <button type="button" className="btn sm" onClick={() => navigate(`/journeys/${item.patientId}`)}><Icon name="route" size={12} /> Ver Journey</button> : null}
        <button type="button" className="btn sm" onClick={() => navigate(item.href)}>Abrir <Icon name="chevR" size={12} /></button>
        <button type="button" className="btn sm" onClick={() => setManage((s) => !s)}><Icon name="users" size={12} /> Gestionar</button>
      </div>

      {manage ? (
        <div className="pqc-manage">
          {/* Asignar / reasignar — solo usuarios ELEGIBLES */}
          {item.requiredCapability ? (
            <div className="pqcm-block">
              <div className="pqcm-k">{assignment && assignment.status !== 'unassigned' ? 'Reasignar a' : 'Asignar a'} <span className="fu-hint">· solo elegibles</span></div>
              {eligibles.length === 0 ? (
                <div className="pqcm-none"><Icon name="alert" size={12} /> Sin usuario elegible para “{item.nextAction}”. Configura o habilita un usuario con la capacidad requerida.</div>
              ) : (
                <>
                  {assignment && assignment.status !== 'unassigned' ? (
                    <input type="text" value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} placeholder="Motivo de reasignación (obligatorio)" />
                  ) : (
                    <input type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Instrucción / motivo (opcional)" />
                  )}
                  <div className="pqcm-users">
                    {eligibles.map((u) => {
                      const fac = u.scope.facilityIds.map((f) => getFacility(f)?.name).filter(Boolean)
                      const facLabel = fac.length > 1 ? 'Multi-sede' : (fac[0] ?? '—')
                      const reassigning = !!assignment && assignment.status !== 'unassigned'
                      return (
                        <button key={u.id} type="button" className="pqcm-user" disabled={reassigning && !reassignReason.trim()}
                          onClick={() => (reassigning ? doReassign(u) : doAssign(u))}>
                          <span className="as-av">{u.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}</span>
                          <span className="pqcm-un"><b>{u.name}</b><i>{facLabel}</i></span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          ) : null}
          <div className="pqcm-row">
            <span className="pqcm-k">Escalar</span>
            <button type="button" className="btn sm" disabled={item.escalationState === 'escalated'} onClick={() => { void services.coordinator.escalate(item, actor()) }}><Icon name="alert" size={12} /> Escalar</button>
          </div>
          <div className="pqcm-row">
            <span className="pqcm-k">Prioridad</span>
            <Segmented value={priority} options={PRIORITIES} onChange={setPriority} ariaLabel="Prioridad" size="sm" />
            <input type="text" value={priorityReason} onChange={(e) => setPriorityReason(e.target.value)} placeholder="Motivo (obligatorio)" />
            <button type="button" className="btn sm" disabled={!priorityReason.trim()} onClick={() => { void services.coordinator.setPriority(item, priority, priorityReason.trim(), actor()); setPriorityReason('') }}>Aplicar</button>
          </div>
          <div className="pqcm-row">
            <span className="pqcm-k">Vencimiento</span>
            <input type="text" value={due} onChange={(e) => setDue(e.target.value)} placeholder="p. ej. Hoy 12:30" />
            <button type="button" className="btn sm" disabled={!due.trim()} onClick={() => { void services.coordinator.setDue(item, due.trim(), actor()); setDue('') }}>Aplicar</button>
          </div>
          <div className="pqcm-row">
            <span className="pqcm-k">Nota</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota operativa" />
            <button type="button" className="btn sm" disabled={!note.trim()} onClick={() => { void services.coordinator.addNote(item, note.trim(), actor()); setNote('') }}>Añadir</button>
          </div>
          <div className="subtle" style={{ marginTop: 4 }}><Icon name="shield" size={11} /> Acciones operativas — la ejecución clínica corresponde a cada rol elegible.</div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Cola de prioridad del Coordinador — derivada de WorkItems, determinista y
 * explicable. Asigna solo a usuarios elegibles (capacidad + alcance + política),
 * reasigna con motivo (preserva historia) y muestra el estado de acuse.
 */
export function CoordinatorQueue({ items }: { items: WorkItem[] }) {
  const queue = buildPriorityQueue(items)
  if (!queue.length) return null
  return (
    <div className="card pq-queue">
      <div className="section-head">
        <div className="section-title">Cola de prioridad <span className="st-sub">{queue.length} · ordenada por urgencia, con explicación</span></div>
      </div>
      <div className="pq-list">
        {queue.map((p) => <Row key={p.item.id} p={p} />)}
      </div>
    </div>
  )
}
