import type { JourneyStage, Patient } from '../types/patient'
import type { JourneyException, JourneyView, ProcessState, ProcessTrack } from '../types/journey'
import { nextActionOwner, showsCycle } from './patient'

/**
 * Capa de dominio del journey. Deriva la vista del episodio a partir del
 * paciente compartido — las páginas no calculan estado de journey por su cuenta.
 */

function mapState(s: JourneyStage['state']): ProcessState {
  switch (s) {
    case 'done': return 'done'
    case 'current': return 'active'
    case 'warning': return 'warning'
    case 'blocked': return 'blocked'
    default: return 'pending'
  }
}

const STATE_LABEL: Record<ProcessState, string> = {
  done: 'completado', active: 'en curso', warning: 'atención', blocked: 'bloqueado', pending: 'pendiente', na: '—',
}

function findStage(p: Patient, labels: string[]): JourneyStage | undefined {
  return p.journey.find((s) => labels.includes(s.label))
}

function track(p: Patient, name: string, labels: string[]): ProcessTrack {
  const st = findStage(p, labels)
  const state: ProcessState = st ? mapState(st.state) : 'na'
  return { name, state, note: st?.sub || STATE_LABEL[state] }
}

/** Etapa en foco: blocked > warning > current > primera upcoming > última done. */
function focusStage(p: Patient): JourneyStage {
  const byState = (s: JourneyStage['state']) => p.journey.find((x) => x.state === s)
  return (
    byState('blocked') ??
    byState('warning') ??
    byState('current') ??
    byState('upcoming') ??
    p.journey[p.journey.length - 1]
  )
}

/** Etiqueta del proceso de preparación/dispensación según la modalidad. */
function fulfillmentTrack(p: Patient): ProcessTrack {
  if (p.modality === 'Oral' || p.modality === 'SC') {
    return track(p, 'Dispensación', ['Dispensación'])
  }
  return track(p, 'Preparación', ['Preparación', 'Programación', 'Administración'])
}

/** Etiqueta del proceso de continuidad según la modalidad. */
function continuityTrack(p: Patient): ProcessTrack {
  if (p.modality === 'Oral') return track(p, 'Reabastecimiento', ['Reabastecimiento', 'Seguimiento'])
  if (p.modality === 'SC') return track(p, 'Aplicación', ['Próxima aplicación', 'Aplicación'])
  return track(p, 'Seguimiento', ['Seguimiento'])
}

function deriveException(p: Patient): JourneyException | undefined {
  if (p.journey.some((s) => s.state === 'blocked')) return { text: p.obs, kind: 'crit' }
  if (p.journey.some((s) => s.state === 'warning')) return { text: p.obs, kind: 'warn' }
  return undefined
}

export function deriveJourney(p: Patient): JourneyView {
  const focus = focusStage(p)
  return {
    patientId: p.id,
    patientName: p.name,
    initials: p.initials,
    dx: p.dx,
    modality: p.modality,
    protocol: p.protocol,
    cycleLabel: showsCycle(p) ? `Ciclo ${p.cycle}` : undefined,
    facility: p.facility,
    payer: p.payer,
    priority: p.priority,
    category: p.category,
    currentStage: focus.label,
    currentStageState: focus.state,
    stages: p.journey,
    processes: [
      track(p, 'Revisión clínica', ['Revisión clínica']),
      track(p, 'Autorización', ['Autorización']),
      fulfillmentTrack(p),
      continuityTrack(p),
    ],
    exception: deriveException(p),
    next: p.next,
    owner: nextActionOwner(p),
    due: p.due,
    dueKind: p.dueKind,
  }
}

/** ¿El episodio tiene una excepción/bloqueo activo? (para filtros de Journeys) */
export function hasActiveException(p: Patient): boolean {
  return p.journey.some((s) => s.state === 'warning' || s.state === 'blocked')
}
