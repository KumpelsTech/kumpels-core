import type { IconName } from '../components/Icon'

/**
 * Configuración CENTRAL de workspaces por rol (demo). Un solo lugar define qué
 * ve y qué puede hacer cada persona; los componentes leen esta config en vez de
 * dispersar if-statements. Conceptos distintos:
 *   User (persona/sesión) ≠ Role (responsabilidad) ≠ Scope (a qué accede) ≠ Workspace (config de UI).
 *
 * Esto NO es RBAC/IAM: solo reglas de VISIBILIDAD de workspace. La estructura
 * queda lista para conectar autorización real más adelante.
 */

export type DemoPersona = 'coordinador' | 'qf-clinico' | 'qf-mezclas' | 'enfermeria' | 'admin'

/** Acciones gobernadas por rol (claves, no lógica). */
export type ActionKey =
  | 'ver-caso' | 'revisar' | 'seguimiento'
  | 'preparar' | 'verificar' | 'liberar' | 'seleccionar-lote'
  | 'registrar-administracion' | 'reasignar'

/** Secciones de Patient 360 (workspace compartido, visibilidad adaptada). */
export type SectionKey = 'ahora' | 'atencion' | 'tratamiento' | 'operacion' | 'seguimiento' | 'actividad'

/** Clave de navegación (destino real; se reutilizan rutas y datos del Core). */
export type NavKey =
  | 'hoy' | 'pacientes' | 'journeys' | 'revision' | 'seguimiento-nav'
  | 'operaciones' | 'preparacion' | 'trazabilidad' | 'administracion' | 'analitica' | 'configuracion'

interface NavItemDef { label: string; icon: IconName; to?: string }
/** Referencia de nav: clave, o clave con override de etiqueta/ícono para el rol. */
export type NavRef = NavKey | { key: NavKey; label?: string; icon?: IconName }

/** Catálogo de destinos de navegación (rutas existentes del Core). */
export const NAV_CATALOG: Record<NavKey, NavItemDef> = {
  hoy: { label: 'Hoy', icon: 'home', to: '/today' },
  pacientes: { label: 'Pacientes', icon: 'users', to: '/patients' },
  journeys: { label: 'Journeys', icon: 'route', to: '/journeys' },
  revision: { label: 'Revisión Clínica', icon: 'stethoscope', to: '/clinical-review' },
  'seguimiento-nav': { label: 'Seguimiento', icon: 'refresh', to: '/today?focus=seguimiento' },
  operaciones: { label: 'Operaciones de Medicación', icon: 'box', to: '/medication-operations' },
  preparacion: { label: 'Preparación estéril', icon: 'drop', to: '/medication-operations?ws=preparacion' },
  trazabilidad: { label: 'Trazabilidad', icon: 'route', to: '/medication-operations?ws=preparacion&trace=1' },
  administracion: { label: 'Tratamientos / Administración', icon: 'syringe', to: '/today?focus=administracion' },
  analitica: { label: 'Analítica', icon: 'chart' }, // placeholder (sin ruta aún)
  configuracion: { label: 'Configuración', icon: 'gear', to: '/config' },
}

export interface WorkspaceProfile {
  persona: DemoPersona
  label: string
  short: string
  userName: string
  roleLabel: string
  initials: string
  nav: NavRef[]
  sections: SectionKey[]
  actions: ActionKey[]
}

export const WORKSPACES: Record<DemoPersona, WorkspaceProfile> = {
  coordinador: {
    persona: 'coordinador', label: 'Coordinador farmacéutico', short: 'Coordinador',
    userName: 'Sandra Garzón', roleLabel: 'Coordinación Farmacéutica', initials: 'SG',
    nav: ['hoy', 'pacientes', 'journeys', 'revision', 'operaciones', 'analitica', 'configuracion'],
    sections: ['ahora', 'atencion', 'tratamiento', 'operacion', 'seguimiento', 'actividad'],
    actions: ['ver-caso'],
  },
  'qf-clinico': {
    persona: 'qf-clinico', label: 'QF clínico', short: 'QF clínico',
    userName: 'Ximena Torres', roleLabel: 'Farmacia Clínica', initials: 'XT',
    nav: ['hoy', 'pacientes', 'revision', 'seguimiento-nav', 'journeys'],
    sections: ['ahora', 'atencion', 'tratamiento', 'seguimiento', 'actividad'],
    actions: ['ver-caso', 'revisar', 'seguimiento'],
  },
  'qf-mezclas': {
    persona: 'qf-mezclas', label: 'QF Central de Mezclas', short: 'Central de Mezclas',
    userName: 'Andrés Mejía', roleLabel: 'Central de Mezclas', initials: 'AM',
    nav: ['hoy', 'preparacion', 'operaciones', 'trazabilidad', 'pacientes'],
    sections: ['ahora', 'operacion', 'tratamiento', 'actividad'],
    actions: ['ver-caso', 'preparar', 'verificar', 'liberar', 'seleccionar-lote'],
  },
  enfermeria: {
    persona: 'enfermeria', label: 'Enfermería', short: 'Enfermería',
    userName: 'Equipo de Enfermería', roleLabel: 'Enfermería', initials: 'EN',
    nav: ['hoy', 'pacientes', 'administracion', { key: 'operaciones', label: 'Estado de medicación', icon: 'pill' }],
    sections: ['ahora', 'tratamiento', 'operacion', 'actividad'],
    actions: ['ver-caso', 'registrar-administracion'],
  },
  admin: {
    persona: 'admin', label: 'Administrador institucional', short: 'Administrador',
    userName: 'Juan Restrepo', roleLabel: 'Administración institucional', initials: 'JR',
    nav: ['configuracion', 'pacientes', 'journeys'],
    sections: ['ahora', 'tratamiento', 'actividad'],
    actions: ['ver-caso'],
  },
}

export const PERSONA_ORDER: DemoPersona[] = ['coordinador', 'qf-clinico', 'qf-mezclas', 'enfermeria', 'admin']

/** Clave de nav activa para una ubicación (para resaltar el ítem correcto). */
export function activeNavKey(pathname: string, search: string): NavKey {
  const p = new URLSearchParams(search)
  if (pathname.startsWith('/today')) {
    const f = p.get('focus')
    if (f === 'seguimiento') return 'seguimiento-nav'
    if (f === 'administracion') return 'administracion'
    return 'hoy'
  }
  if (pathname.startsWith('/patients')) return 'pacientes'
  if (pathname.startsWith('/journeys')) return 'journeys'
  if (pathname.startsWith('/clinical-review')) return 'revision'
  if (pathname.startsWith('/config')) return 'configuracion'
  if (pathname.startsWith('/medication-operations')) {
    const ws = p.get('ws') ?? 'cumplimiento'
    if (ws === 'preparacion') return p.get('trace') ? 'trazabilidad' : 'preparacion'
    return 'operaciones'
  }
  return 'hoy'
}

export const navRefKey = (r: NavRef): NavKey => (typeof r === 'string' ? r : r.key)
export function navRefDef(r: NavRef): NavItemDef {
  const base = NAV_CATALOG[navRefKey(r)]
  if (typeof r === 'string') return base
  return { ...base, label: r.label ?? base.label, icon: r.icon ?? base.icon }
}
