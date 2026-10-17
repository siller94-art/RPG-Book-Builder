// Player-authored species, items and spells that need GM approval.
import {MODULE_ID, esc, textToHtml, extendApi, addHeaderButton, isResponsibleGM, hasActiveGM, companionApplication, fitToViewport, formatDate, serialize} from "./shared.js";
import {pickItemType, ensureFolder} from "./importer.js";

export const SETTING = "contentSubmissions";
export const DRAFT_SETTING = "contentDraft";
export const SOCKET = `module.${MODULE_ID}`;
export const ALLOWED_TYPES = new Set(["species", "item", "spell"]);
export const STATUS = Object.freeze({DRAFT: "draft", PENDING: "pending", APPROVED: "approved", CHANGES: "changes-requested", REJECTED: "rejected"});
export const LIMITS = Object.freeze({name: 120, description: 20000, note: 2000, pendingPerUser: 20});
let ACK_TIMEOUT_MS = 8000;
const TYPE_META = {
  species: {label: "Species", icon: "fa-solid fa-dna"},
  item: {label: "Item", icon: "fa-solid fa-gem"},
  spell: {label: "Spell", icon: "fa-solid fa-wand-sparkles"},
};
const STATUS_LABEL = {[STATUS.PENDING]: "Awaiting GM", [STATUS.APPROVED]: "Approved", [STATUS.CHANGES]: "Changes requested", [STATUS.REJECTED]: "Rejected", [STATUS.DRAFT]: "Draft"};
const PRESETS = {
  simple: "Describe what this does, when it can be used, and any limit such as once per short or long rest.",
  combat: "Action: Describe the attack or combat effect.\nRange: \nDamage/Effect: \nUses: ",
  utility: "Use: Describe the exploration, social, or utility effect.\nDuration: \nRange/Target: \nUses: ",
};
const EMPTY_DRAFT = {type: "species", name: "", description: "", submissionId: ""};

const openApps = new Set();
const pendingAcks = new Map();
let knownStatuses = new Map();

/* ------------------------------------------------------------- lifecycle */

export function registerApprovalSettings() {
  game.settings.register(MODULE_ID, DRAFT_SETTING, {name: "Player Content Draft", scope: "client", config: false, type: Object, default: {...EMPTY_DRAFT}});
  game.settings.register(MODULE_ID, SETTING, {
    name: "Player Content Submissions", scope: "world", config: false, type: Object, default: {submissions: []},
    onChange: () => {
      // A UI refresh must never make the settings write look like it failed.
      try { notifyStatusChanges(); refreshOpenApps(); } catch (error) { console.warn(`${MODULE_ID} | refresh failed`, error); }
    },
  });
}

export function initApproval() {
  game.socket.on(SOCKET, handleSocket);
  knownStatuses = statusMap();
  extendApi({openPlayerContentBuilder, openApprovalQueue, submitPlayerContent, listPlayerSubmissions, reviewSubmission});
  if (isResponsibleGM()) {
    const waiting = store().submissions.filter(s => s.status === STATUS.PENDING).length;
    if (waiting) ui.notifications.info(`${waiting} custom content submission${waiting === 1 ? " is" : "s are"} waiting for review.`);
  }
}

export function addApprovalButton(html) {
  const gm = game.user?.isGM;
  const pending = gm ? store().submissions.filter(s => s.status === STATUS.PENDING).length : 0;
  addHeaderButton(html, {
    key: "player-content",
    label: gm ? `Content Approval${pending ? ` (${pending})` : ""}` : "My Custom Content",
    icon: gm ? "fa-solid fa-user-check" : "fa-solid fa-wand-magic-sparkles",
    title: gm ? "Review player-submitted species, items and spells" : "Create a species, item or spell for GM approval",
    onClick: () => gm ? openApprovalQueue() : openPlayerContentBuilder(),
  });
}

function refreshOpenApps() {
  for (const app of openApps) app.render();
  if (!game.user?.isGM) return;
  const pending = store().submissions.filter(s => s.status === STATUS.PENDING).length;
  globalThis.document?.querySelectorAll('[data-rpgbb-button="player-content"] span').forEach(el => { el.textContent = `Content Approval${pending ? ` (${pending})` : ""}`; });
}

