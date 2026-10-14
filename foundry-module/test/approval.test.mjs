import {describe, it, expect, beforeEach} from "vitest";
import {createFoundryMock} from "./foundry-mock.mjs";

let mock = createFoundryMock();
mock.install();
const A = await import("../scripts/approval.js");

function fresh(opts) {
  mock = createFoundryMock(opts);
  mock.install();
  A._resetApprovalUi();
  A._setAckTimeout(50);
  A.registerApprovalSettings();
  A.initApproval();
  return mock;
}
const asPlayer = () => { mock.game.user = mock.player; };
const asGM = () => { mock.game.user = mock.gm; };

/** Player submits; the GM client receives it; the player receives the ack. */
async function roundTrip(data, submissionId) {
  asPlayer();
  const pending = A.submitPlayerContent(data, submissionId);
  await mock.game.socket.flush(mock.gm);      // GM handles "submit"
  await mock.game.socket.flush(mock.player);  // player handles "result"
  return pending;
}

describe("player submissions", () => {
  beforeEach(() => fresh());

  it("round-trips a submission to the GM queue and confirms it to the player", async () => {
    const s = await roundTrip({type: "spell", name: "Tidal Lance", description: "A spear of water."});
    expect(s).toMatchObject({status: "pending", revision: 1, userId: mock.player.id, userName: "Riley"});
    expect(A.store().submissions).toHaveLength(1);
    expect(mock.log.notifications.some(n => /submitted/.test(n.msg))).toBe(true);
  });

  it("drops anything except plain text fields from player content", () => {
    const clean = A.sanitize({type: "item", name: "  Ring  of   Tides ", description: "x", system: {damage: {parts: [["99d99", "force"]]}}, img: "javascript:alert(1)"});
    expect(clean).toEqual({type: "item", name: "Ring of Tides", description: "x"});
  });

  it("rejects bad types, blank and oversize names", () => {
    expect(() => A.sanitize({type: "class", name: "X"})).toThrow("Only species");
    expect(() => A.sanitize({type: "spell", name: "   "})).toThrow("Name is required");
    expect(() => A.sanitize({type: "spell", name: "x".repeat(500)})).toThrow("120");
    expect(() => A.sanitize({type: "spell", name: "ok", description: "x".repeat(20001)})).toThrow("20,000");
  });

  it("refuses to submit when no GM is connected instead of pretending it worked", async () => {
    mock.gm.active = false;
    asPlayer();
    await expect(A.submitPlayerContent({type: "spell", name: "Lonely"})).rejects.toThrow("No GM is connected");
    expect(mock.log.socket).toHaveLength(0);
  });

  it("GM ignores submissions whose author does not match the sender", async () => {
    await expect(A.acceptSubmission({id: "s1", userId: mock.player.id, content: {type: "spell", name: "Spoof"}}, "someone-else")).rejects.toThrow("does not match");
    await expect(A.acceptSubmission({id: "s2", userId: mock.gm.id, content: {type: "spell", name: "GM"}}, mock.gm.id)).rejects.toThrow("GM users");
  });

  it("caps pending submissions per player", async () => {
    for (let i = 0; i < A.LIMITS.pendingPerUser; i++) await A.acceptSubmission({id: `s${i}`, userId: mock.player.id, content: {type: "spell", name: `Spell ${i}`}}, mock.player.id);
    await expect(A.acceptSubmission({id: "over", userId: mock.player.id, content: {type: "spell", name: "One too many"}}, mock.player.id)).rejects.toThrow("waiting");
  });

  it("reports GM-side rejection back to the player", async () => {
    asPlayer();
    const pending = A.submitPlayerContent({type: "spell", name: "Fine"});
    mock.log.socket[0].data.submission.userId = "ghost"; // tamper in flight
    await mock.game.socket.flush(mock.gm);
    await mock.game.socket.flush(mock.player);
    // The ack is addressed to "ghost", so the real player times out rather than being told it worked.
    expect(A.store().submissions).toHaveLength(0);
    await expect(pending).rejects.toThrow("didn't confirm");
  });
});

