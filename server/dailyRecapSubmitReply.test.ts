/**
 * v2.92 (2026-05-27) — Source contract for the new in-app recap reply path.
 * The webhook /api/scheduled/daily-recap-reply is wide-open and nobody is
 * calling it (65 sent, 0 parsed in production). This adds an authenticated
 * tRPC submission path that the adult drawer uses directly.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTERS = readFileSync(join(__dirname, "routers.ts"), "utf8");

describe("dailyRecap.submitReply / listPending contract", () => {
  it("dailyRecap router exposes listPending", () => {
    expect(ROUTERS).toMatch(/listPending:\s*protectedProcedure\.query/);
  });

  it("dailyRecap router exposes submitReply mutation", () => {
    expect(ROUTERS).toMatch(/submitReply:\s*protectedProcedure[\s\S]{0,400}\.mutation/);
  });

  it("submitReply accepts a token + replyText input shape", () => {
    const idx = ROUTERS.indexOf("submitReply: protectedProcedure");
    expect(idx).toBeGreaterThan(-1);
    const window = ROUTERS.slice(idx, idx + 800);
    expect(window).toMatch(/token:\s*z\.string\(\)/);
    expect(window).toMatch(/replyText:\s*z\.string\(\)/);
  });

  it("submitReply requires admin-or-user role (familyAdmin gate)", () => {
    const idx = ROUTERS.indexOf("submitReply: protectedProcedure");
    const window = ROUTERS.slice(idx, idx + 1800);
    expect(window).toMatch(/ctx\.user\.role\s*!==\s*["']admin["']/);
    expect(window).toMatch(/ctx\.user\.role\s*!==\s*["']user["']/);
    expect(window).toMatch(/throw new Error\(["']forbidden["']\)/);
  });

  it("submitReply uses the canonical parser primitives", () => {
    const idx = ROUTERS.indexOf("submitReply: protectedProcedure");
    const window = ROUTERS.slice(idx, idx + 2500);
    expect(window).toMatch(/clampReplyText/);
    expect(window).toMatch(/isNothingHappenedReply/);
    expect(window).toMatch(/markRecapReplied/);
    expect(window).toMatch(/getRecapRequestByToken/);
  });

  it("listPending returns at most the 14 most recent pending requests", () => {
    // Anchor inside the dailyRecap block to avoid colliding with other
    // routers that also expose a `listPending` procedure.
    const dailyRecapStart = ROUTERS.indexOf("dailyRecap: router(");
    expect(dailyRecapStart).toBeGreaterThan(-1);
    const dailyRecapEnd = ROUTERS.indexOf("settingsAI: router(", dailyRecapStart);
    const dailyRecapWindow = ROUTERS.slice(dailyRecapStart, dailyRecapEnd);
    expect(dailyRecapWindow).toMatch(/listPending:\s*protectedProcedure/);
    expect(dailyRecapWindow).toMatch(/\.slice\(0,\s*14\)/);
    expect(dailyRecapWindow).toMatch(/listPendingRecapRequests/);
  });
});
