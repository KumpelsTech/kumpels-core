import { useSyncExternalStore } from 'react'
import type {
  PrepBlocker, PrepStatus, PreparationInstance, PreparationOrder,
  PreparationReadiness, PreparationView,
} from '../types/preparation'
import type { PreparationReplacement, SupersededMark, NursingRejection } from '../types/preparation'
import { PREPARATION_ORDERS, SEED_INSTANCES, getPreparationOrder } from '../data/preparation'
import { PREPARATION_POLICY } from '../config/preparationPolicy'
import { clinicalReviewPending } from './review'
import { recordUsage, aliasOrder } from './traceabilityStore'
import { isProductionSent } from './productionStore'
import { newId } from './ids'
import { now, nowLabel as stampLabel } from './datetime'

/* ---- reemplazo controlado: órdenes creadas en runtime + marcas de superado ---- */
const runtimeOrders: PreparationOrder[] = []
const supersededBy = new Map<string, SupersededMark>()
const replacements: PreparationReplacement[] = []
const rejections = new Map<string, NursingRejection>()

function allOrders(): PreparationOrder[] { return [...PREPARATION_ORDERS, ...runtimeOrders] }
function resolveOrder(id: string): PreparationOrder | undefined { return getPreparationOrder(id) ?? runtimeOrders.find((o) => o.id === id) }

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

const nowLabel = () => stampLabel()

/** Resultado de una transición (permite explicar bloqueos de segregación). */
export type PrepActionResult = { ok: boolean; reason?: string }

/** Segregación de funciones: ¿por qué NO puede este actor verificar? (o undefined). */
export function verifyBlockReason(orderId: string, by: string): string | undefined {
  const inst = instances.get(orderId)
  if (PREPARATION_POLICY.preparerCannotVerifyOwnWork && inst?.preparedBy && inst.preparedBy === by) {
    return 'Segregación de funciones: quien preparó no puede verificar su propia preparación.'
  }
  return undefined
}

/** Segregación de funciones: ¿por qué NO puede este actor liberar? (o undefined). */
export function releaseBlockReason(orderId: string, by: string): string | undefined {
  const inst = instances.get(orderId)
  if (PREPARATION_POLICY.verifierCannotReleaseOwnWork && inst?.verifiedBy && inst.verifiedBy === by) {
    return 'Segregación de funciones: quien verificó no puede liberar su propia verificación.'
  }
  return undefined
}

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

function statusOf(inst: PreparationInstance | undefined, readiness: PreparationReadiness, productionSent = true): PrepStatus {
  if (inst?.releasedAt) return 'liberada'
  if (inst?.verifiedAt) return 'verificada'
  if (inst?.completedAt) return 'pendiente-verificacion'
  if (inst?.startedAt) return 'en-preparacion'
  // Gate de Central de Mezclas: aunque los requisitos estén listos, no puede
  // iniciar sin el envío explícito de Enfermería (ProductionRequest).
  if (readiness.ready) return productionSent ? 'lista' : 'bloqueada'
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
  const order = resolveOrder(orderId)!
  const inst = instances.get(orderId)
  const readiness = readinessOf(order)
  const sent = isProductionSent(orderId)
  const status = statusOf(inst, readiness, sent)
  // reviewBlocked: la revisión clínica es el ÚNICO bloqueo (CTA "Ir a Revisión").
  const unmet = readiness.requirements.filter((r) => !r.met)
  const reviewBlocked = unmet.length > 0 && unmet.every((r) => r.key === 'clinical-review')
  // Gate de envío por Enfermería: readiness listo pero sin ProductionRequest.
  const productionGate = readiness.ready && !inst?.startedAt && !sent
  let blocker = status === 'bloqueada' || status === 'pendiente-validacion' ? readiness.blocker : undefined
  let nextAction = status === 'bloqueada' && blocker?.nextAction ? blocker.nextAction : NEXT_ACTION[status]
  if (productionGate) {
    blocker = { label: 'Pendiente de envío por Enfermería', responsible: 'Enfermería', nextAction: 'Enviar a producción' }
    nextAction = 'Enviar a producción'
  }
  return { order, status, readiness, instance: inst, blocker, nextAction, reviewBlocked, superseded: supersededBy.get(orderId), supersedes: order.supersedes, rejection: rejections.get(orderId), productionGate }
}

/** Rechazo de Enfermería (barrera final): RELEASED → HOLD; genera resolución. */
export function rejectByNursing(
  orderId: string,
  input: { reasonCode: string; reasonLabel: string; comment?: string; ownerRole: string; ownerLabel: string },
  nurse: { id: string; name: string; role: string },
): { ok: boolean; reason?: string } {
  const order = resolveOrder(orderId)
  if (!order) return { ok: false, reason: 'Orden de preparación no encontrada' }
  const stamp = now()
  rejections.set(orderId, {
    orderId, ...input, nurseId: nurse.id, nurseName: nurse.name, nurseRole: nurse.role,
    patientId: order.patientId, medication: order.medication, at: stamp.label, atIso: stamp.iso,
  })
  order.events = [...order.events, { at: stamp.label, label: `Rechazada por Enfermería — ${input.reasonLabel}`, state: 'warn' }]
  emit()
  return { ok: true }
}

export function getRejection(orderId: string): NursingRejection | undefined { return rejections.get(orderId) }
export function listRejections(): NursingRejection[] { return [...rejections.values()] }