describe("GM review", () => {
  beforeEach(() => fresh());

  it("approves into a player-owned Item in a Player Content folder", async () => {
    const s = await roundTrip({type: "species", name: "Tideborn", description: "Gills.\n\nSwim speed 30 ft."});
    asGM();
    const done = await A.reviewSubmission(s.id, "approve", "Looks great");
    const item = mock.game.items[0];
    expect(item).toMatchObject({name: "Tideborn", type: "race"});
    expect(item.ownership[mock.player.id]).toBe(3);
    expect(item.ownership.default).toBe(0);
    expect(item.system.description.value).toBe("<p>Gills.</p><p>Swim speed 30 ft.</p>");
    expect(mock.game.folders.get(item.folder).name).toBe("Player Content");
    expect(done).toMatchObject({status: "approved", approvedDocumentUuid: item.uuid, gmNote: "Looks great"});
  });

  it("uses whatever species item type the system defines", async () => {
    fresh({itemTypes: ["loot", "spell", "species", "feat"]});
    expect(A.approvedItemType("species")).toBe("species");
    fresh({itemTypes: ["loot"]});
    expect(A.approvedItemType("spell")).toBe("loot");
  });

  it("requires a note to return for changes, then accepts a revision", async () => {
    const s = await roundTrip({type: "item", name: "Pearl", description: "Shiny"});
    asGM();
    await expect(A.reviewSubmission(s.id, "changes", "")).rejects.toThrow("Add a note");
    await A.reviewSubmission(s.id, "changes", "Give it a price.");
    const revised = await roundTrip({type: "item", name: "Pearl", description: "Shiny. 50 gp."}, s.id);
    expect(revised).toMatchObject({status: "pending", revision: 2});
    expect(A.store().submissions).toHaveLength(1);
  });

  it("does not let a pending item be resubmitted or a finished one re-reviewed", async () => {
    const s = await roundTrip({type: "item", name: "Pearl"});
    asPlayer();
    await expect(A.submitPlayerContent({type: "item", name: "Pearl 2"}, s.id)).rejects.toThrow("returned for changes");
    asGM();
    await A.reviewSubmission(s.id, "reject", "No.");
    await expect(A.reviewSubmission(s.id, "approve")).rejects.toThrow("already");
    expect(mock.game.items).toHaveLength(0);
  });

  it("players cannot review", async () => {
    asPlayer();
    await expect(A.reviewSubmission("x", "approve")).rejects.toThrow("Only a GM");
  });

  it("tells the player when their submission's status changes", async () => {
    const s = await roundTrip({type: "spell", name: "Brine Bolt"});
    asPlayer(); A.initApproval(); // player's client learns the current statuses
    asGM(); await A.reviewSubmission(s.id, "changes", "Too strong");
    asPlayer(); mock.log.notifications.length = 0;
    A.notifyStatusChanges();      // what the player's client runs when the world setting changes
    expect(mock.log.notifications).toEqual([{level: "warn", msg: "Your GM asked for changes to Brine Bolt."}]);
    A.notifyStatusChanges();      // and only once
    expect(mock.log.notifications).toHaveLength(1);
  });

  it("the player sees a clear error if the GM never answers", async () => {
    asPlayer();
    await expect(A.submitPlayerContent({type: "spell", name: "Into the void"})).rejects.toThrow("didn't confirm");
  });

  it("only one GM processes a submission when several are online", async () => {
    const gm2 = {id: "gm0000000000002", name: "Co-GM", isGM: true, active: true};
    mock.game.users.push(gm2);
    asPlayer();
    const p = A.submitPlayerContent({type: "spell", name: "Once"});
    await mock.game.socket.flush(gm2); // the non-responsible GM sees it first
    expect(A.store().submissions).toHaveLength(0);
    await expect(p).rejects.toThrow("didn't confirm");
  });
});
