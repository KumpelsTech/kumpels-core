import type { AdminUser } from '../types/admin'
import type { DemoPersona } from '../config/workspaces'
import type { Patient } from '../types/patient'
import type { StageAssignment } from '../types/journeyStage'
import { deriveEpisodeJourney } from './episodeJourney'
import { getAssignment } from './coordinatorStore'
import { getPreparationOrder } from '../data/preparation'
import { PATIENTS, getPatient } from '../data/patients'

/**
 * DelaySignal — proyección DETERMINISTA de retraso operativo (no un score
 * predictivo, no un recurso FHIR). Fuente única: reutiliza `deriveEpisodeJourney`
 * (etapa/propietario/motivo) y añade severidad, minutos de retraso y el estado del
 * ciclo de asignación. El retraso es estado DERIVADO: no emite eventos por minuto;
 * se RESUELVE solo cuando el dominio avanza. Estructurado para que TASK 20.6 pueda
 * proyectar señales seleccionadas a la campana (sin construirla aquí).
 *
 * Mapeo FHIR: nativo de Kumpels. Referencias mapeables (WorkItem→Task, Patient,
 * EpisodeOfCare, Appointment/Encounter, MedicationAdministration, PractitionerRole).
 */

export type DelaySeverity = 'ON_TIME' | 'ATTENTION' | 'LATE' | 'CRITICAL'

export interface DelaySignal {
  id: string
  sourceEntityType?: string
  sourceEntityId?: string
  patientId: string
  patientName: string
  journeyId: string
  stageId?: string
  stageLabel?: string
  severity: DelaySeverity
  reason: string
  ownerRole?: DemoPersona
  ownerTeam?: string
  ownerUserId?: string
  ownerLabel: string
  ownerAssignment?: StageAssignment
  /** WorkItem de la etapa actual (para escalar/asignar con el flujo existente). */
  workItemId?: string
  startedAt?: string
  dueAt?: string
  minutesLate: number
  nextAction?: string
  actionHref?: string
  /** Delegada pero sin acuse dentro del umbral (§9). */
  assignedNotAcked: boolean
  /** Trabajo crítico sin responsable activo (§10). */
  noAssignee: boolean
  /** Etapa previa completa; el siguiente actor aún no toma el relevo (§11). */
  waitingForNext: boolean
  /** Etiqueta lista para notificación futura (§15). */
  notificationLabel: string
}

/** Contexto horario demo reproducible (12:02), alineado con priorityQueue. */
const NOW_MIN = 12 * 60 + 2
/** Umbrales deterministas (min). */
const ACK_THRESHOLD = 10

/** "Hoy HH:MM" → minutos desde medianoche (para lateness determinista). */
function labelMinutes(label?: string): number | undefined {
  if (!label) return undefined
  const m = /(\d{1,2}):(\d{2})/.exec(label)
  if (!m) return undefined
  return Number(m[1]) * 60 + Number(m[2])
}

function severityOf(minutesLate: number, blocked: boolean, noAssignee: boolean, assignedNotAcked: boolean): DelaySeverity {
  if (minutesLate <= 0) {
    if (noAssignee) return 'ATTENTION'
    if (assignedNotAcked) return 'ATTENTION'
    return 'ON_TIME'
  }
  let sev: DelaySeverity = minutesLate >= 30 ? 'CRITICAL' : 'LATE'
  if ((blocked || noAssignee) && sev === 'LATE') sev = 'CRITICAL'
  return sev
}

/**
 * Deriva la señal de retraso del episodio de un paciente (o undefined si al día).
 * NO recalcula el motivo/propietario: los toma del Journey (misma fuente).
 */
