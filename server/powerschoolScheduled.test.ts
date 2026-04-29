import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { registerScheduledSync } from "./scheduledSync";

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerScheduledSync(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => {
  server?.close();
});

describe("/api/scheduled/powerschool/ingest", () => {
  it("rejects anonymous callers", async () => {
    const r = await fetch(`${baseUrl}/api/scheduled/powerschool/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw: "anything" }),
    });
    expect(r.status).toBe(401);
  });

  it("rejects empty body", async () => {
    // Even if auth were in place, the shape check must reject junk; we still want
    // 401 here because no cookie is set, so just assert it's not a 500.
    const r = await fetch(`${baseUrl}/api/scheduled/powerschool/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect([400, 401]).toContain(r.status);
  });
});
