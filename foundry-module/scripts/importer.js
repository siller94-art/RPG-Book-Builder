// Package parsing, D&D 5e mapping and the Import Manager window.
import {MODULE_ID, esc, textToHtml, companionApplication, fitToViewport, serialize, hashText} from "./shared.js";

export const PACKAGE_FORMAT = "rpg-book-builder-foundry";
export const SUPPORTED_VERSION = 1;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
const VISIBILITIES = ["Player", "GM Only", "Secret"];

/* ---------------------------------------------------------------- parsing */

export function slug(value) {
  const text = String(value ?? "").trim();
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  // Same ASCII slug as earlier builds (keeps existing source ids stable); names with
  // few or no Latin letters (珊瑚の都, Кораллы) get a hash so they don't collide.
  if (!base) return text ? `u${hashText(text)}` : "lore";
  return /[^\x00-\x7f]/.test(text) && base.length < text.length / 2 ? `${base}-${hashText(text)}` : base;
}

/** Markdown/plain text -> package. Each `# Heading` becomes its own entry. */
export function plainLorePackage(title, text) {
  const normalized = String(text || "").replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  const heads = [...normalized.matchAll(/^#[ \t]+(.+?)[ \t#]*$/gm)];
  const name = String(title || "").trim() || "Imported Lore";
  const entries = heads.length
    ? heads.map((m, i) => ({
      id: `external-${slug(m[1])}-${i}`,
      name: m[1].trim(),
      kind: "History",
      visibility: "Player",
      body: normalized.slice(m.index + m[0].length, i + 1 < heads.length ? heads[i + 1].index : normalized.length).trim(),
      links: [],
    }))
    : [{id: `external-${slug(name)}`, name, kind: "History", visibility: "Player", body: normalized.trim(), links: []}];
  // Text before the first heading would otherwise be lost.
  if (heads.length && heads[0].index > 0) {
    const preface = normalized.slice(0, heads[0].index).trim();
    if (preface) entries.unshift({id: `external-${slug(name)}-preface`, name, kind: "History", visibility: "Player", body: preface, links: []});
  }
  return {format: PACKAGE_FORMAT, version: SUPPORTED_VERSION, title: name, createdAt: new Date().toISOString(), entries};
}

export function validatePackage(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid RPG Book Builder package.");
  if (data.format !== PACKAGE_FORMAT) throw new Error("This is not an RPG Book Builder Foundry export.");
  if (!Array.isArray(data.entries)) throw new Error("The package has no lore entries.");
  if (data.version != null && Number(data.version) > SUPPORTED_VERSION) {
    throw new Error(`This package was made by a newer RPG Book Builder (format v${data.version}). Update the companion module.`);
  }
  return true;
}

// Older desktop builds exported raw content entries with lowercase kinds.
const LEGACY_KINDS = {
  character: {kind: "Person"}, npc: {kind: "Person"}, monster: {kind: "Creature"},
  item: {kind: "Item", itemType: "loot"}, spell: {kind: "Item", itemType: "spell"}, feat: {kind: "Item", itemType: "feat"},
  species: {kind: "Item", itemType: "race"}, background: {kind: "Item", itemType: "background"}, class: {kind: "Item", itemType: "class"},
  handout: {kind: "History"},
};

function cleanVisibility(value) {
  const v = String(value || "").trim().toLowerCase();
  return VISIBILITIES.find(x => x.toLowerCase() === v) || (v === "gm" || v === "gm-only" ? "GM Only" : "Player");
}

function cleanLinks(links) {
  if (!Array.isArray(links)) return [];
  return [...new Set(links.map(l => String(typeof l === "object" && l ? l.name ?? "" : l ?? "").trim()).filter(Boolean))];
}

/** Coerce one raw entry into the shape the importer works with. Never throws. */
export function normalizeEntry(raw, index = 0, usedIds = new Set()) {
  if (raw && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, "raw") && !Object.getOwnPropertyDescriptor(raw, "raw").enumerable) {
    usedIds.add(raw.id);
    return raw; // already normalized: keep its resolved id
  }
  const src = raw && typeof raw === "object" ? raw : {};
  const legacy = LEGACY_KINDS[String(src.kind || "").toLowerCase()] && !/^[A-Z]/.test(String(src.kind)) ? LEGACY_KINDS[String(src.kind).toLowerCase()] : null;
  const name = String(src.name ?? "").replace(/\s+/g, " ").trim().slice(0, 255);
  const kind = legacy?.kind || String(src.kind || "History").trim().slice(0, 64) || "History";
  const image = typeof src.image === "string" ? src.image : typeof src.image?.dataUrl === "string" ? src.image.dataUrl : typeof src.img === "string" ? src.img : "";
  let id = src.id != null && String(src.id).trim() ? String(src.id).trim() : `${slug(kind)}-${slug(name || `entry-${index}`)}`;
  if (usedIds.has(id)) { let n = 2; while (usedIds.has(`${id}-${n}`)) n++; id = `${id}-${n}`; }
  usedIds.add(id);
  const entry = {
    id, name, kind,
    visibility: cleanVisibility(src.visibility),
    body: typeof src.body === "string" ? src.body : typeof src.description === "string" ? src.description : "",
    html: typeof src.html === "string" ? src.html : "",
    links: cleanLinks(src.links),
    image,
    dnd5e: src.dnd5e && typeof src.dnd5e === "object" ? src.dnd5e : null,
  };
  if (legacy?.itemType || src.itemType) entry.itemType = String(legacy?.itemType || src.itemType);
  Object.defineProperty(entry, "raw", {value: src, enumerable: false});
  return entry;
}

export function normalizePackage(data) {
  validatePackage(data);
  const used = new Set();
  return {...data, title: String(data.title || "").trim() || "RPG Book Builder", entries: data.entries.map((e, i) => normalizeEntry(e, i, used))};
}

/* ----------------------------------------------------------- fingerprints */

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.keys(value).sort().reduce((out, key) => (out[key] = canonical(value[key]), out), {});
  return value;
}
function fingerprintPayload(entry) {
  return {name: entry.name || "", kind: entry.kind || "History", visibility: entry.visibility || "Player", body: entry.body || "", html: entry.html || "", links: entry.links || [], image: entry.image || "", dnd5e: entry.dnd5e || null};
}
export function stableEntry(entry) { return JSON.stringify(canonical(fingerprintPayload(entry))); }
function legacyFingerprints(entry) {
  const out = new Set();
  for (const e of [entry, entry?.raw].filter(Boolean)) {
    const payload = fingerprintPayload(e);
    out.add(JSON.stringify(payload)).add(JSON.stringify(canonical(payload))).add(JSON.stringify(e)).add(JSON.stringify(canonical(e)));
  }
  return out;
}
function fingerprintMatches(entry, value) { return typeof value === "string" && (value === stableEntry(entry) || legacyFingerprints(entry).has(value)); }

