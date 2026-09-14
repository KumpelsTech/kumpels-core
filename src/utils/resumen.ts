import type { Patient, Priority } from '../types/patient'
import type { Finding } from '../types/review'
import type { CareDomain } from '../types/careFollowup'
import type { PreparationView } from '../types/preparation'
import { getTherapy } from '../data/therapy'
import { getValidationRun } from '../data/review'
import { getCare } from '../data/careFollowup'
import { getAssessment } from './careStore'
import { unresolvedReviewFindings } from './review'
import { getPatientPreparation } from './preparationStore'
import { getPatientPending, nextFulfillmentAction, CONTINUITY_LABEL } from './fulfillmentStore'
import { nextActionOwner, nextActionVerb } from './patient'

/**
 * Derivaciones de solo lectura para el hub del tab Resumen.
 * No introduce dominio nuevo ni workflows: resume dato ya existente
 * (paciente + terapia + corrida de validación).
 */

export type IndState = 'ok' | 'warn'
export interface Indicator { label: string; state: IndState }

export interface FollowUpSummary {
  next: string
  continuidad: Indicator
  seguridad: Indicator
  acceso: Indicator
}

const warnIf = (cond: boolean, label: string): Indicator => ({ label, state: cond ? 'warn' : 'ok' })

export function deriveFollowUp(p: Patient): FollowUpSummary {
  const adher = p.care.adher.toLowerCase()
  return {
    next: p.care.nextFu,
    continuidad: warnIf(
      p.category === 'REABASTECIMIENTO' || p.category === 'SEGUIMIENTO' || /riesgo|confirmar|vencido/.test(adher),
      'Continuidad',
    ),
    seguridad: warnIf(p.priority === 'HIGH' || p.category === 'REVISIÓN CLÍNICA', 'Seguridad'),
    acceso: warnIf(p.category === 'AUTORIZACIÓN' || p.category === 'PENDIENTE' || p.auth.status === 'Pendiente', 'Acceso'),
  }
}

export interface OpItem { label: string; value: string; state: 'ok' | 'warn' | 'pending' }

export function deriveOperativeState(p: Patient): OpItem[] {
  const t = getTherapy(p.id)
  const items: OpItem[] = []
  const authOk = p.auth.status === 'Validada' || p.auth.status === 'Recibida' || p.auth.status === 'No requerida'
  items.push({ label: 'Autorización', value: p.auth.status, state: authOk ? 'ok' : 'warn' })

  const next = t?.access?.nextEvent
  if (next) {
    const warn = /pendiente|bloquead|vencid|por programar|espera/i.test(next)
    items.push({ label: p.modality === 'Oral' || p.modality === 'SC' ? 'Dispensación' : 'Preparación', value: next, state: warn ? 'pending' : 'ok' })
  }
  const avail = t?.access?.availability
  if (avail) {
    const ok = /disponible|sin pendientes/i.test(avail)
    items.push({ label: 'Medicamento', value: avail, state: ok ? 'ok' : 'warn' })
  }
  return items
}

export interface TreatmentSummary { title: string; next: string; status: string }

export function deriveTreatment(p: Patient): TreatmentSummary {
  const t = getTherapy(p.id)
  const title = t ? t.medications.map((m) => m.name).join(' + ') : p.med
  const next = t ? (t.plan.cycle.currentOrNext ?? t.plan.cycle.phase ?? p.nextTx) : p.nextTx
  const status = t ? t.plan.status : p.status
  return { title, next, status }
}

export interface ReviewSummary { total: number; requieren: number; topFinding?: string }

export function deriveReviewSummary(p: Patient): ReviewSummary | null {
  const run = getValidationRun(p.id)
  if (!run) return null
  const top = run.findings.find((f) => f.kind === 'review')
  return { total: run.summary.total, requieren: run.summary.requierenRevision, topFinding: top ? `${top.domain} · fuera de criterio configurado` : undefined }
}

/** Atención activa: solo lo que requiere criterio profesional u operativo ahora. */
export type AttentionItem =
  | { kind: 'finding'; finding: Finding }
  | { kind: 'exception'; id: string; domain: string; severity: Priority; text: string }
  | { kind: 'gap'; count: number }

export function deriveActiveAttention(p: Patient): AttentionItem[] {
  const run = getValidationRun(p.id)
  const items: AttentionItem[] = []
  if (run) {
    for (const f of run.findings) {
      if (f.kind === 'review') items.push({ kind: 'finding', finding: f })
    }
  }
  // Nota: los pendientes de medicamento se surfacean vía el dominio de cumplimiento
  // (fulfillmentStore) directamente en el componente, no aquí.
  if (run && run.summary.datosInsuficientes > 0) {
    items.push({ kind: 'gap', count: run.summary.datosInsuficientes })
  }
  return items
}

// deriveRecentActivity se retiró en TASK 13: la Actividad reciente ahora se
// proyecta desde el EventRepository compartido (utils/eventStore +
// utils/activityProjection), no desde un timeline derivado aparte.

