/**
 * Política de SEGREGACIÓN DE FUNCIONES para preparación estéril. Configurable —
 * NO se codifica una política universal. La institución la ajusta; el MVP trae
 * una configuración demo explícita. Cuando una regla está activa, la acción
 * inválida se previene y se explica; cuando está relajada, queda explícito que
 * la demo permite que una persona realice varias etapas.
 *
 * Mapeo: gobernanza operativa nativa de Kumpels (sin equivalente FHIR directo).
 */
export interface PreparationPolicy {
  /** Quien prepara no puede verificar su propia preparación. */
  preparerCannotVerifyOwnWork: boolean
  /** Quien verifica no puede liberar su propia verificación. */
  verifierCannotReleaseOwnWork: boolean
  /**
   * ¿El flujo institucional requiere un lote de preparación final (mezcla
   * compuesta) además del identificador estable de la preparación? Configurable:
   * algunas instituciones asignan un CompoundingBatch, otras no.
   */
  requireCompoundingBatch: boolean
}

/**
 * Configuración demo EXPLÍCITA:
 *  - Segregación preparar/verificar: ACTIVA (control clínico habitual).
 *  - Segregación verificar/liberar: RELAJADA — la demo permite que el verificador
 *    también libere (declarado, no accidental).
 */
export const PREPARATION_POLICY: PreparationPolicy = {
  preparerCannotVerifyOwnWork: true,
  verifierCannotReleaseOwnWork: false,
  // La demo asigna lote de mezcla final (CompoundingBatch) a las preparaciones.
  requireCompoundingBatch: true,
}
