import type { Patient } from '../../types/patient'
import type { MedStatus, Medication, TherapyAccess } from '../../types/therapy'
import { getTherapy } from '../../data/therapy'
import { authBadgeKind } from '../../utils/patient'
import { Badge } from '../Badge'
import { Icon } from '../Icon'

function medBadgeVariant(s: MedStatus): 'ok' | 'info' | 'action' | 'plain' {
  if (s === 'Activo') return 'ok'
  if (s === 'En curso') return 'info'
  if (s === 'Pausado') return 'action'
  return 'plain'
}

function MedRow({ med }: { med: Medication }) {
  return (
    <div className="med-row">
      <span className="med-ico"><Icon name="pill" size={15} /></span>
      <div className="med-main">
        <div className="med-name">{med.name}</div>
        <div className="med-meta">
          <span className="mm"><span className="mm-ico"><Icon name="drop" size={12} /></span>{med.dose}</span>
          <span className="dot-sep" />
          <span className="mm">Vía {med.route}</span>
          <span className="dot-sep" />
          <span className="mm"><span className="mm-ico"><Icon name="clock" size={12} /></span>{med.schedule}</span>
        </div>
      </div>
      <span className="med-status"><Badge variant={medBadgeVariant(med.status)}>{med.status}</Badge></span>
    </div>
  )
}

function AccessSection({ access }: { access: TherapyAccess }) {
  return (
    <div className="card info-card">
      <h4><Icon name="box" size={14} /> Acceso / estado operativo</h4>
      <div className="access-line">
        <span className="al-ico"><Icon name="shield" size={14} /></span>
        <span className="al-k">Autorización</span>
        <span className="al-v"><Badge variant={authBadgeKind(access.authStatus)}>{access.authStatus}</Badge></span>
      </div>
      {access.lastDispensation ? (
        <div className="access-line">
          <span className="al-ico"><Icon name="box" size={14} /></span>
          <span className="al-k">Última dispensación</span>
          <span className="al-v">{access.lastDispensation}</span>
        </div>
      ) : null}
      {access.nextEvent ? (
        <div className="access-line">
          <span className="al-ico"><Icon name="calendar" size={14} /></span>
          <span className="al-k">Próxima dispensación / aplicación</span>
          <span className="al-v">{access.nextEvent}</span>
        </div>
      ) : null}
      {access.availability ? (
        <div className="access-line">
          <span className="al-ico"><Icon name="drop" size={14} /></span>
          <span className="al-k">Disponibilidad</span>
          <span className={`al-v ${/pendiente|N\/D|confirmar/i.test(access.availability) ? 'warn' : ''}`}>{access.availability}</span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Farmacoterapia — plan de terapia, medicamentos y contexto clínico relevante.
 * Responde "¿qué tratamiento recibe y qué contexto necesito para entenderlo?".
 * La terapia vive en el dominio de terapia (data/therapy); no se duplica aquí.
 */
export function FarmacoterapiaTab({ patient, showAccess = true }: { patient: Patient; showAccess?: boolean }) {
  const therapy = getTherapy(patient.id)
  if (!therapy) {
    return <div className="card"><div className="subtle" style={{ padding: 24 }}>Plan de terapia no disponible para este episodio.</div></div>
  }
  const { plan, medications, access, note } = therapy
  const c = patient.clinical

  return (
    <div className="two-col">
      {/* Columna principal */}
      <div className="stack">
        {/* Plan de terapia */}
        <div className="card info-card">
          <h4><Icon name="pill" size={14} /> Plan de terapia</h4>
          <div className="plan-grid">
            <div className="plan-cell full">
              <div className="lbl">Esquema</div>
              <div className="val">{plan.scheme}</div>
            </div>
            <div className="plan-cell">
              <div className="lbl">Modalidad</div>
              <div className="val">{plan.modality}</div>
            </div>
            <div className="plan-cell">
              <div className="lbl">Estado del tratamiento</div>
              <div className="val">{plan.status}</div>
            </div>
            {plan.start ? (
              <div className="plan-cell">
                <div className="lbl">Inicio</div>
                <div className="val">{plan.start}</div>
              </div>
            ) : null}
            <div className="plan-cell">
              <div className="lbl">Patrón de tratamiento</div>
              <div className="val">{plan.pattern}</div>
            </div>
            <div className="plan-cell full">
              <div className="lbl">{plan.cycle.phase ? 'Fase del tratamiento' : 'Ciclos'}</div>
              {plan.cycle.phase && !plan.cycle.currentOrNext ? (
                <div className="cycle-band">
                  <div className="cb"><div className="cb-lbl"><span className="cb-ico"><Icon name="refresh" size={12} /></span> Fase</div><div className="cb-val">{plan.cycle.phase}</div></div>
                  {plan.cycle.lastCompleted ? (
                    <div className="cb"><div className="cb-lbl"><span className="cb-ico"><Icon name="check" size={12} /></span> Última dispensación</div><div className="cb-val">{plan.cycle.lastCompleted}</div></div>
                  ) : null}
                </div>
              ) : (
                <div className="cycle-band">
                  <div className="cb">
                    <div className="cb-lbl"><span className="cb-ico"><Icon name="check" size={12} /></span> Último ciclo completado</div>
                    <div className="cb-val">{plan.cycle.lastCompleted ?? 'Sin ciclos completados'}</div>
                  </div>
                  <div className="cb next">
                    <div className="cb-lbl"><span className="cb-ico"><Icon name="arrow" size={12} /></span> Ciclo actual / próximo</div>
                    <div className="cb-val">{plan.cycle.currentOrNext ?? '—'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {note ? <div className="tab-note"><Icon name="alert" size={13} /> {note}</div> : null}
        </div>

        {/* Medicamentos actuales */}
        <div className="card info-card">
          <h4><Icon name="pill" size={14} /> Medicamentos actuales</h4>
          {plan.isCombination ? (
            <div className="regimen-head"><span className="rh-line" />Esquema combinado · {medications.length} componentes<span className="rh-line" /></div>
          ) : null}
          <div className="med-list">
            {medications.map((m) => <MedRow key={m.name} med={m} />)}
          </div>
        </div>
      </div>

      {/* Columna lateral */}
      <div className="stack">
        {access && showAccess ? <AccessSection access={access} /> : null}

        {/* Contexto clínico relevante — divulgación progresiva */}
        <details className="disclose" open>
          <summary><Icon name="drop" size={15} /> Contexto clínico relevante <span className="chev"><Icon name="chevR" size={14} /></span></summary>
          <div className="d-body">
            <div className="kv"><span className="k">Peso</span><span className="v">{c.peso ?? '—'}</span></div>
            <div className="kv"><span className="k">Superficie corporal (BSA)</span><span className="v">{c.bsa ?? '—'}</span></div>
            <div className="kv"><span className="k">Función renal</span><span className="v">{c.renal ?? '—'}</span></div>
            <div className="kv"><span className="k">Función hepática</span><span className="v">{c.hepatica ?? '—'}</span></div>
            <div className="kv"><span className="k">Alergias</span><span className="v">{c.alergias ?? '—'}</span></div>
            <div className="kv"><span className="k">Laboratorios recientes</span><span className="v">{c.labs ?? '—'}</span></div>
          </div>
        </details>

        <div className="tab-note"><Icon name="shield" size={13} /> Kumpels muestra el contexto de la terapia como apoyo. No genera decisiones de tratamiento; la decisión es profesional.</div>
      </div>
    </div>
  )
}
