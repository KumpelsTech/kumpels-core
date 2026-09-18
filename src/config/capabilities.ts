import type { DemoPersona } from './workspaces'

/**
 * CAPABILITIES — concepto ligero que responde "¿puede este usuario ejecutar esta
 * acción en este contexto?". NO es un motor de autorización empresarial ni una
 * matriz de permisos: es el vocabulario mínimo que la elegibilidad evalúa junto
 * con rol, alcance y política de flujo.
 *
 * Separación de conceptos: User ≠ Role ≠ Capability ≠ Scope ≠ WorkspaceProfile.
 * El rol AGRUPA capacidades por defecto; un usuario podría tener capacidades
 * adicionales/menos según contexto (PractitionerRole-like) sin duplicar la persona.
 */
export type Capability =
  | 'CLINICAL_REVIEW' | 'PHARMACEUTICAL_FOLLOWUP'
  | 'MEDICATION_FULFILLMENT' | 'PATIENT_CONTACT' | 'MEDICATION_DELIVERY'
  | 'STERILE_PREPARATION' | 'STERILE_PREPARATION_VERIFY' | 'STERILE_PREPARATION_RELEASE'
  | 'MEDICATION_ADMINISTRATION' | 'MEDICATION_ADMINISTRATION_CORRECT'
  | 'PREPARATION_REPLACE' | 'MEDICATION_ORDER_CHANGE'
  | 'NURSING_TREATMENT_PLAN_VIEW' | 'PRODUCTION_REQUEST_CREATE' | 'PRODUCTION_REQUEST_SEND' | 'PRODUCTION_REQUEST_CANCEL' | 'PRODUCTION_REQUEST_ACCEPT'
  | 'WORK_ASSIGN' | 'WORK_REASSIGN' | 'WORK_ESCALATE' | 'WORK_PRIORITY_OVERRIDE'
  | 'PATIENT_COMMUNICATION_VIEW' | 'PATIENT_COMMUNICATION_SEND' | 'PATIENT_FOLLOWUP_REVIEW'
  | 'USER_ADMINISTRATION' | 'CLINICAL_CONFIGURATION'

/** Capacidades por defecto de cada rol (base; el usuario puede afinar por contexto). */
export const ROLE_CAPABILITIES: Record<DemoPersona, Capability[]> = {
  coordinador: ['WORK_ASSIGN', 'WORK_REASSIGN', 'WORK_ESCALATE', 'WORK_PRIORITY_OVERRIDE', 'MEDICATION_ORDER_CHANGE', 'PATIENT_COMMUNICATION_VIEW', 'PATIENT_FOLLOWUP_REVIEW'],
  'qf-clinico': ['CLINICAL_REVIEW', 'PHARMACEUTICAL_FOLLOWUP', 'MEDICATION_ORDER_CHANGE', 'PRODUCTION_REQUEST_CANCEL', 'PATIENT_COMMUNICATION_VIEW', 'PATIENT_COMMUNICATION_SEND', 'PATIENT_FOLLOWUP_REVIEW'],
  farmacia: ['MEDICATION_FULFILLMENT', 'PATIENT_CONTACT', 'MEDICATION_DELIVERY', 'PATIENT_COMMUNICATION_VIEW', 'PATIENT_COMMUNICATION_SEND'],
  'qf-mezclas': ['STERILE_PREPARATION', 'STERILE_PREPARATION_VERIFY', 'STERILE_PREPARATION_RELEASE', 'PREPARATION_REPLACE', 'PRODUCTION_REQUEST_ACCEPT'],
  enfermeria: ['MEDICATION_ADMINISTRATION', 'MEDICATION_ADMINISTRATION_CORRECT', 'NURSING_TREATMENT_PLAN_VIEW', 'PRODUCTION_REQUEST_CREATE', 'PRODUCTION_REQUEST_SEND', 'PRODUCTION_REQUEST_CANCEL'],
  admin: ['USER_ADMINISTRATION', 'CLINICAL_CONFIGURATION'],
}

/** Etiqueta legible (UI en español) de cada capacidad. */
export const CAPABILITY_LABEL: Record<Capability, string> = {
  CLINICAL_REVIEW: 'Revisión clínica',
  PHARMACEUTICAL_FOLLOWUP: 'Seguimiento farmacéutico',
  MEDICATION_FULFILLMENT: 'Cumplimiento de medicación',
  PATIENT_CONTACT: 'Contacto con paciente',
  MEDICATION_DELIVERY: 'Entrega de medicación',
  STERILE_PREPARATION: 'Preparar',
  STERILE_PREPARATION_VERIFY: 'Verificar',
  STERILE_PREPARATION_RELEASE: 'Liberar',
  MEDICATION_ADMINISTRATION: 'Administración de medicación',
  MEDICATION_ADMINISTRATION_CORRECT: 'Corregir administración',
  PREPARATION_REPLACE: 'Reemplazar preparación',
  MEDICATION_ORDER_CHANGE: 'Cambiar orden de medicación',
  NURSING_TREATMENT_PLAN_VIEW: 'Ver planeación de tratamientos',
  PRODUCTION_REQUEST_CREATE: 'Crear solicitud de producción',
  PRODUCTION_REQUEST_SEND: 'Enviar a producción',
  PRODUCTION_REQUEST_CANCEL: 'Cancelar solicitud de producción',
  PRODUCTION_REQUEST_ACCEPT: 'Aceptar solicitud de producción',
  PATIENT_COMMUNICATION_VIEW: 'Ver comunicaciones del paciente',
  PATIENT_COMMUNICATION_SEND: 'Enviar comunicaciones al paciente',
  PATIENT_FOLLOWUP_REVIEW: 'Revisar seguimiento reportado',
  WORK_ASSIGN: 'Asignar trabajo',
  WORK_REASSIGN: 'Reasignar trabajo',
  WORK_ESCALATE: 'Escalar trabajo',
  WORK_PRIORITY_OVERRIDE: 'Ajustar prioridad',
  USER_ADMINISTRATION: 'Administración de usuarios',
  CLINICAL_CONFIGURATION: 'Configuración clínica',
}

export const capabilitiesForRole = (role: DemoPersona): Capability[] => ROLE_CAPABILITIES[role] ?? []
