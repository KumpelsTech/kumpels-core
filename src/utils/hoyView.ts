import type { WorkItem, WorkTone } from '../types/work'
import type { DelaySignal } from './delaySignals'

/**
 * hoyView — proyección SOLO de presentación para la página "Hoy" (UX-04).
 * NO contiene lógica de dominio: filtra/ordena/agrega WorkItems y DelaySignals
 * ya calculados por sus proyecciones de origen. No prioriza ni calcula demoras.
 */

const TONE_RANK: Record<WorkTone, number> = { crit: 0, warn: 1, info: 2, ok: 3 }
const PRIO_RANK: Record<string, number> = { HIGH: 0, ACTION: 1, MONITOR: 2, none: 3 }
export const byUrgency = (a: WorkItem, b: WorkItem) =>
  TONE_RANK[a.tone] - TONE_RANK[b.tone] || PRIO_RANK[a.priority] - PRIO_RANK[b.priority] ||
  (a.dueMinutes ?? 1e9) - (b.dueMinutes ?? 1e9)

const byTime = (a: WorkItem, b: WorkItem) => (a.dueMinutes ?? 1e9) - (b.dueMinutes ?? 1e9)

/** Un item "requiere atención" si es crítico/advertencia o de prioridad alta/acción. */
export function isAttention(i: WorkItem): boolean {
  return i.tone === 'crit' || i.tone === 'warn' || i.priority === 'HIGH' || i.priority === 'ACTION'
}

export interface HoySplit { attention: WorkItem[]; upcoming: WorkItem[] }

/** Separa el pool del rol en "Requieren tu atención" vs "Próximo". */
export function splitPool(pool: WorkItem[]): HoySplit {
  const attention: WorkItem[] = []
  const upcoming: WorkItem[] = []
  for (const i of pool) (isAttention(i) ? attention : upcoming).push(i)
  attention.sort(byUrgency)
  upcoming.sort(byTime)
  return { attention, upcoming }
}

/* ------------------------------------------------------------------ */
/* Operational brief (Kumpels AI) — SOLO resume datos deterministas    */
/* ------------------------------------------------------------------ */
const NOW_MIN = 12 * 60 + 2 // 12:02, contexto demo alineado con priorityQueue/delaySignals
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export interface BriefStatement {
  id: string
  text: string
  tone: 'crit' | 'warn' | 'info'
  /** Nombres de pacientes que respaldan el enunciado (para "Ver por qué"). */
  evidence: string[]
}

/**
 * Enunciados del brief: cada uno es TRAZABLE a datos existentes (conteos/horas).
 * No genera recomendaciones clínicas ni prioridades inventadas.
 */
export function briefStatements(attention: WorkItem[], delays: DelaySignal[]): BriefStatement[] {
  const out: BriefStatement[] = []

  const crit = attention.filter((i) => i.tone === 'crit')
  if (crit.length) {
    out.push({ id: 'crit', tone: 'crit', evidence: crit.map((i) => i.patientName),
      text: `${crit.length} ${crit.length === 1 ? 'caso crítico requiere' : 'casos críticos requieren'} acción inmediata.` })
  }

  // Con hora límite en las próximas 2 horas (dato: dueMinutes).
  const soon = attention.filter((i) => i.dueMinutes != null && i.dueMinutes >= NOW_MIN && i.dueMinutes <= NOW_MIN + 120)
  if (soon.length) {
    const earliest = Math.min(...soon.map((i) => i.dueMinutes as number))
    out.push({ id: 'soon', tone: 'warn', evidence: soon.map((i) => i.patientName),
      text: `${soon.length} ${soon.length === 1 ? 'tarea programada' : 'tareas programadas'} antes de las ${fmt(earliest + (60 - (earliest % 60)) % 60 || earliest)} · próxima ${fmt(earliest)}.` })
  }

  const late = delays.filter((d) => d.minutesLate > 0)
  if (late.length) {
    const worst = Math.max(...late.map((d) => d.minutesLate))
    out.push({ id: 'late', tone: 'warn', evidence: late.map((d) => d.patientName),
      text: `${late.length} ${late.length === 1 ? 'flujo con retraso activo' : 'flujos con retraso activo'} · mayor demora ${worst} min.` })
  }

  const noOwner = delays.filter((d) => d.noAssignee)
  if (noOwner.length) {
    out.push({ id: 'noowner', tone: 'crit', evidence: noOwner.map((d) => d.patientName),
      text: `${noOwner.length} ${noOwner.length === 1 ? 'flujo crítico sin responsable' : 'flujos críticos sin responsable'} asignado.` })
  }

  if (!out.length && attention.length) {
    out.push({ id: 'attn', tone: 'info', evidence: attention.map((i) => i.patientName),
      text: `${attention.length} ${attention.length === 1 ? 'elemento requiere' : 'elementos requieren'} tu atención hoy.` })
  }

  return out.slice(0, 3)
}

/* ------------------------------------------------------------------ */
/* Cuellos de botella (Coordinador) — agregado sobre DelaySignal        */
/* ------------------------------------------------------------------ */
export interface Bottleneck { area: string; count: number; maxLate: number; sample: string }

/** Agrupa las señales de demora por equipo responsable (presentación). */
export function bottlenecks(delays: DelaySignal[]): Bottleneck[] {
  const map = new Map<string, Bottleneck>()
  for (const d of delays) {
    const area = d.ownerLabel || 'Sin responsable'
    const cur = map.get(area) ?? { area, count: 0, maxLate: 0, sample: d.reason }
    cur.count += 1
    cur.maxLate = Math.max(cur.maxLate, d.minutesLate)
    map.set(area, cur)
  }
  return [...map.values()].sort((a, b) => b.maxLate - a.maxLate || b.count - a.count)
}
