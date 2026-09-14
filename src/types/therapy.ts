import type { AuthStatus, Modality } from './patient'

/**
 * Dominio de TERAPIA — separado del registro del paciente.
 * Un paciente tiene un plan de terapia con uno o varios medicamentos
 * (esquema combinado). No duplica datos del paciente; se enlaza por id.
 */

export type MedStatus = 'Activo' | 'En curso' | 'Pausado' | 'Pendiente' | 'Suspendido'

export interface Medication {
  name: string
  dose: string
  /** Vía de administración: IV, Oral, SC, IM… */
  route: string
  /** Frecuencia / schedule. */
  schedule: string
  status: MedStatus
}

/** Estado de ciclos desambiguado (evita un único "Ciclo 4/6"). */
export interface CycleState {
  lastCompleted?: string
  currentOrNext?: string
  /** Para tratamientos continuos sin ciclos discretos. */
  phase?: string
}

export interface TherapyPlan {
  /** Esquema/protocolo legible. */
  scheme: string
  modality: Modality
  /** Estado del tratamiento. */
  status: string
  /** Inicio, cuando está disponible. */
  start?: string
  /** Patrón/cadencia del tratamiento. */
  pattern: string
  cycle: CycleState
  isCombination: boolean
}

/** Resumen de acceso / estado operativo (solo lectura; sin workflows aquí). */
export interface TherapyAccess {
  authStatus: AuthStatus
  authRef?: string
  lastDispensation?: string
  /** Próxima dispensación o aplicación. */
  nextEvent?: string
  /** Estado de disponibilidad del medicamento. */
  availability?: string
}

export interface TherapyDetail {
  plan: TherapyPlan
  medications: Medication[]
  access?: TherapyAccess
  /** Nota clínica breve del esquema (p. ej. concurrencia con radioterapia). */
  note?: string
}