function statusMap() {
  return new Map(store().submissions.filter(s => s.userId === game.user?.id).map(s => [s.id, s.status]));
}
export function notifyStatusChanges() {
  if (game.user?.isGM) return;
  const now = statusMap();
  for (const s of listPlayerSubmissions()) {
    const before = knownStatuses.get(s.id);
    if (!before || before === s.status) continue;
    if (s.status === STATUS.APPROVED) ui.notifications.info(`Your GM approved ${s.content.name}. It's now in the Items directory.`);
    else if (s.status === STATUS.CHANGES) ui.notifications.warn(`Your GM asked for changes to ${s.content.name}.`);
    else if (s.status === STATUS.REJECTED) ui.notifications.warn(`Your GM rejected ${s.content.name}.`);
  }
  knownStatuses = now;
}

/* ------------------------------------------------------------ data store */

export function store() {
  const v = game.settings.get(MODULE_ID, SETTING);
  return v && Array.isArray(v.submissions) ? foundry.utils.deepClone(v) : {submissions: []};
}
export const HISTORY_LIMIT = 200;
async function saveStore(value) {
  if (!game.user.isGM) throw new Error("Only a GM can write the approval queue.");
  // Finished submissions accumulate forever otherwise; keep the newest for the History tab.
  const done = value.submissions.filter(s => s.status === STATUS.APPROVED || s.status === STATUS.REJECTED)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (done.length > HISTORY_LIMIT) {
    const drop = new Set(done.slice(HISTORY_LIMIT).map(s => s.id));
    value = {...value, submissions: value.submissions.filter(s => !drop.has(s.id))};
  }
  return game.settings.set(MODULE_ID, SETTING, value);
}
function cleanType(v) {
  v = String(v || "").toLowerCase();
  if (!ALLOWED_TYPES.has(v)) throw new Error("Only species, items, and spells can be submitted.");
  return v;
}
/** Player-supplied content is reduced to plain text fields; nothing else is trusted. */
export function sanitize(data) {
  if (!data || typeof data !== "object") throw new Error("Submission is empty.");
  const type = cleanType(data.type);
  const name = String(data.name ?? "").replace(/\s+/g, " ").trim();
  const description = String(data.description ?? "").replace(/\r\n?/g, "\n").trim();
  if (!name) throw new Error("Name is required.");
  if (name.length > LIMITS.name) throw new Error(`Name must be ${LIMITS.name} characters or fewer.`);
  if (description.length > LIMITS.description) throw new Error(`Description must be ${LIMITS.description.toLocaleString()} characters or fewer.`);
  return {type, name, description};
}
export function listPlayerSubmissions(userId = game.user.id) {
  return store().submissions.filter(x => x.userId === userId).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/* ------------------------------------------------------- player -> GM */

export async function submitPlayerContent(data, submissionId = "") {
  if (game.user.isGM) throw new Error("GM users should create content directly or review the queue.");
  const content = sanitize(data);
  const previous = submissionId ? listPlayerSubmissions().find(x => x.id === submissionId) : null;
  if (submissionId && !previous) throw new Error("That submission no longer exists.");
  if (previous && previous.status !== STATUS.CHANGES) throw new Error("Only content returned for changes can be resubmitted.");
  if (!hasActiveGM()) throw new Error("No GM is connected. Save a draft and submit when your GM is online.");
  const submission = {id: previous?.id || foundry.utils.randomID(), userId: game.user.id, userName: game.user.name, content};
  const requestId = foundry.utils.randomID();
  const ack = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pendingAcks.delete(requestId); reject(new Error("The GM didn't confirm the submission. Check that your GM is connected and the module is enabled, then try again.")); }, ACK_TIMEOUT_MS);
    pendingAcks.set(requestId, {resolve, reject, timer});
  });
  game.socket.emit(SOCKET, {action: "submit", requestId, submission});
  const result = await ack;
  ui.notifications.info(`${content.name} submitted to the GM for approval.`);
  return result;
}