export function sourceFlag(entry) {
  return {[MODULE_ID]: {sourceId: entry.id || null, visibility: entry.visibility || "Player", links: entry.links || [], fingerprint: stableEntry(entry), fingerprintVersion: 2}};
}

/* ------------------------------------------------------------ targeting */

export function isDnd5e() { return game.system?.id === "dnd5e"; }
function itemTypes() {
  const types = game.documentTypes?.Item ?? Object.keys(CONFIG?.Item?.dataModels ?? CONFIG?.Item?.typeLabels ?? {});
  return new Set(Array.isArray(types) ? types : Object.keys(types || {}));
}
/** Pick the first of the preferred Item types the active system defines. */
export function pickItemType(...preferred) {
  const types = itemTypes();
  if (!types.size) return preferred[0];
  return preferred.find(t => types.has(t)) || null;
}

export function targetType(entry) {
  if (!isDnd5e()) return "Journal";
  if (entry.kind === "Creature" || entry.kind === "Person") return "Actor";
  if (entry.kind === "Item") return "Item";
  return "Journal";
}
const COLLECTIONS = {Journal: () => game.journal, Actor: () => game.actors, Item: () => game.items};

/** sourceId -> document, per target collection. Built once per preview/import. */
export function buildSourceIndex() {
  const index = {Journal: new Map(), Actor: new Map(), Item: new Map()};
  for (const [type, get] of Object.entries(COLLECTIONS)) {
    for (const doc of get() || []) {
      const id = doc?.getFlag?.(MODULE_ID, "sourceId");
      if (id && !index[type].has(id)) index[type].set(id, doc);
    }
  }
  return index;
}
export function existingFor(entry, index = buildSourceIndex()) {
  return entry?.id ? index[targetType(entry)]?.get(entry.id) ?? null : null;
}
export function entryStatus(entry, index) {
  if (!entry?.name) return "Invalid";
  const old = existingFor(entry, index);
  if (!old) return "New";
  return fingerprintMatches(entry, old.getFlag(MODULE_ID, "fingerprint")) ? "Unchanged" : "Update";
}
export function previewPackage(data) {
  const pkg = normalizePackage({format: PACKAGE_FORMAT, ...data});
  const index = buildSourceIndex();
  return pkg.entries.reduce((a, e) => {
    const status = entryStatus(e, index);
    if (status !== "Invalid") { const type = targetType(e); a[type] = (a[type] || 0) + 1; }
    a[status] = (a[status] || 0) + 1;
    return a;
  }, {Journal: 0, Actor: 0, Item: 0, New: 0, Update: 0, Unchanged: 0, Invalid: 0});
}

/* --------------------------------------------------------- D&D 5e mapping */

export function num(v, fallback = 0) {
  const match = String(v ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}
/** "1/2 (100 XP)" -> 0.5, "5 (1,800 XP)" -> 5. */
export function parseCR(value) {
  const text = String(value ?? "").trim();
  const frac = text.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) { const d = Number(frac[2]); return d ? Number(frac[1]) / d : 0; }
  const n = num(text, 0);
  return Math.max(0, Math.min(30, n));
}
export function proficiencyForCR(cr) { return Math.max(2, Math.floor((Math.max(cr, 1) - 1) / 4) + 2); }

