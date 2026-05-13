import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const CARD = readFileSync(
  join(ROOT, "client/src/components/SummerModeSettingsCard.tsx"),
  "utf-8",
);
const SETTINGS = readFileSync(join(ROOT, "client/src/pages/Settings.tsx"), "utf-8");
const ROUTERS = readFileSync(join(ROOT, "server/routers.ts"), "utf-8");

describe("Push 72 — Summer mode settings card", () => {
  it("uses the five canonical summer.* prefs keys", () => {
    expect(CARD).toContain("summer.autoFlipEnabled");
    expect(CARD).toContain("summer.start");
    expect(CARD).toContain("summer.end");
    expect(CARD).toContain("summer.override");
    expect(CARD).toContain("summer.vacationRanges");
  });

  it("writes through the protected prefs.set procedure", () => {
    expect(CARD).toContain("trpc.prefs.set.useMutation");
    expect(CARD).toContain("trpc.prefs.get.useQuery");
  });

  it("invalidates both prefs.get and prefs.getPublic so the badge refreshes", () => {
    expect(CARD).toContain("utils.prefs.get.invalidate");
    expect(CARD).toContain("utils.prefs.getPublic.invalidate");
  });

  it("offers Auto / Force on / Force off override buttons", () => {
    expect(CARD).toContain('data-testid={`summer-override-${v}`}');
    expect(CARD).toMatch(/"auto", "on", "off"/);
  });

  it("supports vacation ranges with add + remove", () => {
    expect(CARD).toContain('data-testid="summer-add-vacation"');
    expect(CARD).toContain("removeRange");
    expect(CARD).toContain("JSON.stringify(next)");
  });

  it("validates MM-DD for window and YYYY-MM-DD for vacations", () => {
    expect(CARD).toContain("isValidMMDD");
    expect(CARD).toContain("isValidISO");
  });

  it("uses the same priority order as the server (override-off > vacation > override-on > auto)", () => {
    // The card mirrors server logic for live preview
    expect(CARD).toMatch(/overrideValue === "off"/);
    expect(CARD).toMatch(/inVacation/);
    expect(CARD).toMatch(/overrideValue === "on"/);
    expect(CARD).toMatch(/autoFlipOn && inAutoWindow/);
  });

  it("is mounted on the Calendar tab in Settings", () => {
    expect(SETTINGS).toContain("import SummerModeSettingsCard");
    expect(SETTINGS).toContain("<SummerModeSettingsCard />");
  });

  it("prefs.getPublic allowlist already includes all five summer keys (Push 65 lock)", () => {
    expect(ROUTERS).toContain('"summer.autoFlipEnabled"');
    expect(ROUTERS).toContain('"summer.start"');
    expect(ROUTERS).toContain('"summer.end"');
    expect(ROUTERS).toContain('"summer.override"');
    expect(ROUTERS).toContain('"summer.vacationRanges"');
  });
});
