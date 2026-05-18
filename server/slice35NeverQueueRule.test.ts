/**
 * v2.31 (2026-05-18) — Slice 3.5 hard-rule lock.
 *
 * Locks two invariants that close two open todos in todo.md → "Slice 3.5
 * — SMS approvals + tutor roster":
 *
 *   1. Mom + Grandma actions NEVER enter the approval queue.
 *      Tutors / AI / Reagan still queue.
 *      Implementation lives in `server/routers.ts` approvals.submit
 *      handler — `roleForEmail()` short-circuit BEFORE `decideApproval`.
 *
 *   2. phoneRecipients seeded with Mom 513-926-5808 + Grandma 513-646-9281.
 *      Implementation lives in `server/db.ts` `SLICE_3_5_DEFAULT_PUSH_TARGETS`
 *      + `ensureDefaultPushTargets()` (idempotent on `displayName`).
 *
 * Strategy: source-pattern checks against the actual files on disk so a
 * future refactor that drops the bypass or changes the seed numbers will
 * trip red. NO live DB needed — keeps this test fast and deterministic.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTERS_TS = readFileSync(resolve(__dirname, "routers.ts"), "utf-8");
const DB_TS = readFileSync(resolve(__dirname, "db.ts"), "utf-8");
const PERMISSIONS_TS = readFileSync(
  resolve(__dirname, "_lib/permissions.ts"),
  "utf-8",
);

/** Slice the approvals.submit handler so we don't accidentally match on
 *  unrelated parts of routers.ts. */
function approvalsSubmitSlice(): string {
  const startMarker = /submit:\s*adminOrTutorProcedure/;
  const startIdx = ROUTERS_TS.search(startMarker);
  expect(startIdx, "approvals.submit handler not found").toBeGreaterThan(0);
  // Cap the slice generously — handler is ~70 lines.
  return ROUTERS_TS.slice(startIdx, startIdx + 4000);
}

