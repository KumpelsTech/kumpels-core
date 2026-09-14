import type {
  AdminRepository, EpisodeRepository, EventRepository, FollowUpRepository, FulfillmentRepository, MedicationOrderRepository,
  PatientRepository, PreparationRepository, Repositories, TraceabilityRepository, ValidationRepository,
} from './types'
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
  registrarContacto, actualizarDisponibilidad, resolverPendiente,
} from '../utils/fulfillmentStore'
import {
  listPreparationViews, view as preparationView,
  iniciarPreparacion, finalizarPreparacion, verificar, liberar,
} from '../utils/preparationStore'
import { getComponentViews, getAudit, selectLot, getLotTrace } from '../utils/traceabilityStore'

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
  registerContact: async (orderId, entry, state) => { registrarContacto(orderId, entry, state) },
  updateAvailability: async (orderId, value) => { actualizarDisponibilidad(orderId, value) },
  resolvePending: async (orderId) => { resolverPendiente(orderId) },
}

const preparation: PreparationRepository = {
  list: async () => listPreparationViews(),
  get: async (orderId) => preparationView(orderId),
  start: async (orderId, by) => { iniciarPreparacion(orderId, by) },
  complete: async (orderId) => { finalizarPreparacion(orderId) },
  verify: async (orderId, by) => { verificar(orderId, by) },
  release: async (orderId, by) => { liberar(orderId, by) },
}

const traceability: TraceabilityRepository = {
  components: async (orderId) => getComponentViews(orderId),
  audit: async (orderId) => getAudit(orderId),
  selectLot: async (orderId, componentKey, lotId, by) => selectLot(orderId, componentKey, lotId, by),
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

export const inMemoryRepositories: Repositories = {
  patient, episode, medicationOrder, validation, followUp, fulfillment, preparation, traceability, events, admin,
}