export function deriveDelaySignal(patient: Patient): DelaySignal | undefined {
  const j = deriveEpisodeJourney(patient)
  const cur = j.currentStage
  // Journey completo o etapa administrada/cerrada → sin retraso (auto-resolución §14).
  if (!cur || cur.status === 'COMPLETED') return undefined

  const orderId = cur.sourceEntityId
  const order = orderId ? getPreparationOrder(orderId) : undefined
  const schedMin = order?.scheduledMinutes ?? labelMinutes(cur.dueAt)
  const isToday = /^hoy/i.test(order?.scheduledAt ?? cur.dueAt ?? '')
  const minutesLate = isToday && schedMin != null && NOW_MIN > schedMin ? NOW_MIN - schedMin : 0

  const owner = j.currentOwner
  const a = j.currentWorkItemId ? getAssignment(j.currentWorkItemId) : undefined
  const assignment = owner?.assignment
  const unassigned = !assignment || assignment === 'UNASSIGNED'
  const assignedNotAcked = a?.status === 'assigned'
  const blocked = j.blocked
  const needsAction = !!j.nextAction

  // Trabajo crítico sin responsable (§10): sin asignar + con acción pendiente + tarde/bloqueado.
  const noAssignee = unassigned && needsAction && (minutesLate > 0 || blocked)
  // Esperando al siguiente actor (§11): etapa lista/liberada pero el propietario no ha iniciado.
  const waitingForNext = cur.type === 'administracion' && minutesLate > 0

  let severity = severityOf(minutesLate, blocked, noAssignee, assignedNotAcked)
  // Sin señal accionable → al día.
  if (severity === 'ON_TIME' && !assignedNotAcked && !noAssignee) return undefined

  // Motivo: reutiliza el del Journey; añade matices de asignación.
  let reason = j.delay?.reason ?? (blocked ? (cur.blocker?.label ?? 'Bloqueada') : `${j.nextAction ?? 'Acción'} pendiente`)
  if (assignedNotAcked && a?.assignedAt) {
    const since = labelMinutes(a.assignedAt)
    const ago = since != null && NOW_MIN > since ? NOW_MIN - since : undefined
    if (ago != null && ago >= ACK_THRESHOLD) reason = `Asignada, pendiente de aceptación (hace ${ago} min)`
    else reason = 'Asignada, pendiente de aceptación'
    if (severity === 'ON_TIME') severity = 'ATTENTION'
  }

  const ownerLabel = owner?.label ?? (owner?.team ?? 'Sin asignar')
  const minLabel = minutesLate > 0 ? `retraso ${minutesLate} min` : (assignedNotAcked ? 'pendiente de aceptación' : 'sin responsable')

  return {
    id: `delay-${patient.id}`,
    sourceEntityType: cur.sourceEntityType, sourceEntityId: orderId,
    patientId: patient.id, patientName: patient.name, journeyId: `jny-${patient.id}`,
    stageId: cur.id, stageLabel: cur.label, severity, reason,
    ownerRole: owner?.role, ownerTeam: owner?.team, ownerUserId: owner?.userId,
    ownerLabel, ownerAssignment: assignment, workItemId: j.currentWorkItemId,
    startedAt: cur.startedAt, dueAt: cur.dueAt, minutesLate,
    nextAction: j.nextAction, actionHref: j.actionHref,
    assignedNotAcked, noAssignee, waitingForNext,
    notificationLabel: `${patient.name} — ${cur.label} · ${minLabel}`,
  }
}

const FAC_ID: Record<string, string> = { Castellana: 'FAC-CAS', 'IPS 48': 'FAC-IPS48', Teusaquillo: 'FAC-TEU' }
function inScope(patientFacility: string, user?: AdminUser): boolean {
  if (!user) return true
  const facId = FAC_ID[patientFacility]
  return !facId || user.scope.facilityIds.includes(facId)
}

const SEV_RANK: Record<DelaySeverity, number> = { CRITICAL: 0, LATE: 1, ATTENTION: 2, ON_TIME: 3 }

/**
 * Todas las señales de retraso activas (para la cola del Coordinador), dentro del
 * alcance del usuario, ordenadas por severidad y minutos. Presentación por rol
 * (§12): filtra por `ownerRole` en cada workspace; la CÁLCULO es único.
 */
export function listDelaySignals(user?: AdminUser, ownerRole?: DemoPersona): DelaySignal[] {
  const out: DelaySignal[] = []
  for (const p of PATIENTS) {
    if (!inScope(p.facility, user)) continue
    const s = deriveDelaySignal(p)
    if (!s) continue
    if (ownerRole && s.ownerRole !== ownerRole) continue
    out.push(s)
  }
  return out.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.minutesLate - a.minutesLate || a.patientName.localeCompare(b.patientName))
}

/** Señal de retraso por id de paciente (para integraciones de UI). */
export function delaySignalFor(patientId: string): DelaySignal | undefined {
  const p = getPatient(patientId)
  return p ? deriveDelaySignal(p) : undefined
}

export const SEVERITY_TEXT: Record<DelaySeverity, string> = {
  ON_TIME: 'A tiempo', ATTENTION: 'Atención', LATE: 'Retrasada', CRITICAL: 'Crítico',
}
export const SEVERITY_TONE: Record<DelaySeverity, 'ok' | 'warn' | 'crit' | 'info'> = {
  ON_TIME: 'ok', ATTENTION: 'warn', LATE: 'warn', CRITICAL: 'crit',
}
