import { useState } from 'react'
import type { Patient } from '../../types/patient'
import { usePreparationStore } from '../../utils/preparationStore'
import { useTraceabilityStore } from '../../utils/traceabilityStore'
import { ADMIN_RESULT_LABEL, REMAINDER_STATUS_LABEL, useAdministrationStore } from '../../utils/administrationStore'
import { useCorrectionStore } from '../../utils/correctionStore'
import { CORRECTION_TYPE_LABEL } from '../../types/correction'
import { usePersona } from '../../utils/personaStore'
import { hasCapability } from '../../utils/eligibility'
import { services } from '../../services'
import { Icon } from '../Icon'
import { AdministrationDrawer } from './AdministrationDrawer'
import { CorrectionModal } from './CorrectionModal'
import { RejectionModal } from './RejectionModal'
import { HistoryDrawer, type HistoryEntry } from '../HistoryDrawer'

/**
 * Administración en Patient 360 — punto de entrada de enfermería. No duplica el
 * flujo de preparación: consume su estado (liberada) y registra la
 * MedicationAdministration canónica. Solo aparece si el paciente tiene orden.
 */
export function AdministrationPanel({ patient }: { patient: Patient }) {
  const { getPatientPreparation } = usePreparationStore()
  const { principalLot } = useTraceabilityStore()
  const { getAdministrationForOrder } = useAdministrationStore()
  const { correctionsFor } = useCorrectionStore()
  const { can, actor, user } = usePersona()
  const [showAdmin, setShowAdmin] = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)
  const [showCorrHistory, setShowCorrHistory] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const prep = getPatientPreparation(patient.id)
  if (!prep) return null

  const admin = getAdministrationForOrder(prep.order.id)
  const rejection = prep.rejection
  const ready = prep.status === 'liberada' && !rejection
  const canRegister = can('registrar-administracion')
  const canCorrect = !!user && hasCapability(user, 'MEDICATION_ADMINISTRATION_CORRECT')
  const corrections = admin ? correctionsFor('MedicationAdministration', admin.id) : []
  // Solo mostrar el panel a quien administra, o cuando ya hay un registro.
  if (!canRegister && !admin) return null

  return (
    <div className={`admin-panel ${admin ? (admin.result === 'administrada' ? 'ok' : 'warn') : ready ? 'ready' : ''}`}>
      <div className="ap-head">
        <span className="ap-ico"><Icon name="syringe" size={15} /></span>
        <div>
          <div className="ap-title">Administración</div>
          <div className="ap-sub">{prep.order.medication} · {prep.order.route} · programada {prep.order.scheduledAt}</div>
        </div>
        {canRegister && ready && !admin ? (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn sm" onClick={() => setShowReject(true)}><Icon name="alert" size={13} /> Rechazar</button>
            <button type="button" className="btn sm primary" onClick={() => setShowAdmin(true)}><Icon name="syringe" size={13} /> Registrar administración</button>
          </div>
        ) : canRegister && ready && admin ? (
          <button type="button" className="btn sm primary" style={{ marginLeft: 'auto' }} onClick={() => setShowAdmin(true)}>
            <Icon name="syringe" size={13} /> Actualizar
          </button>
        ) : null}
      </div>
      {rejection ? (
        <div className="reject-banner">
          <Icon name="alert" size={13} /> Rechazada por Enfermería — <b>{rejection.reasonLabel}</b>{rejection.comment ? ` (${rejection.comment})` : ''} · {rejection.nurseName} · {rejection.at}
          <div className="rb-owner">En espera de resolución · <b>{rejection.ownerLabel}</b></div>
        </div>
      ) : null}
      {admin ? (
        <div className="ap-record">
          <b>{ADMIN_RESULT_LABEL[admin.result]}</b> · {admin.performerName} ({admin.performerRole}) · {admin.at}
          {admin.enteredInError ? <span className="ap-eie"><Icon name="alert" size={11} /> Registrada por error</span> : null}
          {admin.administeredVolume || admin.remainingVolume ? (
            <div className="ap-vol">Administrado: <b>{admin.administeredVolume ?? '—'}</b> · Remanente: <b>{admin.remainingVolume ?? '—'}</b>{admin.remainder ? ` · ${REMAINDER_STATUS_LABEL[admin.remainder.status]}` : ''}</div>
          ) : null}
          {admin.reason ? <div className="ap-reason">Motivo: {admin.reason}</div> : null}
          {admin.observation ? <div className="ap-obs">Nota: {admin.observation}</div> : null}
          {(canCorrect || corrections.length) ? (
            <div className="ap-corr-actions">
              {canCorrect ? <button type="button" className="btn sm" onClick={() => setShowCorrection(true)}><Icon name="refresh" size={12} /> Registrar corrección</button> : null}
              {corrections.length ? <button type="button" className="link-mini" onClick={() => setShowCorrHistory(true)}><Icon name="clock" size={12} /> Ver historial ({corrections.length})</button> : null}
            </div>
          ) : null}
        </div>
      ) : rejection ? null : !ready ? (
        <div className="ap-wait"><Icon name="clock" size={12} /> Preparación aún no liberada — no disponible para administrar.</div>
      ) : (
        <div className="ap-wait"><Icon name="check" size={12} /> Preparación liberada — lista para administrar.</div>
      )}

      {showAdmin ? (
        <AdministrationDrawer
          context={{
            patientId: patient.id, patientName: patient.name,
            preparationOrderId: prep.order.id, medicationOrderId: prep.order.medicationOrderId,
            medication: prep.order.medication, dose: prep.order.approvedDose ?? prep.order.prescribedDose, route: prep.order.route,
            scheduledAt: prep.order.scheduledAt, preparationRef: prep.order.id,
            lotReference: principalLot(prep.order.id)?.manufacturerLot,
          }}
          onSave={(input) => { void services.administration.record(input, actor()); setShowAdmin(false) }}
          onClose={() => setShowAdmin(false)}
        />
      ) : null}
      {showCorrection && admin ? (
        <CorrectionModal administration={admin}
          onSave={(input) => { void services.administration.recordCorrectionFor(admin.id, input, actor()); setShowCorrection(false) }}
          onClose={() => setShowCorrection(false)} />
      ) : null}
      {showReject ? (
        <RejectionModal medication={prep.order.medication} patientName={patient.name}
          onSave={(reason, comment) => { void services.preparation.rejectByNursing(prep.order.id, reason, comment, actor()); setShowReject(false) }}
          onClose={() => setShowReject(false)} />
      ) : null}
      {showCorrHistory ? (
        <HistoryDrawer title="Historial de correcciones" subtitle={`Administración · ${prep.order.medication}`} icon="refresh"
          entries={corrections.map((c): HistoryEntry => ({
            id: c.id, when: c.occurredAt, title: CORRECTION_TYPE_LABEL[c.correctionType],
            transition: { from: c.previousValue, to: c.correctedValue }, reason: c.reason, detail: c.comment,
            actor: c.actorName, role: c.actorRole, tone: 'warn',
          }))}
          onClose={() => setShowCorrHistory(false)} />
      ) : null}
    </div>
  )
}
