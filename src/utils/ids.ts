/**
 * Generador de identificadores estables para entidades creadas en runtime.
 * NO usar índices de arreglo ni valores derivados de la UI como identidad de
 * persistencia. En un backend real el id lo asignaría el servidor; este stand-in
 * es monotónico y único por sesión, apto para el modelo de persistencia futuro.
 */
let counter = 0

export function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`
}
