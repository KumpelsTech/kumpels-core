import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ORG } from '../data/org'
import {
  WORKSPACES, activeNavKey, navRefDef, navRefKey,
  NAV_GROUP, NAV_GROUP_ORDER, NAV_GROUP_LABEL,
} from '../config/workspaces'
import type { NavGroup, NavRef } from '../config/workspaces'
import { DEMO_SWITCH_USER_IDS, getFacility } from '../data/admin'
import type { AdminUser } from '../types/admin'
import { usePersona } from '../utils/personaStore'
import { useAdminStore } from '../utils/adminStore'

const initialsOf = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/** Etiqueta de sede a partir del alcance del usuario (presentación; no cambia autorización). */
function facilityLabel(user?: AdminUser): string {
  const ids = user?.scope.facilityIds ?? []
  if (ids.length === 0) return 'Todas las sedes'
  const names = ids.map((f) => getFacility(f)?.name).filter(Boolean) as string[]
  if (names.length > 1) return 'Multi-sede'
  return names[0] ?? '—'
}

/* ------------------------------------------------------------------ */
/* Sidebar — navegación por persona, agrupada y colapsable            */
/* ------------------------------------------------------------------ */
function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { profile } = usePersona()
  const loc = useLocation()
  const active = activeNavKey(loc.pathname, loc.search)

  // Reparte los destinos de la persona en secciones (Operación / Área / Sistema).
  const grouped = NAV_GROUP_ORDER.map((g) => ({
    group: g,
    items: profile.nav.filter((ref) => NAV_GROUP[navRefKey(ref)] === g),
  })).filter((s) => s.items.length > 0)

  const renderItem = (ref: NavRef) => {
    const key = navRefKey(ref)
    const def = navRefDef(ref)
    const label = def.label
    if (!def.to) {
      return (
        <button key={key} type="button" className="nav-item disabled" disabled
          title={collapsed ? `${label} · próximamente` : 'Disponible en una próxima iteración'} aria-label={label}>
          <Icon name={def.icon} className="ico" />
          <span className="nav-label">{label}</span>
          {!collapsed ? <span className="nav-soon">próx.</span> : null}
        </button>
      )
    }
    const isActive = active === key
    return (
      <Link key={key} to={def.to} className={`nav-item ${isActive ? 'active' : ''}`}
        aria-current={isActive ? 'page' : undefined} title={collapsed ? label : undefined}>
        <span className="nav-ind" aria-hidden="true" />
        <Icon name={def.icon} className="ico" />
        <span className="nav-label">{label}</span>
      </Link>
    )
  }

  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="brand">
        <div className="brand-row">
          <div className="brand-mark">K</div>
          <div className="brand-txt">
            <div className="brand-name">Kumpels Core</div>
            <div className="brand-sub">Clinical Operations OS</div>
          </div>
        </div>
      </div>

      <nav className="nav">
        {grouped.map(({ group, items }) => (
          <div className="nav-section" key={group}>
            {!collapsed ? <div className="nav-group">{NAV_GROUP_LABEL[group as NavGroup]}</div> : <div className="nav-divider" />}
            {items.map(renderItem)}
          </div>
        ))}
      </nav>

      <button type="button" className="nav-collapse" onClick={onToggle}
        aria-label={collapsed ? 'Expandir navegación' : 'Colapsar navegación'} title={collapsed ? 'Expandir' : 'Colapsar'}>
        <Icon name="panel" size={16} />
        <span className="nav-label">Colapsar</span>
      </button>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* TopBar pieces                                                       */
/* ------------------------------------------------------------------ */
function GlobalSearch() {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="search" role="search">
      <span className="s-ico"><Icon name="search" size={16} /></span>
      <input ref={ref} aria-label="Búsqueda global"
        placeholder="Buscar pacientes, tratamientos, lotes, tareas…" />
      <span className="s-kbd" aria-hidden="true">Ctrl K</span>
    </div>
  )
}

/** Punto de entrada visual de Kumpels AI (UX-03). No ejecuta IA: abre un panel
 * future-ready. La IA asiste y sugiere; un profesional revisa, decide y envía. */
function AITrigger() {
  const [open, setOpen] = useState(false)
  return (
    <div className="ai-trig-wrap">
      <button type="button" className="ai-trigger" onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog" aria-expanded={open} aria-label="Kumpels AI">
        <Icon name="spark" size={15} className="ai-ico" />
        <span className="ai-trigger-label">Kumpels AI</span>
      </button>
      {open ? (
        <>
          <div className="pop-scrim" onClick={() => setOpen(false)} />
          <div className="ai-pop ai-surface" role="dialog" aria-label="Kumpels AI">
            <div className="ai-pop-head">
              <span className="ai-label"><Icon name="spark" size={13} className="ai-ico" /> Kumpels AI</span>
              <button type="button" className="pop-x" onClick={() => setOpen(false)} aria-label="Cerrar"><Icon name="x" size={14} /></button>
            </div>
            <div className="ai-pop-body">
              Asistente clínico de Kumpels. Sugiere y explica; <strong>un profesional revisa, edita y decide</strong>.
              Nunca toma decisiones clínicas de forma autónoma.
            </div>
            <div className="ai-pop-foot"><span className="chip progress"><span className="chip-dot" />Próximamente</span></div>
          </div>
        </>
      ) : null}
    </div>
  )
}

