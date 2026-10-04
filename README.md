# RPG Book Builder

A local-first desktop publishing tool for tabletop RPG books, inspired by the ease of Homebrewery and GM Binder.

## Goals

- Visual page editor with live print preview
- Drag-and-drop images and page artwork
- Reusable monster, NPC, spell, item, vehicle, trap, encounter, and custom statblocks
- Multi-column RPG book layouts and themes
- Local project files with autosave
- PDF export with print, normal, small-file, and highly compressed presets
- Windows, macOS, and Linux desktop builds

## Planned stack

- Tauri
- React + TypeScript
- HTML/CSS page renderer
- Local-first project storage

## Status

Project initialization is underway. The first milestone is a usable editor shell with pages, text, images, statblocks, save/open, undo/redo, and PDF export.
<!-- Foundry v14 final validation: 2026-09-24 -->


## macOS / Xcode toolchain testing

RPG Book Builder remains a Tauri desktop application. Xcode supplies the Apple compiler and macOS SDK; the desktop target does not use a separate generated Xcode project.

On a Mac with Xcode installed:

```bash
npm install
npm run mac:xcode:check
npm run mac:app
```

- `mac:xcode:check` verifies Xcode and the active macOS SDK, then runs the automated tests and production web build.
- `mac:app` performs those checks and builds the actual macOS `.app` bundle.
- `mac:dmg` performs the same checks and builds the DMG installer.
- GitHub Actions also runs **Xcode macOS Validation** and uploads the resulting app bundle as `xcode-macos-app`.

The macOS deployment target is 10.15. Use Xcode's developer tools for SDK/compiler diagnostics; use the generated Tauri app bundle to test the actual desktop UI.
