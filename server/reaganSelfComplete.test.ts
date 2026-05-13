/**
 * Push 43 — Reagan self-marks her own block complete.
 *
 * Asserts the contract between the new public selfComplete procedure
 * and Today.tsx's checkmark button, plus the guardrails that keep
 * Reagan from accidentally getting graded by her own tap.
 *
 *   1. blocks.selfComplete is a publicProcedure (no family-admin required)
 *      that only takes { id }. It never accepts grade or notes.
 *   2. The handler writes status='complete', records the audit log with
 *      summary='reagan-self-mark', and still awards the sticker + coin.
 *   3. Today.tsx routes the tap to selfComplete when adult is locked,
 *      complete (familyAdmin) when adult is unlocked, and falls back to
 *      complete if the new proc is unavailable (defensive for old tRPC clients).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Reagan self-mark-complete — push 43", () => {
  const routersSrc = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
  const todaySrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Today.tsx"),
    "utf-8",
  );

  it("blocks.selfComplete is a public procedure", () => {
    const idx = routersSrc.indexOf("selfComplete: publicProcedure");
    expect(idx).toBeGreaterThan(0);
  });

  it("blocks.selfComplete only accepts { id } (no grade or notes)", () => {
    const idx = routersSrc.indexOf("selfComplete: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 1500);
    expect(slice).toContain(".input(z.object({ id: z.number() }))");
    expect(slice).not.toContain("grade: input.grade");
    expect(slice).not.toContain("notes: input.notes");
  });

  it("blocks.selfComplete writes status=complete + audit summary=reagan-self-mark", () => {
    const idx = routersSrc.indexOf("selfComplete: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2000);
    expect(slice).toContain('status: "complete"');
    expect(slice).toContain('summary: "reagan-self-mark"');
    expect(slice).toContain('actorOpenId: ctx.user?.openId ?? "reagan-self"');
  });

  it("blocks.selfComplete still awards the sticker + coin", () => {
    const idx = routersSrc.indexOf("selfComplete: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toContain("await db.awardSticker({");
    expect(slice).toContain('reason: "block_done"');
    expect(slice).toContain("coins: 1");
  });

  it("Today.tsx imports the selfComplete hook defensively", () => {
    expect(todaySrc).toContain("const selfCompleteM = (trpc as any).blocks?.selfComplete?.useMutation?.()");
  });

  it("Today checkmark routes to selfComplete when locked, complete when unlocked", () => {
    const idx = todaySrc.indexOf("Push 43 — if adult is unlocked");
    expect(idx).toBeGreaterThan(0);
    const slice = todaySrc.slice(idx, idx + 1800);
    expect(slice).toContain("if (unlocked) {");
    expect(slice).toContain("completeM.mutate({ id: b.id }, onDone);");
    expect(slice).toContain("selfCompleteM.mutate({ id: b.id }, onDone);");
  });

  it("Reagan cannot call any start/end-time-changing block proc as public", () => {
    // Spec: she can only complete. All other mutating block procs must be
    // family-admin so adult sign-off is the gate.
    const protectedNames = ["update: familyAdminProcedure", "move: familyAdminProcedure", "reorder: familyAdminProcedure"];
    for (const n of protectedNames) {
      expect(routersSrc).toContain(n);
    }
  });
});
