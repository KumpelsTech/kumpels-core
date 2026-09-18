# UX-01 — Auditoría Stitch & Plan de Migración UI (Kumpels Core)

> Estado de cada afirmación: `confirmado` = leído en código/assets · `propuesta` = recomendación de diseño a decidir · `riesgo` = punto a resolver antes de implementar.
> **Alcance de esta tarea:** análisis y planeación. **No se modificó código de aplicación.** No inicia UX-02.

Los assets Stitch son **referencia visual e interaccional**, no arquitectura de reemplazo. Todo el dominio (modelos, servicios, repositorios, WorkItems, autorización/eligibility, AuditRecords, DomainEvents, Atención Farmacéutica, Medication Intelligence, operaciones de medicación, Enfermería, Central de Mezclas, Comunicaciones, genealogía de lotes, proyecciones Journey, alineación HL7/FHIR) se **preserva**. Se rediseña la experiencia, no el dominio.

---

## A. Resumen del lenguaje de diseño Stitch ("Clinical Precision OS")

`confirmado` (de `DESIGN.md` + `theme.json` + 4 pantallas).

**Concepto:** "Vibrant Clinical Precision" — telemetría aeroespacial + software contemporáneo de alto contraste. Densidad tabular alta, delineación con hairlines, azul eléctrico reservado a acción primaria e inteligencia (Kumpels AI). Turnos de 12h, baja fatiga cognitiva, cero ambigüedad.

**Color (Material 3, fuente = `theme.json`):**

| Rol | Token | Hex | Uso |
|---|---|---|---|
| Marca / CTA | `primary-container` | `#274AFE` | Botones primarios, marca, nav activa |
| Primario profundo | `primary` | `#002FDA` | Headings sobre claro, estado pressed |
| En proceso / actual / IA | `secondary` | `#4A58A9` | Etapa activa, framing IA, halos de foco |
| Chip suave azul | `secondary-fixed` | `#DEE0FF` / ink `#313F90` | Chips de estado "en curso" |
| Crítico / alerta / bloqueo | `error` / `error-container` | `#BA1A1A` / `#FFDAD6` | Alertas, bloqueos, dot `animate-ping` |
| Terciario | `tertiary` / `tertiary-fixed` | `#961600` / `#FFDAD3` | Ver **riesgo de color** abajo |
| Canvas | `surface` | `#FBF8FF` | Fondo (lavanda casi blanco) |
| Card | `surface-container-lowest` | `#FFFFFF` | Superficie de tarjeta, sin sombra en reposo |
| Escalera de superficie | `surface-container-low/…/highest` | `#F4F2FF → #E2E1EF` | Contenedores anidados con hairline |
| Texto | `on-surface` / `on-surface-variant` / `outline` | `#1A1B24` / `#444656` / `#747688` | Escalera de tinta |

> **Inconsistencia en la fuente (resuelta):** `DESIGN.md` narra el azul como `#274AFE` y el terciario como "Crimson Red #A61900 (warning)", pero el HTML renderiza "completado/liberado" en terciario **durazno** `#FFDAD3` (no verde, no rojo) y el CTA en `#0135ef`. Se toma **`theme.json` como fuente de verdad de tokens**: azul de marca canónico = **`#274AFE`**. La semántica de "éxito = durazno" se marca como riesgo (D/H) y **no se adopta** tal cual.

**Tipografía:** `Plus Jakarta Sans` (700/600) para display/headings; `Inter` (400/500/600) para cuerpo, labels y datos. Números tabulares (`tnum`) obligatorios en mg, mL/h, lotes, timestamps, presiones. Line-height holgado para acentos y nomenclatura de compounding en español.

**Escalas:**
- Radios: micro (tags/badges) 4px · controles (inputs/botones/segmented) 6px · cards/drawers 8–10px · sheets 12–16px. Pills solo para indicadores de presencia.
- Spacing: `xs .25 · sm .5 · md .75 · lg 1.25 · xl 2rem`; gutter 1rem, `gutter-compact` .5rem en zonas densas (Mezclas).
- Elevación: contención estructural + hairline, **sin sombras difusas en reposo**. Sombra solo en flotantes (dropdowns, drawers). "Layer AI" = glow perimetral en cálculos/verificaciones IA.
- Iconografía: Material Symbols Outlined (los assets). El app actual usa SVG inline propio → se conserva el sistema propio, se replican los glifos necesarios.

