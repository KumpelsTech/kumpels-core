import { useSyncExternalStore } from 'react'
import type {
  AvailabilityStatus, CommState, ContactEntry, ContactMethod, ContactResult, ContactedParty,
  FulfillmentStatus, FulfillmentView, MedicationDelivery, MedicationFulfillment, RecipientType,
  ReceiptEvidence, ScheduleChange,
} from '../types/fulfillment'
import { BASE_FULFILLMENTS, ORDERS } from '../data/fulfillment'
import { deriveContinuity } from './continuity'
import { newId } from './ids'
import { now } from './datetime'

/**
 * Estado mutable de cumplimiento (en memoria, sesión). Fuente única para
 * Operaciones, Patient 360 y Atención Farmacéutica. El "pendiente", la
 * disponibilidad y la continuidad se DERIVAN; no son registros aparte.
 */
const state = new Map<string, MedicationFulfillment>()
const listeners = new Set<() => void>()
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

function ensure(orderId: string): MedicationFulfillment {
  let f = state.get(orderId)
  if (!f) { f = structuredClone(BASE_FULFILLMENTS[orderId]); state.set(orderId, f) }
  return f
}
const orderOf = (orderId: string) => ORDERS.find((o) => o.id === orderId)!

function availabilityOf(f: MedicationFulfillment, remaining: number): AvailabilityStatus {
  if (remaining === 0) return 'resuelto'
  if (f.expectedDay == null) return 'sin-fecha'
  return 'estimada'
}

export function view(orderId: string): FulfillmentView {
  const order = orderOf(orderId)
  const f = ensure(orderId)
  const fulfilled = f.dispenses.reduce((s, d) => s + d.quantity, 0)
  const remaining = Math.max(0, order.orderedQuantity - fulfilled)
  const status: FulfillmentStatus = remaining === 0 ? 'completo' : fulfilled > 0 ? 'parcial' : 'pendiente'
  return {
    order, ordered: order.orderedQuantity, fulfilled, remaining, status, isPending: remaining > 0,
    blocked: f.blocked,
    expectedAvailability: f.expectedAvailability, expectedDay: f.expectedDay,
    availability: availabilityOf(f, remaining), availabilityUpdatedAt: f.availabilityUpdatedAt,
    communication: f.communication, contacts: f.contacts,
    continuity: deriveContinuity(f, remaining),
    responsible: f.responsible, pendingSince: f.pendingSince, daysPending: f.daysPending,
    nextNeedLabel: f.nextNeedLabel, nextApplication: f.nextApplication, lot: f.lot,
    scheduleHistory: f.scheduleHistory ?? [], deliveries: f.deliveries ?? [],
    contactSettled: f.communication !== 'pendiente',
    resolvedWithoutContactReason: f.resolvedWithoutContactReason,
    events: f.events,
  }
}

export function listViews(): FulfillmentView[] { return ORDERS.map((o) => view(o.id)) }

/** Pendiente sin resolver del paciente (para conectar Patient 360 y Atención Farmacéutica). */
export function getPatientPending(patientId: string): FulfillmentView | null {
  const o = ORDERS.find((x) => x.patientId === patientId)
  if (!o) return null
  const v = view(o.id)
  return v.isPending ? v : null
}

/* ---- acciones operativas (trazables, con actor y fecha+hora exactas) ---- */

/** Entrada de contacto sin los campos que asigna el store (id/at/etiquetas). */
export type ContactInput = Omit<ContactEntry, 'id' | 'at' | 'atIso' | 'channel' | 'result'>

/**
 * Registra un intento de contacto. NO asume éxito: solo 'contactado'/'reprogramado'
 * sacan el caso de 'pendiente'. Se conservan todos los intentos.
 */
