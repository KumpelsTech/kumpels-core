import { useSyncExternalStore } from 'react'
import type {
  ComponentUsage, ComponentView, GenealogyStep, LotAuditEntry, LotStatus, LotTrace, LotTraceEntry,
} from '../types/traceability'
import type { PreparationOrder, PreparationView } from '../types/preparation'
import {
  BATCH_LOTS, PREP_COMPONENTS, SEED_SELECTIONS, SEED_USAGES,
  getComponents, getLot, getPresentation, lotsForPresentation,
} from '../data/traceability'
import { PREPARATION_ORDERS, getPreparationOrder } from '../data/preparation'
import { newId } from './ids'

/**
 * Estado mutable de trazabilidad (en memoria, sesión). Fuente única para la
 * genealogía directa (paciente→lotes) e inversa (lote→pacientes). La lógica de
 * trazabilidad vive aquí, fuera de los componentes de presentación.
 */
const selections = new Map<string, Map<string, string>>() // orderId → (componentKey → lotId)
const usages = new Map<string, ComponentUsage[]>() // orderId → usages
const audit = new Map<string, LotAuditEntry[]>() // orderId → audit trail
const listeners = new Set<() => void>()
let version = 0
let seeded = false

function seed() {
  if (seeded) return
  for (const [orderId, sel] of Object.entries(SEED_SELECTIONS)) {
    selections.set(orderId, new Map(Object.entries(sel)))
  }
  for (const [orderId, us] of Object.entries(SEED_USAGES)) {
    usages.set(orderId, structuredClone(us))
  }
  seeded = true
}
function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { seed(); listeners.add(l); return () => listeners.delete(l) }

function selectionOf(orderId: string): Map<string, string> {
  seed()
  let m = selections.get(orderId)
  if (!m) { m = new Map(); selections.set(orderId, m) }
  return m
}
function pushAudit(orderId: string, entry: LotAuditEntry) {
  audit.set(orderId, [...(audit.get(orderId) ?? []), entry])
}

/** Sugerencia determinística "vence primero" entre lotes disponibles. */
export function suggestLot(presentationId: string): string | undefined {
  const avail = lotsForPresentation(presentationId).filter((l) => l.status === 'disponible')
  if (!avail.length) return undefined
  return [...avail].sort((a, b) => a.expSort - b.expSort)[0].id
}

/** Selección de lote — solo lotes disponibles; nunca reemplazo silencioso. */
export function selectLot(orderId: string, componentKey: string, lotId: string, by: string): { ok: boolean; reason?: string } {
  const lot = getLot(lotId)
  if (!lot) return { ok: false, reason: 'Lote no encontrado.' }
  if (lot.status !== 'disponible') return { ok: false, reason: `Lote ${lot.manufacturerLot} en estado ${LOT_STATUS_LABEL[lot.status]}: no seleccionable.` }
  const sel = selectionOf(orderId)
  const prev = sel.get(componentKey)
  if (prev === lotId) return { ok: true }
  sel.set(componentKey, lotId)
  pushAudit(orderId, {
    id: newId('lotaudit'), at: 'Hoy', by, componentKey, lotId, fromLotId: prev,
    action: prev ? 'correccion' : 'seleccion',
    note: prev ? `Corregido desde ${getLot(prev)?.manufacturerLot ?? prev}` : undefined,
  })
  emit()
  return { ok: true }
}

/** Registra el uso real de componentes al finalizar la preparación (genealogía). */
export function recordUsage(orderId: string, instanceId: string, by: string) {
  seed()
  if ((usages.get(orderId) ?? []).length) return // ya registrado; no duplicar
  const sel = selectionOf(orderId)
  const components = getComponents(orderId)
  const list: ComponentUsage[] = []
  for (const c of components) {
    const lotId = sel.get(c.key)
    if (!lotId) continue
    list.push({
      id: `CU-${orderId.replace('PREP-', '')}-${c.key}`, instanceId, orderId,
      presentationId: c.presentationId, lotId, quantityUsed: c.requiredQuantity, unit: c.unit, by, at: 'Hoy',
    })
    pushAudit(orderId, { id: newId('lotaudit'), at: 'Hoy', by, componentKey: c.key, lotId, action: 'uso' })
  }
  usages.set(orderId, list)
  emit()
}

