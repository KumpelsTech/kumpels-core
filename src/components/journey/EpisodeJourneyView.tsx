import { useNavigate } from 'react-router-dom'
import type { Patient } from '../../types/patient'
import type { DemoPersona } from '../../config/workspaces'
import type { DerivedStage, EpisodeJourney, StageOwner } from '../../types/journeyStage'
import { deriveEpisodeJourney } from '../../utils/episodeJourney'
import { deriveDelaySignal, SEVERITY_TEXT } from '../../utils/delaySignals'
import { buildWorkItems } from '../../utils/workItems'
import { applyOverrides } from '../../utils/coordinatorStore'
import { usePersona } from '../../utils/personaStore'
import { useReviewStore } from '../../utils/reviewStore'
import { usePreparationStore } from '../../utils/preparationStore'
import { useProductionStore } from '../../utils/productionStore'
import { useCoordinatorStore } from '../../utils/coordinatorStore'
import { useFulfillmentStore } from '../../utils/fulfillmentStore'
import { useCareStore } from '../../utils/careStore'
import { useAdministrationStore } from '../../utils/administrationStore'
import { RecentActivity } from '../patient/RecentActivity'
import { JourneyStepper } from './JourneyStepper'
import { Icon } from '../Icon'

const JOURNEY_LABEL: Record<EpisodeJourney['journeyType'], string> = {
  'oncology-iv': 'Oncología IV', oral: 'Terapia oral', fulfillment: 'Dispensación',
}
/** Etapas relevantes por persona (misma data, distinto énfasis — §11). */
const ROLE_STAGES: Record<DemoPersona, string[]> = {
  coordinador: [],
  'qf-clinico': ['revision-clinica', 'seguimiento', 'proximo-seguimiento'],
  'qf-mezclas': ['enviado-produccion', 'preparacion', 'verificacion', 'liberacion'],
  enfermeria: ['enfermeria-readiness', 'administracion'],
  farmacia: ['dispensacion-acceso', 'disponibilidad', 'dispensacion', 'contacto', 'entrega'],
  admin: [],
}

function OwnerBlock({ owner }: { owner?: StageOwner }) {
  if (!owner) return <span className="jv-o-team">—</span>
  const unassigned = !owner.assignment || owner.assignment === 'UNASSIGNED'
  return (
    <div className="jv-owner">
      <div className="jv-o-name">{owner.label}</div>
      {owner.team && owner.team !== owner.label ? <div className="jv-o-team">{owner.team}</div> : null}
      <div className={`jv-o-asg ${unassigned ? 'none' : ''}`}>{unassigned ? 'Sin asignar' : owner.assignment === 'ACKNOWLEDGED' ? 'Tomada' : owner.assignment === 'IN_PROGRESS' ? 'En curso' : 'Asignada'}</div>
    </div>
  )
}

/**
 * Vista OPERATIVA continua del journey (una sola vista, sin pestañas). Orden:
 * contexto → stepper horizontal → etapa actual / siguiente → bloqueos → retraso →
 * handoff → WorkItems relevantes → actividad. Comparte la proyección con Patient 360
 * (misma fuente: deriveEpisodeJourney) para no calcular valores distintos.
 */
