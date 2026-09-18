# Kumpels Core — Sistema de diseño (UX-02, "Clinical Precision")

Fundación visual que consumen todas las tareas UX posteriores. **No** es Tailwind: es la capa de tokens CSS existente (`src/index.css` `:root`) + primitivas. Regla: `selector existente → token semántico`, sin reescrituras destructivas.

## Decisiones bloqueadas
1. `#274AFE` = azul de acción/marca canónico. El azul comunica marca/acción/activo/seleccionado/IA — **no** tiñe cada título ni cada superficie. Texto primario ≈ negro `#1A1B24`.
2. Verde clínico `#2C9865` = éxito. No se adopta el durazno de Stitch como color semántico.
3. Tipografía: display `Plus Jakarta Sans`, cuerpo/UI `Inter`, números operativos con `tabular-nums`, IDs técnicos con mono nativo (sin IBM Plex Mono externo).
4. Command Palette Cmd+K diferido (no en UX-02/03).
5. IA puede **sugerir** borradores; el profesional revisa, edita, decide y envía. Nunca IA-decide→IA-envía. Sin IA funcional en UX-02.

## Color (tokens semánticos)
| Rol | Token | Valor |
|---|---|---|
| Marca / acción | `--brand` | `#274AFE` |
| Pressed / profundo | `--brand-deep` | `#002FDA` |
| Fondo suave acción/proceso | `--brand-soft` / `--process-soft` | `#DEE0FF` |
| Proceso / activo / IA | `--process` / `--ai` | `#4A58A9` |
| IA suave / glow | `--ai-soft` / `--ai-glow` | `#ECECFB` / `rgba(74,88,169,.28)` |
| Éxito | `--ok` (`--ok-ink`) | `#2C9865` (`#1F7A4E`) |
| Atención / SLA | `--warn` (`--warn-ink`) | `#D9820A` (`#8A5203`) |
| Crítico / bloqueo | `--crit` (`--crit-ink`) | `#BA1A1A` (`#93000A`), soft `#FFDAD6` |
| Informativo | `--info` | `#274AFE` |
| Canvas / superficie / low / high | `--bg` / `--surface` / `--surface-low` / `--surface-high` | `#FBF8FF` / `#FFFFFF` / `#F4F2FF` / `#E8E7F5` |
| Texto 1/2/muted | `--ink` / `--ink-2` / `--muted` | `#1A1B24` / `#444656` / `#747688` |
| Bordes | `--border` / `--border-strong` / `--border-soft` | `#E4E3F0` / `#C9C8DC` / `#EDECF7` |
| Foco | `--focus` / `--focus-ring` | `#274AFE` / `rgba(39,74,254,.30)` |

El color comunica significado; no se usa color fuerte como decoración.

## Radios y elevación
`--radius-chip 4 · --radius-control 6 · --radius-card 10 · --radius-sheet 14` (alias existentes `--radius/-sm/-lg` conservados). Estructura por **spacing + jerarquía de superficie + bordes sutiles**; sombra solo en flotantes: `.elev-1` (reposo mínimo), `.elev-2` (dropdowns), `.elev-3` (drawers/modales).

## Estado (nunca solo color)
`StatusChip` (`src/components/StatusChip.tsx`, clase `.chip`): icono + label + color.

| Kind | Clase | Encoding |
|---|---|---|
| neutral | `.chip.neutral` | ● hueco |
| info | `.chip.info` | i |
| in_progress | `.chip.progress` | ● En preparación |
| success | `.chip.ok` | ✓ Liberado |
| warning | `.chip.warn` | ! Requiere atención |
| critical | `.chip.crit` | ! |
| blocked | `.chip.blocked` | × Bloqueado |

Modificador `.solid` para relleno; `.sm` compacto.

