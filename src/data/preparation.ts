import type { PreparationInstance, PreparationOrder } from '../types/preparation'

/**
 * Órdenes de preparación estéril (datos sintéticos, oncología). Enlazadas a
 * pacientes y terapias existentes por id — no se duplican esos modelos.
 * Contexto temporal sintético: hoy = 11 Sep 2026.
 *
 * Cobertura de estados en la cola:
 *   Julián  ONC-2029 → lista (interactivo: iniciar→finalizar→verificar→liberar)
 *   Camilo  ONC-2050 → en preparación (instancia sembrada)
 *   Sofía   ONC-2044 → pendiente de verificación (instancia sembrada)
 *   Laura   ONC-2041 → pendiente de validación (revisión clínica sin resolver)
 *   Patricia ONC-2037 → bloqueada (varios requisitos)
 *   Andrés  ONC-2055 → bloqueada (autorización) · enlaza con ORD-2055
 */
export const PREPARATION_ORDERS: PreparationOrder[] = [
  {
    id: 'PREP-3301', patientId: 'ONC-2029', patientName: 'Julián Castro', domainKind: 'oncologia',
    medication: 'Rituximab', prescribedDose: '375 mg/m² · 712 mg', approvedDose: '712 mg',
    route: 'IV (infusión)', protocol: 'R-CHOP', cycleDay: 'Ciclo 3 · Día 1',
    presentation: 'Vial 500 mg + 100 mg', diluent: 'SSN 0.9% 500 mL', finalVolume: '500 mL',
    administrationTime: 'Infusión escalada · ~4 h', scheduledAt: 'Hoy 10:30', scheduledMinutes: 630,
    responsible: 'Central de Mezclas', container: 'Bolsa EVA 500 mL',
    requirements: [
      { key: 'orden-medica', label: 'Orden de medicación completa', met: true },
      { key: 'datos-paciente', label: 'Datos requeridos del paciente (peso, BSA)', met: true },
      { key: 'dosis-final', label: 'Dosis final confirmada', met: true },
      { key: 'info-preparacion', label: 'Información de preparación completa', met: true },
    ],
    events: [
      { at: 'Hoy 07:40', label: 'Orden de preparación recibida', state: 'done' },
      { at: 'Hoy 08:05', label: 'Validación clínica completada', state: 'done' },
      { at: 'Hoy 08:20', label: 'Dosis final confirmada · 712 mg', state: 'done' },
    ],
  },
  {
    id: 'PREP-3302', patientId: 'ONC-2050', patientName: 'Camilo Ortiz', domainKind: 'oncologia',
    medication: 'Bevacizumab', prescribedDose: '5 mg/kg · 375 mg', approvedDose: '375 mg',
    route: 'IV (infusión)', protocol: 'Bevacizumab (alto costo)', cycleDay: 'Ciclo 6 · Día 1',
    presentation: 'Vial 400 mg + 100 mg', diluent: 'SSN 0.9% 100 mL', finalVolume: '150 mL',
    administrationTime: 'Infusión 90 min', scheduledAt: 'Hoy 09:45', scheduledMinutes: 585,
    responsible: 'Central de Mezclas', container: 'Bolsa EVA 150 mL',
    requirements: [
      { key: 'orden-medica', label: 'Orden de medicación completa', met: true },
      { key: 'datos-paciente', label: 'Datos requeridos del paciente (peso)', met: true },
      { key: 'dosis-final', label: 'Dosis final confirmada', met: true },
      { key: 'info-preparacion', label: 'Información de preparación completa', met: true },
    ],
    events: [
      { at: 'Hoy 08:30', label: 'Orden de preparación recibida', state: 'done' },
      { at: 'Hoy 08:50', label: 'Validación clínica completada', state: 'done' },
      { at: 'Hoy 09:05', label: 'Preparación iniciada · Q.F. Daniela Rueda', state: 'done' },
    ],
  },
  {
    id: 'PREP-3303', patientId: 'ONC-2044', patientName: 'Sofía Herrera', domainKind: 'oncologia',
    medication: 'Carboplatino', prescribedDose: 'AUC 5 · 450 mg', approvedDose: '450 mg',
    route: 'IV (infusión)', protocol: 'Carboplatino + Paclitaxel', cycleDay: 'Ciclo 5 · Día 1',
    presentation: 'Vial 450 mg', diluent: 'DAD 5% 250 mL', finalVolume: '250 mL',
    administrationTime: 'Infusión 60 min', scheduledAt: 'Hoy 11:30', scheduledMinutes: 690,
    responsible: 'Central de Mezclas', container: 'Bolsa EVA 250 mL',
    requirements: [
      { key: 'orden-medica', label: 'Orden de medicación completa', met: true },
      { key: 'datos-paciente', label: 'Datos requeridos del paciente (función renal, BSA)', met: true },
      { key: 'dosis-final', label: 'Dosis final confirmada', met: true },
      { key: 'info-preparacion', label: 'Información de preparación completa', met: true },
    ],
    events: [
      { at: 'Hoy 09:50', label: 'Orden de preparación recibida', state: 'done' },
      { at: 'Hoy 10:15', label: 'Validación clínica completada', state: 'done' },
      { at: 'Hoy 10:40', label: 'Preparación iniciada · Q.F. Andrés Mejía', state: 'done' },
      { at: 'Hoy 11:05', label: 'Preparación finalizada · pendiente de verificación', state: 'warn' },
    ],
  },
  {
    id: 'PREP-3304', patientId: 'ONC-2041', patientName: 'Laura Martínez', domainKind: 'oncologia',
    medication: 'Doxorrubicina', prescribedDose: '60 mg/m² · 108 mg', approvedDose: '108 mg',
    route: 'IV', protocol: 'AC', cycleDay: 'Ciclo 4 · Día 1',
    presentation: 'Vial 50 mg', diluent: 'SSN 0.9% 100 mL', finalVolume: '100 mL',
    administrationTime: 'Bolo IV lento', scheduledAt: 'Mañana 09:00', scheduledMinutes: 540,
    responsible: 'Central de Mezclas', container: 'Jeringa / bolsa 100 mL',
    requirements: [
      { key: 'orden-medica', label: 'Orden de medicación completa', met: true },
      { key: 'datos-paciente', label: 'Datos requeridos del paciente (peso, BSA)', met: true },
      { key: 'dosis-final', label: 'Dosis final confirmada', met: true },
      { key: 'info-preparacion', label: 'Información de preparación completa', met: true },
    ],
    events: [
      { at: 'Hoy 09:10', label: 'Orden de preparación recibida', state: 'done' },
      { at: 'Hoy 09:30', label: 'Hallazgos de revisión clínica pendientes de decisión', state: 'warn' },
    ],
  },
  {
    id: 'PREP-3305', patientId: 'ONC-2037', patientName: 'Patricia López', domainKind: 'oncologia',
    medication: 'Oxaliplatino', prescribedDose: '85 mg/m² · dosis por confirmar',
    route: 'IV (infusión)', protocol: 'FOLFOX', cycleDay: 'Ciclo 1 · Día 1',
    presentation: 'Vial 100 mg', diluent: 'DAD 5% 250 mL',
    administrationTime: 'Infusión 2 h', scheduledAt: 'Hoy 14:30', scheduledMinutes: 870,
    responsible: 'Central de Mezclas', container: 'Bolsa EVA 250 mL',
    requirements: [
      { key: 'orden-medica', label: 'Orden de medicación completa', met: true },
      { key: 'datos-paciente', label: 'Perfil basal del paciente (labs, peso)', met: false, responsible: 'Oncología', nextAction: 'Completar perfil basal' },
      { key: 'dosis-final', label: 'Dosis final confirmada', met: false, responsible: 'Oncología', nextAction: 'Confirmar dosis final' },
      { key: 'info-preparacion', label: 'Información de preparación completa (volumen final)', met: false, responsible: 'Central de Mezclas', nextAction: 'Completar datos de preparación' },
    ],
    events: [
      { at: 'Hoy 08:00', label: 'Orden de preparación recibida', state: 'done' },
      { at: 'Hoy 08:15', label: 'Paciente nuevo — perfil basal por documentar', state: 'warn' },
      { at: '—', label: 'Dosis final por confirmar', state: 'pending' },
    ],
  },
  {
    id: 'PREP-3306', patientId: 'ONC-2055', patientName: 'Andrés Vargas', domainKind: 'oncologia',
    medicationOrderId: 'ORD-2055',
    medication: 'Pembrolizumab', prescribedDose: '200 mg (dosis fija)', approvedDose: '200 mg',
    route: 'IV (infusión)', protocol: 'Pembrolizumab', cycleDay: 'Ciclo 3 · Día 1',
    presentation: 'Vial 100 mg', diluent: 'SSN 0.9% 100 mL', finalVolume: '100 mL',
    administrationTime: 'Infusión 30 min', scheduledAt: 'Hoy 15:30', scheduledMinutes: 930,
    responsible: 'Central de Mezclas', container: 'Bolsa EVA 100 mL',
    requirements: [
      { key: 'orden-medica', label: 'Orden de medicación completa', met: true },
      { key: 'autorizacion', label: 'Autorización vigente', met: true },
      { key: 'datos-paciente', label: 'Datos requeridos del paciente', met: true },
      { key: 'dosis-final', label: 'Dosis final confirmada', met: true },
      { key: 'info-preparacion', label: 'Información de preparación completa', met: true },
    ],
    events: [
      { at: '04 Sep', label: 'Orden de preparación recibida', state: 'done' },
      { at: 'Hoy 14:18', label: 'Preparación liberada', state: 'done' },
      { at: 'Hoy 14:40', label: 'Tratamiento administrado', state: 'done' },
    ],
  },
]

