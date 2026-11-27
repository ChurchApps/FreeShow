# Modern interface

FreeShow ships two layouts. The classic one lives in `MainLayout.svelte` and its
original components. The modern one is a new top bar and panel frame around the
same pages, so shows, slides, the drawer, outputs and settings all keep working.

## Switching

- Press the sparkle button in the top bar (`Classic` or `Modern`, depending on
  the current style).
- Or open Settings, then General, then Interface style.

The choice is saved as the local setting `uiStyle` (`classic` or `modern`) and
is not synced to other devices. `App.svelte` renders `ModernLayout` when the
setting is `modern` and `MainLayout` otherwise. The setting defaults to classic,
so existing installs keep their current layout until someone switches.

## Personality

The modern layout draws on live production language rather than a generic dashboard:

- The top bar carries the FreeShow wordmark in CMGSans, tabs with an accent cue line under the active page, and a broadcast ON AIR pill while presenting.
- The preview has a LIVE or STANDBY strip with a status LED, so output state is readable at a glance.
- The workspace uses a soft accent wash and a 26px dot grid behind the slides.
- Active tabs and rows use channel-strip details: a short accent underline, a small LED, and inset highlights on panels.
- Timings and shortcut chips use a monospace face.

## Files

- `interfaceStyle.ts` (`src/frontend/utils/`): the `uiStyle` helpers. They set
  `data-ui` on `<html>`, which scopes every modern style rule.
- `modern/ModernLayout.svelte`: the panel frame. It reuses `Projects`,
  `Navigation`, `Show`, the editor, the stage, the drawer and the preview.
- `modern/components/ModernSplash.svelte`: the modern start screen shown when
  no show is open.
- `modern/components/ModernTopBar.svelte`: navigation tabs, page context,
  quick search, the present button, profile menu and the style switch.
- `modern/components/ui/`: the shared primitives (`Button`, `Badge`, `Switch`,
  `Kbd`). They follow shadcn conventions: a `variant` and `size` prop, plus a
  class passthrough.
- `public/modern.css`: design tokens and the overrides that restyle existing
  components such as inputs, popups, drawer tabs and slide thumbnails.

## Design tokens

Tokens are derived from the active theme with `color-mix`, so light, dark and
custom themes all work. Changing the theme in Settings updates the modern layout
immediately. The live red, standby amber and success green are semantic colors
and stay fixed, as does the app icon. `modern.css` defines:

- surfaces: `--ui-panel`, `--ui-panel-deep`, `--ui-panel-raised`
- text: `--ui-text`, `--ui-muted`, `--ui-subtle`
- lines and states: `--ui-border`, `--ui-border-strong`, `--ui-hover`,
  `--ui-accent-soft`, `--ui-accent-border`
- shape: `--ui-radius`, `--ui-radius-sm`, `--ui-shadow`, `--ui-shadow-sm`

The accent is the theme's `--secondary`, so branding still follows the theme.

## Adding a component

Use the primitives in `modern/components/ui` and the tokens above instead of
hardcoded colors. Legacy selectors are restyled from `modern.css` under
`html[data-ui="modern"]`, which keeps the classic layout untouched.