**Modelo de layout Stitch (¡ojo!):** las 4 pantallas son **phone-first** (~390–430px): barra de comando superior `h-28` + **bottom nav de 5 tabs**, **sin sidebar izquierdo** y **sin multi-panel desktop**. Cmd+K es **decorativo** (string en el buscador; no hay command palette real). CSS = Tailwind CDN. → Es dirección visual, **no** el modelo de shell para Kumpels (ver B/D/H).

---

## B. Tokens de diseño Kumpels recomendados

`propuesta`. El app ya es **token-driven** (`:root` en `index.css`, 1470 líneas, sin Tailwind). La migración es principalmente **swap de tokens + primitivas**, conservando la arquitectura CSS hand-written (no introducir Tailwind — contradice "no dependencias innecesarias" del CLAUDE.md).

Mapeo actual → propuesto:

| Concepto | Token actual | Valor actual | Token propuesto | Valor propuesto |
|---|---|---|---|---|
| Canvas | `--bg` | `#EEF1F6` | `--bg` | `#FBF8FF` |
| Card | `--surface` | `#FFFFFF` | `--surface` | `#FFFFFF` |
| Superficies anidadas | `--surface-2/3` | `#EEF2FB/#F6F8FC` | `--surface-low/high` | `#F4F2FF / #E8E7F5` |
| Marca/CTA | `--accent` | `#2F4BC4` | `--accent` | `#274AFE` |
| Marca profunda | `--navy` | `#182755` | `--brand-deep` | `#002FDA` |
| En proceso / IA | *(no existe)* | — | `--progress` / `--ai` | `#4A58A9` |
| Chip azul suave | `--accent-soft` | `#E7ECFB` | `--progress-bg` | `#DEE0FF` |
| Crítico | `--crit` | `#CE4B45` | `--crit` | `#BA1A1A` (bg `#FFDAD6`) |
| Advertencia | `--warn` | `#D9820A` | `--warn` | `#D9820A` **(conservar ámbar)** |
| Éxito/OK | `--ok` | `#2C9865` | `--ok` | `#2C9865` **(conservar verde)** |
| Texto | `--ink/-2/--muted` | `#16203A/#48566E/#78859B` | igual, ajustar a `#1A1B24/#444656/#747688` | — |
| Radios | `--radius/-sm/-lg` | `10/7/14px` | `--r-chip/-control/-card/-sheet` | `4/6/10/14px` |
| Fuente cuerpo | `--sans` | IBM Plex Sans | `--sans` | `Inter` |
| Fuente display | *(no existe)* | — | `--display` | `Plus Jakarta Sans` |
| Datos/mono | `--mono` | IBM Plex Mono | `--mono` | `Inter + tabular-nums` (o conservar Plex Mono para lotes) |

Spacing (`--sp-1..6` = 4..32px) ya es compatible con la escala Stitch — **sin cambio**.

**Tokens nuevos a introducir:** `--ai` / `--ai-glow` (glow perimetral IA), `--progress` (indigo en-proceso, hoy ausente), radios de 4 niveles, `--display` font.

---

## C. Gap analysis — UI actual vs Stitch

`confirmado`.

