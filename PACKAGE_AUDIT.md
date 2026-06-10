# FreeShow — Package / Dependency Audit

**Repo:** `/home/user/freeshow` · **Version:** `1.6.2-beta.1` · **Date:** 2026-06-09
**Method:** `npm audit` + `npm outdated` + dependency-tree tracing against the installed tree (493 prod / 744 dev / 92 optional deps).

## Applied fixes (this pass)

The low-risk subset (items 1–4 below) has been applied to `package.json` and verified (electron `tsc` + production `npm run build` both pass):

- **`tmp` → `^0.2.7`** + `overrides.tmp ^0.2.7` — forces every copy (direct, `grandiose`, `electron-builder`) to the patched version. Clears the `tmp` High.
- **`fast-xml-parser` `"5.4.1"` → `"^5.8.0"`** — un-pinned and patched. Clears the `fast-xml-parser` High.
- **`overrides.shell-quote ^1.8.4`** — `shell-quote@1.8.4` (the fix) exists; the dependency ranges were resolving the nested copies to vulnerable `1.6.1`/`1.8.3`. An `overrides` entry forces the patched version across the whole tree, clearing the **entire critical chain** (`shell-quote` / `@generalov/open-in-editor` / `svelte-inspector`).
- **`npm-run-all` → `npm-run-all2@^9.0.1`** — drop-in (same `run-s`/`run-p`/`npm-run-all` bins), replaces the abandoned package with its maintained successor.

### Electron major upgrade (second pass): **37 → 40**

