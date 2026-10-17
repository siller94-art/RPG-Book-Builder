import {describe, it, expect, beforeEach} from "vitest";
import {createFoundryMock} from "./foundry-mock.mjs";

let mock = createFoundryMock();
mock.install();
const S = await import("../scripts/srd-catalog.js");

function world() {
  mock = createFoundryMock();
  mock.install();
  S._clearSrdCache();
  // Legacy SRD 5.1 packs: no source.rules on the documents, unsuffixed pack ids.
  mock.addPack({collection: "dnd5e.spells", label: "Spells (SRD)", docs: [
    {name: "Fire Bolt", type: "spell", system: {level: 0}},
    {name: "Fireball", type: "spell", system: {level: 3}},
  ]});
  mock.addPack({collection: "dnd5e.races", label: "Races (SRD)", docs: [{name: "Elf", type: "race"}]});
  mock.addPack({collection: "dnd5e.items", label: "Items (SRD)", docs: [
    {name: "Longsword", type: "weapon"}, {name: "Rope, Hempen", type: "loot"}, {name: "Potion of Healing", type: "consumable"}, {name: "Chain Mail", type: "equipment"},
  ]});
  // SRD 5.2.1 packs with explicit source metadata.
  mock.addPack({collection: "dnd5e.spells24", label: "Spells (SRD 5.2)", docs: [
    {name: "Fireball", type: "spell", system: {level: 3, source: {rules: "2024", book: "SRD 5.2.1"}}},
  ]});
  mock.addPack({collection: "dnd5e.origins24", label: "Character Origins", docs: [
    {name: "Elf", type: "race", system: {source: {rules: "2024"}}},
    {name: "Sage", type: "background", system: {source: {rules: "2024"}}},
  ]});
  // A world compendium of unrelated items should be ignored.
  mock.addPack({collection: "world.loot", label: "My Loot", packageType: "world", packageName: "test-world", docs: [{name: "Fireball Trap", type: "loot"}]});
  return mock;
}

describe("SRD catalog", () => {
  beforeEach(() => world());

  it("keeps 2014 and 2024 content apart, including packs whose name only ends in 24", async () => {
    const legacy = await S.getSrdCatalog({rulesVersion: "2014", kind: "spell"});
    const modern = await S.getSrdCatalog({rulesVersion: "2024", kind: "spell"});
    expect(legacy.map(r => r.name)).toEqual(["Fire Bolt", "Fireball"]);
    expect(modern.map(r => r.name)).toEqual(["Fireball"]);
    expect(modern[0].pack).toBe("Spells (SRD 5.2)");
  });

  it("groups species and every kind of gear", async () => {
    expect((await S.getSrdCatalog({rulesVersion: "2024", kind: "species"})).map(r => r.name)).toEqual(["Elf"]);
    expect((await S.getSrdCatalog({rulesVersion: "2014", kind: "equipment"})).map(r => r.name)).toEqual(["Chain Mail", "Longsword", "Potion of Healing", "Rope, Hempen"]);
  });

  it("searches case-insensitively, ignores non-SRD world packs and caches indexes", async () => {
    const r = await S.getSrdCatalog({rulesVersion: "2014", query: "FIRE"});
    expect(r.map(x => x.name)).toEqual(["Fire Bolt", "Fireball"]);
    await S.getSrdCatalog({rulesVersion: "2014", query: "fire"});
    expect(mock.game.packs.find(p => p.collection === "dnd5e.spells").indexCalls).toBe(1);
  });

  it("caps result size but reports the total", async () => {
    mock.addPack({collection: "dnd5e.bulk", label: "Bulk (SRD)", docs: Array.from({length: 400}, (_, i) => ({name: `Item ${String(i).padStart(3, "0")}`, type: "loot"}))});
    const r = await S.getSrdCatalog({rulesVersion: "2014", kind: "equipment"});
    expect(r).toHaveLength(S.MAX_RESULTS);
    expect(r.total).toBe(404);
  });

  it("rejects bad rules versions", async () => {
    await expect(S.getSrdCatalog({rulesVersion: "2030"})).rejects.toThrow("2014 or 2024");
  });

  it("adds content to an owned actor even when the item itself has no rules metadata", async () => {
    const actor = mock.embedded(new mock.MockDocument({name: "Riley", type: "character", ownership: {default: 0, [mock.player.id]: 3}}, "Actor"));
    mock.game.actors.push(actor);
    mock.game.user = mock.player;
    const [row] = await S.getSrdCatalog({rulesVersion: "2014", kind: "spell", query: "fire bolt"});
    const created = await S.addSrdDocumentToActor(actor, row.uuid, {rulesVersion: row.rulesVersion});
    expect(created.name).toBe("Fire Bolt");
    expect(created.flags["rpg-book-builder-companion"]).toMatchObject({srd: true, rulesVersion: "2014", sourceUuid: row.uuid});
  });

  it("refuses actors the user does not own", async () => {
    const actor = mock.embedded(new mock.MockDocument({name: "Someone Else", type: "character"}, "Actor"));
    mock.game.user = mock.player;
    const [row] = await S.getSrdCatalog({rulesVersion: "2014", kind: "spell"});
    await expect(S.addSrdDocumentToActor(actor, row.uuid)).rejects.toThrow("do not own");
  });

  it("routes classes and species through the dnd5e Advancement Manager when it has steps", async () => {
    const actor = mock.embedded(new mock.MockDocument({name: "Riley", type: "character"}, "Actor"));
    let rendered = false;
    globalThis.dnd5e = {applications: {advancement: {AdvancementManager: {forNewItem: () => ({steps: [1], render: () => { rendered = true; }})}}}};
    try {
      const [elf] = await S.getSrdCatalog({rulesVersion: "2024", kind: "species"});
      const result = await S.addSrdDocumentToActor(actor, elf.uuid);
      expect(result.pending).toBe(true);
      expect(rendered).toBe(true);
      expect(actor.items).toHaveLength(0); // the manager adds it when the player finishes
    } finally { delete globalThis.dnd5e; }
  });
});
