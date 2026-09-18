import { useSyncExternalStore } from 'react'
import type { OrderChange, OrderChangeType } from '../types/orderChange'
import { now } from './datetime'

/**
 * Estado de CAMBIOS DE ORDEN (en memoria, sesión). Registra el último cambio por
 * orden; alimenta la evaluación de impacto aguas abajo. Append-oriented: se
 * conserva el actor/motivo/fecha del cambio vigente.
 */
const changes = new Map<string, OrderChange>()
const listeners = new Set<() => void>()
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

export function getOrderChange(orderId: string): OrderChange | undefined { return changes.get(orderId) }
export function listOrderChanges(): OrderChange[] { return [...changes.values()] }

export function setOrderChange(
  orderId: string,
  input: { changeType: OrderChangeType; reason: string; actorId: string; actorName: string; actorRole: string },
): OrderChange {
  const stamp = now()
  const rec: OrderChange = { orderId, ...input, at: stamp.label, atIso: stamp.iso }
  changes.set(orderId, rec)
  emit()
  return rec
}

export function useOrderChangeStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { getOrderChange, listOrderChanges }
}
