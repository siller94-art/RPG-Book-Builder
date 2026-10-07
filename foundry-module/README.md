# RPG Book Builder Companion / Standalone Lore Importer

A Foundry VTT module that works in two ways:

1. **RPG Book Builder Companion** — imports structured `.rpgfoundry` campaign exports.
2. **Standalone Lore Importer** — Foundry users who do not use RPG Book Builder can import their own Markdown, text, or compatible JSON lore.

## Supported files
- `.rpgfoundry` — full RPG Book Builder package
- `.json` — compatible structured package
- `.md` — Markdown lore
- `.txt` — plain-text lore

Markdown headings beginning with `# ` become separate Journal entries. A text file without headings becomes one Journal entry.

## Current features
- GM import button in the Journal directory
- Preview/review window with per-entry selection
- New vs Update status
- Organized folders
- Player / GM Only / Secret permissions for structured packages
- Update-by-source-ID instead of duplicate imports
- Journal relationship links using Foundry UUID links
- RPG Book Builder Creature/Person -> Actor conversion
- RPG Book Builder Item -> Item conversion
- D&D 5e AC, HP, abilities, speed, CR, attacks, damage, ranges, senses, languages, resistances, immunities and vulnerabilities mapping where structured data is available
- Actor-owned imported features/actions
- API for other modules/macros:
  - `importPackage(data)`
  - `importPlainLore(title, text)`
  - `plainLorePackage(title, text)`
  - `previewPackage(data)`

## Standalone use
Copy this folder to Foundry's `Data/modules/rpg-book-builder-companion`, restart Foundry, enable the module in a world, open Journals, and press **RPG Book Builder**. Despite the button name, Markdown and text imports do not require RPG Book Builder.

## Structured package
The native package format uses `format: "rpg-book-builder-foundry"` and an `entries` array. Structured entries can specify name, kind, visibility, body, links, image, and D&D 5e data.

## Scope
The module is system-agnostic for Journal lore. Deeper Actor/Item automation is designed for D&D 5e structured exports. Other game systems can still use the standalone Journal importer.


## D&D SRD support

The companion can use SRD content installed with the Foundry D&D5e system in two separate rules modes: **2014 (SRD 5.1)** and **2024 (SRD 5.2.1)**. The catalog reads native Foundry compendium documents rather than duplicating proprietary non-SRD books. Custom player-created species, items, and spells continue through the GM approval workflow.

SRD material is used under CC BY 4.0. This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and material taken from System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC. SRD 5.1 and SRD 5.2.1 are licensed under the Creative Commons Attribution 4.0 International License.
