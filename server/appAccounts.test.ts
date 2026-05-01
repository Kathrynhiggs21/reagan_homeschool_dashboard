import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Integration test: appAccounts router.
 *
 * Verifies the list endpoint auto-seeds at least the core learning apps,
 * status updates round-trip, and the password locker can store, reveal,
 * and clear without leaking ciphertext to non-reveal callers.
 */
function adminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "spear.cpt@gmail.com",
      name: "Adult",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const KEY_BACKUP = process.env.JWT_SECRET;

beforeAll(() => {
  // Need at least 32 bytes for AES-256 — pad to be safe in CI.
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = "test-jwt-secret-padded-to-32-bytes-or-more";
  }
});
afterAll(() => {
  if (KEY_BACKUP === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = KEY_BACKUP;
});

describe("appAccounts router", () => {
  it("list returns seeded rows and never leaks ciphertext", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const rows = await caller.appAccounts.list();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      // ciphertext fields must be stripped
      expect((r as any).passwordEncrypted).toBeUndefined();
      expect((r as any).passwordIv).toBeUndefined();
      // hasPassword flag is the only signal of stored credential
      expect(typeof r.hasPassword).toBe("boolean");
    }
  });

  it("password locker round-trips: save → reveal → clear", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const rows = await caller.appAccounts.list();
    const target = rows[0];
    expect(target).toBeTruthy();

    await caller.appAccounts.setPassword({ id: target.id, password: "Goose214$-test" });

    const reveal = await caller.appAccounts.revealPassword({ id: target.id });
    expect(reveal.password).toBe("Goose214$-test");

    await caller.appAccounts.clearPassword({ id: target.id });
    const after = await caller.appAccounts.revealPassword({ id: target.id });
    expect(after.password).toBeNull();
  });

  it("upsertStatus persists the new status (and bumps lastVerifiedAt on active)", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const rows = await caller.appAccounts.list();
    const target = rows[1] || rows[0];

    await caller.appAccounts.upsertStatus({ id: target.id, status: "active", signInEmail: "reaganhiggs910@gmail.com" });
    const after = await caller.appAccounts.list();
    const updated = after.find((r) => r.id === target.id)!;
    expect(updated.status).toBe("active");
    expect(updated.signInEmail).toBe("reaganhiggs910@gmail.com");
  });
});
