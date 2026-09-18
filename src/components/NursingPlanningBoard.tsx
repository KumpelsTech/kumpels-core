import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PlanDay, ScheduledTreatmentView } from '../utils/scheduledTreatments'
import { nursingScheduledTreatments, READINESS_TEXT, READINESS_TONE } from '../utils/scheduledTreatments'
import { usePreparationStore } from '../utils/preparationStore'
import { useProductionStore } from '../utils/productionStore'
import { useAdministrationStore } from '../utils/administrationStore'
import { useCoordinatorStore, applyOverrides } from '../utils/coordinatorStore'
import { useReviewStore } from '../utils/reviewStore'
import { usePersona } from '../utils/personaStore'
import { delaySignalFor } from '../utils/delaySignals'
import { buildWorkItems } from '../utils/workItems'
import { getPreparationOrder } from '../data/preparation'
import { MIXING_SCOPE } from '../data/admin'
import { services } from '../services'
import { Segmented } from './Segmented'
import { StatTile } from './StatTile'
import type { StatTone } from './StatTile'
import { AssignedInbox } from './AssignedInbox'
import { Icon } from './Icon'

type Filter = 'todos' | 'accion' | 'bloqueados' | 'listos'

const BUCKET_LABEL: Record<ScheduledTreatmentView['timeBucket'], string> = {
  overdue: 'Atrasada', soon: 'Ventana actual', today: 'Más tarde hoy', tomorrow: 'Mañana',
}
const ownerText = (o?: ScheduledTreatmentView['currentOwner']) => {
  if (!o) return '—'
  const un = !o.assignment || o.assignment === 'UNASSIGNED'
  return `${o.label}${un && o.team && o.team !== o.label ? ' · Sin asignar' : ''}`
}
/** Estados en los que el trabajo está en Central de Mezclas (Enfermería solo observa). */
const IN_PRODUCTION = new Set(['ENVIADO_A_PRODUCCION', 'EN_PRODUCCION'])

function TreatmentRow({ t }: { t: ScheduledTreatmentView }) {
  const navigate = useNavigate()
  const { actor } = usePersona()
  const send = () => {
    const o = getPreparationOrder(t.preparationOrderId)
    void services.production.send({
      patientId: t.patientId, episodeId: o?.episodeId, medicationOrderId: o?.medicationOrderId,
      preparationOrderId: t.preparationOrderId, scheduledTreatmentAt: t.scheduledAt,
      facility: MIXING_SCOPE.facilityId, program: MIXING_SCOPE.programId, note: `Confirmado por Enfermería · ${t.therapy ?? t.medication}`,
    }, actor())
  }
  const time = t.scheduledAt.replace(/^Hoy\s*/i, '').replace(/^Ma[ñn]ana\s*/i, '')
  const delay = delaySignalFor(t.patientId)
  const nursingDelay = delay && delay.ownerRole === 'enfermeria' && (delay.severity === 'LATE' || delay.severity === 'CRITICAL') ? delay : undefined
  // "La bola está contigo": Enfermería posee la próxima acción.
  const owns = t.canSend || t.canAdminister
  const inProd = IN_PRODUCTION.has(t.readiness)
  const done = t.readiness === 'ADMINISTRADO'

  return (
    <div className={`npb-row ${t.readiness === 'BLOQUEADO' ? 'blk' : ''} ${nursingDelay ? 'late' : ''} ${owns ? 'owns' : ''} ${done ? 'done-row' : ''}`}>
      <div className="npb-time">
        <span className="npb-h mono">{time}</span>
        <span className={`npb-bucket ${t.timeBucket}`}>{BUCKET_LABEL[t.timeBucket]}</span>
      </div>
      <div className="npb-main">
        <div className="npb-top">
          <span className="npb-name">{t.patientName}</span>
          <span className="pq-id mono">{t.patientId}</span>
          <span className={`chip ${READINESS_TONE[t.readiness]}`}>{READINESS_TEXT[t.readiness]}</span>
          {owns ? <span className="npb-you"><Icon name="alert" size={10} /> Requiere tu acción</span> : null}
        </div>
        <div className="npb-sub">{t.therapy ?? t.medication}{t.cycleDay ? ` · ${t.cycleDay}` : ''} · {t.modality}</div>
        <div className="npb-ctx">
          {t.journeyStage ? <span><Icon name="route" size={11} /> {t.journeyStage} · <b>{ownerText(t.currentOwner)}</b></span> : null}
          {inProd && t.nextOwner ? <span><Icon name="arrow" size={11} /> Siguiente · <b>{t.nextOwner.label}</b></span> : null}
          {t.productionStatus ? <span><Icon name="drop" size={11} /> {t.productionStatus}</span> : null}
        </div>
        {t.readiness === 'BLOQUEADO' && t.blocker ? (
          <div className="npb-blk"><Icon name="alert" size={11} /> {t.blocker.label}{t.blocker.responsible ? ` · Responsable: ${t.blocker.responsible}` : ''}</div>
        ) : null}
        {inProd ? (
          <div className="npb-prod"><Icon name="drop" size={11} /> En Central de Mezclas · {t.productionStatus ?? 'en curso'} · sin acción de Enfermería</div>
        ) : null}
        {t.readiness === 'LISTO_PARA_ADMINISTRAR' ? (
          <div className="npb-ready"><Icon name="check" size={11} /> {t.preparationOrderId} liberada{t.releasedBy ? ` por ${t.releasedBy}` : ''}{t.releasedAt ? ` · ${t.releasedAt}` : ''} · administrar {time}</div>
        ) : null}
        {nursingDelay ? (
          <div className="npb-late"><Icon name="alert" size={11} /> RETRASADA {nursingDelay.minutesLate} MIN · {nursingDelay.reason}</div>
        ) : null}
        {done && t.administeredAt ? (
          <div className="npb-doneline"><Icon name="check" size={11} /> Administrado · {t.administeredAt}</div>
        ) : null}
      </div>
      <div className="npb-act">
        <span className="npb-next">{t.nextAction ?? 'Sin acción pendiente'}</span>
        <div className="npb-btns">
          {t.canSend ? <button type="button" className="btn sm primary" onClick={send}><Icon name="box" size={12} /> Enviar a producción</button> : null}
          {t.canAdminister ? <button type="button" className="btn sm primary" onClick={() => navigate(`/patients/${t.patientId}`)}><Icon name="syringe" size={12} /> Registrar administración</button> : null}
          <button type="button" className="btn sm" onClick={() => navigate(`/patients/${t.patientId}`)}>Ver paciente <Icon name="chevR" size={12} /></button>
        </div>
      </div>
    </div>
  )
}

