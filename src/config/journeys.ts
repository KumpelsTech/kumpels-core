import type { DemoPersona } from './workspaces'
import type { JourneyType } from '../types/journeyStage'

/**
 * DEFINICIONES de journey (configurables para Solution Packs futuros). Cada tipo de
 * journey declara sus etapas en orden, con el propietario POR DEFECTO (rol + equipo)
 * de cada etapa. El estado real de cada etapa se DERIVA de los dominios; el
 * propietario efectivo se toma de los WorkItems (usuario asignado) cuando existe.
 *
 * No toda modalidad muestra todas las etapas: la IV oncológica no se fuerza sobre
 * terapia oral ni sobre dispensación.
 */
export interface StageDef {
  type: string
  label: string
  ownerRole?: DemoPersona
  ownerTeam?: string
}

export const JOURNEY_DEFS: Record<JourneyType, StageDef[]> = {
  // Oncología IV (mezcla estéril): 9 etapas.
  'oncology-iv': [
    { type: 'programado', label: 'Programado' },
    { type: 'revision-clinica', label: 'Revisión clínica', ownerRole: 'qf-clinico', ownerTeam: 'Farmacia Clínica' },
    { type: 'enfermeria-readiness', label: 'Enfermería / readiness', ownerRole: 'enfermeria', ownerTeam: 'Enfermería' },
    { type: 'enviado-produccion', label: 'Enviado a producción', ownerRole: 'qf-mezclas', ownerTeam: 'Central de Mezclas' },
    { type: 'preparacion', label: 'Preparación', ownerRole: 'qf-mezclas', ownerTeam: 'Central de Mezclas' },
    { type: 'verificacion', label: 'Verificación', ownerRole: 'qf-mezclas', ownerTeam: 'Central de Mezclas' },
    { type: 'liberacion', label: 'Liberación', ownerRole: 'qf-mezclas', ownerTeam: 'Central de Mezclas' },
    { type: 'administracion', label: 'Administración', ownerRole: 'enfermeria', ownerTeam: 'Enfermería' },
    { type: 'seguimiento', label: 'Seguimiento', ownerRole: 'qf-clinico', ownerTeam: 'Farmacia Clínica' },
  ],
  // Terapia oral: sin Central de Mezclas / verificación / liberación.
  'oral': [
    { type: 'tratamiento-activo', label: 'Tratamiento activo' },
    { type: 'dispensacion-acceso', label: 'Dispensación / acceso', ownerRole: 'farmacia', ownerTeam: 'Farmacia / Dispensación' },
    { type: 'seguimiento', label: 'Seguimiento farmacoterapéutico', ownerRole: 'qf-clinico', ownerTeam: 'Farmacia Clínica' },
    { type: 'proximo-seguimiento', label: 'Próximo seguimiento', ownerRole: 'qf-clinico', ownerTeam: 'Farmacia Clínica' },
  ],
  // Cumplimiento / dispensación (pendiente reutiliza el estado de cumplimiento).
  'fulfillment': [
    { type: 'orden', label: 'Orden' },
    { type: 'disponibilidad', label: 'Disponibilidad', ownerRole: 'farmacia', ownerTeam: 'Farmacia / Dispensación' },
    { type: 'dispensacion', label: 'Dispensación', ownerRole: 'farmacia', ownerTeam: 'Farmacia / Dispensación' },
    { type: 'contacto', label: 'Contacto', ownerRole: 'farmacia', ownerTeam: 'Farmacia / Dispensación' },
    { type: 'entrega', label: 'Entrega', ownerRole: 'farmacia', ownerTeam: 'Farmacia / Dispensación' },
    { type: 'completo', label: 'Completo' },
  ],
}
