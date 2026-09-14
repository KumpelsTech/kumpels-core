import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ORG } from '../data/org'
import { PERSONA_ORDER, WORKSPACES, activeNavKey, navRefDef, navRefKey } from '../config/workspaces'
import { usePersona } from '../utils/personaStore'

/** Sidebar adaptado al workspace del rol activo. Reutiliza rutas del Core. */
function Sidebar() {
  const { profile } = usePersona()
  const loc = useLocation()
  const active = activeNavKey(loc.pathname, loc.search)

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-row">
          <div className="brand-mark">K</div>
          <div>
            <div className="brand-name">Kumpels</div>
            <div className="brand-sub">Core · Oncology Care</div>
          </div>
        </div>
        <div className="org-chip">
          <div className="o-name">{ORG.name}</div>
          <div className="o-sub">Workspace · {profile.short}</div>
        </div>
      </div>
      <nav className="nav">
        <div className="nav-group">{profile.label}</div>
        {profile.nav.map((ref) => {
          const key = navRefKey(ref)
          const def = navRefDef(ref)
          if (!def.to) {
            return (
              <button key={key} type="button" className="nav-item disabled" disabled title="Disponible en una próxima iteración">
                <Icon name={def.icon} className="ico" />
                <span>{def.label}</span>
                <span className="nav-soon">próx.</span>
              </button>
            )
          }
          return (
            <Link key={key} to={def.to} className={`nav-item ${active === key ? 'active' : ''}`} aria-current={active === key ? 'page' : undefined}>
              <Icon name={def.icon} className="ico" />
              <span>{def.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

/** Switcher "Ver como" (demo). No es autenticación; cambia el workspace visible. */
function ViewAsSwitcher() {
  const { persona, profile, setPersona } = usePersona()
  const [open, setOpen] = useState(false)
  return (
    <div className="viewas">
      <button type="button" className="user-chip as-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{profile.initials}</span>
        <div>
          <div className="u-name">{profile.userName}</div>
          <div className="u-role">{profile.roleLabel}</div>
        </div>
        <span className="as-caret"><Icon name="chevR" size={13} /></span>
      </button>
      {open ? (
        <>
          <div className="as-scrim" onClick={() => setOpen(false)} />
          <div className="as-menu" role="menu">
            <div className="as-head">Ver como <span className="as-demo">demo</span></div>
            {PERSONA_ORDER.map((p) => {
              const w = WORKSPACES[p]
              return (
                <button key={p} type="button" role="menuitemradio" aria-checked={persona === p}
                  className={`as-item ${persona === p ? 'on' : ''}`} onClick={() => { setPersona(p); setOpen(false) }}>
                  <span className="as-av">{w.initials}</span>
                  <div className="as-main">
                    <div className="as-label">{w.label}</div>
                    <div className="as-sub">{w.userName}</div>
                  </div>
                  {persona === p ? <Icon name="check" size={14} /> : null}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}

function TopBar() {
  return (
    <div className="topbar">
      <div className="search">
        <span className="s-ico"><Icon name="search" size={15} /></span>
        <input placeholder="Buscar paciente, ID, protocolo…" aria-label="Buscar" />
      </div>
      <div className="top-spacer" />
      <button type="button" className="icon-btn" aria-label="Notificaciones"><Icon name="bell" size={17} /></button>
      <ViewAsSwitcher />
    </div>
  )
}

export function AppShell() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <TopBar />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
