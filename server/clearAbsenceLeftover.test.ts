import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("clear leftover absence flag", () => {
  it("removes absence:YYYY-MM-DD if present", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `absence:${today}`;
    await db.setAppSetting(key, null);
    const v = await db.getAppSetting(key).catch(() => null);
    expect(v ?? null).toBeNull();
  });
});
