/**
 * v3.29 (2026-06-02) — Admin-runnable Job B contract lock.
 *
 * The nightly Drive-mirror playbook (Job B) targets four endpoints. The Manus
 * platform gateway hard-restricts the /api/scheduled/* prefix to cron callers
 * (a nonexistent /api/scheduled/* path also 403s with "permission error for
 * cron cookie" — the request never reaches Express), so a user-session cookie
 * can never run Job B by hand.
 *
 * The fix mirrors the four handlers under /api/admin/drive-mirror/* — a prefix
 * the gateway does NOT special-case — gated in-app by requireAdminSession
 * (role === "admin" only). This file locks:
 *   1. All four admin routes are registered.
 *   2. Each admin route is gated by requireAdminSession + delegates to the
 *      same shared handler the cron path uses.
 *   3. The original /api/scheduled/* routes are unchanged (still present, still
 *      cron-gated).
 *   4. Live behavior: anonymous calls to the admin routes get 403
 *      "Admin session required"; anonymous calls to the scheduled routes still
 *      get 401.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  registerScheduledSync,
  requireAdminSession,
  drivePushPendingHandler,
  drivePushResultHandler,
  driveFolderMapHandler,
  driveFolderMapResultHandler,
} from "./scheduledSync";

const src = readFileSync(join(__dirname, "scheduledSync.ts"), "utf8");

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  registerScheduledSync(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (addr && typeof addr === "object") baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("admin drive-mirror routes — registration", () => {
  it("registers GET /api/admin/drive-mirror/folder-map", () => {
    expect(src).toMatch(/app\.get\(\s*["']\/api\/admin\/drive-mirror\/folder-map["']/);
  });
  it("registers POST /api/admin/drive-mirror/folder-map/result", () => {
    expect(src).toMatch(/app\.post\(\s*["']\/api\/admin\/drive-mirror\/folder-map\/result["']/);
  });
  it("registers GET /api/admin/drive-mirror/pending", () => {
    expect(src).toMatch(/app\.get\(\s*["']\/api\/admin\/drive-mirror\/pending["']/);
  });
  it("registers POST /api/admin/drive-mirror/result", () => {
    expect(src).toMatch(/app\.post\(\s*["']\/api\/admin\/drive-mirror\/result["']/);
  });
});

describe("admin drive-mirror routes — gating + delegation", () => {
  it("every /api/admin/drive-mirror/* route guards with requireAdminSession before delegating", () => {
    // Pull the block of admin routes and assert each one calls requireAdminSession.
    const adminBlock = src.slice(src.indexOf('"/api/admin/drive-mirror/folder-map"'));
    const guardCount = (adminBlock.match(/if \(!\(await requireAdminSession\(req, res\)\)\) return;/g) || []).length;
    // 4 admin routes, each must guard.
    expect(guardCount).toBeGreaterThanOrEqual(4);
  });

  it("requireAdminSession requires role === 'admin' (stricter than the cron gate)", () => {
    expect(src).toMatch(/export async function requireAdminSession/);
    expect(src).toMatch(/if \(role !== "admin"\)/);
    expect(src).toMatch(/error: "Admin session required"/);
  });

  it("admin routes delegate to the same shared handlers the cron path uses", () => {
    // folder-map GET delegates to driveFolderMapHandler
    expect(src).toMatch(/drive-mirror\/folder-map["'][\s\S]{0,160}driveFolderMapHandler\(req, res\)/);
    // folder-map/result POST delegates to driveFolderMapResultHandler
    expect(src).toMatch(/drive-mirror\/folder-map\/result["'][\s\S]{0,160}driveFolderMapResultHandler\(req, res\)/);
    // pending GET delegates to drivePushPendingHandler
    expect(src).toMatch(/drive-mirror\/pending["'][\s\S]{0,160}drivePushPendingHandler\(req, res\)/);
    // result POST delegates to drivePushResultHandler
    expect(src).toMatch(/drive-mirror\/result["'][\s\S]{0,160}drivePushResultHandler\(req, res\)/);
  });

  it("the shared handlers are exported and callable", () => {
    expect(typeof requireAdminSession).toBe("function");
    expect(typeof drivePushPendingHandler).toBe("function");
    expect(typeof drivePushResultHandler).toBe("function");
    expect(typeof driveFolderMapHandler).toBe("function");
    expect(typeof driveFolderMapResultHandler).toBe("function");
  });
});

describe("admin drive-mirror routes — original /api/scheduled/* untouched", () => {
  it("the four /api/scheduled/* drive routes still exist", () => {
    expect(src).toMatch(/app\.get\(\s*["']\/api\/scheduled\/drive-push\/pending["']/);
    expect(src).toMatch(/app\.post\(\s*["']\/api\/scheduled\/drive-push\/result["']/);
    expect(src).toMatch(/app\.get\(\s*["']\/api\/scheduled\/drive-folder-map["']/);
    expect(src).toMatch(/app\.post\(\s*["']\/api\/scheduled\/drive-folder-map\/result["']/);
  });

  it("the /api/scheduled/* drive routes keep the cron gate (user|admin)", () => {
    // Each scheduled drive route still rejects non-user/admin with 401 Unauthorized.
    const schedBlock = src.slice(
      src.indexOf('"/api/scheduled/drive-push/pending"'),
      src.indexOf('"/api/admin/drive-mirror/folder-map"'),
    );
    const cronGates = (schedBlock.match(/role !== "user" && role !== "admin"/g) || []).length;
    expect(cronGates).toBeGreaterThanOrEqual(4);
  });
});

describe("admin drive-mirror routes — live behavior", () => {
  it("anonymous GET /api/admin/drive-mirror/pending → 403 Admin session required", async () => {
    const r = await fetch(`${baseUrl}/api/admin/drive-mirror/pending`);
    expect(r.status).toBe(403);
    const body = await r.json();
    expect(body.error).toBe("Admin session required");
  });

  it("anonymous POST /api/admin/drive-mirror/result → 403 Admin session required", async () => {
    const r = await fetch(`${baseUrl}/api/admin/drive-mirror/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1, status: "pushed" }),
    });
    expect(r.status).toBe(403);
    const body = await r.json();
    expect(body.error).toBe("Admin session required");
  });

  it("anonymous GET /api/admin/drive-mirror/folder-map → 403", async () => {
    const r = await fetch(`${baseUrl}/api/admin/drive-mirror/folder-map`);
    expect(r.status).toBe(403);
  });

  it("anonymous POST /api/admin/drive-mirror/folder-map/result → 403", async () => {
    const r = await fetch(`${baseUrl}/api/admin/drive-mirror/folder-map/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries: [] }),
    });
    expect(r.status).toBe(403);
  });

  it("anonymous calls to the original /api/scheduled/* drive routes still 401", async () => {
    const r1 = await fetch(`${baseUrl}/api/scheduled/drive-push/pending`);
    expect(r1.status).toBe(401);
    const r2 = await fetch(`${baseUrl}/api/scheduled/drive-folder-map`);
    expect(r2.status).toBe(401);
  });
});
