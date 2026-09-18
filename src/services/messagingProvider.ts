import type { Channel, MessageType } from '../types/communication'

/**
 * FRONTERA DE ADAPTADOR de mensajería. La capa clínica/dominio habla con
 * `MessagingProvider`; hoy se inyecta el adaptador SIMULADO (WHATSAPP_SIMULATED).
 * Más adelante se enchufa el adaptador de WhatsApp Business SIN cambiar servicios ni
 * dominio. No se falsea infraestructura de entrega externa: es mensajería demo.
 */
export interface OutboundEnvelope {
  patientId: string
  content: string
  messageType: MessageType
  channel: Channel
  /** Solo para la demo: forzar un fallo de "entrega". */
  simulateFail?: boolean
}

export interface ProviderResult {
  ok: boolean
  /** Estados de entrega a aplicar en orden (SENT → DELIVERED → READ) o [FAILED]. */
  lifecycle: ('QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED')[]
  providerId: string
}

export interface MessagingProvider {
  id: Channel
  send(env: OutboundEnvelope): Promise<ProviderResult>
}

/** Adaptador simulado: entrega optimista (o fallo forzado en demo). */
export const simulatedProvider: MessagingProvider = {
  id: 'WHATSAPP_SIMULATED',
  async send(env: OutboundEnvelope): Promise<ProviderResult> {
    if (env.simulateFail) return { ok: false, lifecycle: ['FAILED'], providerId: 'WHATSAPP_SIMULATED' }
    return { ok: true, lifecycle: ['QUEUED', 'SENT', 'DELIVERED'], providerId: 'WHATSAPP_SIMULATED' }
  },
}

/** Proveedor activo (punto único de cambio para el adaptador real futuro). */
export const messagingProvider: MessagingProvider = simulatedProvider
