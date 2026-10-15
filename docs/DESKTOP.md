# Desktop builds

RPG Book Builder uses Tauri 2, so the React/TypeScript app ships from one codebase on Windows and macOS.

## Development

Install Node.js 22, Rust (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform, then:

```bash
npm install
npm run tauri -- icon src-tauri/app-icon.svg   # generate app icons (first time only)
npm run tauri dev
```

## Windows

On Windows, build the NSIS `.exe` installer:

```bash
npm run tauri -- build --bundles nsis
```

The installer is written to `src-tauri/target/release/bundle/nsis/`. It is not code-signed yet, so Windows SmartScreen shows a warning on first run.

## macOS

On a Mac with Xcode installed:

```bash
npm run mac:dmg
```

The `.dmg` is written to `src-tauri/target/release/bundle/dmg/`. Builds are ad-hoc signed only. Public distribution should be signed with an Apple Developer ID and notarized, or macOS will block the app on first open.

## Releases

Pushing a tag like `v2.0.1` runs the **Desktop Build** workflow, which tests the app and attaches the Windows and macOS installers to a **draft** release. Open the Releases page, check the draft, and click **Publish release** to make it public.

The Foundry module is released separately: pushing a tag like `foundry-v0.5.0` runs the **Foundry Module Release** workflow. The tag must match the `version` in `foundry-module/module.json`.
