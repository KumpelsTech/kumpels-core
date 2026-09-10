# Kumpels Core 2026

- Este repositorio corresponde a **Kumpels Core 2026**.
- Es un **proyecto nuevo**: no reutiliza ni recupera ningún repositorio o código anterior.
- `reference/kumpels.html` es **referencia visual**, no código productivo.
- **No modificar** `reference/kumpels.html` salvo instrucción explícita.
- Trabajar **incrementalmente**; no implementar funcionalidades no solicitadas.
- Antes de **cambios arquitectónicos importantes**, explicar qué se propone cambiar y por qué.
- Mantener **componentes modulares**, código legible y **TypeScript tipado**.
- **No añadir dependencias innecesarias.**

## Stack
- React + Vite + TypeScript.

## Estructura
- `src/components`, `src/pages`, `src/layouts`, `src/hooks`, `src/services`, `src/types`, `src/utils`, `src/assets`
- `public/` — estáticos servidos tal cual
- `reference/` — referencia visual (prototipo)

## Comandos
- `npm install` — instalar dependencias
- `npm run dev` — servidor de desarrollo (Vite)
- `npm run build` — typecheck (`tsc -b`) + build de producción (Vite)
- `npm run preview` — previsualizar el build
