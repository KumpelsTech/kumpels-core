import type { Patient } from '../types/patient'
import type { WorkItem } from '../types/work'
import type { AssignmentStatus } from '../types/assignment'
import type {
  DerivedStage, EpisodeJourney, JourneyDelay, JourneyHandoff, JourneyType,
  StageAssignment, StageBlocker, StageOwner, StageStatus,
} from '../types/journeyStage'
import { JOURNEY_DEFS, type StageDef } from '../config/journeys'
import { slaMinutesOf } from './priorityQueue'
import { clinicalReviewPending } from './review'
import { getPatientPreparation } from './preparationStore'
import { getProductionRequest } from './productionStore'
import { getAdministrationForOrder } from './administrationStore'
import { getPatientPending, nextFulfillmentAction } from './fulfillmentStore'
import { getCare } from '../data/careFollowup'
import { getAssessment } from './careStore'
import { buildWorkItems } from './workItems'
import { applyOverrides, getAssignment } from './coordinatorStore'

/**
 * Derivación del JOURNEY del episodio: PROYECTA el estado de los dominios (no crea
 * un segundo flujo). La propiedad actual se toma de los WorkItems + su asignación
 * (misma fuente que "Hoy"), no de un sistema paralelo.
 */

function mapAssign(s?: AssignmentStatus): StageAssignment | undefined {
  if (!s) return undefined
  if (s === 'assigned') return 'ASSIGNED'
  if (s === 'acknowledged') return 'ACKNOWLEDGED'
  if (s === 'in-progress') return 'IN_PROGRESS'
  if (s === 'completed') return 'COMPLETED'
  return 'UNASSIGNED'
}

/** Descripción del estado actual derivado (una sola etapa activa/bloqueada por journey). */
interface CurrentDesc {
  index: number
  status: 'ACTIVE' | 'BLOCKED'
  blocker?: StageBlocker
  nextAction: string
  workItemId?: string
  sourceEntityType?: string
  sourceEntityId?: string
  startedAt?: string
  actionHref?: string
  done?: boolean // journey completo (todas las etapas COMPLETED)
}

function journeyTypeOf(p: Patient): JourneyType {
  if (getPatientPreparation(p.id)) return 'oncology-iv'
  if (p.modality === 'Oral') return 'oral'
  if (getPatientPending(p.id)) return 'fulfillment'
  return 'oral'
}

/** Índice de una etapa por su `type` dentro de la definición. */
const idxOf = (defs: StageDef[], type: string) => defs.findIndex((d) => d.type === type)

