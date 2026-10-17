// A small, strict stand-in for the Foundry VTT v14 client API.
// It is not Foundry — it models the parts the companion module touches and
// validates data the way Foundry's DataModels would reject it, so bad payloads
// fail in tests instead of in someone's world.

let idCounter = 0;
const randomID = () => `id${(++idCounter).toString(36).padStart(14, "0")}`;
const deepClone = v => v === undefined ? v : structuredClone(v);

function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts.slice(0, -1)) cur = cur[p] ??= {};
  cur[parts.at(-1)] = value;
}
function merge(target, source) {
  for (const [k, v] of Object.entries(source || {})) {
    if (k.includes(".")) { setPath(target, k, deepClone(v)); continue; }
    if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) merge(target[k], v);
    else target[k] = deepClone(v);
  }
  return target;
}

export class MockCollection extends Array {
  get(id) { return this.find(d => d.id === id) ?? undefined; }
  get contents() { return [...this]; }
  static get [Symbol.species]() { return Array; }
}

export function createFoundryMock({system = "dnd5e", itemTypes = ["weapon", "equipment", "consumable", "tool", "loot", "container", "feat", "spell", "class", "subclass", "background", "race"], strict = true} = {}) {
  const log = {created: [], updated: [], deleted: [], socket: [], notifications: []};
  const hooks = new Map();
  let hookId = 0;
  const Hooks = {
    on(name, fn) { const id = ++hookId; if (!hooks.has(name)) hooks.set(name, new Map()); hooks.get(name).set(id, fn); return id; },
    once(name, fn) { const id = Hooks.on(name, (...a) => { Hooks.off(name, id); return fn(...a); }); return id; },
    off(name, id) { hooks.get(name)?.delete(id); },
    callAll(name, ...args) { for (const fn of [...(hooks.get(name)?.values() || [])]) fn(...args); },
  };

  const OWN = {NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3};

  class MockDocument {
    constructor(data, documentName, parent = null) {
      const d = deepClone(data);
      Object.assign(this, d);
      this.id = d._id || randomID();
      this.flags = d.flags || {};
      this.system = d.system || {};
      this.documentName = documentName;
      this.parent = parent;
      this.ownership = d.ownership || {default: 0};
    }
    get uuid() { return this.parent ? `${this.parent.uuid}.${this.documentName}.${this.id}` : `${this.documentName}.${this.id}`; }
    get isOwner() { return game.user.isGM || this.ownership[game.user.id] === OWN.OWNER || this.ownership.default === OWN.OWNER; }
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
    toObject() {
      const o = {};
      for (const [k, v] of Object.entries(this)) if (typeof v !== "function" && !["parent", "documentName", "items", "pages", "pack"].includes(k)) o[k] = v;
      const out = deepClone(o); out._id = this.id;
      if (this.items?.length) out.items = this.items.map(i => i.toObject());
      return out;
    }
    async update(data) {
      const clean = deepClone(data);
      validate(this.documentName, merge(deepClone(this.toObject()), clean), this);
      merge(this, clean);
      log.updated.push({doc: this, data: clean});
      Hooks.callAll(`update${this.documentName}`, this, clean);
      return this;
    }
  }

  function validate(documentName, data, existing) {
    if (!strict) return;
    if (typeof data.name !== "string" || !data.name.trim()) throw new Error(`${documentName} validation: name may not be blank`);
    if (data.img !== undefined && data.img !== null && typeof data.img === "string" && /^data:/i.test(data.img)) throw new Error(`${documentName} validation: img does not accept base64 data`);
    if (documentName === "Item") {
      if (!itemTypes.includes(data.type)) throw new Error(`Item validation: "${data.type}" is not a valid type for the ${system} system`);
    }
    if (documentName === "Actor" && system === "dnd5e") {
      if (!["character", "npc", "vehicle", "group"].includes(data.type)) throw new Error(`Actor validation: invalid type "${data.type}"`);
      const s = data.system || {};
      const num = (v, path) => { if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v))) throw new Error(`Actor validation: ${path} must be a finite number, got ${JSON.stringify(v)}`); };
      num(s.details?.cr, "system.details.cr");
      num(s.attributes?.ac?.flat, "system.attributes.ac.flat");
      num(s.attributes?.hp?.value, "system.attributes.hp.value");
      num(s.attributes?.hp?.max, "system.attributes.hp.max");
      for (const [k, v] of Object.entries(s.attributes?.movement || {})) if (k !== "units" && k !== "hover") num(v, `system.attributes.movement.${k}`);
      for (const [k, v] of Object.entries(s.abilities || {})) { num(v.value, `system.abilities.${k}.value`); if (v.proficient !== undefined && ![0, 0.5, 1].includes(v.proficient)) throw new Error("bad save proficiency"); }
      for (const [k, v] of Object.entries(s.skills || {})) if (![0, 0.5, 1, 2].includes(v.value)) throw new Error(`Actor validation: skills.${k}.value must be 0/0.5/1/2`);
    }
    if (documentName === "JournalEntryPage" && data.text && typeof data.text.content !== "string") throw new Error("page content must be a string");
  }

  function makeCollection() { return new MockCollection(); }
  const journal = makeCollection(), actors = makeCollection(), items = makeCollection(), folders = makeCollection();
  const collectionFor = {JournalEntry: journal, Actor: actors, Item: items, Folder: folders};

  function embedded(doc) {
    doc.items = new MockCollection();
    doc.pages = new MockCollection();
    doc.createEmbeddedDocuments = async (type, list) => {
      const out = [];
      for (const data of list) {
        validate(type, data);
        const child = new MockDocument(data, type, doc);
        (type === "JournalEntryPage" ? doc.pages : doc.items).push(child);
        out.push(child);
        log.created.push(child);
        Hooks.callAll(`create${type}`, child);
      }
      return out;
    };
    doc.deleteEmbeddedDocuments = async (type, ids) => {
      const coll = type === "JournalEntryPage" ? doc.pages : doc.items;
      for (const id of ids) { const i = coll.findIndex(x => x.id === id); if (i >= 0) { const [gone] = coll.splice(i, 1); log.deleted.push(gone); Hooks.callAll(`delete${type}`, gone); } }
      return ids;
    };
    return doc;
  }

  function docClass(documentName) {
    const create = async data => {
      if (!game.user.isGM && documentName !== "Item") throw new Error(`User lacks permission to create ${documentName}`);
      const clean = deepClone(data);
      await new Promise(r => setTimeout(r, 0));
      const pages = clean.pages; delete clean.pages;
      validate(documentName, clean);
      if (clean.folder && !folders.get(clean.folder)) throw new Error(`${documentName} validation: folder ${clean.folder} does not exist`);
      const doc = embedded(new MockDocument(clean, documentName));
      if (pages) for (const p of pages) { validate("JournalEntryPage", p); const page = new MockDocument(p, "JournalEntryPage", doc); doc.pages.push(page); }
      collectionFor[documentName].push(doc);
      log.created.push(doc);
      Hooks.callAll(`create${documentName}`, doc);
      return doc;
    };
    return {create, implementation: {create}};
  }

  const settingsDefs = new Map(), settingsValues = new Map();
  const settings = {
    register(ns, key, def) { settingsDefs.set(`${ns}.${key}`, def); },
    registerMenu() {},
    get(ns, key) {
      const k = `${ns}.${key}`;
      if (!settingsDefs.has(k)) throw new Error(`Setting ${k} is not registered`);
      return deepClone(settingsValues.has(k) ? settingsValues.get(k) : settingsDefs.get(k).default);
    },
    async set(ns, key, value) {
      const k = `${ns}.${key}`, def = settingsDefs.get(k);
      if (!def) throw new Error(`Setting ${k} is not registered`);
      if (def.scope === "world" && !game.user.isGM) throw new Error("Players cannot modify world settings");
      if (def.scope === "world") await new Promise(r => setTimeout(r, 1)); // server round-trip before the local value changes
      settingsValues.set(k, deepClone(value));
      def.onChange?.(deepClone(value));
      return value;
    },
  };

  const socketHandlers = new Map();
  const socket = {
    on(name, fn) { if (!socketHandlers.has(name)) socketHandlers.set(name, []); socketHandlers.get(name).push(fn); },
    emit(name, data) { log.socket.push({name, data: deepClone(data), from: game.user.id}); },
    /** Deliver everything queued so far as if every other client received it. */
    async flush(asUser) {
      const queue = log.socket.splice(0);
      for (const msg of queue) {
        const prev = game.user;
        if (asUser) game.user = asUser;
        try { for (const fn of socketHandlers.get(msg.name) || []) await fn(deepClone(msg.data), msg.from); }
        finally { game.user = prev; }
      }
      return queue.length;
    },
  };

  const users = new MockCollection();
  const gm = {id: "gm0000000000001", name: "Gamemaster", isGM: true, active: true};
  const player = {id: "pl0000000000001", name: "Riley", isGM: false, active: true};
  users.push(gm, player);
  Object.defineProperty(users, "activeGM", {get: () => users.find(u => u.isGM && u.active) || null});

  const packs = new MockCollection();
  const notify = level => msg => { log.notifications.push({level, msg}); };

  const game = {
    system: {id: system},
    world: {id: "test-world"},
    user: gm,
    users,
    modules: new Map([["rpg-book-builder-companion", {id: "rpg-book-builder-companion", active: true}]]),
    settings, socket, journal, actors, items, folders, packs,
    documentTypes: {Item: itemTypes, Actor: ["character", "npc", "vehicle", "group"]},
  };

  // ---- ApplicationV2 ----
  class ApplicationV2 {
    static DEFAULT_OPTIONS = {};
    constructor(options = {}) {
      const chain = [];
      for (let c = this.constructor; c && c !== Object; c = Object.getPrototypeOf(c)) if (Object.hasOwn(c, "DEFAULT_OPTIONS")) chain.unshift(c.DEFAULT_OPTIONS);
      this.options = chain.reduce((acc, o) => ({...acc, ...o, window: {...acc.window, ...o.window}, position: {...acc.position, ...o.position}, classes: [...(acc.classes || []), ...(o.classes || [])]}), {});
      this.options = {...this.options, ...options, window: {...this.options.window, ...options.window}, position: {...this.options.position, ...options.position}};
      this.element = null;
      this._rendered = false;
      this.renderCount = 0;
    }
    get id() { return this.options.id; }
    get rendered() { return this._rendered; }
    get window() { return {title: this.options.window?.title}; }
    async render(options = {}) {
      if (!this._rendered && !(options === true || options.force)) return this;
      const context = await this._prepareContext?.(options) ?? {};
      const result = await this._renderHTML(context, options);
      const first = !this.element;
      if (first) {
        if (typeof document === "undefined") { this.element = null; }
        else {
          const el = document.createElement("div");
          el.className = ["application", ...(this.options.classes || [])].join(" ");
          el.id = this.options.id || "";
          const p = this.options.position || {};
          el.style.width = `${p.width}px`; el.style.height = `${p.height}px`;
          el.innerHTML = `<header class="window-header"><i class="window-icon ${this.options.window?.icon || ""}"></i><h1 class="window-title">${this.options.window?.title || ""}</h1><button type="button" class="header-control" data-close>×</button></header><section class="window-content"></section>`;
          el.querySelector("[data-close]").addEventListener("click", () => this.close());
          (globalThis.__appHost || document.body).append(el);
          this.element = el;
        }
      }
      this.lastHTML = result;
      if (this.element) this._replaceHTML(result, this.element.querySelector(".window-content"), options);
      this._rendered = true;
      this.renderCount++;
      if (first) await this._onFirstRender?.(context, options);
      await this._onRender?.(context, options);
      return this;
    }
    async close() { this.element?.remove(); this.element = null; this._rendered = false; this.closed = true; return this; }
    bringToFront() {}
    _onFirstRender() {}
    _onRender() {}
  }

  const globals = {
    game, Hooks,
    ui: {notifications: {info: notify("info"), warn: notify("warn"), error: notify("error")}},
    CONST: {DOCUMENT_OWNERSHIP_LEVELS: OWN},
    CONFIG: {DND5E: {
      damageTypes: Object.fromEntries("acid bludgeoning cold fire force lightning necrotic piercing poison psychic radiant slashing thunder".split(" ").map(k => [k, {}])),
      conditionTypes: Object.fromEntries("blinded charmed deafened exhaustion frightened grappled incapacitated invisible paralyzed petrified poisoned prone restrained stunned unconscious".split(" ").map(k => [k, {}])),
      creatureTypes: Object.fromEntries("aberration beast celestial construct dragon elemental fey fiend giant humanoid monstrosity ooze plant undead".split(" ").map(k => [k, {}])),
    }, Item: {}},
    foundry: {
      utils: {randomID, deepClone, mergeObject: (a, b) => merge(deepClone(a), b)},
      applications: {api: {ApplicationV2}},
    },
    JournalEntry: docClass("JournalEntry"),
    Actor: docClass("Actor"),
    Item: docClass("Item"),
    Folder: {create: async data => {
      await new Promise(r => setTimeout(r, 0));
      if (!["JournalEntry", "Actor", "Item"].includes(data.type)) throw new Error(`bad folder type ${data.type}`);
      if (data.folder && !folders.get(data.folder)) throw new Error("parent folder missing");
      const f = new MockDocument({...data, folder: data.folder ?? null}, "Folder");
      folders.push(f); log.created.push(f); return f;
    }},
    fromUuid: async uuid => {
      for (const pack of packs) { const doc = pack.docs?.find(d => d.uuid === uuid); if (doc) return doc; }
      for (const coll of [journal, actors, items]) { const doc = coll.find(d => d.uuid === uuid); if (doc) return doc; }
      return null;
    },
  };

  function install(target = globalThis) {
    for (const [k, v] of Object.entries(globals)) target[k] = v;
    return target;
  }

  /** Register an Item compendium the SRD catalog can read. */
  function addPack({collection, label, packageType = "system", packageName = "dnd5e", docs = []}) {
    const built = docs.map(d => {
      const id = d._id || randomID();
      const doc = new MockDocument({...d, _id: id}, "Item");
      Object.defineProperty(doc, "uuid", {get: () => `Compendium.${collection}.Item.${id}`});
      doc.pack = collection;
      return doc;
    });
    const pack = {
      collection, documentName: "Item", metadata: {id: collection, label, packageType, packageName},
      docs: built, indexCalls: 0,
      async getIndex() { pack.indexCalls++; return built.map(d => ({_id: d.id, uuid: d.uuid, name: d.name, type: d.type, img: d.img, system: {source: d.system?.source, level: d.system?.level}, flags: {dnd5e: d.flags?.dnd5e}})); },
    };
    packs.push(pack);
    return pack;
  }

  return {globals, install, log, game, Hooks, gm, player, addPack, MockDocument, embedded, validate};
}
