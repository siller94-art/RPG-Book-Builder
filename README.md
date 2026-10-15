# RPG Book Builder

A local-first desktop publishing tool for tabletop RPG books, inspired by the ease of Homebrewery and GM Binder.

## Features

- Visual page editor with live print preview
- Homebrewery-style source mode with live preview
- Artwork import with drag and drop
- Monster, NPC, spell, item and other statblocks
- Multi-column RPG book layouts and themes
- Autosave with recovery snapshots, plus undo and redo
- Editable project files (`.json`, and legacy `.rpgbook`)
- PDF export, plus Word, text, JSON and Foundry VTT exports
- World, character, item and spell builders
- Companion Foundry VTT module (see `foundry-module/`)

## Download

Installers for Windows (`.exe`) and macOS (`.dmg`, Apple silicon) are attached to each
release on the [Releases page](https://github.com/siller94-art/RPG-Book-Builder/releases).

The macOS build is not yet notarized by Apple, so macOS blocks it the first time you open it.
Go to **System Settings > Privacy & Security** and click **Open Anyway**.

## Stack

- Tauri 2 desktop shell
- React + TypeScript, built with Vite
- HTML/CSS page renderer, jsPDF and html2canvas for PDF export
- Local-first project storage

## Development

```bash
npm install
npm run tauri dev     # run the desktop app
npm test              # automated tests
npm run build         # type-check and production web build
```

See [docs/DESKTOP.md](docs/DESKTOP.md) for building installers.

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