export function registrarContacto(orderId: string, entry: ContactInput) {
  const f = ensure(orderId)
  const stamp = now()
  const success = entry.outcome === 'contactado' || entry.outcome === 'reprogramado'
  if (entry.outcome === 'reprogramado') f.communication = 'coordinado'
  else if (entry.outcome === 'contactado') f.communication = f.communication === 'pendiente' ? 'contactado' : f.communication
  const contact: ContactEntry = {
    ...entry, id: newId('contact'), at: stamp.label, atIso: stamp.iso,
    channel: CONTACT_METHOD_LABEL[entry.method],
    result: entry.comment?.trim() || CONTACT_RESULT_LABEL[entry.outcome],
  }
  f.contacts = [...f.contacts, contact]
  const who = entry.party !== 'paciente' ? ` (${CONTACTED_PARTY_LABEL[entry.party]}${entry.partyName ? `: ${entry.partyName}` : ''})` : ''
  f.events = [...f.events, { at: stamp.label, label: `Contacto · ${CONTACT_METHOD_LABEL[entry.method]} · ${CONTACT_RESULT_LABEL[entry.outcome]}${who}`, state: success ? 'done' : 'warn' }]
  emit()
}

/** Reprograma la disponibilidad (fecha/hora + motivo). Preserva la fecha previa. */
export function reprogramar(
  orderId: string,
  change: { newDate: string; newTime?: string; reason?: string; actorId?: string; actorName?: string; actorRole?: string },
) {
  const f = ensure(orderId)
  const stamp = now()
  const previousDate = f.expectedAvailability
  f.expectedAvailability = change.newTime ? `${change.newDate} · ${change.newTime}` : change.newDate
  const m = change.newDate.match(/(\d{1,2})/)
  f.expectedDay = m ? Number(m[1]) : undefined
  f.blocked = false
  f.availabilityUpdatedAt = stamp.label
  const sc: ScheduleChange = {
    id: newId('sched'), at: stamp.label, atIso: stamp.iso, previousDate,
    newDate: change.newDate, newTime: change.newTime, reason: change.reason,
    actorId: change.actorId, actorName: change.actorName, actorRole: change.actorRole,
  }
  f.scheduleHistory = [...(f.scheduleHistory ?? []), sc]
  f.events = [...f.events, { at: stamp.label, label: `Disponibilidad reprogramada · ${f.expectedAvailability}${change.reason ? ` — ${change.reason}` : ''}`, state: 'done' }]
  emit()
}

/** Entrada de entrega sin los campos que asigna el store. */
export type DeliveryInput = Omit<MedicationDelivery, 'id' | 'orderId' | 'patientId' | 'medication' | 'unitLabel' | 'at' | 'atIso' | 'facility' | 'version' | 'quantity'> & { quantity?: number }

/**
 * Registra la ENTREGA con acuse de recibo y completa la dispensación del saldo.
 * Es una vía válida de resolución (registra quién recibió).
 */
export function registrarEntrega(orderId: string, delivery: DeliveryInput): MedicationDelivery {
  const order = orderOf(orderId)
  const f = ensure(orderId)
  const stamp = now()
  const fulfilled = f.dispenses.reduce((s, d) => s + d.quantity, 0)
  const remaining = Math.max(0, order.orderedQuantity - fulfilled)
  const qty = delivery.quantity ?? remaining
  if (remaining > 0) {
    f.dispenses = [...f.dispenses, { id: `${orderId}-entrega-${f.deliveries?.length ?? 0}`, quantity: qty, at: stamp.label, by: delivery.deliveredBy, kind: 'restante' }]
  }
  const rec: MedicationDelivery = {
    ...delivery, id: newId('deliv'), orderId, patientId: order.patientId, medication: order.medication,
    quantity: qty, unitLabel: order.unitLabel, at: stamp.label, atIso: stamp.iso, facility: order.facility, version: 1,
  }
  f.deliveries = [...(f.deliveries ?? []), rec]
  if (delivery.recipientType !== 'paciente') f.communication = 'coordinado'
  else if (f.communication === 'pendiente') f.communication = 'contactado'
  const who = delivery.recipientType !== 'paciente' ? ` · ${RECIPIENT_LABEL[delivery.recipientType]}${delivery.recipientName ? ` (${delivery.recipientName})` : ''}` : ' · paciente'
  f.events = [
    ...f.events,
    { at: stamp.label, label: `Entrega registrada · ${qty} ${order.unitLabel}${who}`, state: 'done' },
    { at: stamp.label, label: 'Cumplimiento completo', state: 'done' },
  ]
  emit()
  return rec
}

