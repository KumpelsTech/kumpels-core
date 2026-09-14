import type { Priority } from './patient'

/**
 * Dominio de REVISIÓN — separado del paciente y de la terapia.
 * Cadena conceptual: Validation Run → Validation Results → Finding → Professional Review.
 * Un Finding NO es automáticamente un error de medicación, un PRM ni una intervención.
 * La revisión profesional es una decisión humana, distinta de la detección automática.
 */

export type FindingKind = 'review' | 'info' | 'insufficient'

export type FindingStatus =
  | 'Revisión profesional requerida'
  | 'Requiere confirmación profesional'
  | 'Informativo'
  | 'Dato insuficiente'

export interface Finding {
  id: string
  /** Dominio / tipo del hallazgo (laboratorio, acceso, adherencia, conciliación…). */
  domain: string
  kind: FindingKind
  /** Severidad solo para hallazgos que requieren atención. */
  severity?: Priority
  /** Qué lo disparó. */
  trigger: string
  /** Dato del paciente que se usó. */
  patientData: string
  /** Criterio configurado. */
  criterion: string
  /** Fuente / protocolo / regla. */
  source: string
  status: FindingStatus
}

export interface ValidationSummary {
  total: number
  sinHallazgos: number
  informativas: number
  requierenRevision: number
  datosInsuficientes: number
}

export interface ValidationRun {
  summary: ValidationSummary
  ranAt: string
  engine: string
  findings: Finding[]
  /** Muestra representativa de verificaciones sin hallazgos (no se listan todas). */
  passedSample?: string[]
}

/** Decisión profesional registrada sobre un hallazgo (no es una intervención completa). */
export type ReviewOutcome = 'Confirmado' | 'Descartado' | 'Pendiente'
export interface ProfessionalReview {
  outcome: ReviewOutcome
  comment?: string
  by: string
  at: string
}
