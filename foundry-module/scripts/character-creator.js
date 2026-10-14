// Guided D&D 5e character builder backed by the system's SRD compendiums.
import {MODULE_ID, esc, extendApi, addHeaderButton, companionApplication, fitToViewport} from "./shared.js";
import {getSrdCatalog, addSrdDocumentToActor, KIND_GROUPS} from "./srd-catalog.js";
import {openPlayerContentBuilder, DRAFT_SETTING} from "./approval.js";

export const STEPS = [
  {key: "species", label: "Species", icon: "fa-solid fa-dna", hint: "Your people and heritage."},
  {key: "background", label: "Background", icon: "fa-solid fa-scroll", hint: "Where you came from and what you learned."},
  {key: "class", label: "Class", icon: "fa-solid fa-shield-halved", hint: "Your calling. The Advancement prompts pick hit points and features."},
  {key: "subclass", label: "Subclass", icon: "fa-solid fa-code-branch", hint: "Specialise your class once you reach the right level."},
  {key: "feat", label: "Feats", icon: "fa-solid fa-star", hint: "Talents beyond your class."},
  {key: "spell", label: "Spell Book", icon: "fa-solid fa-book-open", hint: "Spells for casters. Search by name."},
  {key: "equipment", label: "Equipment & Items", icon: "fa-solid fa-bag-shopping", hint: "Weapons, armor, tools and gear."},
  {key: "review", label: "Review", icon: "fa-solid fa-clipboard-check", hint: "Everything currently on the sheet."},
];
const HOMEBREW_TYPE = {species: "species", spell: "spell"};
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
/** One copy is all a character can meaningfully have; gear and classes (multiclass levels) can repeat. */
const UNIQUE_TYPES = new Set(["spell", "feat", "race", "species", "background", "subclass"]);
const TYPE_ORDER = ["race", "species", "background", "class", "subclass", "feat", "spell", "weapon", "equipment", "consumable", "tool", "container", "loot"];

export function initCharacterCreator() { extendApi({openCharacterCreator, openQuickHomebrew}); }

export function addCreatorButton(html) {
  if (game.system?.id !== "dnd5e") return;
  addHeaderButton(html, {key: "creator", label: "Character Creator", icon: "fa-solid fa-dice-d20", title: "Build a character from the SRD", onClick: () => openCharacterCreator()});
}

export function ownedCharacters() {
  return (game.actors?.filter?.(a => a.type === "character" && (game.user.isGM || a.isOwner)) || []).sort((a, b) => a.name.localeCompare(b.name));
}

function actorSummary(actor) {
  const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
  const classes = items.filter(i => i.type === "class").map(i => `${i.name} ${i.system?.levels ?? ""}`.trim());
  const species = items.find(i => i.type === "race" || i.type === "species")?.name;
  const background = items.find(i => i.type === "background")?.name;
  return {items, classes, species, background};
}