function field(entry, ...names) {
  const f = entry.dnd5e?.fields || {};
  for (const n of names) {
    const k = Object.keys(f).find(x => x.toLowerCase() === n.toLowerCase());
    if (k) return String(f[k] ?? "");
  }
  return "";
}
const ABILITY_NAMES = {str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma"};
function ability(entry, key) { return Math.max(1, Math.min(30, num(field(entry, key, key.toUpperCase(), ABILITY_NAMES[key]), 10))); }
const mod = score => Math.floor((score - 10) / 2);

export function parseSpeed(value = "") {
  const out = {walk: 0, fly: 0, swim: 0, climb: 0, burrow: 0, units: "ft"};
  const text = String(value);
  const walk = text.match(/^\s*(?:walk\s*)?(\d+)\s*ft/i) || text.match(/(?:^|,)\s*(\d+)\s*ft/i);
  out.walk = walk ? num(walk[1]) : 30;
  for (const k of ["fly", "swim", "climb", "burrow"]) {
    const m = text.match(new RegExp(k + "\\s+(\\d+)\\s*ft", "i"));
    if (m) out[k] = num(m[1]);
  }
  if (/hover/i.test(text)) out.hover = true;
  return out;
}
export function parseProficiencyMap(value = "") {
  const out = {};
  for (const part of String(value).split(/[,;]/)) {
    const m = part.trim().match(/^(.+?)\s*([+-]\s*\d+)$/);
    if (m) out[m[1].trim().toLowerCase()] = num(m[2].replace(/\s/g, ""));
  }
  return out;
}
function listField(entry, ...names) { return field(entry, ...names).split(/[,;]/).map(x => x.trim()).filter(Boolean); }

export function parseDamage(text = "") {
  const m = String(text).match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\)?\s*([a-z]+)?\s+damage/i);
  return m ? {formula: m[1].replace(/\s/g, ""), type: (m[2] || "").toLowerCase()} : null;
}
export function parseAttack(text = "") {
  const t = String(text);
  const bonus = t.match(/([+-]\s*\d+)\s*to hit/i) || t.match(/attack roll:\s*([+-]\s*\d+)/i);
  const damage = parseDamage(t), range = t.match(/range\s*(\d+)(?:\s*\/\s*(\d+))?\s*f(?:ee)?t/i), reach = t.match(/reach\s*(\d+)\s*f(?:ee)?t/i);
  const save = t.match(/DC\s*(\d+)\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i);
  return {
    bonus: bonus ? num(bonus[1].replace(/\s/g, "")) : 0,
    hasAttack: !!bonus,
    damage,
    range: range ? num(range[1]) : reach ? num(reach[1]) : 5,
    longRange: range?.[2] ? num(range[2]) : null,
    save: save ? {dc: num(save[1]), ability: save[2].slice(0, 3).toLowerCase()} : null,
  };
}

export const SKILL_IDS = {acrobatics: "acr", "animal handling": "ani", arcana: "arc", athletics: "ath", deception: "dec", history: "his", insight: "ins", intimidation: "itm", investigation: "inv", medicine: "med", nature: "nat", perception: "prc", performance: "prf", persuasion: "per", religion: "rel", "sleight of hand": "slt", stealth: "ste", survival: "sur"};
const SKILL_ABILITY = {acr: "dex", ani: "wis", arc: "int", ath: "str", dec: "cha", his: "int", ins: "wis", itm: "cha", inv: "int", med: "wis", nat: "int", prc: "wis", prf: "cha", per: "cha", rel: "int", slt: "dex", ste: "dex", sur: "wis"};
const SIZES = {tiny: "tiny", small: "sm", medium: "med", large: "lg", huge: "huge", gargantuan: "grg"};

/** Split a trait list into known system keys and a custom remainder. */
function traitSet(entry, name, known) {
  const keys = known ? Object.keys(known) : null, value = [], custom = [];
  for (const part of listField(entry, name)) {
    const k = part.toLowerCase();
    if (keys ? keys.includes(k) : /^[a-z]+$/.test(k)) value.push(k); else custom.push(part);
  }
  return {value, custom: custom.join("; ")};
}

/** Proficiency level implied by a statblock total: 1 = proficient, 2 = expertise. */
function proficiencyLevel(total, abilityMod, pb) {
  if (total >= abilityMod + 2 * pb) return 2;
  return 1;
}

export function enrichActorSystem(entry, system, pb = 2) {
  const saves = parseProficiencyMap(field(entry, "Saving Throws", "Saves"));
  for (const key of Object.keys(saves)) {
    const id = key.slice(0, 3);
    if (system.abilities?.[id]) system.abilities[id].proficient = 1;
  }
  const skills = parseProficiencyMap(field(entry, "Skills"));
  system.skills = {};
  for (const [key, total] of Object.entries(skills)) {
    const id = SKILL_IDS[key];
    if (!id) continue;
    const abilityMod = mod(system.abilities?.[SKILL_ABILITY[id]]?.value ?? 10);
    system.skills[id] = {value: proficiencyLevel(total, abilityMod, pb)};
  }
  const D = globalThis.CONFIG?.DND5E;
  system.traits = {
    ...(system.traits || {}),
    languages: {value: [], custom: field(entry, "Languages")},
    di: traitSet(entry, "Damage Immunities", D?.damageTypes),
    dr: traitSet(entry, "Damage Resistances", D?.damageTypes),
    dv: traitSet(entry, "Damage Vulnerabilities", D?.damageTypes),
    ci: traitSet(entry, "Condition Immunities", D?.conditionTypes),
  };
  const size = SIZES[field(entry, "Size").toLowerCase().trim()];
  if (size) system.traits.size = size;
  system.attributes = system.attributes || {};
  system.attributes.senses = {...(system.attributes.senses || {}), special: field(entry, "Senses")};
  return system;
}

