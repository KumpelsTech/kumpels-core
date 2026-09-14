import type { MedicationFulfillment, MedicationOrder } from '../types/fulfillment'

/**
 * Órdenes y cumplimiento (datos sintéticos). Diana es el caso principal de
 * dispensación parcial (3 ordenadas · 2 dispensadas · 1 pendiente).
 * Contexto temporal sintético: hoy = 11 Sep 2026.
 */
export const ORDERS: MedicationOrder[] = [
  { id: 'ORD-2002', patientId: 'ONC-2002', patientName: 'Diana Gómez', medication: 'Trastuzumab SC 600 mg', unitLabel: 'unidades', orderedQuantity: 3, facility: 'Farmacia Teusaquillo', createdAt: '09 Sep' },
  { id: 'ORD-2055', patientId: 'ONC-2055', patientName: 'Andrés Vargas', medication: 'Pembrolizumab', unitLabel: 'vial', orderedQuantity: 1, facility: 'Farmacia IPS 48', createdAt: '04 Sep' },
  { id: 'ORD-3007', patientId: 'ONC-3007', patientName: 'Óscar Beltrán', medication: 'Rituximab', unitLabel: 'vial', orderedQuantity: 1, facility: 'Farmacia Castellana', createdAt: '05 Sep' },
  { id: 'ORD-3012', patientId: 'ONC-3012', patientName: 'Marcela Díaz', medication: 'Filgrastim SC', unitLabel: 'unidades', orderedQuantity: 2, facility: 'Farmacia Teusaquillo', createdAt: '08 Sep' },
]

export const BASE_FULFILLMENTS: Record<string, MedicationFulfillment> = {
  'ORD-2002': {
    orderId: 'ORD-2002',
    dispenses: [{ id: 'D-2002-1', quantity: 2, at: 'Hoy 12:50', by: 'Farmacia Teusaquillo', kind: 'inicial' }],
    expectedAvailability: 'Sep 13', expectedDay: 13, availabilityUpdatedAt: 'Hoy 13:20',
    communication: 'pendiente', contacts: [], responsible: 'Farmacia Teusaquillo',
    pendingSince: '09 Sep', daysPending: 2,
    nextNeedLabel: 'la próxima aplicación programada', nextNeedDay: 12, nextApplication: 'Sep 12', lot: 'LOT-DEMO-2409',
    events: [
      { at: '09 Sep 08:40', label: 'Prescripción recibida', state: 'done' },
      { at: '09 Sep 10:15', label: 'Validación clínica completada', state: 'done' },
      { at: '09 Sep 11:00', label: 'Autorización completada', state: 'done' },
      { at: 'Hoy 12:50', label: '2 unidades dispensadas', state: 'done' },
      { at: 'Hoy 13:20', label: '1 unidad pendiente por disponibilidad', state: 'warn' },
      { at: '—', label: 'Contacto con paciente pendiente', state: 'pending' },
    ],
  },
  'ORD-2055': {
    orderId: 'ORD-2055',
    dispenses: [], blocked: true,
    expectedAvailability: 'Tras autorización', communication: 'pendiente', contacts: [], responsible: 'Farmacia IPS 48',
    pendingSince: '04 Sep', daysPending: 7,
    nextNeedLabel: 'la programación del ciclo 3',
    events: [
      { at: '04 Sep 09:00', label: 'Prescripción recibida', state: 'done' },
      { at: '04 Sep 11:30', label: 'Validación clínica completada', state: 'done' },
      { at: '04 Sep', label: 'Autorización solicitada — pendiente', state: 'warn' },
      { at: '—', label: 'Dispensación bloqueada hasta autorización', state: 'pending' },
    ],
  },
  'ORD-3007': {
    orderId: 'ORD-3007',
    dispenses: [],
    expectedAvailability: 'Sep 9', expectedDay: 9, communication: 'contactado',
    contacts: [{ id: 'ct-seed-3007-1', at: '06 Sep 09:10', channel: 'Teléfono', result: 'Paciente avisado de la demora', nextStep: 'Reconfirmar disponibilidad' }],
    responsible: 'Farmacia Castellana', pendingSince: '05 Sep', daysPending: 6,
    nextNeedLabel: 'la próxima dispensación', nextNeedDay: 10,
    events: [
      { at: '05 Sep 10:00', label: 'Prescripción recibida', state: 'done' },
      { at: '05 Sep 12:10', label: 'Validación clínica completada', state: 'done' },
      { at: '05 Sep', label: '1 vial pendiente por disponibilidad', state: 'warn' },
      { at: '06 Sep 09:10', label: 'Contacto registrado · Teléfono', state: 'done' },
    ],
  },
  'ORD-3012': {
    orderId: 'ORD-3012',
    dispenses: [],
    expectedAvailability: 'Sep 12', expectedDay: 12, communication: 'informado',
    contacts: [{ id: 'ct-seed-3012-1', at: '09 Sep 15:40', channel: 'WhatsApp', result: 'Paciente informado de la fecha estimada' }],
    responsible: 'Farmacia Teusaquillo', pendingSince: '08 Sep', daysPending: 3,
    nextNeedLabel: 'la próxima dispensación', nextNeedDay: 14,
    events: [
      { at: '08 Sep 14:00', label: 'Prescripción recibida', state: 'done' },
      { at: '08 Sep 15:20', label: 'Validación clínica completada', state: 'done' },
      { at: '08 Sep', label: '2 unidades pendientes por disponibilidad', state: 'warn' },
      { at: '09 Sep 15:40', label: 'Paciente informado · WhatsApp', state: 'done' },
    ],
  },
}