| Dimensión | Actual | Stitch | Gap |
|---|---|---|---|
| Modelo de shell | Sidebar 236px + topbar, desktop-first | Top bar + bottom nav, phone-first | **Mantener desktop**; Stitch es inspiración visual, no estructural |
| CSS | Hand-written, tokens `:root`, sin dark mode | Tailwind CDN, Material 3 | Portar valores a tokens; **no** adoptar Tailwind |
| Paleta | Azul `#2F4BC4`, verde OK, sin indigo "en proceso" | Azul `#274AFE`, indigo en-proceso/IA, durazno | Añadir indigo en-proceso + IA; reencuadrar azul |
| Tipografía | IBM Plex Sans/Mono | Plus Jakarta + Inter | Swap de familias (afecta métricas en 1470 líneas) |
| Patient 360 | **Continuo, sin tabs** ✅ | Continuo, sin tabs | **Ya alineado** |
| Journey | **Horizontal**, estado por icono+label ✅ | Horizontal, estado por color+halo | Ya alineado; **conservar** encoding no-cromático (accesibilidad) |
| Comunicaciones | **3 columnas** ✅ | Chat + contexto | Ya alineado estructuralmente; restyle de burbujas/composer |
| Atención/Owner/SLA | Componentes dedicados (`ActiveAttention`, `NextAction`, `OwnerBlock`, `CoordinatorDelays`) ✅ | Accent bars, owner badge, timer chip | Ya cubierto; restyle a lenguaje Stitch |
| IA | Solo icono `spark`, sin lenguaje visual | Cards gradiente + glow + `auto_awesome` + "Kumpels AI" | **Nuevo**: componente `AICard`/`OperationalBrief` |
| Command palette | Input simple | Cmd+K decorativo | Ninguno real en ambos; oportunidad opcional |
| Genealogía de lotes | Drawer trazabilidad | Árbol inline + modal | Restyle a árbol con nodos + rieles |
| Densidad KPI | `.ops-sum` stat row | Bento `grid-cols-3/4` de stat tiles | Restyle a bento |

**Lo ya alineado con los principios UX del brief (no rehacer):** Patient 360 continuo sin tabs (principio 5), Journey horizontal (principio 6), atención/owner/next-action ya derivados y visibles (principio 8), Comunicaciones 3-col. La migración es sobre todo **re-skin + densificación + lenguaje IA**, no reestructuración.

---

## D. Matriz KEEP / RESTYLE / REFACTOR / REPLACE / NEW

`propuesta`.

| Área | Veredicto | Nota |
|---|---|---|
| **AppShell** (sidebar+topbar) | RESTYLE | Conservar shell desktop y nav persona-driven; reestilizar sidebar, topbar, añadir trigger IA. **No** adoptar bottom nav. |
| Navegación (`workspaces.ts`) | KEEP | Mantener indirección `NAV_CATALOG` + `WORKSPACES[persona].nav`. Solo cambia estilo/emphasis. |
| Buscador global | REFACTOR | Input → opcional command palette (Cmd+K real). Baja prioridad. |
| Persona switcher (`ViewAsSwitcher`) | RESTYLE | Chip + menú "Ver como" se conservan; reestilizar. |
| **Hoy** (`HoyPage`) | REFACTOR | Añadir `OperationalBrief` (pulso IA), "Radar de cuellos de botella" (bento), inbox con accent bars. Estructura role-driven se conserva. |
| **Patient 360** | RESTYLE | Ya continuo. Reestilizar secciones, header, vitals, genealogía. Sin cambio estructural. |
| **Journeys** (stepper) | RESTYLE | Horizontal ya. Añadir halo de etapa actual, owner slate, chip SLA. Conservar encoding icono+label. |
| Nursing Planning | RESTYLE | Board se conserva; re-skin. |
| **Central de Mezclas** | REFACTOR | Bento KPI, pipeline cards, árbol de genealogía inline, bento QA, firma de liberación. Lógica intacta. |
| Atención Farmacéutica | KEEP (lógica) / RESTYLE (UI) | `ActiveAttention`/`FindingCard` re-skin. No tocar derivaciones. |
| Medication Operations | REFACTOR | `.ws-tabs` Cumplimiento/Preparación → reestilizar; considerar segmented. |
| Comunicaciones | RESTYLE | 3-col ya; burbujas, composer, quick-actions, context panel. **Sin** auto-draft IA (regla de dominio TASK 20.5). |
| Trazabilidad de lotes | REFACTOR | Drawer → árbol de nodos con rieles. |
| Coordinator Priority Queue | RESTYLE | `CoordinatorQueue`/`CoordinatorDelays` re-skin a filas con accent bar. |
| Configuración | RESTYLE | `.cfg-table` hub-detail se conserva; re-skin. |
| `PatientTabs`/`ResumenTab`/`RevisionTab` | REPLACE (borrar) | Stubs muertos (`export {}`). Eliminar del repo. |
| **Primitivas** (`Badge`, `Segmented`, `EmptyState`) | RESTYLE | Base para el nuevo sistema. |
| **StatusChip / StatTile / AICard / OwnerBadge / JourneyStage-halo / LotTreeNode / CommandPalette / Skeleton / Modal genérico** | NEW | Ver E. |

