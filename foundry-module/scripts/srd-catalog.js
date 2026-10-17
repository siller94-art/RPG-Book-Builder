// Reads SRD content from the D&D 5e system's own compendiums (2014 SRD 5.1 / 2024 SRD 5.2.1).
import {MODULE_ID, extendApi} from "./shared.js";

export const RULES = {2014: "2014", 2024: "2024"};
export const ITEM_KINDS = new Set(["class", "subclass", "race", "species", "background", "feat", "spell", "weapon", "equipment", "consumable", "tool", "loot", "container"]);
/** Creator categories -> the Item types they include. */
export const KIND_GROUPS = {
  species: ["race", "species"],
  equipment: ["weapon", "equipment", "consumable", "tool", "loot", "container"],
};
/** Items that carry dnd5e advancement and should go through its manager. */
export const ADVANCEMENT_TYPES = new Set(["class", "subclass", "race", "species", "background"]);
export const MAX_RESULTS = 250;

const indexCache = new Map();

export function initSrdCatalog() {
  extendApi({getSrdCatalog, addSrdDocumentToActor, detectSrdRulesVersion});
  // Compendium contents can change mid-session (module enabled, pack edited).
  for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, doc => { if (doc?.pack) indexCache.delete(doc.pack); });
}

function versionFromText(text) {
  const t = String(text || "").toLowerCase();
  if (/2024|5\.2|5\.5|srd\s*5\.2|(^|[^0-9])24$|-24\b|\b24\b/.test(t)) return RULES[2024];
  if (/2014|5\.1|legacy/.test(t)) return RULES[2014];
  return null;
}

export function detectSrdRulesVersion(doc) {
  const rules = String(doc?.system?.source?.rules ?? "").trim();
  if (rules === "2024" || rules === "2014") return rules;
  const source = [doc?.system?.source?.book, doc?.system?.source?.revision, doc?.flags?.dnd5e?.source?.rules, doc?.flags?.dnd5e?.rulesVersion].filter(Boolean).join(" ");
  const fromSource = versionFromText(source);
  if (fromSource) return fromSource;
  const pack = String(doc?.pack || doc?.collectionName || "").toLowerCase();
  const fromPack = versionFromText(pack.split(".").pop());
  if (fromPack) return fromPack;
  if (/srd/.test(pack)) return RULES[2014];
  return null;
}

/** Version implied by the pack itself, used when an entry has no source metadata. */
export function packRulesVersion(pack) {
  const id = String(pack?.collection || pack?.metadata?.id || "").toLowerCase();
  const label = String(pack?.metadata?.label || pack?.title || "").toLowerCase();
  const v = versionFromText(id.split(".").pop()) || versionFromText(label);
  if (v) return v;
  // The system's own unsuffixed packs are the legacy 2014 SRD.
  if (isSystemPack(pack) || /srd/.test(id + " " + label)) return RULES[2014];
  return null;
}

function isSystemPack(pack) {
  const m = pack?.metadata || {};
  return (m.packageType === "system" && (!game.system?.id || m.packageName === game.system.id)) || String(pack?.collection || "").startsWith(`${game.system?.id || "dnd5e"}.`);
}

export function isSrdPack(pack) {
  if (pack?.documentName !== "Item") return false;
  const id = String(pack?.collection || pack?.metadata?.id || "").toLowerCase(), label = String(pack?.metadata?.label || "").toLowerCase();
  return isSystemPack(pack) || /\bsrd\b|srd/.test(id + " " + label);
}

async function packIndex(pack) {
  if (indexCache.has(pack.collection)) return indexCache.get(pack.collection);
  const promise = pack.getIndex({fields: ["type", "img", "system.source", "system.level", "system.identifier", "flags.dnd5e"]})
    .then(index => [...index])
    .catch(error => { indexCache.delete(pack.collection); console.warn(`${MODULE_ID} | Could not index ${pack.collection}`, error); return []; });
  indexCache.set(pack.collection, promise);
  return promise;
}

function wantedTypes(kind) {
  const k = String(kind || "").toLowerCase();
  if (!k) return null;
  return new Set(KIND_GROUPS[k] || [k]);
}

/**
 * Search the installed SRD compendiums.
 * Returns up to `limit` rows plus `total` (attached as a property) so callers can say "showing 250 of 900".
 */
export async function getSrdCatalog({rulesVersion = "2024", kind = "", query = "", limit = MAX_RESULTS} = {}) {
  rulesVersion = String(rulesVersion);
  if (!["2014", "2024"].includes(rulesVersion)) throw new Error("Rules version must be 2014 or 2024.");
  const q = String(query ?? "").trim().toLowerCase(), types = wantedTypes(kind), out = [];
  for (const pack of game.packs.filter(isSrdPack)) {
    const fallback = packRulesVersion(pack);
    for (const row of await packIndex(pack)) {
      const type = String(row?.type || "").toLowerCase();
      if (!ITEM_KINDS.has(type) || (types && !types.has(type))) continue;
      if (q && !String(row.name || "").toLowerCase().includes(q)) continue;
      const version = detectSrdRulesVersion({...row, pack: pack.collection}) || fallback;
      if (version !== rulesVersion) continue;
      out.push({
        uuid: row.uuid || `Compendium.${pack.collection}.Item.${row._id}`,
        name: String(row.name || "Unnamed"), type, img: row.img || "",
        level: row.system?.level ?? null,
        rulesVersion: version, pack: pack.metadata?.label || pack.collection,
      });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name) || a.pack.localeCompare(b.pack));
  const total = out.length, rows = out.slice(0, Math.max(1, limit));
  Object.defineProperty(rows, "total", {value: total, enumerable: false});
  return rows;
}

/**
 * Copy an SRD item onto an actor. Items with advancement (class, subclass,
 * species, background) go through the D&D 5e Advancement Manager so the
 * character actually gains their features, the same as dragging onto the sheet.
 */
export async function addSrdDocumentToActor(actor, uuid, {rulesVersion} = {}) {
  if (!actor || actor.documentName !== "Actor") throw new Error("Choose a Foundry Actor.");
  if (!actor.isOwner && !game.user.isGM) throw new Error("You do not own this character.");
  const source = await fromUuid(uuid);
  if (!source || source.documentName !== "Item") throw new Error("SRD item not found.");
  const version = detectSrdRulesVersion(source) || rulesVersion || null;
  const data = source.toObject();
  delete data._id;
  data.flags = {...(data.flags || {}), [MODULE_ID]: {...(data.flags?.[MODULE_ID] || {}), srd: true, rulesVersion: version, sourceUuid: uuid}};
  data._stats = {...(data._stats || {}), compendiumSource: uuid};

  const Manager = globalThis.dnd5e?.applications?.advancement?.AdvancementManager;
  if (ADVANCEMENT_TYPES.has(String(data.type)) && Manager?.forNewItem) {
    try {
      const manager = Manager.forNewItem(actor, data);
      if (manager?.steps?.length) {
        manager.render(true);
        return {pending: true, manager};
      }
    } catch (error) {
      console.warn(`${MODULE_ID} | Advancement unavailable for ${data.name}; adding directly.`, error);
    }
  }
  const [created] = await actor.createEmbeddedDocuments("Item", [data]);
  return created;
}

export function _clearSrdCache() { indexCache.clear(); }