export function actorData(entry, folder) {
  const creature = entry.kind === "Creature";
  const hpText = field(entry, "Hit Points", "HP");
  const hp = Math.max(1, num(hpText, 1));
  const hpFormula = hpText.match(/\(([^)]*\d+d\d+[^)]*)\)/)?.[1]?.replace(/\s+/g, " ").trim() || "";
  const ac = num(field(entry, "Armor Class", "AC"), 10);
  const cr = parseCR(field(entry, "Challenge", "CR", "Challenge Rating"));
  const abilities = Object.fromEntries(Object.keys(ABILITY_NAMES).map(k => [k, {value: ability(entry, k)}]));
  const typeText = field(entry, "Type", "Creature Type").toLowerCase().trim();
  const knownType = Object.keys(globalThis.CONFIG?.DND5E?.creatureTypes || {}).find(t => typeText === t || typeText.startsWith(t + " "));
  const system = enrichActorSystem(entry, {
    abilities,
    attributes: {ac: {flat: ac, calc: "flat"}, hp: {value: hp, max: hp, ...(hpFormula ? {formula: hpFormula} : {})}, movement: parseSpeed(field(entry, "Speed"))},
    details: {cr, biography: {value: loreHtml(entry)}, type: knownType ? {value: knownType} : {value: creature ? "custom" : "humanoid", custom: creature ? (typeText ? typeText.replace(/\b\w/g, c => c.toUpperCase()) : "Creature") : ""}},
  }, proficiencyForCR(cr));
  const data = {name: entry.name, type: "npc", ownership: ownership(entry), flags: sourceFlag(entry), system};
  if (folder) data.folder = folder.id ?? folder;
  return data;
}

const ACTIVATION = [[/legendary/i, "legendary"], [/lair/i, "lair"], [/bonus/i, "bonus"], [/reaction/i, "reaction"], [/action/i, "action"]];
export function featureItems(entry) {
  const sections = entry.dnd5e?.sections || {}, out = [];
  for (const [section, rows] of Object.entries(sections)) {
    if (!Array.isArray(rows)) continue;
    const activation = ACTIVATION.find(([re]) => re.test(section))?.[1] || "";
    for (const row of rows) {
      const name = String(row?.name || "").trim().replace(/[.:]+$/, "").trim();
      if (!name) continue;
      const text = String(row?.text || "");
      const attack = parseAttack(text);
      const isAttack = attack.hasAttack && !!attack.damage;
      const system = {description: {value: textToHtml(text)}};
      if (activation) system.activation = {type: activation, cost: 1};
      if (isAttack) {
        const ranged = /ranged|range\s+\d+/i.test(text);
        Object.assign(system, {
          type: {value: "natural"}, equipped: true, proficient: 1,
          actionType: ranged ? "rwak" : "mwak",
          attack: {bonus: String(attack.bonus)},
          range: {value: attack.range, long: attack.longRange, units: "ft"},
          damage: {parts: [[attack.damage.formula, attack.damage.type]]},
        });
      } else if (attack.save) {
        Object.assign(system, {actionType: "save", save: {ability: attack.save.ability, dc: attack.save.dc, scaling: "flat"}});
        if (attack.damage) system.damage = {parts: [[attack.damage.formula, attack.damage.type]]};
      }
      out.push({name, type: isAttack ? "weapon" : "feat", system, flags: {[MODULE_ID]: {importedFeature: true, section}}});
    }
  }
  return out;
}

export function itemData(entry, folder) {
  const want = entry.itemType || "loot";
  const type = pickItemType(want, want === "race" ? "species" : want, "loot", "equipment") || "loot";
  const data = {name: entry.name, type, ownership: ownership(entry), flags: sourceFlag(entry), system: {description: {value: loreHtml(entry)}}};
  if (folder) data.folder = folder.id ?? folder;
  return data;
}

/* ----------------------------------------------------- documents & import */

export function loreHtml(entry) {
  if (entry.html) return cleanHtml(String(entry.html));
  return markdownToHtml(entry.body || "");
}
/**
 * Lore bodies are Markdown (headings, **bold**, lists). Foundry ships showdown,
 * so render it properly when available; otherwise fall back to escaped paragraphs.
 */
