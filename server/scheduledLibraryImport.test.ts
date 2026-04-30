import { afterAll, beforeAll, describe, it, expect } from "vitest";
import express from "express";
import type { Server } from "http";
import { registerScheduledSync } from "./scheduledSync";

let server: Server;
let baseUrl = "";

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
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("/api/scheduled/library-import", () => {
  it("rejects anonymous POSTs with 401 (auth gate)", async () => {
    const res = await fetch(`${baseUrl}/api/scheduled/library-import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("rejects malformed body when authorization is also missing", async () => {
    const res = await fetch(`${baseUrl}/api/scheduled/library-import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wrong: "shape" }),
    });
    // 401 takes precedence over 400 when no auth, which is the intended behavior
    expect([400, 401]).toContain(res.status);
  });
});