let CreatorClass = null;
function creatorClass() {
  if (CreatorClass) return CreatorClass;
  const Base = companionApplication();
  CreatorClass = class CharacterCreator extends Base {
    static DEFAULT_OPTIONS = {
      id: "rpgbb-character-creator",
      classes: ["rpgbb-creator"],
      window: {title: "Character Creator", icon: "fa-solid fa-dice-d20"},
      position: {width: 1240, height: 800},
    };
    constructor(options = {}) {
      super({...options, position: {...fitToViewport(1240, 800), ...(options.position || {})}});
      const actors = ownedCharacters();
      this.state = {actorId: options.actorId && actors.some(a => a.id === options.actorId) ? options.actorId : actors[0]?.id, rulesVersion: "2024", step: 0, query: "", catalog: [], total: 0, loading: false, loadToken: 0, adding: new Set()};
      this.hooks = [];
    }
    get actor() { return game.actors.get(this.state.actorId); }
    get stepDef() { return STEPS[this.state.step]; }
    renderBody() {
      const s = this.state, actors = ownedCharacters(), step = this.stepDef;
      const nav = STEPS.map((x, i) => `<button type="button" data-step="${i}" class="${i === s.step ? "active" : ""}"><span>${i + 1}</span><i class="${x.icon}" inert></i>${esc(x.label)}</button>`).join("");
      const rules = ["2014", "2024"].map(v => `<button type="button" data-rules="${v}" class="${s.rulesVersion === v ? "active" : ""}" aria-pressed="${s.rulesVersion === v}">${v === "2014" ? "2014 · SRD 5.1" : "2024 · SRD 5.2.1"}</button>`).join("");
      const review = step.key === "review";
      return `<section class="rpgbb-creator-shell">
        <header class="rpgbb-creator-top">
          <div class="rpgbb-brand"><i class="fa-solid fa-dice-d20" inert></i><div><b>Character Creator</b><small>D&amp;D 5e · SRD</small></div></div>
          <div class="rpgbb-segment rpgbb-rules" role="group" aria-label="Rules version">${rules}</div>
          <label class="rpgbb-actor-pick"><span>Character</span><select data-actor>${actors.map(a => `<option value="${a.id}" ${a.id === s.actorId ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
        </header>
        <div class="rpgbb-creator-grid">
          <nav class="rpgbb-steps">${nav}</nav>
          <main class="rpgbb-catalog">
            <div class="rpgbb-catalog-head">
              <div><small>Step ${s.step + 1} of ${STEPS.length}</small><h2>${esc(step.label)}</h2><p>${esc(step.hint)}</p></div>
              ${review ? "" : `<div class="rpgbb-catalog-tools">
                <input type="search" data-search placeholder="Search ${esc(step.label.toLowerCase())}…" value="${esc(s.query)}" aria-label="Search">
                <button type="button" data-homebrew title="Write your own and send it to the GM"><i class="fa-solid fa-hammer" inert></i> Homebrew</button>
              </div>`}
            </div>
            <div class="rpgbb-result-meta" data-meta></div>
            <div class="rpgbb-card-grid" data-results data-keep-scroll="results"></div>
            <footer class="rpgbb-step-nav">
              <button type="button" data-prev ${s.step === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left" inert></i> Back</button>
              <button type="button" data-next class="rpgbb-primary" ${s.step === STEPS.length - 1 ? "disabled" : ""}>Next <i class="fa-solid fa-arrow-right" inert></i></button>
            </footer>
          </main>
          <aside class="rpgbb-sheet-preview" data-preview></aside>
        </div>
      </section>`;
    }
    activate(root) {
      root.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => this.goTo(Number(b.dataset.step))));
      root.querySelector("[data-prev]")?.addEventListener("click", () => this.goTo(this.state.step - 1));
      root.querySelector("[data-next]")?.addEventListener("click", () => this.goTo(this.state.step + 1));
      root.querySelectorAll("[data-rules]").forEach(b => b.addEventListener("click", () => {
        if (this.state.rulesVersion === b.dataset.rules) return;
        this.state.rulesVersion = b.dataset.rules;
        root.querySelectorAll("[data-rules]").forEach(x => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); });
        this.load();
      }));
      root.querySelector("[data-actor]")?.addEventListener("change", e => { this.state.actorId = e.target.value; this.watchActor(); this.refreshPreview(); this.refreshResults(); });
      root.querySelector("[data-homebrew]")?.addEventListener("click", () => openQuickHomebrew(this.stepDef.key));
      let timer;
      root.querySelector("[data-search]")?.addEventListener("input", e => { this.state.query = e.target.value; clearTimeout(timer); timer = setTimeout(() => this.load(), 180); });
      this.watchActor();
      this.refreshPreview();
      this.load();
    }
    goTo(step) {
      if (step < 0 || step >= STEPS.length || step === this.state.step) return;
      Object.assign(this.state, {step, query: "", catalog: [], total: 0});
      this.render();
    }
    watchActor() {
      for (const [hook, id] of this.hooks) Hooks.off(hook, id);
      this.hooks = [];
      const refresh = doc => {
        const actor = doc?.documentName === "Actor" ? doc : doc?.parent;
        if (actor?.id !== this.state.actorId) return;
        this.refreshPreview();
        this.refreshResults();
      };
      for (const hook of ["updateActor", "createItem", "updateItem", "deleteItem"]) this.hooks.push([hook, Hooks.on(hook, refresh)]);
    }
    async load() {
      const s = this.state, step = this.stepDef;
      if (step.key === "review") return this.refreshResults();
      const token = ++s.loadToken, {rulesVersion, query} = s;
      s.loading = true; this.refreshResults();
      let rows;
      try { rows = await getSrdCatalog({rulesVersion, kind: step.key, query}); }
      catch (error) {
        console.error(MODULE_ID, error);
        if (token === s.loadToken) { s.loading = false; s.catalog = []; s.total = 0; s.error = error?.message || "Could not load SRD content."; this.refreshResults(); }
        return;
      }
      if (token !== s.loadToken || !this.rendered) return; // a newer search won
      Object.assign(s, {catalog: rows, total: rows.total ?? rows.length, loading: false, error: null});
      this.refreshResults();
    }
    owned(row) {
      const types = new Set(KIND_GROUPS[row.type] || [row.type]);
      const name = row.name.toLowerCase();
      return actorSummary(this.actor).items.some(i => String(i.name).toLowerCase() === name && types.has(i.type));
    }
    refreshResults() {
      const root = this.element; if (!root) return;
      const box = root.querySelector("[data-results]"), meta = root.querySelector("[data-meta]"), s = this.state;
      if (!box) return;
      if (this.stepDef.key === "review") { box.innerHTML = this.reviewHtml(); meta.textContent = ""; return; }
      if (s.loading && !s.catalog.length) { box.innerHTML = `<p class="rpgbb-empty"><i class="fa-solid fa-spinner fa-spin" inert></i>Reading the D&amp;D 5e compendiums…</p>`; meta.textContent = ""; return; }
      if (s.error) { box.innerHTML = `<p class="rpgbb-empty bad"><i class="fa-solid fa-triangle-exclamation" inert></i>${esc(s.error)}</p>`; meta.textContent = ""; return; }
      if (!s.catalog.length) {
        box.innerHTML = `<p class="rpgbb-empty"><i class="fa-solid fa-magnifying-glass" inert></i>${s.query ? `Nothing matches “${esc(s.query)}”.` : `No ${s.rulesVersion} SRD ${esc(this.stepDef.label.toLowerCase())} found in the installed compendiums.`}<small>Try the other rules version, or write your own with Homebrew.</small></p>`;
        meta.textContent = "";
        return;
      }
      meta.textContent = s.total > s.catalog.length ? `Showing ${s.catalog.length} of ${s.total}. Search to narrow it down.` : `${s.total} result${s.total === 1 ? "" : "s"}`;
      box.innerHTML = s.catalog.map((x, i) => {
        const owned = this.owned(x), busy = s.adding.has(x.uuid);
        return `<article class="rpgbb-content-card ${owned ? "is-owned" : ""}">
          <img src="${esc(x.img || "icons/svg/item-bag.svg")}" alt="" loading="lazy">
          <div><b>${esc(x.name)}</b><small>${esc(x.type)}${x.level != null && x.type === "spell" ? ` · ${x.level === 0 ? "cantrip" : `level ${esc(x.level)}`}` : ""} · ${esc(x.pack)}</small></div>
          ${owned ? `<span class="rpgbb-owned"><i class="fa-solid fa-check" inert></i></span>` : ""}
          <button type="button" data-add="${i}" ${busy || !this.actor || (owned && UNIQUE_TYPES.has(x.type)) ? "disabled" : ""} title="${owned && UNIQUE_TYPES.has(x.type) ? "Already on the sheet" : `Add to ${esc(this.actor?.name || "character")}`}"><i class="fa-solid ${busy ? "fa-spinner fa-spin" : "fa-plus"}" inert></i></button>
        </article>`;
      }).join("");
      box.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => this.add(s.catalog[Number(b.dataset.add)])));
    }
    reviewHtml() {
      const actor = this.actor;
      if (!actor) return `<p class="rpgbb-empty">Choose a character.</p>`;
      const {items} = actorSummary(actor);
      if (!items.length) return `<p class="rpgbb-empty"><i class="fa-solid fa-feather" inert></i>${esc(actor.name)} has nothing on their sheet yet. Start with Species.</p>`;
      const groups = new Map();
      for (const item of items) { if (!groups.has(item.type)) groups.set(item.type, []); groups.get(item.type).push(item); }
      const ordered = [...groups.keys()].sort((a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99));
      return `<div class="rpgbb-review-groups">${ordered.map(type => `<section><h3>${esc(type)} <b>${groups.get(type).length}</b></h3><ul>${groups.get(type).sort((a, b) => a.name.localeCompare(b.name)).map(i => `<li><img src="${esc(i.img || "icons/svg/item-bag.svg")}" alt="">${esc(i.name)}</li>`).join("")}</ul></section>`).join("")}</div>`;
    }
    refreshPreview() {
      const root = this.element; if (!root) return;
      const box = root.querySelector("[data-preview]"); if (!box) return;
      const a = this.actor;
      if (!a) { box.innerHTML = `<p class="rpgbb-empty">No character selected.</p>`; return; }
      const {classes, species, background, items} = actorSummary(a);
      const abilities = ABILITIES.map(k => { const v = a.system?.abilities?.[k]?.value ?? 10, m = Math.floor((v - 10) / 2); return `<div><small>${k.toUpperCase()}</small><b>${esc(v)}</b><span>${m >= 0 ? "+" : ""}${m}</span></div>`; }).join("");
      const line = (label, value) => `<div class="rpgbb-line"><small>${label}</small><span class="${value ? "" : "missing"}">${esc(value || "Not chosen")}</span></div>`;
      box.innerHTML = `<div class="rpgbb-portrait"><img src="${esc(a.img || "icons/svg/mystery-man.svg")}" alt=""><div><b>${esc(a.name)}</b><small>${esc(classes.join(" / ") || "No class yet")} · ${this.state.rulesVersion} rules</small></div></div>
        ${line("Species", species)}${line("Background", background)}${line("Class", classes.join(" / "))}
        <div class="rpgbb-abilities">${abilities}</div>
        <div class="rpgbb-line"><small>On sheet</small><span>${items.length} item${items.length === 1 ? "" : "s"}</span></div>
        <button type="button" data-sheet><i class="fa-solid fa-id-card" inert></i> Open character sheet</button>
        <p class="rpgbb-hint">Ability scores, hit points and choices are set on the sheet or through the Advancement prompts.</p>`;
      box.querySelector("[data-sheet]").addEventListener("click", () => a.sheet?.render(true));
    }
    async add(row) {
      const a = this.actor, s = this.state;
      if (!row || !a || s.adding.has(row.uuid)) return;
      if (UNIQUE_TYPES.has(row.type) && this.owned(row)) { ui.notifications.info(`${a.name} already has ${row.name}.`); return; }
      s.adding.add(row.uuid); this.refreshResults();
      try {
        const result = await addSrdDocumentToActor(a, row.uuid, {rulesVersion: row.rulesVersion});
        if (result?.pending) ui.notifications.info(`Finish the ${row.name} advancement prompts to add it to ${a.name}.`);
        else ui.notifications.info(`${row.name} added to ${a.name}.`);
      } catch (error) {
        ui.notifications.error(error?.message || "Could not add content.");
      } finally {
        s.adding.delete(row.uuid);
        this.refreshResults();
      }
    }
    async close(options) {
      for (const [hook, id] of this.hooks) Hooks.off(hook, id);
      this.hooks = [];
      this.state.loadToken++;
      return super.close(options);
    }
  };
  return CreatorClass;
}

export function openCharacterCreator(options = {}) {
  if (game.system?.id !== "dnd5e") { ui.notifications.warn("The Character Creator needs the D&D 5e game system."); return null; }
  if (!ownedCharacters().length) { ui.notifications.warn("Create or get assigned a D&D 5e character Actor first."); return null; }
  if (current?.rendered) {
    if (options.actorId && ownedCharacters().some(a => a.id === options.actorId)) { current.state.actorId = options.actorId; current.render(); }
    current.bringToFront?.();
    return current;
  }
  current = new (creatorClass())(options);
  current.render({force: true});
  return current;
}
let current = null;

export async function openQuickHomebrew(kind = "spell") {
  const type = HOMEBREW_TYPE[kind] || "item";
  if (game.user.isGM) { ui.notifications.info("GMs can create the Item directly in the Items directory."); return null; }
  const draft = game.settings.get(MODULE_ID, DRAFT_SETTING) || {};
  // Don't wipe a draft the player is part-way through.
  if (!String(draft.name || "").trim() && !String(draft.description || "").trim() && !draft.submissionId) {
    await game.settings.set(MODULE_ID, DRAFT_SETTING, {type, name: "", description: "", submissionId: ""});
  }
  return openPlayerContentBuilder();
}

export function _resetCreatorUi() { CreatorClass = null; current = null; }
