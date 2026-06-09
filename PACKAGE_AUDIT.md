# FreeShow — Package / Dependency Audit

**Repo:** `/home/user/freeshow` · **Version:** `1.6.2-beta.1` · **Date:** 2026-06-09
**Method:** `npm audit` + `npm outdated` + dependency-tree tracing against the installed tree (493 prod / 744 dev / 92 optional deps). No package was changed.

## Vulnerability totals (`npm audit`)

| Scope | Critical | High | Moderate | Low | Total |
|---|---|---|---|---|---|
| **Production** (`--omit=dev`) | 0 | 7 | 5 | 0 | **12** |
| **Full** (incl. dev) | 3 | 10 | 14 | 0 | **27** |

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

## Reproducibility — now demonstrated

`package-lock.json` is git-ignored (documented workaround for the `@rollup/rollup-x-gnu` npm bug). This audit's fresh install resolved several dependencies to versions **older than their ranges now allow** (e.g. `better-sqlite3` 12.4.6 installed vs 12.10.0 available, `electron-builder` 26.8.1 vs 26.15.2, `rollup` 4.59 vs 4.61) — concrete evidence that two installs of the same `package.json` do not produce the same tree. Without a committed lockfile there is no `npm ci`, no Dependabot, and no reproducible builds. (Commit decision is the maintainer's — see note in `AUDIT.md`.)

## Recommended order of action

1. **`tmp` → `^0.2.7`** — safe patch, clears a High for 3 consumers. *(I can apply this now.)*
2. **Un-pin `fast-xml-parser`** `"5.4.1"` → `"^5.8.0"` — minor, runtime High.
3. **`gaxios`** non-major fix + `npm update` sweep for the ~30 within-range laggards.
4. **`npm-run-all` → `npm-run-all2`** — clears a dev High and de-risks the build scripts.
5. **Electron 37 → 42** — highest-value but breaking: schedule with native-module rebuild + a Playwright/manual regression pass.
6. **Vendor/mirror the git-fork deps** under the org; plan the Svelte 3→5 / Vite / ESLint-9 toolchain upgrade as one coordinated effort.
7. **Commit a lockfile** (maintainer decision) to make all of the above reproducible and Dependabot-trackable.
