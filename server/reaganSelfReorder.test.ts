/**
 * Push 55 (2026-05-13) — Reagan self-reorder contract.
 *
 * Pinned invariants:
 *   1. `blocks.selfReorder` exists in server/routers.ts and is gated by
 *      `protectedProcedure` (any logged-in user, including Reagan).
 *   2. The handler ONLY rewrites sortOrder; it MUST NOT touch startTime
 *      or durationMin (Mom + Grandma exclusive).
 *   3. The kid-side Today UI mounts up/down buttons with stable testids
 *      `reagan-reorder-up` / `reagan-reorder-down`.
 *   4. The kid path uses the locked branch (`!unlocked`) so the existing
 *      adult-only ↑ Earlier / ↓ Later buttons under `unlocked` are
 *      untouched.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Push 55 — Reagan self-reorder", () => {
  const routers = readFileSync(resolve(__dirname, "routers.ts"), "utf-8");
  const today = readFileSync(resolve(__dirname, "..", "client", "src", "pages", "Today.tsx"), "utf-8");

  it("registers blocks.selfReorder on protectedProcedure", () => {
    const idx = routers.indexOf("selfReorder: protectedProcedure");
    expect(idx).toBeGreaterThan(0);
    // Handler body MUST be within the same lexical block as protectedProcedure
    const body = routers.slice(idx, idx + 1500);
    expect(body).toMatch(/orderedIds:\s*z\.array\(z\.number\(\)\.int\(\)\.positive\(\)\)/);
    expect(body).toContain("await db.getPlanByDate(input.date)");
  });

  it("never touches startTime or durationMin in selfReorder body", () => {
    const idx = routers.indexOf("selfReorder: protectedProcedure");
    const end = routers.indexOf("delete: familyAdminProcedure", idx);
    expect(end).toBeGreaterThan(idx);
    const body = routers.slice(idx, end);
    // Only sortOrder may be assigned by the handler. We allow the words to
    // appear in comments above the handler, hence the lexical window cap.
    const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/startTime\s*:/);
    expect(code).not.toMatch(/durationMin\s*:/);
    expect(code).not.toMatch(/cascadeStartTimes/);
  });

  it("mounts up/down buttons under the kid-only !unlocked branch", () => {
    expect(today).toContain('data-testid="reagan-reorder-up"');
    expect(today).toContain('data-testid="reagan-reorder-down"');
    const idx = today.indexOf('data-testid="reagan-reorder-up"');
    const before = today.slice(Math.max(0, idx - 1200), idx);
    expect(before).toMatch(/!unlocked\s*&&\s*\(selfReorderM as any\)/);
  });

  it("calls trpc.blocks.selfReorder via mutation hook", () => {
    expect(today).toContain("trpc as any).blocks?.selfReorder?.useMutation?.()");
  });
});
