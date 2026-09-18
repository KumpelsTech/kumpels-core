import { useSyncExternalStore } from 'react'
import type {
  ComponentLotView, ComponentUsage, ComponentView, GenealogyStep, LotAllocation, LotAuditEntry,
  LotStatus, LotTrace, LotTraceEntry, PreparationBatch, PreparationBatchStatus, PreparationTrace,
} from '../types/traceability'
import type { PreparationOrder, PreparationView } from '../types/preparation'
import {
  BATCH_LOTS, PREP_COMPONENTS, SEED_ALLOCATIONS, SEED_BATCHES, SEED_SELECTIONS, SEED_USAGES,
  getComponents, getLot, getPresentation, lotsForPresentation,
} from '../data/traceability'
import { PREPARATION_ORDERS, getPreparationOrder } from '../data/preparation'
import { newId } from './ids'
import { nowLabel } from './datetime'

/**
 * Estado mutable de trazabilidad (en memoria, sesión). Fuente única para la
 * genealogía directa (paciente→lotes) e inversa (lote→pacientes). La lógica de
 * trazabilidad vive aquí, fuera de los componentes de presentación.
 */
const selections = new Map<string, Map<string, string>>() // orderId → (componentKey → lotId primario)
const allocations = new Map<string, Map<string, LotAllocation[]>>() // overlay multi-lote: orderId → (componentKey → lotes)
const usages = new Map<string, ComponentUsage[]>() // orderId → usages
const batches = new Map<string, PreparationBatch>() // orderId → lote de mezcla final
const audit = new Map<string, LotAuditEntry[]>() // orderId → audit trail
const componentAlias = new Map<string, string>() // orderId → parentId (reemplazo controlado)
const listeners = new Set<() => void>()
let version = 0
let seeded = false

