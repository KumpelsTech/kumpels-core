---
name: Clinical Precision OS
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e6'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2ff'
  surface-container: '#eeecfa'
  surface-container-high: '#e8e7f5'
  surface-container-highest: '#e2e1ef'
  on-surface: '#1a1b24'
  on-surface-variant: '#444656'
  inverse-surface: '#2f303a'
  inverse-on-surface: '#f1effd'
  outline: '#747688'
  outline-variant: '#c4c5d9'
  surface-tint: '#1f44f9'
  primary: '#002fda'
  on-primary: '#ffffff'
  primary-container: '#274afe'
  on-primary-container: '#dbdeff'
  inverse-primary: '#bbc3ff'
  secondary: '#4a58a9'
  on-secondary: '#ffffff'
  secondary-container: '#9aa8ff'
  on-secondary-container: '#2b3a8a'
  tertiary: '#961600'
  on-tertiary: '#ffffff'
  tertiary-container: '#bd2b10'
  on-tertiary-container: '#ffd8d0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dee0ff'
  primary-fixed-dim: '#bbc3ff'
  on-primary-fixed: '#000f5d'
  on-primary-fixed-variant: '#002cce'
  secondary-fixed: '#dee0ff'
  secondary-fixed-dim: '#bac3ff'
  on-secondary-fixed: '#00105c'
  on-secondary-fixed-variant: '#313f90'
  tertiary-fixed: '#ffdad3'
  tertiary-fixed-dim: '#ffb4a5'
  on-tertiary-fixed: '#3e0400'
  on-tertiary-fixed-variant: '#8e1400'
  background: '#fbf8ff'
  on-background: '#1a1b24'
  surface-variant: '#e2e1ef'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-acuity, ergonomic operating environment engineered specifically for clinical operations, compounding workflows (*Central de Mezclas*), and medication-intensive therapeutics.

The visual narrative rejects sterile, dated hospital software in favor of **Vibrant Clinical Precision**: an aesthetic convergence of aerospace telemetry discipline and high-contrast, energetic contemporary software design. The interface instills unyielding calm, high trust, absolute accuracy, and low cognitive fatigue across 12-hour multidisciplinary clinical shifts.

### Design Tone & Audience
- **Target Audience:** Onco-pharmacists, compounding specialists (*químicos farmacobiólogos*), infusion nurses, clinical directors, and operations leads interacting in Spanish-language environments.
- **Emotional Response:** Surgical control, cognitive clarity, effortless precision, and zero ambiguity under time-sensitive patient demands.
- **Visual Movement:** Contemporary Clinical Modernism. Characterized by high-density tabular ergonomics, crisp structural contrast, hairline delineation, and luminous electric accents reserved strictly for synthetic intelligence (*Kumpels AI*) and critical status signals.

## Colors

The color architecture relies on high-contrast, non-glare functional hierarchy. Chromatic saturation is strictly functional, never decorative.

### Palette Architecture
- **Primary (Vibrant Clinical Blue - `#274AFE`):** Anchors navigation anchors, primary action primitives, foundational headings, and master state indicators.
- **Secondary / AI (Slate Blue - `#6371C4`):** Reserved for high-emphasis operational framing, ambient intelligence structures, and commanding focus states.
- **Tertiary / Warning & Accent (Crimson Red - `#A61900`):** Applied to stability limit thresholds, active verification alerts, and distinct operational highlights.
- **Neutral Core (`#767682`):** Provides structured guidance across outlines, typography, and functional container borders.
- **Canvas & Surface Architecture:** Base canvas utilizes ultra-clean slate neutrals to eliminate glare. Cards and modals rest on `#FFFFFF`, while tiered nested containers use hairline dividers.

## Typography

Typography balances clinical authority with high-speed scannability. Two type families divide macro-structure and operational telemetry:

- **Primary Display & Headings:** `Plus Jakarta Sans` provides geometric clarity, open counters, and human approachability for section titles, patient banner identifiers, and modality indicators.
- **Operational Data & Body:** `Inter` handles high-density body content, instructions, form elements, and messages.
- **Tabular Numerals Enforcement:** All numerical data—milligrams, infusion flow rates (`mL/h`), lot identification strings, expiry timestamps, and cleanroom air pressure metrics—must employ tabular numerals (`tnum`) to maintain vertical alignment in tables, production lines, and charts.
- **Language Adaptations (Spanish UI):** Line heights account for gendered agreement words, extended compounding nomenclature (*e.g., 'Reconstitución y Dilución de Citostáticos'*), and diacritical accents (á, é, í, ó, ú, ñ) without clipping.

