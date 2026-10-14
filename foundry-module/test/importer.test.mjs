import {describe, it, expect, beforeEach} from "vitest";
import {createFoundryMock} from "./foundry-mock.mjs";

let mock = createFoundryMock();
mock.install();
const I = await import("../scripts/importer.js");
const fresh = (opts) => { mock = createFoundryMock(opts); mock.install(); return mock; };

const goblin = {
  id: "goblin", name: "Goblin Boss", kind: "Creature", visibility: "GM Only", body: "A sneaky boss.", links: [],
  dnd5e: {
    fields: {"Armor Class": "17 (chain shirt, shield)", "Hit Points": "21 (6d6)", Speed: "30 ft.", STR: "10 (+0)", DEX: "14 (+2)", CON: "10 (+0)", INT: "10 (+0)", WIS: "8 (-1)", CHA: "10 (+0)", Skills: "Stealth +6", "Saving Throws": "Dex +4", Challenge: "1 (200 XP)", Senses: "darkvision 60 ft., passive Perception 9", Languages: "Common, Goblin", "Damage Resistances": "fire; bludgeoning, piercing, and slashing from nonmagical attacks", Size: "Small"},
    sections: {Actions: [
      {name: "Multiattack.", text: "The goblin makes two attacks with its scimitar."},
      {name: "Scimitar.", text: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage."},
    ], Reactions: [{name: "Redirect Attack.", text: "When a creature the goblin can see targets it with an attack, the goblin chooses another goblin within 5 feet of it."}]},
  },
};

describe("parsing", () => {
  beforeEach(() => fresh());
  it("splits markdown headings into entries and keeps the preface", () => {
    const p = I.plainLorePackage("World", "Intro text.\n# Coral\nCapital city.\n# Port Stell ##\nOld harbor.");
    expect(p.entries.map(e => e.name)).toEqual(["World", "Coral", "Port Stell"]);
    expect(p.entries[0].body).toBe("Intro text.");
  });
  it("keeps headingless text as one entry and handles CRLF + BOM", () => {
    const p = I.plainLorePackage("Notes", "﻿Line one\r\nLine two");
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0].body).toBe("Line one\nLine two");
  });
  it("rejects malformed and future-version packages", () => {
    expect(() => I.validatePackage(null)).toThrow();
    expect(() => I.validatePackage([])).toThrow();
    expect(() => I.validatePackage({format: "rpg-book-builder-foundry"})).toThrow();
    expect(() => I.validatePackage({format: "wrong", entries: []})).toThrow();
    expect(() => I.validatePackage({format: "rpg-book-builder-foundry", version: 9, entries: []})).toThrow("newer");
  });
  it("normalizes legacy desktop exports (lowercase kinds, description, image objects)", () => {
    const pkg = I.normalizePackage({format: "rpg-book-builder-foundry", version: 1, entries: [
      {id: "a", kind: "monster", name: "Owlbear", description: "Big.", image: {dataUrl: "data:image/png;base64,AAAA"}},
      {id: "b", kind: "spell", name: "Firebolt", description: "Hot."},
    ]});
    expect(pkg.entries[0]).toMatchObject({kind: "Creature", body: "Big.", image: "data:image/png;base64,AAAA"});
    expect(pkg.entries[1]).toMatchObject({kind: "Item", itemType: "spell"});
  });
  it("generates stable ids when missing and de-duplicates collisions", () => {
    const pkg = I.normalizePackage({format: "rpg-book-builder-foundry", entries: [{name: "A"}, {name: "A"}, {id: "x", name: "B"}, {id: "x", name: "C"}]});
    expect(pkg.entries.map(e => e.id)).toEqual(["history-a", "history-a-2", "x", "x-2"]);
    const again = I.normalizePackage({format: "rpg-book-builder-foundry", entries: [{name: "A"}]});
    expect(again.entries[0].id).toBe("history-a");
  });
  it("parses CR text the way statblocks write it", () => {
    expect(I.parseCR("1/2 (100 XP)")).toBe(0.5);
    expect(I.parseCR("1/8")).toBe(0.125);
    expect(I.parseCR("5 (1,800 XP)")).toBe(5);
    expect(I.parseCR("")).toBe(0);
    expect(I.parseCR("99")).toBe(30);
  });
  it("parses movement, proficiencies, attacks and saves", () => {
    expect(I.parseSpeed("30 ft., fly 60 ft. (hover), swim 20 ft.")).toEqual({walk: 30, fly: 60, swim: 20, climb: 0, burrow: 0, units: "ft", hover: true});
    expect(I.parseProficiencyMap("Dex +5, Wis +3")).toEqual({dex: 5, wis: 3});
    expect(I.parseAttack("Melee Weapon Attack: +7 to hit, reach 10 ft. Hit: 11 (2d6 + 4) slashing damage.")).toMatchObject({bonus: 7, range: 10, damage: {formula: "2d6+4", type: "slashing"}});
    expect(I.parseAttack("Ranged Weapon Attack: +5 to hit, range 80/320 ft. Hit: 7 (1d8 + 3) piercing damage.")).toMatchObject({bonus: 5, range: 80, longRange: 320});
    expect(I.parseAttack("Melee Attack Roll: +6, reach 5 ft. Hit: 9 (2d4 + 4) Piercing damage.")).toMatchObject({bonus: 6, hasAttack: true});
    expect(I.parseAttack("DC 15 Dexterity saving throw")).toMatchObject({save: {dc: 15, ability: "dex"}});
  });
  it("strips active content from package HTML", () => {
    const html = I.cleanHtml(`<p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:evil()">x</a><iframe src="x"></iframe>`);
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("iframe");
    expect(html).toContain("<p>Hi</p>");
  });
});

