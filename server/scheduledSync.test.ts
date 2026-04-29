import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";
import { registerScheduledSync } from "./scheduledSync";
import * as db from "./db";
import { syncRunItems } from "../drizzle/schema";
import { eq } from "drizzle-orm";

let server: Server;
let baseUrl = "";
const testExternalIds: string[] = [];

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  registerScheduledSync(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (addr && typeof addr === "object") {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
});

afterAll(async () => {
  // clean any test items
  if (testExternalIds.length) {
    const dbi = db.getDb();
    for (const eid of testExternalIds) {
      await dbi.delete(syncRunItems).where(eq(syncRunItems.externalId, eid));
    }
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Scheduled-sync endpoint", () => {
  it("rejects anonymous POSTs with 401", async () => {
    const res = await fetch(`${baseUrl}/api/scheduled/upload-sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "gmail", items: [] }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/Unauthorized/);
  });

  it("rejects bad shape with 400 (when caller is unauthorized 401 takes precedence)", async () => {
    const res = await fetch(`${baseUrl}/api/scheduled/upload-sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it("anonymous GET on pending also rejected", async () => {
    const res = await fetch(`${baseUrl}/api/scheduled/upload-sync/pending`);
    expect(res.status).toBe(401);
  });
});
