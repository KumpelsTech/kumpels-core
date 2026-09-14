/**
 * Dominio de ATENCIÓN FARMACÉUTICA / SEGUIMIENTO — separado del paciente.
 * Enlazado por id. Un seguimiento puede derivar luego en un PRM o intervención,
 * pero ese workflow NO es parte de esta tarea.
 */

export type CareMode = 'seguimiento' | 'entrevista-inicial'
export type DomainState = 'ok' | 'warn' | 'na'
export type FollowUpStatusKind = 'al-dia' | 'requerido' | 'vencido' | 'entrevista-pendiente' | 'completado'

/** Dominios núcleo del seguimiento farmacoterapéutico. */
export interface CareDomain {
  key: string
  label: string
  state: DomainState
  note: string
}

export interface PharmaceuticalCareEnrollment {
  patientId: string
  mode: CareMode
  status: FollowUpStatusKind
  statusLabel: string
  required: boolean
  lastAssessment?: string
  nextFollowUp: string
  responsible: string
  setting?: string
  /** Intensidad / prioridad de la atención, solo cuando es relevante. */
  intensity?: string
  domains: CareDomain[]
}

/** Evaluación de seguimiento registrada por el profesional (no es una intervención). */
export interface FollowUpAssessment {
  patientId: string
  mode: CareMode
  at: string
  by: string
  continuidad: string
  usoReportado?: string
  seguridad?: string
  cambios?: string
  acceso?: string
  observation?: string
  nextFollowUp: string
  /** true si el autoreporte/síntomas requieren revisión profesional posterior. */
  needsProfessionalReview: boolean
}

export interface FollowUpPlan {
  next: string
}
