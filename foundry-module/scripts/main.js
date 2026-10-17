// RPG Book Builder Companion — entry point.
import {MODULE_ID, extendApi, addHeaderButton} from "./shared.js";
import {importPackage, validatePackage, previewPackage, importPlainLore, plainLorePackage, entryStatus, showPreview, choosePackage} from "./importer.js";
import {registerApprovalSettings, initApproval, addApprovalButton} from "./approval.js";
import {initSrdCatalog} from "./srd-catalog.js";
import {initCharacterCreator, addCreatorButton} from "./character-creator.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing RPG Book Builder Companion`);
  registerApprovalSettings();
});

Hooks.once("ready", () => {
  extendApi({importPackage, validatePackage, previewPackage, importPlainLore, plainLorePackage, entryStatus, showPreview, choosePackage});
  initSrdCatalog();
  initApproval();
  initCharacterCreator();
});

Hooks.on("renderJournalDirectory", (_app, html) => {
  if (!game.user?.isGM) return;
  addHeaderButton(html, {key: "import", label: "Import Lore", icon: "fa-solid fa-book-medical", title: "Import an RPG Book Builder package, Markdown or text file", onClick: choosePackage});
});
Hooks.on("renderItemDirectory", (_app, html) => addApprovalButton(html));
Hooks.on("renderActorDirectory", (_app, html) => { addCreatorButton(html); addApprovalButton(html); });