export function markdownToHtml(text) {
  const md = globalThis.showdown;
  if (!md?.Converter || !String(text).trim()) return textToHtml(text);
  try {
    const converter = new md.Converter({tables: true, strikethrough: true, simpleLineBreaks: true, noHeaderId: true, openLinksInNewWindow: true});
    // Escape raw HTML first: package text is data, not markup.
    return cleanHtml(converter.makeHtml(esc(String(text)).replace(/&gt;/g, ">")));
  } catch { return textToHtml(text); }
}
/** Strip active content from package-supplied HTML before it reaches a journal. */
export function cleanHtml(html) {
  const clean = globalThis.foundry?.utils?.cleanHTML;
  if (typeof clean === "function") { try { return clean(html); } catch { /* fall through */ } }
  return String(html)
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|iframe|object|embed)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, "$1=\"#\"");
}

export function ownership(entry) {
  const observer = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  const none = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0;
  return {default: entry.visibility === "Player" ? observer : none};
}

export async function ensureFolder(name, type, parent = null) {
  const folderName = String(name || "Imported").trim().slice(0, 128) || "Imported";
  const parentId = parent?.id ?? parent ?? null;
  const existing = game.folders?.find(f => f.name === folderName && f.type === type && (f.folder?.id ?? f.folder ?? null) === parentId);
  if (existing) return existing;
  return Folder.create({name: folderName, type, folder: parentId});
}

export function importedByName(name, index) {
  const wanted = String(name || "").toLowerCase();
  if (!wanted) return null;
  for (const collection of [game.journal, game.actors, game.items]) {
    const found = collection?.find(d => String(d.name || "").toLowerCase() === wanted && d.getFlag?.(MODULE_ID, "sourceId"));
    if (found) return found;
  }
  return null;
}

/** Upload an embedded data: image so it can be used as a document image. */
export async function resolveImage(entry) {
  const img = entry.image;
  if (!img) return undefined;
  if (!/^data:/i.test(img)) return /^(javascript|vbscript):/i.test(img.trim()) ? undefined : img;
  const match = img.match(/^data:(image\/(png|jpe?g|webp|gif|svg\+xml|avif));base64,(.+)$/i);
  if (!match || match[3].length * 0.75 > 8 * 1024 * 1024) return undefined;
  const FP = globalThis.foundry?.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker?.implementation;
  if (!FP?.upload || typeof File === "undefined") return undefined;
  try {
    const bytes = Uint8Array.from(atob(match[3]), c => c.charCodeAt(0));
    const ext = match[2].toLowerCase().replace("jpeg", "jpg").replace("svg+xml", "svg");
    const dir = `worlds/${game.world?.id ?? "world"}/rpg-book-builder`;
    try { await FP.createDirectory("data", dir); } catch { /* already exists */ }
    const file = new File([bytes], `${slug(entry.id)}.${ext}`, {type: match[1]});
    const res = await FP.upload("data", dir, file, {}, {notify: false});
    return res?.path || undefined;
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not upload image for ${entry.name}`, err);
    return undefined;
  }
}

async function upsertJournal(entry, folder, old) {
  const data = {name: entry.name, ownership: ownership(entry), flags: sourceFlag(entry)};
  const content = loreHtml(entry);
  if (old) {
    await old.update(data);
    const page = old.pages?.contents?.[0];
    if (page) await page.update({name: entry.name, "text.content": content});
    else await old.createEmbeddedDocuments("JournalEntryPage", [{name: entry.name, type: "text", text: {format: 1, content}}]);
    return {doc: old, updated: true};
  }
  const doc = await JournalEntry.create({...data, folder: folder?.id ?? null, pages: [{name: entry.name, type: "text", text: {format: 1, content}}]});
  return {doc, updated: false};
}

async function upsertActor(entry, folder, old) {
  const data = actorData(entry, old ? null : folder);
  const img = await resolveImage(entry);
  if (img) data.img = img;
  let doc, updated = false;
  if (old) { await old.update(data); doc = old; updated = true; }
  else doc = await Actor.implementation.create(data);
  const features = featureItems(entry);
  const previous = doc.items?.filter?.(i => i.getFlag?.(MODULE_ID, "importedFeature")) || [];
  // Create the new set first so a failure never leaves the actor with no features.
  if (features.length) await doc.createEmbeddedDocuments("Item", features);
  if (previous.length) await doc.deleteEmbeddedDocuments("Item", previous.map(i => i.id));
  return {doc, updated};
}

async function upsertItem(entry, folder, old) {
  const data = itemData(entry, old ? null : folder);
  const img = await resolveImage(entry);
  if (img) data.img = img;
  if (old) { delete data.type; await old.update(data); return {doc: old, updated: true}; }
  return {doc: await Item.implementation.create(data), updated: false};
}

/** Replace `@Name` mentions with UUID links. Longer names first so "@Port Stell" beats "@Port". */
export function linkContent(content, links, resolve) {
  let out = String(content || "");
  for (const linkName of [...links].sort((a, b) => b.length - a.length)) {
    const target = resolve(linkName);
    if (!target?.uuid) continue;
    out = out.split(`@${linkName}`).join(`@UUID[${target.uuid}]{${linkName}}`);
  }
  return out;
}

/**
 * Import (create or update) every changed entry. One bad entry no longer
 * aborts the rest: failures are collected and reported.
 */
export async function importPackage(data, options = {}) {
  if (!game.user?.isGM) throw new Error("Only a GM can import lore.");
  // Imports share folders and source ids; running two at once would duplicate both.
  return serialize("import", () => runImport(data, options));
}

async function runImport(data, {onProgress} = {}) {
  const pkg = normalizePackage(data);
  const index = buildSourceIndex();
  const valid = pkg.entries.filter(e => e.name);
  const active = valid.filter(e => entryStatus(e, index) !== "Unchanged");
  const result = {created: 0, updated: 0, unchanged: valid.length - active.length, skipped: pkg.entries.length - valid.length, failed: [], total: pkg.entries.length};
  if (!active.length) return result;
  const rootName = pkg.title;
  const roots = {};
  const folderType = {Journal: "JournalEntry", Actor: "Actor", Item: "Item"};
  const byName = new Map(), journals = [];
  let done = 0;
  for (const entry of active) {
    const kind = targetType(entry);
    try {
      roots[kind] ??= await ensureFolder(rootName, folderType[kind]);
      const folder = await ensureFolder(entry.kind || "Lore", folderType[kind], roots[kind]);
      const old = index[kind].get(entry.id) || null;
      const r = kind === "Actor" ? await upsertActor(entry, folder, old) : kind === "Item" ? await upsertItem(entry, folder, old) : await upsertJournal(entry, folder, old);
      index[kind].set(entry.id, r.doc);
      byName.set(entry.name.toLowerCase(), r.doc);
      if (kind === "Journal") journals.push([entry, r.doc]);
      r.updated ? result.updated++ : result.created++;
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to import "${entry.name}"`, error);
      result.failed.push({name: entry.name, error: error?.message || String(error)});
    }
    onProgress?.(++done, active.length, entry);
  }
  const resolve = name => byName.get(String(name).toLowerCase()) || importedByName(name);
  for (const [entry, doc] of journals) {
    if (!entry.links.length) continue;
    const page = doc.pages?.contents?.[0];
    if (!page) continue;
    const before = page.text?.content || "";
    const after = linkContent(before, entry.links, resolve);
    if (after !== before) {
      try { await page.update({"text.content": after}); }
      catch (error) { console.warn(`${MODULE_ID} | Could not link "${entry.name}"`, error); }
    }
  }
  return result;
}

