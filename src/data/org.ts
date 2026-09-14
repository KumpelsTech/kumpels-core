/** Configuración de organización / tenant (mock). Asisfarma como tenant activo. */
export const ORG = {
  name: 'Asisfarma',
  facilityContext: 'Bogotá',
  facilities: ['Castellana', 'IPS 48', 'Teusaquillo'] as const,
  payers: ['Compensar', 'FOMAG'] as const,
  user: {
    name: 'Sandra Garzón',
    role: 'Coordinación Farmacéutica',
    initials: 'SG',
  },
}
