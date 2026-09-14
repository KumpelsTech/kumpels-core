import type {
  AdminUser, ClinicalConfiguration, Facility, IntegrationConfig, Organization, Program, SupportSession, Team,
} from '../types/admin'

/**
 * Datos sintéticos de administración/configuración. Reutiliza la organización
 * tenant (Asisfarma) y las personas demo. No es arquitectura específica de cliente.
 */
export const ORGANIZATION: Organization = { id: 'ORG-ASF', name: 'Asisfarma', nit: '901581230' }

export const FACILITIES: Facility[] = [
  { id: 'FAC-CAS', name: 'Castellana', orgId: 'ORG-ASF' },
  { id: 'FAC-IPS48', name: 'IPS 48', orgId: 'ORG-ASF' },
  { id: 'FAC-TEU', name: 'Teusaquillo', orgId: 'ORG-ASF' },
]

export const PROGRAMS: Program[] = [
  { id: 'PRG-ONC-CAS', name: 'Programa de Oncología', facilityId: 'FAC-CAS' },
  { id: 'PRG-ONC-IPS48', name: 'Programa de Oncología', facilityId: 'FAC-IPS48' },
  { id: 'PRG-MIX-TEU', name: 'Central de Mezclas', facilityId: 'FAC-TEU' },
]

export const TEAMS: Team[] = [
  { id: 'TEAM-CLIN', name: 'Farmacia Clínica', facilityId: 'FAC-IPS48', memberIds: ['USR-2', 'USR-1'] },
  { id: 'TEAM-MIX', name: 'Central de Mezclas', facilityId: 'FAC-TEU', memberIds: ['USR-3'] },
  { id: 'TEAM-ENF', name: 'Enfermería Oncología', facilityId: 'FAC-IPS48', memberIds: ['USR-4'] },
]

export const ADMIN_USERS: AdminUser[] = [
  { id: 'USR-1', name: 'Sandra Garzón', email: 'sgarzon@asisfarma.co', role: 'coordinador', teamId: 'TEAM-CLIN', scope: { facilityIds: ['FAC-CAS', 'FAC-IPS48', 'FAC-TEU'], programIds: ['PRG-ONC-CAS', 'PRG-ONC-IPS48', 'PRG-MIX-TEU'] }, status: 'activo' },
  { id: 'USR-2', name: 'Ximena Torres', email: 'xtorres@asisfarma.co', role: 'qf-clinico', teamId: 'TEAM-CLIN', scope: { facilityIds: ['FAC-IPS48'], programIds: ['PRG-ONC-IPS48'] }, status: 'activo' },
  { id: 'USR-3', name: 'Andrés Mejía', email: 'amejia@asisfarma.co', role: 'qf-mezclas', teamId: 'TEAM-MIX', scope: { facilityIds: ['FAC-TEU'], programIds: ['PRG-MIX-TEU'] }, status: 'activo' },
  { id: 'USR-4', name: 'Equipo de Enfermería', email: 'enfermeria@asisfarma.co', role: 'enfermeria', teamId: 'TEAM-ENF', scope: { facilityIds: ['FAC-IPS48'], programIds: ['PRG-ONC-IPS48'] }, status: 'activo' },
  { id: 'USR-5', name: 'Juan Restrepo', email: 'jrestrepo@asisfarma.co', role: 'admin', scope: { facilityIds: ['FAC-CAS', 'FAC-IPS48', 'FAC-TEU'], programIds: [] }, status: 'activo' },
  { id: 'USR-6', name: 'Laura Peña', email: 'lpena@asisfarma.co', role: 'qf-clinico', teamId: 'TEAM-CLIN', scope: { facilityIds: ['FAC-CAS'], programIds: ['PRG-ONC-CAS'] }, status: 'inactivo' },
]

export const CLINICAL_CONFIGS: ClinicalConfiguration[] = [
  { id: 'CC-1', kind: 'protocolo', name: 'Protocolo Oncológico Institucional', version: 'v3.2', status: 'activo', owner: 'Comité de Farmacia', approvedBy: 'Dra. Andrea Herrera', effectiveDate: '01 Jul 2026' },
  { id: 'CC-2', kind: 'ruleset', name: 'Reglas de continuidad clínica', version: 'v3.2', status: 'activo', owner: 'Farmacia Clínica', approvedBy: 'Comité de Farmacia', effectiveDate: '01 Jul 2026' },
  { id: 'CC-3', kind: 'ruleset', name: 'Reglas de acceso / autorización', version: 'v3.3', status: 'revision', owner: 'Mesa de Control', effectiveDate: '—' },
  { id: 'CC-4', kind: 'plantilla-seguimiento', name: 'Plantilla de seguimiento farmacoterapéutico', version: 'v2.0', status: 'activo', owner: 'Farmacia Clínica', approvedBy: 'Comité de Farmacia', effectiveDate: '15 May 2026' },
  { id: 'CC-5', kind: 'formulario', name: 'Entrevista inicial de atención farmacéutica', version: 'v1.4', status: 'aprobado', owner: 'Farmacia Clínica', approvedBy: 'Comité de Farmacia', effectiveDate: '20 Sep 2026' },
  { id: 'CC-6', kind: 'protocolo', name: 'Protocolo Oncológico Institucional', version: 'v3.1', status: 'retirado', owner: 'Comité de Farmacia', approvedBy: 'Dra. Andrea Herrera', effectiveDate: '01 Ene 2026' },
]

export const INTEGRATIONS: IntegrationConfig[] = [
  { id: 'INT-HIS', name: 'HIS / EHR institucional', type: 'HIS', status: 'conectado', lastSync: 'Hoy 08:15', mode: 'HL7' },
  { id: 'INT-LIS', name: 'Laboratorio (LIS)', type: 'LIS', status: 'conectado', lastSync: 'Hoy 07:50', mode: 'FHIR' },
  { id: 'INT-ERP', name: 'ERP / SAP', type: 'ERP', status: 'inactivo', lastSync: '—', mode: 'REST' },
  { id: 'INT-PHARM', name: 'Sistema de farmacia', type: 'Farmacia', status: 'error', lastSync: 'Ayer 22:10', mode: 'archivo' },
]

export const SEED_SUPPORT_SESSIONS: SupportSession[] = [
  { id: 'SUP-1', reason: 'Revisión de rendimiento de sincronización HIS', requestedBy: 'Juan Restrepo', scope: 'Integraciones · solo lectura', startedAt: '05 Sep 09:10', endedAt: '05 Sep 10:40', status: 'finalizado' },
]

export const getFacility = (id: string) => FACILITIES.find((f) => f.id === id)
export const getProgram = (id: string) => PROGRAMS.find((p) => p.id === id)
export const getTeam = (id: string) => TEAMS.find((t) => t.id === id)
