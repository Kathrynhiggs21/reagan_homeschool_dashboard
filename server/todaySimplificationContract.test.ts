/**
 * todaySimplificationContract.test.ts — v2.87 (2026-05-21)
 *
 * Mom asked for a major homepage simplification. The 14 cards that used to
 * stack between the header and the schedule are now grouped into TWO
 * collapsible <details> drawers (kid + adult). This contract test locks
 * that structure so a future PR can't quietly re-stack everything.
 *
 * Source-level test (no DOM rendering needed) — looks at Today.tsx text.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const TODAY_TSX = path.join(
  __dirname,
  "..",
  "client",
  "src",
  "pages",
  "Today.tsx",
);

describe("/today — major simplification contract (v2.87)", () => {
  const src = fs.readFileSync(TODAY_TSX, "utf8");

  it.skip("[deferred] renders the kid 'Today extras' drawer with a data-testid", () => {
    // v3.28 (2026-06-01): the kid drawer collapse was deferred. The adult
    // drawer ships; the kid extras remain inline above the schedule until
    // Mom decides whether the kid view also needs a collapse.
    expect(src).toContain('data-testid="today-extras-kid"');
  });

  it("renders the adult 'For Mom & Grandma' drawer behind the unlock gate", () => {
    expect(src).toContain('data-testid="today-extras-adult"');
    // The drawer must be wrapped in `unlocked && (...)` so kids never see it.
    expect(src).toMatch(/\{unlocked && \(\s*\n?\s*<details[^>]*today-extras-adult/);
  });

  it.skip("[deferred] groups the formerly stacked kid cards INSIDE the kid drawer", () => {
    // Pull the kid drawer's body (between data-testid="today-extras-kid" and
    // its closing </details>) and assert each formerly stacked card is here.
    const start = src.indexOf('data-testid="today-extras-kid"');
    const end = src.indexOf("</details>", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const drawer = src.slice(start, end);
    // These were the kid-facing strips that used to be stacked above the schedule.
    expect(drawer).toMatch(/<KiwiIntroStrip\s*\/?>/);
    expect(drawer).toMatch(/<SummerModeBadge\s*\/?>/);
    expect(drawer).toMatch(/<KidHeaderStrips\s*\/?>/);
    expect(drawer).toMatch(/<MoodTimelineStrip\s*\/?>/);
    expect(drawer).toMatch(/<CatchUpNextDayCard\s*\/?>/);
    expect(drawer).toMatch(/<TomorrowChoiceCard\s*\/?>/);
    expect(drawer).toMatch(/<PlacementInviteCard\s*\/?>/);
    expect(drawer).toMatch(/<TodayClassroomCard\s*\/?>/);
    expect(drawer).toMatch(/<ConfidencePrinciplesStrip\s*\/?>/);
    expect(drawer).toMatch(/<TodayCoveredRecapCard\s*\/?>/);
  });

  it("groups the adult-only cards INSIDE the adult drawer", () => {
    const start = src.indexOf('data-testid="today-extras-adult"');
    const end = src.indexOf("</details>", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const drawer = src.slice(start, end);
    expect(drawer).toMatch(/<OffPlanCaptureCard\s*\/?>/);
    expect(drawer).toMatch(/<TodayClassroomGradedCard\s*\/?>/);
    expect(drawer).toMatch(/<TodayMomVoiceMemoCard\s*\/?>/);
    expect(drawer).toMatch(/<TodayForwardPlanCard\s*\/?>/);
    expect(drawer).toMatch(/<ActualVsPlannedStrip\s*\/?>/);
    expect(drawer).toMatch(/<TodayAdultQuickEntryCard\s*\/?>/);
  });

  it("does NOT re-stack the adult-only cards in the main scroll (outside the adult drawer)", () => {
    // v3.28 (2026-06-01): only the adult drawer is collapsed. The contract
    // we still enforce is: NO adult-only card may be mounted before the
    // adult drawer's testid (which would leak adult content to the kid view).
    const drawerStart = src.indexOf('data-testid="today-extras-adult"');
    expect(drawerStart).toBeGreaterThan(-1);
    const above = src.slice(0, drawerStart);
    const adultTargets = [
      "<OffPlanCaptureCard",
      "<TodayClassroomGradedCard",
      "<TodayMomVoiceMemoCard",
      "<TodayForwardPlanCard",
      "<TodayAdultQuickEntryCard",
    ];
    for (const t of adultTargets) {
      expect(above, `${t} must not appear before the adult drawer`).not.toContain(t);
    }
  });

  it("retains the print button on the homepage above the schedule", () => {
    // v2.87 (2026-05-21) — Mom rewired Print to call the full Daily Agenda
    // PDF instead of window.print(). The button now lives in a dedicated
    // <PrintAgendaButton/> component (which carries the testid). The
    // contract here is just that the button is mounted in the header.
    expect(src).toMatch(
      /import\s+PrintAgendaButton\s+from\s+["']@\/components\/PrintAgendaButton["']/,
    );
    expect(src).toMatch(/<PrintAgendaButton\s+forDate=\{todayDate\}\s*\/>/);
  });

  it("retains the Tour, Make-a-request, and Ask-Kiwi buttons in the header", () => {
    expect(src).toMatch(/Ask \{companionName\}|Ask Kiwi/);
    expect(src).toMatch(/<MakeRequestButton\s*\/?>/);
    expect(src).toContain("Tour");
  });
});
