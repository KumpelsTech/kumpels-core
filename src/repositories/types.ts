import type { Patient } from '../types/patient'
import type { ValidationRun, ProfessionalReview } from '../types/review'
import type { PharmaceuticalCareEnrollment, FollowUpAssessment } from '../types/careFollowup'
import type { MedicationOrder, FulfillmentView, ContactEntry, MedicationDelivery } from '../types/fulfillment'
import type { PreparationView } from '../types/preparation'
import type { ComponentView, LotAuditEntry, LotTrace, PreparationBatch, PreparationBatchStatus } from '../types/traceability'
import type { DomainEventInput, DomainEventRecord, EventQuery } from '../types/domainEvent'
import type { AdminUser, RoleId, Scope, SupportSession, UserStatus } from '../types/admin'
import type { MedicationAdministration } from '../types/administration'
import type { ProductionRequest } from '../types/production'
import type { ProductionRequestInput } from '../utils/productionStore'
import type { Priority } from '../types/patient'
import type { Assignment } from '../types/assignment'
import type { AssignInput, ReassignInput } from '../utils/coordinatorStore'

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

export type ContactInput = Omit<ContactEntry, 'id' | 'at' | 'atIso' | 'channel' | 'result'>
export type DeliveryInput = Omit<MedicationDelivery, 'id' | 'orderId' | 'patientId' | 'medication' | 'unitLabel' | 'at' | 'atIso' | 'facility' | 'version' | 'quantity'> & { quantity?: number }
export interface ScheduleInput { newDate: string; newTime?: string; reason?: string; actorId?: string; actorName?: string; actorRole?: string }

export interface FulfillmentRepository {
  list(): Promise<FulfillmentView[]>
  get(orderId: string): Promise<FulfillmentView>
  registerContact(orderId: string, entry: ContactInput): Promise<void>
  reprogram(orderId: string, change: ScheduleInput): Promise<void>
  registerDelivery(orderId: string, delivery: DeliveryInput): Promise<MedicationDelivery>
  resolveWithoutContact(orderId: string, reason: string, by: string): Promise<void>
}

export type PrepActionResult = { ok: boolean; reason?: string }

export interface PreparationRepository {
  list(): Promise<PreparationView[]>
  get(orderId: string): Promise<PreparationView>
  start(orderId: string, by: string): Promise<void>
  complete(orderId: string): Promise<void>
  /** Verifica (aplica segregación de funciones; devuelve motivo si se bloquea). */
  verify(orderId: string, by: string): Promise<PrepActionResult>
  /** Libera (aplica segregación de funciones; devuelve motivo si se bloquea). */
  release(orderId: string, by: string): Promise<PrepActionResult>
  /** Reemplazo controlado (la anterior queda superada; devuelve el nuevo id). */
  supersede(oldOrderId: string, opts: { reason: string; correctedDose?: string; sourceChange?: string }, actor: { id: string; name: string; role: string }): Promise<{ ok: boolean; newId?: string; reason?: string }>
  /** Rechazo de Enfermería (barrera final): RELEASED → HOLD. */
  rejectByNursing(orderId: string, input: { reasonCode: string; reasonLabel: string; comment?: string; ownerRole: string; ownerLabel: string }, nurse: { id: string; name: string; role: string }): Promise<{ ok: boolean; reason?: string }>
}

export interface TraceabilityRepository {
  components(orderId: string): Promise<ComponentView[]>
  audit(orderId: string): Promise<LotAuditEntry[]>
  selectLot(orderId: string, componentKey: string, lotId: string, by: string, reason?: string): Promise<{ ok: boolean; reason?: string }>
  addLot(orderId: string, componentKey: string, lotId: string, quantity: number, unit: string, by: string, note?: string): Promise<{ ok: boolean; reason?: string }>
  changeLot(orderId: string, componentKey: string, fromLotId: string, toLotId: string, by: string, reason?: string): Promise<{ ok: boolean; reason?: string }>
  removeLot(orderId: string, componentKey: string, lotId: string, by: string): Promise<{ ok: boolean; reason?: string }>
  confirmBatch(orderId: string, input: { batchNumber: string; facilityId: string; beyondUseAt?: string; expirationAt?: string; status?: PreparationBatchStatus }, by: string): Promise<PreparationBatch>
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

/**
 * Repositorio de ADMINISTRACIÓN de medicación. Append-oriented: cada registro es
 * una MedicationAdministration nueva. Sustituible por un adaptador de BD.
 */
export type AdministrationInput =
  Omit<MedicationAdministration, 'id' | 'performerId' | 'performerName' | 'performerRole' | 'at' | 'atIso' | 'version' | 'source' | 'sourceSystem'>

export interface AdministrationRepository {
  record(administration: MedicationAdministration): Promise<void>
  getForOrder(preparationOrderId: string): Promise<MedicationAdministration | undefined>
  getById(id: string): Promise<MedicationAdministration | undefined>
  applyCorrection(id: string, patch: Partial<MedicationAdministration>): Promise<MedicationAdministration | undefined>
}

/**
 * Repositorio de RESPONSABILIDAD / gestión operativa (overlay sobre WorkItems).
 * Ciclo de vida de asignación, acuse, progreso, reasignación, transferencia,
 * escalamiento, prioridad y nota. No ejecuta trabajo clínico.
 */
export interface CoordinatorRepository {
  get(workItemId: string): Promise<Assignment | undefined>
  assign(workItemId: string, input: AssignInput): Promise<void>
  reassign(workItemId: string, input: ReassignInput): Promise<void>
  acknowledge(workItemId: string, byId: string, byName: string, byRole: string): Promise<void>
  start(workItemId: string): Promise<void>
  complete(workItemId: string): Promise<void>
  transfer(workItemId: string, input: ReassignInput): Promise<void>
  escalate(workItemId: string, byId?: string, byName?: string): Promise<void>
  setPriority(workItemId: string, priority: Priority): Promise<void>
  setDue(workItemId: string, dueLabel: string): Promise<void>
  addNote(workItemId: string, note: string): Promise<void>
}

/** Repositorio de SOLICITUDES DE PRODUCCIÓN (handoff Enfermería → Central de Mezclas). */
export interface ProductionRepository {
  get(preparationOrderId: string): Promise<ProductionRequest | undefined>
  send(input: ProductionRequestInput, actor: { id: string; name: string; role: string }): Promise<ProductionRequest>
  accept(preparationOrderId: string, actor: { id: string; name: string; role: string }, auto?: boolean): Promise<ProductionRequest | undefined>
  cancel(preparationOrderId: string, reason: string, actor: { id: string; name: string; role: string }): Promise<{ ok: boolean; reason?: string }>
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
  administration: AdministrationRepository
  production: ProductionRepository
  coordinator: CoordinatorRepository
  events: EventRepository
  admin: AdminRepository
}
