import type { TherapyDetail } from '../types/therapy'

/**
 * Detalle de terapia por paciente — dominio separado del registro del paciente.
 * Enlazado por id. Datos sintéticos de demostración.
 */
export const THERAPY_BY_ID: Record<string, TherapyDetail> = {
  'ONC-2041': {
    plan: {
      scheme: 'AC — Doxorrubicina + Ciclofosfamida', modality: 'IV',
      status: 'Activo · revisión previa al próximo ciclo', start: '12 Jun 2026',
      pattern: 'Cada 21 días · 6 ciclos',
      cycle: { lastCompleted: 'Ciclo 3 · administrado 30 Ago', currentOrNext: 'Ciclo 4 · por programar tras revisión' },
      isCombination: true,
    },
    medications: [
      { name: 'Doxorrubicina', dose: '60 mg/m²', route: 'IV', schedule: 'Día 1 · cada 21 días', status: 'Activo' },
      { name: 'Ciclofosfamida', dose: '600 mg/m²', route: 'IV', schedule: 'Día 1 · cada 21 días', status: 'Activo' },
    ],
    access: { authStatus: 'Validada', authRef: 'AUT-CMP-77421', lastDispensation: 'Preparación ciclo 3 · 30 Ago', nextEvent: 'Administración: por programar tras revisión', availability: 'Sin pendientes de disponibilidad' },
  },
  'ONC-2018': {
    plan: {
      scheme: 'Abiraterona + Prednisona — oral', modality: 'Oral',
      status: 'Continuo · reabastecimiento vencido', start: '14 May 2026',
      pattern: 'Continuo · dispensación cada 30 días',
      cycle: { phase: 'Tratamiento continuo · dispensación mensual', lastCompleted: 'Dispensación 4 · 12 Ago' },
      isCombination: true,
    },
    medications: [
      { name: 'Abiraterona', dose: '1000 mg/día', route: 'Oral', schedule: '1 vez/día, en ayunas', status: 'Activo' },
      { name: 'Prednisona', dose: '5 mg', route: 'Oral', schedule: '2 veces/día', status: 'Activo' },
    ],
    access: { authStatus: 'Validada', lastDispensation: 'Disp. 4 · 12 Ago (30 días)', nextEvent: 'Reabastecimiento vencido (esperado 03 Sep)', availability: 'Disponible en sede' },
  },
  'ONC-2002': {
    plan: {
      scheme: 'Trastuzumab SC — mantenimiento', modality: 'SC',
      status: 'Continuo · dispensación parcial', start: '02 Jul 2026',
      pattern: 'Cada 21 días · aplicación SC',
      cycle: { lastCompleted: 'Aplicación 3 · 13 Ago', currentOrNext: 'Aplicación 4 · Sep 8' },
      isCombination: false,
    },
    medications: [
      { name: 'Trastuzumab', dose: '600 mg', route: 'SC', schedule: 'Cada 21 días', status: 'Activo' },
    ],
    access: { authStatus: 'Validada', lastDispensation: 'Parcial · 2 de 3 unidades (hoy)', nextEvent: 'Próxima aplicación: Sep 8', availability: '1 unidad pendiente · estimada Sep 5' },
  },
  'ONC-2037': {
    plan: {
      scheme: 'FOLFOX — esquema de infusión', modality: 'Infusión',
      status: 'Onboarding · pendiente entrevista inicial',
      pattern: 'Cada 14 días · 12 ciclos (previsto)',
      cycle: { currentOrNext: 'Ciclo 1 · por programar' },
      isCombination: true,
    },
    medications: [
      { name: 'Oxaliplatino', dose: '85 mg/m²', route: 'IV', schedule: 'Día 1 · cada 14 días', status: 'Pendiente' },
      { name: 'Leucovorina (ácido folínico)', dose: '400 mg/m²', route: 'IV', schedule: 'Día 1', status: 'Pendiente' },
      { name: 'Fluorouracilo (5-FU)', dose: '400 mg/m² bolo + 2400 mg/m² (46 h)', route: 'IV', schedule: 'Días 1-2 · cada 14 días', status: 'Pendiente' },
    ],
    access: { authStatus: 'Recibida', nextEvent: 'Programación tras entrevista inicial', availability: 'Por confirmar' },
  },
  'ONC-2055': {
    plan: {
      scheme: 'Pembrolizumab — monoterapia', modality: 'Infusión',
      status: 'En espera de autorización', start: '31 Jul 2026',
      pattern: 'Cada 21 días · 4 ciclos',
      cycle: { lastCompleted: 'Ciclo 2 · 21 Ago', currentOrNext: 'Ciclo 3 · bloqueado por autorización' },
      isCombination: false,
    },
    medications: [
      { name: 'Pembrolizumab', dose: '200 mg', route: 'IV', schedule: 'Cada 21 días', status: 'Pausado' },
    ],
    access: { authStatus: 'Pendiente', nextEvent: 'Bloqueado — autorización en gestión', availability: 'N/D hasta autorización' },
  },
  'ONC-2011': {
    plan: {
      scheme: 'Capecitabina — monoterapia oral', modality: 'Oral',
      status: 'Continuo · seguimiento vencido', start: '20 Jun 2026',
      pattern: 'Ciclos de 14 días con 7 de descanso',
      cycle: { phase: 'Tratamiento continuo · ciclos 14/7', lastCompleted: 'Dispensación 3 · 19 Ago' },
      isCombination: false,
    },
    medications: [
      { name: 'Capecitabina', dose: '1250 mg/m²', route: 'Oral', schedule: '2 veces/día × 14 días, 7 de descanso', status: 'Activo' },
    ],
    access: { authStatus: 'Validada', lastDispensation: 'Disp. 3 · 19 Ago', nextEvent: 'Seguimiento vencido', availability: 'Disponible en sede' },
  },
  'ONC-2029': {
    plan: {
      scheme: 'R-CHOP', modality: 'IV',
      status: 'Activo · ciclo programado hoy', start: '10 Jul 2026',
      pattern: 'Cada 21 días · 6 ciclos',
      cycle: { lastCompleted: 'Ciclo 2 · 01 Ago', currentOrNext: 'Ciclo 3 · hoy 10:30' },
      isCombination: true,
    },
    medications: [
      { name: 'Rituximab', dose: '375 mg/m²', route: 'IV', schedule: 'Día 1 · cada 21 días', status: 'En curso' },
      { name: 'Ciclofosfamida', dose: '750 mg/m²', route: 'IV', schedule: 'Día 1', status: 'En curso' },
      { name: 'Doxorrubicina', dose: '50 mg/m²', route: 'IV', schedule: 'Día 1', status: 'En curso' },
      { name: 'Vincristina', dose: '1.4 mg/m² (máx 2 mg)', route: 'IV', schedule: 'Día 1', status: 'En curso' },
      { name: 'Prednisona', dose: '100 mg', route: 'Oral', schedule: 'Días 1-5', status: 'En curso' },
    ],
    access: { authStatus: 'Validada', lastDispensation: 'Preparación en curso (hoy)', nextEvent: 'Administración hoy 10:30', availability: 'Disponible' },
  },
  'ONC-2044': {
    plan: {
      scheme: 'Carboplatino + Paclitaxel', modality: 'IV',
      status: 'Activo · ciclo 5 en administración', start: '22 May 2026',
      pattern: 'Cada 21 días · 6 ciclos',
      cycle: { lastCompleted: 'Ciclo 4 · 24 Jul', currentOrNext: 'Ciclo 5 · en administración hoy' },
      isCombination: true,
    },
    medications: [
      { name: 'Carboplatino', dose: 'AUC 5', route: 'IV', schedule: 'Día 1 · cada 21 días', status: 'En curso' },
      { name: 'Paclitaxel', dose: '175 mg/m²', route: 'IV', schedule: 'Día 1 · cada 21 días', status: 'En curso' },
    ],
    access: { authStatus: 'Validada', nextEvent: 'Administración ciclo 5 en curso', availability: 'Disponible' },
  },
  'ONC-2007': {
    plan: {
      scheme: 'Nivolumab SC — monoterapia', modality: 'SC',
      status: 'Continuo · próxima aplicación programada', start: '25 Jun 2026',
      pattern: 'Cada 28 días · aplicación SC',
      cycle: { lastCompleted: 'Aplicación 3 · 06 Ago', currentOrNext: 'Aplicación 4 · Sep 10' },
      isCombination: false,
    },
    medications: [
      { name: 'Nivolumab', dose: '600 mg', route: 'SC', schedule: 'Cada 28 días', status: 'Activo' },
    ],
    access: { authStatus: 'Validada', nextEvent: 'Aplicación: Sep 10', availability: 'Disponible en sede' },
  },
  'ONC-2062': {
    plan: {
      scheme: 'Tamoxifeno — hormonoterapia oral', modality: 'Oral',
      status: 'Continuo · dispensación lista', start: '05 Jul 2026',
      pattern: 'Continuo · dispensación mensual',
      cycle: { phase: 'Tratamiento continuo · dispensación mensual', lastCompleted: 'Dispensación 2 · 04 Ago' },
      isCombination: false,
    },
    medications: [
      { name: 'Tamoxifeno', dose: '20 mg', route: 'Oral', schedule: '1 vez/día', status: 'Activo' },
    ],
    access: { authStatus: 'Validada', lastDispensation: 'Disp. 2 · 04 Ago', nextEvent: 'Dispensación disponible hoy', availability: 'Disponible' },
  },
  'ONC-2050': {
    plan: {
      scheme: 'Bevacizumab — infusión (alto costo)', modality: 'Infusión',
      status: 'Activo · monitoreo de alto costo', start: '17 Abr 2026',
      pattern: 'Cada 14 días · 12 ciclos',
      cycle: { lastCompleted: 'Ciclo 5 · 07 Ago', currentOrNext: 'Ciclo 6 · en curso' },
      isCombination: false,
    },
    medications: [
      { name: 'Bevacizumab', dose: '5 mg/kg', route: 'IV', schedule: 'Cada 14 días', status: 'Activo' },
    ],
    access: { authStatus: 'Validada', nextEvent: 'Ciclo 6 en curso', availability: 'Disponible · alto costo' },
  },
  'ONC-2033': {
    plan: {
      scheme: 'Cisplatino semanal', modality: 'IV',
      status: 'Onboarding · pendiente entrevista inicial',
      pattern: 'Semanal · 5 ciclos (previsto)',
      cycle: { currentOrNext: 'Ciclo 1 · por programar' },
      isCombination: false,
    },
    medications: [
      { name: 'Cisplatino', dose: '40 mg/m²', route: 'IV', schedule: 'Semanal', status: 'Pendiente' },
    ],
    access: { authStatus: 'Recibida', nextEvent: 'Programación tras entrevista', availability: 'Por confirmar' },
    note: 'Quimioterapia concurrente con radioterapia.',
  },
}

export function getTherapy(patientId: string): TherapyDetail | undefined {
  return THERAPY_BY_ID[patientId]
}
