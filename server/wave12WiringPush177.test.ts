import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTERS = fs.readFileSync(
  path.join(__dirname, "routers.ts"),
  "utf8",
);

describe("Push 177 wiring — exitTicketBuild + multiDayMoodTrend", () => {
  it("registers exitTicketBuild as a publicProcedure under today router", () => {
    expect(ROUTERS).toMatch(/exitTicketBuild:\s*publicProcedure/);
    expect(ROUTERS).toMatch(/buildExitTicket/);
  });

  it("registers multiDayMoodTrend as a familyAdminProcedure", () => {
    expect(ROUTERS).toMatch(/multiDayMoodTrend:\s*familyAdminProcedure/);
    expect(ROUTERS).toMatch(/computeMultiDayMoodTrend/);
  });

  it("uses dynamic import to keep cold-start lean", () => {
    expect(ROUTERS).toMatch(
      /await import\(\s*"\.\/_lib\/exitTicketBuilder"\s*\)/,
    );
    expect(ROUTERS).toMatch(
      /await import\([\s\S]{0,40}"\.\/_lib\/multiDayMoodTrend"[\s\S]{0,40}\)/,
    );
  });

  it("validates dateISO / todayISO with strict YYYY-MM-DD pattern", () => {
    const window = ROUTERS.split("multiDayMoodTrend:")[1] ?? "";
    expect(window.slice(0, 800)).toMatch(/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
  });
});
