import type { DemoPersona } from './workspaces'

/**
 * Catálogo de motivos de RECHAZO de Enfermería sobre una preparación liberada.
 * Cada motivo enruta la resolución al equipo responsable (por rol/capacidad), sin
 * ramificar por cliente. Enfermería es la barrera final de seguridad.
 */
export type RejectionReasonCode =
  | 'paciente-no-corresponde' | 'medicamento-no-corresponde' | 'dosis-no-corresponde'
  | 'horario-incorrecto' | 'identificacion-inconsistente' | 'etiqueta-incorrecta'
  | 'integridad-comprometida' | 'conservacion' | 'orden-modificada' | 'condicion-clinica' | 'otro'

export interface RejectionReasonDef {
  code: RejectionReasonCode
  label: string
  /** Rol/equipo que resuelve el rechazo. */
  ownerRole: DemoPersona
  ownerLabel: string
}

export const REJECTION_REASONS: RejectionReasonDef[] = [
  { code: 'paciente-no-corresponde', label: 'Paciente no corresponde', ownerRole: 'qf-clinico', ownerLabel: 'Farmacia Clínica' },
  { code: 'medicamento-no-corresponde', label: 'Medicamento no corresponde', ownerRole: 'qf-clinico', ownerLabel: 'Farmacia Clínica' },
  { code: 'dosis-no-corresponde', label: 'Dosis no corresponde', ownerRole: 'qf-clinico', ownerLabel: 'Farmacia Clínica' },
  { code: 'identificacion-inconsistente', label: 'Identificación inconsistente', ownerRole: 'qf-clinico', ownerLabel: 'Farmacia Clínica' },
  { code: 'condicion-clinica', label: 'Condición clínica del paciente', ownerRole: 'qf-clinico', ownerLabel: 'Farmacia Clínica' },
  { code: 'orden-modificada', label: 'Orden modificada', ownerRole: 'qf-clinico', ownerLabel: 'Farmacia Clínica' },
  { code: 'etiqueta-incorrecta', label: 'Etiqueta incorrecta', ownerRole: 'qf-mezclas', ownerLabel: 'Central de Mezclas' },
  { code: 'integridad-comprometida', label: 'Integridad comprometida', ownerRole: 'qf-mezclas', ownerLabel: 'Central de Mezclas' },
  { code: 'conservacion', label: 'Condición de conservación', ownerRole: 'qf-mezclas', ownerLabel: 'Central de Mezclas' },
  { code: 'horario-incorrecto', label: 'Horario incorrecto', ownerRole: 'coordinador', ownerLabel: 'Coordinación' },
  { code: 'otro', label: 'Otro', ownerRole: 'coordinador', ownerLabel: 'Coordinación' },
]

export const getRejectionReason = (code: RejectionReasonCode): RejectionReasonDef =>
  REJECTION_REASONS.find((r) => r.code === code) ?? REJECTION_REASONS[REJECTION_REASONS.length - 1]
