// Deliberately hostile, huge and concurrent inputs. Each test documents a way the module used to break.
import {describe, it, expect, beforeEach} from "vitest";
import {createFoundryMock} from "./foundry-mock.mjs";

let mock = createFoundryMock();
mock.install();
const I = await import("../scripts/importer.js");
const A = await import("../scripts/approval.js");
const fresh = opts => { mock = createFoundryMock(opts); mock.install(); A._resetApprovalUi(); A._setAckTimeout(30); A.registerApprovalSettings(); A.initApproval(); return mock; };
const pkg = entries => ({format: "rpg-book-builder-foundry", version: 1, title: "Stress", entries});

describe("garbage-shaped entries", () => {
  beforeEach(() => fresh());
  it("survives nulls, numbers, objects and wrong field types without throwing", async () => {
    const junk = [null, 7, "text", [], {name: {nested: true}}, {name: 42, kind: 9, visibility: null, body: {}, links: "nope", dnd5e: "x"},
      {name: "Weird Creature", kind: "Creature", dnd5e: {fields: {"Armor Class": 15, "Hit Points": null, Challenge: "—", STR: "—", Speed: 0}, sections: {Actions: "not an array", Traits: [null, {name: null}, {name: "Ok.", text: 5}]}}},
      {name: "Links", links: [null, 5, {name: "Obj"}, "  ", "Real"]}];
    const p = I.normalizePackage(pkg(junk));
    expect(p.entries).toHaveLength(junk.length);
    expect(p.entries[5]).toMatchObject({name: "42", kind: "9", visibility: "Player", body: "", links: [], dnd5e: null});
    expect(p.entries[7].links).toEqual(["5", "Obj", "Real"]);
    const r = await I.importPackage(pkg(junk));
    expect(r.failed).toEqual([]);
    const weird = mock.game.actors.find(a => a.name === "Weird Creature");
    expect(weird.system).toMatchObject({details: {cr: 0}, attributes: {ac: {flat: 15}, hp: {value: 1}}});
    expect(weird.items.map(i => i.name)).toEqual(["Ok"]);
  });

  it("does not let __proto__ keys in a package pollute objects", async () => {
    const evil = JSON.parse('{"format":"rpg-book-builder-foundry","entries":[{"name":"P","kind":"Creature","dnd5e":{"fields":{"__proto__":{"polluted":true},"AC":"12"},"sections":{"__proto__":[{"name":"x","text":"y"}]}}}],"__proto__":{"polluted":true}}');
    await I.importPackage(evil);
    expect({}.polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it("gives non-Latin names distinct, stable ids", () => {
    const a = I.normalizePackage(pkg([{name: "珊瑚の都"}, {name: "Кораллы"}])).entries.map(e => e.id);
    const b = I.normalizePackage(pkg([{name: "Кораллы"}])).entries.map(e => e.id);
    expect(a[0]).not.toBe(a[1]);
    expect(b[0]).toBe(a[1]);
  });
});

describe("scale", () => {
  beforeEach(() => fresh());
  // Seeding 5,000 documents takes several seconds on CI runners. Only the preview is timed,
  // but the seed must finish inside the test: if vitest's default 5 s timeout cuts it off, the
  // import keeps running in the background and slows every later test in this file.
  it("previews 5,000 entries against 5,000 existing documents quickly", async () => {
    const entries = Array.from({length: 5000}, (_, i) => ({id: `e${i}`, name: `Entry ${i}`, body: `Lore ${i}`}));
    await I.importPackage(pkg(entries.slice(0, 5000)));
    entries[1234].body = "changed";
    const t = performance.now();
    const counts = I.previewPackage(pkg(entries));
    expect(performance.now() - t).toBeLessThan(1500);
    expect(counts).toMatchObject({Unchanged: 4999, Update: 1, New: 0});
  }, 120_000);
  it("parses a 4 MB markdown file with 10,000 headings", () => {
    const text = Array.from({length: 10000}, (_, i) => `# Heading ${i}\n${"Lorem ipsum dolor sit amet. ".repeat(14)}`).join("\n");
    const t = performance.now();
    const p = I.plainLorePackage("Big", text);
    expect(performance.now() - t).toBeLessThan(1500);
    expect(p.entries).toHaveLength(10000);
  });
  it("links 300 cross-referenced journals without quadratic blow-up", async () => {
    const names = Array.from({length: 300}, (_, i) => `Place ${i}`);
    const entries = names.map((n, i) => ({id: `p${i}`, name: n, body: names.slice(0, 20).map(x => `@${x}`).join(" "), links: names.slice(0, 20)}));
    const t = performance.now();
    await I.importPackage(pkg(entries));
    expect(performance.now() - t).toBeLessThan(3000);
    const page = mock.game.journal.find(j => j.name === "Place 299").pages[0].text.content;
    expect(page).toContain("{Place 1}");
    expect(page).toContain("{Place 10}"); // "@Place 10" must not become "{Place 1}0"
    expect(page).not.toContain("}0");
  });
});

describe("concurrency", () => {
  beforeEach(() => fresh());
  it("two imports started at once do not create duplicates", async () => {
    const entries = Array.from({length: 20}, (_, i) => ({id: `c${i}`, name: `Concurrent ${i}`}));
    await Promise.all([I.importPackage(pkg(entries)), I.importPackage(pkg(entries))]);
    expect(mock.game.journal).toHaveLength(20);
    expect(mock.game.folders.filter(f => f.name === "Stress")).toHaveLength(1);
  });
  it("double-clicking approve creates exactly one item", async () => {
    await A.acceptSubmission({id: "s", userId: mock.player.id, content: {type: "item", name: "Pearl"}}, mock.player.id);
    const results = await Promise.allSettled([A.reviewSubmission("s", "approve"), A.reviewSubmission("s", "approve")]);
    expect(mock.game.items).toHaveLength(1);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });
  it("two players submitting at the same moment both land in the queue", async () => {
    const p2 = {id: "pl0000000000002", name: "Sam", isGM: false, active: true};
    mock.game.users.push(p2);
    await Promise.all([
      A.acceptSubmission({id: "a", userId: mock.player.id, content: {type: "item", name: "A"}}, mock.player.id),
      A.acceptSubmission({id: "b", userId: p2.id, content: {type: "item", name: "B"}}, p2.id),
    ]);
    expect(A.store().submissions.map(s => s.id).sort()).toEqual(["a", "b"]);
  });
});

describe("hostile socket traffic", () => {
  beforeEach(() => fresh());
  it("ignores malformed messages without throwing", async () => {
    for (const msg of [null, "submit", 5, [], {}, {action: "submit"}, {action: "submit", submission: null}, {action: "submit", submission: {id: 5, userId: {}}}, {action: "result"}, {action: "submit", submission: {id: "x", userId: mock.player.id, content: "string"}}, {action: "submit", submission: {id: "__proto__", userId: mock.player.id, content: {type: "item", name: "x"}}}]) {
      await A.handleSocket(msg, mock.player.id);
    }
    expect(A.store().submissions.filter(s => s.id === "__proto__")).toHaveLength(0);
    expect({}.content).toBeUndefined();
  });
  it("escapes player HTML everywhere it is rendered", () => {
    expect(A.sanitize({type: "item", name: "<img src=x onerror=alert(1)>", description: "<script>x</script>"}).name).toBe("<img src=x onerror=alert(1)>");
    // stored verbatim, but rendered escaped:
    expect(I.loreHtml({body: "<script>x</script>"})).toBe("<p>&lt;script&gt;x&lt;/script&gt;</p>");
  });
});

describe("long-running worlds", () => {
  beforeEach(() => fresh());
  it("keeps the approval history bounded", async () => {
    for (let i = 0; i < A.HISTORY_LIMIT + 25; i++) {
      await A.acceptSubmission({id: `h${i}`, userId: mock.player.id, content: {type: "item", name: `Item ${i}`, description: "x".repeat(500)}}, mock.player.id);
      await A.reviewSubmission(`h${i}`, "reject", "no");
    }
    await A.acceptSubmission({id: "live", userId: mock.player.id, content: {type: "item", name: "Still pending"}}, mock.player.id);
    const subs = A.store().submissions;
    expect(subs.filter(s => s.status === "rejected")).toHaveLength(A.HISTORY_LIMIT);
    expect(subs.some(s => s.id === "live")).toBe(true);
    expect(subs.some(s => s.id === "h0")).toBe(false);
  });
});

describe("markdown rendering", () => {
  beforeEach(() => fresh());
  it("renders through Foundry's showdown with package HTML neutralised first", () => {
    globalThis.showdown = {Converter: class { makeHtml(t) { return t.split(/\n{2,}/).map(p => p.startsWith("## ") ? `<h2>${p.slice(3)}</h2>` : `<p>${p.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`).join(""); } }};
    try {
      const html = I.loreHtml({body: "## Coral\n\n**Population** 40,000 <script>alert(1)</script>"});
      expect(html).toBe("<h2>Coral</h2><p><strong>Population</strong> 40,000 &lt;script>alert(1)&lt;/script></p>");
    } finally { delete globalThis.showdown; }
  });
});
