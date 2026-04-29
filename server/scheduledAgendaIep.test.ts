import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

describe("Classroom-agendas scheduled endpoints", () => {
  it("GET /pending rejects anonymous callers", async () => {
    const res = await fetch(`${baseUrl}/api/scheduled/classroom-agendas/pending`);
    expect(res.status).toBe(401);
  });

  it("POST /result rejects anonymous callers", async () => {
    const res = await fetch(`${baseUrl}/api/scheduled/classroom-agendas/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });
    expect(res.status).toBe(401);
  });
});

describe("IEP refresh scheduled endpoints", () => {
  it("GET /trigger rejects anonymous callers", async () => {
    const res = await fetch(`${baseUrl}/api/scheduled/iep-refresh/trigger`);
    expect(res.status).toBe(401);
  });

  it("POST /result rejects anonymous callers", async () => {
    const res = await fetch(`${baseUrl}/api/scheduled/iep-refresh/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "drive", extractedGoals: [] }),
    });
    expect(res.status).toBe(401);
  });
});
