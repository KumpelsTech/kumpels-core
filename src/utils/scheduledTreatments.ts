import type { AdminUser } from '../types/admin'
import type { PreparationView } from '../types/preparation'
import type { StageOwner } from '../types/journeyStage'
import { listPreparationViews } from './preparationStore'
import { getProductionRequest } from './productionStore'
import { getAdministrationForOrder } from './administrationStore'
import { deriveEpisodeJourney } from './episodeJourney'
import { hasCapability } from './eligibility'
import { getPatient } from '../data/patients'

/**
 * Proyección de PLANEACIÓN de Enfermería: tratamientos oncológicos próximos. NO es
 * un calendario nuevo ni una fuente de verdad: DERIVA de Paciente + Orden/Instancia
 * de preparación + ProductionRequest + Administración + Journey. Las etiquetas son
 * proyecciones del estado de dominio/Journey (no un modelo de estado separado).
 */

export type ReadinessLabel =
  | 'LISTO' | 'BLOQUEADO' | 'ENVIADO_A_PRODUCCION' | 'EN_PRODUCCION'
  | 'LISTO_PARA_ADMINISTRAR' | 'ADMINISTRADO'

export const READINESS_TEXT: Record<ReadinessLabel, string> = {
  LISTO: 'Listo', BLOQUEADO: 'Bloqueado', ENVIADO_A_PRODUCCION: 'Enviado a producción',
  EN_PRODUCCION: 'En producción', LISTO_PARA_ADMINISTRAR: 'Listo para administrar', ADMINISTRADO: 'Administrado',
}
export const READINESS_TONE: Record<ReadinessLabel, 'ok' | 'warn' | 'crit' | 'info'> = {
  LISTO: 'warn', BLOQUEADO: 'crit', ENVIADO_A_PRODUCCION: 'info',
  EN_PRODUCCION: 'info', LISTO_PARA_ADMINISTRAR: 'ok', ADMINISTRADO: 'ok',
}

export type PlanDay = 'hoy' | 'manana'
export type TimeBucket = 'overdue' | 'soon' | 'today' | 'tomorrow'

export interface ScheduledTreatmentView {
  patientId: string
  patientName: string
  initials: string
  scheduledAt: string
  scheduledMinutes: number
  day: PlanDay
  timeBucket: TimeBucket
  therapy?: string
  cycleDay?: string
  modality: string
  medication: string
  preparationOrderId: string
  /** Etapa/propietario del Journey (misma proyección que Journeys/Patient 360). */
  journeyStage?: string
  currentOwner?: StageOwner
  nextOwner?: StageOwner
  nextAction?: string
  actionHref?: string
  readiness: ReadinessLabel
  productionStatus?: string
  blocker?: { label: string; responsible?: string }
  releasedBy?: string
  releasedAt?: string
  administeredAt?: string
  /** Acciones de Enfermería habilitadas para el usuario (capacidad + estado). */
  canSend: boolean
  canAdminister: boolean
}

const FAC_ID: Record<string, string> = { Castellana: 'FAC-CAS', 'IPS 48': 'FAC-IPS48', Teusaquillo: 'FAC-TEU' }

/** ¿El paciente está dentro del alcance (sede) del usuario? Reutiliza scope. */
function inScope(patientFacility: string, user?: AdminUser): boolean {
  if (!user) return true
  const facId = FAC_ID[patientFacility]
  if (!facId) return true
  return user.scope.facilityIds.includes(facId)
}

const DEMO_NOW = 12 * 60 + 2 // 12:02, contexto demo reproducible (igual que priorityQueue)
const dayOf = (scheduledAt: string): PlanDay => (/^ma[ñn]ana/i.test(scheduledAt) ? 'manana' : 'hoy')

function bucketOf(day: PlanDay, minutes: number): TimeBucket {
  if (day === 'manana') return 'tomorrow'
  if (minutes < DEMO_NOW) return 'overdue'
  if (minutes - DEMO_NOW <= 60) return 'soon'
  return 'today'
}

