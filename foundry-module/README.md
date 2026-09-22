# RPG Book Builder Companion

Basic Foundry VTT v13 companion module for RPG Book Builder.

## Current MVP
- Adds an **RPG Book Builder** import button to the Journal directory for GMs.
- Imports `.json` or `.rpgfoundry` packages.
- Creates a root Journal folder and subfolders by lore kind.
- Creates one Journal Entry per lore entry.
- Player entries receive default Observer ownership; GM Only and Secret entries remain GM-only.
- Preserves RPG Book Builder source ID, visibility, and relationship names in module flags.
- Exposes `game.modules.get("rpg-book-builder-companion").api.importPackage(data)` for development/testing.

## Export package shape

```json
{
  "format": "rpg-book-builder-foundry",
  "version": 1,
  "title": "My Campaign",
  "entries": [
    {
      "id": "coral",
      "name": "Coral",
      "kind": "Settlement",
      "visibility": "Player",
      "body": "Capital of the Empire of Coral.",
      "links": ["Port Stell"]
    }
  ]
}
```

## Install for development
Copy the `foundry-module` folder into Foundry's `Data/modules` directory and rename the folder to `rpg-book-builder-companion`. Restart Foundry, enable the module in a world, then open the Journal sidebar.

This is the first importer MVP. Actor/Item conversion, image transfer, resolved Foundry document links, update-in-place, and a polished ApplicationV2 importer are later stages.