/* ---- selectores ---- */
export function getComponentViews(orderId: string): ComponentView[] {
  const sel = selectionOf(orderId)
  const used = usages.get(orderId) ?? []
  return getComponents(orderId).map((component) => {
    const presentation = getPresentation(component.presentationId)!
    const lotId = sel.get(component.key)
    const requiredText = component.requiredLabel ?? `${component.requiredQuantity} ${component.unit}`
    return {
      component, presentation,
      lot: lotId ? getLot(lotId) : undefined,
      used: used.find((u) => u.presentationId === component.presentationId),
      requiredText,
    }
  })
}

export function getSelectableLots(presentationId: string) {
  const all = lotsForPresentation(presentationId)
  return { disponibles: all.filter((l) => l.status === 'disponible'), otros: all.filter((l) => l.status !== 'disponible') }
}

export function getAudit(orderId: string): LotAuditEntry[] { return audit.get(orderId) ?? [] }

/** Lote principal (antineoplástico) seleccionado — para Patient 360. */
export function principalLot(orderId: string) {
  const sel = selectionOf(orderId)
  const med = getComponents(orderId).find((c) => c.role === 'antineoplastico')
  const lotId = med ? sel.get(med.key) : undefined
  return lotId ? getLot(lotId) : undefined
}

/** Genealogía directa: Producto → Lote → Preparación → Verificación → Liberación → Paciente. */
export function buildGenealogy(order: PreparationOrder, prep: PreparationView, components: ComponentView[]): GenealogyStep[] {
  const med = components.find((c) => c.component.role === 'antineoplastico')
  const inst = prep.instance
  return [
    { kind: 'product', label: 'Medicamento', value: med?.presentation.product ?? order.medication, state: 'done' },
    { kind: 'lot', label: 'Lote', value: med?.lot ? `${med.lot.manufacturerLot} · vence ${med.lot.expiration}` : 'Sin lote seleccionado', state: med?.lot ? 'done' : 'pending' },
    { kind: 'prep', label: `Preparación ${order.id}`, value: inst?.startedAt ? 'Iniciada' : 'No iniciada', at: inst?.startedAt, state: inst?.startedAt ? 'done' : 'pending' },
    { kind: 'verify', label: 'Verificada', value: inst?.verifiedBy, at: inst?.verifiedAt, state: inst?.verifiedAt ? 'done' : 'pending' },
    { kind: 'release', label: 'Liberada', value: inst?.releasedBy, at: inst?.releasedAt, state: inst?.releasedAt ? 'done' : 'pending' },
    { kind: 'patient', label: 'Paciente', value: order.patientName, state: inst?.releasedAt ? 'done' : 'pending' },
  ]
}

/** Trazabilidad inversa: en qué preparaciones/pacientes terminó un lote. */
export function getLotTrace(lotId: string, statusLabelOf: (orderId: string) => string): LotTrace | null {
  seed()
  const lot = getLot(lotId)
  if (!lot) return null
  const presentation = getPresentation(lot.presentationId)!
  const entries: LotTraceEntry[] = []
  for (const order of PREPARATION_ORDERS) {
    const usedList = usages.get(order.id) ?? []
    const usedEntry = usedList.find((u) => u.lotId === lotId)
    const selectedHere = [...selectionOf(order.id).values()].includes(lotId)
    if (!usedEntry && !selectedHere) continue
    entries.push({
      orderId: order.id, patientName: order.patientName, patientId: order.patientId,
      prepStatusLabel: statusLabelOf(order.id),
      used: !!usedEntry,
      quantity: usedEntry ? `${usedEntry.quantityUsed} ${usedEntry.unit}` : undefined,
      at: usedEntry?.at,
    })
  }
  return { lot, presentation, entries }
}

/** Read model reactivo (solo lectura). La selección de lote pasa por
 * services.traceability; selectLot/recordUsage quedan a nivel de módulo para el
 * adaptador de repositorio y el dominio, no para la UI. */
export function useTraceabilityStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return {
    suggestLot, getComponentViews, getSelectableLots,
    getAudit, principalLot, buildGenealogy, getLotTrace,
  }
}

export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  disponible: 'Disponible', cuarentena: 'Cuarentena', bloqueado: 'Bloqueado', vencido: 'Vencido', retirado: 'Retirado',
}
export const LOT_STATUS_VARIANT: Record<LotStatus, 'ok' | 'action' | 'hi' | 'plain'> = {
  disponible: 'ok', cuarentena: 'action', bloqueado: 'hi', vencido: 'hi', retirado: 'hi',
}

// Reexport para conveniencia de componentes de trazabilidad.
export { PREP_COMPONENTS, BATCH_LOTS, getPreparationOrder }
