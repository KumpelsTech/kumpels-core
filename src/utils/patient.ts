import type { Category, Patient, Priority } from '../types/patient'

/**
 * Lógica de dominio del paciente — pura, sin JSX ni acceso al DOM.
 * Las vistas consumen estos helpers en vez de reimplementar reglas.
 */

export const PRIORITY_META: Record<Priority, { label: string; cls: 'hi' | 'action' | 'monitor' }> = {
  HIGH: { label: 'Alta', cls: 'hi' },
  ACTION: { label: 'Acción', cls: 'action' },
  MONITOR: { label: 'Monitoreo', cls: 'monitor' },
}

export const PRIORITY_ORDER: Record<Priority, number> = { HIGH: 0, ACTION: 1, MONITOR: 2 }

/** Color de la categoría (fondo, texto) usando tokens del sistema. */
export function categoryColors(cat: Category): { bg: string; fg: string } {
  const map: Partial<Record<Category, [string, string]>> = {
    'REVISIÓN CLÍNICA': ['var(--info-bg)', 'var(--accent-ink)'],
    REABASTECIMIENTO: ['var(--warn-bg)', '#B26A05'],
    PENDIENTE: ['var(--warn-bg)', '#B26A05'],
    'NUEVO PACIENTE': ['var(--ok-bg)', '#1F7A4E'],
    AUTORIZACIÓN: ['var(--warn-bg)', '#B26A05'],
    SEGUIMIENTO: ['var(--warn-bg)', '#B26A05'],
    PROGRAMADO: ['var(--neutral-bg)', '#556280'],
    REVISADO: ['var(--ok-bg)', '#1F7A4E'],
    APLICACIÓN: ['var(--neutral-bg)', '#556280'],
    DISPENSACIÓN: ['var(--neutral-bg)', '#556280'],
    'ALTO COSTO': ['var(--neutral-bg)', '#556280'],
  }
  const [bg, fg] = map[cat] ?? ['var(--surface-2)', 'var(--ink-2)']
  return { bg, fg }
}

/** Rol/equipo responsable de la próxima acción, derivado de la categoría. */
export function nextActionOwner(p: Patient): string {
  switch (p.category) {
    case 'REVISIÓN CLÍNICA':
    case 'NUEVO PACIENTE':
    case 'REABASTECIMIENTO':
    case 'SEGUIMIENTO':
      return `Farmacéutica clínica · ${p.team.pharm}`
    case 'AUTORIZACIÓN':
      return 'Mesa de control · Autorizaciones'
    case 'PENDIENTE':
    case 'DISPENSACIÓN':
      return `Farmacia · ${p.facility}`
    default:
      return `Equipo asistencial · ${p.facility}`
  }
}

/** Verbo de acción para el hero (imperativo claro). */
export function nextActionVerb(p: Patient): string {
  if (p.next === 'Revisar tratamiento') return 'Iniciar revisión'
  return p.next
}

/** ¿Mostrar ciclo? Solo cuando es un ciclo real (no continuo ni ausente). */
export function showsCycle(p: Patient): boolean {
  return !!p.cycle && p.cycle !== 'Continuo'
}

/** Estado de la próxima aplicación/dispensación operativa relevante, si aplica. */
export function operationalHighlight(p: Patient): { label: string; value: string; kind: 'warn' | 'ok' | 'info' } | null {
  switch (p.category) {
    case 'PENDIENTE':
      return { label: 'Dispensación', value: '2 de 3 entregadas · 1 pendiente (Sep 5)', kind: 'warn' }
    case 'AUTORIZACIÓN':
      return { label: 'Autorización', value: 'Pendiente — bloquea programación', kind: 'warn' }
    case 'REABASTECIMIENTO':
      return { label: 'Reabastecimiento', value: 'Vencido hace 4 días', kind: 'warn' }
    case 'SEGUIMIENTO':
      return { label: 'Seguimiento', value: 'Vencido hace 3 días', kind: 'warn' }
    case 'DISPENSACIÓN':
      return { label: 'Dispensación', value: 'Lista · medicamento disponible', kind: 'ok' }
    case 'APLICACIÓN':
      return { label: 'Próxima aplicación', value: p.nextTx.replace('Aplicación: ', ''), kind: 'info' }
    case 'PROGRAMADO':
      return { label: 'Tratamiento', value: p.nextTx, kind: 'info' }
    default:
      return null
  }
}

export const authBadgeKind = (status: Patient['auth']['status']): 'ok' | 'action' | 'plain' => {
  if (status === 'Validada' || status === 'Recibida' || status === 'No requerida') return 'ok'
  if (status === 'Pendiente') return 'action'
  return 'plain'
}

/** Iniciales de un nombre (ignora prefijos Dr/Dra). */
export function initialsOf(name: string): string {
  if (!name || name === '—') return '·'
  const clean = name.replace(/^(Dra?\.?)\s*/i, '').trim()
  const parts = clean.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·'
}