/* ---------------- Oncología IV ---------------- */
function currentIV(p: Patient, defs: StageDef[]): CurrentDesc {
  const prep = getPatientPreparation(p.id)
  const review = clinicalReviewPending(p.id)
  const order = prep?.order
  const orderId = order?.id
  const production = orderId ? getProductionRequest(orderId) : undefined
  const admin = orderId ? getAdministrationForOrder(orderId) : undefined
  const src = { sourceEntityType: 'PreparationOrder', sourceEntityId: orderId }

  // Revisión clínica sin resolver → etapa activa (trabajo clínico).
  if (review.pending) {
    return { index: idxOf(defs, 'revision-clinica'), status: 'ACTIVE', nextAction: 'Completar revisión clínica', workItemId: `wi-rev-${p.id}`, sourceEntityType: 'ProfessionalReview', sourceEntityId: p.id }
  }
  if (!prep) {
    // Sin preparación pero revisión hecha: seguimiento.
    return currentFollowUp(p, defs, 'seguimiento')
  }
  const s = prep.status
  const sent = production?.status === 'SENT_TO_PRODUCTION' || production?.status === 'ACCEPTED_BY_COMPOUNDING'

  if (prep.rejection) {
    return { index: idxOf(defs, 'administracion'), status: 'BLOCKED', nextAction: 'Resolver preparación rechazada', workItemId: `wi-reject-${orderId}`, blocker: { label: `Rechazada por Enfermería · ${prep.rejection.reasonLabel}`, responsible: prep.rejection.ownerLabel, since: prep.rejection.at, nextAction: 'Resolver preparación rechazada' }, ...src }
  }
  if (s === 'bloqueada' || s === 'pendiente-validacion') {
    const b = prep.blocker
    return { index: idxOf(defs, 'enfermeria-readiness'), status: 'BLOCKED', nextAction: b?.nextAction ?? 'Resolver bloqueo', workItemId: `wi-blk-${orderId}`, blocker: { label: b?.label ?? 'Bloqueada', responsible: b?.responsible, since: order?.scheduledAt, nextAction: b?.nextAction }, ...src }
  }
  if (prep.productionGate) {
    return { index: idxOf(defs, 'enfermeria-readiness'), status: 'ACTIVE', nextAction: 'Enviar a producción', workItemId: `wi-send-${orderId}`, ...src }
  }
  if (sent && production?.status === 'SENT_TO_PRODUCTION' && s === 'lista') {
    // Enviada, esperando aceptación / inicio en Central de Mezclas.
    return { index: idxOf(defs, 'preparacion'), status: 'ACTIVE', nextAction: 'Aceptar solicitud / iniciar preparación', workItemId: `wi-sent-${orderId}`, ...src }
  }
  if (s === 'lista' || s === 'en-preparacion') {
    return { index: idxOf(defs, 'preparacion'), status: 'ACTIVE', nextAction: s === 'en-preparacion' ? 'Finalizar preparación' : 'Iniciar preparación', workItemId: `wi-prep-${orderId}`, startedAt: prep.instance?.startedAt, ...src }
  }
  if (s === 'pendiente-verificacion') {
    return { index: idxOf(defs, 'verificacion'), status: 'ACTIVE', nextAction: 'Verificar preparación', workItemId: `wi-prep-${orderId}`, startedAt: prep.instance?.completedAt, ...src }
  }
  if (s === 'verificada') {
    return { index: idxOf(defs, 'liberacion'), status: 'ACTIVE', nextAction: 'Liberar preparación', workItemId: `wi-prep-${orderId}`, startedAt: prep.instance?.verifiedAt, ...src }
  }
  if (s === 'liberada') {
    if (!admin) {
      return { index: idxOf(defs, 'administracion'), status: 'ACTIVE', nextAction: 'Registrar administración', workItemId: `wi-adm-${orderId}`, sourceEntityType: 'MedicationAdministration', sourceEntityId: orderId }
    }
    return currentFollowUp(p, defs, 'seguimiento')
  }
  return currentFollowUp(p, defs, 'seguimiento')
}

/* ---------------- Seguimiento (compartido) ---------------- */
function currentFollowUp(p: Patient, defs: StageDef[], type: string): CurrentDesc {
  const care = getCare(p.id)
  const assessment = getAssessment(p.id)
  const index = idxOf(defs, type)
  const needed = !!care && care.required && care.status !== 'completado' && !assessment
  if (needed) {
    return { index, status: care.status === 'vencido' ? 'BLOCKED' : 'ACTIVE', nextAction: care.mode === 'entrevista-inicial' ? 'Completar entrevista' : 'Realizar seguimiento', workItemId: `wi-seg-${p.id}`, sourceEntityType: 'PharmaceuticalCare', sourceEntityId: p.id, blocker: care.status === 'vencido' ? { label: 'Seguimiento vencido', responsible: care.responsible, nextAction: 'Realizar seguimiento' } : undefined }
  }
  // Todo resuelto: journey completo.
  return { index: defs.length - 1, status: 'ACTIVE', nextAction: 'Sin acción pendiente', done: true }
}

/* ---------------- Cumplimiento / dispensación ---------------- */
function currentFulfillment(p: Patient, defs: StageDef[]): CurrentDesc {
  const f = getPatientPending(p.id)
  const src = { sourceEntityType: 'MedicationRequest', sourceEntityId: f?.order.id }
  if (!f || !f.isPending) return { index: idxOf(defs, 'completo'), status: 'ACTIVE', nextAction: 'Sin acción pendiente', done: true }
  const wi = `wi-pend-${f.order.id}`
  if (f.blocked) {
    return { index: idxOf(defs, 'disponibilidad'), status: 'BLOCKED', nextAction: 'Gestionar autorización', workItemId: wi, blocker: { label: 'Dispensación bloqueada — autorización pendiente', responsible: f.responsible, since: f.pendingSince, nextAction: 'Gestionar autorización' }, ...src }
  }
  if (f.communication === 'pendiente' && f.continuity.risk !== 'sin-riesgo') {
    return { index: idxOf(defs, 'contacto'), status: 'ACTIVE', nextAction: nextFulfillmentAction(f), workItemId: wi, ...src }
  }
  return { index: idxOf(defs, 'dispensacion'), status: 'ACTIVE', nextAction: nextFulfillmentAction(f), workItemId: wi, ...src }
}

