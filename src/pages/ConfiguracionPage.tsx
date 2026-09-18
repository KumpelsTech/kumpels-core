import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AdminUser, ClinicalConfigStatus, IntegrationStatus, RoleId, Scope } from '../types/admin'
import { WORKSPACES, PERSONA_ORDER } from '../config/workspaces'
import { CAPABILITY_LABEL, capabilitiesForRole } from '../config/capabilities'
import {
  CLINICAL_CONFIGS, FACILITIES, INTEGRATIONS, ORGANIZATION, PROGRAMS, TEAMS, getFacility, getProgram, getTeam,
} from '../data/admin'
import { useAdminStore } from '../utils/adminStore'
import { usePersona } from '../utils/personaStore'
import { services } from '../services'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { Icon, type IconName } from '../components/Icon'

type AreaKey = 'usuarios' | 'organizacion' | 'roles' | 'clinica' | 'integraciones' | 'soporte'

const AREAS: { key: AreaKey; icon: IconName; title: string; desc: string }[] = [
  { key: 'usuarios', icon: 'users', title: 'Usuarios y equipos', desc: 'Personas, equipos, membresía y estado.' },
  { key: 'organizacion', icon: 'loc', title: 'Organización y sedes', desc: 'Organización, sedes y programas.' },
  { key: 'roles', icon: 'shield', title: 'Roles y alcance', desc: 'Rol, alcance de sede y programa.' },
  { key: 'clinica', icon: 'stethoscope', title: 'Configuración clínica', desc: 'Protocolos, reglas y plantillas (gobernadas aparte).' },
  { key: 'integraciones', icon: 'refresh', title: 'Integraciones', desc: 'Sistemas externos y modo de integración.' },
  { key: 'soporte', icon: 'msg', title: 'Soporte', desc: 'Acceso de soporte Kumpels, temporal y con alcance.' },
]

const roleLabel = (r: RoleId) => WORKSPACES[r].label
const CLIN_VARIANT: Record<ClinicalConfigStatus, 'ok' | 'info' | 'action' | 'plain'> = {
  activo: 'ok', aprobado: 'info', revision: 'action', borrador: 'plain', retirado: 'plain',
}
const CLIN_LABEL: Record<ClinicalConfigStatus, string> = {
  activo: 'Activo', aprobado: 'Aprobado', revision: 'En revisión', borrador: 'Borrador', retirado: 'Retirado',
}
const INT_VARIANT: Record<IntegrationStatus, 'ok' | 'plain' | 'hi'> = { conectado: 'ok', inactivo: 'plain', error: 'hi' }
const INT_LABEL: Record<IntegrationStatus, string> = { conectado: 'Conectado', inactivo: 'Inactivo', error: 'Error' }
const CLIN_KIND: Record<string, string> = { protocolo: 'Protocolo', ruleset: 'Regla clínica', 'plantilla-seguimiento': 'Plantilla de seguimiento', formulario: 'Formulario' }

