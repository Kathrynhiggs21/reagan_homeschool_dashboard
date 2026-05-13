import { describe, it, expect, beforeAll } from "vitest";
import {
  createKidRequest,
  listKidRequests,
  countUnresolvedKidRequests,
  resolveKidRequest,
  markKidRequestNotified,
  KID_REQUEST_RECIPIENTS,
} from "./db";

/**
 * Push 26 (2026-05-12) — kidRequests end-to-end via real DB.
 *
 * Locks down: insert + emailedTo recipient list + list/unresolved filtering +
 * resolve flow + notifyOwner ack flag. SMTP not yet wired; recipient list is
 * the source of truth so the future SMTP step is a one-line append.
 */

describe("kidRequests — push 26", () => {
  beforeAll(() => {
    expect(KID_REQUEST_RECIPIENTS.length).toBe(3);
    expect(KID_REQUEST_RECIPIENTS).toContain("spear.cpt@gmail.com");
    expect(KID_REQUEST_RECIPIENTS).toContain("blakehiggs@hotmail.com");
    expect(KID_REQUEST_RECIPIENTS).toContain("marcy.spear@gmail.com");
  });

  it("create returns id + emailedTo with all 3 recipients (joined)", async () => {
    const res = await createKidRequest({
      body: "test from vitest — please ignore",
      kind: "general",
      fromUserId: null,
    });
    expect(res.id).toBeGreaterThan(0);
    expect(res.emailedTo).toContain("spear.cpt@gmail.com");
    expect(res.emailedTo).toContain("blakehiggs@hotmail.com");
    expect(res.emailedTo).toContain("marcy.spear@gmail.com");
    expect(res.emailedTo.split(",").length).toBe(3);
    expect(res.notifyOwnerOk).toBe(false);
    // Cleanup so this row doesn't pollute future runs.
    await resolveKidRequest(res.id, null, "auto-resolved by vitest");
  });

  it("list excludes resolved by default, includes when asked", async () => {
    const a = await createKidRequest({ body: "vitest unresolved", kind: "stuck", fromUserId: null });
    const b = await createKidRequest({ body: "vitest resolved", kind: "feeling", fromUserId: null });
    await resolveKidRequest(b.id, null, "vitest cleanup");
    const unresolved = await listKidRequests(false, 100);
    expect(unresolved.find((r: any) => r.id === a.id)).toBeTruthy();
    expect(unresolved.find((r: any) => r.id === b.id)).toBeFalsy();
    const all = await listKidRequests(true, 100);
    expect(all.find((r: any) => r.id === a.id)).toBeTruthy();
    expect(all.find((r: any) => r.id === b.id)).toBeTruthy();
    await resolveKidRequest(a.id, null, "vitest cleanup");
  });

  it("countUnresolvedKidRequests reflects new + resolved transitions", async () => {
    const before = await countUnresolvedKidRequests();
    const r = await createKidRequest({ body: "vitest count", kind: "schedule", fromUserId: null });
    const mid = await countUnresolvedKidRequests();
    expect(mid).toBe(before + 1);
    await resolveKidRequest(r.id, null);
    const after = await countUnresolvedKidRequests();
    expect(after).toBe(before);
  });

  it("markKidRequestNotified flips the notifyOwnerOk flag", async () => {
    const r = await createKidRequest({ body: "vitest notify", kind: "general", fromUserId: null });
    await markKidRequestNotified(r.id, true);
    const all = await listKidRequests(true, 100);
    const row: any = all.find((x: any) => x.id === r.id);
    expect(row).toBeTruthy();
    expect(row.notifyOwnerOk).toBe(true);
    await resolveKidRequest(r.id, null);
  });

  it("kind enum accepts the 4 allowed values", async () => {
    const ids: number[] = [];
    for (const kind of ["general", "schedule", "stuck", "feeling"] as const) {
      const r = await createKidRequest({ body: `vitest ${kind}`, kind, fromUserId: null });
      ids.push(r.id);
    }
    const all = await listKidRequests(true, 200);
    const found = ids.map(id => all.find((r: any) => r.id === id));
    expect(found.every(Boolean)).toBe(true);
    for (const id of ids) await resolveKidRequest(id, null);
  });
});
