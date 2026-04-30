import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("appSettings prefs helpers", () => {
  it("round-trips a value", async () => {
    const key = "__vitest_prefs_roundtrip";
    await db.setAppSetting(key, "hello");
    expect(await db.getAppSetting(key)).toBe("hello");
    await db.setAppSetting(key, "world");
    expect(await db.getAppSetting(key)).toBe("world");
    await db.setAppSetting(key, null);
    const cleanup = await db.getAppSetting(key);
    expect(cleanup === null || cleanup === "").toBeTruthy();
  });

  it("returns null for unknown keys", async () => {
    expect(await db.getAppSetting("__vitest_definitely_missing_key")).toBeNull();
  });

  it("listAppSettings filters by prefix", async () => {
    const pfx = "__vitest_pfx_";
    await db.setAppSetting(pfx + "a", "1");
    await db.setAppSetting(pfx + "b", "2");
    const rows = await db.listAppSettings(pfx);
    const found = rows.map((r) => r.key);
    expect(found).toContain(pfx + "a");
    expect(found).toContain(pfx + "b");
  });
});
