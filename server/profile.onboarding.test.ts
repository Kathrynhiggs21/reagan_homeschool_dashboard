import { describe, it, expect } from "vitest";
import * as db from "./db";

/**
 * Profile + appLinks sanity checks for Round 4a-i.
 *
 * - Confirms we can mark onboardingCompleted via upsertProfile
 * - Confirms the appLinks enum accepts the expanded categories
 *   (google, video) after the 0008 migration
 */

describe("Profile onboarding + appLinks categories", () => {
  it("upsertProfile persists onboardingCompleted = true", async () => {
    await db.upsertProfile({ onboardingCompleted: true } as any);
    const p: any = await db.getProfile();
    expect(p).toBeTruthy();
    expect(p.onboardingCompleted).toBe(true);
  });

  it("upsertProfile accepts companionName + companionAvatar + photoUrl + interests", async () => {
    await db.upsertProfile({
      companionName: "Kiwi",
      companionAvatar: "⭐",
      photoUrl: "https://example.com/reagan.jpg",
      interests: ["animals", "art"],
    } as any);
    const p: any = await db.getProfile();
    expect(p.companionName).toBe("Kiwi");
    expect(p.companionAvatar).toBe("⭐");
    expect(p.photoUrl).toBe("https://example.com/reagan.jpg");
    expect(Array.isArray(p.interests)).toBe(true);
  });

  it("appLinks contains google + video categories after migration 0008", async () => {
    const links: any[] = await db.listAppLinks();
    const cats = new Set(links.map((l) => l.category));
    expect(cats.has("google")).toBe(true);
    expect(cats.has("video")).toBe(true);
    expect(cats.has("school")).toBe(true);
  });
});