export async function importPlainLore(title, text) { return importPackage(plainLorePackage(title, text)); }

/* ------------------------------------------------------------ file picking */

/** Read a File into a package (JSON first, Markdown/text fallback). */
export async function packageFromFile(file) {
  if (!file) throw new Error("No file chosen.");
  if (file.size > MAX_FILE_BYTES) throw new Error(`That file is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MAX_FILE_BYTES / 1048576} MB.`);
  const raw = await file.text();
  const title = String(file.name || "Imported Lore").replace(/\.[^.]+$/, "");
  if (/\.(md|markdown|txt)$/i.test(file.name || "")) return plainLorePackage(title, raw);
  let data;
  try { data = JSON.parse(raw.replace(/^﻿/, "")); }
  catch { return plainLorePackage(title, raw); }
  validatePackage(data);
  return data;
}

export function choosePackage() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.rpgfoundry,.md,.markdown,.txt,application/json,text/plain,text/markdown";
  input.addEventListener("change", async () => {
    try { await showPreview(await packageFromFile(input.files?.[0])); }
    catch (error) {
      console.error(`${MODULE_ID} | Import failed`, error);
      ui.notifications.error(error?.message || "Lore import failed.");
    }
  }, {once: true});
  input.click();
}

/* ------------------------------------------------------- Import Manager UI */

const TARGET_ICON = {Journal: "fa-solid fa-book-open", Actor: "fa-solid fa-dragon", Item: "fa-solid fa-gem"};

