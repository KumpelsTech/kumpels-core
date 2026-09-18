import { useSyncExternalStore } from 'react'
import type { ProductionRequest, ProductionRequestEntry, ProductionRequestStatus } from '../types/production'
import { newId } from './ids'
import { now } from './datetime'

/**
 * Estado de SOLICITUDES DE PRODUCCIÓN (en memoria, sesión). Una por orden de
 * preparación. Historia de estado append-only (no se borra al cancelar). Es el
 * adaptador in-memory del ProductionRepository futuro.
 */
const byOrder = new Map<string, ProductionRequest>()
const listeners = new Set<() => void>()
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

export function getProductionRequest(preparationOrderId: string): ProductionRequest | undefined { return byOrder.get(preparationOrderId) }
export function listProductionRequests(): ProductionRequest[] { return [...byOrder.values()] }
/** ¿La preparación fue enviada/aceptada en producción? (gate de Central de Mezclas). */
export function isProductionSent(preparationOrderId: string): boolean {
  const r = byOrder.get(preparationOrderId)
  return !!r && (r.status === 'SENT_TO_PRODUCTION' || r.status === 'ACCEPTED_BY_COMPOUNDING')
}

function push(r: ProductionRequest, entry: Omit<ProductionRequestEntry, 'id' | 'at' | 'atIso'>) {
  const stamp = now()
  r.history = [...r.history, { ...entry, id: newId('prh'), at: stamp.label, atIso: stamp.iso }]
}

export interface ProductionRequestInput {
  patientId: string; episodeId?: string; medicationOrderId?: string; therapyPlanId?: string
  preparationOrderId: string; scheduledTreatmentAt?: string; facility?: string; program?: string; note?: string
}

/** Crea (si no existe) y ENVÍA la solicitud a producción. */
export function sendToProduction(input: ProductionRequestInput, actor: { id: string; name: string; role: string }): ProductionRequest {
  const stamp = now()
  const existing = byOrder.get(input.preparationOrderId)
  const base: ProductionRequest = existing ?? {
    id: newId('prod'), ...input, status: 'DRAFT', history: [],
  }
  const prev = base.status
  base.status = 'SENT_TO_PRODUCTION'
  base.requestedById = actor.id; base.requestedByName = actor.name; base.requestedByRole = actor.role
  base.requestedAt = stamp.label; base.requestedAtIso = stamp.iso
  push(base, { from: prev, to: 'SENT_TO_PRODUCTION', actorId: actor.id, actorName: actor.name, actorRole: actor.role, reason: input.note })
  byOrder.set(input.preparationOrderId, base)
  emit()
  return base
}

/**
 * Central de Mezclas ACEPTA la solicitud (acuse del handoff). Captura quién/rol/
 * fecha-hora exactas. `auto` = aceptación implícita al iniciar la preparación
 * directamente (misma historia de auditoría/evento, sin saltar la propiedad).
 */
export function acceptProduction(preparationOrderId: string, actor: { id: string; name: string; role: string }, auto = false): ProductionRequest | undefined {
  const r = byOrder.get(preparationOrderId)
  if (!r || r.status !== 'SENT_TO_PRODUCTION') return r
  const stamp = now()
  push(r, { from: r.status, to: 'ACCEPTED_BY_COMPOUNDING', actorId: actor.id, actorName: actor.name, actorRole: actor.role, reason: auto ? 'Aceptación automática al iniciar preparación' : undefined })
  r.status = 'ACCEPTED_BY_COMPOUNDING'
  r.acceptedById = actor.id; r.acceptedByName = actor.name; r.acceptedByRole = actor.role
  r.acceptedAt = stamp.label; r.acceptedAtIso = stamp.iso; r.acceptedAuto = auto
  emit()
  return r
}
/** ¿La solicitud fue enviada pero aún no aceptada por Central de Mezclas? */
export function isPendingAcceptance(preparationOrderId: string): boolean {
  return byOrder.get(preparationOrderId)?.status === 'SENT_TO_PRODUCTION'
}

/** Cancela antes de producción (no borra; conserva historia). */
export function cancelProduction(preparationOrderId: string, reason: string, actor: { id: string; name: string; role: string }): { ok: boolean; reason?: string } {
  const r = byOrder.get(preparationOrderId)
  if (!r) return { ok: false, reason: 'Solicitud no encontrada' }
  const stamp = now()
  push(r, { from: r.status, to: 'CANCELLED', actorId: actor.id, actorName: actor.name, actorRole: actor.role, reason })
  r.status = 'CANCELLED'; r.cancelReason = reason; r.cancelledAt = stamp.label
  emit()
  return { ok: true }
}

export function useProductionStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { getProductionRequest, listProductionRequests, isProductionSent, isPendingAcceptance }
}

export const PRODUCTION_STATUS_TONE: Record<ProductionRequestStatus, 'crit' | 'warn' | 'info' | 'ok'> = {
  DRAFT: 'info', READY_TO_SEND: 'warn', SENT_TO_PRODUCTION: 'info', ACCEPTED_BY_COMPOUNDING: 'ok', CANCELLED: 'crit',
}