export async function handleSocket(message, senderId) {
  if (!message || typeof message !== "object") return;
  if (message.action === "result") {
    if (message.userId !== game.user.id) return;
    const waiter = pendingAcks.get(message.requestId);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    pendingAcks.delete(message.requestId);
    return message.ok ? waiter.resolve(message.submission) : waiter.reject(new Error(message.error || "The GM could not accept this submission."));
  }
  if (message.action !== "submit" || !isResponsibleGM()) return;
  const userId = message.submission?.userId;
  const reply = (ok, extra = {}) => game.socket.emit(SOCKET, {action: "result", requestId: message.requestId, userId, ok, ...extra});
  try {
    const stored = await acceptSubmission(message.submission, senderId);
    reply(true, {submission: stored});
    ui.notifications.info(`New custom ${stored.content.type} from ${stored.userName}: ${stored.content.name}.`);
  } catch (error) {
    console.warn(`${MODULE_ID} | Rejected submission`, error);
    if (userId) reply(false, {error: error?.message || String(error)});
  }
}

/** GM side: validate a submission against who actually sent it, then store it. */
const ID_PATTERN = /^[A-Za-z0-9]{1,32}$/;
export async function acceptSubmission(raw, senderId) {
  const s = raw && typeof raw === "object" ? raw : {};
  if (typeof s.id !== "string" || !ID_PATTERN.test(s.id) || typeof s.userId !== "string" || !s.userId) throw new Error("Malformed submission.");
  if (senderId && senderId !== s.userId) throw new Error("Submission sender does not match its author.");
  const user = game.users?.get?.(s.userId);
  if (game.users && !user) throw new Error("Unknown user.");
  if (user?.isGM) throw new Error("GM users cannot submit to the queue.");
  const content = sanitize(s.content);
  return serialize("queue", () => storeSubmission(s, user, content));
}

async function storeSubmission(s, user, content) {
  const db = store();
  const existing = db.submissions.find(x => x.id === s.id);
  const now = Date.now();
  let stored;
  if (existing) {
    if (existing.userId !== s.userId) throw new Error("That submission belongs to someone else.");
    if (existing.status !== STATUS.CHANGES) throw new Error("Only content returned for changes can be resubmitted.");
    Object.assign(existing, {content, status: STATUS.PENDING, updatedAt: now, revision: (existing.revision || 1) + 1, gmNote: existing.gmNote || ""});
    stored = existing;
  } else {
    const pending = db.submissions.filter(x => x.userId === s.userId && x.status === STATUS.PENDING).length;
    if (pending >= LIMITS.pendingPerUser) throw new Error(`You already have ${pending} submissions waiting. Wait for your GM to review them.`);
    stored = {id: s.id, userId: s.userId, userName: user?.name || String(s.userName || "Player").slice(0, 80), content, status: STATUS.PENDING, createdAt: now, updatedAt: now, revision: 1, gmNote: ""};
    db.submissions.push(stored);
  }
  await saveStore(db);
  return stored;
}

/* ------------------------------------------------------------ GM review */

export async function reviewSubmission(submissionId, action, note = "") {
  if (!game.user.isGM) throw new Error("Only a GM can review submissions.");
  // Serialised with incoming submissions so a double-click can't approve twice
  // and a review can't overwrite a submission that arrived mid-write.
  return serialize("queue", () => applyReview(submissionId, action, note));
}

async function applyReview(submissionId, action, note) {
  const db = store(), s = db.submissions.find(x => x.id === submissionId);
  if (!s) throw new Error("Submission not found.");
  if (s.status === STATUS.APPROVED || s.status === STATUS.REJECTED) throw new Error(`${s.content.name} has already been ${s.status}.`);
  s.gmNote = String(note || "").trim().slice(0, LIMITS.note);
  s.updatedAt = Date.now();
  if (action === "approve") {
    const doc = await createApprovedDocument(s);
    s.status = STATUS.APPROVED;
    s.approvedDocumentUuid = doc.uuid;
    ui.notifications.info(`Approved ${s.content.name}.`);
  } else if (action === "changes") {
    if (!s.gmNote) throw new Error("Add a note telling the player what to change.");
    s.status = STATUS.CHANGES;
    ui.notifications.info(`${s.content.name} returned for changes.`);
  } else if (action === "reject") {
    s.status = STATUS.REJECTED;
    ui.notifications.info(`${s.content.name} rejected.`);
  } else throw new Error("Unknown review action.");
  await saveStore(db);
  return s;
}

