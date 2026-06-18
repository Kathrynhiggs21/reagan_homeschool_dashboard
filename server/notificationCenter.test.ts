import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import * as db from "./db";

/**
 * Notification center coverage:
 *  - DB helpers: create -> unread count rises -> mark all read -> count drops.
 *  - tRPC surface: unreadCount + markAllRead procedures wired.
 *  - Event hooks: kid request + daily-packet-emailed both create notifications.
 *  - Bell UI is adult-only and does not auto-open.
 */

describe("notification center — db helpers", () => {
  it("create -> unread count -> mark all read round-trips", async () => {
    const before = await db.unreadNotificationCount(null);
    await db.createNotification({
      userId: null,
      type: "info",
      title: "__vitest_notif_" + Date.now(),
      body: "test body",
    } as any);
    const after = await db.unreadNotificationCount(null);
    expect(after).toBeGreaterThanOrEqual(before + 1);

    await db.markAllNotificationsRead(null);
    const cleared = await db.unreadNotificationCount(null);
    expect(cleared).toBe(0);
  });

  it("listNotifications returns the broadcast stream", async () => {
    const rows = await db.listNotifications(null);
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe("notification center — tRPC procedures", () => {
  const routers = readFileSync(join(__dirname, "routers.ts"), "utf8");
  it("exposes unreadCount and markAllRead", () => {
    expect(routers).toContain("unreadCount: protectedProcedure");
    expect(routers).toContain("markAllRead: protectedProcedure");
  });
});

describe("notification center — event hooks create in-app notifications", () => {
  const routers = readFileSync(join(__dirname, "routers.ts"), "utf8");

  it("kid request submission creates a notification", () => {
    // The kidRequests.create mutation must persist an in-app notification.
    const idx = routers.indexOf("Reagan sent a request");
    expect(idx).toBeGreaterThan(-1);
    const slice = routers.slice(idx, idx + 600);
    expect(slice).toContain("db.createNotification");
  });

  it("daily packet emailed creates a notification", () => {
    expect(routers).toContain("Daily packet emailed —");
    const idx = routers.indexOf("Daily packet emailed —");
    const slice = routers.slice(Math.max(0, idx - 400), idx + 200);
    expect(slice).toContain("db.createNotification");
    // Only fire on a real send.
    expect(slice).toContain("if (emailSent)");
  });
});

describe("notification center — bell UI is adult-only and not auto-opening", () => {
  const shell = readFileSync(join(__dirname, "../client/src/components/CozyShell.tsx"), "utf8");
  const bell = readFileSync(join(__dirname, "../client/src/components/NotificationBell.tsx"), "utf8");

  it("renders only when adult-unlocked", () => {
    expect(shell).toContain("{unlocked && <NotificationBell />}");
  });

  it("controls the popover open state via click, defaulting closed", () => {
    expect(bell).toContain("useState(false)");
    expect(bell).toContain("open={open}");
  });

  it("supports per-item and mark-all read", () => {
    expect(bell).toContain("markRead.mutate");
    expect(bell).toContain("markAllRead.mutate");
  });
});
