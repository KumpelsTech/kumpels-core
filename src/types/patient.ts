/**
 * Modelo de dominio del paciente — fuente única para todo Kumpels Core.
 * No duplicar este modelo en las vistas: las pantallas consumen `Patient`.
 * El modelo se ampliará en iteraciones futuras (Farmacoterapia, Seguimiento,
 * Historial). Por ahora cubre Patient 360 · Resumen.
 */

export type Priority = 'HIGH' | 'ACTION' | 'MONITOR'
export type Modality = 'IV' | 'Infusión' | 'Oral' | 'SC'

/** Categoría operativa/clínica que explica por qué el paciente requiere atención. */
export type Category =
  | 'REVISIÓN CLÍNICA'
  | 'REABASTECIMIENTO'
  | 'PENDIENTE'
  | 'NUEVO PACIENTE'
  | 'AUTORIZACIÓN'
  | 'SEGUIMIENTO'
  | 'PROGRAMADO'
  | 'REVISADO'
  | 'APLICACIÓN'
  | 'DISPENSACIÓN'
  | 'ALTO COSTO'

export type JourneyState = 'done' | 'current' | 'warning' | 'blocked' | 'upcoming'
export interface JourneyStage {
  label: string
  state: JourneyState
  sub?: string
}

export type DueKind = 'late' | 'soon' | ''

export interface CareTeam {
  pharm: string
  onc: string
  nurse: string
}

export type AuthStatus = 'Validada' | 'Recibida' | 'Pendiente' | 'No requerida'
export interface Authorization {
  status: AuthStatus
  payer: string
  ref?: string
  ts?: string
}

export interface ClinicalSnapshot {
  alergias?: string
  peso?: string
  talla?: string
  bsa?: string
  labs?: string
  renal?: string
  hepatica?: string
}

export interface PharmaceuticalCare {
  prog: string
  last: string
  adher: string
  nextFu: string
}

export interface ClinicalAlert {
  sev: Priority
  title: string
  param: string
  criterion: string
  source: string
  created: string
  reviewStatus: string
}

export interface Intervention {
  date: string
  by: string
  cat: string
  context: string
  action: string
  status: string
}

/** Ruta destino conceptual de la próxima acción (para etiquetar, no navega aún). */
export type NextRoute = 'patient' | 'clinical' | 'ops'

export interface Patient {
  id: string
  name: string
  initials: string
  age?: number
  sex?: 'F' | 'M'

  facility: string
  payer: string
  dx?: string
  modality: Modality
  protocol?: string
  /** 'Continuo' o "n / N"; se muestra solo cuando aplica. */
  cycle?: string

  priority: Priority
  category: Category
  status: string

  /** Motivo corto de priorización (para listas y Next Action). */
  reason: string
  /** Observación contextual del episodio. */
  obs: string
  obsWarn: boolean

  next: string
  nextRoute: NextRoute
  due?: string
  dueKind?: DueKind

  journey: JourneyStage[]
  team: CareTeam
  auth: Authorization
  clinical: ClinicalSnapshot
  care: PharmaceuticalCare
  med: string
  nextTx: string
  alert: ClinicalAlert
  intervention: Intervention
  summary: string

  /** Aparece en la cola de Revisión Clínica. */
  requiresReview: boolean
}
