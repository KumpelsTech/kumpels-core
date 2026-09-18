import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Patient } from '../../types/patient'
import type { PrepStatus } from '../../types/preparation'
import { PREP_STATUS_LABEL, usePreparationStore } from '../../utils/preparationStore'
import { useReviewStore } from '../../utils/reviewStore'
import { useTraceabilityStore } from '../../utils/traceabilityStore'
import { TraceabilityDrawer } from '../ops/TraceabilityDrawer'
import { Icon } from '../Icon'

const TONE: Record<PrepStatus, 'risk' | 'warn' | 'ok'> = {
  bloqueada: 'risk', 'pendiente-validacion': 'risk', lista: 'warn', 'en-preparacion': 'warn',
  'pendiente-verificacion': 'warn', verificada: 'warn', liberada: 'ok',
}

/**
 * Estado conciso de preparación estéril en Patient 360. NO duplica el flujo:
 * enlaza al workstream de Operaciones. Solo aparece si el paciente tiene orden.
 */
export function PreparationStatus({ patient }: { patient: Patient }) {
  const { getPatientPreparation } = usePreparationStore()
  const { getPreparationBatch, getPreparationTrace } = useTraceabilityStore()
  useReviewStore()
  const navigate = useNavigate()
  const [showTrace, setShowTrace] = useState(false)
  const prep = getPatientPreparation(patient.id)
  if (!prep) return null

  const tone = TONE[prep.status]
  // Resumen CONCISO de trazabilidad (Patient 360 no muestra toda la genealogía).
  const batch = getPreparationBatch(prep.order.id)
  const componentCount = getPreparationTrace(prep.order.id).components.length
  return (
    <div className={`prep-status ${tone}`}>
      <div className="ps-head">
        <span className="ps-ico"><Icon name="drop" size={15} /></span>
        <div>
          <div className="ps-title">Preparación estéril · <span className="mono">{prep.order.id}</span></div>
          <div className="ps-status">{PREP_STATUS_LABEL[prep.status]}</div>
        </div>
        <button type="button" className="btn sm" style={{ marginLeft: 'auto' }}
          onClick={() => navigate(`/medication-operations?ws=preparacion&prep=${prep.order.id}`)}>
          Abrir caso <Icon name="chevR" size={12} />
        </button>
      </div>
      <div className="ps-meta">
        <span>{prep.order.medication}{prep.order.cycleDay ? ` · ${prep.order.cycleDay}` : ''}</span>
        <span>Administración programada · <b>{prep.order.scheduledAt}</b></span>
      </div>
      {/* Trazabilidad completa — resumen conciso + acceso al detalle (drawer, sin nueva pestaña) */}
      <div className="ps-trace">
        <div className="ps-trace-sum">
          <span><Icon name="route" size={12} /> Trazabilidad completa</span>
          <span>Preparación · <b className="mono">{prep.order.id}</b></span>
          <span>Lote de mezcla · <b className="mono">{batch?.batchNumber ?? '—'}</b></span>
          <span>Componentes · <b>{componentCount}</b></span>
        </div>
        <button type="button" className="btn sm" onClick={() => setShowTrace(true)}>
          Ver trazabilidad <Icon name="route" size={12} />
        </button>
      </div>
      {prep.blocker ? (
        <div className="ps-blk"><Icon name="alert" size={12} /> {prep.blocker.label}{prep.blocker.responsible ? ` · ${prep.blocker.responsible}` : ''}</div>
      ) : null}
      {showTrace ? <TraceabilityDrawer orderId={prep.order.id} onClose={() => setShowTrace(false)} /> : null}
    </div>
  )
}