---

## E. Sistema de componentes reutilizable propuesto

`propuesta`. Primitivas de producto, no "porque Stitch los generó".

**Layout / shell:** `AppShell` (RESTYLE), `Sidebar` (RESTYLE, persona-driven), `TopBar` (RESTYLE, +IA trigger +telemetría), `GlobalSearch`/`CommandPalette` (REFACTOR/NEW), `PageHeader` (formalizar `.page-head`).

**Inteligencia / brief:** `OperationalBrief` (NEW — pulso IA gradiente+glow), `AICard` (NEW — envoltura IA con `--ai-glow`; **uso: sugerencias no vinculantes, nunca acción clínica automática**).

**Cola / trabajo:** `PriorityQueue` + `WorkItemCard` (RESTYLE de `WorkItemRow` con accent bar), `AttentionSignal` (RESTYLE de `ActiveAttention`), `StatusBadge`/`StatusChip` (NEW, unifica `Badge`), `SLAIndicator` (RESTYLE, de `deriveDelaySignal`), `OwnerIndicator` (RESTYLE de `OwnerBlock`).

**Journey:** `JourneyStepper` (RESTYLE), `JourneyStage` (RESTYLE +halo actual), `ClinicalBlocker` (RESTYLE banner de bloqueo).

**Paciente:** `PatientContextHeader` (RESTYLE de `PatientHeader`), `PatientContextPanel` (RESTYLE, panel derecho comms), `VitalsBar` (RESTYLE).

**Mezclas / lotes:** `MedicationCard`, `PreparationCard`, `LotCard`, `ComponentGenealogy`/`LotTreeNode`, `TraceabilityGraph` (REFACTOR de trazabilidad).

**Comunicaciones:** `ConversationInbox`, `ConversationRow`, `MessageBubble`, `MessageComposer`, `QuickAction` (todos RESTYLE — el 3-col ya existe).

**Genéricos:** `StatTile`/bento cell (NEW), `ContextDrawer` (RESTYLE de `HistoryDrawer`), `ActivityItem` (RESTYLE), `AlertItem`, `EmptyState` (KEEP), `Skeleton` (NEW — no existe carga esqueleto), `Modal`/`ConfirmationDialog` (NEW — formalizar el patrón de modales dispersos), `FilterPill`, `Toast` (NEW).

**No construir** solo porque Stitch los generó: bottom nav, floating action pill mobile, Cmd+K si no aporta al flujo desktop.

---

## F. Implicaciones UX role-aware

`propuesta`. Un solo app, sin duplicar. La config persona (`workspaces.ts`) ya gobierna nav/secciones/acciones — se **conserva** y se extiende el estilo.

| Rol | Emphasis nav | Hoy | Priority queue | Quick actions | Journey emphasis |
|---|---|---|---|---|---|
| Coordinador | Visión global, Journeys, Analítica | Radar de cuellos de botella + delays + cola | Todos los roles, escalamiento | Asignar/Reasignar/Escalar/Priorizar | Todas las etapas, SLA agregado |
| QF Clínico | Revisión, Seguimiento, Comunicaciones | Bandeja clínica + reportes paciente | Validaciones, bloqueos clínicos | Validar dosis, seguimiento, mensaje | Etapa Rev. Clínica / Seguimiento |
| QF Central de Mezclas | Preparación, Trazabilidad | Cabinas, cola de producción, doble chequeo | Preparaciones y liberaciones | Preparar/Verificar/Liberar/Lote | Etapa Mezclas / Doble Chq / Liberación |
| Enfermería | Planeación, Administración | Board de enfermería, administración | Administraciones pendientes | Registrar administración | Etapa Enfermería / Administración |
| Farmacia / Dispensación | Dispensación, Pacientes | Cumplimiento, disponibilidad | Contacto, entrega, pendientes | Contacto/Disponibilidad/Entregar | Etapa dispensación/entrega |

