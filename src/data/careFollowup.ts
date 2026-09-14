import type { Patient } from '../types/patient'
import type { CareDomain, PharmaceuticalCareEnrollment } from '../types/careFollowup'
import { getPatient } from './patients'

const d = (key: string, label: string, state: CareDomain['state'], note: string): CareDomain => ({ key, label, state, note })

/** Enrollments explícitos para los casos con seguimiento clínicamente relevante. */
const EXPLICIT: Record<string, PharmaceuticalCareEnrollment> = {
  'ONC-2041': {
    patientId: 'ONC-2041', mode: 'seguimiento', status: 'requerido', statusLabel: 'Requiere revisión de seguridad', required: true,
    lastAssessment: '27 Ago · post-ciclo 3', nextFollowUp: 'Post-ciclo 4', responsible: 'Ximena Torres',
    setting: 'Intrahospitalario', intensity: 'Alta',
    domains: [
      d('continuidad', 'Continuidad', 'ok', 'Tratamiento activo'),
      d('adherencia', 'Uso / Adherencia', 'ok', 'Administración supervisada (IV)'),
      d('efectividad', 'Efectividad', 'ok', 'Respuesta esperada al ciclo 3'),
      d('seguridad', 'Seguridad', 'warn', 'Parámetro de laboratorio fuera de criterio — revisión requerida'),
      d('cambios', 'Cambios de tratamiento', 'warn', 'Cambio de esquema registrado 06 Sep'),
      d('acceso', 'Acceso / suministro', 'ok', 'Autorización vigente'),
      d('paciente', 'Información del paciente', 'na', 'Sin autoreporte reciente'),
    ],
  },
  'ONC-2018': {
    patientId: 'ONC-2018', mode: 'seguimiento', status: 'vencido', statusLabel: 'Seguimiento vencido · reabastecimiento', required: true,
    lastAssessment: '12 Ago', nextFollowUp: 'Inmediato (vencido)', responsible: 'Ximena Torres', setting: 'Ambulatorio',
    domains: [
      d('continuidad', 'Continuidad', 'warn', 'Reabastecimiento vencido — riesgo de interrupción'),
      d('adherencia', 'Uso / Adherencia', 'warn', 'Uso no confirmado desde 12 Ago'),
      d('efectividad', 'Efectividad', 'ok', 'Sin señales adversas en último control'),
      d('seguridad', 'Seguridad', 'ok', 'Sin nuevos síntomas reportados'),
      d('cambios', 'Cambios de tratamiento', 'ok', 'Sin cambios recientes'),
      d('acceso', 'Acceso / suministro', 'warn', 'Dispensación pendiente'),
      d('paciente', 'Información del paciente', 'na', 'Sin contacto reciente (2 intentos)'),
    ],
  },
  'ONC-2002': {
    patientId: 'ONC-2002', mode: 'seguimiento', status: 'al-dia', statusLabel: 'Al día · pendiente operativo', required: false,
    lastAssessment: '28 Ago', nextFollowUp: 'Tras aplicación (Sep 8)', responsible: 'Ximena Torres', setting: 'Ambulatorio',
    domains: [
      d('continuidad', 'Continuidad', 'ok', 'Tratamiento activo'),
      d('adherencia', 'Uso / Adherencia', 'ok', 'Aplicaciones al día'),
      d('efectividad', 'Efectividad', 'ok', 'FEVI 60% (control)'),
      d('seguridad', 'Seguridad', 'ok', 'Sin nuevos problemas'),
      d('cambios', 'Cambios de tratamiento', 'ok', 'Sin cambios'),
      d('acceso', 'Acceso / suministro', 'warn', 'Dispensación parcial — 1 unidad pendiente'),
      d('paciente', 'Información del paciente', 'na', 'Sin autoreporte reciente'),
    ],
  },
  'ONC-2037': {
    patientId: 'ONC-2037', mode: 'entrevista-inicial', status: 'entrevista-pendiente', statusLabel: 'Onboarding · entrevista inicial pendiente', required: true,
    nextFollowUp: 'Tras entrevista inicial', responsible: 'Ximena Torres', setting: 'Intrahospitalario',
    domains: [
      d('continuidad', 'Continuidad', 'na', 'Sin iniciar'),
      d('adherencia', 'Uso / Adherencia', 'na', 'No aplica aún'),
      d('efectividad', 'Efectividad', 'na', 'Sin evaluación basal'),
      d('seguridad', 'Seguridad', 'na', 'Por evaluar en entrevista'),
      d('cambios', 'Cambios de tratamiento', 'na', 'Sin cambios'),
      d('acceso', 'Acceso / suministro', 'ok', 'Autorización recibida'),
      d('paciente', 'Información del paciente', 'warn', 'Perfil basal y alergias por confirmar'),
    ],
  },
  'ONC-2011': {
    patientId: 'ONC-2011', mode: 'seguimiento', status: 'vencido', statusLabel: 'Seguimiento vencido', required: true,
    lastAssessment: '19 Ago', nextFollowUp: 'Inmediato (vencido)', responsible: 'Ximena Torres', setting: 'Ambulatorio',
    domains: [
      d('continuidad', 'Continuidad', 'ok', 'Tratamiento activo'),
      d('adherencia', 'Uso / Adherencia', 'warn', 'Adherencia por confirmar — seguimiento vencido'),
      d('efectividad', 'Efectividad', 'ok', 'Sin señales adversas en último control'),
      d('seguridad', 'Seguridad', 'ok', 'Sin nuevos síntomas reportados'),
      d('cambios', 'Cambios de tratamiento', 'ok', 'Sin cambios recientes'),
      d('acceso', 'Acceso / suministro', 'ok', 'Suministro disponible'),
      d('paciente', 'Información del paciente', 'na', 'Sin contacto en la ventana esperada'),
    ],
  },
  'ONC-2055': {
    patientId: 'ONC-2055', mode: 'seguimiento', status: 'requerido', statusLabel: 'En espera de acceso', required: true,
    lastAssessment: '21 Ago', nextFollowUp: 'Tras autorización', responsible: 'Ximena Torres', setting: 'Intrahospitalario',
    domains: [
      d('continuidad', 'Continuidad', 'warn', 'Programación bloqueada por autorización'),
      d('adherencia', 'Uso / Adherencia', 'ok', 'Administración supervisada (infusión)'),
      d('efectividad', 'Efectividad', 'ok', 'Respuesta esperada al ciclo 2'),
      d('seguridad', 'Seguridad', 'ok', 'Sin nuevos problemas de seguridad'),
      d('cambios', 'Cambios de tratamiento', 'ok', 'Sin cambios recientes'),
      d('acceso', 'Acceso / suministro', 'warn', 'Autorización pendiente — bloquea programación'),
      d('paciente', 'Información del paciente', 'na', 'Sin autoreporte reciente'),
    ],
  },
  'ONC-2033': {
    patientId: 'ONC-2033', mode: 'entrevista-inicial', status: 'entrevista-pendiente', statusLabel: 'Onboarding · entrevista inicial pendiente', required: true,
    nextFollowUp: 'Tras entrevista inicial', responsible: 'Ximena Torres', setting: 'Intrahospitalario',
    domains: [
      d('continuidad', 'Continuidad', 'na', 'Sin iniciar'),
      d('adherencia', 'Uso / Adherencia', 'na', 'No aplica aún'),
      d('efectividad', 'Efectividad', 'na', 'Sin evaluación basal'),
      d('seguridad', 'Seguridad', 'na', 'Por evaluar en entrevista'),
      d('cambios', 'Cambios de tratamiento', 'na', 'Sin cambios'),
      d('acceso', 'Acceso / suministro', 'ok', 'Autorización recibida'),
      d('paciente', 'Información del paciente', 'warn', 'Perfil basal por documentar'),
    ],
  },
}