export function listPreparationViews(): PreparationView[] {
  return allOrders().map((o) => view(o.id))
}

/** Preparación ACTIVA del paciente (la más reciente no superada). */
export function getPatientPreparation(patientId: string): PreparationView | null {
  const list = allOrders().filter((x) => x.patientId === patientId && !supersededBy.has(x.id))
  const o = list[list.length - 1]
  return o ? view(o.id) : null
}

/**
 * Reemplazo CONTROLADO: la preparación anterior queda superada (inmutable) y se
 * crea una nueva que la reemplaza, conservando la genealogía de lote/componente
 * de la anterior (alias de componentes). No edita la anterior in situ.
 */
export function supersede(
  oldOrderId: string,
  opts: { reason: string; correctedDose?: string; sourceChange?: string },
  actor: { id: string; name: string; role: string },
): { ok: boolean; newId?: string; reason?: string } {
  const old = resolveOrder(oldOrderId)
  if (!old) return { ok: false, reason: 'Orden de preparación no encontrada' }
  if (supersededBy.has(oldOrderId)) return { ok: false, reason: 'La preparación ya fue reemplazada' }
  const stamp = now()
  const newOrderId = `${oldOrderId}-R${runtimeOrders.length + 1}`
  const dose = opts.correctedDose ?? old.approvedDose ?? old.prescribedDose
  const newOrder: PreparationOrder = {
    ...structuredClone(old), id: newOrderId, supersedes: oldOrderId,
    prescribedDose: dose, approvedDose: dose,
    events: [{ at: stamp.label, label: `Preparación creada por reemplazo de ${oldOrderId}${opts.correctedDose ? ` · dosis ${dose}` : ''}`, state: 'done' }],
  }
  runtimeOrders.push(newOrder)
  aliasOrder(newOrderId, oldOrderId) // reutiliza plantilla de componentes/genealogía
  supersededBy.set(oldOrderId, { byId: newOrderId, reason: opts.reason, at: stamp.label, by: actor.name })
  old.events = [...old.events, { at: stamp.label, label: `Reemplazada por ${newOrderId} — ${opts.reason}`, state: 'warn' }]
  replacements.push({
    id: newId('repl'), oldPreparationId: oldOrderId, newPreparationId: newOrderId,
    reason: opts.reason, sourceChange: opts.sourceChange,
    actorId: actor.id, actorName: actor.name, actorRole: actor.role, at: stamp.label, atIso: stamp.iso,
  })
  emit()
  return { ok: true, newId: newOrderId }
}

export function getReplacementFor(orderId: string): PreparationReplacement | undefined {
  return replacements.find((r) => r.oldPreparationId === orderId || r.newPreparationId === orderId)
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
  const order = resolveOrder(orderId)!
  // Gate: no iniciar sin envío de Enfermería (ProductionRequest).
  if (statusOf(instances.get(orderId), readinessOf(order), isProductionSent(orderId)) !== 'lista') return
  const inst = ensureInstance(order)
  inst.preparedBy = by
  inst.startedAt = nowLabel()
  order.events = [...order.events, { at: nowLabel(), label: `Preparación iniciada · ${by}`, state: 'done' }]
  emit()
}

export function finalizarPreparacion(orderId: string) {
  const order = resolveOrder(orderId)!
  const inst = instances.get(orderId)
  if (!inst || statusOf(inst, readinessOf(order)) !== 'en-preparacion') return
  inst.completedAt = nowLabel()
  order.events = [...order.events, { at: nowLabel(), label: 'Preparación finalizada · pendiente de verificación', state: 'warn' }]
  // Registrar el uso real de componentes (inicio de la genealogía).
  recordUsage(orderId, inst.id, inst.preparedBy ?? order.responsible)
  emit()
}

export function verificar(orderId: string, by: string): PrepActionResult {
  const order = resolveOrder(orderId)!
  const inst = instances.get(orderId)
  if (!inst || statusOf(inst, readinessOf(order)) !== 'pendiente-verificacion') return { ok: false }
  const blocked = verifyBlockReason(orderId, by)
  if (blocked) return { ok: false, reason: blocked }
  inst.verifiedBy = by
  inst.verifiedAt = nowLabel()
  order.events = [...order.events, { at: nowLabel(), label: `Verificación profesional · ${by}`, state: 'done' }]
  emit()
  return { ok: true }
}

export function liberar(orderId: string, by: string): PrepActionResult {
  const order = resolveOrder(orderId)!
  const inst = instances.get(orderId)
  if (!inst || statusOf(inst, readinessOf(order)) !== 'verificada') return { ok: false }
  const blocked = releaseBlockReason(orderId, by)
  if (blocked) return { ok: false, reason: blocked }
  inst.releasedBy = by
  inst.releasedAt = nowLabel()
  order.events = [...order.events, { at: nowLabel(), label: `Preparación liberada para administración · ${by}`, state: 'done' }]
  emit()
  return { ok: true }
}

/** Read model reactivo (solo lectura). Las transiciones pasan por
 * services.preparation; las funciones de flujo quedan a nivel de módulo para el
 * adaptador de repositorio, no para la UI. */
export function usePreparationStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { listPreparationViews, view, getPatientPreparation, verifyBlockReason, releaseBlockReason }
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