let ImportManagerClass = null;
function importManagerClass() {
  if (ImportManagerClass) return ImportManagerClass;
  const Base = companionApplication();
  ImportManagerClass = class ImportManager extends Base {
    static DEFAULT_OPTIONS = {
      classes: ["rpgbb-import"],
      window: {title: "RPG Book Builder · Import Manager", icon: "fa-solid fa-book-medical"},
      position: {width: 720, height: 760},
    };
    constructor(pkg, resolve, options = {}) {
      // Each file gets its own window, so ids must be unique.
      super({id: `rpgbb-import-${foundry.utils.randomID()}`, ...options, position: {...fitToViewport(720, 760), ...(options.position || {})}});
      this.pkg = normalizePackage(pkg);
      this.resolve = resolve;
      const index = buildSourceIndex();
      this.rows = this.pkg.entries.map((entry, i) => ({i, entry, status: entryStatus(entry, index), target: targetType(entry)}));
      this.selected = new Set(this.rows.filter(r => r.status === "New" || r.status === "Update").map(r => r.i));
      this.filter = {status: "all", target: "all", query: ""};
      this.phase = "review";
      this.result = null;
    }
    get counts() {
      const c = {Journal: 0, Actor: 0, Item: 0, New: 0, Update: 0, Unchanged: 0, Invalid: 0};
      for (const r of this.rows) { c[r.status]++; if (r.status !== "Invalid") c[r.target]++; }
      return c;
    }
    renderBody() {
      if (this.phase === "done") return this.renderResult();
      const c = this.counts, pkg = this.pkg;
      const chip = (key, label, value, cls = "") => `<button type="button" class="rpgbb-chip ${cls} ${this.filter.status === key ? "active" : ""}" data-filter-status="${key}">${esc(label)}<b>${value}</b></button>`;
      const tab = (key, label) => `<button type="button" class="${this.filter.target === key ? "active" : ""}" data-filter-target="${key}">${label}</button>`;
      const rows = this.rows.map(r => {
        const e = r.entry, disabled = r.status === "Unchanged" || r.status === "Invalid";
        return `<label class="rpgbb-row status-${r.status.toLowerCase()}" data-row="${r.i}" data-status="${r.status}" data-target="${r.target}" data-search="${esc((e.name + " " + e.kind).toLowerCase())}">
          <input type="checkbox" data-entry="${r.i}" ${this.selected.has(r.i) ? "checked" : ""} ${disabled ? "disabled" : ""}>
          <i class="${TARGET_ICON[r.target]} rpgbb-row-icon" title="${r.target}" inert></i>
          <span class="rpgbb-row-text"><b>${esc(e.name || "Untitled entry")}</b><small>${esc(e.kind)} · ${esc(e.visibility)}${e.links.length ? ` · ${e.links.length} link${e.links.length === 1 ? "" : "s"}` : ""}</small></span>
          <em class="rpgbb-badge ${r.status.toLowerCase()}">${r.status === "Invalid" ? "No name" : r.status}</em>
        </label>`;
      }).join("");
      const busy = this.phase === "importing";
      return `<section class="rpgbb-shell">
        <header class="rpgbb-hero">
          <div><small>Package</small><h2>${esc(pkg.title)}</h2><p>${this.rows.length} entr${this.rows.length === 1 ? "y" : "ies"} · ${c.Journal} journal · ${c.Actor} actor · ${c.Item} item</p></div>
          <i class="fa-solid fa-scroll" inert></i>
        </header>
        <nav class="rpgbb-chips">${chip("all", "All", this.rows.length)}${chip("New", "New", c.New, "new")}${chip("Update", "Update", c.Update, "update")}${chip("Unchanged", "Unchanged", c.Unchanged, "unchanged")}${c.Invalid ? chip("Invalid", "Skipped", c.Invalid, "invalid") : ""}</nav>
        <div class="rpgbb-toolbar">
          <div class="rpgbb-tabs">${tab("all", "Everything")}${c.Journal ? tab("Journal", "Journals") : ""}${c.Actor ? tab("Actor", "Actors") : ""}${c.Item ? tab("Item", "Items") : ""}</div>
          <input type="search" data-query placeholder="Filter by name or kind…" value="${esc(this.filter.query)}" aria-label="Filter entries">
        </div>
        <div class="rpgbb-select-bar"><button type="button" data-select="visible">Select shown</button><button type="button" data-select="none">Clear</button><span data-selected-count></span></div>
        <div class="rpgbb-rows" data-keep-scroll="rows">${rows || '<p class="rpgbb-empty">This package is empty.</p>'}<p class="rpgbb-empty" data-no-match hidden>No entries match the current filter.</p></div>
        <footer class="rpgbb-footer">
          <div class="rpgbb-progress" ${busy ? "" : "hidden"}><div data-progress-bar></div><span data-progress-text>Preparing…</span></div>
          <button type="button" data-action-btn="cancel" ${busy ? "disabled" : ""}>Cancel</button>
          <button type="button" class="rpgbb-primary" data-action-btn="import" ${busy ? "disabled" : ""}><i class="fa-solid fa-file-import" inert></i> <span data-import-label>Import</span></button>
        </footer>
      </section>`;
    }
    renderResult() {
      const r = this.result;
      const failed = r.failed.length ? `<div class="rpgbb-failures"><h3><i class="fa-solid fa-triangle-exclamation" inert></i> ${r.failed.length} entr${r.failed.length === 1 ? "y" : "ies"} could not be imported</h3><ul>${r.failed.map(f => `<li><b>${esc(f.name)}</b><small>${esc(f.error)}</small></li>`).join("")}</ul></div>` : "";
      return `<section class="rpgbb-shell rpgbb-done">
        <header class="rpgbb-hero"><div><small>Import complete</small><h2>${esc(this.pkg.title)}</h2></div><i class="fa-solid ${r.failed.length ? "fa-circle-exclamation" : "fa-circle-check"}" inert></i></header>
        <div class="rpgbb-stats"><div><b>${r.created}</b><span>Created</span></div><div><b>${r.updated}</b><span>Updated</span></div><div><b>${r.unchanged}</b><span>Unchanged</span></div><div class="${r.failed.length ? "bad" : ""}"><b>${r.failed.length}</b><span>Failed</span></div></div>
        ${failed}
        <footer class="rpgbb-footer"><button type="button" class="rpgbb-primary" data-action-btn="close">Done</button></footer>
      </section>`;
    }
    activate(root) {
      root.querySelectorAll("[data-filter-status]").forEach(b => b.addEventListener("click", () => { this.filter.status = b.dataset.filterStatus; this.syncFilter(); }));
      root.querySelectorAll("[data-filter-target]").forEach(b => b.addEventListener("click", () => { this.filter.target = b.dataset.filterTarget; this.syncFilter(); }));
      root.querySelector("[data-query]")?.addEventListener("input", e => { this.filter.query = e.target.value; this.syncFilter(); });
      root.querySelectorAll("input[data-entry]").forEach(box => box.addEventListener("change", () => {
        const i = Number(box.dataset.entry);
        box.checked ? this.selected.add(i) : this.selected.delete(i);
        this.syncCount();
      }));
      root.querySelector('[data-select="visible"]')?.addEventListener("click", () => this.setVisible(true));
      root.querySelector('[data-select="none"]')?.addEventListener("click", () => this.setVisible(false, true));
      root.querySelector('[data-action-btn="cancel"]')?.addEventListener("click", () => this.close());
      root.querySelector('[data-action-btn="close"]')?.addEventListener("click", () => this.close());
      root.querySelector('[data-action-btn="import"]')?.addEventListener("click", () => this.runImport());
      this.syncFilter();
    }
    visibleRows() {
      const q = this.filter.query.trim().toLowerCase();
      return [...this.element.querySelectorAll("[data-row]")].filter(row =>
        (this.filter.status === "all" || row.dataset.status === this.filter.status)
        && (this.filter.target === "all" || row.dataset.target === this.filter.target)
        && (!q || row.dataset.search.includes(q)));
    }
    syncFilter() {
      const root = this.element; if (!root) return;
      const visible = new Set(this.visibleRows());
      root.querySelectorAll("[data-row]").forEach(row => { row.hidden = !visible.has(row); });
      root.querySelectorAll("[data-filter-status]").forEach(b => b.classList.toggle("active", b.dataset.filterStatus === this.filter.status));
      root.querySelectorAll("[data-filter-target]").forEach(b => b.classList.toggle("active", b.dataset.filterTarget === this.filter.target));
      const none = root.querySelector("[data-no-match]");
      if (none) none.hidden = visible.size > 0 || !this.rows.length;
      this.syncCount();
    }
    setVisible(checked, all = false) {
      const rows = all ? [...this.element.querySelectorAll("[data-row]")] : this.visibleRows();
      for (const row of rows) {
        const box = row.querySelector("input[data-entry]");
        if (!box || box.disabled) continue;
        box.checked = checked;
        checked ? this.selected.add(Number(box.dataset.entry)) : this.selected.delete(Number(box.dataset.entry));
      }
      this.syncCount();
    }
    syncCount() {
      const n = this.selected.size, root = this.element; if (!root) return;
      const label = root.querySelector("[data-import-label]");
      if (label) label.textContent = n ? `Import ${n} selected` : "Nothing selected";
      const btn = root.querySelector('[data-action-btn="import"]');
      if (btn && this.phase === "review") btn.disabled = !n;
      const count = root.querySelector("[data-selected-count]");
      if (count) count.textContent = `${n} of ${this.rows.length} selected`;
    }
    async runImport() {
      if (this.phase !== "review" || !this.selected.size) return;
      this.phase = "importing";
      const root = this.element;
      root.querySelectorAll("button, input").forEach(el => { el.disabled = true; });
      const progress = root.querySelector(".rpgbb-progress"); if (progress) progress.hidden = false;
      const selected = {...this.pkg, entries: [...this.selected].sort((a, b) => a - b).map(i => this.pkg.entries[i])};
      try {
        this.result = await importPackage(selected, {onProgress: (done, total, entry) => {
          const bar = root.querySelector("[data-progress-bar]"), text = root.querySelector("[data-progress-text]");
          if (bar) bar.style.width = `${Math.round(done / total * 100)}%`;
          if (text) text.textContent = `${done} / ${total} · ${entry.name}`;
        }});
        const r = this.result;
        const msg = `Import complete: ${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged${r.failed.length ? `, ${r.failed.length} failed` : ""}.`;
        r.failed.length ? ui.notifications.warn(msg) : ui.notifications.info(msg);
        this.phase = "done";
        this.render();
      } catch (error) {
        console.error(`${MODULE_ID} | Import failed`, error);
        ui.notifications.error(error?.message || "Import failed.");
        this.phase = "review";
        this.render();
      }
    }
    async close(options) {
      const out = await super.close(options);
      this.resolve?.(this.result);
      this.resolve = null;
      return out;
    }
  };
  return ImportManagerClass;
}

/** Open the Import Manager. Resolves with the import result, or null if closed without importing. */
export function showPreview(data) {
  const pkg = normalizePackage(data);
  return new Promise(resolve => {
    const Cls = importManagerClass();
    const app = new Cls(pkg, resolve);
    app.render({force: true});
  });
}

export function _resetImporterUi() { ImportManagerClass = null; }
