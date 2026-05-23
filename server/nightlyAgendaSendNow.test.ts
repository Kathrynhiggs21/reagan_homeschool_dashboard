/**
 * nightlyAgendaSendNow.test.ts — v2.89 (2026-05-23)
 *
 * Mom reported on 2026-05-22: "I haven't gotten any emails". Diagnosis
 * showed the deployed `/api/scheduled/nightly-agenda-email` endpoint
 * returns 403 (Cloudflare cron-cookie gate) to the heartbeat task, so
 * Job A never enqueues a real send. v2.89 ships an in-dashboard
 * fallback: `nightlyAgenda.sendNow` mutation that uses the Manus
 * owner-notification channel + a "📨 Send now" button in the
 * For Mom & Grandma drawer.
 *
 * This test pins the source-level contract so the workaround cannot
 * silently regress. It does NOT call notifyOwner against the live
 * service (no network in CI); the source-level checks are sufficient
 * because the underlying assemble/build/insert/mark helpers already
 * have integration coverage in:
 *   - nightlyAgendaEmailDispatch.test.ts (insert + mark sent/failed)
 *   - blockAutoAttach.test.ts (auto-attach)
 *   - agendaPdfBuilder.test.ts (PDF build)
 *
 * What this test locks:
 *   1. The `sendNow` mutation exists on the nightlyAgenda router.
 *   2. It is gated by familyAdminProcedure (Mom + Grandma + tutors only).
 *   3. It defaults to today when no forDate input is provided.
 *   4. It calls assembleAgendaForDate → buildAgendaPdf → storagePut →
 *      storageGetSignedUrl → notifyOwner → markNightlyAgendaEmailStatus
 *      in that order.
 *   5. It marks the row 'sent' on success and 'failed' on
 *      notifyOwner returning false.
 *   6. The Today drawer mounts SendAgendaNowCard.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const routersPath = path.join(ROOT, "server", "routers.ts");
const todayPath = path.join(ROOT, "client", "src", "pages", "Today.tsx");
const cardPath = path.join(
  ROOT,
  "client",
  "src",
  "components",
  "SendAgendaNowCard.tsx",
);

describe("nightlyAgenda.sendNow — manual send contract (v2.89)", () => {
  const src = fs.readFileSync(routersPath, "utf8");

  it("sendNow procedure exists on nightlyAgenda router", () => {
    expect(src).toMatch(/sendNow:\s*familyAdminProcedure/);
  });

  it("sendNow is gated to family admins (Mom + Grandma + tutors)", () => {
    // Locate the sendNow block then assert the gate.
    const idx = src.indexOf("sendNow:");
    expect(idx).toBeGreaterThan(0);
    const slice = src.slice(idx, idx + 200);
    expect(slice).toMatch(/familyAdminProcedure/);
  });

  it("sendNow accepts an optional { forDate } input", () => {
    const idx = src.indexOf("sendNow:");
    const slice = src.slice(idx, idx + 600);
    expect(slice).toMatch(/forDate:\s*z[\s\S]*?optional\(\)/);
    expect(slice).toMatch(/\}\)\.optional\(\)/);
  });

  it("sendNow defaults to today's local ET date when forDate is omitted", () => {
    const idx = src.indexOf("sendNow:");
    const slice = src.slice(idx, idx + 2000);
    expect(slice).toContain("const forDate = input?.forDate ?? today");
  });

  it("sendNow calls the canonical pipeline in the right order", () => {
    const idx = src.indexOf("sendNow:");
    const slice = src.slice(idx, idx + 8000);
    // The mutation has a dynamic-import block at the top that mentions
    // every helper name, then the runtime call sequence below. Skip past
    // the imports by anchoring on `const today = (() =>`, which sits
    // immediately after the imports.
    const todayAnchor = slice.indexOf("const today =");
    expect(todayAnchor).toBeGreaterThan(0);
    const body = slice.slice(todayAnchor);
    const order = [
      "assembleAgendaForDate",
      "buildAgendaPdf",
      "storagePut",
      "storageGetSignedUrl",
      "insertNightlyAgendaEmail",
      "notifyOwner",
      "markNightlyAgendaEmailStatus",
    ];
    let lastPos = -1;
    for (const tok of order) {
      const at = body.indexOf(tok);
      expect(at, `expected ${tok} after position ${lastPos}`).toBeGreaterThan(
        lastPos,
      );
      lastPos = at;
    }
  });

  it("sendNow marks the row 'sent' on success and 'failed' on notify failure", () => {
    const idx = src.indexOf("sendNow:");
    const slice = src.slice(idx, idx + 8000);
    expect(slice).toContain("status: notified ? \"sent\" : \"failed\"");
  });

  it("sendNow targets spear.cpt@gmail.com only this week (per Mom's instructions)", () => {
    const idx = src.indexOf("sendNow:");
    const slice = src.slice(idx, idx + 8000);
    expect(slice).toMatch(/recipients = \["spear\.cpt@gmail\.com"\]/);
    // Marcy is intentionally NOT included this week.
    expect(slice).not.toMatch(
      /recipients = \[[^\]]*marcy\.spear@gmail\.com/,
    );
  });

  it("response shape returns { ok, forDate, recordId, notified, signedUrl, ... }", () => {
    const idx = src.indexOf("sendNow:");
    const slice = src.slice(idx, idx + 8000);
    for (const key of [
      "ok: true as const",
      "forDate,",
      "recordId,",
      "notified,",
      "signedUrl,",
      "blockCount: payload.blocks.length,",
    ]) {
      expect(slice).toContain(key);
    }
  });

  it("returns { ok: false, reason: 'no_plan' } when no plan exists for the date", () => {
    const idx = src.indexOf("sendNow:");
    const slice = src.slice(idx, idx + 8000);
    expect(slice).toContain('reason: "no_plan" as const');
  });
});

describe("Today drawer mounts SendAgendaNowCard (v2.89)", () => {
  it("Today.tsx imports SendAgendaNowCard", () => {
    const t = fs.readFileSync(todayPath, "utf8");
    expect(t).toContain(
      'import SendAgendaNowCard from "@/components/SendAgendaNowCard"',
    );
  });

  it("Today.tsx mounts <SendAgendaNowCard /> inside the For Mom & Grandma drawer", () => {
    const t = fs.readFileSync(todayPath, "utf8");
    const drawerIdx = t.indexOf("For Mom &amp; Grandma");
    expect(drawerIdx).toBeGreaterThan(0);
    const slice = t.slice(drawerIdx, drawerIdx + 2500);
    expect(slice).toContain("<SendAgendaNowCard />");
  });

  it("SendAgendaNowCard component exists and calls the sendNow mutation", () => {
    const c = fs.readFileSync(cardPath, "utf8");
    expect(c).toContain("trpc.nightlyAgenda.sendNow.useMutation");
    // Has a primary "Send now" button gated on send.isPending
    expect(c).toMatch(/Send now/);
    expect(c).toMatch(/send\.isPending/);
  });
});