export function approvedItemType(contentType) {
  if (contentType === "spell") return pickItemType("spell", "feat", "loot") || "spell";
  if (contentType === "species") return pickItemType("race", "species", "feat", "loot") || "race";
  return pickItemType("loot", "equipment", "item") || "loot";
}

export async function createApprovedDocument(s) {
  const c = s.content, levels = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  const ownership = {default: levels.NONE, [s.userId]: levels.OWNER};
  const flags = {[MODULE_ID]: {approvalStatus: STATUS.APPROVED, submissionId: s.id, submittedBy: s.userId, revision: s.revision}};
  const folder = await ensureFolder("Player Content", "Item").catch(() => null);
  return Item.implementation.create({
    name: c.name, type: approvedItemType(c.type), ownership, flags,
    folder: folder?.id ?? null,
    system: {description: {value: textToHtml(c.description)}},
  });
}

/* ------------------------------------------------------------------- UI */

const badge = status => `<em class="rpgbb-badge ${esc(status)}">${esc(STATUS_LABEL[status] || status)}</em>`;
const typeTag = type => `<span class="rpgbb-type"><i class="${TYPE_META[type]?.icon || "fa-solid fa-circle"}" inert></i>${esc(TYPE_META[type]?.label || type)}</span>`;

let BuilderClass = null, QueueClass = null;

