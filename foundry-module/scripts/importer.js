Hooks.once("init", () => {
  console.log("RPG Book Builder Importer | initialized");
});

Hooks.once("ready", () => {
  game.settings.registerMenu("rpg-book-builder-importer", "importer", {
    name: "Import RPG Book Builder Data",
    label: "Open Importer",
    hint: "Import a JSON transfer package exported by RPG Book Builder.",
    icon: "fas fa-file-import",
    type: RPGBookBuilderImporter,
    restricted: true
  });
});

class RPGBookBuilderImporter extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "rpg-book-builder-importer",
      title: "RPG Book Builder Importer",
      template: "modules/rpg-book-builder-importer/templates/importer.html",
      width: 520
    });
  }

  async _updateObject(_event, formData) {
    const file = formData.package?.[0];
    if (!file) return ui.notifications.warn("Choose an RPG Book Builder JSON package.");
    const data = JSON.parse(await file.text());
    if (data.format !== "rpg-book-builder-foundry" || data.version !== 1) {
      return ui.notifications.error("Unsupported RPG Book Builder package.");
    }
    ui.notifications.info(`Package validated: ${data.entries.length} entries. Actor/Item mapping is the next build step.`);
  }
}
