import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { CommunicationMessage, MessageTemplate, MessageType } from '../types/communication'
import { DELIVERY_LABEL, MESSAGE_TYPE_LABEL } from '../types/communication'
import { getPatient } from '../data/patients'
import { getCare } from '../data/careFollowup'
import { usePersona } from '../utils/personaStore'
import { hasCapability } from '../utils/eligibility'
import {
  TEMPLATES, EDUCATION_DOCS, useCommunicationStore, markThreadRead,
} from '../utils/communicationStore'
import { communicationService } from '../services/communicationService'
import { Icon } from '../components/Icon'

type Filter = 'todos' | 'atencion' | 'sin-responder' | 'seguimiento'

const FAC_ID: Record<string, string> = { Castellana: 'FAC-CAS', 'IPS 48': 'FAC-IPS48', Teusaquillo: 'FAC-TEU' }
const firstName = (n: string) => n.split(' ')[0]

/** Cuerpo prellenado de una plantilla (referencia medicación canónica, no la copia). */
function draftFor(tpl: MessageTemplate, patientName: string, med?: string): string {
  switch (tpl.messageType) {
    case 'MEDICATION_REMINDER': return `Hola, ${firstName(patientName)}. Recuerda tomar ${med ?? 'tu medicamento'} según el esquema indicado por tu equipo tratante.`
    case 'ADHERENCE_CHECK': return '¿Has podido tomar tu medicamento según lo indicado?'
    case 'SYMPTOM_CHECK': return '¿Has presentado algún síntoma desde la última toma?'
    case 'PAIN_CHECK': return 'En una escala de 0 a 10, ¿qué nivel de dolor tienes?'
    case 'FOLLOWUP_REQUEST': return `Hola, ${firstName(patientName)}. ¿Continúas con tu tratamiento según lo indicado?`
    case 'EDUCATION': return `Hola, ${firstName(patientName)}. Te compartimos información sobre tu tratamiento.`
    default: return ''
  }
}

/* ---------------- Burbuja de mensaje ---------------- */
function Bubble({ m }: { m: CommunicationMessage }) {
  const out = m.direction === 'outbound'
  const last = m.statusHistory[m.statusHistory.length - 1]
  const failed = m.deliveryStatus === 'FAILED'
  return (
    <div className={`cm-bubble ${out ? 'out' : 'in'} ${failed ? 'failed' : ''}`}>
      {m.messageType !== 'TEXT' && m.messageType !== 'MEDICATION_REMINDER' ? <div className="cm-type">{MESSAGE_TYPE_LABEL[m.messageType]}</div> : null}
      <div className="cm-text">{m.content}</div>
      {m.attachment ? (
        <div className="cm-doc"><Icon name="doc" size={14} /><div><div className="cm-doc-t">{m.attachment.title}</div><div className="cm-doc-s">{m.attachment.type}</div></div></div>
      ) : null}
      {m.options?.length ? <div className="cm-opts">{m.options.map((o) => <span key={o} className="cm-opt">{o}</span>)}</div> : null}
      <div className="cm-meta">
        {out ? `${DELIVERY_LABEL[m.deliveryStatus]} · ${(last?.at ?? m.sentAt).replace(/^Hoy\s*/, '')}` : `Recibido · ${m.sentAt.replace(/^Hoy\s*/, '')}`}
      </div>
    </div>
  )
}