/**
 * Instancias sembradas — casos ya avanzados en la demo. Solo lo mínimo de esta
 * iteración (sin genealogía de lotes). Preparar / verificar / liberar quedan
 * como actores separados y trazables.
 */
export const SEED_INSTANCES: Record<string, PreparationInstance> = {
  // Camilo — liberada (lista para administrar).
  'PREP-3302': {
    id: 'PI-3302', orderId: 'PREP-3302', patientId: 'ONC-2050', medication: 'Bevacizumab',
    finalDose: '375 mg', concentration: '2.5 mg/mL', volume: '150 mL', container: 'Bolsa EVA 150 mL',
    preparedBy: 'Q.F. Daniela Rueda', startedAt: 'Hoy 09:05', completedAt: 'Hoy 09:35',
    verifiedBy: 'Q.F. Andrés Mejía', verifiedAt: 'Hoy 09:44', releasedBy: 'Q.F. Andrés Mejía', releasedAt: 'Hoy 09:50',
  },
  'PREP-3303': {
    id: 'PI-3303', orderId: 'PREP-3303', patientId: 'ONC-2044', medication: 'Carboplatino',
    finalDose: '450 mg', concentration: '1.8 mg/mL', volume: '250 mL', container: 'Bolsa EVA 250 mL',
    preparedBy: 'Q.F. Andrés Mejía', startedAt: 'Hoy 10:40', completedAt: 'Hoy 11:05',
  },
  // Andrés — liberada y ADMINISTRADA (tratamiento completado).
  'PREP-3306': {
    id: 'PI-3306', orderId: 'PREP-3306', patientId: 'ONC-2055', medication: 'Pembrolizumab',
    finalDose: '200 mg', concentration: '2 mg/mL', volume: '100 mL', container: 'Bolsa EVA 100 mL',
    preparedBy: 'Q.F. Daniela Rueda', startedAt: 'Hoy 13:40', completedAt: 'Hoy 14:05',
    verifiedBy: 'Q.F. Andrés Mejía', verifiedAt: 'Hoy 14:12', releasedBy: 'Q.F. Andrés Mejía', releasedAt: 'Hoy 14:18',
  },
}

export function getPreparationOrder(orderId: string): PreparationOrder | undefined {
  return PREPARATION_ORDERS.find((o) => o.id === orderId)
}
