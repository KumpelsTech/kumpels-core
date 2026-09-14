import { useSyncExternalStore } from 'react'
import type {
  PrepBlocker, PrepStatus, PreparationInstance, PreparationOrder,
  PreparationReadiness, PreparationView,
} from '../types/preparation'
import { PREPARATION_ORDERS, SEED_INSTANCES, getPreparationOrder } from '../data/preparation'
import { clinicalReviewPending } from './review'
import { recordUsage } from './traceabilityStore'

/**
 * Estado mutable de preparación estéril (en memoria, sesión). Fuente única para
 * Operaciones y Patient 360. El readiness, el estado y el bloqueo se DERIVAN;
 * la revisión clínica se reutiliza (no se duplica su lógica).
 */
const instances = new Map<string, PreparationInstance>()
const listeners = new Set<() => void>()
let version = 0
let seeded = false

function seed() {
  if (seeded) return
  for (const [orderId, inst] of Object.entries(SEED_INSTANCES)) instances.set(orderId, structuredClone(inst))
  seeded = true
}
function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { seed(); listeners.add(l); return () => listeners.delete(l) }

const nowLabel = () => 'Hoy'

function readinessOf(order: PreparationOrder): PreparationReadiness {
  const cr = clinicalReviewPending(order.reviewPatientId ?? order.patientId)
  const reviewReq = {
    key: 'clinical-review',
    label: 'Revisión clínica resuelta',
    met: !cr.pending,
    responsible: 'Farmacia clínica',
    nextAction: 'Resolver revisión clínica',
  }
  const requirements = [reviewReq, ...order.requirements]
  const unmet = requirements.filter((r) => !r.met)
  // Bloqueo primario: se prefiere un requisito operativo sobre la revisión
  // clínica cuando ambos faltan, para que el bloqueo sea específico (dosis,
  // autorización, dato faltante) en vez de siempre "revisión pendiente".
  const primary = unmet.find((r) => r.key !== 'clinical-review') ?? unmet[0]
  const blocker: PrepBlocker | undefined = primary
    ? { label: blockerLabel(primary.key, primary.label), responsible: primary.responsible, nextAction: primary.nextAction }
    : undefined
  return { ready: unmet.length === 0, requirements, pendingCount: unmet.length, blocker }
}

function blockerLabel(key: string, fallback: string): string {
  if (key === 'clinical-review') return 'Revisión profesional pendiente'
  if (key === 'autorizacion') return 'Autorización pendiente'
  if (key === 'dosis-final') return 'Dosis final no confirmada'
  if (key === 'datos-paciente') return 'Dato requerido faltante'
  if (key === 'info-preparacion') return 'Información de preparación incompleta'
  return fallback
}

function statusOf(inst: PreparationInstance | undefined, readiness: PreparationReadiness): PrepStatus {
  if (inst?.releasedAt) return 'liberada'
  if (inst?.verifiedAt) return 'verificada'
  if (inst?.completedAt) return 'pendiente-verificacion'
  if (inst?.startedAt) return 'en-preparacion'
  if (readiness.ready) return 'lista'
  // No iniciada y no lista: distinguir revisión clínica de otros bloqueos.
  const onlyReview = readiness.requirements.filter((r) => !r.met).every((r) => r.key === 'clinical-review')
  return onlyReview ? 'pendiente-validacion' : 'bloqueada'
}

const NEXT_ACTION: Record<PrepStatus, string> = {
  'pendiente-validacion': 'Resolver revisión clínica',
  bloqueada: 'Resolver bloqueo',
  lista: 'Iniciar preparación',
  'en-preparacion': 'Finalizar preparación',
  'pendiente-verificacion': 'Verificar',
  verificada: 'Liberar',
  liberada: 'Preparación liberada',
}

export function view(orderId: string): PreparationView {
  seed()
  const order = getPreparationOrder(orderId)!
  const inst = instances.get(orderId)
  const readiness = readinessOf(order)
  const status = statusOf(inst, readiness)
  // reviewBlocked: la revisión clínica es el ÚNICO bloqueo (CTA "Ir a Revisión").
  const unmet = readiness.requirements.filter((r) => !r.met)
  const reviewBlocked = unmet.length > 0 && unmet.every((r) => r.key === 'clinical-review')
  const blocker = status === 'bloqueada' || status === 'pendiente-validacion' ? readiness.blocker : undefined
  const nextAction = status === 'bloqueada' && blocker?.nextAction ? blocker.nextAction : NEXT_ACTION[status]
  return { order, status, readiness, instance: inst, blocker, nextAction, reviewBlocked }
}

