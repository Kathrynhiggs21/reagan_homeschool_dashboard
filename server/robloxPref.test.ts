import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

/**
 * Phase 10: roblox.allowed must be readable through prefs.getPublic
 * (without auth) and round-trippable through prefs.set (with auth).
 */

function makePublicCtx() {
  return { user: null, session: null } as any;
}
function makeAdminCtx() {
  return {
    user: { id: 1, openId: "test-admin", name: "Admin", role: "admin" as const },
    session: null,
  } as any;
}

describe("prefs.roblox.allowed (Phase 10)", () => {
  it("public allowlist accepts roblox.allowed and returns null/string", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const v = await caller.prefs.getPublic({ key: "roblox.allowed" });
    // either null (unset) or a string ("0"/"1") — never throws, never undefined
    expect(v === null || typeof v === "string").toBe(true);
  });

  it("non-allowlisted keys still return null from public endpoint", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const v = await caller.prefs.getPublic({ key: "secret.token" });
    expect(v).toBeNull();
  });

  it("admin can flip roblox.allowed to 1 and read it back", async () => {
    const adminCaller = appRouter.createCaller(makeAdminCtx());
    const publicCaller = appRouter.createCaller(makePublicCtx());
    await adminCaller.prefs.set({ key: "roblox.allowed", value: "1" });
    const v = await publicCaller.prefs.getPublic({ key: "roblox.allowed" });
    expect(v).toBe("1");
    // restore default
    await adminCaller.prefs.set({ key: "roblox.allowed", value: "0" });
  });
});
