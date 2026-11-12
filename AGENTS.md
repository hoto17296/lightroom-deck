# AGENTS.md

## What this app is

**Lightroom Deck** (`lightroom-deck`) is a browser UI for adjusting Adobe Lightroom (desktop, "Lightroom CC", tested with 9.6) develop sliders by keyboard and mouse wheel. The browser connects **directly** to Lightroom's External Controller WebSocket API (`ws://localhost:7682`, override with `VITE_LIGHTROOM_WS_URL`). There is no backend.

Stack: React 19 + TypeScript + Vite, Bun as package manager/runtime, CSS Modules, oxlint/oxfmt.

## Commands

- `bun install`
- `bunx vite --host`: dev server (VS Code task "Start dev server").
- `bun test`: unit tests (`src/**/*.test.ts`, Bun's built-in runner; type-checked via `tsconfig.test.json`).
- `bunx tsc -b`: type-check everything. `bun run build`: type-check and build.
- `bunx oxlint src`

## Source map

| File | Role |
|---|---|
| `src/lightroom.ts` | `LightroomClient`: WebSocket, `register` (pairing), request/response matching by `requestId`, `getValue`, `adjust` |
| `src/useLightroom.ts` | Hook: connect/disconnect, 1 s polling of all params (paused while the tab is hidden), write path (`setValue`, `nudge`) |
| `src/sync.ts` | Pure write algorithm: move a value to a target with relative `increment`/`decrement` calls, learning the amount ratio |
| `src/navigation.ts` | Pure arrow-key focus movement over the column layout |
| `src/params.ts` | **Slider definitions** (API key, labels, column, range, step, default, display format, track gradient) and the Temperature→Kelvin table |
| `src/ParamGrid.tsx` | 3-column grid, focus handling, keyboard and wheel input |
| `src/Slider.tsx` | Presentational slider (styled `<input type="range">`) |
| `src/i18n.ts` | Language detection (`ja` if the browser language starts with `ja`, else `en`) and UI strings |
| `src/App.tsx` | Header, intro screen, screen switching |

Keep logic that needs tests in pure modules like `sync.ts` and `navigation.ts`; the React components and the hook stay thin and are not unit-tested.

To add a slider, add an entry to `PARAMS` in `src/params.ts`. Check the parameter first, as described under "Probing safely" below.

## UI spec

- Dark, Lightroom-like theme. Color tokens are on `:root` in `src/App.module.css` (`--bg #1c1c1c`, header/slider surface `#2d2d2d`, accent blue `#378ef0`).
- Header: app name on the left; Connect / Disconnect button on the right.
- Before connecting: intro, how-to and a disclaimer saying the app is not affiliated with Adobe (`Intro` in `App.tsx`; the intro and how-to are placeholder copy for now). Keep the disclaimer.
- Connected, but no photo open (all values `null`): show a "not in edit mode" message.
- Connected, photo open: sliders in 3 logical columns, each slider its own block. The layout is responsive (fewer columns on narrow screens, never horizontal scroll).
  - Col 1: Exposure, Contrast, Highlights, Shadows, Whites, Blacks
  - Col 2: Temp, Tint, Vibrance, Saturation, Dehaze, Vignette
  - Col 3: Straighten
- Focus: one slider is "focused" (lighter background, blue left bar, blue thumb).
  - Mouse hover focuses a slider.
  - Up/Down move through the slider list in order, continuing into the next column. Left/Right jump to the same row in the adjacent column.
- Changing values: `+`/`=` and `-`/`_` keys, or the mouse wheel over a slider (wheel down = increase; page scrolling is suppressed). Dragging also works.
- Double-click or `Esc` (on the focused slider) resets to `defaultValue`. Temperature has no reset (see protocol notes).
- Slider labels follow the Japanese Lightroom UI wording (`ja`) and the English Lightroom UI wording (`en`). "Straighten" is unverified.

## Lightroom External Controller API notes (found by experiment, not documented by Adobe)

- Request: `{ requestId, object: null, params: [...], message }`. Response: `{ requestId, success, response }`. You must send `register` first with `[appName, version, clientGuid]`; the user clicks "Pair" in Lightroom.
- `getValue [param]` → `[number]`. It returns `{}` (no error) when no single photo is open for editing. Only one param per request.
- `getRange [param]` → `[min, max, ...]`. `getDefault [param]` → generic default.
- `increment` / `decrement` `[param, amount]`. For most params, `amount` equals the change in value. For **Temperature** (and probably Tint), `amount` 10 moved the value by only 0.1. `useLightroom` learns this ratio at runtime (`amountScale` is the initial guess). There is no known absolute `setValue`.
- Navigation and utility actions use `params: [null]`, e.g. `undo`, `redo`, `nextPhoto`.
- Lightroom does **not** push change events. Polling is the only way to follow edits made in Lightroom.
- Temperature and Tint use API range 0–100.
  - Tint display = `(v - 50) * 3`.
  - Temperature → Kelvin is piecewise linear, measured: 0→2000, 50→7000, 62→8500, 69.5→10000, 79.5→15000, 85→20000, 100→50000.
  - `getDefault` and `resetToDefault` use 50 (7000 K), **not** the photo's as-shot value, so there is no way to get or restore the photo-specific default.
- Crop params (`cropTop`, …) reportedly ignore increment/decrement. `straightenAngle` works (−45…45).

## Probing safely

To experiment with the API, write a short Bun script that uses the built-in `WebSocket`. It should `register` first and then send messages. Lightroom runs on the host, so from inside the dev container connect to `ws://host.docker.internal:7682`, not `localhost`. Each new pairing may show a "Pair" dialog that the user must click.

- Read-only messages (`getValue`, `getRange`, `getDefault`) are safe.
- Anything else edits the user's open photo. Ask before sending it, and restore the photo afterwards. Be careful with `undo`: one `undo` may revert more than one API change.
