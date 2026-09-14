import type {
  BatchLot, ComponentUsage, PreparationComponent, ProductPresentation,
} from '../types/traceability'

/**
 * Datos sintéticos de trazabilidad. Contexto temporal: hoy = 11 Sep 2026.
 * Los estados de lote cubren disponible / cuarentena / bloqueado / vencido / retirado
 * para demostrar la selección segura. No es un inventario real.
 */
export const PRODUCT_PRESENTATIONS: ProductPresentation[] = [
  { id: 'PRES-RTX-500', product: 'Rituximab', presentation: 'Vial 500 mg', strength: '500 mg', unit: 'mg', kind: 'medicamento' },
  { id: 'PRES-BEV-400', product: 'Bevacizumab', presentation: 'Vial 400 mg', strength: '400 mg', unit: 'mg', kind: 'medicamento' },
  { id: 'PRES-CBP-450', product: 'Carboplatino', presentation: 'Vial 450 mg', strength: '450 mg', unit: 'mg', kind: 'medicamento' },
  { id: 'PRES-DOX-50', product: 'Doxorrubicina', presentation: 'Vial 50 mg', strength: '50 mg', unit: 'mg', kind: 'medicamento' },
  { id: 'PRES-OXA-100', product: 'Oxaliplatino', presentation: 'Vial 100 mg', strength: '100 mg', unit: 'mg', kind: 'medicamento' },
  { id: 'PRES-PEM-100', product: 'Pembrolizumab', presentation: 'Vial 100 mg', strength: '100 mg', unit: 'mg', kind: 'medicamento' },
  { id: 'PRES-SSN-500', product: 'Cloruro de sodio 0.9%', presentation: 'Bolsa 500 mL', unit: 'mL', kind: 'diluyente' },
  { id: 'PRES-SSN-100', product: 'Cloruro de sodio 0.9%', presentation: 'Bolsa 100 mL', unit: 'mL', kind: 'diluyente' },
  { id: 'PRES-DAD-250', product: 'Dextrosa 5%', presentation: 'Bolsa 250 mL', unit: 'mL', kind: 'diluyente' },
]

export const BATCH_LOTS: BatchLot[] = [
  // Rituximab — dos disponibles (uno vence primero) + uno en cuarentena
  { id: 'LOT-RTX-B', presentationId: 'PRES-RTX-500', manufacturerLot: 'RTX2312', expiration: 'Nov 2026', expSort: 202611, status: 'disponible', availableQuantity: 3, unit: 'vial', location: 'Nevera A2' },
  { id: 'LOT-RTX-A', presentationId: 'PRES-RTX-500', manufacturerLot: 'RTX2401', expiration: 'Feb 2027', expSort: 202702, status: 'disponible', availableQuantity: 6, unit: 'vial', location: 'Nevera A2' },
  { id: 'LOT-RTX-C', presentationId: 'PRES-RTX-500', manufacturerLot: 'RTX2405', expiration: 'Jun 2027', expSort: 202706, status: 'cuarentena', availableQuantity: 4, unit: 'vial', location: 'Recepción' },
  // Bevacizumab — disponible + bloqueado
  { id: 'LOT-BEV-A', presentationId: 'PRES-BEV-400', manufacturerLot: 'BEV51', expiration: 'Mar 2027', expSort: 202703, status: 'disponible', availableQuantity: 5, unit: 'vial', location: 'Nevera A1' },
  { id: 'LOT-BEV-B', presentationId: 'PRES-BEV-400', manufacturerLot: 'BEV49', expiration: 'Dic 2026', expSort: 202612, status: 'bloqueado', availableQuantity: 2, unit: 'vial', location: 'Nevera A1' },
  // Carboplatino — disponible (usado por Sofía) + otro disponible + vencido
  { id: 'LOT-CBP-A', presentationId: 'PRES-CBP-450', manufacturerLot: 'CBP77', expiration: 'Oct 2026', expSort: 202610, status: 'disponible', availableQuantity: 4, unit: 'vial', location: 'Estante B3' },
  { id: 'LOT-CBP-B', presentationId: 'PRES-CBP-450', manufacturerLot: 'CBP80', expiration: 'Ene 2027', expSort: 202701, status: 'disponible', availableQuantity: 7, unit: 'vial', location: 'Estante B3' },
  { id: 'LOT-CBP-C', presentationId: 'PRES-CBP-450', manufacturerLot: 'CBP60', expiration: 'Ago 2026', expSort: 202608, status: 'vencido', availableQuantity: 1, unit: 'vial', location: 'Estante B3' },
  // Doxorrubicina — disponible + retirado
  { id: 'LOT-DOX-A', presentationId: 'PRES-DOX-50', manufacturerLot: 'DOX22', expiration: 'May 2027', expSort: 202705, status: 'disponible', availableQuantity: 8, unit: 'vial', location: 'Nevera A3' },
  { id: 'LOT-DOX-B', presentationId: 'PRES-DOX-50', manufacturerLot: 'DOX18', expiration: 'Sep 2026', expSort: 202609, status: 'retirado', availableQuantity: 0, unit: 'vial', location: 'Nevera A3' },
  // Oxaliplatino / Pembrolizumab — un disponible cada uno
  { id: 'LOT-OXA-A', presentationId: 'PRES-OXA-100', manufacturerLot: 'OXA33', expiration: 'Abr 2027', expSort: 202704, status: 'disponible', availableQuantity: 6, unit: 'vial', location: 'Estante B2' },
  { id: 'LOT-PEM-A', presentationId: 'PRES-PEM-100', manufacturerLot: 'PEM70', expiration: 'Jul 2027', expSort: 202707, status: 'disponible', availableQuantity: 5, unit: 'vial', location: 'Nevera A1' },
  // Diluyentes
  { id: 'LOT-SSN-500-A', presentationId: 'PRES-SSN-500', manufacturerLot: 'SSN500-2408', expiration: 'Ago 2027', expSort: 202708, status: 'disponible', availableQuantity: 40, unit: 'bolsa', location: 'Almacén' },
  { id: 'LOT-SSN-100-A', presentationId: 'PRES-SSN-100', manufacturerLot: 'SSN100-2409', expiration: 'Sep 2027', expSort: 202709, status: 'disponible', availableQuantity: 60, unit: 'bolsa', location: 'Almacén' },
  { id: 'LOT-DAD-250-A', presentationId: 'PRES-DAD-250', manufacturerLot: 'DAD250-2407', expiration: 'Jul 2027', expSort: 202707, status: 'disponible', availableQuantity: 35, unit: 'bolsa', location: 'Almacén' },
]