export function listPreparationViews(): PreparationView[] {
  return PREPARATION_ORDERS.map((o) => view(o.id))
}

/** Preparación del paciente (para conectar Patient 360 sin duplicar el flujo). */
export function getPatientPreparation(patientId: string): PreparationView | null {
  const o = PREPARATION_ORDERS.find((x) => x.patientId === patientId)
  return o ? view(o.id) : null
}

/* ---- acciones del flujo (separadas y trazables) ---- */
function ensureInstance(order: PreparationOrder): PreparationInstance {
  let inst = instances.get(order.id)
  if (!inst) {
    inst = {
      id: `PI-${order.id.replace('PREP-', '')}`, orderId: order.id, patientId: order.patientId,
      medication: order.medication, finalDose: order.approvedDose ?? order.prescribedDose,
      volume: order.finalVolume, container: order.container,
    }
    instances.set(order.id, inst)
  }
  return inst
}

export function iniciarPreparacion(orderId: string, by: string) {
  const order = getPreparationOrder(orderId)!
  if (statusOf(instances.get(orderId), readinessOf(order)) !== 'lista') return
  const inst = ensureInstance(order)
  inst.preparedBy = by
  inst.startedAt = nowLabel()
  order.events = [...order.events, { at: nowLabel(), label: `Preparación iniciada · ${by}`, state: 'done' }]
  emit()
}

export function finalizarPreparacion(orderId: string) {
  const order = getPreparationOrder(orderId)!
  const inst = instances.get(orderId)
  if (!inst || statusOf(inst, readinessOf(order)) !== 'en-preparacion') return
  inst.completedAt = nowLabel()
  order.events = [...order.events, { at: nowLabel(), label: 'Preparación finalizada · pendiente de verificación', state: 'warn' }]
  // Registrar el uso real de componentes (inicio de la genealogía).
  recordUsage(orderId, inst.id, inst.preparedBy ?? order.responsible)
  emit()
}

export function verificar(orderId: string, by: string) {
  const order = getPreparationOrder(orderId)!
  const inst = instances.get(orderId)
  if (!inst || statusOf(inst, readinessOf(order)) !== 'pendiente-verificacion') return
  inst.verifiedBy = by
  inst.verifiedAt = nowLabel()
  order.events = [...order.events, { at: nowLabel(), label: `Verificación profesional · ${by}`, state: 'done' }]
  emit()
}

export function liberar(orderId: string, by: string) {
  const order = getPreparationOrder(orderId)!
  const inst = instances.get(orderId)
  if (!inst || statusOf(inst, readinessOf(order)) !== 'verificada') return
  inst.releasedBy = by
  inst.releasedAt = nowLabel()
  order.events = [...order.events, { at: nowLabel(), label: `Preparación liberada para administración · ${by}`, state: 'done' }]
  emit()
}

/** Read model reactivo (solo lectura). Las transiciones pasan por
 * services.preparation; las funciones de flujo quedan a nivel de módulo para el
 * adaptador de repositorio, no para la UI. */
export function usePreparationStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { listPreparationViews, view, getPatientPreparation }
}

export const PREP_STATUS_LABEL: Record<PrepStatus, string> = {
  'pendiente-validacion': 'Pendiente de validación',
  bloqueada: 'Bloqueada',
  lista: 'Lista para preparar',
  'en-preparacion': 'En preparación',
  'pendiente-verificacion': 'Pendiente de verificación',
  verificada: 'Verificada · pendiente de liberación',
  liberada: 'Liberada',
}

/** Etiqueta corta para chips/cola. */
export const PREP_STATUS_SHORT: Record<PrepStatus, string> = {
  'pendiente-validacion': 'Pendiente de validación',
  bloqueada: 'Bloqueada',
  lista: 'Lista para preparar',
  'en-preparacion': 'En preparación',
  'pendiente-verificacion': 'Pendiente de verificación',
  verificada: 'Verificada',
  liberada: 'Liberada',
}