## Layout & Spacing

The layout model optimizes screen real estate for complex workflows while maintaining strict structural boundaries.

### Layout Model
- **Role-Aware Dual Navigation:** A condensed persistent left navigation bar (64px collapsed, 240px expanded) paired with a high-utility 56px global Top Command Bar.
- **Fluid Multi-Tier Workspace:** Main content relies on a 12-column adaptive fluid grid with a 16px (`1rem`) gutter standard. In data-dense pipeline zones (such as *Central de Mezclas*), the layout tightens to `gutter-compact` (8px).
- **Responsive Adaptations:**
  - **Desktop (≥ 1280px):** Simultaneous triple-pane operations: active batch stream, central recipe verification, and context drawers.
  - **Tablet Landscape / COW (Computer on Wheels, 1024px – 1279px):** Split-view layouts with collapsible telemetry trays.
  - **Mobile / Handheld Scanner (≤ 768px):** Linear stacked workflows. Side drawers transition to full-screen modals. Horizontal patient journeys convert into sticky step indicators.

## Elevation & Depth

To minimize visual fatigue in brightly lit pharmacy and cleanroom environments, elevation relies on crisp structural containment and minimal blur shadows rather than deep physical drop shadows.

### Depth Strategy
- **Layer 0 (Canvas Bedrock):** Base workspace backdrop.
- **Layer 1 (Card & Section Surfaces):** `#FFFFFF` paired with an ultra-subtle border stroke. No blur shadows on resting states.
- **Layer 2 (Interactive Floating Modules & Dropdowns):** Subtle ambient tint and diffused drop shadows.
- **Layer 3 (Overlays & Slide-Over Drawers):** High-elevation sheets accompanied by a backdrop scrim.
- **Layer AI (Intelligent Diagnostics):** Vibrant perimeter glows demarcating automated calculations or AI-assisted verifications.

## Shapes

The interface embraces a precise, clean-cut aesthetic. Roundedness level `1` (Soft) is chosen to maximize usable screen real estate, preserve sharp data demarcations, and deliver an uncompromising enterprise feel.

### Geometric Discipline
- **Micro Elements (Tags, Badges, Tabular Pills):** 4px (`0.25rem`) corner radius.
- **Standard Controls (Inputs, Buttons, Segmented Selectors):** 6px (`0.375rem`) corner radius.
- **Macro Containers (Cards, Pipeline Stages, Drawers, Modals):** 8px (`0.5rem`) to 10px (`0.625rem`) corner radius.
- **Pill Exceptions:** Restricted strictly to active presence indicators.

## Components

### 1. Global Top Command Bar & AI Trigger
- **Structure:** 56px fixed utility bar featuring search with global hotkey support (`Cmd/Ctrl + K`), role switcher (*Oncología / Mezclas / Enfermería*), and persistent telemetry metrics.
- **Kumpels AI Trigger:** High-contrast pill with primary fill and active focus aura. Clicking or pressing `Shift + Space` opens an inline prompt.

### 2. Patient Journey Indicator (Horizontal)
- Sequential pathway tracker illustrating: *Prescripción → Validación Clínica → Preparación Central → Liberación CQ → Administración*.

### 3. Pipeline Cards (Central de Mezclas)
- High-density Kanban modules with lot ID, patient codename, protocol title, and active cleanroom station assignment.

### 4. Lot Genealogy Tree Node
- Structured hierarchical card linked with hairline anchor rails. Displays parent lot, raw Active Pharmaceutical Ingredient (API), reconstitution lot, reconstitution timestamp, and signature fingerprint of the executing technician.

### 5. WhatsApp-Style Clinical Communications
- Internal asynchronous message strip tailored for handoffs and urgent clarification of physician orders.

### 6. Contextual Slide-Over Drawers (Low-Click Ergonomics)
- Right-aligned sheet anchored without losing context of the underlying board.

### 7. Core Inputs & Selection Primitives
- **Buttons:** Primary buttons use `#274AFE` with white typography. Critical actions use standard high-contrast destructive styling. Subtle haptic-feel active state depression (-1px transform).
- **Form Fields:** Inset 1px neutral borders shifting to `#274AFE` focus ring with a 2px offset. Monospace support for batch lot entry.
- **Status Chips:** Flat, high-contrast background containers with clear foreground text matching semantic intent.
