import type {
  AdminRepository, AdministrationRepository, CoordinatorRepository, EpisodeRepository, EventRepository, FollowUpRepository, FulfillmentRepository, MedicationOrderRepository,
  PatientRepository, PreparationRepository, ProductionRepository, Repositories, TraceabilityRepository, ValidationRepository,
} from './types'
import { getProductionRequest, sendToProduction, acceptProduction, cancelProduction } from '../utils/productionStore'
import { recordAdministration, getAdministrationForOrder, getAdministration, applyAdministrationCorrection } from '../utils/administrationStore'
import {
  getAssignment, assignTo, reassign as reassignWork, acknowledge as acknowledgeWork,
  startWork, completeWork, transfer as transferWork, escalate as escalateWork,
  setManualPriority, setDue, addNote,
} from '../utils/coordinatorStore'
import { appendEvent, queryEvents, eventsForPatient, eventsForEntity } from '../utils/eventStore'
import {
  getUser as admGetUser, setUserStatus, setUserRole, setUserTeam, setUserScope, openSupport, closeSupport,
} from '../utils/adminStore'
import { PATIENTS, getPatient } from '../data/patients'
import { ORDERS } from '../data/fulfillment'
import { getValidationRun } from '../data/review'
import { getCare } from '../data/careFollowup'
import { getReview, setReview } from '../utils/reviewStore'
import { getAssessment, setAssessment } from '../utils/careStore'
import {
  listViews as fulfillmentList, view as fulfillmentView,
  registrarContacto, reprogramar, registrarEntrega, resolverSinContacto,
} from '../utils/fulfillmentStore'
import {
  listPreparationViews, view as preparationView,
  iniciarPreparacion, finalizarPreparacion, verificar, liberar, supersede, rejectByNursing,
} from '../utils/preparationStore'
import { getComponentViews, getAudit, selectLot, addLotAllocation, changeLotAllocation, removeLotAllocation, confirmPreparationBatch, getLotTrace } from '../utils/traceabilityStore'

/**
 * Adaptador de persistencia IN-MEMORY (demo). Envuelve los stores/datos actuales
 * y expone la frontera de repositorio con Promesas. Sustituible por un adaptador
 * de API/BD sin tocar servicios ni UI. Sin lógica específica de cliente.
 */
const patient: PatientRepository = {
  getAll: async () => PATIENTS,
  getById: async (id) => getPatient(id),
}

const episode: EpisodeRepository = {
  listByPatient: async (patientId) => getPatient(patientId)?.journey ?? [],
}

const medicationOrder: MedicationOrderRepository = {
  list: async () => ORDERS,
  getById: async (orderId) => ORDERS.find((o) => o.id === orderId),
}

const validation: ValidationRepository = {
  getRun: async (patientId) => getValidationRun(patientId),
  getDecision: async (findingId) => getReview(findingId),
  saveDecision: async (findingId, review) => { setReview(findingId, review) },
}

const followUp: FollowUpRepository = {
  getEnrollment: async (patientId) => getCare(patientId),
  getAssessment: async (patientId) => getAssessment(patientId),
  saveAssessment: async (patientId, assessment) => { setAssessment(patientId, assessment) },
}

const fulfillment: FulfillmentRepository = {
  list: async () => fulfillmentList(),
  get: async (orderId) => fulfillmentView(orderId),
  registerContact: async (orderId, entry) => { registrarContacto(orderId, entry) },
  reprogram: async (orderId, change) => { reprogramar(orderId, change) },
  registerDelivery: async (orderId, delivery) => registrarEntrega(orderId, delivery),
  resolveWithoutContact: async (orderId, reason, by) => { resolverSinContacto(orderId, reason, by) },
}

const preparation: PreparationRepository = {
  list: async () => listPreparationViews(),
  get: async (orderId) => preparationView(orderId),
  start: async (orderId, by) => { iniciarPreparacion(orderId, by) },
  complete: async (orderId) => { finalizarPreparacion(orderId) },
  verify: async (orderId, by) => verificar(orderId, by),
  release: async (orderId, by) => liberar(orderId, by),
  supersede: async (oldOrderId, opts, actor) => supersede(oldOrderId, opts, actor),
  rejectByNursing: async (orderId, input, nurse) => rejectByNursing(orderId, input, nurse),
}

const traceability: TraceabilityRepository = {
  components: async (orderId) => getComponentViews(orderId),
  audit: async (orderId) => getAudit(orderId),
  selectLot: async (orderId, componentKey, lotId, by, reason) => selectLot(orderId, componentKey, lotId, by, reason),
  addLot: async (orderId, componentKey, lotId, quantity, unit, by, note) => addLotAllocation(orderId, componentKey, lotId, quantity, unit, by, note),
  changeLot: async (orderId, componentKey, fromLotId, toLotId, by, reason) => changeLotAllocation(orderId, componentKey, fromLotId, toLotId, by, reason),
  removeLot: async (orderId, componentKey, lotId, by) => removeLotAllocation(orderId, componentKey, lotId, by),
  confirmBatch: async (orderId, input, by) => confirmPreparationBatch(orderId, input, by),
  lotTrace: async (lotId, statusLabelOf) => getLotTrace(lotId, statusLabelOf),
}

const events: EventRepository = {
  append: async (input) => appendEvent(input),
  query: async (q) => queryEvents(q),
  forPatient: async (patientId, limit) => eventsForPatient(patientId, limit),
  forEntity: async (sourceEntityType, sourceEntityId) => eventsForEntity(sourceEntityType, sourceEntityId),
}

const admin: AdminRepository = {
  getUser: async (id) => admGetUser(id),
  setUserStatus: async (id, status) => { setUserStatus(id, status) },
  setUserRole: async (id, role) => { setUserRole(id, role) },
  setUserTeam: async (id, teamId) => { setUserTeam(id, teamId) },
  setUserScope: async (id, scope) => { setUserScope(id, scope) },
  openSupport: async (session) => openSupport(session),
  closeSupport: async (id) => { closeSupport(id) },
}

const administration: AdministrationRepository = {
  record: async (a) => { recordAdministration(a) },
  getForOrder: async (orderId) => getAdministrationForOrder(orderId),
  getById: async (id) => getAdministration(id),
  applyCorrection: async (id, patch) => applyAdministrationCorrection(id, patch),
}

const production: ProductionRepository = {
  get: async (orderId) => getProductionRequest(orderId),
  send: async (input, actor) => sendToProduction(input, actor),
  accept: async (orderId, actor, auto) => acceptProduction(orderId, actor, auto),
  cancel: async (orderId, reason, actor) => cancelProduction(orderId, reason, actor),
}

const coordinator: CoordinatorRepository = {
  get: async (id) => getAssignment(id),
  assign: async (id, input) => { assignTo(id, input) },
  reassign: async (id, input) => { reassignWork(id, input) },
  acknowledge: async (id, byId, byName, byRole) => { acknowledgeWork(id, byId, byName, byRole) },
  start: async (id) => { startWork(id) },
  complete: async (id) => { completeWork(id) },
  transfer: async (id, input) => { transferWork(id, input) },
  escalate: async (id, byId, byName) => { escalateWork(id, byId, byName) },
  setPriority: async (id, priority) => { setManualPriority(id, priority) },
  setDue: async (id, dueLabel) => { setDue(id, dueLabel) },
  addNote: async (id, note) => { addNote(id, note) },
}

export const inMemoryRepositories: Repositories = {
  patient, episode, medicationOrder, validation, followUp, fulfillment, preparation, traceability, administration, production, coordinator, events, admin,
}
