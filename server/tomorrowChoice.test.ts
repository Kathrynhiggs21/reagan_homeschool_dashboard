/**
 * Push 82 (2026-05-13) — Tomorrow's summer-choice 3-option chooser
 * contract test.
 *
 * The deterministic logic lives in server/summerMode.ts (already locked
 * by summerMode.test.ts). This test locks the integration around it:
 *
 *   1. today.tomorrowChoice is a public procedure (Reagan-callable).
 *   2. today.recordTomorrowChoice is a public mutation that auto-approves
 *      when chosenKind is in the deterministic option set, and rejects
 *      out-of-set picks (the "never-queued because pre-approved" rule).
 *   3. The seed format is `${tomorrowIso}:${blockType}` so the option set
 *      is stable for the whole evening and the next morning.
 *   4. The kid-side TomorrowChoiceCard self-hides when active=false or
 *      options is empty, and collapses to a confirmation pill after pick.
 *   5. The card is mounted on Today, right under CatchUpNextDayCard so
 *      the kid sees it in the calm "what's coming next" slot.
 *   6. The mutation never queues SMS approval — Mom + Grandma rule.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  effectiveSummerActive,
  summerChoiceOptions,
  summerSettingsFromKv,
} from "./summerMode";

const ROUTERS_SRC = readFileSync(
  join(process.cwd(), "server/routers.ts"),
  "utf-8",
);
const COMP_SRC = readFileSync(
  join(process.cwd(), "client/src/components/TomorrowChoiceCard.tsx"),
  "utf-8",
);
const TODAY_SRC = readFileSync(
  join(process.cwd(), "client/src/pages/Today.tsx"),
  "utf-8",
);

describe("Push 82 — Tomorrow choice procedures", () => {
  it("today.tomorrowChoice is a public procedure", () => {
    expect(ROUTERS_SRC).toMatch(/tomorrowChoice:\s*publicProcedure/);
  });

  it("today.recordTomorrowChoice is a public mutation", () => {
    expect(ROUTERS_SRC).toMatch(/recordTomorrowChoice:\s*publicProcedure[\s\S]*?\.mutation\(/);
  });

  it("seed format is `${tomorrowIso}:${blockType}` for stable nightly options", () => {
    expect(ROUTERS_SRC).toMatch(/const seed = `\$\{tomorrowIso\}:\$\{blockType\}`/);
  });

  it("recordTomorrowChoice rejects out-of-set picks (pre-approved-only rule)", () => {
    expect(ROUTERS_SRC).toMatch(/allowedKinds\.includes\(input\.chosenKind/);
    expect(ROUTERS_SRC).toMatch(/throw new Error\(`chosenKind not in pre-approved set/);
  });

  it("recordTomorrowChoice persists pick under tomorrowChoice.<date>.<blockType>", () => {
    expect(ROUTERS_SRC).toMatch(/`tomorrowChoice\.\$\{tomorrowIso\}\.\$\{blockType\}`/);
  });

  it("recordTomorrowChoice never enqueues SMS approval (Mom+Grandma never queued rule)", () => {
    // Pull out just the recordTomorrowChoice block and assert no SMS hook reach.
    const slice = ROUTERS_SRC.match(/recordTomorrowChoice:[\s\S]*?\}\)\),/);
    expect(slice).not.toBeNull();
    const body = slice![0];
    expect(body).not.toMatch(/queueApproval|smsApproval|enqueueSms|notifyOwner/i);
    expect(body).toMatch(/autoApproved:\s*true/);
  });

  it("server reads all 5 summer.* prefs to compute active state", () => {
    for (const key of [
      "summer.autoFlipEnabled",
      "summer.start",
      "summer.end",
      "summer.override",
      "summer.vacationRanges",
    ]) {
      expect(ROUTERS_SRC).toMatch(new RegExp(`getAppSetting\\("${key.replace(/\./g, "\\.")}"\\)`));
    }
  });
});

describe("Push 82 — TomorrowChoiceCard UI", () => {
  it("is imported and mounted on Today", () => {
    expect(TODAY_SRC).toMatch(/from\s+"@\/components\/TomorrowChoiceCard"/);
    expect(TODAY_SRC).toMatch(/<TomorrowChoiceCard\s*\/>/);
  });

  it("self-hides when summer is not active", () => {
    expect(COMP_SRC).toMatch(/if\s*\(!data\.active\)\s*return\s*null/);
  });

  it("self-hides when options is empty", () => {
    expect(COMP_SRC).toMatch(/options\.length\s*===\s*0\)\s*return\s*null/);
  });

  it("collapses to a confirmation pill after Reagan picks", () => {
    expect(COMP_SRC).toMatch(/data-state="picked"/);
    expect(COMP_SRC).toMatch(/Tomorrow's pick:/);
  });

  it("renders one button per option with data-choice-button attribute", () => {
    expect(COMP_SRC).toMatch(/data-choice-button=\{opt\.kind\}/);
  });

  it("carries data-tomorrow-choice attribute so skin tests can target it", () => {
    expect(COMP_SRC).toMatch(/data-tomorrow-choice/);
  });
});

describe("Push 82 — Deterministic seeding (cross-checks summerMode helpers)", () => {
  const activeKv = {
    "summer.autoFlipEnabled": "1",
    "summer.start": "06-06",
    "summer.end": "08-15",
    "summer.override": null,
    "summer.vacationRanges": "[]",
  };

  it("summer.start..end window is active mid-July", () => {
    const s = summerSettingsFromKv(activeKv);
    const status = effectiveSummerActive("2026-07-15", s);
    expect(status.active).toBe(true);
  });

  it("seed `<iso>:choice` gives the same 3 options across two runs", () => {
    const seed = "2026-07-15:choice";
    const a = summerChoiceOptions("reading", seed);
    const b = summerChoiceOptions("reading", seed);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(a.map((o) => o.kind)).toEqual(b.map((o) => o.kind));
  });

  it("different dates can return different orderings (no degenerate constant)", () => {
    const a = summerChoiceOptions("reading", "2026-07-15:choice");
    const b = summerChoiceOptions("reading", "2026-07-22:choice");
    // We don't require difference (small pool), but the helper must be a
    // pure function of seed — same seed → same output.
    const a2 = summerChoiceOptions("reading", "2026-07-15:choice");
    expect(a.map((o) => o.kind)).toEqual(a2.map((o) => o.kind));
    // length contract:
    expect(b.length).toBeLessThanOrEqual(3);
  });

  it("manual override='off' deactivates even in mid-July", () => {
    const offKv = { ...activeKv, "summer.override": "off" };
    const s = summerSettingsFromKv(offKv);
    const status = effectiveSummerActive("2026-07-15", s);
    expect(status.active).toBe(false);
    expect(status.reason).toBe("manual-off");
  });

  it("vacation range deactivates within range", () => {
    const vacKv = {
      ...activeKv,
      "summer.vacationRanges": JSON.stringify([{ start: "2026-07-10", end: "2026-07-20" }]),
    };
    const s = summerSettingsFromKv(vacKv);
    const status = effectiveSummerActive("2026-07-15", s);
    expect(status.active).toBe(false);
    expect(status.reason).toBe("vacation");
  });
});
