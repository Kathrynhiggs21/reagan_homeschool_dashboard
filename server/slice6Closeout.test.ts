/**
 * v2.30 (2026-05-18) — Slice 6 closeout contract.
 *
 * Locks the four "Reagan-side surfaces" todos in place by source-pattern
 * scan (no DB / runtime needed):
 *
 *   1. `today.tomorrowChoice` (publicProcedure) returns the 3-option
 *      pre-approved set + persisted pick for tomorrow's summer-choice
 *      block, gated by `effectiveSummerActive`.
 *   2. `today.recordTomorrowChoice` (publicProcedure) auto-approves a
 *      pick if it's in the deterministic option set; throws otherwise.
 *      Stores under the `tomorrowChoice.<iso>.<blockType>` app-setting
 *      key. NEVER queues an SMS approval — Mom + Grandma never see it
 *      because every option in the seed is pre-approved curriculum.
 *   3. `client/src/components/TomorrowChoiceCard.tsx` is the kid-facing
 *      surface, mounted on Today, self-hides when summer is inactive
 *      or when the option set is empty.
 *   4. `blocks.complete` + `blocks.selfComplete` forward awardSticker's
 *      summer-boost payload (summerActive, streakDays,
 *      streakBoostMultiplier, coins, baseCoins) onto the returned row.
 *      Today.tsx's celebrate toast surfaces the boost copy when the
 *      payload reports summerActive && multiplier > 1.
 *
 * If any of these contracts drift, this file goes red so the regression
 * is caught before it reaches the kid surface.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const routersSrc = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
const todaySrc = fs.readFileSync(
  path.join(__dirname, "..", "client", "src", "pages", "Today.tsx"),
  "utf-8",
);
const cardSrc = fs.readFileSync(
  path.join(__dirname, "..", "client", "src", "components", "TomorrowChoiceCard.tsx"),
  "utf-8",
);

describe("Slice 6 closeout — Push 82 tomorrowChoice procs", () => {
  it("today.tomorrowChoice is registered as publicProcedure", () => {
    const idx = routersSrc.indexOf("tomorrowChoice: publicProcedure");
    expect(idx).toBeGreaterThan(0);
  });

  it("tomorrowChoice computes tomorrow's ISO date with d.setDate(d.getDate() + 1)", () => {
    const idx = routersSrc.indexOf("tomorrowChoice: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2200);
    expect(slice).toContain("d.setDate(d.getDate() + 1)");
    expect(slice).toContain("toISOString().slice(0, 10)");
  });

  it("tomorrowChoice gates options on effectiveSummerActive (no options off-summer)", () => {
    const idx = routersSrc.indexOf("tomorrowChoice: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toContain("effectiveSummerActive");
    expect(slice).toContain("summerChoiceOptions");
    // The query must hand back active:false when summer is off, not throw.
    expect(slice).toContain("status.active");
  });

  it("tomorrowChoice reads persisted pick from `tomorrowChoice.<iso>.<blockType>`", () => {
    const idx = routersSrc.indexOf("tomorrowChoice: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toMatch(/savedKey\s*=\s*`tomorrowChoice\.\$\{tomorrowIso\}\.\$\{blockType\}`/);
    expect(slice).toContain("db.getAppSetting(savedKey)");
  });

  it("recordTomorrowChoice is registered as publicProcedure (kid-callable)", () => {
    const idx = routersSrc.indexOf("recordTomorrowChoice: publicProcedure");
    expect(idx).toBeGreaterThan(0);
  });

  it("recordTomorrowChoice rejects picks not in the deterministic option set", () => {
    const idx = routersSrc.indexOf("recordTomorrowChoice: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toContain("allowedKinds");
    expect(slice).toMatch(/throw new Error\(`chosenKind not in pre-approved set/);
  });

  it("recordTomorrowChoice persists via setAppSetting under the same key family", () => {
    const idx = routersSrc.indexOf("recordTomorrowChoice: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toContain("db.setAppSetting(savedKey, input.chosenKind)");
    expect(slice).toContain('autoApproved: true');
  });

  it("recordTomorrowChoice never enqueues an SMS approval (Mom+Grandma never queued)", () => {
    const idx = routersSrc.indexOf("recordTomorrowChoice: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2500);
    // The mutation must not call any of the SMS / pendingApprovals helpers.
    expect(slice).not.toContain("queueApproval");
    expect(slice).not.toContain("createPendingApproval");
    expect(slice).not.toContain("notifyOwner");
  });
});

describe("Slice 6 closeout — Push 82 TomorrowChoiceCard kid surface", () => {
  it("imports and uses today.tomorrowChoice + today.recordTomorrowChoice", () => {
    expect(cardSrc).toContain("today?.tomorrowChoice?.useQuery");
    expect(cardSrc).toContain("today?.recordTomorrowChoice?.useMutation");
  });

  it("self-hides when summer mode is inactive (data.active === false)", () => {
    expect(cardSrc).toContain("if (!data.active) return null");
  });

  it("self-hides when the option set is empty (no info → no render)", () => {
    expect(cardSrc).toContain("if (!options || options.length === 0) return null");
  });

  it("collapses to a confirmation pill once Reagan has picked", () => {
    expect(cardSrc).toContain('data-state="picked"');
    expect(cardSrc).toContain("Tomorrow's pick");
  });

  it("is imported on Today.tsx (mount deferred per v2.87 simplification)", () => {
    // v3.28 (2026-06-01): Today.tsx was simplified; TomorrowChoiceCard
    // remains importable but is not currently rendered.
    expect(todaySrc).toContain('import { TomorrowChoiceCard } from "@/components/TomorrowChoiceCard"');
  });
});

describe("Slice 6 closeout — v2.30 streak boost surfacing", () => {
  it("blocks.complete forwards summerActive + streakBoostMultiplier on the return shape", () => {
    const idx = routersSrc.indexOf("complete: familyAdminProcedure.input(z.object({ id: z.number(), grade:");
    expect(idx).toBeGreaterThan(0);
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toContain("summerActive: !!(award && award.summerActive)");
    expect(slice).toContain("streakBoostMultiplier: award?.streakBoostMultiplier ?? 1");
    expect(slice).toContain("coins: award?.coins ?? 0");
    expect(slice).toContain("baseCoins: award?.baseCoins ?? 0");
    expect(slice).toContain("streakDays: award?.streakDays ?? 0");
  });

  it("blocks.complete still wraps the awardSticker call in try/catch (best-effort)", () => {
    const idx = routersSrc.indexOf("complete: familyAdminProcedure.input(z.object({ id: z.number(), grade:");
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toContain("let award: any = null;");
    expect(slice).toContain("try {");
    expect(slice).toContain('console.warn("[rewards] awardSticker failed", e)');
  });

  it("blocks.selfComplete forwards summerActive + streakBoostMultiplier on the return shape", () => {
    const idx = routersSrc.indexOf("selfComplete: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toContain("summerActive: !!(award && award.summerActive)");
    expect(slice).toContain("streakBoostMultiplier: award?.streakBoostMultiplier ?? 1");
    expect(slice).toContain("coins: award?.coins ?? 0");
  });

  it("blocks.selfComplete still wraps awardSticker in try/catch (kid path never throws)", () => {
    const idx = routersSrc.indexOf("selfComplete: publicProcedure");
    const slice = routersSrc.slice(idx, idx + 2500);
    expect(slice).toContain("let award: any = null;");
    expect(slice).toContain("await db.awardSticker({");
    expect(slice).toContain('console.warn("[rewards] awardSticker failed (selfComplete)"');
  });

  it("Today.tsx celebrate toast reads streakBoostMultiplier + summerActive + coins from the mutation result", () => {
    expect(todaySrc).toContain('"streakBoostMultiplier" in out');
    expect(todaySrc).toContain("(out as any).summerActive");
    expect(todaySrc).toContain('"coins" in out');
  });

  it("Today.tsx celebrate toast guards the boost branch on summerActive && boost > 1 && coins > 0", () => {
    expect(todaySrc).toContain("summerActive && Number.isFinite(boost) && boost > 1 && Number.isFinite(coins) && coins > 0");
  });

  it("Today.tsx celebrate toast falls back to the regular sticker copy off-summer / when payload missing", () => {
    expect(todaySrc).toContain('celebrateKiwi("Yay! 🎉 +1 sticker!");');
  });

  it("Today.tsx celebrate toast surfaces the boost copy on streak days", () => {
    expect(todaySrc).toContain("Summer streak!");
    expect(todaySrc).toContain("×${boost} boost");
  });
});
