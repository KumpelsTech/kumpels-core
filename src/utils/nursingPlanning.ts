import type { PreparationView } from '../types/preparation'
import type { ProductionRequest } from '../types/production'
import { listPreparationViews } from './preparationStore'
import { getProductionRequest } from './productionStore'

/**
 * Derivación de PLANEACIÓN de Enfermería ("Pacientes próximos"). Reutiliza el
 * readiness de preparación (no duplica Medication Intelligence): un tratamiento
 * puede enviarse a producción solo cuando sus requisitos están listos. Muestra el
 * porqué cuando no está listo.
 */
export type PlanDay = 'hoy' | 'manana'

export interface NursingPlanItem {
  prep: PreparationView
  request?: ProductionRequest
  day: PlanDay
  /** Requisitos listos y aún sin enviar → puede enviarse a producción. */
  readyToSend: boolean
  sent: boolean
  accepted: boolean
  cancelled: boolean
  /** Motivos por los que aún no puede enviarse (readiness reutilizado). */
  blockingReasons: string[]
}

function reasonOf(key: string, label: string): string {
  if (key === 'clinical-review') return 'Revisión clínica pendiente'
  if (key === 'autorizacion') return 'Autorización no completada'
  if (key === 'dosis-final') return 'Dosis final no confirmada'
  if (key === 'datos-paciente') return 'Perfil basal / datos del paciente pendientes'
  if (key === 'info-preparacion') return 'Información de preparación incompleta'
  return label
}

const dayOf = (scheduledAt: string): PlanDay => (/^hoy/i.test(scheduledAt) ? 'hoy' : 'manana')

/** Items de planeación (tratamientos aún no iniciados en producción). */
export function nursingPlanItems(): NursingPlanItem[] {
  return listPreparationViews()
    .filter((v) => !v.instance?.startedAt && !v.superseded)
    .map((v) => {
      const request = getProductionRequest(v.order.id)
      const sent = request?.status === 'SENT_TO_PRODUCTION' || request?.status === 'ACCEPTED_BY_COMPOUNDING'
      const unmet = v.readiness.requirements.filter((r) => !r.met)
      return {
        prep: v, request, day: dayOf(v.order.scheduledAt),
        readyToSend: v.readiness.ready && !sent,
        sent, accepted: request?.status === 'ACCEPTED_BY_COMPOUNDING', cancelled: request?.status === 'CANCELLED',
        blockingReasons: unmet.map((r) => reasonOf(r.key, r.label)),
      }
    })
}
