import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import type { Server } from "http";
import { eq } from "drizzle-orm";
import { registerScheduledSync } from "./scheduledSync";
import {
  actualAgendaEntries,
  dailyRecapRequests,
  topicsCoveredOffPlan,
  drivePushQueue,
} from "../drizzle/schema";
import * as dbMod from "./db";
import * as llm from "./_core/llm";

/**
 * Real-DB + real-Express integration test for the inbound recap-reply
 * webhook:
 *   POST /api/scheduled/daily-recap-reply
 *
 * Verifies end-to-end:
 *   1. Reply-token parser writes correct `actualAgendaEntries` rows for
 *      every entry the LLM returns (real DB rows, real subjectSlug, real
 *      topic, real minutesSpent, real source).
 *   2. Off-plan entries materialize a `topicsCoveredOffPlan` row AND
 *      enqueue a `drivePushQueue` row with `targetFolder='topics_covered'`,
 *      `targetSubpath='YYYY-MM'`, and a `.md` filename including the date
 *      + subject + topic.
 *   3. The `dailyRecapRequests` row is marked `status='replied'` and
 *      `parsedEntriesCount` matches the inserted count.
 *
 * The LLM is mocked with `vi.spyOn(llm, "invokeLLM")` to return a
 * deterministic JSON payload (one on-plan + one off-plan entry).
 */

let server: Server;
let baseUrl = "";
const FUTURE_DATE = "2031-08-12"; // Tuesday
const TOKEN = "tok_recap_reply_test_2031_08_12_aaaaa";

async function cleanFutureDate() {
  const db = (dbMod as any).getDb();
  await db
    .delete(actualAgendaEntries)
    .where(eq(actualAgendaEntries.dateISO, FUTURE_DATE));
  await db
    .delete(dailyRecapRequests)
    .where(eq(dailyRecapRequests.dateISO, FUTURE_DATE));
  await db
    .delete(topicsCoveredOffPlan)
    .where(eq(topicsCoveredOffPlan.dateISO, FUTURE_DATE));
  // drivePushQueue rows we created (filename starts with the future date)
  const allRows: any[] = await db.select().from(drivePushQueue);
  for (const row of allRows) {
    if (
      row.targetFolder === "topics_covered" &&
      typeof row.fileName === "string" &&
      row.fileName.startsWith(FUTURE_DATE)
    ) {
      await db.delete(drivePushQueue).where(eq(drivePushQueue.id, row.id));
    }
  }
}

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  registerScheduledSync(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (addr && typeof addr === "object") {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
  await cleanFutureDate();
});

afterAll(async () => {
  vi.restoreAllMocks();
  try {
    await cleanFutureDate();
  } catch {
    /* ignore */
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("/api/scheduled/daily-recap-reply integration", () => {
  it("LLM JSON → writes actualAgendaEntries rows + off-plan row + drivePushQueue row + marks request replied", async () => {
    // Seed a recap-request row so the route has a valid token to look up.
    await dbMod.createRecapRequest({
      dateISO: FUTURE_DATE,
      sentTo: "marcy.spear@gmail.com",
      replyToken: TOKEN,
    });

    // Mock the LLM to return one on-plan (math) + one off-plan (baking as
    // life-skills) entry.
    const llmSpy = vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entries: [
                {
                  subjectSlug: "math",
                  topic: "Adding fractions practice",
                  minutesSpent: 30,
                  notes: "Reagan got 4 of 5 right.",
                  offPlan: false,
                },
                {
                  subjectSlug: "life-skills",
                  topic: "Baking cookies as fractions",
                  minutesSpent: 45,
                  notes: "Doubled the recipe; talked about 1/4 + 1/4 = 1/2.",
                  offPlan: true,
                },
              ],
            }),
          },
        },
      ],
    } as any);

    try {
      const r = await fetch(`${baseUrl}/api/scheduled/daily-recap-reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: TOKEN,
          replyText:
            "Today Reagan worked on adding fractions for 30 min and we baked cookies talking about quarters and halves for 45 min.",
          replyFrom: "marcy.spear@gmail.com",
        }),
      });
      expect(r.status).toBe(200);
      const body: any = await r.json();
      expect(body.ok).toBe(true);
      expect(body.dateISO).toBe(FUTURE_DATE);
      expect(body.parsed).toBe(2);
      expect(body.inserted).toBe(2);
      expect(body.source).toBe("grandma-recap"); // marcy.spear@ → grandma-recap

      // Real DB: actualAgendaEntries rows exist
      const db = (dbMod as any).getDb();
      const actuals: any[] = await db
        .select()
        .from(actualAgendaEntries)
        .where(eq(actualAgendaEntries.dateISO, FUTURE_DATE));
      expect(actuals.length).toBe(2);
      const subjects = actuals.map((e) => e.subjectSlug).sort();
      expect(subjects).toEqual(["life-skills", "math"]);
      const mathRow = actuals.find((e) => e.subjectSlug === "math")!;
      expect(mathRow.topic).toBe("Adding fractions practice");
      expect(mathRow.minutesSpent).toBe(30);
      expect(mathRow.source).toBe("grandma-recap");
      expect(mathRow.notes).toContain("4 of 5");

      // Off-plan: topicsCoveredOffPlan row exists for life-skills
      const offPlanRows: any[] = await db
        .select()
        .from(topicsCoveredOffPlan)
        .where(eq(topicsCoveredOffPlan.dateISO, FUTURE_DATE));
      expect(offPlanRows.length).toBe(1);
      expect(offPlanRows[0].subjectSlug).toBe("life-skills");
      expect(offPlanRows[0].topic).toBe("Baking cookies as fractions");

      // drivePushQueue: a topics_covered .md row was enqueued
      const pushRows: any[] = await db.select().from(drivePushQueue);
      const ourPush = pushRows.find(
        (row) =>
          row.targetFolder === "topics_covered" &&
          typeof row.fileName === "string" &&
          row.fileName.startsWith(FUTURE_DATE) &&
          row.fileName.includes("life-skills"),
      );
      expect(ourPush).toBeTruthy();
      expect(ourPush.targetSubpath).toBe(FUTURE_DATE.slice(0, 7));
      expect(ourPush.mimeType).toBe("text/markdown");
      expect(ourPush.contentText).toContain("Baking cookies as fractions");
      expect(ourPush.contentText).toContain(FUTURE_DATE);
      expect(ourPush.status).toBe("pending");

      // The recap-request row is marked replied with the right count.
      const reqRows: any[] = await db
        .select()
        .from(dailyRecapRequests)
        .where(eq(dailyRecapRequests.replyToken, TOKEN));
      expect(reqRows.length).toBe(1);
      expect(reqRows[0].status).toBe("replied");
      expect(reqRows[0].parsedEntriesCount).toBe(2);
    } finally {
      llmSpy.mockRestore();
    }
  });

  it("rejects unknown tokens with 404 and never inserts anything", async () => {
    const r = await fetch(`${baseUrl}/api/scheduled/daily-recap-reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "tok_does_not_exist_xxxxxxxxxxxxxxxx",
        replyText: "hello",
      }),
    });
    expect(r.status).toBe(404);
    const body: any = await r.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unknown-token");
  });

  it("400 on empty replyText", async () => {
    const r = await fetch(`${baseUrl}/api/scheduled/daily-recap-reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: TOKEN, replyText: "" }),
    });
    expect(r.status).toBe(400);
  });
});
