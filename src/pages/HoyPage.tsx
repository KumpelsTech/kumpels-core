import { useSearchParams } from 'react-router-dom'
import type { DemoPersona } from '../config/workspaces'
import type { WorkItem, WorkTone } from '../types/work'
import { usePersona } from '../utils/personaStore'
import { buildWorkItems } from '../utils/workItems'
import { useReviewStore } from '../utils/reviewStore'
import { useCareStore } from '../utils/careStore'
import { useFulfillmentStore } from '../utils/fulfillmentStore'
import { usePreparationStore } from '../utils/preparationStore'
import { WorkItemRow } from '../components/WorkItemRow'
import { Icon } from '../components/Icon'

const TONE_RANK: Record<WorkTone, number> = { crit: 0, warn: 1, info: 2, ok: 3 }
const PRIO_RANK: Record<string, number> = { HIGH: 0, ACTION: 1, MONITOR: 2, none: 3 }
const byUrgency = (a: WorkItem, b: WorkItem) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || PRIO_RANK[a.priority] - PRIO_RANK[b.priority]

interface Group { key: string; title: string; items: WorkItem[] }
const g = (key: string, title: string, items: WorkItem[]): Group => ({ key, title, items: [...items].sort(byUrgency) })

/** Grupos de "Hoy" por persona — se arma desde el pool de WorkItems del rol. */
function groupsFor(persona: DemoPersona, pool: WorkItem[]): Group[] {
  const of = (t: WorkItem['type']) => pool.filter((i) => i.type === t)
  const groups: Group[] = []
  if (persona === 'coordinador') {
    groups.push(
      g('revision', 'Revisiones clínicas', of('revision')),
      g('seguimiento', 'Seguimientos', of('seguimiento')),
      g('pendiente', 'Pendientes de medicación', of('pendiente')),
      g('preparacion', 'Preparación estéril', of('preparacion')),
    )
  } else if (persona === 'qf-clinico') {
    groups.push(
      g('seguimiento', 'Seguimientos de hoy', of('seguimiento')),
      g('revision', 'Revisiones pendientes', of('revision')),
    )
  } else if (persona === 'qf-mezclas') {
    const prep = of('preparacion')
    groups.push(
      g('bloqueadas', 'Bloqueadas', prep.filter((i) => i.tone === 'crit')),
      g('preparar', 'Listas / en preparación', prep.filter((i) => i.actionKey === 'preparar')),
      g('verificar', 'Pendientes de verificación', prep.filter((i) => i.actionKey === 'verificar')),
      g('liberar', 'Por liberar', prep.filter((i) => i.actionKey === 'liberar')),
      g('liberadas', 'Liberadas', prep.filter((i) => i.tone === 'ok')),
    )
  } else {
    groups.push(
      g('administracion', 'Tratamientos de hoy', of('administracion')),
    )
  }
  return groups.filter((x) => x.items.length)
}

/** Estadísticas resumidas por persona. */
function statsFor(persona: DemoPersona, pool: WorkItem[]) {
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
  if (persona === 'qf-mezclas') return [
    { n: pool.length, l: 'Órdenes de preparación', k: 'attn' },
    { n: crit, l: 'Bloqueadas / validación', k: 'crit' },
    { n: pool.filter((i) => i.actionKey === 'verificar').length, l: 'Pendientes de verificación', k: 'warn' },
    { n: pool.filter((i) => i.tone === 'ok').length, l: 'Liberadas', k: '' },
  ]
  return [
    { n: pool.length, l: 'Tratamientos de hoy', k: 'attn' },
    { n: pool.filter((i) => i.tone === 'ok').length, l: 'Listos para administrar', k: '' },
    { n: pool.filter((i) => i.tone !== 'ok').length, l: 'Aún no listos', k: 'warn' },
  ]
}

/** Hoy — "mi trabajo hoy" según el rol. Reutiliza los estados de todos los dominios. */
export function HoyPage() {
  // Suscripción a los dominios de los que se derivan los WorkItems.
  useReviewStore(); useCareStore(); useFulfillmentStore(); usePreparationStore()
  const { persona, profile } = usePersona()
  const [params] = useSearchParams()
  const focus = params.get('focus')

  const pool = buildWorkItems().filter((i) => i.roles.includes(persona))
  let groups = groupsFor(persona, pool)
  if (focus) groups = groups.filter((x) => x.key === focus)
  const stats = statsFor(persona, pool)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Hoy</h1>
          <div className="page-sub">Tu trabajo hoy como <b>{profile.label}</b> · lunes 11 Sep 2026</div>
        </div>
      </div>

      <div className="ops-sum">
        {stats.map((s) => (
          <div key={s.l} className={`ops-stat ${s.k}`}><span className="os-n tnum">{s.n}</span><span className="os-l">{s.l}</span></div>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="calm"><span className="c-ico"><Icon name="check" size={16} /></span> Sin trabajo pendiente para tu rol en este momento.</div>
      ) : (
        groups.map((grp) => (
          <div className="card hoy-group" key={grp.key}>
            <div className="section-head">
              <div className="section-title">{grp.title} <span className="st-sub">{grp.items.length}</span></div>
            </div>
            <div className="wi-list">
              {grp.items.map((it) => <WorkItemRow key={it.id} item={it} />)}
            </div>
          </div>
        ))
      )}
    </>
  )
}