/* ---------------- Oral ---------------- */
function currentOral(p: Patient, defs: StageDef[]): CurrentDesc {
  const f = getPatientPending(p.id)
  const src = { sourceEntityType: 'MedicationRequest', sourceEntityId: f?.order.id }
  if (f && f.isPending) {
    if (f.blocked) return { index: idxOf(defs, 'dispensacion-acceso'), status: 'BLOCKED', nextAction: 'Gestionar autorización', workItemId: `wi-pend-${f.order.id}`, blocker: { label: 'Acceso / dispensación bloqueada — autorización pendiente', responsible: f.responsible, since: f.pendingSince, nextAction: 'Gestionar autorización' }, ...src }
    return { index: idxOf(defs, 'dispensacion-acceso'), status: 'ACTIVE', nextAction: nextFulfillmentAction(f), workItemId: `wi-pend-${f.order.id}`, ...src }
  }
  // Sin pendiente de acceso: seguimiento farmacoterapéutico.
  const fu = currentFollowUp(p, defs, 'seguimiento')
  if (fu.done) {
    // Seguimiento al día → próximo seguimiento (pendiente/upcoming).
    return { index: idxOf(defs, 'proximo-seguimiento'), status: 'ACTIVE', nextAction: 'Programar próximo seguimiento', done: false, workItemId: `wi-seg-${p.id}` }
  }
  return fu
}

/** Retraso DETERMINISTA de la etapa actual (de dueAt/SLA/señales del WorkItem). */
function computeDelay(cur: CurrentDesc, item: WorkItem | undefined, ownerLabel?: string): JourneyDelay | undefined {
  const s = item?.signals ?? {}
  if (s.sentNotAccepted && typeof s.sentAgoMinutes === 'number') {
    return { text: `Esperando aceptación hace ${s.sentAgoMinutes} min`, severe: s.sentAgoMinutes >= 20, ownerLabel: 'Central de Mezclas', reason: `Solicitud enviada hace ${s.sentAgoMinutes} min sin aceptación` }
  }
  const sla = item ? slaMinutesOf(item) : undefined
  if (sla != null && sla < 0) {
    return { text: `Retrasada ${Math.abs(sla)} min`, severe: true, ownerLabel, reason: cur.blocker?.label ?? `${cur.nextAction} vencida` }
  }
  if (cur.nextAction === 'Registrar administración') {
    return { text: 'Administración pendiente', severe: false, ownerLabel: 'Enfermería', reason: 'Preparación liberada; administración aún no iniciada' }
  }
  if (sla != null && sla >= 0 && sla <= 90) {
    return { text: `Vence en ${sla} min`, severe: false, ownerLabel }
  }
  if (cur.status === 'BLOCKED') {
    return { text: 'Bloqueada', severe: true, ownerLabel: cur.blocker?.responsible ?? ownerLabel, reason: cur.blocker?.label }
  }
  return undefined
}

function ownerFor(def: StageDef, item?: WorkItem): StageOwner {
  const a = item ? getAssignment(item.id) : undefined
  const assigned = !!a && !!a.assignedToName && a.status !== 'unassigned' && a.status !== 'completed' && a.status !== 'cancelled'
  return {
    role: def.ownerRole,
    team: def.ownerTeam,
    label: assigned ? a!.assignedToName! : (def.ownerTeam ?? def.label),
    userId: assigned ? a!.assignedToId : undefined,
    assignment: mapAssign(a?.status) ?? 'UNASSIGNED',
  }
}