/**
 * Próxima acción DERIVADA del estado vivo del flujo (no texto estático). Coherente
 * con las pantallas operativas: usa los mismos selectores de dominio. El `nextRoute`
 * del paciente elige el dominio primario; el estado vivo elige la sub-acción actual.
 * Lógica genérica — sin ramas por paciente.
 */
export interface NextActionView {
  title: string
  reason: string
  verb: string
  owner: string
  statusNote: string
  due?: string
}

function prepNextAction(p: Patient, prep: PreparationView): NextActionView {
  const owner = `Central de Mezclas · ${prep.order.responsible}`
  const when = prep.order.scheduledAt ? `Administración programada · ${prep.order.scheduledAt}` : 'En cola de preparación'
  const byStatus: Record<PreparationView['status'], { title: string; verb: string; note: string }> = {
    'pendiente-validacion': { title: 'Revisión profesional pendiente', verb: 'Resolver revisión clínica', note: 'Preparación bloqueada' },
    bloqueada: { title: prep.blocker?.label ?? 'Preparación bloqueada', verb: prep.nextAction, note: 'Preparación bloqueada' },
    lista: { title: 'Preparación lista para iniciar', verb: 'Iniciar preparación', note: 'Lista para preparar' },
    'en-preparacion': { title: 'Preparación en curso', verb: 'Finalizar preparación', note: 'En preparación' },
    'pendiente-verificacion': { title: 'Verificación requerida', verb: 'Verificar', note: 'Pendiente de verificación' },
    verificada: { title: 'Liberación requerida', verb: 'Liberar', note: 'Verificada · pendiente de liberación' },
    liberada: { title: 'Preparación liberada', verb: 'Ver trazabilidad', note: 'Liberada para administración' },
  }
  const s = byStatus[prep.status]
  return { title: s.title, reason: `${prep.order.medication} · ${when}`, verb: s.verb, owner, statusNote: s.note, due: p.due }
}

function calm(p: Patient, owner: string): NextActionView {
  return { title: 'Sin acciones críticas', reason: 'Kumpels revisó el caso y no requiere tu atención en este momento.', verb: 'Ver paciente', owner, statusNote: 'Monitoreo de rutina', due: p.due }
}

/**
 * Contexto operativo sobre los dominios de atención farmacéutica: un pendiente
 * con riesgo de continuidad marca el dominio "acceso". Regla de dominio (no en
 * el componente); el farmacéutico valora su relevancia (sin PRM automático).
 */
export function deriveCareDomains(patientId: string, base: CareDomain[]): CareDomain[] {
  const pending = getPatientPending(patientId)
  if (!pending || pending.continuity.risk === 'sin-riesgo') return base
  return base.map((dom) =>
    dom.key === 'acceso'
      ? { ...dom, state: 'warn', note: 'Medicamento pendiente — posible impacto en continuidad' }
      : dom,
  )
}

export function deriveNextAction(p: Patient): NextActionView {
  const owner = nextActionOwner(p)

  if (p.nextRoute === 'clinical') {
    if (unresolvedReviewFindings(p.id).length) {
      return { title: p.alert.title, reason: p.alert.criterion, verb: 'Iniciar revisión', owner, statusNote: 'Revisión profesional requerida', due: p.due }
    }
    const prep = getPatientPreparation(p.id)
    if (prep) return prepNextAction(p, prep)
    return calm(p, owner)
  }

  if (p.nextRoute === 'ops') {
    const prep = getPatientPreparation(p.id)
    if (prep && prep.status !== 'liberada') return prepNextAction(p, prep)
    const pend = getPatientPending(p.id)
    if (pend) {
      return {
        title: 'Medicamento pendiente', reason: pend.continuity.explain, verb: nextFulfillmentAction(pend),
        owner: `Farmacia · ${p.facility}`, statusNote: CONTINUITY_LABEL[pend.continuity.risk], due: p.due,
      }
    }
    return calm(p, owner)
  }

  // nextRoute === 'patient' → atención farmacéutica / seguimiento
  const care = getCare(p.id)
  const done = getAssessment(p.id)
  if (care?.required && !done) {
    const initial = care.mode === 'entrevista-inicial'
    return {
      title: initial ? 'Entrevista inicial pendiente' : 'Seguimiento farmacoterapéutico pendiente',
      reason: care.statusLabel, verb: initial ? 'Completar entrevista' : 'Realizar seguimiento',
      owner: `Farmacéutica clínica · ${care.responsible}`, statusNote: care.statusLabel, due: p.due,
    }
  }
  if (done) {
    return { title: 'Próximo seguimiento programado', reason: `Próximo · ${done.nextFollowUp}`, verb: 'Revisar seguimiento', owner: `Farmacéutica clínica · ${care?.responsible ?? p.team.pharm}`, statusNote: 'Al día' }
  }
  return { title: p.alert.title, reason: p.alert.criterion, verb: nextActionVerb(p), owner, statusNote: p.alert.reviewStatus, due: p.due }
}