describe("D&D 5e mapping", () => {
  beforeEach(() => fresh());
  it("builds an NPC that passes validation, with proficiency instead of double-counted bonuses", () => {
    const pkg = I.normalizePackage({format: "rpg-book-builder-foundry", entries: [goblin]});
    const data = I.actorData(pkg.entries[0], null);
    expect(() => mock.validate("Actor", data)).not.toThrow();
    expect(data.system.details.cr).toBe(1);
    expect(data.system.attributes.ac.flat).toBe(17);
    expect(data.system.attributes.hp).toMatchObject({value: 21, max: 21, formula: "6d6"});
    expect(data.system.abilities.dex).toEqual({value: 14, proficient: 1});
    expect(data.system.skills.ste).toEqual({value: 2}); // +6 = +2 DEX + 2×PB 2 → expertise
    expect(data.system.traits.dr.value).toEqual(["fire", "bludgeoning", "piercing"]);
    expect(data.system.traits.dr.custom).toBe("and slashing from nonmagical attacks");
    expect(data.system.traits.size).toBe("sm");
  });
  it("turns only real attacks into weapons and keeps activation", () => {
    const pkg = I.normalizePackage({format: "rpg-book-builder-foundry", entries: [goblin]});
    const items = I.featureItems(pkg.entries[0]);
    expect(items.map(i => [i.name, i.type])).toEqual([["Multiattack", "feat"], ["Scimitar", "weapon"], ["Redirect Attack", "feat"]]);
    expect(items[1].system).toMatchObject({actionType: "mwak", damage: {parts: [["1d6+2", "slashing"]]}});
    expect(items[2].system.activation.type).toBe("reaction");
  });
  it("falls back to journals on non-5e systems", () => {
    fresh({system: "pf2e", itemTypes: ["equipment"]});
    const pkg = I.normalizePackage({format: "rpg-book-builder-foundry", entries: [goblin, {id: "i", name: "Sword", kind: "Item"}]});
    expect(pkg.entries.map(e => I.targetType(e))).toEqual(["Journal", "Journal"]);
  });
});