/** Campana de notificaciones — solo punto de entrada (la agregación llega en una
 * tarea posterior). No inventa alertas ni contadores. */
function NotificationBell() {
  const [open, setOpen] = useState(false)
  return (
    <div className="bell-wrap">
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog" aria-expanded={open} aria-label="Notificaciones">
        <Icon name="bell" size={17} />
      </button>
      {open ? (
        <>
          <div className="pop-scrim" onClick={() => setOpen(false)} />
          <div className="notif-pop" role="dialog" aria-label="Notificaciones">
            <div className="notif-head">Notificaciones</div>
            <div className="notif-empty">
              <Icon name="bell" size={20} />
              <div>El centro de notificaciones se habilita en una próxima iteración.</div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

/** Contexto de organización / sede (compacto). Cambiar el contexto visual NO
 * cambia la autorización: el alcance lo aplica la elegibilidad existente. */
function OrgContext({ user }: { user?: AdminUser }) {
  return (
    <div className="org-ctx" title={`${ORG.name} · ${facilityLabel(user)}`}>
      <Icon name="loc" size={14} className="org-ctx-ico" />
      <div className="org-ctx-txt">
        <div className="org-ctx-org">{ORG.name}</div>
        <div className="org-ctx-fac">{facilityLabel(user)}</div>
      </div>
    </div>
  )
}

/** Switcher "Ver como" (demo). Selecciona la IDENTIDAD (Practitioner); su rol
 * determina el workspace. No es autenticación. */
function ViewAsSwitcher() {
  const { userId, user, profile, setUser } = usePersona()
  const { listUsers } = useAdminStore()
  const [open, setOpen] = useState(false)
  const all = listUsers()
  const users = DEMO_SWITCH_USER_IDS.map((id) => all.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u)
  return (
    <div className="viewas">
      <button type="button" className="user-chip as-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initialsOf(user?.name ?? profile.userName)}</span>
        <div className="user-chip-txt">
          <div className="u-name">{user?.name ?? profile.userName}</div>
          <div className="u-role">{profile.roleLabel}</div>
        </div>
        <span className="as-caret"><Icon name="chevR" size={13} /></span>
      </button>
      {open ? (
        <>
          <div className="as-scrim" onClick={() => setOpen(false)} />
          <div className="as-menu" role="menu">
            <div className="as-head">Ver como <span className="as-demo">demo</span></div>
            {users.map((u) => {
              const w = WORKSPACES[u.role]
              const fac = u.scope.facilityIds.map((f) => getFacility(f)?.name).filter(Boolean)
              const facLabel = fac.length > 1 ? 'Multi-sede' : (fac[0] ?? '—')
              return (
                <button key={u.id} type="button" role="menuitemradio" aria-checked={userId === u.id}
                  className={`as-item ${userId === u.id ? 'on' : ''}`} onClick={() => { setUser(u.id); setOpen(false) }}>
                  <span className="as-av">{initialsOf(u.name)}</span>
                  <div className="as-main">
                    <div className="as-label">{u.name}</div>
                    <div className="as-sub">{w.roleLabel} · {facLabel}</div>
                  </div>
                  {userId === u.id ? <Icon name="check" size={14} /> : null}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}

function TopBar({ collapsed, onToggle, user }: { collapsed: boolean; onToggle: () => void; user?: AdminUser }) {
  return (
    <header className="topbar">
      <button type="button" className="icon-btn topbar-toggle" onClick={onToggle}
        aria-label={collapsed ? 'Expandir navegación' : 'Colapsar navegación'} title="Navegación">
        <Icon name="panel" size={17} />
      </button>
      <GlobalSearch />
      <div className="top-spacer" />
      <AITrigger />
      <NotificationBell />
      <OrgContext user={user} />
      <div className="topbar-div" />
      <ViewAsSwitcher />
    </header>
  )
}

const NAV_PREF_KEY = 'kumpels.nav.collapsed'

export function AppShell() {
  const { user } = usePersona()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(NAV_PREF_KEY) === '1' } catch { return false }
  })
  const toggle = () => setCollapsed((c) => {
    const next = !c
    try { localStorage.setItem(NAV_PREF_KEY, next ? '1' : '0') } catch { /* almacenamiento no disponible */ }
    return next
  })

  return (
    <div className={`app ${collapsed ? 'nav-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="main">
        <TopBar collapsed={collapsed} onToggle={toggle} user={user} />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
