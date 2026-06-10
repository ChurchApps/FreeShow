# Accessibility plan — operator UI keyboard navigation

Scope/roadmap for finishing the Svelte accessibility work that was deferred during the Svelte 5 migration. This is a **planning doc**, not a spec — it inventories what's left, the fix patterns, the risks, and a phased approach so the work can be done deliberately (with hands-on keyboard/screen-reader testing, which is the part that can't be automated).

## Background

- FreeShow is an operator-driven presentation app. Historically a11y was **not enforced**: the build filters all `a11y_*` warnings via `onwarn` in `vite.config.mjs` and `config/building/vite.config.servers.mjs`, so they never fail a build.
- The Svelte 5 migration (svelte-check 4) surfaces them in `npm run test:svelte` (report-only — not a CI gate).
- A first pass already landed the **zero-risk** fixes (alt text, icon-button `aria-label`, `aria-selected`, `svelte-ignore a11y_autofocus`, and 2 keyboard-completions), taking svelte-check from **144 → 125 a11y warnings**. This doc covers the remaining **~125**, which require per-component judgment + manual QA.

## What's left (125 warnings)

By category:

| Count | Warning | Typical fix |
|---|---|---|
| ~66 | element with a mouse/click/dblclick/drag/etc. handler **must have an ARIA role** | add a role (`button`, `listbox`, …) + make it focusable + keyboard, or convert to a native element |
| 22 | non-interactive element with a click event **must have a keyboard handler** | add `on:keydown` (Enter/Space) |
| 6 | non-interactive element **cannot have a non-negative `tabindex`** | add a role, or set `tabindex={-1}` |
| 5 | **form label not associated** with a control | `for={id}` / `aria-labelledby`, or restructure |
| 3 | non-interactive element **should not have mouse/keyboard listeners** | move the listener to a real control, or add a role |

By component area (where to focus):

| Warnings | Area | Notes |
|---|---|---|
| 27 | `components/inputs` (Material*) | **shared form controls** — high leverage, keyboard a11y clearly wanted, contained |
| 14 | `server/remote` | separate web app (touch/keyboard on user devices) |
| 13 | `components/edit` | editor — `EditboxCropping.svelte` (9) is dense |
| 12 | `components/output` | preview/controls |
| 11 | `components/timeline` | already has custom interactions |
| 10 | `components/system` | `SelectElem.svelte` (6) — the **drag/drop wrapper used app-wide** |
| 9 | `components/main` | |
| 8 | `components/drawer` | |
| 7 | `components/slide` | slide grids — already have arrow-key navigation |

Highest-warning files: `MaterialColorInput` (14), `EditboxCropping` (9), `Timeline` (6), `SelectElem` (6), `TimelineEasing` (5), `SpotifyController` (5), `MaterialDropdown` (5).

## Fix patterns

The codebase already has helpers in `src/frontend/utils/clickable.ts`:
- **`triggerClickOnEnterSpace(event)`** — a `keydown` handler that calls the element's own `.click()` on Enter/Space (reuses the existing `on:click`, no logic duplication). It already guards inputs/textareas/`.slide`.
- **`createKeydownHandler(cb)`** — same guards, calls a custom callback.

Per category:

- **Clickable `<div>`/`<span>` (button-like):** prefer a native `<button>` **only when no CSS depends on the tag** (buttons carry default styling/reset, so this can regress visuals). Otherwise keep the element and add `role="button" tabindex="0" on:keydown={triggerClickOnEnterSpace}` — preserves styling, adds a real tab stop + keyboard activation.
- **Already focusable, missing keyboard:** just add `on:keydown={triggerClickOnEnterSpace}` (no new tab stop). These are the safest.
- **`tabindex` on a non-interactive element:** decide intent — if it's meant to be operable, add a role; if it's just a focus target, `tabindex={-1}`.
- **Form labels:** add `for={id}` when the control has an `id`; the Material floating-label components (`MaterialColorInput`, `MaterialFilePicker`, `MaterialFolderPicker`, `MaterialPopupButton`, `MaterialToggleButtons`) label custom controls — use `aria-labelledby`/`aria-label` on the control, or restructure (note: CSS targets `label`, so don't just swap the tag).
- **Listeners on non-interactive elements:** move the handler to a child `<button>`, or give the element a role if it really is the control.
- **Drag handlers (`dragover`, etc.):** these often aren't "buttons" — pick the semantically correct role (e.g. the element is a drop target) or `aria-*` rather than forcing `role="button"`.
- **i18n:** any `aria-label`/`aria-*` text should go through `translateText(...)` to match the rest of the app (decide this convention up front).

## Risk & testing (the reason this is deliberate, not mechanical)

- **Adding `tabindex` changes tab order.** Across the operator UI this is the biggest behavioral risk — every new tab stop reshuffles keyboard navigation. Each affected screen needs a manual tab-through.
- **Key conflicts:** Enter/Space activation can collide with existing key handling (e.g. text inputs, the slide grid, the timeline). `triggerClickOnEnterSpace` guards inputs/textareas/`.slide`, but timeline/editor interactions need checking.
- **Areas with existing navigation** (slide grid, timeline) may not want per-element tab stops at all — confirm the intended keyboard model before adding them.
- **Automated coverage is thin:** the single Playwright E2E test walks one happy path. It will catch crashes/regressions in that path but **not** keyboard/AT behavior. Real verification is manual: keyboard-only navigation per area, plus ideally a screen-reader pass (VoiceOver / NVDA).

## Phased plan

- **Phase 0 — safe wins (done).** alt/aria-label/aria-selected/autofocus + 2 keyboard-completions. _(this PR)_
- **Phase 1 — shared input components (`components/inputs`, ~27).** Highest leverage, lowest debate (form controls should be keyboard-operable). Fixes here propagate everywhere. Start with `MaterialColorInput` (14) and `MaterialDropdown` (5).
- **Phase 2 — shared interaction wrappers (`SelectElem` + `system`, ~10).** Very high leverage (used app-wide) but **high risk** — a change here affects every list/drag interaction. Careful, with heavy QA.
- **Phase 3 — per-area (`edit`, `output`, `timeline`, `drawer`, `slide`, `main`).** Larger and judgment-heavy; decide the keyboard model for grid/timeline areas first.
- **Phase 4 — server web apps (`server/remote`, `server/stage`, ~19).** A distinct user-facing surface (touch/keyboard on devices); own pass with its own QA.
- **Phase 5 — enforce (policy gate).** If a11y is to be maintained: drop the `a11y_*` `onwarn` filters, get svelte-check a11y to zero, and add it to CI (start non-blocking, then blocking).

## Policy decisions to make first

1. **Do we commit to enforcing a11y?** If yes → Phase 5 (remove the `onwarn` suppression + CI gate). If no → this stays best-effort and the warnings stay suppressed/report-only.
2. **Keyboard model for grid/timeline areas:** per-element tab stops vs. roving-`tabindex`/arrow-key navigation (the latter is usually better UX for grids but more work).
3. **`aria-label` i18n convention** (use `translateText`?).
4. **Scope priority:** operator UI (main window) first; the **output/stage display windows are non-interactive presentations** (lowest priority); the remote/stage **web apps** are their own user-facing surface.

## Non-goals

- The output/stage *projection* windows (read-only display — not operated by keyboard).
- A full WCAG 2.x audit / color-contrast / screen-reader optimization beyond clearing the svelte-check a11y warnings.

## Rough effort

Phase 1 ≈ half a day; Phase 2 ≈ half a day + careful QA; Phase 3 ≈ 1–2 days + QA; Phase 4 ≈ half a day. Plus hands-on keyboard/AT testing throughout. **~3–5 days of deliberate work**, gated on someone able to do the manual testing.
