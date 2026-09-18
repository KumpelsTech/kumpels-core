/**
 * Dominio de TRAZABILIDAD de medicación (genealogía). Estructuras compartidas y
 * DISTINTAS entre sí — no se colapsan en un objeto "producto" genérico:
 *
 *   ProductPresentation ≠ BatchLot ≠ InventoryStock ≠ ComponentUsage ≠ PreparationInstance
 *
 * Reutiliza Paciente, Episodio, Orden de medicación, Orden e Instancia de
 * preparación (por id). No duplica datos de paciente ni de medicación.
 * Esta iteración NO incluye inventario completo, mermas, retiros ni cadena de frío.
 */

/** Presentación comercial de un producto (qué es, no cuánto hay). */
export interface ProductPresentation {
  id: string
  product: string
  presentation: string
  strength?: string
  unit: string
  kind: 'medicamento' | 'diluyente' | 'otro'
  /** Concepto de medicamento (independiente de la presentación); mapeo FHIR Medication. */
  medicationConceptId?: string
}

/** Estado de seguridad del lote. Solo "disponible" es normalmente seleccionable. */
export type LotStatus = 'disponible' | 'cuarentena' | 'bloqueado' | 'vencido' | 'retirado'

/** Lote/BatchLot — mínimo necesario. NO es InventoryStock (movimientos/asignación). */
export interface BatchLot {
  id: string
  presentationId: string
  /** Número de lote del fabricante. */
  manufacturerLot: string
  expiration: string
  /** Clave de orden para vencimiento (aaaamm) — para "vence primero". */
  expSort: number
  status: LotStatus
  /** Cantidad disponible (solo para la demo; no es un motor de inventario). */
  availableQuantity?: number
  unit: string
  location?: string
}

/** Tipo de componente en la mezcla (para lectura clínica; no fuerza inventario). */
export type ComponentType = 'principio-activo' | 'diluyente' | 'vehiculo' | 'otro'

/** Componente requerido por una preparación (plan): qué producto y cuánto. */
export interface PreparationComponent {
  key: string
  presentationId: string
  role: 'antineoplastico' | 'diluyente' | 'otro'
  requiredQuantity: number
  unit: string
  /** Etiqueta alterna cuando la cantidad aún no está confirmada. */
  requiredLabel?: string
  /** Tipo de componente (principio activo, diluyente, vehículo, otro). */
  componentType?: ComponentType
}

/**
 * Asignación de un LOTE FUENTE a un componente. Un mismo componente puede usar
 * VARIOS lotes (varios viales de lotes distintos) → varias asignaciones. Es el
 * plan físico previo al registro de uso.
 */
export interface LotAllocation {
  lotId: string
  quantity: number
  unit: string
  note?: string
}

/**
 * Uso real de componente, registrado al finalizar. Inicio de la genealogía. Un
 * componente con varios lotes produce VARIOS ComponentUsage (uno por lote). NO se
 * almacena solo el nombre del medicamento: referencia concepto + presentación + lote.
 */
export interface ComponentUsage {
  id: string
  instanceId: string
  orderId: string
  /** Concepto de medicamento (FHIR Medication) — no solo texto libre. */
  medicationConceptId?: string
  /** Presentación/producto (FHIR Medication con forma/presentación). */
  presentationId: string
  /** Lote fuente/fabricante (FHIR Medication.batch). */
  lotId: string
  quantityUsed: number
  unit: string
  componentType?: ComponentType
  /** Quién registró el uso (Practitioner). */
  recordedBy?: string
  recordedAt?: string
  /** Compat: alias de recordedBy/recordedAt. */
  by: string
  at: string
}

/** Estado del lote de preparación final (mezcla compuesta). */
export type PreparationBatchStatus = 'preparado' | 'liberado' | 'reemplazado' | 'anulado'

/**
 * Lote de PREPARACIÓN FINAL / mezcla compuesta (CompoundingBatch). DISTINTO del
 * BatchLot fuente: identifica el PRODUCTO COMPUESTO cuando el flujo institucional
 * lo requiere. No se reutiliza BatchLot para ambos. Mapeo FHIR: propio de Kumpels
 * (relación con MedicationDispense/Task del producto compuesto + Provenance).
 */
export interface PreparationBatch {
  id: string
  /** Instancia/orden de preparación a la que pertenece. */
  preparationId: string
  /** Número de lote de la mezcla final (p. ej. CMP-20260915-004). */
  batchNumber: string
  createdAt: string
  createdBy: string
  facilityId: string
  status: PreparationBatchStatus
  /** Fecha/hora límite de uso (beyond-use) cuando está disponible. */
  beyondUseAt?: string
  /** Vencimiento del producto compuesto cuando aplica. */
  expirationAt?: string
  version: number
}

/** Entrada de auditoría de selección/uso de lote (sin reemplazo silencioso). */
export interface LotAuditEntry {
  id: string
  at: string
  atIso?: string
  by: string
  byRole?: string
  action: 'seleccion' | 'correccion' | 'uso'
  componentKey: string
  fromLotId?: string
  lotId: string
  quantity?: number
  /** Motivo cuando se cambia un lote ya seleccionado. */
  reason?: string
  note?: string
}

/* ---- Vistas derivadas para la UI ---- */

/** Un lote asignado a un componente (para la UI multi-lote). */
export interface ComponentLotView {
  lot: BatchLot
  quantity: number
  unit: string
  note?: string
  /** true si el lote está en estado utilizable (disponible). */
  usable: boolean
  /** Uso ya registrado para este lote (genealogía), cuando existe. */
  used?: ComponentUsage
}

/** Componente + presentación + lote(s) asignado(s) + validez. */
export interface ComponentView {
  component: PreparationComponent
  presentation: ProductPresentation
  /** Lote principal (primero) — compat con genealogía/Patient 360. */
  lot?: BatchLot
  used?: ComponentUsage
  /** Todos los lotes asignados al componente (uno o varios). */
  lots: ComponentLotView[]
  requiredText: string
}

/** Una parada de la cadena de genealogía (Producto→Lote→…→Paciente). */
export interface GenealogyStep {
  label: string
  value?: string
  at?: string
  state: 'done' | 'pending'
  kind: 'product' | 'lot' | 'prep' | 'verify' | 'release' | 'patient'
}

/** Trazabilidad hacia adelante desde un lote: dónde terminó (preparación → paciente). */
export interface LotTraceEntry {
  orderId: string
  patientName: string
  patientId: string
  prepStatusLabel: string
  used: boolean
  quantity?: string
  at?: string
  /** Lote de mezcla final de esa preparación (distinto del lote fuente). */
  finalBatch?: string
  /** Presentación del producto en la que se usó el lote. */
  presentationLabel?: string
}

/** Traza completa de una preparación (para el drawer de trazabilidad bidireccional). */
export interface PreparationTrace {
  components: ComponentView[]
  batch?: PreparationBatch
}
export interface LotTrace {
  lot: BatchLot
  presentation: ProductPresentation
  entries: LotTraceEntry[]
}