/* ---------- Editar acceso (rol / equipo / alcance) ---------- */
function AccessModal({ user, actor, onClose }: { user: AdminUser; actor: string; onClose: () => void }) {
  const [role, setRole] = useState<RoleId>(user.role)
  const [teamId, setTeamId] = useState<string | undefined>(user.teamId)
  const [facilityIds, setFacilityIds] = useState<string[]>(user.scope.facilityIds)
  const [programIds, setProgramIds] = useState<string[]>(user.scope.programIds)

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])

  const save = () => {
    if (role !== user.role) void services.admin.assignRole(user.id, role, actor)
    if (teamId !== user.teamId) void services.admin.assignTeam(user.id, teamId, actor)
    const scope: Scope = { facilityIds, programIds }
    if (JSON.stringify(scope) !== JSON.stringify(user.scope)) void services.admin.assignScope(user.id, scope, actor)
    onClose()
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Editar acceso" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="users" size={16} /></span>
          <div><div className="mh-title">Editar acceso</div><div className="mh-sub">{user.name} · {user.email}</div></div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label htmlFor="ac-role">Rol</label>
            <select id="ac-role" className="fsel-el" value={role} onChange={(e) => setRole(e.target.value as RoleId)}>
              {PERSONA_ORDER.map((r) => <option key={r} value={r}>{WORKSPACES[r].label}</option>)}
            </select>
          </div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label htmlFor="ac-team">Equipo</label>
            <select id="ac-team" className="fsel-el" value={teamId ?? ''} onChange={(e) => setTeamId(e.target.value || undefined)}>
              <option value="">Sin equipo</option>
              {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="cfg-scope">
            <div className="cfg-scope-lbl">Alcance de sede</div>
            <div className="cfg-checks">
              {FACILITIES.map((f) => (
                <label key={f.id} className="cfg-check"><input type="checkbox" checked={facilityIds.includes(f.id)} onChange={() => toggle(facilityIds, setFacilityIds, f.id)} /> {f.name}</label>
              ))}
            </div>
          </div>
          <div className="cfg-scope" style={{ marginTop: 12 }}>
            <div className="cfg-scope-lbl">Alcance de programa</div>
            <div className="cfg-checks">
              {PROGRAMS.map((pr) => (
                <label key={pr.id} className="cfg-check"><input type="checkbox" checked={programIds.includes(pr.id)} onChange={() => toggle(programIds, setProgramIds, pr.id)} /> {pr.name} · {getFacility(pr.facilityId)?.name}</label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Cambio registrado para auditoría.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Solicitar soporte ---------- */
function SupportModal({ actor, onClose }: { actor: string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [scope, setScope] = useState('Integraciones · solo lectura')
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Solicitar soporte" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="msg" size={16} /></span>
          <div><div className="mh-title">Solicitar soporte Kumpels</div><div className="mh-sub">Acceso temporal y con alcance</div></div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label htmlFor="sup-scope">Alcance</label>
            <select id="sup-scope" className="fsel-el" value={scope} onChange={(e) => setScope(e.target.value)}>
              {['Integraciones · solo lectura', 'Configuración técnica · solo lectura', 'Diagnóstico de plataforma'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fu-field">
            <label htmlFor="sup-reason">Motivo</label>
            <input id="sup-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe el problema técnico…" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> El acceso queda registrado y es revocable.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" onClick={() => { void services.admin.requestSupport({ reason: reason.trim() || 'Soporte técnico', scope, requestedBy: actor }); onClose() }}>Solicitar</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Subvistas ---------- */
function Usuarios({ actor }: { actor: string }) {
  const { listUsers } = useAdminStore()
  const [edit, setEdit] = useState<AdminUser | null>(null)
  const users = listUsers()
  return (
    <div className="card">
      <div className="section-head"><div className="section-title">Usuarios <span className="st-sub">{users.length}</span></div></div>
      <div className="cfg-table">
        <div className="cfg-hrow"><span>Usuario</span><span>Rol</span><span>Equipo</span><span>Alcance</span><span>Estado</span><span></span></div>
        {users.map((u) => {
          const caps = u.capabilities ?? capabilitiesForRole(u.role)
          const facs = u.scope.facilityIds.map((f) => getFacility(f)?.name).filter(Boolean)
          const progs = u.scope.programIds.map((p) => getProgram(p)?.name).filter(Boolean)
          return (
            <div className="cfg-urow" key={u.id}>
              <div className="cfg-row">
                <div><div className="cfg-name">{u.name}</div><div className="cfg-mail">{u.email}</div></div>
                <span className="cfg-cell">{roleLabel(u.role)}</span>
                <span className="cfg-cell">{u.teamId ? getTeam(u.teamId)?.name : '—'}</span>
                <span className="cfg-cell">{facs.length > 1 ? 'Multi-sede' : (facs[0] ?? '—')}{progs.length ? ' · Oncología' : ''}</span>
                <span><Badge variant={u.status === 'activo' ? 'ok' : 'plain'}>{u.status === 'activo' ? 'Activo' : 'Inactivo'}</Badge></span>
                <span className="cfg-actions">
                  <button type="button" className="btn sm" onClick={() => setEdit(u)}>Editar acceso</button>
                  <button type="button" className="btn sm" onClick={() => void services.admin.setUserStatus(u.id, u.status === 'activo' ? 'inactivo' : 'activo', actor)}>
                    {u.status === 'activo' ? 'Desactivar' : 'Activar'}
                  </button>
                </span>
              </div>
              <div className="cfg-caps">
                <span className="cfg-caps-lbl">Capacidades</span>
                {caps.map((c) => <span className="cap-chip" key={c}><Icon name="check" size={10} /> {CAPABILITY_LABEL[c]}</span>)}
                {facs.length ? <span className="cfg-caps-scope">{facs.join(', ')}{progs.length ? ` · ${progs.join(', ')}` : ''}</span> : null}
              </div>
            </div>
          )
        })}
      </div>
      {edit ? <AccessModal user={edit} actor={actor} onClose={() => setEdit(null)} /> : null}
    </div>
  )
}

function Organizacion() {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div className="org-tree">
        <div className="org-node org-org"><span className="org-ico"><Icon name="loc" size={14} /></span> {ORGANIZATION.name} <span className="pq-id mono">NIT {ORGANIZATION.nit}</span></div>
        {FACILITIES.map((f) => (
          <div className="org-branch" key={f.id}>
            <div className="org-node org-fac"><span className="org-ico"><Icon name="box" size={13} /></span> {f.name}</div>
            {PROGRAMS.filter((p) => p.facilityId === f.id).map((p) => (
              <div className="org-node org-prog" key={p.id}><span className="org-ico"><Icon name="stethoscope" size={12} /></span> {p.name}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Roles() {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card">
        <div className="section-head"><div className="section-title">Roles <span className="st-sub">{PERSONA_ORDER.length}</span></div></div>
        <div className="cfg-table">
          {PERSONA_ORDER.map((r) => (
            <div className="cfg-row" key={r}>
              <div><div className="cfg-name">{WORKSPACES[r].label}</div><div className="cfg-mail">{WORKSPACES[r].roleLabel}</div></div>
              <span className="cfg-cell" style={{ gridColumn: '2 / -1' }}>Rol de workspace · el alcance de sede y programa se define por usuario en “Usuarios y equipos”.</span>
            </div>
          ))}
        </div>
      </div>
      <div className="tab-note"><Icon name="shield" size={13} /> Conceptos separados: usuario ≠ rol ≠ permiso ≠ alcance ≠ workspace. Sin matriz de permisos compleja en este MVP.</div>
    </div>
  )
}

function Clinica() {
  const life: ClinicalConfigStatus[] = ['borrador', 'revision', 'aprobado', 'activo', 'retirado']
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="cfg-life">
        <span className="cfg-life-lbl">Ciclo de vida</span>
        {life.map((s, i) => (
          <span key={s} className="cfg-life-step"><Badge variant={CLIN_VARIANT[s]}>{CLIN_LABEL[s]}</Badge>{i < life.length - 1 ? <Icon name="chevR" size={12} /> : null}</span>
        ))}
      </div>
      <div className="card">
        <div className="section-head"><div className="section-title">Configuración clínica <span className="st-sub">{CLINICAL_CONFIGS.length}</span></div></div>
        <div className="cfg-table">
          <div className="cfg-hrow cfg-hrow-clin"><span>Elemento</span><span>Tipo</span><span>Versión</span><span>Responsable</span><span>Vigencia</span><span>Estado</span></div>
          {CLINICAL_CONFIGS.map((c) => (
            <div className="cfg-row cfg-row-clin" key={c.id}>
              <div><div className="cfg-name">{c.name}</div>{c.approvedBy ? <div className="cfg-mail">Aprobado por {c.approvedBy}</div> : null}</div>
              <span className="cfg-cell">{CLIN_KIND[c.kind]}</span>
              <span className="cfg-cell mono">{c.version}</span>
              <span className="cfg-cell">{c.owner}</span>
              <span className="cfg-cell">{c.effectiveDate ?? '—'}</span>
              <span><Badge variant={CLIN_VARIANT[c.status]}>{CLIN_LABEL[c.status]}</Badge></span>
            </div>
          ))}
        </div>
      </div>
      <div className="tab-note"><Icon name="shield" size={13} /> La configuración clínica se gobierna aparte de la administración de TI: un administrador no puede modificar silenciosamente los criterios de seguridad. Los cambios pasan por revisión y aprobación, y quedan versionados.</div>
    </div>
  )
}

function Integraciones() {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card">
        <div className="section-head"><div className="section-title">Integraciones <span className="st-sub">{INTEGRATIONS.length}</span></div></div>
        <div className="cfg-table">
          <div className="cfg-hrow cfg-hrow-int"><span>Sistema</span><span>Tipo</span><span>Modo</span><span>Última sincronización</span><span>Estado</span></div>
          {INTEGRATIONS.map((it) => (
            <div className="cfg-row cfg-row-int" key={it.id}>
              <div className="cfg-name">{it.name}</div>
              <span className="cfg-cell">{it.type}</span>
              <span className="cfg-cell mono">{it.mode}</span>
              <span className="cfg-cell">{it.lastSync ?? '—'}</span>
              <span><Badge variant={INT_VARIANT[it.status]}>{INT_LABEL[it.status]}</Badge></span>
            </div>
          ))}
        </div>
      </div>
      <div className="tab-note"><Icon name="refresh" size={13} /> Compatibilidad prevista: REST API, HL7, FHIR e importación por archivo. Sin conectores reales en este MVP.</div>
    </div>
  )
}

function Soporte({ actor }: { actor: string }) {
  const { listSupport, activeSupport } = useAdminStore()
  const [open, setOpen] = useState(false)
  const active = activeSupport()
  const sessions = listSupport()
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className={`cfg-support ${active ? 'on' : ''}`}>
        <span className="ps-ico"><Icon name="shield" size={16} /></span>
        <div className="cfg-support-main">
          <div className="cfg-support-title">Soporte Kumpels · {active ? 'Sesión activa' : 'Sin acceso activo'}</div>
          <div className="cfg-support-sub">{active ? `${active.scope} · desde ${active.startedAt}` : 'El soporte solo se habilita para incidencias técnicas/plataforma, de forma temporal y con alcance.'}</div>
        </div>
        {active
          ? <button type="button" className="btn sm" onClick={() => void services.admin.endSupport(active.id, actor)}>Finalizar acceso</button>
          : <button type="button" className="btn primary sm" onClick={() => setOpen(true)}>Solicitar soporte</button>}
      </div>
      <div className="card">
        <div className="section-head"><div className="section-title">Sesiones de soporte recientes</div></div>
        {sessions.length === 0 ? <EmptyState icon="shield" title="Sin sesiones de soporte" /> : (
          <div className="cfg-table">
            {sessions.map((s) => (
              <div className="cfg-row" key={s.id}>
                <div><div className="cfg-name">{s.reason}</div><div className="cfg-mail">{s.scope}</div></div>
                <span className="cfg-cell">{s.requestedBy}</span>
                <span className="cfg-cell">{s.startedAt}{s.endedAt ? ` – ${s.endedAt}` : ''}</span>
                <span><Badge variant={s.status === 'activo' ? 'action' : 'plain'}>{s.status === 'activo' ? 'Activa' : 'Finalizada'}</Badge></span>
              </div>
            ))}
          </div>
        )}
      </div>
      {open ? <SupportModal actor={actor} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

/** Configuración — administración institucional (separada de la config clínica y del soporte). */
export function ConfiguracionPage() {
  const [params, setParams] = useSearchParams()
  const { profile } = usePersona()
  const actor = profile.userName
  const area = (params.get('section') as AreaKey | null)
  const go = (a: AreaKey | null) => { const p = new URLSearchParams(params); if (a) p.set('section', a); else p.delete('section'); setParams(p, { replace: true }) }
  const current = AREAS.find((a) => a.key === area)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Configuración</h1>
          <div className="page-sub">
            {current
              ? <button type="button" className="btn ghost sm" onClick={() => go(null)}><span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevR" size={13} /></span> Configuración</button>
              : 'Administración institucional · gestione su configuración operativa sin depender de Kumpels.'}
          </div>
        </div>
      </div>

      {!current ? (
        <div className="cfg-areas">
          {AREAS.map((a) => (
            <button type="button" key={a.key} className="cfg-area" onClick={() => go(a.key)}>
              <span className="cfg-area-ico"><Icon name={a.icon} size={18} /></span>
              <div><div className="cfg-area-title">{a.title}</div><div className="cfg-area-desc">{a.desc}</div></div>
              <Icon name="chevR" size={14} />
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="section-lead" style={{ marginTop: 0 }}><Icon name={current.icon} size={13} /> {current.title}</div>
          {area === 'usuarios' ? <Usuarios actor={actor} /> : null}
          {area === 'organizacion' ? <Organizacion /> : null}
          {area === 'roles' ? <Roles /> : null}
          {area === 'clinica' ? <Clinica /> : null}
          {area === 'integraciones' ? <Integraciones /> : null}
          {area === 'soporte' ? <Soporte actor={actor} /> : null}
        </>
      )}
    </>
  )
}