- **`electron` `^37.10.3` → `^40.10.3`** (+ `electron-builder` `^26.15.2`, `electron-updater` `^6.8.9`, `better-sqlite3` `^12.10.0`, `engines.node` `>=22.12.0`). Clears the **electron High** (all ~17 advisories are `≤39.8.4`; 40.10.3 is past that).
- **Why 40, not 42:** Electron 41/42 ship V8 ~14, which removed/changed `v8::External::Value()` / `External::New()`. `better-sqlite3@12.10.0` (latest) still uses the old V8 C++ API and **fails to source-compile** against 41/42 (`electron-builder install-app-deps` → node-gyp error). `better-sqlite3` only ships **prebuilt** binaries up to Electron 40's ABI, so 40 installs cleanly (`buildFromSource=false`). Going higher is blocked on an upstream `better-sqlite3` release that supports V8 14 — a tracked follow-up, not a code change we can force.
- **Verified:** `npm audit` no longer flags electron; electron `tsc` type-check passes (no API breakage in our code vs Electron 40's types); production `npm run build` passes; the app **launches and fully renders** under xvfb (main UI + welcome popup — screenshot captured). The single Playwright E2E test fails only on a **stale selector** for the welcome-popup language picker (`.main .dropdownElem` no longer matches the current markup) — unrelated to Electron, and that test is already disabled in CI.

**Result: 27 → 20 vulnerabilities — all 3 criticals + 4 highs eliminated (incl. electron).** The remaining 6 highs are breaking upgrades still deferred (vite, `@discordjs/opus`→tar, music-metadata, serialize-javascript).

## Vulnerability totals (`npm audit`)

| Scope | Critical | High | Moderate | Low | Total |
|---|---|---|---|---|---|
| **Before any fixes** | 3 | 10 | 14 | 0 | **27** |
| **After low-risk subset** | 0 | 7 | 14 | 0 | **21** |
| **After Electron 37→40** | **0** | **6** | 14 | 0 | **20** |

*(Production-scope subset before any fixes: 0 critical / 7 high / 5 moderate.)*

## Severity-ranked findings (with real fix paths)

### Critical — dev only, no registry fix
- **`shell-quote` 1.6.1 → `@generalov/open-in-editor` → `svelte-inspector`** (`github:vassbo/svelte-inspector#78307db`, devDep). Advisory GHSA-w7jw-789q-3m8p (newline escaping in `quote()`). **No fix** — pinned git fork. Only reachable from the dev inspector, never shipped.

### High — production runtime (these ship to users)
| Package | Path / why | Advisories | Fix |
|---|---|---|---|
| **electron** `37.10.3` | the app runtime & sandbox boundary | ~17 advisories ≤39.8.4 incl. **UAF in offscreen paint / PowerMonitor / permission callbacks** (GHSA-532v-…, GHSA-jjp3-…, GHSA-8337-…) and **renderer command-line-switch injection** (GHSA-9wfr-w7mm-pc7f), IPC reply spoofing, iframe origin confusion, header injection | → `electron@42.4.0` (**5 majors**, breaking — needs native rebuild + regression) |
| **fast-xml-parser** pinned **exact** `5.4.1` | XML import parsing | numeric-entity-expansion DoS bypass (GHSA-8gc5-…), builder comment/CDATA injection | → `5.8.0` (minor; **blocked by the exact pin** — change `"5.4.1"` → `"^5.8.0"`) |
| **tmp** `0.2.5` | path traversal (GHSA-ph9p-34f9-6g65) | **deduped single instance** shared by direct dep + `grandiose` + `electron-builder` | → `0.2.7` (patch) — **safe, see below.** npm reports "no fix" but it is fixable |
| **music-metadata** `7.14.0` | audio metadata (4 majors behind) → `file-type` | ASF-parser infinite-loop DoS (GHSA-v6c2-…) | → `11.13.0` (major) |
| **tar** ≤7.5.10 | via `@discordjs/opus` → `@discordjs/node-pre-gyp` | 6 advisories: hardlink/symlink path-traversal arbitrary write | → downgrade `@discordjs/opus@0.2.1` (**breaking**) |
| **serialize-javascript** `6.0.2` | via `@rollup/plugin-terser@0.4.4` (build) | RCE via `RegExp.flags` (GHSA-5c6j-…) + DoS | → `@rollup/plugin-terser@1.0.0` (major) |
| **grandiose** | NDI native (`github:ChurchApps/grandiose`) | flagged high (pulls the `tmp` issue) | partly fixed by the `tmp` bump |

### Moderate — mostly dev/build
- **vite** `4.5.14` (+ `esbuild` ≤0.24.2): `server.fs.deny` bypass, optimized-deps `.map` path traversal, dev-server request leak, `launch-editor` command injection → `vite@8` (major, drags the whole Svelte-plugin chain).
- **`@googleapis/drive` `8.16.0`** (two majors behind) → vulnerable **`uuid`** (GHSA-w5hq-…) and **`gaxios`/`googleapis-common`** → `@googleapis/drive@20.2.0` (major). `gaxios` alone has a non-major fix.
- **`eslint-plugin-svelte3`** — deprecated/abandoned; no fix.

## The one safe, high-value fix you can take now: `tmp`

`npm ls tmp` shows a **single deduped `tmp@0.2.5`** serving the direct dependency, `grandiose`, and `electron-builder`:

```
+-- electron-builder → … → tmp@0.2.5 deduped
+-- grandiose        → tmp@0.2.5 deduped
`-- tmp@0.2.5   (direct, package.json "^0.2.5")
```

Because they all dedupe to the one root copy and the fixed `0.2.7` satisfies every range, bumping the direct dep `"tmp": "^0.2.5"` → `"^0.2.7"` (and reinstalling) clears the High advisory for all three consumers. This is why `npm audit`'s "no fix available" is misleading here — it's a patch-level bump, not a breaking change.

## Outdated / EOL tooling (not all CVE-driven, but maintenance risk)

| Package | Current | Latest | Note |
|---|---|---|---|
| electron | 37.10.3 | 42.4.0 | 5 majors; security boundary |
| svelte | 3.59.2 | 5.56.3 | 2 majors; whole frontend toolchain frozen to the v3 era |
| typescript | 4.9.5 | 6.0.3 | 2 majors behind |
| eslint | 8.57.1 | 10.4.1 | **v8 is EOL — no security support** |
| @typescript-eslint/* | 5.62.0 | 8.61.0 | 3 majors; tied to old TS/ESLint |
| vite | 4.5.14 | 8.0.16 | 4 majors |
| svelte-check | 2.10.3 | 4.6.0 | 2 majors |
| @googleapis/drive | 8.16.0 | 20.2.0 | 12 majors |
| eslint-plugin-jsdoc | 39.9.1 | 63.0.2 | 24 majors |
| express | 4.22.2 | 5.2.1 | 1 major |

Plus ~30 dependencies that are merely behind within their range (better-sqlite3, axios, socket.io, rollup, prettier, pdfjs-dist, electron-updater, dayjs, …) — a `npm update` sweep pulls these forward safely.

## Supply-chain: git-fork dependencies (no registry integrity, no auto-patching)

`grandiose` (NDI, native), `macadam` (DeckLink, native), `libltc-wrapper` (LTC, native), `slideshow` (native), `svelte-inspector` (dev — carries the **critical** shell-quote chain). Four of five are personal/org forks pinned to a commit; if an account/repo is removed or force-pushed, `npm install` breaks, and none receive npm advisory auto-patching.

Also: **`npm-run-all@4.1.5`** (direct devDep, drives every build script) is effectively unmaintained and pulls **`shell-quote@1.8.3`** (top of the vulnerable range). The maintained drop-in `npm-run-all2` resolves both the staleness and the advisory.

## Reproducibility — lockfile IS committed (earlier claim corrected)

A `package-lock.json` **is committed and tracked**. The `.gitignore` line `# package-lock.json` is a **commented-out (inactive)** entry — an earlier draft of this report misread it as an active ignore rule and wrongly concluded there was "no lockfile." That is corrected here.

The observation that several installed versions sit **below the latest allowed by their range** (e.g. `better-sqlite3` 12.4.6 vs 12.10.0 available, `rollup` 4.59 vs 4.61) is exactly what a working lockfile produces — it pins the resolved tree, so `npm outdated`'s "Wanted" can exceed "Current." That is reproducibility *functioning*, not failing.

The real gaps: `build.yml`/`release.yml` install with `npm install` rather than `npm ci` (release.yml even carries a stale "requires package-lock.json" comment), so CI doesn't install strictly from the lockfile. The new `ci.yml` uses `npm ci`; the other workflows should follow. `npm ci --dry-run` confirms the committed lockfile is in sync with `package.json` after this pass's changes.

## Recommended order of action

1. ✅ **`tmp` → `^0.2.7`** (+ override) — done. Clears a High across all 3 consumers.
2. ✅ **Un-pin `fast-xml-parser`** `"5.4.1"` → `"^5.8.0"` — done. Runtime High cleared.
3. ✅ **`shell-quote` override `^1.8.4`** — done (replaces the planned `gaxios`/sweep item with the higher-value fix that the data revealed). Eliminated all 3 criticals.
4. ✅ **`npm-run-all` → `npm-run-all2`** — done. Replaces the abandoned package; build scripts verified green.
5. ✅ **Electron 37 → 40** — done (clears the electron High). **41/42 are blocked** by `better-sqlite3` not yet supporting Electron's V8 14; revisit when `better-sqlite3` ships a compatible release, then bump to the latest Electron.
6. **Vite 4 → 8 / Svelte 3 → 5 / ESLint 9 / `@discordjs/opus` / `music-metadata`** — the rest of the remaining highs/moderates are major upgrades; plan as coordinated toolchain efforts.
7. **Vendor/mirror the git-fork deps** under the org (`grandiose`, `macadam`, `libltc-wrapper`, `slideshow`, `svelte-inspector`).
8. **Standardize CI on `npm ci`** (the committed lockfile already supports it; `ci.yml` does this — update `build.yml`/`release.yml` and drop the stale "requires package-lock.json" comment).

> Note on `gaxios`/within-range laggards: these are transitive and pinned by their parents, so the right lever is the committed lockfile (bump + commit the lockfile) or `overrides`. This pass used `overrides` for the security-critical pins (`shell-quote`, `tmp`) because it forces a version regardless of nested parent ranges, which `npm update` cannot do for transitive deps.
