// Shared helpers for the RPG Book Builder Companion module.
export const MODULE_ID = "rpg-book-builder-companion";

const ESCAPES = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
/** Escape any value for safe insertion into HTML text or attribute values. */
export function esc(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, ch => ESCAPES[ch]);
}

/** Plain text -> paragraphs of escaped HTML. */
export function textToHtml(text = "") {
  const body = esc(text).replace(/\r\n/g, "\n").trim();
  if (!body) return "<p></p>";
  return body.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

/** Merge functions into the module's public API without clobbering other files' entries. */
export function extendApi(entries) {
  const mod = game.modules?.get?.(MODULE_ID);
  if (!mod) return;
  mod.api = Object.assign(mod.api || {}, entries);
}

/** Normalise a hook's html argument (HTMLElement in v13+, jQuery in older builds). */
export function rootOf(html) {
  if (typeof HTMLElement !== "undefined" && html instanceof HTMLElement) return html;
  return html?.[0] ?? html ?? null;
}

/**
 * Add a button to a sidebar directory header exactly once.
 * The key keeps re-renders from stacking duplicates.
 */
export function addHeaderButton(html, {key, label, icon, onClick, title = ""}) {
  const root = rootOf(html);
  if (!root?.querySelector || root.querySelector(`[data-rpgbb-button="${key}"]`)) return null;
  const host = root.querySelector(".directory-header .header-actions") || root.querySelector(".directory-header");
  if (!host) return null;
  let bar = host.querySelector(".rpgbb-header-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "rpgbb-header-bar";
    host.append(bar);
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rpgbb-header-button";
  button.dataset.rpgbbButton = key;
  if (title) button.title = title;
  button.innerHTML = `<i class="${esc(icon)}" inert></i><span>${esc(label)}</span>`;
  button.addEventListener("click", event => { event.preventDefault(); onClick(event); });
  bar.append(button);
  return button;
}

/** The single GM client responsible for writing shared state. */
export function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  const active = game.users?.activeGM;
  if (active) return active.id === game.user.id;
  const gms = (game.users?.filter?.(u => u.isGM && u.active) || []).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return !gms.length || gms[0].id === game.user.id;
}

export function hasActiveGM() {
  if (game.users?.activeGM) return true;
  return !!game.users?.some?.(u => u.isGM && u.active);
}

/** Size a window so it never spills past the viewport. */
export function fitToViewport(width, height) {
  const vw = globalThis.innerWidth || width, vh = globalThis.innerHeight || height;
  return {width: Math.max(320, Math.min(width, vw - 40)), height: Math.max(320, Math.min(height, vh - 60))};
}

let appBase = null;
/**
 * Lazily build the ApplicationV2 base class (Foundry's namespace is only
 * guaranteed once the game boots). Subclasses implement `renderBody(context)`
 * returning an HTML string and may override `activate(root)` for listeners.
 */
export function companionApplication() {
  if (appBase) return appBase;
  const {ApplicationV2} = foundry.applications.api;
  appBase = class CompanionApplication extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      classes: ["rpgbb", "rpgbb-app"],
      window: {resizable: true},
    };
    async _renderHTML(context) { return this.renderBody(context); }
    _replaceHTML(result, content) {
      const scroll = [...content.querySelectorAll("[data-keep-scroll]")].map(el => [el.dataset.keepScroll, el.scrollTop]);
      content.innerHTML = result;
      for (const [key, top] of scroll) {
        const el = content.querySelector(`[data-keep-scroll="${key}"]`);
        if (el) el.scrollTop = top;
      }
    }
    _onRender(context, options) {
      super._onRender?.(context, options);
      this.activate(this.element);
    }
    renderBody() { return ""; }
    activate() {}
  };
  return appBase;
}

/** Reset the cached base class (tests swap the Foundry stub between suites). */
export function _resetApplicationBase() { appBase = null; }

export function formatDate(ms) {
  if (!ms) return "";
  try { return new Date(ms).toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"}); }
  catch { return ""; }
}

const queues = new Map();
/** Run async work one-at-a-time per key, so overlapping clicks or imports can't race. */
export function serialize(key, fn) {
  const prev = queues.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  queues.set(key, tail);
  tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
  return run;
}

/** Short, stable, non-cryptographic hash (FNV-1a) for ids derived from text. */
export function hashText(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
