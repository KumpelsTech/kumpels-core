import type { Patient } from '../types/patient'
import type { ValidationRun, ProfessionalReview } from '../types/review'
import type { PharmaceuticalCareEnrollment, FollowUpAssessment } from '../types/careFollowup'
import type { MedicationOrder, FulfillmentView, ContactEntry, CommState } from '../types/fulfillment'
import type { PreparationView } from '../types/preparation'
import type { ComponentView, LotAuditEntry, LotTrace } from '../types/traceability'
import type { DomainEventInput, DomainEventRecord, EventQuery } from '../types/domainEvent'
import type { AdminUser, RoleId, Scope, SupportSession, UserStatus } from '../types/admin'

/**
 * Interfaces de REPOSITORIO — la frontera de persistencia. El primer adaptador
 * es in-memory (envuelve los stores/datos demo actuales); un adaptador futuro
 * hablará con la API/base de datos real SIN cambiar servicios ni UI.
 *
 * Todos los métodos son async (Promise) aunque hoy resuelvan localmente.
 * El "read model" reactivo de la UI sigue en los stores (useSyncExternalStore);
 * estos repositorios cubren el lado de comandos y las lecturas que necesitan los
 * servicios para construir eventos/auditoría.
 */

export interface PatientRepository {
  getAll(): Promise<Patient[]>
  getById(id: string): Promise<Patient | undefined>
}

/** Los episodios están embebidos en Patient.journey en el MVP (mapa: EpisodeOfCare). */
export interface EpisodeRepository {
  listByPatient(patientId: string): Promise<Patient['journey']>
}

export interface MedicationOrderRepository {
  list(): Promise<MedicationOrder[]>
  getById(orderId: string): Promise<MedicationOrder | undefined>
}

export interface ValidationRepository {
  getRun(patientId: string): Promise<ValidationRun | undefined>
  getDecision(findingId: string): Promise<ProfessionalReview | undefined>
  saveDecision(findingId: string, review: ProfessionalReview): Promise<void>
}

export interface FollowUpRepository {
  getEnrollment(patientId: string): Promise<PharmaceuticalCareEnrollment | undefined>
  getAssessment(patientId: string): Promise<FollowUpAssessment | undefined>
  saveAssessment(patientId: string, assessment: FollowUpAssessment): Promise<void>
}

export interface FulfillmentRepository {
  list(): Promise<FulfillmentView[]>
  get(orderId: string): Promise<FulfillmentView>
  registerContact(orderId: string, entry: Omit<ContactEntry, 'id' | 'at'>, state: CommState): Promise<void>
  updateAvailability(orderId: string, value: string): Promise<void>
  resolvePending(orderId: string): Promise<void>
}

export interface PreparationRepository {
  list(): Promise<PreparationView[]>
  get(orderId: string): Promise<PreparationView>
  start(orderId: string, by: string): Promise<void>
  complete(orderId: string): Promise<void>
  verify(orderId: string, by: string): Promise<void>
  release(orderId: string, by: string): Promise<void>
}

export interface TraceabilityRepository {
  components(orderId: string): Promise<ComponentView[]>
  audit(orderId: string): Promise<LotAuditEntry[]>
  selectLot(orderId: string, componentKey: string, lotId: string, by: string): Promise<{ ok: boolean; reason?: string }>
  lotTrace(lotId: string, statusLabelOf: (orderId: string) => string): Promise<LotTrace | null>
}

/**
 * Repositorio de EVENTOS — fuente única de la historia de dominio. Append-only:
 * sin update ni delete. Preserva ids estables y orden (seq). Sustituible por un
 * adaptador de BD sin cambiar la UI.
 */
export interface EventRepository {
  append(input: DomainEventInput): Promise<DomainEventRecord>
  query(q?: EventQuery): Promise<DomainEventRecord[]>
  forPatient(patientId: string, limit?: number): Promise<DomainEventRecord[]>
  forEntity(sourceEntityType: string, sourceEntityId: string): Promise<DomainEventRecord[]>
}

/**
 * Repositorio de ADMINISTRACIÓN / CONFIGURACIÓN. Solo el lado de comandos que
 * necesitan los servicios; las lecturas reactivas de la UI van por adminStore.
 * No maneja credenciales ni contraseñas.
 */
export interface AdminRepository {
  getUser(id: string): Promise<AdminUser | undefined>
  setUserStatus(id: string, status: UserStatus): Promise<void>
  setUserRole(id: string, role: RoleId): Promise<void>
  setUserTeam(id: string, teamId: string | undefined): Promise<void>
  setUserScope(id: string, scope: Scope): Promise<void>
  openSupport(session: Omit<SupportSession, 'id' | 'status' | 'startedAt'>): Promise<SupportSession>
  closeSupport(id: string): Promise<void>
}

/** Conjunto de repositorios que consumen los servicios (inyección simple). */
export interface Repositories {
  patient: PatientRepository
  episode: EpisodeRepository
  medicationOrder: MedicationOrderRepository
  validation: ValidationRepository
  followUp: FollowUpRepository
  fulfillment: FulfillmentRepository
  preparation: PreparationRepository
  traceability: TraceabilityRepository
  events: EventRepository
  admin: AdminRepository
}
