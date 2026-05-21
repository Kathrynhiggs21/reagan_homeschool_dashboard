/**
 * Push 15 — cross-device persistence for the three Kiwi sliders.
 *
 * Contract: KiwiContext writes to `appSettings` keys
 *   kiwi.animationLevel | kiwi.talkLevel | kiwi.funnyLevel
 * via the protected `prefs.set` mutation, and reads them back via
 * `prefs.get`. Values are 0..4 stored as strings.
 *
 * This test exercises the SERVER side directly (db.setAppSetting +
 * db.getAppSetting + the prefs router) so the round-trip is locked
 * even if the client-side hook is later refactored.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { readFileSync } from "node:fs";
import path from "node:path";

const KEYS = ["kiwi.animationLevel", "kiwi.talkLevel", "kiwi.funnyLevel"] as const;

async function cleanup() {
  for (const k of KEYS) {
    await db.setAppSetting(k, null);
  }
}

describe("Kiwi sliders persist to appSettings (push 15)", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("absent keys read back as null so the client falls back to localStorage", async () => {
    for (const k of KEYS) {
      const v = await db.getAppSetting(k);
      expect(v).toBeNull();
    }
  });

  it("setAppSetting + getAppSetting round-trip every 0..4 value", async () => {
    for (const k of KEYS) {
      for (const n of [0, 1, 2, 3, 4]) {
        await db.setAppSetting(k, String(n));
        const back = await db.getAppSetting(k);
        expect(back).toBe(String(n));
      }
    }
  });

  it("setAppSetting overwrites previous value (Mom can drop a slider then raise it)", async () => {
    await db.setAppSetting("kiwi.animationLevel", "4");
    expect(await db.getAppSetting("kiwi.animationLevel")).toBe("4");
    await db.setAppSetting("kiwi.animationLevel", "1");
    expect(await db.getAppSetting("kiwi.animationLevel")).toBe("1");
    await db.setAppSetting("kiwi.animationLevel", "0");
    expect(await db.getAppSetting("kiwi.animationLevel")).toBe("0");
  });

  it("setAppSetting(null) clears the row so the client returns to localStorage default", async () => {
    await db.setAppSetting("kiwi.talkLevel", "3");
    expect(await db.getAppSetting("kiwi.talkLevel")).toBe("3");
    await db.setAppSetting("kiwi.talkLevel", null);
    expect(await db.getAppSetting("kiwi.talkLevel")).toBeNull();
  });

  it("KiwiContext source actually wires the three keys to the prefs router", () => {
    const ctxPath = path.join(__dirname, "..", "client", "src", "contexts", "KiwiContext.tsx");
    const src = readFileSync(ctxPath, "utf8");
    // The three keys must appear AND be set via the persistLvlServer helper
    // so that re-naming the helper in the future doesn't silently break
    // server-side persistence.
    expect(src).toMatch(/persistLvlServer\("kiwi\.animationLevel"/);
    expect(src).toMatch(/persistLvlServer\("kiwi\.talkLevel"/);
    expect(src).toMatch(/persistLvlServer\("kiwi\.funnyLevel"/);
    // And the on-mount hydration must read them back so cross-device works
    expect(src).toMatch(/prefs\.get\.fetch\(\{ key: "kiwi\.animationLevel" \}\)/);
    expect(src).toMatch(/prefs\.get\.fetch\(\{ key: "kiwi\.talkLevel" \}\)/);
    expect(src).toMatch(/prefs\.get\.fetch\(\{ key: "kiwi\.funnyLevel" \}\)/);
  });

  it("prefs router exposes the protected get/set procedures the hook depends on", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const src = readFileSync(routersPath, "utf8");
    // Locate the `prefs: router({ ... })` block and confirm get + set are
    // both protectedProcedure (the hook only fires for logged-in adults,
    // so leaking these as publicProcedure would be a security regression).
    const m = src.match(/prefs: router\(\{[\s\S]*?\n  \}\)/);
    expect(m, "prefs router block must exist in routers.ts").toBeTruthy();
    const block = m![0];
    expect(block).toMatch(/get: protectedProcedure/);
    // v2.28 (2026-05-17) hardened `prefs.set` from protectedProcedure to
    // familyAdminProcedure so Reagan cannot flip Summer Mode, the
    // nightly-email toggle, her own coin balance, or any other KV setting.
    // Mom + Grandma + tutors retain write access via familyAdminProcedure.
    expect(block).toMatch(/set: familyAdminProcedure/);
  });
});