/**
 * Tablero de planeación de Enfermería (oncología). Proyección sobre
 * deriveEpisodeJourney + preparación + producción + administración (no una fuente
 * de verdad nueva). Responde: quién viene hoy/mañana, a qué hora, qué tratamiento,
 * si está listo, qué lo bloquea, dónde está la producción y qué debe hacer Enfermería.
 */
export function NursingPlanningBoard() {
  usePreparationStore(); useProductionStore(); useAdministrationStore(); useCoordinatorStore(); useReviewStore()
  const { user } = usePersona()
  const [day, setDay] = useState<PlanDay>('hoy')
  const [filter, setFilter] = useState<Filter>('todos')

  const all = nursingScheduledTreatments(user)
  const hoyCount = all.filter((t) => t.day === 'hoy').length
  const mananaCount = all.filter((t) => t.day === 'manana').length
  const byDay = all.filter((t) => t.day === day)

  // Atención de Enfermería (deriva de las mismas vistas — sin modelo aparte).
  const porEnviar = byDay.filter((t) => t.canSend).length
  const paraAdmin = byDay.filter((t) => t.readiness === 'LISTO_PARA_ADMINISTRAR').length
  const bloqueados = byDay.filter((t) => t.readiness === 'BLOQUEADO').length
  const retrasadas = byDay.filter((t) => {
    const d = delaySignalFor(t.patientId)
    return d && d.ownerRole === 'enfermeria' && (d.severity === 'LATE' || d.severity === 'CRITICAL')
  }).length
  const attn: string[] = []
  if (retrasadas) attn.push(`${retrasadas} ${retrasadas === 1 ? 'administración retrasada' : 'administraciones retrasadas'}`)
  if (paraAdmin) attn.push(`${paraAdmin} ${paraAdmin === 1 ? 'preparación liberada esperando administración' : 'preparaciones liberadas esperando administración'}`)
  if (porEnviar) attn.push(`${porEnviar} ${porEnviar === 1 ? 'tratamiento listo para enviar a producción' : 'tratamientos listos para enviar a producción'}`)

  const items = byDay.filter((t) => {
    if (filter === 'accion') return t.canSend || t.canAdminister
    if (filter === 'bloqueados') return t.readiness === 'BLOQUEADO'
    if (filter === 'listos') return t.readiness === 'LISTO' || t.readiness === 'LISTO_PARA_ADMINISTRAR'
    return true
  })

  const tiles: { n: number; l: string; k: StatTone }[] = [
    { n: byDay.length, l: day === 'hoy' ? 'Tratamientos hoy' : 'Tratamientos mañana', k: 'progress' },
    { n: porEnviar, l: 'Por enviar a producción', k: 'warn' },
    { n: paraAdmin, l: 'Listos para administrar', k: 'ok' },
    { n: bloqueados, l: 'Bloqueados', k: 'crit' },
  ]

  return (
    <>
      <div className="stat-row hoy-stats">
        {tiles.map((s) => <StatTile key={s.l} value={s.n} label={s.l} tone={s.k} />)}
      </div>

      {attn.length ? (
        <div className="nrs-attn">
          <span className="nrs-attn-ico"><Icon name="alert" size={14} /></span>
          <span className="nrs-attn-lbl">Requieren tu atención</span>
          <span className="nrs-attn-txt">{attn.join(' · ')}</span>
        </div>
      ) : null}

      <AssignedInbox items={applyOverrides(buildWorkItems())} />

      <div className="card">
        <div className="section-head">
          <div className="section-title"><Icon name="calendar" size={15} /> Agenda de Enfermería <span className="st-sub">Pacientes oncológicos próximos</span></div>
          <Segmented<PlanDay> ariaLabel="Día" size="sm" value={day} onChange={setDay}
            options={[{ value: 'hoy', label: `Hoy · ${hoyCount}` }, { value: 'manana', label: `Mañana · ${mananaCount}` }]} />
        </div>
        <div className="npb-filters">
          {(['todos', 'accion', 'bloqueados', 'listos'] as Filter[]).map((f) => (
            <button key={f} type="button" className={`fpill ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
              {f === 'todos' ? 'Todos' : f === 'accion' ? 'Requieren acción' : f === 'bloqueados' ? 'Bloqueados' : 'Listos'}
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <div className="calm"><span className="c-ico"><Icon name="check" size={15} /></span> Sin tratamientos {day === 'hoy' ? 'para hoy' : 'para mañana'} con este filtro.</div>
        ) : (
          <div className="npb-list">
            {items.map((t) => <TreatmentRow key={t.preparationOrderId} t={t} />)}
          </div>
        )}
      </div>
    </>
  )
}
