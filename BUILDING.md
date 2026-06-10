# Building & Testing FreeShow

FreeShow is an **Electron** desktop app with a **Svelte + TypeScript** renderer, plus several **web companion apps** (Remote, Stage, Controller, Output Stream) built and served from the desktop app. The build compiles native modules (`better-sqlite3`, `@discordjs/opus`, `grandiose` (NDI), `macadam` (Blackmagic), `libltc-wrapper` (LTC timecode), `slideshow`), so each platform needs a working C/C++ toolchain and Python.

This guide covers **Linux**, **macOS**, and **Windows 10/11**. The per-platform requirements here are kept in sync with the CI workflows in `.github/workflows/` (the source of truth).

---

## 1. Common prerequisites (all platforms)

- **Git**
- **Node.js ≥ 22.12** — the project's `engines` field and `.nvmrc` pin Node 22 (CI uses Node 22). If you use `nvm`, run `nvm use` in the repo root.
- **Python 3** + the `setuptools` package — required by `node-gyp` to build native modules. Use **Python 3.12** on Linux/Windows; on **macOS use Python 3.11** (see the macOS note below).

After the platform-specific setup below:

```bash
npm install      # installs deps AND compiles native modules (via electron-builder install-app-deps)
npm start        # launches the full dev environment
```

> `npm install` is what compiles the native modules, so it will fail if the platform toolchain below isn't installed.

---

## 2. Platform setup

### Linux (Debian / Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 python3-setuptools \
    libfontconfig1-dev uuid-dev libltc-dev
```

- `build-essential` + `python3` provide the C/C++ toolchain for `node-gyp`.
- `libfontconfig1-dev`, `uuid-dev`, and `libltc-dev` are required by the native modules (NDI / LTC timecode). **Note:** the older README mentioned only `libfontconfig1-dev`; a full build needs all three.
- To **run the E2E test** headlessly you also need `xvfb` (see [Testing](#5-testing)):
  ```bash
  sudo apt-get install -y xvfb
  ```

### macOS

- **Xcode Command Line Tools:** `xcode-select --install`
- **Python 3.11** — node-gyp currently has an issue with newer Python on macOS ([nodejs/node-gyp#2869](https://github.com/nodejs/node-gyp/issues/2869)), so CI pins 3.11. Install via `pyenv` or python.org and ensure it's the active `python3`.
- For building a `.dmg`, electron-builder needs `dmg-license` (CI installs it explicitly):
  ```bash
  npm i dmg-license
  ```

### Windows 10 / 11

- **Visual Studio** (or Build Tools) with the **"Desktop development with C++"** workload, including the **Windows 10/11 SDK**. Download: <https://visualstudio.microsoft.com/downloads/>
- **Python 3.12** + `setuptools`.

> Both Windows 10 and 11 use the same toolchain/SDK — no separate steps.

---

## 3. Development

```bash
npm start
```

This orchestrates the dev environment (see `scripts/start.js`): frees port 3000, pre-builds, builds the server bundles, then runs Vite (renderer on `http://127.0.0.1:3000`), a server watcher, and `tsc -w` + Electron concurrently.

---

## 4. Production build

```bash
npm run build
```

Builds in order: frontend (Vite → `public/build/bundle.js`) → web companion apps (Vite, per-server) → Electron main process (`tsc` → `build/`). This is the gate the PR CI (`ci.yml`) enforces.

---

## 5. Testing

```bash
npm test            # full check: playwright (E2E) + prettier (format) + svelte-check (types)
```

Individual checks:

```bash
npm run test:playwright   # E2E smoke test — boots the packaged app (see note below)
npm run test:svelte       # type-check Svelte/TS via svelte-check
npm run test:format       # Prettier check (does not modify files)
```

There is essentially **one E2E test** (`config/testing/start.test.ts`) that launches the app and walks a basic flow; there is no unit-test framework. "Tests passing" means: it builds, it type-checks, and it's formatted.

**Running the E2E test:**

```bash
# 1) build first (the E2E launches the production app)
npm run build
# 2) install the Playwright browser once
npx playwright install --with-deps
# 3a) macOS / Windows:
npm run test:playwright
# 3b) Linux (headless — needs xvfb):
xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" -- npm run test:playwright
```

---

## 6. Linting & formatting

```bash
npm run lint              # ESLint (flat config) --fix + stylelint
npm run format:prettier   # apply Prettier to src + scripts
```

Configs live under `config/` (non-default locations); the npm scripts pass the correct `--config` paths, so always run via npm rather than invoking the tools directly.

---

## 7. Packaging & release

Local, unpublished package (handy for testing installers):

```bash
npm run pack              # electron-builder --dir (unpacked build, no publish)
```

Publishing builds (used by the `release.yml` CI on push to `main`):

```bash
npm run release           # current platform (Windows / Linux x64 / macOS)
npm run release:arm64     # Linux arm64 (also needs FPM: ruby + `gem install fpm`)
npm run release:32bit     # Windows ia32
```

electron-builder configs are in `config/building/` (`electron-builder.yaml`, `electron-builder-lnxarm.yaml`). Code-signing/notarization is configured via environment variables in CI:

- **Windows:** `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
- **macOS:** `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

(You don't need these for `npm run pack` or a local unsigned build.)

---

## 8. Notes & gotchas

- **Native modules rebuild on every install.** `postinstall` runs `electron-builder install-app-deps`, which rebuilds the native modules against Electron's ABI — so a missing platform toolchain (section 2) is the most common cause of a failed `npm install`.
- **macOS Python:** use 3.11, not 3.12 (node-gyp issue above).
- **Linux arm64 release** additionally needs FPM: `sudo apt-get install ruby ruby-dev build-essential && sudo gem install --no-document fpm`, and runs with `USE_SYSTEM_FPM=true`.
- **No committed lockfile:** CI uses `npm install` (not `npm ci`) — installs aren't fully reproducible.
- **CI reference:** `.github/workflows/build.yml` (build matrix), `release.yml` (per-platform publish), `playwright.yml` (E2E), `ci.yml` (PR checks). If anything here drifts, those files are authoritative.