/** Deriva el journey del episodio de un paciente. */
export function deriveEpisodeJourney(p: Patient): EpisodeJourney {
  const journeyType = journeyTypeOf(p)
  const defs = JOURNEY_DEFS[journeyType]
  const journeyId = `jny-${p.id}`
  const cur = journeyType === 'oncology-iv' ? currentIV(p, defs)
    : journeyType === 'fulfillment' ? currentFulfillment(p, defs)
      : currentOral(p, defs)

  const items = applyOverrides(buildWorkItems())
  const byId = new Map(items.map((i) => [i.id, i]))
  const curItem = cur.workItemId ? byId.get(cur.workItemId) : undefined

  const stages: DerivedStage[] = defs.map((def, i) => {
    let status: StageStatus
    if (cur.done) status = 'COMPLETED'
    else if (i < cur.index) status = 'COMPLETED'
    else if (i === cur.index) status = cur.status
    else status = 'PENDING'
    const isCurrent = !cur.done && i === cur.index
    return {
      id: `${journeyId}-${def.type}`, journeyId, type: def.type, label: def.label, status,
      owner: isCurrent ? ownerFor(def, curItem) : undefined,
      nextAction: isCurrent ? (curItem?.nextAction ?? cur.nextAction) : undefined,
      blocker: isCurrent ? cur.blocker : undefined,
      sourceEntityType: isCurrent ? cur.sourceEntityType : undefined,
      sourceEntityId: isCurrent ? cur.sourceEntityId : undefined,
      startedAt: isCurrent ? cur.startedAt : undefined,
      dueAt: isCurrent ? curItem?.dueLabel : undefined,
    }
  })

  const currentStage = cur.done ? stages[stages.length - 1] : stages[cur.index]
  const currentOwner = currentStage?.owner
  // Siguiente etapa y su propietario por defecto (equipo que recibe el proceso).
  const nextDef = !cur.done && cur.index + 1 < defs.length ? defs[cur.index + 1] : undefined
  const nextStage = nextDef ? stages[cur.index + 1] : undefined
  const nextOwner: StageOwner | undefined = nextDef
    ? { role: nextDef.ownerRole, team: nextDef.ownerTeam, label: nextDef.ownerTeam ?? nextDef.label, assignment: 'UNASSIGNED' }
    : undefined
  const nextAction = curItem?.nextAction ?? cur.nextAction

  // Retraso + handoff (contexto operativo), sin duplicar datos de dominio.
  const delay = cur.done ? undefined : computeDelay(cur, curItem, currentOwner?.team ?? currentOwner?.label)
  let handoff: JourneyHandoff | undefined
  if (journeyType === 'oncology-iv') {
    const prep = getPatientPreparation(p.id)
    const prod = prep ? getProductionRequest(prep.order.id) : undefined
    if (prod && (prod.requestedAt || prod.acceptedAt)) {
      handoff = {
        sentByLabel: prod.requestedByName ? `${prod.requestedByRole ?? 'Enfermería'} · ${prod.requestedByName}` : (prod.requestedByRole ?? undefined),
        sentAt: prod.requestedAt,
        acceptedByLabel: prod.acceptedByName, acceptedAt: prod.acceptedAt,
      }
    }
  }

  return {
    patientId: p.id, patientName: p.name, initials: p.initials, dx: p.dx, modality: p.modality,
    protocol: p.protocol, cycleLabel: p.cycle && p.cycle !== 'Continuo' ? `Ciclo ${p.cycle}` : undefined,
    priority: p.priority, category: p.category, episodeId: `EOC-${p.id}`, journeyType, stages,
    currentStage, currentOwner, nextStage, nextOwner, nextAction: cur.done ? undefined : nextAction,
    blocked: !cur.done && cur.status === 'BLOCKED',
    delay, handoff,
    currentWorkItemId: curItem?.id ?? cur.workItemId,
    actionHref: curItem?.href ?? cur.actionHref,
    href: `/journeys/${p.id}`,
    patientHref: `/patients/${p.id}`,
  }
}

/** ¿El episodio requiere atención (etapa actual bloqueada)? (para filtros). */
export function journeyNeedsAttention(p: Patient): boolean {
  return deriveEpisodeJourney(p).blocked
}