/** Resuelve el pendiente SIN contacto exitoso — requiere motivo explícito (vía B §8). */
export function resolverSinContacto(orderId: string, reason: string, by: string) {
  const order = orderOf(orderId)
  const f = ensure(orderId)
  const fulfilled = f.dispenses.reduce((s, d) => s + d.quantity, 0)
  const remaining = Math.max(0, order.orderedQuantity - fulfilled)
  if (remaining <= 0 || !reason.trim()) return
  const stamp = now()
  f.dispenses = [...f.dispenses, { id: `${orderId}-restante`, quantity: remaining, at: stamp.label, by, kind: 'restante' }]
  f.resolvedWithoutContactReason = reason.trim()
  f.events = [
    ...f.events,
    { at: stamp.label, label: `Pendiente resuelto sin contacto exitoso — ${reason.trim()}`, state: 'warn' },
    { at: stamp.label, label: 'Cumplimiento completo', state: 'done' },
  ]
  emit()
}

/** Read model reactivo (solo lectura). Las mutaciones pasan por services.fulfillment;
 * las funciones registrarContacto/actualizarDisponibilidad/resolverPendiente quedan a
 * nivel de módulo para el adaptador de repositorio, no para la UI. */
export function useFulfillmentStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { listViews, view, getPatientPending }
}

/**
 * Siguiente acción operativa de un pendiente — regla de dominio única.
 * Antes estaba duplicada en la página de Operaciones y en workItems.
 */
export function nextFulfillmentAction(v: FulfillmentView): string {
  if (v.communication === 'pendiente') return 'Contactar paciente'
  if (v.continuity.risk !== 'sin-riesgo') return 'Actualizar disponibilidad'
  return 'Resolver pendiente'
}

export const COMM_LABEL: Record<CommState, string> = {
  pendiente: 'Pendiente de contacto', contactado: 'Contactado', informado: 'Paciente informado', coordinado: 'Entrega/aplicación coordinada',
}
export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  'sin-fecha': 'Sin fecha estimada', estimada: 'Disponibilidad estimada', disponible: 'Disponible', resuelto: 'Resuelto',
}
export const CONTINUITY_LABEL: Record<'sin-riesgo' | 'en-riesgo' | 'retrasado', string> = {
  'sin-riesgo': 'Sin riesgo aparente', 'en-riesgo': 'En riesgo', retrasado: 'Tratamiento potencialmente retrasado',
}
export const CONTACT_METHOD_LABEL: Record<ContactMethod, string> = {
  telefono: 'Teléfono', whatsapp: 'WhatsApp', sms: 'SMS', presencial: 'Presencial', otro: 'Otro',
}
export const CONTACTED_PARTY_LABEL: Record<ContactedParty, string> = {
  paciente: 'Paciente', familiar: 'Familiar', cuidador: 'Cuidador', representante: 'Representante autorizado', otro: 'Otro',
}
export const CONTACT_RESULT_LABEL: Record<ContactResult, string> = {
  contactado: 'Contactado', 'sin-respuesta': 'Sin respuesta', reprogramado: 'Reprogramado', reintentar: 'Requiere otro intento', otro: 'Otro',
}
export const RECIPIENT_LABEL: Record<RecipientType, string> = {
  paciente: 'Paciente', familiar: 'Familiar', cuidador: 'Cuidador', representante: 'Representante autorizado', otro: 'Otro',
}
export const RECEIPT_EVIDENCE_LABEL: Record<ReceiptEvidence['type'], string> = {
  firma: 'Firma', otp: 'OTP', 'acuse-electronico': 'Acuse electrónico', documento: 'Documento', ninguno: 'Sin evidencia / excepción institucional',
}