**Regla de seguridad conservada:** Admin institucional **no** ve conversaciones clínicas ni ejecuta trabajo clínico (TASK 20.5 + `workspaces.ts`). El re-skin no altera gating por capacidad.

---

## G. Orden de migración recomendado

`propuesta`. Coincide con la dirección esperada, con salvaguardas. Cada tarea cierra con **build limpio** y no toca dominio.

1. **UX-02 — Tokens + primitivas.** Swap `:root` (color, radios, fuentes Inter/Plus Jakarta), `StatusChip`, `Button`, `Card`, `StatTile`, `Badge`. **Regla crítica:** mantener/mapear los nombres de clase existentes para evitar big-bang; introducir tokens sin romper 1470 líneas. Riesgo bajo, apalancamiento alto.
2. **UX-03 — AppShell + nav + top bar.** Reestilizar sidebar/topbar, trigger IA, (opcional) command palette. **Decisión de modelo de layout aquí:** conservar shell desktop, no adoptar bottom nav. Añadir `--display` a headings.
3. **UX-04 — Hoy role-aware.** `OperationalBrief`, radar de cuellos de botella (bento), `PriorityQueue` con accent bars.
4. **UX-05 — Patient 360 + Journey horizontal.** Restyle secciones continuas + stepper con halo + owner slate + chip SLA + genealogía.
5. **UX-06 — Nursing.**
6. **UX-07 — Central de Mezclas + trazabilidad.** Pipeline cards, árbol de genealogía, bento QA, firma.
7. **UX-08 — Comunicaciones.** Burbujas, composer, context panel (3-col ya existe).
8. **UX-09 — Restantes + pasada de consistencia.** Pacientes, Revisión, Operaciones, Config; borrar stubs de tabs; QA visual global, tabular-nums, accesibilidad.

**Ajuste vs orden esperado:** ninguno mayor. Dos decisiones se adelantan a UX-02/03 (semántica de color de éxito; azul de marca) por ser transversales.

---

## H. Riesgos arquitectónicos mayores

`riesgo`.

1. **Phone-first vs desktop-first.** Stitch es móvil (bottom nav, columna única). El brief exige desktop-first clínico + tablet. Copiar el shell Stitch rompería el flujo. **Mitigación:** tomar color/tipografía/cards/densidad/lenguaje IA; conservar el shell sidebar+topbar; usar los patrones móviles solo como fallback tablet/≤768px.
2. **Semántica de color de "éxito".** Stitch pinta completado/liberado en **durazno** (no verde) y no tiene ámbar de advertencia dedicado. En oncología, verde=ok y ámbar=precaución son convenciones fuertes. **Mitigación:** conservar verde OK + ámbar warn; usar durazno solo como acento neutro si aporta. Decidir con Melisa.
3. **Encoding solo por color.** Stitch depende de color + `animate-ping`. El app actual codifica estado con **icono+label** (mejor accesibilidad). **Mitigación:** conservar el doble encoding; no degradar a color-only.
4. **Cambio de fuentes.** IBM Plex → Inter/Plus Jakarta altera métricas/line-height en 1470 líneas. **Mitigación:** cambiar vía tokens, pasada de regresión visual por sección, `tabular-nums` en datos.
5. **Tentación de Tailwind.** Los assets son Tailwind CDN. Introducirlo añade dependencia y dos sistemas de estilo. **Mitigación:** portar valores a los tokens CSS existentes; no adoptar Tailwind.
6. **Lógica en JSX.** Los HTML Stitch llevan JS inline (selectStep, setFilter, toasts). **Mitigación:** no copiar; reusar proyecciones/servicios existentes; la UI solo presenta.
7. **AI-draft en Comunicaciones.** Stitch muestra "Borrador Sugerido por IA · Aprobar y Enviar". Choca con la regla de dominio TASK 20.5 (sin mensajería clínica automática; el humano redacta, previsualiza y envía). **Mitigación:** el patrón visual IA se usa para *sugerencias no vinculantes*; **no** se habilita auto-draft clínico en esta migración.
8. **Deriva de nombres de clase.** Reestructurar clases rompería selectores en 1470 líneas y en los smokes Playwright. **Mitigación:** mapa de compatibilidad de clases en UX-02; smokes actualizados por tarea.

