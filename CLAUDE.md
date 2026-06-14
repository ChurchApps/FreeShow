# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FreeShow is a free, open-source presentation program (song lyrics, scripture, media, stage display, remote control) built as an **Electron desktop app** with a **Svelte 3 + TypeScript** renderer. It also ships several **web companion apps** (Remote, Stage, Controller, Output Stream) served over HTTP/Socket.IO from the desktop app.

## Commands

All tooling configs live under `config/` (non-default locations), so commands must pass explicit `--config`/`-c` paths. Always run via the npm scripts rather than invoking the tools directly.

```bash
npm start              # Full dev environment (see "Dev startup flow" below)
npm run build          # Production build: frontend → servers → electron

npm test               # Full check: unit (vitest) + playwright + format check + svelte-check
npm run test:unit         # Vitest unit tests (config/testing/vitest.config.ts; src/**/*.test.ts)
npm run test:playwright   # E2E smoke test (launches the Electron app)
npm run test:svelte       # Type-check Svelte/TS via svelte-check
npm run test:format       # Prettier check (does not modify files)

npm run lint           # ESLint (electron + frontend + svelte) AND stylelint; all --fix
npm run format:prettier   # Apply Prettier formatting to src + scripts
```

Run a single Playwright test: `npx playwright test --config config/testing/playwright.config.ts -g "<test name>"`.
Run a single Vitest file: `npx vitest run --config config/testing/vitest.config.ts <path/to/file.test.ts>`.

Testing is two layers: **one E2E test** (`config/testing/start.test.ts`) that boots the app, plus **Vitest unit tests** colocated as `src/**/*.test.ts`. Unit tests target pure, dependency-light logic (importing UI files that pull in `stores.ts`/IPC won't load under the `node` test environment) — e.g. `src/frontend/utils/expression.ts`, `src/frontend/components/helpers/color.ts`, `src/common/scripture/sanitizeVerseText.ts`, `src/electron/cloud/syncLedger.ts`. "Tests" in this repo means: unit tests pass, it launches, it type-checks, and it's formatted.

**Prerequisites:** Node.js ≥ 22.12, Python 3 + `setuptools` (3.12, but 3.11 on macOS), and platform C/C++ build tools. On Linux: `sudo apt-get install libfontconfig1-dev uuid-dev libltc-dev`. Several dependencies are native (`better-sqlite3`, `@discordjs/opus`, `grandiose` for NDI, `macadam` for Blackmagic, `libltc-wrapper`), so `npm install` compiles native code (via `electron-builder install-app-deps`). Full per-platform build/test/packaging instructions are in **`BUILDING.md`**.

## Architecture

### Four source areas (`src/`)

- **`electron/`** — Electron **main process** (Node side). Entry: `index.ts`. Owns windows, the menu, data persistence, and all OS/hardware integrations: `data/` (save/load, import/export, backup, thumbnails), `output/` (projector/output windows via `OutputHelper`), `contentProviders/` (Planning Center, Canva, ChurchApps, etc.), `cloud/` (Drive + ChurchApps sync), `audio/`, `ndi/`, `blackmagic/`, `capture/`, `webrtc/`, `timecode/`. `servers.ts` hosts the web companion apps.
- **`frontend/`** — Svelte **renderer** (the UI). Entry: `main.ts` → `App.svelte`. `stores.ts` holds nearly all global app state as Svelte `writable` stores — this is the central state container; read it first when tracing UI state. `converters/` handles import/export format parsing (ProPresenter, OpenLP, PowerPoint, many Bible formats). `classes/Show.ts` (`ShowObj`) is the show data model.
- **`server/`** — The web companion apps (`remote/`, `stage/`, `controller/`, `output_stream/`, `cam/`). Each is built into a standalone bundle and served by `electron/servers.ts`.
- **`common/`** — Small amount of code shared between processes.
- **`types/`** — Shared TypeScript types and the IPC channel/payload contracts (`Channels.ts`, `IPC/`).

### Two ways processes talk

**1. Renderer ↔ Electron main (IPC).** Typed and split by direction:
- `Main` channels = frontend → electron requests. `ToMain` channels = electron → frontend messages. Both defined in `types/IPC/`.
- Frontend side: `src/frontend/IPC/main.ts` exposes `requestMain` (await a response), `sendMain`, `sendMainMultiple`; handlers for incoming `ToMain` live in `responsesMain.ts`. Requests use a generated listener ID and time out (default 15s).
- Electron side: `src/electron/IPC/main.ts` exposes `sendMain`/`sendToMain`/`requestToMain`; channel handlers are registered in `electron/IPC/responsesMain.ts`. Top-level channels (`MAIN`, `OUTPUT`, `EXPORT`, `CLOUD`, `NDI`, `BLACKMAGIC`, `AUDIO`, …) are in `types/Channels.ts`.
- Adding an IPC call means touching both the `types/IPC` contract and the `responsesMain.ts` on the receiving side.

**2. Renderer ↔ web companion apps (Socket.IO).** The companion servers run on fixed ports (REMOTE 5510, STAGE 5511, CONTROLLER 5512, OUTPUT_STREAM 5513). The renderer dispatches/handles these via `frontend/utils/sendData.ts`, `receivers.ts`, and the per-client `remoteTalk.ts` / `stageTalk.ts` / `controllerTalk.ts`.

### Multi-window model

The **same Svelte bundle** runs the main window AND every output/projector window. The `currentWindow` store (`null` for main, `"output"`, `"pdf"`) distinguishes them; `App.svelte` branches into `MainLayout.svelte` vs `MainOutput.svelte` based on it. Output windows are created as separate `BrowserWindow`s managed by `electron/output/OutputHelper`.

### Data & history

- Shows are stored as individual `.show` JSON files in a user data folder; app settings go through `electron-store`. Save logic: `electron/data/save.ts`.
- The undo/redo system lives in `frontend/components/helpers/history.ts` (+ `historyActions.ts`, `historyStores.ts`); history entry types are in `types/History.ts`. UI mutations generally go through history rather than mutating stores directly.

### Dev startup flow (`scripts/start.js`)

`npm start` is orchestrated by Node, not a single bundler: it frees port 3000, runs `scripts/preBuild.js`, builds the server bundles (`scripts/vite/createServerFiles.js`), then concurrently runs Vite (renderer on port 3000), a server watcher, and `tsc -w` + Electron. Frontend in dev is served from `public/`; production Vite emits an IIFE `public/build/bundle.js`. Electron TS compiles to `build/`.

## Conventions

Formatting is enforced by Prettier (`config/formatting/.prettierrc.yaml`) and matched in `.vscode/settings.json`:
- **4-space indent, no semicolons, double quotes, no trailing commas, `printWidth: 500`** (lines are intentionally not wrapped).
- TypeScript: imports use **non-relative** module specifiers and **prefer `import type`** (`consistent-type-imports`). Avoid boxed primitive types (`String`, `Number`, …).
- ESLint configs are split per area (`config/linting/eslint.electron.json`, `eslint.frontend.json`, `eslint.svelte.js`) plus stylelint for CSS/SCSS/Svelte. The `lint` scripts auto-fix.

CI builds with Node 22 (`.github/workflows/build.yml`); Playwright CI uses Node 20.