## Primitivas
- **Button** (`Button.tsx` / `.btn`): `primary` (azul acción), `secondary`, `ghost`, `danger` (+`.soft`); tamaños `sm/md/lg`; `block`, `loading` (spinner). Estados hover/active/focus/disabled. Transición 120–180ms.
- **Card / Surface** (`Card.tsx` / `.surface`,`.surface-low`,`.surface-high`): blanco, borde sutil, radio 10px, sin sombra en reposo. Anidar con niveles de superficie, no card-dentro-de-card.
- **StatusChip** (arriba).
- **StatTile** (`StatTile.tsx` / `.stat-tile`, grid `.stat-row`): métrica compacta, número display + `tabular-nums`, tonos `crit/warn/ok/progress`; no clicable salvo `onClick`.
- **Badge** (legacy, `.badge`): se conserva para prioridad en mayúsculas.
- **Andamiaje IA** (`.ai-surface` + `.ai-label`): indigo contenido + glow sutil + label "Kumpels AI". Solo visual; sin autoridad clínica autónoma.

## Iconos
Sistema SVG propio (`Icon.tsx`), no Material Symbols. Añadidos en UX-02: `x`, `info`, `lock`, `dot`.

## Tipografía
`--display` en `h1–h6`, `.page-title`, `.section-title`. Cuerpo `--sans` (Inter). `.mono` = stack nativo con tabular. `body` lleva `font-variant-numeric: tabular-nums` global.

## No tocar en migración visual
Dominio completo: `services`, `repositories`, stores/proyecciones, WorkItems, autorización/eligibility, AuditRecords, DomainEvents, Atención Farmacéutica, Medication Intelligence, Enfermería, Central de Mezclas, genealogía, Journey, alineación HL7/FHIR, reglas de Comunicaciones (TASK 20.5). Sin Tailwind. UI en español.

## Shell (UX-03)
`AppShell` = sidebar claro colapsable + top bar sobria + workspace. Grid `--sidebar-w` (236px / 68px colapsado, `.app.nav-collapsed`), transición 160ms, preferencia en `localStorage` (`kumpels.nav.collapsed`). Navegación **persona-driven** (`profile.nav`) agrupada por presentación con `NAV_GROUP` / `NAV_GROUP_ORDER` / `NAV_GROUP_LABEL` (Operación / Área de trabajo / Sistema) — no cambia qué ve cada rol. Activo = fondo `--brand-soft` + indicador izquierdo `--brand` + icono de marca (sin rectángulo azul lleno). Top bar: toggle de rail, búsqueda global (`Ctrl K` enfoca el campo, sin command palette), trigger `Kumpels AI` (indigo + glow, panel future-ready, sin IA autónoma), campana (solo entrada, sin alertas inventadas), contexto Organización/Sede (compacto; el alcance lo aplica la elegibilidad, no el contexto visual), chip Usuario/rol con "Ver como" (demo). `PageHeader` (`src/components/PageHeader.tsx`): título display + subtítulo + acción contextual opcional; lo adoptan las páginas en tareas posteriores. Contenido `max-width:1400px` para workspaces densos. Rutas sin cambios. Responsive: rail automático ≤960px; sin bottom-nav.

## Hoy — workspace operativo (UX-04)
`HoyPage` recompuesto por rol reutilizando WorkItems, DelaySignals, priorityQueue, AssignedInbox, CoordinatorQueue/Delays, NursingPlanning y señales de comunicación — sin lógica de dominio nueva. Composición: `PageHeader` (saludo) → `OperationalBrief` (Kumpels AI, solo resume datos deterministas + "Ver por qué", disclaimer "no es una decisión clínica") → `StatTile` row → grid `.hoy-grid` (izq "Requieren tu atención" con `WorkItemRow` / Cola de prioridad para Coordinador · der "Asignado a ti" + radar rol-específico: Cuellos de botella / Reportes de pacientes) → "Próximo" (upcoming) → secciones full-width (NursingPlanning / CoordinatorDelays). Proyección de presentación en `src/utils/hoyView.ts` (`splitPool`, `briefStatements`, `bottlenecks`). Preserva `?focus=` para nav Seguimiento/Administración.

