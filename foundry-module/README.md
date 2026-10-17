# RPG Book Builder Companion

A Foundry VTT (v14) module with three tools:

1. **Import Lore** — bring an RPG Book Builder `.rpgfoundry` export, a compatible `.json` package, or any Markdown / text file into your world.
2. **Character Creator** — a step-by-step D&D 5e builder that pulls species, backgrounds, classes, feats, spells and gear from the SRD compendiums that ship with the D&D 5e system.
3. **Custom Content approval** — players write their own species, items and spells; nothing reaches a character until the GM approves it.

## Install

Paste this manifest URL into Foundry's **Install Module** dialog:

```
https://github.com/siller94-art/RPG-Book-Builder/releases/download/foundry-v0.5.0/module.json
```

or copy this folder to `Data/modules/rpg-book-builder-companion` and restart Foundry. Enable it in your world.

## Import Lore (GM)

Open the **Journal** sidebar and press **Import Lore**. Pick a file and the Import Manager shows every entry with its status:

| Status | Meaning |
| --- | --- |
| **New** | Not in this world yet. |
| **Update** | Imported before, and the source has changed. |
| **Unchanged** | Already up to date — skipped. |
| **Skipped** | The entry has no name. |

Filter by status, by type (Journals / Actors / Items) or by name, tick what you want, and press **Import**. One bad entry never stops the rest; failures are listed at the end.

- Markdown `# Headings` become separate Journal entries; text before the first heading is kept as its own entry. Bodies are rendered as Markdown.
- Re-importing updates documents in place (matched by source id) and never moves anything you've re-filed into your own folders.
- `@Name` mentions become clickable links when the target is in the same package or was imported earlier.
- **Player** entries are visible to players; **GM Only** and **Secret** entries are hidden.
- With the D&D 5e system, *Creature* and *Person* entries become NPC Actors (AC, HP and hit-dice formula, abilities, CR including fractions like `1/2`, speeds, saves and skills as proficiencies, damage and condition traits, size) with their actions as items. *Item* entries become Items. In any other system everything imports as Journals.
- Embedded images are uploaded into `worlds/<world>/rpg-book-builder/`.

## Character Creator (D&D 5e)

Open the **Actors** sidebar and press **Character Creator**. Choose the character, then **2014 · SRD 5.1** or **2024 · SRD 5.2.1** rules, and work through Species → Background → Class → Subclass → Feats → Spell Book → Equipment → Review.

- Classes, subclasses, species and backgrounds go through D&D 5e's own Advancement prompts, exactly as if you'd dragged them onto the sheet.
- Items already on the sheet are marked, and spells, feats and origins can't be added twice.
- **Homebrew** opens the custom-content form for anything the SRD doesn't have.

## Custom content approval

**Players:** press **My Custom Content** in the Actors or Items sidebar. Pick Species, Item or Spell, write it up (the *Start from* buttons give a template), and **Submit to GM**. Drafts save automatically. A GM must be online to receive a submission; you'll get a notification when it's approved, returned for changes, or rejected. Returned submissions have a **Revise & resubmit** button.

**GMs:** press **Content Approval** (the count shows how many are waiting). Approve to create an Item owned by that player in the **Player Content** folder, return it with a note, or reject it.

## API

```js
const api = game.modules.get("rpg-book-builder-companion").api;
await api.importPackage(data);              // {created, updated, unchanged, failed, total}
await api.importPlainLore("Title", markdown);
api.plainLorePackage("Title", markdown);    // build a package without importing
api.previewPackage(data);                   // counts by type and status
api.showPreview(data);                      // open the Import Manager
api.openCharacterCreator({actorId});
api.getSrdCatalog({rulesVersion: "2024", kind: "spell", query: "fire"});
api.openPlayerContentBuilder();  api.openApprovalQueue();
```

## Package format

`{"format": "rpg-book-builder-foundry", "version": 1, "title": "…", "entries": [...]}`. Each entry may have `id`, `name`, `kind` (History, Empire, Settlement, Person, Faction, Religion, Item, Creature, Mystery…), `visibility` (`Player`, `GM Only`, `Secret`), `body` (Markdown) or `html`, `links`, `image`, and `dnd5e: {fields, sections}`. Older desktop exports with lowercase kinds (`monster`, `spell`, …) are accepted too.

## Development

`npm test` at the repository root runs the module's tests (`foundry-module/test`) against a strict Foundry API stand-in, including stress cases (thousands of entries, hostile input, concurrent imports and reviews). `test/harness/index.html` boots the real module in a browser against the same stand-in for UI work — serve the repository root and open it (`?role=player`, `?seed=queue`).

## Licence notes

SRD material is used under CC BY 4.0. This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") and the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, licensed under the Creative Commons Attribution 4.0 International License. The module reads the compendiums installed with the D&D 5e system; it does not bundle any rules content.
