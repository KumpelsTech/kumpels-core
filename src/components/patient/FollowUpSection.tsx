import { useState } from 'react'
import type { Patient } from '../../types/patient'
import type { CareDomain, FollowUpStatusKind } from '../../types/careFollowup'
import { getCare } from '../../data/careFollowup'
import { useCareStore } from '../../utils/careStore'
import { usePersona } from '../../utils/personaStore'
import { useFulfillmentStore } from '../../utils/fulfillmentStore'
import { deriveCareDomains } from '../../utils/resumen'
import { services } from '../../services'
import { Badge } from '../Badge'
import { EmptyState } from '../EmptyState'
import { Icon } from '../Icon'
import { FollowUpDrawer } from './FollowUpDrawer'
import { HistoryDrawer, type HistoryEntry } from '../HistoryDrawer'

const STATUS_BADGE: Record<FollowUpStatusKind, 'ok' | 'action' | 'info'> = {
  'al-dia': 'ok', completado: 'ok', requerido: 'action', vencido: 'action', 'entrevista-pendiente': 'info',
}

function DomainRow({ dom }: { dom: CareDomain }) {
  const icon = dom.state === 'ok' ? 'check' : dom.state === 'warn' ? 'alert' : 'clock'
  return (
    <div className={`dom-row ${dom.state}`}>
      <span className={`dr-ico ${dom.state}`}><Icon name={icon} size={13} /></span>
      <span className="dr-k">{dom.label}</span>
      <span className="dr-note">{dom.note}</span>
    </div>
  )
}

/**
 * Seguimiento farmacoterapéutico — parte del workspace continuo de Patient 360.
 * Estado compacto + dominios núcleo + una acción. Refleja la evaluación registrada.
 */
export function FollowUpSection({ patient }: { patient: Patient }) {
  const base = getCare(patient.id)
  const { getAssessment, getAssessmentHistory } = useCareStore()
  useFulfillmentStore() // suscripción: el contexto de continuidad afecta el dominio "acceso"
  const { can, actor } = usePersona()
  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  if (!base) return <div className="card"><EmptyState icon="refresh" title="Sin registro de atención farmacéutica" /></div>

  // Regla de dominio (utils/resumen): el contexto de continuidad marca "acceso".
  const domains = deriveCareDomains(patient.id, base.domains)

  const done = getAssessment(patient.id)
  const history = getAssessmentHistory(patient.id)
  const previous = history.length > 1 ? history[history.length - 2] : undefined
  const histEntries: HistoryEntry[] = history.map((h, i) => ({
    id: `fu-${i}`, when: h.at, title: h.mode === 'entrevista-inicial' ? 'Entrevista inicial' : 'Seguimiento',
    detail: `Continuidad: ${h.continuidad}${h.usoReportado ? ` · Uso: ${h.usoReportado}` : ''}${h.seguridad ? ` · Síntoma: ${h.seguridad}` : ''}`,
    actor: h.by, role: h.role, tone: (h.needsProfessionalReview ? 'warn' : 'ok') as HistoryEntry['tone'],
  })).reverse()
  const status: FollowUpStatusKind = done ? 'completado' : base.status
  const statusLabel = done ? `Completado · Hoy` : base.statusLabel
  const lastAssessment = done ? 'Hoy' : base.lastAssessment
  const nextFollowUp = done ? done.nextFollowUp : base.nextFollowUp

  const actionLabel = done
    ? 'Revisar seguimiento'
    : base.mode === 'entrevista-inicial'
      ? 'Completar entrevista inicial'
      : base.status === 'al-dia' ? 'Revisar seguimiento' : 'Realizar seguimiento'

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div className="care-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Badge variant={STATUS_BADGE[status]}>{statusLabel}</Badge>
            {base.intensity ? <span className="subtle">Intensidad {base.intensity}</span> : null}
          </div>
          <div className="care-meta" style={{ marginTop: 9 }}>
            <span className="cm">Última evaluación · <b>{lastAssessment ?? '—'}</b></span>
            <span className="cm">Próximo · <b>{nextFollowUp}</b></span>
            <span className="cm">Responsable · <b>{base.responsible}</b></span>
            {base.setting ? <span className="cm">Ámbito · <b>{base.setting}</b></span> : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {history.length ? (
            <button type="button" className="link-mini" onClick={() => setShowHistory(true)}><Icon name="clock" size={12} /> Ver historial ({history.length})</button>
          ) : null}
          {can('seguimiento') ? (
            <button type="button" className={`btn sm ${base.required && !done ? 'primary' : ''}`} onClick={() => setOpen(true)}>
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div className="dom-list">
        {domains.map((dom) => <DomainRow key={dom.key} dom={dom} />)}
      </div>

      {done ? (
        <div className="care-result">
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="check" size={13} /> Seguimiento actual · {done.by}{done.role ? ` (${done.role})` : ''} · <span className="mono" style={{ fontWeight: 500 }}>{done.at}</span>
          </div>
          {previous ? <div className="prev-fu">Anterior · {previous.at} · {previous.continuidad}</div> : null}
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
            Continuidad: {done.continuidad}. {done.usoReportado ? `Uso (reportado): ${done.usoReportado}. ` : ''}
            {done.seguridad ? `Síntoma reportado: ${done.seguridad}. ` : 'Sin síntomas reportados. '}
            {done.observation ? `Nota: ${done.observation}.` : ''}
          </div>
          {done.needsProfessionalReview ? (
            <div className="mini-warn" style={{ marginTop: 9 }}><Icon name="shield" size={13} /> Revisión profesional requerida por el síntoma reportado.</div>
          ) : null}
        </div>
      ) : null}

      <div className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12 }}>
        <Icon name="shield" size={12} /> Lo reportado por el paciente se conserva como tal; el seguimiento no genera decisiones de tratamiento automáticas.
      </div>

      {open ? (
        <FollowUpDrawer
          patient={patient}
          enrollment={base}
          existing={done}
          previous={previous}
          reviewer={actor()}
          onSave={(a) => { void services.pharmaceuticalCare.completeAssessment(patient.id, a); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {showHistory ? (
        <HistoryDrawer title="Historial de seguimientos" subtitle={`${patient.name} · ${patient.id}`} icon="refresh" entries={histEntries} onClose={() => setShowHistory(false)} />
      ) : null}
    </div>
  )
}
