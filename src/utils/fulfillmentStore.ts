import { useSyncExternalStore } from 'react'
import type {
  AvailabilityStatus, CommState, FulfillmentStatus, FulfillmentView, MedicationFulfillment,
} from '../types/fulfillment'
import { BASE_FULFILLMENTS, ORDERS } from '../data/fulfillment'
import { deriveContinuity } from './continuity'
import { newId } from './ids'

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
    expectedAvailability: f.expectedAvailability, expectedDay: f.expectedDay,
    availability: availabilityOf(f, remaining), availabilityUpdatedAt: f.availabilityUpdatedAt,
    communication: f.communication, contacts: f.contacts,
    continuity: deriveContinuity(f, remaining),
    responsible: f.responsible, pendingSince: f.pendingSince, daysPending: f.daysPending,
    nextNeedLabel: f.nextNeedLabel, nextApplication: f.nextApplication, lot: f.lot, events: f.events,
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

/* ---- acciones operativas ligeras ---- */
export function registrarContacto(
  orderId: string,
  entry: { channel: string; result: string; nextStep?: string },
  newState: CommState = 'contactado',
) {
  const f = ensure(orderId)
  f.communication = newState
  f.contacts = [...f.contacts, { id: newId('contact'), at: 'Hoy', ...entry }]
  f.events = [...f.events, { at: 'Hoy', label: `Contacto registrado · ${entry.channel} · ${entry.result}`, state: 'done' }]
  emit()
}

export function actualizarDisponibilidad(orderId: string, value: string) {
  const f = ensure(orderId)
  f.expectedAvailability = value
  const m = value.match(/(\d{1,2})/)
  f.expectedDay = m ? Number(m[1]) : undefined
  f.blocked = false
  f.availabilityUpdatedAt = 'Hoy'
  f.events = [...f.events, { at: 'Hoy', label: `Disponibilidad esperada actualizada · ${value}`, state: 'done' }]
  emit()
}

export function resolverPendiente(orderId: string) {
  const order = orderOf(orderId)
  const f = ensure(orderId)
  const fulfilled = f.dispenses.reduce((s, d) => s + d.quantity, 0)
  const remaining = Math.max(0, order.orderedQuantity - fulfilled)
  if (remaining <= 0) return
  f.dispenses = [...f.dispenses, { id: `${orderId}-restante`, quantity: remaining, at: 'Hoy', by: f.responsible, kind: 'restante' }]
  f.events = [
    ...f.events,
    { at: 'Hoy', label: `${remaining} ${order.unitLabel} dispensada(s) — pendiente resuelto`, state: 'done' },
    { at: 'Hoy', label: 'Cumplimiento completo', state: 'done' },
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
