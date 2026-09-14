import type { ValidationRun } from '../types/review'

/**
 * Corridas de validación por paciente — dato compartido entre la cola global
 * (Revisión Clínica) y el tab Revisión de Patient 360. No se duplica en la UI.
 */

/** Verificaciones comunes (para la sección "sin hallazgos", representativa). */
export const COMMON_CHECKS = [
  'Duplicidad terapéutica', 'Interacciones medicamentosas', 'Ajuste por función renal',
  'Ajuste por función hepática', 'Alergias frente al esquema', 'Dosis según BSA',
  'Vía de administración', 'Frecuencia / schedule', 'Autorización vigente', 'Disponibilidad de medicamento',
]

export const REVIEW_BY_ID: Record<string, ValidationRun> = {
  'ONC-2041': {
    summary: { total: 24, sinHallazgos: 19, informativas: 2, requierenRevision: 2, datosInsuficientes: 1 },
    ranAt: 'Hoy 14:35', engine: 'Motor de reglas · Protocolo Oncológico v3.2',
    passedSample: ['Duplicidad terapéutica', 'Interacciones medicamentosas', 'Alergias frente al esquema', 'Vía de administración', 'Autorización vigente'],
    findings: [
      { id: 'F-2041-1', domain: 'Parámetro de laboratorio', kind: 'review', severity: 'HIGH',
        trigger: 'Parámetro clínico fuera del umbral configurado antes del próximo ciclo.',
        patientData: 'Neutrófilos 1.9×10⁹/L (Hoy 14:35)',
        criterion: 'Revisión requerida cuando el recuento de neutrófilos queda por debajo del umbral configurado antes del siguiente ciclo.',
        source: 'Protocolo Oncológico Institucional — Demo v3.2', status: 'Revisión profesional requerida' },
      { id: 'F-2041-2', domain: 'Cambio de tratamiento', kind: 'review', severity: 'ACTION',
        trigger: 'Nueva configuración de esquema añadida al episodio.',
        patientData: 'Esquema AC · cambio registrado 06 Sep',
        criterion: 'Revisar todo cambio de tratamiento antes de continuar el episodio.',
        source: 'Regla de continuidad clínica — Demo v3.2', status: 'Requiere confirmación profesional' },
      { id: 'F-2041-3', domain: 'Función renal', kind: 'info',
        trigger: 'Función renal dentro de rango para el esquema actual.',
        patientData: 'TFG 78 mL/min', criterion: 'Verificación de ajuste por función renal.',
        source: 'Regla de dosificación renal — Demo', status: 'Informativo' },
      { id: 'F-2041-4', domain: 'Interacciones', kind: 'info',
        trigger: 'Sin interacciones mayores detectadas en el esquema actual.',
        patientData: 'AC · 2 componentes', criterion: 'Detección de interacciones medicamentosas mayores.',
        source: 'Base de interacciones — Demo', status: 'Informativo' },
      { id: 'F-2041-5', domain: 'Peso reciente', kind: 'insufficient',
        trigger: 'Peso no actualizado en la última visita.',
        patientData: 'Último peso 64 kg (12 Jun)', criterion: 'Peso vigente para el cálculo de dosis por BSA.',
        source: 'Regla de datos mínimos — Demo', status: 'Dato insuficiente' },
    ],
  },
  'ONC-2018': {
    summary: { total: 18, sinHallazgos: 15, informativas: 1, requierenRevision: 1, datosInsuficientes: 1 },
    ranAt: 'Hoy 08:10', engine: 'Motor de reglas · Adherencia v3.2',
    findings: [
      { id: 'F-2018-1', domain: 'Adherencia / reabastecimiento', kind: 'review', severity: 'ACTION',
        trigger: 'Ventana esperada de reabastecimiento superada sin nueva dispensación.',
        patientData: '4 días fuera de ventana (esperado 03 Sep)',
        criterion: 'Alertar cuando la ventana esperada de reabastecimiento de medicación oral se supera.',
        source: 'Regla operativa de adherencia — Demo v3.2', status: 'Revisión profesional requerida' },
      { id: 'F-2018-2', domain: 'Autorización', kind: 'info',
        trigger: 'Autorización vigente para el tratamiento.', patientData: 'AUT-CMP-70118 · validada 12 Ago',
        criterion: 'Verificación de autorización activa.', source: 'Regla de acceso — Demo', status: 'Informativo' },
      { id: 'F-2018-3', domain: 'Confirmación de recogida', kind: 'insufficient',
        trigger: 'Recogida del medicamento por el paciente no registrada.', patientData: 'Sin registro de recogida tras Disp. 4',
        criterion: 'Confirmación de recogida para estimar adherencia.', source: 'Regla de datos mínimos — Demo', status: 'Dato insuficiente' },
    ],
  },
  'ONC-2037': {
    summary: { total: 12, sinHallazgos: 6, informativas: 1, requierenRevision: 1, datosInsuficientes: 4 },
    ranAt: 'Hoy 10:05', engine: 'Programa de Atención Farmacéutica — Demo v3.2',
    findings: [
      { id: 'F-2037-1', domain: 'Conciliación de medicación', kind: 'review', severity: 'ACTION',
        trigger: 'Paciente nuevo sin conciliación ni entrevista inicial.',
        patientData: 'Sin medicación previa documentada',
        criterion: 'Conciliación y entrevista inicial requeridas antes del primer ciclo.',
        source: 'Programa de Atención Farmacéutica — Demo v3.2', status: 'Revisión profesional requerida' },
      { id: 'F-2037-2', domain: 'Autorización', kind: 'info',
        trigger: 'Autorización recibida para inicio de tratamiento.', patientData: 'AUT-CMP-79005 · Hoy 10:05',
        criterion: 'Verificación de autorización.', source: 'Regla de acceso — Demo', status: 'Informativo' },
      { id: 'F-2037-3', domain: 'Perfil basal', kind: 'insufficient',
        trigger: 'Perfil clínico basal por documentar.', patientData: 'Labs basales pendientes',
        criterion: 'Perfil basal para validar la terapia.', source: 'Regla de datos mínimos — Demo', status: 'Dato insuficiente' },
      { id: 'F-2037-4', domain: 'Alergias', kind: 'insufficient',
        trigger: 'Alergias por confirmar en la entrevista.', patientData: 'Alergias: por confirmar',
        criterion: 'Alergias documentadas antes del primer ciclo.', source: 'Regla de datos mínimos — Demo', status: 'Dato insuficiente' },
    ],
  },
  'ONC-2055': {
    summary: { total: 17, sinHallazgos: 15, informativas: 1, requierenRevision: 1, datosInsuficientes: 0 },
    ranAt: 'Hoy 07:50', engine: 'Motor de reglas · Acceso v3.2',
    findings: [
      { id: 'F-2055-1', domain: 'Acceso / autorización', kind: 'review', severity: 'ACTION',
        trigger: 'Autorización requerida no recibida antes de la ventana de programación.',
        patientData: 'Autorización: pendiente (solicitada 04 Sep)',
        criterion: 'Bloquear programación hasta recibir la autorización requerida.',
        source: 'Regla operativa de acceso — Demo v3.2', status: 'Revisión profesional requerida' },
      { id: 'F-2055-2', domain: 'Validación clínica', kind: 'info',
        trigger: 'Terapia validada previamente sin observaciones.', patientData: 'Validación 21 Ago',
        criterion: 'Registro de validación clínica.', source: 'Regla clínica — Demo', status: 'Informativo' },
    ],
  },
  'ONC-2011': {
    summary: { total: 16, sinHallazgos: 14, informativas: 1, requierenRevision: 1, datosInsuficientes: 0 },
    ranAt: 'Hoy 08:00', engine: 'Motor de reglas · Seguimiento v3.2',
    findings: [
      { id: 'F-2011-1', domain: 'Seguimiento / adherencia', kind: 'review', severity: 'ACTION',
        trigger: 'Seguimiento programado vencido sin registro de contacto.',
        patientData: '3 días de retraso',
        criterion: 'Alertar cuando un seguimiento programado supera su ventana sin contacto.',
        source: 'Regla operativa de seguimiento — Demo v3.2', status: 'Revisión profesional requerida' },
      { id: 'F-2011-2', domain: 'Tolerancia', kind: 'info',
        trigger: 'Sin eventos adversos reportados en el último control.', patientData: 'Control 19 Ago',
        criterion: 'Registro de tolerancia.', source: 'Regla clínica — Demo', status: 'Informativo' },
    ],
  },
  'ONC-2050': {
    summary: { total: 20, sinHallazgos: 18, informativas: 1, requierenRevision: 1, datosInsuficientes: 0 },
    ranAt: 'Hoy 09:00', engine: 'Motor de reglas · Alto costo v3.2',
    findings: [
      { id: 'F-2050-1', domain: 'Alto costo / continuidad', kind: 'review', severity: 'MONITOR',
        trigger: 'Medicamento de alto costo en monitoreo de continuidad.',
        patientData: 'Bevacizumab · ciclo 6/12',
        criterion: 'Monitoreo continuo de continuidad y trazabilidad de tratamientos de alto costo.',
        source: 'Regla operativa de alto costo — Demo v3.2', status: 'Requiere confirmación profesional' },
      { id: 'F-2050-2', domain: 'Trazabilidad', kind: 'info',
        trigger: 'Trazabilidad verificada en el último ciclo.', patientData: 'Ciclo 5 · 07 Ago',
        criterion: 'Verificación de trazabilidad.', source: 'Regla de trazabilidad — Demo', status: 'Informativo' },
    ],
  },
  'ONC-2033': {
    summary: { total: 12, sinHallazgos: 6, informativas: 1, requierenRevision: 1, datosInsuficientes: 4 },
    ranAt: 'Hoy 09:00', engine: 'Programa de Atención Farmacéutica — Demo v3.2',
    findings: [
      { id: 'F-2033-1', domain: 'Conciliación de medicación', kind: 'review', severity: 'MONITOR',
        trigger: 'Paciente nueva sin entrevista inicial de atención farmacéutica.',
        patientData: 'Onboarding en curso',
        criterion: 'Entrevista inicial y conciliación antes del primer ciclo.',
        source: 'Programa de Atención Farmacéutica — Demo v3.2', status: 'Revisión profesional requerida' },
      { id: 'F-2033-2', domain: 'Perfil basal', kind: 'insufficient',
        trigger: 'Perfil basal por documentar.', patientData: 'Labs basales pendientes',
        criterion: 'Perfil basal para validar la terapia.', source: 'Regla de datos mínimos — Demo', status: 'Dato insuficiente' },
    ],
  },
  // --- Pacientes sin hallazgos que requieran revisión (estado tranquilo) ---
  'ONC-2002': {
    summary: { total: 16, sinHallazgos: 15, informativas: 1, requierenRevision: 0, datosInsuficientes: 0 },
    ranAt: 'Hoy 13:20', engine: 'Motor de reglas · Protocolo v3.2',
    findings: [
      { id: 'F-2002-1', domain: 'Validación clínica', kind: 'info',
        trigger: 'Terapia SC validada sin observaciones. El pendiente actual es operativo, no clínico.',
        patientData: 'Trastuzumab SC 600 mg', criterion: 'Registro de validación clínica.',
        source: 'Regla clínica — Demo', status: 'Informativo' },
    ],
  },
  'ONC-2029': {
    summary: { total: 21, sinHallazgos: 20, informativas: 1, requierenRevision: 0, datosInsuficientes: 0 },
    ranAt: 'Hoy 08:30', engine: 'Motor de reglas · Protocolo v3.2',
    findings: [
      { id: 'F-2029-1', domain: 'Validación de ciclo', kind: 'info',
        trigger: 'Ciclo 3 validado sin observaciones.', patientData: 'R-CHOP · ciclo 3',
        criterion: 'Validación previa al ciclo.', source: 'Regla clínica — Demo', status: 'Informativo' },
    ],
  },
  'ONC-2044': {
    summary: { total: 22, sinHallazgos: 21, informativas: 1, requierenRevision: 0, datosInsuficientes: 0 },
    ranAt: 'Hoy 08:20', engine: 'Motor de reglas · Protocolo v3.2',
    findings: [
      { id: 'F-2044-1', domain: 'Revisión de ciclo', kind: 'info',
        trigger: 'Ciclo 5 revisado sin observaciones.', patientData: 'Carboplatino + Paclitaxel',
        criterion: 'Revisión previa al ciclo.', source: 'Regla clínica — Demo', status: 'Informativo' },
    ],
  },
  'ONC-2007': {
    summary: { total: 15, sinHallazgos: 14, informativas: 1, requierenRevision: 0, datosInsuficientes: 0 },
    ranAt: 'Hoy 07:30', engine: 'Motor de reglas · Aplicación v3.2',
    findings: [
      { id: 'F-2007-1', domain: 'Aplicación', kind: 'info',
        trigger: 'Próxima aplicación programada con medicamento disponible.', patientData: 'Aplicación Sep 10',
        criterion: 'Visibilidad de próxima aplicación.', source: 'Regla operativa de aplicación — Demo', status: 'Informativo' },
    ],
  },
  'ONC-2062': {
    summary: { total: 15, sinHallazgos: 14, informativas: 1, requierenRevision: 0, datosInsuficientes: 0 },
    ranAt: 'Hoy 09:10', engine: 'Motor de reglas · Dispensación v3.2',
    findings: [
      { id: 'F-2062-1', domain: 'Dispensación', kind: 'info',
        trigger: 'Dispensación lista dentro de la ventana esperada.', patientData: 'Tamoxifeno · disponible',
        criterion: 'Visibilidad de dispensación lista.', source: 'Regla operativa de dispensación — Demo', status: 'Informativo' },
    ],
  },
}

export function getValidationRun(patientId: string): ValidationRun | undefined {
  return REVIEW_BY_ID[patientId]
}