export function EpisodeJourneyView({ patient, compact = false }: { patient: Patient; compact?: boolean }) {
  useReviewStore(); usePreparationStore(); useProductionStore(); useCoordinatorStore()
  useFulfillmentStore(); useCareStore(); useAdministrationStore()
  const { persona, profile } = usePersona()
  const navigate = useNavigate()
  const j = deriveEpisodeJourney(patient)
  const cur = j.currentStage
  const delaySignal = deriveDelaySignal(patient)
  const roleStages = ROLE_STAGES[persona] ?? []
  const highlight = (s: DerivedStage) => roleStages.includes(s.type)
  const patientItems = compact ? [] : applyOverrides(buildWorkItems()).filter((i) => i.patientId === patient.id)

  return (
    <div className="jview">
      {/* Stepper horizontal */}
      <div className="jv-stepper-wrap">
        <div className="jv-lead">
          <span className="jv-type"><Icon name="route" size={13} /> {JOURNEY_LABEL[j.journeyType]}</span>
          <span className="jv-lens"><Icon name="users" size={11} /> Vista · {profile.short}</span>
        </div>
        <JourneyStepper stages={j.stages} highlightRole={highlight} />
      </div>

      {/* Actual → Siguiente */}
      <div className="jv-flow">
        <div className={`jv-col current ${j.blocked ? 'blk' : ''}`}>
          <div className="jv-k">Etapa actual</div>
          <div className="jv-stage">{cur?.label ?? 'Episodio al día'}</div>
          <div className="jv-sub">Responsable</div>
          <OwnerBlock owner={j.currentOwner} />
          {cur?.startedAt ? <div className="jv-meta">Iniciada · <b>{cur.startedAt}</b></div> : null}
          {j.nextAction ? <div className="jv-meta">Próxima acción · <b>{j.nextAction}</b></div> : null}
          {cur?.dueAt ? <div className="jv-meta">Vence · <b>{cur.dueAt.replace('Hoy ', '')}</b></div> : null}
          {j.actionHref && j.nextAction ? (
            <button type="button" className="btn sm primary" style={{ marginTop: 10 }} onClick={() => navigate(j.actionHref!)}>
              {j.nextAction} <Icon name="chevR" size={12} />
            </button>
          ) : null}
        </div>
        <span className="jv-arrow"><Icon name="arrow" size={18} /></span>
        <div className="jv-col next">
          <div className="jv-k">Siguiente</div>
          <div className="jv-stage">{j.nextStage?.label ?? 'Cierre del episodio'}</div>
          <div className="jv-sub">Responsable</div>
          <OwnerBlock owner={j.nextOwner} />
        </div>
      </div>

      {/* Retraso / propietario del retraso (DelaySignal — misma fuente que Nursing/Coordinador) */}
      {delaySignal ? (
        <div className={`jv-delay ${delaySignal.severity === 'CRITICAL' ? 'severe' : ''}`}>
          <span className="jv-delay-tag"><Icon name={delaySignal.severity === 'CRITICAL' || delaySignal.severity === 'LATE' ? 'alert' : 'clock'} size={12} /> {cur?.label ? `${cur.label} · ` : ''}{SEVERITY_TEXT[delaySignal.severity]}{delaySignal.minutesLate > 0 ? ` ${delaySignal.minutesLate} min` : ''}</span>
          <span className="jv-delay-owner">Responsable · <b>{delaySignal.ownerLabel}</b>{delaySignal.noAssignee ? ' · Sin asignar' : delaySignal.assignedNotAcked ? ' · pendiente de aceptación' : ''}</span>
          {delaySignal.waitingForNext && j.nextOwner ? <span className="jv-delay-reason">Esperando a {j.nextOwner.team ?? j.nextOwner.label}{delaySignal.minutesLate > 0 ? ` · ${delaySignal.minutesLate} min` : ''}</span> : delaySignal.reason ? <span className="jv-delay-reason">{delaySignal.reason}</span> : null}
        </div>
      ) : null}

      {/* Bloqueo activo */}
      {j.blocked && cur?.blocker ? (
        <div className="jv-blocked">
          <div className="jb-tag"><Icon name="alert" size={12} /> BLOQUEADA</div>
          <div className="jb-grid">
            <div><span className="jb-k">Motivo</span><span className="jb-v">{cur.blocker.label}</span></div>
            {cur.blocker.responsible ? <div><span className="jb-k">Responsable</span><span className="jb-v">{cur.blocker.responsible}</span></div> : null}
            {cur.blocker.since ? <div><span className="jb-k">Desde</span><span className="jb-v">{cur.blocker.since}</span></div> : null}
            <div><span className="jb-k">Próxima acción</span><span className="jb-v">{cur.blocker.nextAction ?? j.nextAction ?? '—'}</span></div>
          </div>
        </div>
      ) : null}

      {/* Trabajo sin responsable → acción de asignación existente (Coordinación) */}
      {!j.blocked && j.currentOwner && (!j.currentOwner.assignment || j.currentOwner.assignment === 'UNASSIGNED') && j.nextAction ? (
        <div className="jv-unassigned">
          <span><Icon name="alert" size={12} /> Sin responsable asignado · {j.currentOwner.team ?? j.currentOwner.label}</span>
          <button type="button" className="btn sm" onClick={() => navigate('/today')}>Asignar responsable <Icon name="chevR" size={12} /></button>
        </div>
      ) : null}

      {/* Handoff actual (sin ser log de auditoría) */}
      {j.handoff && (j.handoff.sentAt || j.handoff.acceptedAt) ? (
        <div className="jv-handoff">
          {j.handoff.sentByLabel ? <span>Enviado por · <b>{j.handoff.sentByLabel}</b>{j.handoff.sentAt ? ` · ${j.handoff.sentAt.replace('Hoy ', '')}` : ''}</span> : null}
          {j.handoff.acceptedByLabel ? <span>Aceptado por · <b>{j.handoff.acceptedByLabel}</b>{j.handoff.acceptedAt ? ` · ${j.handoff.acceptedAt.replace('Hoy ', '')}` : ''}</span> : null}
          {!compact ? <button type="button" className="link-mini" onClick={() => navigate(`${j.patientHref}?tab=historial`)}>Ver historial</button> : null}
        </div>
      ) : null}

      {!compact ? (
        <>
          {/* WorkItems relevantes */}
          {patientItems.length ? (
            <div className="jv-sec">
              <div className="jv-sec-lead"><Icon name="spark" size={13} /> WorkItems del episodio</div>
              <div className="jv-wi-list">
                {patientItems.map((it) => (
                  <div className="jv-wi" key={it.id} role="button" tabIndex={0}
                    onClick={() => navigate(it.href)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(it.href) }}>
                    <span className={`jv-wi-dot ${it.tone}`} />
                    <span className="jv-wi-main"><b>{it.nextAction}</b> · {it.statusLabel}</span>
                    <span className="jv-wi-owner">{it.owner?.label ?? 'Sin asignar'}</span>
                    <Icon name="chevR" size={12} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Actividad reciente (reutiliza el componente del paciente) */}
          <div className="jv-sec">
            <div className="jv-sec-lead"><Icon name="clock" size={13} /> Actividad reciente</div>
            <RecentActivity patient={patient} />
          </div>
        </>
      ) : null}
    </div>
  )
}
