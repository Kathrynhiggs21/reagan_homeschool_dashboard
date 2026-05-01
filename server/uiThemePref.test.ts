import { describe, it, expect, afterAll } from "vitest";
import { appRouter } from "./routers";

/**
 * Phase 4: ui.theme must be readable through prefs.getPublic so the theme
 * provider can hydrate before the user is signed in (or on a fresh device),
 * and writeable via prefs.set when signed in.
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

describe("prefs.ui.theme (Phase 4)", () => {
  afterAll(async () => {
    // best-effort cleanup so we don't leave a fixture behind
    try {
      const adminCaller = appRouter.createCaller(makeAdminCtx());
      await adminCaller.prefs.set({ key: "ui.theme", value: null });
    } catch { /* ok */ }
  });

  it("public allowlist accepts ui.theme and returns null/string", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const v = await caller.prefs.getPublic({ key: "ui.theme" });
    expect(v === null || typeof v === "string").toBe(true);
  });

  it("admin can set ui.theme=cream and public can read it back", async () => {
    const adminCaller = appRouter.createCaller(makeAdminCtx());
    const publicCaller = appRouter.createCaller(makePublicCtx());
    await adminCaller.prefs.set({ key: "ui.theme", value: "cream" });
    const v = await publicCaller.prefs.getPublic({ key: "ui.theme" });
    expect(v).toBe("cream");
  });
});