describe("Slice 3.5 never-queue rule (Mom + Grandma)", () => {
  describe("approvals.submit handler", () => {
    const slice = approvalsSubmitSlice();

    it("calls roleForEmail() on the caller's email before deciding", () => {
      // Bypass MUST consult the same source of truth as familyAdminProcedure.
      expect(slice).toMatch(/roleForEmail\(userEmail\)/);
    });

    it("treats `parent` and `editor` roles as household adults", () => {
      // parent = Mom/Dad, editor = Grandma. Tutors land on `tutor` role and
      // MUST still go through the decider.
      expect(slice).toMatch(/familyRole\s*===\s*"parent"\s*\|\|\s*familyRole\s*===\s*"editor"/);
    });

    it("short-circuits BEFORE building ApprovalContext + calling decideApproval", () => {
      const householdIdx = slice.indexOf("isHouseholdAdult");
      const decideIdx = slice.indexOf("decideApproval(apprCtx)");
      expect(householdIdx, "isHouseholdAdult check not found").toBeGreaterThan(0);
      expect(decideIdx, "decideApproval call not found").toBeGreaterThan(0);
      expect(householdIdx).toBeLessThan(decideIdx);
    });

    it("writes the bypass row with status=auto_approved and aiDecision=auto_approve", () => {
      // Bypass still produces an audit row, just never sits in the queue.
      const householdSlice = slice.slice(slice.indexOf("isHouseholdAdult"));
      expect(householdSlice).toMatch(/status:\s*"auto_approved"/);
      expect(householdSlice).toMatch(/aiDecision:\s*"auto_approve"/);
    });

    it("decidedBy is the actual userEmail, not 'ai' (so audit is honest)", () => {
      const householdSlice = slice.slice(slice.indexOf("isHouseholdAdult"));
      expect(householdSlice).toMatch(/decidedBy:\s*userEmail/);
    });

    it("does NOT call notifyOwner for household adults (they don't need a ping for their own actions)", () => {
      // Slice the household-adult branch only (up to the close-paren before the apprCtx block).
      const startIdx = slice.indexOf("isHouseholdAdult");
      const endIdx = slice.indexOf("const apprCtx", startIdx);
      expect(endIdx).toBeGreaterThan(startIdx);
      const householdBranch = slice.slice(startIdx, endIdx);
      // Strip JS comments first — the explanatory "// no notifyOwner ping" is
      // documentation, not a real call.
      const stripped = householdBranch
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(stripped).not.toMatch(/notifyOwner\s*\(/);
    });

    it("non-household callers STILL run through decideApproval + insert + notifyOwner-on-needs-review", () => {
      // The original AI path must remain intact.
      expect(slice).toMatch(/const verdict = decideApproval\(apprCtx\)/);
      expect(slice).toMatch(/await db\.insertPendingApproval/);
      expect(slice).toMatch(/notifyOwner\(\{[^}]*Approval needed/);
    });
  });

  describe("permissions.ts vocabulary", () => {
    it("Mom (spear.cpt@gmail.com) maps to 'parent' role", () => {
      expect(PERMISSIONS_TS).toMatch(/spear\.cpt@gmail\.com/);
      expect(PERMISSIONS_TS).toMatch(/PARENT_EMAILS/);
    });

    it("Grandma Marcy (marcy.spear@gmail.com) maps to 'editor' role", () => {
      expect(PERMISSIONS_TS).toMatch(/marcy\.spear@gmail\.com/);
      expect(PERMISSIONS_TS).toMatch(/EDITOR_EMAILS/);
    });

    it("Reagan (reaganhiggs910@gmail.com) maps to 'student' — must NOT bypass", () => {
      expect(PERMISSIONS_TS).toMatch(/reaganhiggs910@gmail\.com/);
      // The bypass uses parent || editor, NOT student → confirms Reagan still queues.
      const slice = approvalsSubmitSlice();
      expect(slice).not.toMatch(/familyRole\s*===\s*"student"/);
    });

    it("tutors (madison/sophie/keith) map to 'tutor' role — must NOT bypass", () => {
      expect(PERMISSIONS_TS).toMatch(/TUTOR_EMAILS/);
      const slice = approvalsSubmitSlice();
      expect(slice).not.toMatch(/familyRole\s*===\s*"tutor"/);
    });
  });
});

describe("Slice 3.5 phoneRecipients seed (Mom 513-926-5808 + Grandma 513-646-9281)", () => {
  it("exports SLICE_3_5_DEFAULT_PUSH_TARGETS const", () => {
    expect(DB_TS).toMatch(/SLICE_3_5_DEFAULT_PUSH_TARGETS/);
    expect(DB_TS).toMatch(/export const SLICE_3_5_DEFAULT_PUSH_TARGETS/);
  });

  it("includes Mom's phone number in E.164 (+15139265808)", () => {
    expect(DB_TS).toMatch(/\+15139265808/);
  });

  it("includes Grandma's phone number in E.164 (+15136469281)", () => {
    expect(DB_TS).toMatch(/\+15136469281/);
  });

  it("Mom's row carries role=parent so the never-queue bypass picks her up", () => {
    // The bypass keys on roleForEmail()'s output, not on this column, but
    // keeping `role` in sync stops downstream confusion.
    expect(DB_TS).toMatch(/displayName:\s*"Mom"[^}]*role:\s*"parent"/);
  });

  it("Grandma's row exists with the correct phone", () => {
    expect(DB_TS).toMatch(/displayName:\s*"Grandma"[^}]*\+15136469281/);
  });

  it("ensureDefaultPushTargets() is idempotent on displayName", () => {
    expect(DB_TS).toMatch(/export async function ensureDefaultPushTargets/);
    // Idempotency = "if exists, skip" branch.
    const seederSlice = DB_TS.slice(DB_TS.indexOf("ensureDefaultPushTargets"));
    expect(seederSlice).toMatch(/existingNames\.has/);
    expect(seederSlice).toMatch(/continue/);
  });

  it("seeder INSERTs into recipientPushTargets table", () => {
    const seederSlice = DB_TS.slice(DB_TS.indexOf("ensureDefaultPushTargets"));
    expect(seederSlice).toMatch(/insert\(recipientPushTargets\)/);
    expect(seederSlice).toMatch(/isActive:\s*true/);
  });

  it("seeder returns { inserted, existing } counts for observability", () => {
    const seederSlice = DB_TS.slice(DB_TS.indexOf("ensureDefaultPushTargets"));
    expect(seederSlice).toMatch(/inserted/);
    expect(seederSlice).toMatch(/existing/);
  });
});