function readinessOf(v: PreparationView, sent: boolean, administered: boolean): ReadinessLabel {
  if (administered) return 'ADMINISTRADO'
  if (v.rejection || v.status === 'bloqueada' || v.status === 'pendiente-validacion') return 'BLOQUEADO'
  if (v.status === 'liberada') return 'LISTO_PARA_ADMINISTRAR'
  if (v.status === 'verificada' || v.status === 'pendiente-verificacion' || v.status === 'en-preparacion') return 'EN_PRODUCCION'
  if (v.status === 'lista') return sent ? 'ENVIADO_A_PRODUCCION' : (v.productionGate ? 'LISTO' : 'EN_PRODUCCION')
  return 'LISTO'
}

/** Estado de producción granular (§7) — de ProductionRequest + estado de preparación. */
function productionStatusOf(v: PreparationView): string | undefined {
  const prod = getProductionRequest(v.order.id)
  if (v.productionGate) return 'Pendiente de envío'
  if (v.status === 'lista' && prod?.status === 'SENT_TO_PRODUCTION') return 'Enviada a producción'
  if (v.status === 'lista' && prod?.status === 'ACCEPTED_BY_COMPOUNDING') return 'Aceptada por Mezclas'
  if (v.status === 'en-preparacion') return 'En preparación'
  if (v.status === 'pendiente-verificacion') return 'Pendiente de verificación'
  if (v.status === 'verificada') return 'Verificada'
  if (v.status === 'liberada') return 'Liberada'
  return undefined
}

/** Tratamientos oncológicos próximos, ordenados cronológicamente, dentro del alcance. */
export function nursingScheduledTreatments(user?: AdminUser): ScheduledTreatmentView[] {
  const canSendCap = !!user && hasCapability(user, 'PRODUCTION_REQUEST_SEND')
  const canAdminCap = !!user && hasCapability(user, 'MEDICATION_ADMINISTRATION')
  const out: ScheduledTreatmentView[] = []
  for (const v of listPreparationViews()) {
    if (v.superseded) continue
    const patient = getPatient(v.order.patientId)
    if (patient && !inScope(patient.facility, user)) continue
    const orderId = v.order.id
    const prod = getProductionRequest(orderId)
    const sent = prod?.status === 'SENT_TO_PRODUCTION' || prod?.status === 'ACCEPTED_BY_COMPOUNDING'
    const admin = getAdministrationForOrder(orderId)
    const administered = !!admin && admin.result === 'administrada'
    const readiness = readinessOf(v, sent, administered)
    const day = dayOf(v.order.scheduledAt)
    // Propietario/etapa/próxima acción — reutiliza el Journey (no se recalcula aquí).
    const journey = patient ? deriveEpisodeJourney(patient) : undefined
    out.push({
      patientId: v.order.patientId, patientName: v.order.patientName, initials: patient?.initials ?? '',
      scheduledAt: v.order.scheduledAt, scheduledMinutes: v.order.scheduledMinutes, day, timeBucket: bucketOf(day, v.order.scheduledMinutes),
      therapy: v.order.protocol, cycleDay: v.order.cycleDay, modality: patient?.modality ?? 'IV', medication: v.order.medication,
      preparationOrderId: orderId,
      journeyStage: journey?.currentStage?.label, currentOwner: journey?.currentOwner, nextOwner: journey?.nextOwner,
      nextAction: journey?.nextAction, actionHref: journey?.actionHref,
      readiness, productionStatus: productionStatusOf(v),
      blocker: (readiness === 'BLOQUEADO' && v.blocker) ? { label: v.blocker.label, responsible: v.blocker.responsible } : undefined,
      releasedBy: v.instance?.releasedBy, releasedAt: v.instance?.releasedAt, administeredAt: admin?.completedAt ?? admin?.at,
      canSend: canSendCap && !!v.productionGate,
      canAdminister: canAdminCap && v.status === 'liberada' && !administered,
    })
  }
  return out.sort((a, b) => (a.day === b.day ? 0 : a.day === 'hoy' ? -1 : 1) || a.scheduledMinutes - b.scheduledMinutes)
}
