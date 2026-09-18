# Stitch reference assets

Fetched from Stitch project `projects/5126776700977399055` ("Kumpels Core Clinical OS") on 2026-09-16.
These are visual/HTML references only — not production code. See `reference/kumpels.html` note in the
project root CLAUDE.md: the same rule applies here (reference, not to be wired up directly).

## Screens

| Folder | Screen title | Screen ID |
| --- | --- | --- |
| `comunicaciones-clinicas/` | Kumpels Core · Comunicaciones Clínicas | `97710c26c4c744288934651b6f360c3d` |
| `central-de-mezclas/` | Kumpels Core · Central de Mezclas & Lotes | `88d62ee35778469bb8d6103478d5efbe` |
| `hoy-workspace-clinico/` | Kumpels Core · Hoy (Workspace Clínico) | `50a8a9f54f104606be9e9c55dfe793b0` |
| `paciente-360-journey/` | Kumpels Core · Paciente 360 & Journey | `9bf52193269b45828f554da1b22ebeb5` |

Each folder contains:
- `screen.html` — Stitch-generated static HTML for the screen
- `screenshot.png` — Stitch-generated screenshot preview

## Design system

`design-system/` — asset `assets/d467daffdee0495f939adbd618918caa` (v3), display name "Clinical Precision OS".

- `DESIGN.md` — full design tokens (YAML front matter) + style guidelines in Stitch's DESIGN.md format
- `theme.json` — raw theme/token values (colors, typography, spacing, roundness) as returned by the Stitch API
