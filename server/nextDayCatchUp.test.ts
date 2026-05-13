import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const HELPER = readFileSync(join(ROOT, "server/_lib/nextDayCatchUp.ts"), "utf-8");
const ROUTERS = readFileSync(join(ROOT, "server/routers.ts"), "utf-8");
const CARD = readFileSync(
  join(ROOT, "client/src/components/CatchUpNextDayCard.tsx"),
  "utf-8",
);
const SETTINGS_CARD = readFileSync(
  join(ROOT, "client/src/components/CatchUpQueueSettingsCard.tsx"),
  "utf-8",
);
const TODAY = readFileSync(join(ROOT, "client/src/pages/Today.tsx"), "utf-8");
const SETTINGS = readFileSync(join(ROOT, "client/src/pages/Settings.tsx"), "utf-8");

describe("Push 73 — next-day catch-up queue surfaced on Today", () => {
  it("server helper reads cap from catchUp.maxQueueSize and clamps 0..10", () => {
    expect(HELPER).toContain('"catchUp.maxQueueSize"');
    expect(HELPER).toContain("Math.max(0, Math.min(n, 10))");
  });

  it("server helper drops blocks with status === 'complete'", () => {
    expect(HELPER).toMatch(/status === "complete"/);
  });

  it("server helper feeds catchUpQueueFor with yesterday's missed topics", () => {
    expect(HELPER).toContain("catchUpQueueFor");
    expect(HELPER).toContain("missedOn: yesterday");
  });

  it("server helper excludes already-done-today topics", () => {
    expect(HELPER).toContain("alreadyDoneTodayKeys");
  });

  it("tRPC procedure curriculum.nextDayQueue is registered", () => {
    expect(ROUTERS).toMatch(/nextDayQueue:\s*protectedProcedure\.query/);
    expect(ROUTERS).toContain("computeNextDayCatchUpQueue");
  });

  it("Today card reads the procedure and self-hides on empty", () => {
    expect(CARD).toContain("trpc.curriculum.nextDayQueue.useQuery");
    expect(CARD).toContain("data.items.length === 0");
    expect(CARD).toContain('return null');
  });

  it("Today card is mounted on the Today page after KidHeaderStrips", () => {
    expect(TODAY).toContain("import CatchUpNextDayCard");
    expect(TODAY).toContain("<CatchUpNextDayCard />");
    const idxKid = TODAY.indexOf("<KidHeaderStrips />");
    const idxCard = TODAY.indexOf("<CatchUpNextDayCard />");
    expect(idxKid).toBeGreaterThan(-1);
    expect(idxCard).toBeGreaterThan(idxKid);
  });

  it("Settings exposes the Mom-toggle 0..10 slider", () => {
    expect(SETTINGS_CARD).toContain('"catchUp.maxQueueSize"');
    expect(SETTINGS_CARD).toContain("min={0}");
    expect(SETTINGS_CARD).toContain("max={10}");
    expect(SETTINGS).toContain("import CatchUpQueueSettingsCard");
    expect(SETTINGS).toContain("<CatchUpQueueSettingsCard />");
  });

  it("Settings card invalidates curriculum.nextDayQueue on write so the Today card refreshes", () => {
    expect(SETTINGS_CARD).toContain("utils.curriculum.nextDayQueue.invalidate");
  });

  it("subject label map covers the 6 canonical subjects", () => {
    for (const slug of ["math", "ela", "science", "social", "specials", "other"]) {
      expect(CARD).toContain(`${slug}:`);
    }
  });
});
