# Zenified Start Page

A lightweight Firefox/Zen Browser new-tab extension with no framework, build step, analytics, or remote code.

Requires Firefox 142 or a current Zen Browser release. This baseline supports Mozilla's built-in no-data-collection declaration used by the manifest.

## Features

- Active Zen/Firefox theme palette detection with a system-color fallback
- Auto, AMOLED black, Aurora, and Dawn themes
- Editable shortcuts with direct-from-site favicons and selectable search engines
- Searchable Firefox bookmarks drawer
- 12/24-hour clock, focus timer, and locally saved quick note
- Responsive layout and keyboard shortcuts (`/`, `Ctrl/Cmd+K`, `B`, and `Esc`)

## Widget ideas

Potential additions for a future version:

- **Tab garden:** Surface old tabs worth revisiting.
- **Daily intention:** Keep one small priority front and center.
- **Private weather:** Use a manually selected city without requesting location permission.

## Load it in Firefox or Zen Browser

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `manifest.json` from this folder.
4. Open a new tab.

For a permanent install, package the repository contents as a ZIP and sign it through Mozilla Add-ons.

## Privacy

The extension does not collect or transmit data for analytics or external processing. Shortcuts, preferences, notes, and timer state use Firefox extension storage. Bookmark access is used only to render the local bookmarks drawer. Shortcut favicons are requested directly from the shortcut's own HTTPS site, never from a third-party icon service. Search text is sent only to the selected search provider after submission.