/** Componentes requeridos por orden de preparación (no se listan consumibles menores). */
export const PREP_COMPONENTS: Record<string, PreparationComponent[]> = {
  'PREP-3301': [
    { key: 'med', presentationId: 'PRES-RTX-500', role: 'antineoplastico', requiredQuantity: 712, unit: 'mg' },
    { key: 'dil', presentationId: 'PRES-SSN-500', role: 'diluyente', requiredQuantity: 500, unit: 'mL' },
  ],
  'PREP-3302': [
    { key: 'med', presentationId: 'PRES-BEV-400', role: 'antineoplastico', requiredQuantity: 375, unit: 'mg' },
    { key: 'dil', presentationId: 'PRES-SSN-100', role: 'diluyente', requiredQuantity: 100, unit: 'mL' },
  ],
  'PREP-3303': [
    { key: 'med', presentationId: 'PRES-CBP-450', role: 'antineoplastico', requiredQuantity: 450, unit: 'mg' },
    { key: 'dil', presentationId: 'PRES-DAD-250', role: 'diluyente', requiredQuantity: 250, unit: 'mL' },
  ],
  'PREP-3304': [
    { key: 'med', presentationId: 'PRES-DOX-50', role: 'antineoplastico', requiredQuantity: 108, unit: 'mg' },
    { key: 'dil', presentationId: 'PRES-SSN-100', role: 'diluyente', requiredQuantity: 100, unit: 'mL' },
  ],
  'PREP-3305': [
    { key: 'med', presentationId: 'PRES-OXA-100', role: 'antineoplastico', requiredQuantity: 0, unit: 'mg', requiredLabel: 'Por confirmar' },
    { key: 'dil', presentationId: 'PRES-DAD-250', role: 'diluyente', requiredQuantity: 250, unit: 'mL' },
  ],
  'PREP-3306': [
    { key: 'med', presentationId: 'PRES-PEM-100', role: 'antineoplastico', requiredQuantity: 200, unit: 'mg' },
    { key: 'dil', presentationId: 'PRES-SSN-100', role: 'diluyente', requiredQuantity: 100, unit: 'mL' },
  ],
}

/** Selección de lote sembrada por orden/componente (el usuario puede cambiarla). */
export const SEED_SELECTIONS: Record<string, Record<string, string>> = {
  'PREP-3301': { med: 'LOT-RTX-B', dil: 'LOT-SSN-500-A' },
  'PREP-3302': { med: 'LOT-BEV-A', dil: 'LOT-SSN-100-A' },
  'PREP-3303': { med: 'LOT-CBP-A', dil: 'LOT-DAD-250-A' },
  'PREP-3304': { med: 'LOT-DOX-A', dil: 'LOT-SSN-100-A' },
  'PREP-3305': { med: 'LOT-OXA-A', dil: 'LOT-DAD-250-A' },
  'PREP-3306': { med: 'LOT-PEM-A', dil: 'LOT-SSN-100-A' },
}

/** Usos sembrados para instancias ya finalizadas (Sofía · PREP-3303). */
export const SEED_USAGES: Record<string, ComponentUsage[]> = {
  'PREP-3303': [
    { id: 'CU-3303-med', instanceId: 'PI-3303', orderId: 'PREP-3303', presentationId: 'PRES-CBP-450', lotId: 'LOT-CBP-A', quantityUsed: 450, unit: 'mg', by: 'Q.F. Andrés Mejía', at: 'Hoy 11:05' },
    { id: 'CU-3303-dil', instanceId: 'PI-3303', orderId: 'PREP-3303', presentationId: 'PRES-DAD-250', lotId: 'LOT-DAD-250-A', quantityUsed: 250, unit: 'mL', by: 'Q.F. Andrés Mejía', at: 'Hoy 11:05' },
  ],
}

export function getPresentation(id: string): ProductPresentation | undefined {
  return PRODUCT_PRESENTATIONS.find((p) => p.id === id)
}
export function getLot(id: string): BatchLot | undefined {
  return BATCH_LOTS.find((l) => l.id === id)
}
export function lotsForPresentation(presentationId: string): BatchLot[] {
  return BATCH_LOTS.filter((l) => l.presentationId === presentationId)
}
export function getComponents(orderId: string): PreparationComponent[] {
  return PREP_COMPONENTS[orderId] ?? []
}
