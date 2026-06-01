import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

/**
 * v3.27 — Vitest specs for `drive.listConnectorWarnings` and
 * `drive.clearConnectorWarning`.
 *
 * The procedures touch real `app_settings` rows. We use a unique
 * key prefix so the test is isolated from any production warnings
 * already in the table; the `beforeEach` cleans up our own tag
 * before each run, and we never delete keys outside our tag.
 *
 * The procedures themselves only accept the canonical
 * `drive.connector.warnings.untitledLeak.` prefix; tests therefore
 * write their fixtures under that prefix and use a unique
 * timestamp-based suffix to avoid collisions.
 */

const TAG = `vitest-${process.pid}-${Date.now()}`;
const KEY_PREFIX = "drive.connector.warnings.untitledLeak.";

function adminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user-v327",
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

function userCtx(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "non-admin-v327",
      email: "kid@example.com",
      name: "Kid",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

async function clearTagged(): Promise<void> {
  const rows = await db.listAppSettings(KEY_PREFIX);
  for (const r of rows) {
    if (r.key.includes(TAG)) {
      await db.setAppSetting(r.key, null);
    }
  }
}

const KEY_BACKUP = process.env.JWT_SECRET;
beforeAll(() => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = "test-jwt-secret-padded-to-32-bytes-or-more";
  }
});
afterAll(() => {
  if (KEY_BACKUP === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = KEY_BACKUP;
});

beforeEach(async () => {
  await clearTagged();
});
afterEach(async () => {
  await clearTagged();
});

describe("drive.listConnectorWarnings", () => {
  it("returns parsed warnings (newest first) for admin caller", async () => {
    const t1 = `2026-05-31T03:00:00.000Z`;
    const t2 = `2026-05-31T04:00:00.000Z`;
    const t3 = `2026-05-31T05:00:00.000Z`;
    await db.setAppSetting(
      `${KEY_PREFIX}${t1}.${TAG}.10`,
      JSON.stringify({
        queueId: 10,
        driveFileId: "fileA",
        driveFileName: "Untitled",
        targetFolder: "apps_tools",
        status: "pushed",
        atISO: t1,
      }),
    );
    await db.setAppSetting(
      `${KEY_PREFIX}${t2}.${TAG}.20`,
      JSON.stringify({
        queueId: 20,
        driveFileId: "fileB",
        driveFileName: "Untitled (1)",
        targetFolder: "tutor",
        status: "skipped",
        atISO: t2,
      }),
    );
    await db.setAppSetting(
      `${KEY_PREFIX}${t3}.${TAG}.30`,
      JSON.stringify({
        queueId: 30,
        driveFileId: "fileC",
        driveFileName: "Untitled",
        targetFolder: "kiwi_coins",
        status: "pushed",
        atISO: t3,
      }),
    );

    const caller = appRouter.createCaller(adminCtx());
    const out = await (caller as any).drive.listConnectorWarnings();
    const tagged = out.warnings.filter((w: any) => w.key.includes(TAG));
    expect(tagged.length).toBe(3);
    // Newest first → t3, t2, t1
    expect(tagged[0].atISO).toBe(t3);
    expect(tagged[1].atISO).toBe(t2);
    expect(tagged[2].atISO).toBe(t1);
    expect(tagged[0].queueId).toBe(30);
    expect(tagged[0].driveFileId).toBe("fileC");
    expect(tagged[0].driveFileName).toBe("Untitled");
    expect(tagged[0].status).toBe("pushed");
  });

  it("returns empty list when no warnings exist for admin", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const out = await (caller as any).drive.listConnectorWarnings();
    const tagged = out.warnings.filter((w: any) => w.key.includes(TAG));
    expect(tagged.length).toBe(0);
  });

  it("respects optional `limit`", async () => {
    for (let i = 0; i < 5; i++) {
      const t = `2026-05-31T0${i}:00:00.000Z`;
      await db.setAppSetting(
        `${KEY_PREFIX}${t}.${TAG}.${i}`,
        JSON.stringify({
          queueId: i,
          driveFileId: `f${i}`,
          driveFileName: "Untitled",
          targetFolder: "tutor",
          status: "pushed",
          atISO: t,
        }),
      );
    }
    const caller = appRouter.createCaller(adminCtx());
    const out = await (caller as any).drive.listConnectorWarnings({ limit: 2 });
    // limit applies AFTER sort; top-2 newest globally must include some of ours
    expect(out.warnings.length).toBe(2);
    expect(out.total).toBeGreaterThanOrEqual(5);
  });

  it("tolerates non-JSON values without crashing", async () => {
    await db.setAppSetting(
      `${KEY_PREFIX}2026-05-31T06:00:00.000Z.${TAG}.broken`,
      "{not valid json",
    );
    const caller = appRouter.createCaller(adminCtx());
    const out = await (caller as any).drive.listConnectorWarnings();
    const broken = out.warnings.find((w: any) => w.key.includes(TAG));
    expect(broken).toBeTruthy();
    expect(broken!.queueId).toBeNull();
    expect(broken!.driveFileId).toBeNull();
    expect(broken!.driveFileName).toBeNull();
    expect(broken!.atISO).toBeNull();
  });

  it("rejects non-admin callers (role=user)", async () => {
    const caller = appRouter.createCaller(userCtx());
    await expect((caller as any).drive.listConnectorWarnings()).rejects.toThrow();
  });

  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller({
      user: undefined,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    } as any);
    await expect((caller as any).drive.listConnectorWarnings()).rejects.toThrow();
  });
});

describe("drive.clearConnectorWarning", () => {
  it("removes a warning row by key (admin)", async () => {
    const t = `2026-05-31T07:00:00.000Z`;
    const key = `${KEY_PREFIX}${t}.${TAG}.7`;
    await db.setAppSetting(
      key,
      JSON.stringify({
        queueId: 7,
        driveFileId: "f7",
        driveFileName: "Untitled",
        targetFolder: "tutor",
        status: "pushed",
        atISO: t,
      }),
    );

    const caller = appRouter.createCaller(adminCtx());
    const r = await (caller as any).drive.clearConnectorWarning({ key });
    expect(r.dismissed).toBe(key);

    const after = await db.getAppSetting(key);
    expect(after).toBeNull();
  });

  it("is idempotent — dismissing a missing key succeeds", async () => {
    const key = `${KEY_PREFIX}2026-05-31T08:00:00.000Z.${TAG}.never`;
    const caller = appRouter.createCaller(adminCtx());
    const r = await (caller as any).drive.clearConnectorWarning({ key });
    expect(r.dismissed).toBe(key);
  });

  it("rejects keys outside the untitledLeak prefix", async () => {
    const caller = appRouter.createCaller(adminCtx());
    await expect(
      (caller as any).drive.clearConnectorWarning({ key: "drive.something.else" }),
    ).rejects.toThrow(/untitledLeak/);
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(userCtx());
    await expect(
      (caller as any).drive.clearConnectorWarning({
        key: `${KEY_PREFIX}whatever`,
      }),
    ).rejects.toThrow();
  });
});