function builderClass() {
  if (BuilderClass) return BuilderClass;
  const Base = companionApplication();
  BuilderClass = class PlayerContentBuilder extends Base {
    static DEFAULT_OPTIONS = {
      id: "rpgbb-content-builder",
      classes: ["rpgbb-builder"],
      window: {title: "My Custom Content", icon: "fa-solid fa-wand-magic-sparkles"},
      position: {width: 860, height: 700},
    };
    constructor(options = {}) {
      super({...options, position: {...fitToViewport(860, 700), ...(options.position || {})}});
      this.draft = {...EMPTY_DRAFT, ...(game.settings.get(MODULE_ID, DRAFT_SETTING) || {})};
      this.busy = false;
    }
    renderBody() {
      // Keep whatever the player is typing when a queue update re-renders the window.
      if (this._fresh) this._fresh = false;
      else if (this.rendered && this.element?.querySelector?.('textarea[name="description"]')) this.draft = this.readForm();
      const d = this.draft, mine = listPlayerSubmissions();
      const editing = d.submissionId ? mine.find(s => s.id === d.submissionId) : null;
      const gmOnline = hasActiveGM();
      const types = Object.entries(TYPE_META).map(([k, m]) => `<label class="${d.type === k ? "active" : ""}"><input type="radio" name="type" value="${k}" ${d.type === k ? "checked" : ""}><i class="${m.icon}" inert></i>${m.label}</label>`).join("");
      const list = mine.map(s => `<article class="rpgbb-sub status-${esc(s.status)}">
          <header><b>${esc(s.content.name)}</b>${badge(s.status)}</header>
          <div class="rpgbb-sub-meta">${typeTag(s.content.type)}<span>Rev ${s.revision || 1}</span><span>${esc(formatDate(s.updatedAt))}</span></div>
          ${s.gmNote ? `<blockquote><i class="fa-solid fa-feather" inert></i>${esc(s.gmNote)}</blockquote>` : ""}
          ${s.status === STATUS.CHANGES ? `<button type="button" data-revise="${esc(s.id)}"><i class="fa-solid fa-pen" inert></i> Revise &amp; resubmit</button>` : ""}
        </article>`).join("") || `<p class="rpgbb-empty"><i class="fa-solid fa-inbox" inert></i>Nothing submitted yet.</p>`;
      return `<section class="rpgbb-shell rpgbb-builder-grid">
        <div class="rpgbb-panel rpgbb-form">
          <header class="rpgbb-panel-head"><div><small>${editing ? `Revising · rev ${(editing.revision || 1) + 1}` : "New submission"}</small><h2>${editing ? esc(editing.content.name) : "Create custom content"}</h2></div>
            <span class="rpgbb-online ${gmOnline ? "on" : "off"}"><i class="fa-solid fa-circle" inert></i>${gmOnline ? "GM online" : "GM offline"}</span></header>
          <p class="rpgbb-hint">Your GM reviews everything before it reaches a character sheet.</p>
          ${editing?.gmNote ? `<blockquote class="rpgbb-gm-note"><b>GM asked for:</b> ${esc(editing.gmNote)}</blockquote>` : ""}
          <div class="rpgbb-segment" role="radiogroup" aria-label="Content type">${types}</div>
          <label class="rpgbb-field"><span>Name</span><input name="name" maxlength="${LIMITS.name}" value="${esc(d.name)}" placeholder="e.g. Tidecaller Elf" autocomplete="off"></label>
          <div class="rpgbb-field"><span>Description &amp; rules <small data-count></small></span>
            <div class="rpgbb-presets"><small>Start from:</small><button type="button" data-preset="simple">Simple feature</button><button type="button" data-preset="combat">Combat</button><button type="button" data-preset="utility">Utility</button></div>
            <textarea name="description" rows="12" maxlength="${LIMITS.description}" placeholder="What it does, how often it can be used, and any numbers the GM should check.">${esc(d.description)}</textarea>
          </div>
          <footer class="rpgbb-footer">
            ${editing ? `<button type="button" data-cancel-revise>Start new instead</button>` : ""}
            <button type="button" data-save><i class="fa-solid fa-floppy-disk" inert></i> Save draft</button>
            <button type="button" class="rpgbb-primary" data-submit ${this.busy || !gmOnline ? "disabled" : ""} title="${gmOnline ? "" : "A GM must be connected to receive submissions"}"><i class="fa-solid ${this.busy ? "fa-spinner fa-spin" : "fa-paper-plane"}" inert></i> ${editing ? "Resubmit" : "Submit to GM"}</button>
          </footer>
        </div>
        <aside class="rpgbb-panel rpgbb-subs"><header class="rpgbb-panel-head"><div><small>History</small><h2>My submissions</h2></div></header><div class="rpgbb-sub-list" data-keep-scroll="subs">${list}</div></aside>
      </section>`;
    }
    setDraft(draft) { this.draft = draft; this._fresh = true; }
    readForm() {
      const root = this.element;
      return {
        type: root.querySelector('input[name="type"]:checked')?.value || this.draft.type,
        name: root.querySelector('input[name="name"]')?.value ?? "",
        description: root.querySelector('textarea[name="description"]')?.value ?? "",
        submissionId: this.draft.submissionId || "",
      };
    }
    async persist(notify = false) {
      this.draft = this.readForm();
      await game.settings.set(MODULE_ID, DRAFT_SETTING, this.draft);
      if (notify) ui.notifications.info("Draft saved.");
    }
    activate(root) {
      const area = root.querySelector('textarea[name="description"]'), count = root.querySelector("[data-count]");
      const syncCount = () => { if (count && area) count.textContent = `${area.value.length.toLocaleString()} / ${LIMITS.description.toLocaleString()}`; };
      syncCount();
      const autosave = () => { clearTimeout(this._t); this._t = setTimeout(() => this.persist().catch(() => {}), 600); };
      area?.addEventListener("input", () => { syncCount(); autosave(); });
      root.querySelector('input[name="name"]')?.addEventListener("input", autosave);
      root.querySelectorAll('input[name="type"]').forEach(r => r.addEventListener("change", () => {
        root.querySelectorAll(".rpgbb-segment label").forEach(l => l.classList.toggle("active", l.querySelector("input").checked));
        autosave();
      }));
      root.querySelectorAll("[data-preset]").forEach(btn => btn.addEventListener("click", () => {
        if (!area) return;
        const text = PRESETS[btn.dataset.preset] || "";
        area.value = area.value.trim() ? `${area.value.replace(/\s+$/, "")}\n\n${text}` : text;
        area.focus(); syncCount(); autosave();
      }));
      root.querySelector("[data-save]")?.addEventListener("click", () => this.persist(true));
      root.querySelector("[data-cancel-revise]")?.addEventListener("click", async () => {
        this.setDraft({...EMPTY_DRAFT, type: this.draft.type});
        await game.settings.set(MODULE_ID, DRAFT_SETTING, this.draft);
        this.render();
      });
      root.querySelectorAll("[data-revise]").forEach(btn => btn.addEventListener("click", async () => {
        const s = listPlayerSubmissions().find(x => x.id === btn.dataset.revise);
        if (!s) return;
        this.setDraft({type: s.content.type, name: s.content.name, description: s.content.description, submissionId: s.id});
        await game.settings.set(MODULE_ID, DRAFT_SETTING, this.draft);
        this.render();
      }));
      root.querySelector("[data-submit]")?.addEventListener("click", () => this.submit());
    }
    async submit() {
      if (this.busy) return;
      const form = this.readForm();
      try { sanitize(form); } catch (error) { ui.notifications.warn(error.message); return; }
      this.busy = true; this.draft = form; this.render();
      try {
        await submitPlayerContent(form, form.submissionId);
        this.setDraft({...EMPTY_DRAFT, type: form.type});
        await game.settings.set(MODULE_ID, DRAFT_SETTING, this.draft);
      } catch (error) {
        ui.notifications.error(error?.message || "Submission failed.");
        await game.settings.set(MODULE_ID, DRAFT_SETTING, form).catch(() => {});
      } finally {
        this.busy = false;
        if (this.rendered) this.render();
      }
    }
    _onFirstRender(...args) { super._onFirstRender?.(...args); openApps.add(this); }
    async close(options) {
      clearTimeout(this._t);
      try { if (this.element && !this.busy) await this.persist(); } catch { /* best effort */ }
      openApps.delete(this);
      return super.close(options);
    }
  };
  return BuilderClass;
}