describe("importing", () => {
  beforeEach(() => fresh());
  const pkg = () => ({format: "rpg-book-builder-foundry", version: 1, title: "Aeyra", entries: [
    {id: "coral", name: "Coral", kind: "Settlement", visibility: "Player", body: "Capital of @Stellaris. Near @Port Stell and @Port.", links: ["Stellaris", "Port Stell", "Port"]},
    {id: "stellaris", name: "Stellaris", kind: "Empire", visibility: "Secret", body: "An empire."},
    {id: "port-stell", name: "Port Stell", kind: "Settlement", visibility: "Player", body: "Harbor."},
    {id: "port", name: "Port", kind: "Settlement", visibility: "Player", body: "Generic port."},
    goblin,
    {id: "trident", name: "Coral Trident", kind: "Item", visibility: "Player", body: "A weapon of the deep."},
  ]});

  it("creates journals, actors and items in organised folders", async () => {
    const r = await I.importPackage(pkg());
    expect(r).toMatchObject({created: 6, updated: 0, unchanged: 0, failed: []});
    expect(mock.game.journal).toHaveLength(4);
    expect(mock.game.actors).toHaveLength(1);
    expect(mock.game.items).toHaveLength(1);
    const actor = mock.game.actors[0];
    expect(actor.items.map(i => i.name)).toEqual(["Multiattack", "Scimitar", "Redirect Attack"]);
    expect(actor.ownership.default).toBe(0);
    const root = mock.game.folders.find(f => f.name === "Aeyra" && f.type === "JournalEntry");
    const sub = mock.game.folders.find(f => f.name === "Settlement");
    expect(sub.folder).toBe(root.id);
  });
  it("links longer names first so @Port Stell is not split by @Port", async () => {
    await I.importPackage(pkg());
    const coral = mock.game.journal.find(j => j.name === "Coral");
    const html = coral.pages[0].text.content;
    const stell = mock.game.journal.find(j => j.name === "Port Stell");
    expect(html).toContain(`@UUID[${stell.uuid}]{Port Stell}`);
    expect(html).not.toContain("{Port} Stell");
  });
  it("reimporting unchanged data does nothing; changes update in place without moving folders", async () => {
    await I.importPackage(pkg());
    const before = mock.log.created.length;
    expect(await I.importPackage(pkg())).toMatchObject({created: 0, updated: 0, unchanged: 6});
    expect(mock.log.created.length).toBe(before);
    const coral = mock.game.journal.find(j => j.name === "Coral");
    const moved = await Folder.create({name: "My Folder", type: "JournalEntry"});
    coral.folder = moved.id;
    const p = pkg(); p.entries[0].body = "Changed!";
    expect(await I.importPackage(p)).toMatchObject({updated: 1, unchanged: 5});
    expect(coral.folder).toBe(moved.id);
    expect(coral.pages[0].text.content).toContain("Changed!");
  });
  it("replaces imported actor features on update instead of stacking them", async () => {
    await I.importPackage(pkg());
    const p = pkg(); p.entries[4] = {...goblin, body: "Updated boss."};
    await I.importPackage(p);
    expect(mock.game.actors[0].items).toHaveLength(3);
  });
  it("keeps going when one entry fails and reports it", async () => {
    const p = pkg();
    p.entries.push({id: "bad", name: "Bad Item", kind: "Item", itemType: "starship"});
    fresh({itemTypes: ["weapon"]}); // no loot type: the Item mapping cannot be satisfied
    const r = await I.importPackage(p);
    expect(r.failed.map(f => f.name)).toContain("Coral Trident");
    expect(r.created).toBeGreaterThan(0);
  });
  it("only GMs can import", async () => {
    mock.game.user = mock.player;
    await expect(I.importPackage(pkg())).rejects.toThrow("Only a GM");
  });
  it("drops embedded base64 images it cannot upload instead of failing validation", async () => {
    const r = await I.importPackage({format: "rpg-book-builder-foundry", entries: [{id: "o", kind: "monster", name: "Owlbear", image: {dataUrl: "data:image/png;base64,iVBORw0KGgo="}}]});
    expect(r.failed).toEqual([]);
    expect(mock.game.actors[0].img).toBeUndefined();
  });
  it("previews counts with status per entry", async () => {
    await I.importPackage(pkg());
    const p = pkg(); p.entries[1].body = "Different"; p.entries.push({id: "new", name: "New Place"}, {id: "blank", name: "   "});
    expect(I.previewPackage(p)).toMatchObject({New: 1, Update: 1, Unchanged: 5, Invalid: 1, Journal: 5, Actor: 1, Item: 1});
  });
  it("accepts fingerprints written by earlier module builds", async () => {
    const entry = {id: "legacy-1", name: "Legacy", kind: "History", visibility: "Player", body: "Same", links: []};
    const legacy = JSON.stringify({name: "Legacy", kind: "History", visibility: "Player", body: "Same", html: "", links: [], image: "", dnd5e: null});
    mock.game.journal.push({getFlag: (_m, k) => k === "sourceId" ? "legacy-1" : k === "fingerprint" ? legacy : null});
    expect(I.entryStatus(I.normalizeEntry(entry), I.buildSourceIndex())).toBe("Unchanged");
  });
});