const settingFor = (p: Patient): string => (p.modality === 'Oral' || p.modality === 'SC' ? 'Ambulatorio' : 'Intrahospitalario')

/** Derivación por defecto (estado tranquilo) para pacientes sin enrollment explícito. */
function deriveCare(p: Patient): PharmaceuticalCareEnrollment {
  return {
    patientId: p.id, mode: 'seguimiento', status: 'al-dia', statusLabel: 'Al día', required: false,
    lastAssessment: p.care.last.split('·')[0].trim(), nextFollowUp: p.care.nextFu, responsible: p.team.pharm, setting: settingFor(p),
    domains: [
      d('continuidad', 'Continuidad', 'ok', 'Tratamiento activo'),
      d('adherencia', 'Uso / Adherencia', 'ok', 'Sin omisiones reportadas'),
      d('efectividad', 'Efectividad', 'ok', 'Respuesta esperada, sin señales adversas'),
      d('seguridad', 'Seguridad', 'ok', 'Sin nuevos problemas de seguridad'),
      d('cambios', 'Cambios de tratamiento', 'ok', 'Sin cambios recientes'),
      d('acceso', 'Acceso / suministro', 'ok', 'Suministro disponible'),
      d('paciente', 'Información del paciente', 'na', 'Sin autoreporte reciente'),
    ],
  }
}

export function getCare(patientId: string): PharmaceuticalCareEnrollment | undefined {
  if (EXPLICIT[patientId]) return EXPLICIT[patientId]
  const p = getPatient(patientId)
  return p ? deriveCare(p) : undefined
}
