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

/** Componente requerido por una preparación (plan): qué producto y cuánto. */
export interface PreparationComponent {
  key: string
  presentationId: string
  role: 'antineoplastico' | 'diluyente' | 'otro'
  requiredQuantity: number
  unit: string
  /** Etiqueta alterna cuando la cantidad aún no está confirmada. */
  requiredLabel?: string
}

/** Uso real de componente, registrado al finalizar. Inicio de la genealogía. */
export interface ComponentUsage {
  id: string
  instanceId: string
  orderId: string
  presentationId: string
  lotId: string
  quantityUsed: number
  unit: string
  by: string
  at: string
}

/** Entrada de auditoría de selección/uso de lote (sin reemplazo silencioso). */
export interface LotAuditEntry {
  id: string
  at: string
  by: string
  action: 'seleccion' | 'correccion' | 'uso'
  componentKey: string
  fromLotId?: string
  lotId: string
  note?: string
}

/* ---- Vistas derivadas para la UI ---- */

/** Componente + presentación + lote seleccionado + validez. */
export interface ComponentView {
  component: PreparationComponent
  presentation: ProductPresentation
  lot?: BatchLot
  used?: ComponentUsage
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

/** Trazabilidad inversa: dónde terminó un lote. */
export interface LotTraceEntry {
  orderId: string
  patientName: string
  patientId: string
  prepStatusLabel: string
  used: boolean
  quantity?: string
  at?: string
}
export interface LotTrace {
  lot: BatchLot
  presentation: ProductPresentation
  entries: LotTraceEntry[]
}
