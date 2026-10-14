// Boots the companion module against the Foundry mock in a real browser.
import {createFoundryMock} from "../foundry-mock.mjs";

const params = new URLSearchParams(location.search);
const role = params.get("role") || "gm";
const mock = createFoundryMock();
mock.install(window);
window.__appHost = document.getElementById("board");
if (role === "player") mock.game.user = mock.player;

const spells = ["Acid Splash", "Bless", "Burning Hands", "Cure Wounds", "Detect Magic", "Fire Bolt", "Fireball", "Guidance", "Healing Word", "Mage Armor", "Magic Missile", "Shield", "Sleep", "Thunderwave", "Misty Step", "Counterspell", "Haste", "Fly"];
mock.addPack({collection: "dnd5e.spells24", label: "Spells (SRD 5.2)", docs: spells.map((n, i) => ({name: n, type: "spell", img: `icons/svg/${i % 3 ? "fire" : "light"}.svg`, system: {level: i % 6, source: {rules: "2024"}}}))});
mock.addPack({collection: "dnd5e.spells", label: "Spells (SRD)", docs: spells.slice(0, 12).map(n => ({name: n, type: "spell", system: {level: 1}}))});
mock.addPack({collection: "dnd5e.origins24", label: "Character Origins", docs: [
  ...["Dragonborn", "Dwarf", "Elf", "Gnome", "Goliath", "Halfling", "Human", "Orc", "Tiefling"].map(n => ({name: n, type: "race", system: {source: {rules: "2024"}}})),
  ...["Acolyte", "Criminal", "Sage", "Soldier"].map(n => ({name: n, type: "background", system: {source: {rules: "2024"}}})),
]});
mock.addPack({collection: "dnd5e.classes24", label: "Classes (SRD 5.2)", docs: ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"].map(n => ({name: n, type: "class", system: {source: {rules: "2024"}}}))});

const riley = mock.embedded(new mock.MockDocument({name: "Riley Tidecaller", type: "character", img: "icons/svg/mystery-man.svg", ownership: {default: 0, [mock.player.id]: 3}, system: {abilities: {str: {value: 8}, dex: {value: 14}, con: {value: 13}, int: {value: 12}, wis: {value: 15}, cha: {value: 10}}}}, "Actor"));
riley.sheet = {render: () => {}};
mock.game.actors.push(riley);
await riley.createEmbeddedDocuments("Item", [{name: "Elf", type: "race"}, {name: "Sage", type: "background"}, {name: "Wizard", type: "class", system: {levels: 3}}, {name: "Fire Bolt", type: "spell"}, {name: "Shield", type: "spell"}]);

const main = await import("../../scripts/main.js");
const approval = await import("../../scripts/approval.js");
mock.Hooks.callAll("init");
mock.Hooks.callAll("ready");

if (params.get("seed") === "queue") {
  const prev = mock.game.user; mock.game.user = mock.gm;
  await approval.acceptSubmission({id: "sub1", userId: mock.player.id, content: {type: "species", name: "Tideborn", description: "Children of the Empire of Coral.\n\nGills: You can breathe air and water.\nSwim speed equal to your walking speed.\nTidal Sense: Once per long rest, you know the direction of the nearest body of salt water."}}, mock.player.id);
  await approval.acceptSubmission({id: "sub2", userId: mock.player.id, content: {type: "spell", name: "Brine Lance", description: "Action: A spear of seawater.\nRange: 60 ft\nDamage: 3d8 cold\nUses: 1st-level spell slot"}}, mock.player.id);
  await approval.acceptSubmission({id: "sub3", userId: mock.player.id, content: {type: "item", name: "Pearl of the Deep", description: "While attuned you can see 60 ft in dim underwater light."}}, mock.player.id);
  await approval.reviewSubmission("sub3", "changes", "Add a price and rarity, please.");
  mock.game.user = prev;
}

for (const [id, hook] of [["journal", "renderJournalDirectory"], ["actors", "renderActorDirectory"], ["items", "renderItemDirectory"]]) {
  const el = document.getElementById(id);
  mock.Hooks.callAll(hook, {}, el);
  mock.Hooks.callAll(hook, {}, el); // a re-render must not duplicate buttons
}

window.H = {mock, main, approval, api: mock.game.modules.get("rpg-book-builder-companion").api, riley};
window.H.ready = true;
