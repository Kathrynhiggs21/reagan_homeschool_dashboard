/**
 * Push 91 (2026-05-13) — Approvals admin card wiring contract.
 *
 * Locks the structural invariants Mom + Grandma rely on:
 *   - approvals.listPending / approvals.resolve are exposed as
 *     adminOrTutorProcedure (NOT public).
 *   - rosterOverride.pushTargets is exposed.
 *   - ApprovalsAdminCard component reads from approvals.listPending and
 *     calls approvals.resolve.
 *   - The card is mounted in Settings → Requests tab.
 *
 * No DB writes — this is a wiring test only.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const ROUTERS = readFileSync(join(ROOT, "server", "routers.ts"), "utf8");
const CARD = readFileSync(
  join(ROOT, "client", "src", "components", "ApprovalsAdminCard.tsx"),
  "utf8",
);
const SETTINGS = readFileSync(
  join(ROOT, "client", "src", "pages", "Settings.tsx"),
  "utf8",
);

describe("Push 91 — Approvals admin wiring", () => {
  it("approvals.listPending uses adminOrTutorProcedure (not public)", () => {
    const i = ROUTERS.indexOf("listPending: adminOrTutorProcedure");
    expect(i).toBeGreaterThan(-1);
  });

  it("approvals.resolve uses adminOrTutorProcedure", () => {
    const i = ROUTERS.indexOf("resolve: adminOrTutorProcedure");
    expect(i).toBeGreaterThan(-1);
  });

  it("rosterOverride.pushTargets is exposed for the card to read", () => {
    expect(ROUTERS).toMatch(/pushTargets:\s*adminOrTutorProcedure/);
  });

  it("card reads approvals.listPending and calls approvals.resolve", () => {
    expect(CARD).toContain("approvals?.listPending?.useQuery");
    expect(CARD).toContain("approvals?.resolve?.useMutation");
  });

  it("card reads rosterOverride.pushTargets", () => {
    expect(CARD).toContain("rosterOverride?.pushTargets?.useQuery");
  });

  it("card self-hides when there is nothing pending AND no targets", () => {
    expect(CARD).toMatch(/pending\.length === 0 && targets\.length === 0/);
    expect(CARD).toContain("return null");
  });

  it("card is mounted on Settings → Requests tab", () => {
    // The TabsContent block for "requests" is short; search the whole file
    // but require that ApprovalsAdminCard is referenced AND imported.
    expect(SETTINGS).toContain("<ApprovalsAdminCard />");
    expect(SETTINGS).toContain('from "@/components/ApprovalsAdminCard"');
  });

  it("Approve and Reject buttons send the expected status values", () => {
    expect(CARD).toContain('status: "approved"');
    expect(CARD).toContain('status: "rejected"');
  });
});
