/**
 * Push 51 — Mom request-recap admin surface.
 *
 * Asserts the contract:
 *   1. The recap tRPC router exposes listPending / isAnswered / fireNow, all
 *      gated by familyAdminProcedure.
 *   2. fireNow short-circuits when actuals exist or the day is already
 *      answered, otherwise inserts one dailyRecapRequests row per
 *      (Mom + Grandma + active tutor) recipient with a 16-hex-char token.
 *   3. Settings.tsx mounts the new RecapRequestCard above DailyRecapCard
 *      inside the existing "recap" tab.
 *   4. The heartbeat for the scheduled recap-send route exists (verified
 *      indirectly via routers.ts comment + scheduledSync handler shape).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const routersSrc = fs.readFileSync(
  path.join(__dirname, "routers.ts"),
  "utf-8",
);
const settingsSrc = fs.readFileSync(
  path.join(__dirname, "..", "client", "src", "pages", "Settings.tsx"),
  "utf-8",
);
const scheduledSrc = fs.readFileSync(
  path.join(__dirname, "scheduledSync.ts"),
  "utf-8",
);

describe("Push 51 — Recap request admin surface", () => {
  it("declares a 'recap' router with the three expected procedures", () => {
    const headerIdx = routersSrc.indexOf("RECAP REQUESTS (Push 51");
    expect(headerIdx).toBeGreaterThan(0);
    const slice = routersSrc.slice(headerIdx, headerIdx + 4000);
    expect(slice).toContain("recap: router({");
    expect(slice).toContain("listPending: familyAdminProcedure");
    expect(slice).toContain("isAnswered: familyAdminProcedure");
    expect(slice).toContain("fireNow: familyAdminProcedure");
  });

  it("fireNow short-circuits when actuals exist or already answered", () => {
    const idx = routersSrc.indexOf("fireNow: familyAdminProcedure");
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toContain('"actual-entries-exist"');
    expect(slice).toContain('"already-answered"');
    // Recipients: Mom + Grandma + active tutors (deduped via Set).
    expect(slice).toContain('"marcy.spear@gmail.com"');
    expect(slice).toContain('"spear.cpt@gmail.com"');
    expect(slice).toContain('listTutors?.(true)');
    expect(slice).toContain("new Set([...fixedRecipients, ...tutorEmails])");
    // 16-hex-char token format matches scheduledSync.makeReplyToken.
    expect(slice).toMatch(/length: 16/);
  });

  it("Settings.tsx mounts RecapRequestCard above DailyRecapCard inside the recap tab", () => {
    const idx = settingsSrc.indexOf("TabsContent value=\"recap\"");
    expect(idx).toBeGreaterThan(0);
    const slice = settingsSrc.slice(idx, idx + 400);
    const r = slice.indexOf("<RecapRequestCard");
    const d = slice.indexOf("<DailyRecapCard");
    expect(r).toBeGreaterThan(0);
    expect(d).toBeGreaterThan(0);
    expect(r).toBeLessThan(d);
  });

  it("RecapRequestCard wires the fire-now mutation with cache invalidation", () => {
    const idx = settingsSrc.indexOf("function RecapRequestCard");
    expect(idx).toBeGreaterThan(0);
    const slice = settingsSrc.slice(idx, idx + 4000);
    expect(slice).toContain("recap?.listPending?.useQuery");
    expect(slice).toContain("recap?.fireNow?.useMutation");
    expect(slice).toContain("recap?.listPending?.invalidate");
    // Includes a date picker + send button.
    expect(slice).toContain("type=\"date\"");
    expect(slice).toContain("Send recap request now");
  });

  it("scheduledSync.ts still owns the underlying /api/scheduled/daily-recap-send route", () => {
    expect(scheduledSrc).toContain("/api/scheduled/daily-recap-send");
    expect(scheduledSrc).toContain("createRecapRequest?.({");
    expect(scheduledSrc).toContain('skipped: "actual-entries-exist"');
  });
});
