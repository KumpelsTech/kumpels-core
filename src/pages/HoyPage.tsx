import { useNavigate, useSearchParams } from 'react-router-dom'
import type { DemoPersona } from '../config/workspaces'
import type { WorkItem } from '../types/work'
import { usePersona } from '../utils/personaStore'
import { buildWorkItems } from '../utils/workItems'
import { useReviewStore } from '../utils/reviewStore'
import { useCareStore } from '../utils/careStore'
import { useFulfillmentStore } from '../utils/fulfillmentStore'
import { usePreparationStore } from '../utils/preparationStore'
import { useCoordinatorStore } from '../utils/coordinatorStore'
import { useProductionStore } from '../utils/productionStore'
import { useAdministrationStore } from '../utils/administrationStore'
import { useCommunicationStore, listAttentionSignals } from '../utils/communicationStore'
import { listDelaySignals } from '../utils/delaySignals'
import { getPatient } from '../data/patients'
import { splitPool, briefStatements, bottlenecks, byUrgency } from '../utils/hoyView'
import { WorkItemRow } from '../components/WorkItemRow'
import { CoordinatorQueue } from '../components/CoordinatorQueue'
import { AssignedInbox } from '../components/AssignedInbox'
import { NursingPlanning } from '../components/NursingPlanning'
import { CoordinatorDelays } from '../components/CoordinatorDelays'
import { OperationalBrief } from '../components/OperationalBrief'
import { PageHeader } from '../components/PageHeader'
import { StatTile } from '../components/StatTile'
import type { StatTone } from '../components/StatTile'
import { Icon } from '../components/Icon'

const NOW_MIN = 12 * 60 + 2
const fmtTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
function greeting(): string {
  const h = Math.floor(NOW_MIN / 60)
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

interface Stat { n: number; l: string; k: string }
const STAT_TONE: Record<string, StatTone> = { crit: 'crit', warn: 'warn', attn: 'progress', '': 'default' }

/** Estadísticas resumidas por persona (conteos deterministas sobre el pool del rol). */
function statsFor(persona: DemoPersona, pool: WorkItem[]): Stat[] {
  const crit = pool.filter((i) => i.tone === 'crit').length
  const alta = pool.filter((i) => i.priority === 'HIGH').length
  if (persona === 'coordinador') return [
    { n: pool.length, l: 'Trabajo relevante hoy', k: 'attn' },
    { n: crit, l: 'Excepciones críticas', k: 'crit' },
    { n: pool.filter((i) => i.type === 'pendiente' || (i.type === 'preparacion' && i.tone === 'crit')).length, l: 'Bloqueos operativos', k: 'warn' },
    { n: pool.filter((i) => i.type === 'revision').length, l: 'Revisiones en cola', k: '' },
  ]
  if (persona === 'qf-clinico') return [
    { n: pool.filter((i) => i.type === 'revision').length, l: 'Revisiones pendientes', k: 'attn' },
    { n: pool.filter((i) => i.type === 'seguimiento').length, l: 'Seguimientos de hoy', k: 'warn' },
    { n: alta, l: 'Prioridad alta', k: 'crit' },
  ]
  if (persona === 'farmacia') return [
    { n: pool.filter((i) => i.type === 'pendiente').length, l: 'Dispensaciones pendientes', k: 'attn' },
    { n: pool.filter((i) => i.type === 'pendiente' && i.signals?.pendingContact).length, l: 'Por contactar', k: 'warn' },
    { n: pool.filter((i) => i.signals?.continuityRisk && i.signals.continuityRisk !== 'sin-riesgo').length, l: 'Continuidad en riesgo', k: 'crit' },
    { n: pool.filter((i) => i.type === 'bloqueo').length, l: 'Bloqueos de acceso', k: '' },
  ]
  if (persona === 'qf-mezclas') return [
    { n: pool.length, l: 'Órdenes de preparación', k: 'attn' },
    { n: crit, l: 'Bloqueos propios', k: 'crit' },
    { n: pool.filter((i) => i.actionKey === 'verificar').length, l: 'Pendientes de verificación', k: 'warn' },
    { n: pool.filter((i) => i.tone === 'ok').length, l: 'Liberadas', k: '' },
  ]
  if (persona === 'enfermeria') return [
    { n: pool.length, l: 'Tratamientos de hoy', k: 'attn' },
    { n: pool.filter((i) => i.tone === 'ok').length, l: 'Listos para administrar', k: '' },
    { n: pool.filter((i) => i.tone !== 'ok').length, l: 'Aún no listos', k: 'warn' },
  ]
  return [{ n: pool.length, l: 'Trabajo relevante hoy', k: 'attn' }]
}

const FOCUS_TITLE: Record<string, string> = { seguimiento: 'Seguimientos de hoy', administracion: 'Tratamientos de hoy' }

/** Fila compacta para la sección "Próximo" (trabajo que aún no es urgente). */
function UpcomingRow({ item }: { item: WorkItem }) {
  const navigate = useNavigate()
  const time = item.dueLabel ?? (item.dueMinutes != null ? fmtTime(item.dueMinutes) : null)
  return (
    <div className="up-row" role="button" tabIndex={0} onClick={() => navigate(item.href)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(item.href) } }}>
      {time ? <span className="up-time mono">{time}</span> : <span className="up-time up-none">—</span>}
      <div className="up-main">
        <div className="up-name">{item.patientName}</div>
        <div className="up-next">{item.nextAction}</div>
      </div>
      <Icon name="chevR" size={14} className="up-caret" />
    </div>
  )
}