## Patient 360 & Journey (UX-05)
Restyle + composición (sin cambios de dominio ni de estructura): Patient 360 sigue siendo **un workspace continuo sin pestañas**. Header de contexto compacto (avatar brand→process, nombre display, identidad/terapia/sede/equipo). "PRÓXIMA ACCIÓN" pasa a panel claro con acento de marca y CTA `--brand` (deriva de `deriveNextAction`; el CTA lleva al Journey donde vive la acción con href+elegibilidad). Journey horizontal (`JourneyStepper`/`EpisodeJourneyView`) con semántica corregida: **etapa actual = indigo `--process` (halo)**, completadas = verde restringido (`--ok-bg` + check), bloqueada = rojo `!`, pendiente = anillo neutro — icono+label+estado, nunca solo color. Paneles Actual→Siguiente (owner/asignación), `DelaySignal` junto a la etapa, bloqueo (qué/por qué/desde/responsable/próxima acción), handoff, WorkItems del episodio y actividad reciente — todo desde `deriveEpisodeJourney` (misma proyección que Hoy/Journeys). Tres tipos de journey (oncology-iv / oral / fulfillment) sin hardcodear etapas en JSX. Secciones gated por `sees()` (énfasis por rol, una sola composición).

## Enfermería · Operaciones (UX-06)
`NursingPlanningBoard` recompuesto como centro operativo por hora (proyección sobre `nursingScheduledTreatments` — sin motor de agenda nuevo). `PageHeader` + `StatTile` (tratamientos / por enviar / listos para administrar / bloqueados) + franja "Requieren tu atención" (derivada) + `AssignedInbox` + Segmentado Hoy/Mañana + filtros `fpill` (Todos/Requieren acción/Bloqueados/Listos). Filas ancladas por hora (display + buckets Atrasada/Ventana actual/Más tarde/Mañana), chip de readiness (`.chip` UX-02), marcador **"Requiere tu acción"** (indigo) cuando Enfermería posee la próxima acción (`canSend`/`canAdminister`), visibilidad de producción ("En Central de Mezclas · sin acción de Enfermería" + siguiente owner), bloqueo con responsable, liberada→listo para administrar, `DelaySignal` (RETRASADA N MIN), y completadas visibles pero atenuadas (`.done-row`). CTAs `Enviar a producción` / `Registrar administración` con elegibilidad existente (el Coordinador no ve CTAs usables). Barra lateral izquierda de la fila codifica owns/bloqueo/retraso.

## Central de Mezclas & Trazabilidad (UX-07)
Restyle + composición del workstream "Preparación estéril" (proyección existente; sin cambios de dominio). `StatTile` (Preparaciones hoy / Bloqueadas / Esperan verificación / Liberadas / Retrasadas) + **pipeline de producción** (`.pipe`: Por preparar → En preparación → Verificación → Liberadas, con conteos, flechas y filtro de la cola por etapa; `STAGE_OF` proyecta sobre `PrepStatus` sin nueva máquina de estados). Cola (`prepq`) con ancla horaria, chip de estado, marcador **"Requiere tu acción"** (indigo, cuando QF Mezclas puede ejecutar), `DelaySignal` y bloqueo+responsable; barra lateral izquierda owns/bloqueo/retraso. Detalle de preparación = workspace continuo (sin pestañas): paciente/tratamiento → orden → componentes (multi-componente, multi-lote, identidad por lote) → readiness/bloqueo → preparación → verificación/liberación (segregación de funciones, verificador elegible, bloqueo "sin profesional elegible" + escalar, todo con elegibilidad existente) → **preparación final** (distinción lote fuente vs lote de mezcla final CMP, "no es lote de fabricante") → **genealogía** `TraceTree` reordenada a la narrativa ¿qué entró? (lotes fuente) → PREP → lote de mezcla final → paciente, con nodos+flechas → actividad. Reemplazo/supersedido y rechazo de Enfermería (TASK 19) conservados. Drawer de trazabilidad completa (firmas/tiempos/historial) sin duplicar la fuente.