/* ---------------- Página ---------------- */
export function ComunicacionesPage() {
  const store = useCommunicationStore()
  const { user, actor, profile } = usePersona()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [draftType, setDraftType] = useState<MessageType>('TEXT')
  const [draftAttachment, setDraftAttachment] = useState<{ title: string; type: string; resourceId?: string } | undefined>()
  const [draftOptions, setDraftOptions] = useState<string[] | undefined>()
  const [showReply, setShowReply] = useState(false)

  const canView = !!user && hasCapability(user, 'PATIENT_COMMUNICATION_VIEW')
  const canSend = !!user && hasCapability(user, 'PATIENT_COMMUNICATION_SEND')

  // Alcance: solo pacientes de la sede/programa del usuario.
  const inScope = (facility: string) => !user || !FAC_ID[facility] || user.scope.facilityIds.includes(FAC_ID[facility])
  const threads = store.listThreads().filter((t) => { const p = getPatient(t.patientId); return p && inScope(p.facility) })

  const selectedId = params.get('patient') ?? threads[0]?.patientId
  const patient = selectedId ? getPatient(selectedId) : undefined
  const thread = selectedId ? store.getThread(selectedId) : undefined
  const messages = thread ? store.messagesFor(thread.id) : []
  const care = selectedId ? getCare(selectedId) : undefined
  const attention = selectedId ? store.attentionForPatient(selectedId) : []
  const requests = selectedId ? store.requestsFor(selectedId) : []

  const select = (pid: string) => { const p = new URLSearchParams(params); p.set('patient', pid); setParams(p, { replace: true }); markThreadRead(pid); setDraft(''); setDraftType('TEXT'); setDraftAttachment(undefined); setDraftOptions(undefined); setShowReply(false) }

  const filtered = useMemo(() => threads.filter((t) => {
    const p = getPatient(t.patientId)
    if (search && !(p?.name.toLowerCase().includes(search.toLowerCase()))) return false
    if (filter === 'atencion') return t.status === 'needs-attention'
    if (filter === 'sin-responder') return t.status === 'pending-response'
    if (filter === 'seguimiento') return t.status === 'pending-response' || t.status === 'needs-attention'
    return true
  }), [threads, filter, search])

  const applyTemplate = (tpl: MessageTemplate, doc?: { title: string; type: string; resourceId?: string }) => {
    if (!patient) return
    setDraftType(tpl.messageType)
    setDraft(doc ? `Hola, ${firstName(patient.name)}. Te compartimos: ${doc.title}.` : draftFor(tpl, patient.name, patient.med))
    setDraftAttachment(doc)
    setDraftOptions(tpl.options)
  }

  const send = (opts?: { simulateFail?: boolean }) => {
    if (!patient || !draft.trim()) return
    void communicationService.send({
      patientId: patient.id, content: draft.trim(), messageType: draftType,
      programId: care ? 'PRG-ONC' : undefined,
      relatedMedicationOrderId: draftType === 'MEDICATION_REMINDER' ? `ORD-${patient.id.replace('ONC-', '')}` : undefined,
      relatedQuestionnaireId: draftOptions ? `Q-${draftType}` : undefined,
      attachment: draftAttachment, options: draftOptions, simulateFail: opts?.simulateFail,
    }, actor())
    setDraft(''); setDraftType('TEXT'); setDraftAttachment(undefined); setDraftOptions(undefined)
  }

  const schedule = () => {
    if (!patient || !draft.trim()) return
    communicationService.schedule({ patientId: patient.id, content: draft.trim(), messageType: draftType, scheduledFor: 'Hoy · 20:00' }, actor())
    setDraft(''); setDraftType('TEXT'); setDraftOptions(undefined)
  }

  // Última pregunta estructurada saliente (para simular respuesta del paciente).
  const lastQuestion = [...messages].reverse().find((m) => m.direction === 'outbound' && !!m.options)
  const simulate = (text: string) => { if (patient && lastQuestion) { communicationService.simulateInbound(patient.id, text, lastQuestion.messageType); setShowReply(false) } }

  if (!canView) {
    return <div className="card" style={{ padding: '48px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Sin acceso a comunicaciones</div>
      <div className="subtle" style={{ marginTop: 8 }}>Tu rol ({profile.roleLabel}) no tiene la capacidad de ver conversaciones clínicas con pacientes.</div>
    </div>
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Comunicaciones</h1>
          <div className="page-sub">Seguimiento de medicación con el paciente vía WhatsApp · las respuestas relevantes fluyen a Atención Farmacéutica.</div>
        </div>
      </div>

      <div className="comm">
        {/* IZQUIERDA — bandeja */}
        <aside className="comm-inbox">
          <div className="ci-search"><Icon name="users" size={13} /><input type="text" placeholder="Buscar paciente…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="ci-filters">
            {(['todos', 'atencion', 'sin-responder', 'seguimiento'] as Filter[]).map((f) => (
              <button key={f} type="button" className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {f === 'todos' ? 'Todos' : f === 'atencion' ? 'Requieren atención' : f === 'sin-responder' ? 'Sin responder' : 'Seguimiento'}
              </button>
            ))}
          </div>
          <div className="ci-list">
            {filtered.length === 0 ? <div className="subtle" style={{ padding: 14 }}>Sin conversaciones.</div> : null}
            {filtered.map((t) => {
              const p = getPatient(t.patientId)
              return (
                <button key={t.id} type="button" className={`ci-row ${selectedId === t.patientId ? 'on' : ''}`} onClick={() => select(t.patientId)}>
                  <span className="ci-av">{p?.initials ?? '?'}</span>
                  <div className="ci-main">
                    <div className="ci-top"><span className="ci-name">{p?.name}</span><span className="ci-time">{t.lastActivityAt.replace(/^Hoy\s*/, '')}</span></div>
                    <div className="ci-sub">{p?.dx ?? p?.modality}</div>
                    <div className="ci-prev">{t.lastPreview ?? 'Sin mensajes'}</div>
                  </div>
                  <div className="ci-ind">
                    {t.unreadCount > 0 ? <span className="ci-unread">{t.unreadCount}</span> : null}
                    {t.status === 'needs-attention' ? <span className="ci-att" title="Requiere atención"><Icon name="alert" size={12} /></span> : null}
                    {t.status === 'pending-response' ? <span className="ci-pend" title="Sin responder">⋯</span> : null}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* CENTRO — conversación */}
        <section className="comm-conv">
          {!patient ? (
            <div className="cc-empty"><Icon name="msg" size={22} /><div>Selecciona una conversación</div></div>
          ) : (
            <>
              <div className="cc-head">
                <span className="cc-av">{patient.initials}</span>
                <div><div className="cc-name">{patient.name}</div><div className="cc-sub">WhatsApp · {patient.dx ?? patient.modality}</div></div>
                {thread?.assignedUserName ? <span className="cc-assign"><Icon name="users" size={11} /> Seguimiento asignado a: {thread.assignedUserName}</span> : null}
                <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => navigate(`/patients/${patient.id}`)}>Ver paciente <Icon name="chevR" size={12} /></button>
              </div>

              <div className="cc-thread">
                {messages.length === 0 ? (
                  <div className="cc-first">
                    <div className="cc-first-t">Aún no hay conversaciones con este paciente.</div>
                    <div className="cc-first-a">
                      {TEMPLATES.filter((t) => ['MEDICATION_REMINDER', 'ADHERENCE_CHECK', 'SYMPTOM_CHECK', 'EDUCATION'].includes(t.messageType)).map((t) => (
                        <button key={t.id} type="button" className="btn sm" disabled={!canSend} onClick={() => applyTemplate(t)}>{t.actionLabel === 'Recordar medicamento' ? 'Recordatorio' : t.actionLabel.replace('Preguntar ', '').replace('Enviar ', '')}</button>
                      ))}
                    </div>
                  </div>
                ) : messages.map((m) => <Bubble key={m.id} m={m} />)}
              </div>

              {/* Simular respuesta del paciente (demo · WHATSAPP_SIMULATED) */}
              {lastQuestion ? (
                <div className="cc-sim">
                  {!showReply ? <button type="button" className="link-mini" onClick={() => setShowReply(true)}><Icon name="msg" size={12} /> Simular respuesta del paciente (demo)</button> : (
                    <div className="cc-sim-opts">
                      {(lastQuestion.options ?? []).map((o) => <button key={o} type="button" className="btn sm" onClick={() => simulate(o === 'Sí' && lastQuestion.messageType === 'SYMPTOM_CHECK' ? 'Sí, he tenido náuseas.' : o === 'No' && lastQuestion.messageType === 'ADHERENCE_CHECK' ? 'No he podido tomar el medicamento.' : o)}>{o}</button>)}
                      <button type="button" className="link-mini" onClick={() => setShowReply(false)}>cancelar</button>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Composer */}
              <div className="cc-composer">
                {draftType !== 'TEXT' ? <div className="cx-type"><Icon name="spark" size={11} /> {MESSAGE_TYPE_LABEL[draftType]}{draftAttachment ? ` · ${draftAttachment.title}` : ''}{draftOptions ? ` · opciones: ${draftOptions.join(' / ')}` : ''}</div> : null}
                <textarea className="cx-text" rows={2} placeholder={canSend ? 'Escribe un mensaje o usa una acción del panel…' : 'Tu rol no puede enviar mensajes al paciente.'} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!canSend} />
                <div className="cx-actions">
                  <button type="button" className="btn sm" disabled={!canSend || !draft.trim()} onClick={schedule}><Icon name="calendar" size={12} /> Programar</button>
                  <button type="button" className="btn sm" disabled={!canSend || !draft.trim()} onClick={() => send({ simulateFail: true })} title="Simular fallo de entrega">Simular fallo</button>
                  <button type="button" className="btn sm primary" disabled={!canSend || !draft.trim()} onClick={() => send()}><Icon name="msg" size={12} /> Enviar</button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* DERECHA — contexto + acciones */}
        <aside className="comm-ctx">
          {patient ? (
            <>
              <div className="cx-card">
                <div className="cx-name">{patient.name}</div>
                <div className="cx-prog">{patient.dx ? patient.dx : 'Oncología'}</div>
                <div className="cx-facts">
                  <div><span className="cx-k">Tratamiento</span><span className="cx-v">{patient.med ?? patient.protocol ?? '—'}</span></div>
                  <div><span className="cx-k">Esquema</span><span className="cx-v">{patient.protocol ?? '—'}{patient.cycle && patient.cycle !== 'Continuo' ? ` · Ciclo ${patient.cycle}` : ''}</span></div>
                  {care ? <div><span className="cx-k">Próximo seguimiento</span><span className="cx-v">{care.nextFollowUp}</span></div> : null}
                  <div><span className="cx-k">Responsable</span><span className="cx-v">{thread?.assignedUserName ?? care?.responsible ?? 'Farmacia Clínica'}</span></div>
                </div>
                {attention.length ? <div className="cx-att"><Icon name="alert" size={12} /> Atención: {attention[0].label}</div> : null}
                <button type="button" className="btn sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={() => navigate(`/patients/${patient.id}`)}>Ver paciente</button>
              </div>

              <div className="cx-actions-panel">
                <div className="cx-lead">Acciones de seguimiento</div>
                {TEMPLATES.filter((t) => t.messageType !== 'DOCUMENT' && t.messageType !== 'EDUCATION').map((t) => (
                  <button key={t.id} type="button" className="cx-qa" disabled={!canSend} onClick={() => applyTemplate(t)}>
                    <Icon name={t.messageType === 'MEDICATION_REMINDER' ? 'pill' : t.messageType === 'PAIN_CHECK' ? 'alert' : t.messageType === 'FOLLOWUP_REQUEST' ? 'refresh' : 'msg'} size={13} /> {t.actionLabel}
                  </button>
                ))}
                <div className="cx-lead" style={{ marginTop: 12 }}>Enviar educación</div>
                {EDUCATION_DOCS.map((d) => (
                  <button key={d.resourceId} type="button" className="cx-qa doc" disabled={!canSend} onClick={() => applyTemplate(TEMPLATES.find((t) => t.messageType === 'EDUCATION')!, d)}>
                    <Icon name="doc" size={13} /> {d.title}
                  </button>
                ))}
              </div>

              {requests.length ? (
                <div className="cx-sched">
                  <div className="cx-lead">Programados</div>
                  {requests.map((r) => (
                    <div className="cx-sched-row" key={r.id}><Icon name="calendar" size={12} /> <span>{MESSAGE_TYPE_LABEL[r.messageType]} · {r.scheduledFor}</span><span className="cx-sched-st">{r.status}</span></div>
                  ))}
                </div>
              ) : null}
            </>
          ) : <div className="subtle" style={{ padding: 14 }}>Selecciona un paciente para ver su contexto.</div>}
        </aside>
      </div>
    </>
  )
}