---

## I. Archivos/componentes probablemente afectados en UX-02 y UX-03

`propuesta`.

**UX-02 (tokens + primitivas):**
- `src/index.css` — `:root` (colores, radios, fuentes), primitivas `.badge/.cat/.tag/.card/.btn`, escalera de superficies.
- `index.html` — `<link>` Google Fonts (Inter + Plus Jakarta Sans) reemplazando IBM Plex.
- `src/components/Badge.tsx` (→ `StatusChip` variantes), `Segmented.tsx`, `EmptyState.tsx`.
- Nuevos: `src/components/StatusChip.tsx`, `StatTile.tsx`, `Button.tsx`/`Card.tsx` si se formalizan.
- `src/components/Icon.tsx` — glifos nuevos (`auto_awesome`/spark IA, arrow_downward, qr, draw, etc.).

**UX-03 (shell + nav + top bar):**
- `src/layouts/AppShell.tsx` — `Sidebar`, `TopBar`, `ViewAsSwitcher`.
- `src/config/workspaces.ts` — solo si se ajustan labels/íconos de nav (no la estructura).
- `src/index.css` — bloques `.app/.sidebar/.topbar/.nav/.search/.user-chip/.as-*`.
- Nuevos opcionales: `PageHeader.tsx`, `CommandPalette.tsx`, `AITrigger` en topbar.

**No tocar en UX-02/03:** nada bajo `src/services`, `src/utils` (proyecciones/stores), `src/repositories`, `src/types`, `src/data`, `src/config/capabilities.ts` ni `eligibility`. Son dominio.

---

## J. Qué NO cambiar durante la migración visual

`confirmado` (del brief) + `propuesta`.

- Modelos de dominio, servicios, repositorios, stores/proyecciones (`utils/*Store`, `episodeJourney`, `delaySignals`, `workItems`, `priorityQueue`, `activityProjection`).
- WorkItems y ciclo de asignación (TASK 18); autorización/eligibility y capacidades; AuditRecords; DomainEvents; Atención Farmacéutica; Medication Intelligence; operaciones de medicación; flujos de Enfermería y Central de Mezclas; genealogía de medicación; proyecciones Journey; alineación HL7/FHIR.
- Reglas de dominio de Comunicaciones (TASK 20.5): sin mensajería clínica automática; Admin no ve conversaciones clínicas; interpretación determinística sin auto-diagnóstico.
- Rutas existentes (`router.tsx`) salvo razón UX fuerte.
- Encoding de estado no-cromático (icono+label) del Journey.
- Sin branching por cliente. UI en español. Accesibilidad mantenida. Desktop-first, tablet-compatible.
- **Regla de marketing (memoria):** no mencionar FHIR en materiales públicos; el mapeo interno en docs/código es válido.

---

## Decisiones abiertas (desbloquean UX-02)

1. **Azul de marca:** confirmar `#274AFE` (fuente `theme.json`) como acento canónico, con `#002FDA` para headings/pressed. `por validar`
2. **Color de éxito:** ¿conservar verde `#2C9865` (recomendado, convención clínica) o adoptar el durazno de Stitch? `por validar`
3. **Fuente de datos/lotes:** ¿Inter + `tabular-nums` (una familia menos) o conservar IBM Plex Mono para IDs de lote? `por validar`
4. **Command palette Cmd+K:** ¿construir real en UX-03 o diferir a UX-09? `por validar`