function queueClass() {
  if (QueueClass) return QueueClass;
  const Base = companionApplication();
  QueueClass = class ApprovalQueue extends Base {
    static DEFAULT_OPTIONS = {
      id: "rpgbb-approval-queue",
      classes: ["rpgbb-queue"],
      window: {title: "Content Approval", icon: "fa-solid fa-user-check"},
      position: {width: 780, height: 760},
    };
    constructor(options = {}) {
      super({...options, position: {...fitToViewport(780, 760), ...(options.position || {})}});
      this.tab = "pending";
      this.notes = new Map();
      this.working = new Set();
    }
    renderBody() {
      const all = store().submissions;
      const groups = {
        pending: all.filter(s => s.status === STATUS.PENDING).sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0)),
        returned: all.filter(s => s.status === STATUS.CHANGES).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
        history: all.filter(s => s.status === STATUS.APPROVED || s.status === STATUS.REJECTED).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
      };
      const tabs = [["pending", "Pending", "fa-hourglass-half"], ["returned", "Returned", "fa-reply"], ["history", "History", "fa-clock-rotate-left"]]
        .map(([k, l, i]) => `<button type="button" data-tab="${k}" class="${this.tab === k ? "active" : ""}"><i class="fa-solid ${i}" inert></i>${l}<b>${groups[k].length}</b></button>`).join("");
      const cards = groups[this.tab].map(s => {
        const busy = this.working.has(s.id);
        const actions = s.status === STATUS.PENDING ? `
          <textarea data-note="${esc(s.id)}" rows="2" maxlength="${LIMITS.note}" placeholder="Note to ${esc(s.userName)} (required when returning for changes)">${esc(this.notes.get(s.id) ?? "")}</textarea>
          <footer>
            <button type="button" class="rpgbb-approve" data-review="approve" data-id="${esc(s.id)}" ${busy ? "disabled" : ""}><i class="fa-solid fa-check" inert></i> Approve</button>
            <button type="button" class="rpgbb-changes" data-review="changes" data-id="${esc(s.id)}" ${busy ? "disabled" : ""}><i class="fa-solid fa-reply" inert></i> Return for changes</button>
            <button type="button" class="rpgbb-reject" data-review="reject" data-id="${esc(s.id)}" ${busy ? "disabled" : ""}><i class="fa-solid fa-xmark" inert></i> Reject</button>
          </footer>` : `${s.gmNote ? `<blockquote><i class="fa-solid fa-feather" inert></i>${esc(s.gmNote)}</blockquote>` : ""}${s.approvedDocumentUuid ? `<footer><button type="button" data-open="${esc(s.approvedDocumentUuid)}"><i class="fa-solid fa-up-right-from-square" inert></i> Open item</button></footer>` : ""}`;
        return `<article class="rpgbb-review status-${esc(s.status)}">
          <header><div><b>${esc(s.content.name)}</b><div class="rpgbb-sub-meta">${typeTag(s.content.type)}<span><i class="fa-solid fa-user" inert></i>${esc(s.userName)}</span><span>Rev ${s.revision || 1}</span><span>${esc(formatDate(s.updatedAt))}</span></div></div>${badge(s.status)}</header>
          <div class="rpgbb-review-body">${textToHtml(s.content.description || "(No description)")}</div>
          ${actions}
        </article>`;
      }).join("");
      const empty = {pending: "No submissions are waiting for review.", returned: "Nothing is out with players for changes.", history: "Approved and rejected content will appear here."}[this.tab];
      return `<section class="rpgbb-shell">
        <nav class="rpgbb-tabs rpgbb-tabs-wide">${tabs}</nav>
        <div class="rpgbb-review-list" data-keep-scroll="queue">${cards || `<p class="rpgbb-empty"><i class="fa-solid fa-inbox" inert></i>${empty}</p>`}</div>
      </section>`;
    }
    activate(root) {
      root.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { this.tab = b.dataset.tab; this.render(); }));
      root.querySelectorAll("[data-note]").forEach(t => t.addEventListener("input", () => this.notes.set(t.dataset.note, t.value)));
      root.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", async () => {
        const doc = await fromUuid(b.dataset.open);
        doc ? doc.sheet?.render(true) : ui.notifications.warn("That item no longer exists.");
      }));
      root.querySelectorAll("[data-review]").forEach(b => b.addEventListener("click", async () => {
        const id = b.dataset.id;
        if (this.working.has(id)) return;
        this.working.add(id);
        root.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(x => { x.disabled = true; });
        try {
          await reviewSubmission(id, b.dataset.review, this.notes.get(id) ?? "");
          this.notes.delete(id);
        } catch (error) {
          ui.notifications.error(error?.message || "Review failed.");
        } finally {
          this.working.delete(id);
          this.render();
        }
      }));
    }
    _onFirstRender(...args) { super._onFirstRender?.(...args); openApps.add(this); }
    async close(options) { openApps.delete(this); return super.close(options); }
  };
  return QueueClass;
}

export function openPlayerContentBuilder() {
  const Cls = builderClass();
  const existing = [...openApps].find(a => a instanceof Cls);
  if (existing) { existing.setDraft({...EMPTY_DRAFT, ...(game.settings.get(MODULE_ID, DRAFT_SETTING) || {})}); existing.render({force: true}); existing.bringToFront?.(); return existing; }
  const app = new Cls();
  app.render({force: true});
  return app;
}

export function openApprovalQueue() {
  if (!game.user.isGM) return null;
  const Cls = queueClass();
  const existing = [...openApps].find(a => a instanceof Cls);
  if (existing) { existing.render({force: true}); existing.bringToFront?.(); return existing; }
  const app = new Cls();
  app.render({force: true});
  return app;
}

export function _setAckTimeout(ms) { ACK_TIMEOUT_MS = ms; }
export function _resetApprovalUi() { BuilderClass = null; QueueClass = null; openApps.clear(); pendingAcks.clear(); }
