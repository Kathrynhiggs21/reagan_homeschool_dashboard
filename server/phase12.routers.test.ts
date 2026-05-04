/**
 * Phase 12 router-shape sanity test.
 *
 * Doesn't hit MySQL — just validates that:
 *   - studentRequests has create / listPending / listResolved / decide procedures
 *   - icalFeeds has list / eventsBetween / add / update / delete / refresh
 *   - input zod schemas accept reasonable values and reject obvious garbage
 *
 * This is the contract the kid-side Make-a-Request UI and the Schedule iCal
 * overlay both rely on; if these break, both UIs go dark.
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("Phase 12 — studentRequests router shape", () => {
  it("exposes the four expected procedures", () => {
    const sr = (appRouter as any)._def.procedures;
    expect(typeof sr["studentRequests.create"]).toBe("function");
    expect(typeof sr["studentRequests.listPending"]).toBe("function");
    expect(typeof sr["studentRequests.listResolved"]).toBe("function");
    expect(typeof sr["studentRequests.decide"]).toBe("function");
  });

  it("studentRequests.create input validates kind + body length", () => {
    const proc = (appRouter as any)._def.procedures["studentRequests.create"];
    const schema = proc._def.inputs?.[0] ?? proc._def.input;
    expect(schema).toBeTruthy();
    // good case
    expect(() => schema.parse({ kind: "snack", body: "Apples please" })).not.toThrow();
    // bad: empty body
    expect(() => schema.parse({ kind: "snack", body: "" })).toThrow();
    // bad: invalid kind
    expect(() => schema.parse({ kind: "rocketship", body: "anything" })).toThrow();
  });
});

describe("Phase 12 — icalFeeds router shape", () => {
  it("exposes the six expected procedures", () => {
    const sr = (appRouter as any)._def.procedures;
    for (const name of [
      "icalFeeds.list",
      "icalFeeds.eventsBetween",
      "icalFeeds.add",
      "icalFeeds.update",
      "icalFeeds.delete",
      "icalFeeds.refresh",
    ]) {
      expect(typeof sr[name]).toBe("function");
    }
  });

  it("icalFeeds.add validates url shape and color hex", () => {
    const proc = (appRouter as any)._def.procedures["icalFeeds.add"];
    const schema = proc._def.inputs?.[0] ?? proc._def.input;
    expect(() => schema.parse({ label: "Soccer", url: "https://x/cal.ics", color: "#0a66c2" })).not.toThrow();
    expect(() => schema.parse({ label: "", url: "https://x/cal.ics" })).toThrow(); // empty label
    expect(() => schema.parse({ label: "X", url: "not-a-url" })).toThrow();        // bad url
    expect(() => schema.parse({ label: "X", url: "https://x/cal.ics", color: "blue" })).toThrow(); // bad color
  });

  it("icalFeeds.eventsBetween enforces YYYY-MM-DD on both ends", () => {
    const proc = (appRouter as any)._def.procedures["icalFeeds.eventsBetween"];
    const schema = proc._def.inputs?.[0] ?? proc._def.input;
    expect(() => schema.parse({ startDate: "2026-05-04", endDate: "2026-05-04" })).not.toThrow();
    expect(() => schema.parse({ startDate: "2026-5-4",  endDate: "2026-05-04" })).toThrow();
    expect(() => schema.parse({ startDate: "yesterday", endDate: "today" })).toThrow();
  });
});
