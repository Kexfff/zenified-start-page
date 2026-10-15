# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Firefox/Zen Browser new-tab extension (Manifest V3, Firefox ≥ 142). Deliberately **no framework, no build step, no dependencies, no minification, no remote code, no analytics** — Mozilla Add-ons reviews the readable source as-is, so keep it that way (no npm packages, no bundler, no third-party icon/font services).

## Commands

```bash
node --test tests/*.test.cjs                          # all regression tests
node --test tests/colors.test.cjs                     # one file
node --test --test-name-pattern "malformed" tests/*.test.cjs   # one test by name
python3 scripts/package.py                            # build dist/zenified-start-page-<version>.zip
```

To try it in a browser, load `manifest.json` via `about:debugging` → "Load Temporary Add-on". Opening `newtab.html` directly also works as a "preview" mode (see storage below), without browser theme/bookmarks/history APIs.

Releasing: bump `version` in `manifest.json` (the package script names the ZIP from it) and the version in README's packaging section. If you add a new shipped file, add it to the `files` list in `scripts/package.py` — the script asserts the archive contains exactly that list.

## Architecture

- **`newtab.html`** — all markup, including the Customize drawer's theme cards (`data-theme-choice`), layout cards (`data-layout-choice`), and dialogs. Loads three stylesheets and `app.js` as a classic script.
- **`app.js`** — the entire app as one plain script of top-level functions and module-level `let` state (no modules/classes). `elements` caches DOM nodes; `state` is the persisted preferences object (`DEFAULT_STATE` shows its shape). `initialize()` loads and normalizes state (validating every field against `THEMES`, `LAYOUTS`, `SEARCH_ENGINES`, etc.), then renders and binds events.
- **Storage**: `webext = globalThis.browser`. Every persistence path branches on `webext?.storage?.local` and falls back to `localStorage` in preview mode — keep both branches when adding persisted data. Preferences live under `zenifiedState`; the background picture is stored separately under `zenifiedBackground` and must never be written into the preferences object.
- **Theming** is driven by attributes on `<html>`: `data-theme`, `data-layout`, `data-custom-colors`, `data-custom-background`, `data-auto-mode`. CSS custom properties (`--bg`, `--accent`, `--accent-rgb`, `--accent-2`, …) are the contract between JS and CSS.
  - `styles.css` — base styles, per-theme palettes (`html[data-theme="x"] { --… }`), layouts, picker preview swatches (`.preview-x`).
  - `theme-styles.css` — per-theme visual language (fonts, radii, shapes) via shared variables like `--control-radius`, `--clock-font`.
  - `decorations.css` — the "flourishes" particle layer, keyed by `data-motif`.
  - The **Auto** theme computes a palette in JS from `browser.theme.getCurrent()` (or system dark/light) and sets inline properties on the root. Custom user colors (`buildColorPalette`) likewise set inline properties listed in `CUSTOM_COLOR_PROPERTIES`; `clearAutoPalette()` removes them. `applyTheme()` reads the theme's default accents back via `getComputedStyle` to support "Reset colors". A `themeApplicationId` counter guards against stale async theme applications.
  - Adding a theme touches: `THEMES` and `DECORATION_THEMES` in `app.js`, a theme card in `newtab.html`, a palette + `.preview-x` in `styles.css`, and style rules in `theme-styles.css`.
- **Security constraints**: CSP is `script-src 'self'` (no inline scripts/handlers). User-supplied colors are normalized to hex before reaching CSS (tests check that malformed values can't inject CSS). Favicons are fetched only from the shortcut's own HTTPS origin.

## Tests

Tests are `node:test` files that read `app.js` as text, strip the literal line `void initialize();`, and run it inside a `vm` context with hand-rolled `document`/`localStorage`/`browser.storage` stubs, then call top-level functions/variables by name via `run('...')`. Consequences:
- Keep `void initialize();` exactly as the last statement of `app.js`.
- Top-level function and variable names used by tests (e.g. `loadState`, `saveState`, `chooseBackground`, `prepareBackground`, `removeBackground`, `backgroundImage`, `state`) are effectively the test API.
- Code that runs at load time (e.g. building `elements`) must tolerate the minimal DOM stubs; new DOM APIs used during tested paths may need stub additions in the harness.