/** Reportes recientes de pacientes (QF Clínico) — proyección de señales de comunicación. */
function PatientReports() {
  const navigate = useNavigate()
  const signals = listAttentionSignals().filter((s) => s.severity !== 'NONE').slice(0, 4)
  if (!signals.length) return null
  return (
    <div className="card side-card">
      <div className="section-head">
        <div className="section-title"><Icon name="msg" size={14} /> Reportes recientes de pacientes <span className="st-sub">{signals.length}</span></div>
      </div>
      <div className="rep-list">
        {signals.map((s) => {
          const name = getPatient(s.patientId)?.name ?? s.patientId
          return (
            <div className="rep-row" key={s.id} role="button" tabIndex={0}
              onClick={() => navigate(`/communications?patient=${s.patientId}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/communications?patient=${s.patientId}`) } }}>
              <div className="rep-main">
                <div className="rep-name">{name}</div>
                <div className="rep-label">{s.label}</div>
                <div className="rep-src"><Icon name="msg" size={10} /> {s.sourceLabel} · {s.createdAt}</div>
              </div>
              <button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); navigate(`/communications?patient=${s.patientId}`) }}>Revisar</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Cuellos de botella (Coordinador) — agregado sobre demoras; navega al Journey. */
function Bottlenecks() {
  const navigate = useNavigate()
  const { user } = usePersona()
  const items = bottlenecks(listDelaySignals(user)).slice(0, 5)
  if (!items.length) return null
  return (
    <div className="card side-card">
      <div className="section-head">
        <div className="section-title"><Icon name="alert" size={14} /> Cuellos de botella <span className="st-sub">{items.length} áreas</span></div>
      </div>
      <div className="bn-list">
        {items.map((b) => (
          <button type="button" className="bn-row" key={b.area} onClick={() => navigate('/journeys')}>
            <div className="bn-main">
              <div className="bn-area">{b.area}</div>
              <div className="bn-sub">{b.count} {b.count === 1 ? 'flujo demorado' : 'flujos demorados'}{b.maxLate > 0 ? ` · ${b.maxLate} min` : ''}</div>
            </div>
            <span className={`chip ${b.maxLate >= 60 ? 'crit' : 'warn'} sm`}>{b.maxLate > 0 ? `${b.maxLate} min` : 'En espera'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Hoy — punto de partida operativo por rol. Reutiliza WorkItems, demoras y
 * proyecciones existentes; solo compone la presentación (UX-04). */
export function HoyPage() {
  useReviewStore(); useCareStore(); useFulfillmentStore(); usePreparationStore(); useProductionStore(); useAdministrationStore(); useCommunicationStore()
  const { applyOverrides } = useCoordinatorStore()
  const { persona, profile, user } = usePersona()
  const [params] = useSearchParams()
  const focus = params.get('focus')

  const allItems = applyOverrides(buildWorkItems())
  const pool = allItems.filter((i) => i.roles.includes(persona))
  const isCoordinator = persona === 'coordinador'
  const stats = statsFor(persona, pool)
  const firstName = (user?.name ?? profile.userName).split(' ')[0]
  const dateLabel = 'lunes 11 Sep 2026'

  // Vista enfocada (nav "Seguimiento" / "Administración" → /today?focus=…).
  if (focus) {
    const list = pool.filter((i) => i.type === focus).sort(byUrgency)
    return (
      <>
        <PageHeader title={FOCUS_TITLE[focus] ?? 'Hoy'} sub={`Como ${profile.label} · ${dateLabel}`} />
        {list.length ? (
          <div className="card hoy-group">
            <div className="wi-list">{list.map((it) => <WorkItemRow key={it.id} item={it} />)}</div>
          </div>
        ) : (
          <div className="calm"><span className="c-ico"><Icon name="check" size={16} /></span> Sin trabajo pendiente en esta vista.</div>
        )}
      </>
    )
  }

  const { attention, upcoming } = splitPool(pool)
  const delays = listDelaySignals(user)
  const brief = briefStatements(attention, delays)

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}`} sub={`Tu trabajo hoy como ${profile.label} · ${dateLabel}`} />

      <OperationalBrief statements={brief} />

      <div className="stat-row hoy-stats">
        {stats.map((s) => (
          <StatTile key={s.l} value={s.n} label={s.l} tone={STAT_TONE[s.k] ?? 'default'} />
        ))}
      </div>

      <div className="hoy-grid">
        <div className="hoy-main">
          {isCoordinator ? (
            <CoordinatorQueue items={pool} />
          ) : (
            <div className="card hoy-group">
              <div className="section-head">
                <div className="section-title"><Icon name="alert" size={15} /> Requieren tu atención <span className="st-sub">{attention.length}</span></div>
              </div>
              {attention.length ? (
                <div className="wi-list">{attention.map((it) => <WorkItemRow key={it.id} item={it} />)}</div>
              ) : (
                <div className="calm"><span className="c-ico"><Icon name="check" size={16} /></span> No tienes trabajo prioritario en este momento.</div>
              )}
            </div>
          )}

          {upcoming.length ? (
            <div className="card hoy-group">
              <div className="section-head">
                <div className="section-title"><Icon name="clock" size={15} /> Próximo <span className="st-sub">{upcoming.length}</span></div>
              </div>
              <div className="up-list">{upcoming.slice(0, 8).map((it) => <UpcomingRow key={it.id} item={it} />)}</div>
            </div>
          ) : null}
        </div>

        <aside className="hoy-side">
          <AssignedInbox items={allItems} />
          {isCoordinator ? <Bottlenecks /> : null}
          {persona === 'qf-clinico' ? <PatientReports /> : null}
        </aside>
      </div>

      {persona === 'enfermeria' ? <NursingPlanning /> : null}
      {isCoordinator ? <CoordinatorDelays /> : null}
    </>
  )
}
