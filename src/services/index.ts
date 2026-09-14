import { inMemoryRepositories as repos } from '../repositories/inMemory'
import { makeClinicalReviewService } from './clinicalReviewService'
import { makePharmaceuticalCareService } from './pharmaceuticalCareService'
import { makeFulfillmentService } from './fulfillmentService'
import { makePreparationService } from './preparationService'
import { makeTraceabilityService } from './traceabilityService'
import { makeAdminService } from './adminService'

/**
 * Composición de la capa de aplicación. Hoy se inyecta el adaptador in-memory;
 * mañana bastará cambiar `repos` por un adaptador de API/BD real — sin tocar la
 * UI ni los servicios. Punto único de acceso a servicios para los componentes.
 */
export const services = {
  clinicalReview: makeClinicalReviewService(repos.validation),
  pharmaceuticalCare: makePharmaceuticalCareService(repos.followUp),
  fulfillment: makeFulfillmentService(repos.fulfillment),
  preparation: makePreparationService(repos.preparation),
  traceability: makeTraceabilityService(repos.traceability),
  admin: makeAdminService(repos.admin),
}

export { getEventLog } from './eventBus'
export type { DomainEventRecord, DomainEventType } from '../types/domainEvent'