function seed() {
  if (seeded) return
  for (const [orderId, sel] of Object.entries(SEED_SELECTIONS)) {
    selections.set(orderId, new Map(Object.entries(sel)))
  }
  for (const [orderId, alloc] of Object.entries(SEED_ALLOCATIONS)) {
    allocations.set(orderId, new Map(Object.entries(structuredClone(alloc))))
  }
  for (const [orderId, us] of Object.entries(SEED_USAGES)) {
    usages.set(orderId, structuredClone(us))
  }
  for (const [orderId, b] of Object.entries(SEED_BATCHES)) {
    batches.set(orderId, structuredClone(b))
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

/** Alias de componentes: un reemplazo reutiliza la PLANTILLA del padre (plan, no
 * la genealogía física). Las asignaciones/usos/lote final son propios del nuevo id. */
export function aliasOrder(newId: string, parentId: string) { componentAlias.set(newId, parentId) }
function componentsOf(orderId: string) { return getComponents(componentAlias.get(orderId) ?? orderId) }

/**
 * Materializa las asignaciones de lotes de un componente. Si hay overlay
 * multi-lote lo usa; si no, deriva una sola asignación de la selección principal
 * (con la cantidad requerida). Fuente única para la UI multi-lote.
 */
function allocationsOf(orderId: string, componentKey: string): LotAllocation[] {
  const overlay = allocations.get(orderId)?.get(componentKey)
  if (overlay && overlay.length) return overlay
  const primary = selectionOf(orderId).get(componentKey)
  if (!primary) return []
  const comp = componentsOf(orderId).find((c) => c.key === componentKey)
  return [{ lotId: primary, quantity: comp?.requiredQuantity ?? 0, unit: comp?.unit ?? '' }]
}
/** Escribe el overlay multi-lote y sincroniza la selección principal (primer lote). */
function setAllocations(orderId: string, componentKey: string, list: LotAllocation[]) {
  let m = allocations.get(orderId)
  if (!m) { m = new Map(); allocations.set(orderId, m) }
  m.set(componentKey, list)
  const sel = selectionOf(orderId)
  if (list[0]) sel.set(componentKey, list[0].lotId)
  else sel.delete(componentKey)
}
/** Todos los ids de lote asignados a una orden (para trazabilidad inversa). */
function allLotIdsFor(orderId: string): string[] {
  const ids = new Set<string>()
  for (const c of componentsOf(orderId)) for (const a of allocationsOf(orderId, c.key)) ids.add(a.lotId)
  return [...ids]
}

/** Añade un LOTE FUENTE a un componente (permite varios lotes por componente). */
export function addLotAllocation(orderId: string, componentKey: string, lotId: string, quantity: number, unit: string, by: string, note?: string): { ok: boolean; reason?: string } {
  const lot = getLot(lotId)
  if (!lot) return { ok: false, reason: 'Lote no encontrado.' }
  if (lot.status !== 'disponible') return { ok: false, reason: `Lote ${lot.manufacturerLot} en estado ${LOT_STATUS_LABEL[lot.status]}: no seleccionable.` }
  const cur = [...allocationsOf(orderId, componentKey)]
  if (cur.some((a) => a.lotId === lotId)) return { ok: true } // ya asignado
  cur.push({ lotId, quantity, unit, note })
  setAllocations(orderId, componentKey, cur)
  pushAudit(orderId, { id: newId('lotaudit'), at: nowLabel(), by, componentKey, lotId, quantity, action: 'seleccion', note: note ?? `Lote añadido${quantity ? ` · ${quantity} ${unit}` : ''}` })
  emit()
  return { ok: true }
}
/** Cambia un lote específico de un componente (corrección trazable, conserva cantidad). */
export function changeLotAllocation(orderId: string, componentKey: string, fromLotId: string, toLotId: string, by: string, reason?: string): { ok: boolean; reason?: string } {
  const lot = getLot(toLotId)
  if (!lot) return { ok: false, reason: 'Lote no encontrado.' }
  if (lot.status !== 'disponible') return { ok: false, reason: `Lote ${lot.manufacturerLot} en estado ${LOT_STATUS_LABEL[lot.status]}: no seleccionable.` }
  const cur = allocationsOf(orderId, componentKey).map((a) => (a.lotId === fromLotId ? { ...a, lotId: toLotId } : a))
  setAllocations(orderId, componentKey, cur)
  pushAudit(orderId, { id: newId('lotaudit'), at: nowLabel(), by, componentKey, lotId: toLotId, fromLotId, action: 'correccion', reason, note: `Corregido desde ${getLot(fromLotId)?.manufacturerLot ?? fromLotId}${reason ? ` — ${reason}` : ''}` })
  emit()
  return { ok: true }
}
/** Quita un lote de un componente (antes de verificar). */
export function removeLotAllocation(orderId: string, componentKey: string, lotId: string, by: string): { ok: boolean; reason?: string } {
  const cur = allocationsOf(orderId, componentKey).filter((a) => a.lotId !== lotId)
  setAllocations(orderId, componentKey, cur)
  pushAudit(orderId, { id: newId('lotaudit'), at: nowLabel(), by, componentKey, lotId, action: 'correccion', note: `Lote ${getLot(lotId)?.manufacturerLot ?? lotId} retirado de la mezcla` })
  emit()
  return { ok: true }
}

/** Confirma / actualiza el LOTE DE PREPARACIÓN FINAL (mezcla compuesta). */
export function confirmPreparationBatch(orderId: string, input: { batchNumber: string; facilityId: string; beyondUseAt?: string; expirationAt?: string; status?: PreparationBatchStatus }, by: string): PreparationBatch {
  const existing = batches.get(orderId)
  const batch: PreparationBatch = {
    id: existing?.id ?? newId('pb'), preparationId: orderId,
    batchNumber: input.batchNumber, createdAt: existing?.createdAt ?? nowLabel(), createdBy: existing?.createdBy ?? by,
    facilityId: input.facilityId, status: input.status ?? existing?.status ?? 'preparado',
    beyondUseAt: input.beyondUseAt ?? existing?.beyondUseAt, expirationAt: input.expirationAt ?? existing?.expirationAt,
    version: (existing?.version ?? 0) + 1,
  }
  batches.set(orderId, batch)
  pushAudit(orderId, { id: newId('lotaudit'), at: nowLabel(), by, componentKey: '(mezcla final)', lotId: batch.batchNumber, action: existing ? 'correccion' : 'seleccion', note: `Lote de mezcla final ${batch.batchNumber} (v${batch.version})` })
  emit()
  return batch
}
export function getPreparationBatch(orderId: string): PreparationBatch | undefined { return batches.get(orderId) }

/** Sugerencia determinística "vence primero" entre lotes disponibles. */
export function suggestLot(presentationId: string): string | undefined {
  const avail = lotsForPresentation(presentationId).filter((l) => l.status === 'disponible')
  if (!avail.length) return undefined
  return [...avail].sort((a, b) => a.expSort - b.expSort)[0].id
}

/**
 * Selección del lote PRINCIPAL (único) de un componente — solo lotes disponibles;
 * nunca reemplazo silencioso. Reinicia el overlay multi-lote a una sola asignación
 * (para el caso de un componente con un lote). Para varios lotes: addLotAllocation.
 */
export function selectLot(orderId: string, componentKey: string, lotId: string, by: string, reason?: string): { ok: boolean; reason?: string } {
  const lot = getLot(lotId)
  if (!lot) return { ok: false, reason: 'Lote no encontrado.' }
  if (lot.status !== 'disponible') return { ok: false, reason: `Lote ${lot.manufacturerLot} en estado ${LOT_STATUS_LABEL[lot.status]}: no seleccionable.` }
  const sel = selectionOf(orderId)
  const prev = sel.get(componentKey)
  if (prev === lotId && allocationsOf(orderId, componentKey).length <= 1) return { ok: true }
  const comp = componentsOf(orderId).find((c) => c.key === componentKey)
  setAllocations(orderId, componentKey, [{ lotId, quantity: comp?.requiredQuantity ?? 0, unit: comp?.unit ?? '' }])
  pushAudit(orderId, {
    id: newId('lotaudit'), at: nowLabel(), by, componentKey, lotId, fromLotId: prev,
    action: prev ? 'correccion' : 'seleccion', reason: prev ? reason : undefined,
    note: prev ? `Corregido desde ${getLot(prev)?.manufacturerLot ?? prev}${reason ? ` — ${reason}` : ''}` : undefined,
  })
  emit()
  return { ok: true }
}

/**
 * Registra el uso real de componentes al finalizar (genealogía). Un componente con
 * VARIOS lotes produce VARIOS ComponentUsage (uno por lote). Enriquece con concepto
 * de medicamento, tipo de componente y quién/cuándo registró.
 */
export function recordUsage(orderId: string, instanceId: string, by: string) {
  seed()
  if ((usages.get(orderId) ?? []).length) return // ya registrado; no duplicar
  const at = nowLabel()
  const components = componentsOf(orderId)
  const list: ComponentUsage[] = []
  for (const c of components) {
    const allocs = allocationsOf(orderId, c.key)
    const presentation = getPresentation(c.presentationId)
    allocs.forEach((a, i) => {
      list.push({
        id: `CU-${orderId.replace('PREP-', '')}-${c.key}-${i + 1}`, instanceId, orderId,
        medicationConceptId: presentation?.medicationConceptId, presentationId: c.presentationId,
        lotId: a.lotId, quantityUsed: a.quantity, unit: a.unit, componentType: c.componentType,
        recordedBy: by, recordedAt: at, by, at,
      })
      pushAudit(orderId, { id: newId('lotaudit'), at, by, componentKey: c.key, lotId: a.lotId, quantity: a.quantity, action: 'uso' })
    })
  }
  usages.set(orderId, list)
  emit()
}

/* ---- selectores ---- */
export function getComponentViews(orderId: string): ComponentView[] {
  const used = usages.get(orderId) ?? []
  return componentsOf(orderId).map((component) => {
    const presentation = getPresentation(component.presentationId)!
    const requiredText = component.requiredLabel ?? `${component.requiredQuantity} ${component.unit}`
    const lots: ComponentLotView[] = []
    for (const a of allocationsOf(orderId, component.key)) {
      const lot = getLot(a.lotId)
      if (!lot) continue
      lots.push({
        lot, quantity: a.quantity, unit: a.unit, note: a.note,
        usable: lot.status === 'disponible',
        used: used.find((u) => u.lotId === a.lotId && u.presentationId === component.presentationId),
      })
    }
    return {
      component, presentation,
      lot: lots[0]?.lot,
      used: used.find((u) => u.presentationId === component.presentationId),
      lots,
      requiredText,
    }
  })
}

export function getSelectableLots(presentationId: string) {
  const all = lotsForPresentation(presentationId)
  return { disponibles: all.filter((l) => l.status === 'disponible'), otros: all.filter((l) => l.status !== 'disponible') }
}

export function getAudit(orderId: string): LotAuditEntry[] { return audit.get(orderId) ?? [] }

/** Lote principal (antineoplástico, primer lote) — para Patient 360. */
export function principalLot(orderId: string) {
  const med = componentsOf(orderId).find((c) => c.role === 'antineoplastico')
  const lotId = med ? allocationsOf(orderId, med.key)[0]?.lotId : undefined
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
    const selectedHere = allLotIdsFor(order.id).includes(lotId)
    if (!usedEntry && !selectedHere) continue
    entries.push({
      orderId: order.id, patientName: order.patientName, patientId: order.patientId,
      prepStatusLabel: statusLabelOf(order.id),
      used: !!usedEntry,
      quantity: usedEntry ? `${usedEntry.quantityUsed} ${usedEntry.unit}` : undefined,
      at: usedEntry?.at,
      finalBatch: batches.get(order.id)?.batchNumber,
      presentationLabel: `${presentation.product} · ${presentation.presentation}`,
    })
  }
  return { lot, presentation, entries }
}

/** Traza completa de una preparación (componentes con sus lotes + lote de mezcla final). */
export function getPreparationTrace(orderId: string): PreparationTrace {
  return { components: getComponentViews(orderId), batch: batches.get(orderId) }
}

/** Read model reactivo (solo lectura). La selección de lote pasa por
 * services.traceability; selectLot/recordUsage quedan a nivel de módulo para el
 * adaptador de repositorio y el dominio, no para la UI. */
export function useTraceabilityStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return {
    suggestLot, getComponentViews, getSelectableLots,
    getAudit, principalLot, buildGenealogy, getLotTrace, getPreparationBatch, getPreparationTrace,
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
