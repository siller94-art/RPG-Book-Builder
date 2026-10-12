# Desktop builds

RPG Book Builder uses Tauri 2 so the React/TypeScript app can ship from one codebase on Windows and macOS.

## Development

Install Node.js, Rust and platform prerequisites, then run npm install and npm run desktop:dev.

## Windows

Run npm run build:windows on Windows to create the NSIS .exe installer.

## macOS

Run npm run build:macos on a Mac to create the .dmg. Public distribution should be signed and notarized with Apple credentials.

## Releases

The GitHub Actions release workflow runs tests and creates Windows NSIS and macOS DMG bundles for version tags.

## CI trigger

Desktop CI runs on pushes to `main` and `build/editor-mvp`, on pull requests to `main`, and on manual dispatch. Windows and macOS installer artifacts are uploaded only after tests, the web build, and the Tauri bundle step succeed.
