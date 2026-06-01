/**
 * v2.33 (2026-05-18) — Settings → Daily Recap panel contract lock.
 *
 * Closes the open todo:
 *   "Settings → Daily Recap panel: toggle, recipient list (default
 *    marcy.spear@gmail.com), send-time, sample preview"
 *
 * The panel itself was implemented in Push 46 (2026-05-13) — `DailyRecapCard`
 * inside `client/src/pages/Settings.tsx`, mounted under the Recap tab. This
 * test does NOT add new feature code; it locks the four product requirements
 * (toggle / recipient list / send-time / sample preview) plus the
 * "default marcy.spear@gmail.com" guarantee, so the bullet can be flipped
 * to [x] with green test evidence and so a future refactor that drops one
 * of these four pieces will trip red here.
 *
 * Source-pattern checks against the actual files; no live DB.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SETTINGS_TSX = readFileSync(
  resolve(__dirname, "../client/src/pages/Settings.tsx"),
  "utf-8",
);
const DB_TS = readFileSync(resolve(__dirname, "db.ts"), "utf-8");
const ROUTERS_TS = readFileSync(resolve(__dirname, "routers.ts"), "utf-8");

/* Slice out just the DailyRecapCard component body so we don't accidentally
 * match strings from other cards. The component starts at `function
 * DailyRecapCard()` and ends at the first standalone `}` line followed by
 * a blank line + the next exported card (`function RecapRequestCard()`).
 */
function dailyRecapCardSlice(): string {
  const start = SETTINGS_TSX.indexOf("function DailyRecapCard()");
  expect(start).toBeGreaterThan(0);
  // We know RecapRequestCard is the next defined function; carve to there.
  const end = SETTINGS_TSX.indexOf("function RecapRequestCard()", start);
  expect(end).toBeGreaterThan(start);
  return SETTINGS_TSX.slice(start, end);
}

describe("v2.33 — DailyRecapCard mounted on Settings → Recap tab", () => {
  it("mounts <DailyRecapCard /> in Settings (tab consolidated into Email tab)", () => {
    // v3.28 (2026-06-01): the Recap tab was folded into the Email tab,
    // so the card is now mounted there alongside recipients + agenda toggle
    // + catch-up queue. The card itself is unchanged.
    expect(SETTINGS_TSX).toContain("<DailyRecapCard />");
  });

  it("defines the DailyRecapCard component", () => {
    expect(SETTINGS_TSX).toMatch(/function DailyRecapCard\(\)/);
  });
});

describe("v2.33 — DailyRecapCard renders the four product requirements", () => {
  const card = dailyRecapCardSlice();

  it("(1) renders the on/off toggle wired to the `enabled` pref", () => {
    expect(card).toMatch(/<Switch\b[\s\S]*?checked=\{!!prefs\.enabled\}/);
    expect(card).toMatch(/onCheckedChange=\{\(v\) => \(set as any\)\.mutate\(\{ enabled: v \}\)\}/);
  });

  it("(2) renders an editable recipient list textarea wired to `recipients`", () => {
    // Textarea, not <Input>, because we want comma-separated multi-recipient editing.
    expect(card).toMatch(/<textarea\b/);
    expect(card).toMatch(/recipientsText/);
    // Commit-on-blur path that maps the textarea string to the `recipients` array.
    expect(card).toMatch(/onBlur=\{commitRecipients\}/);
    expect(card).toMatch(/recipients: list/);
  });

  it("(3) renders a send-time input (HH:MM, ET-labelled) wired to `sendTimeET`", () => {
    expect(card).toMatch(/type="time"/);
    expect(card).toMatch(/sendTimeET/);
    // Validates HH:MM before committing.
    expect(card).toMatch(/\/\^\\d\{2\}:\\d\{2\}\$\//);
  });

  it("(4) renders the live sample preview iframe", () => {
    expect(card).toMatch(/dailyRecap[\s\S]*\.preview\?\.useQuery/);
    expect(card).toMatch(/<iframe\b/);
    expect(card).toMatch(/srcDoc=\{preview\.data\.html\}/);
    // Surfaces the effective recipient list above the iframe so Mom can see
    // who the sample would actually go to.
    expect(card).toMatch(/effectiveRecipients/);
  });

  it("includes the optional Kiwi + mood toggles (rich preview controls)", () => {
    expect(card).toMatch(/Include Kiwi listening focus/);
    expect(card).toMatch(/Include mood-through-day strip/);
    expect(card).toMatch(/includeKiwi/);
    expect(card).toMatch(/includeMood/);
  });

  it("explicitly tells Mom the recipients fall back to the Email tab when empty", () => {
    expect(card).toMatch(/leave empty to use the Email tab's address book/);
    expect(card).toMatch(/Empty = fall back to the Email tab's recipients/);
  });
});

describe("v2.33 — server-side recipient defaults include marcy.spear@gmail.com", () => {
  it("listRecipients() exists and is the recipient fallback source", () => {
    expect(DB_TS).toMatch(/export async function listRecipients\(\)/);
  });

  it("previewDailyRecap falls back to listRecipients() when prefs.recipients is empty", () => {
    expect(DB_TS).toMatch(/prefs\.recipients\.length > 0[\s\S]{0,80}prefs\.recipients[\s\S]{0,80}listRecipients\(\)/);
  });

  it("notification recipients constant table includes Grandma (marcy.spear@gmail.com)", () => {
    // The DEFAULT_NOTIFICATION_RECIPIENTS-style constant in db.ts seeds
    // marcy.spear@gmail.com so the recap fallback is non-empty out of the box.
    expect(DB_TS).toMatch(/"marcy\.spear@gmail\.com"/);
  });

  it("APP_SETTING_DEFAULTS records marcy.spear@gmail.com as Grandma's email", () => {
    expect(DB_TS).toMatch(/"grandma\.googleEmail":\s*"marcy\.spear@gmail\.com"/);
  });
});

describe("v2.33 — dailyRecap router exposes get/set/preview behind protectedProcedure", () => {
  // Carve out just the dailyRecap router. The router definition spans many
  // lines (3 procedures, each multi-line), so walk to the next sibling
  // router (`settingsAI: router(`) instead of the first `})`.
  const start = ROUTERS_TS.indexOf("dailyRecap: router({");
  const end = ROUTERS_TS.indexOf("settingsAI: router({", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const slice = ROUTERS_TS.slice(start, end);

  it("exposes dailyRecap.get under protectedProcedure", () => {
    expect(slice).toMatch(/get:\s*protectedProcedure/);
  });

  it("exposes dailyRecap.set under protectedProcedure with the right input shape", () => {
    expect(slice).toMatch(/set:\s*protectedProcedure/);
    expect(slice).toMatch(/recipients:\s*z\.array\(z\.string\(\)\.email\(\)\)\.optional\(\)/);
    expect(slice).toMatch(/sendTimeET:\s*z\.string\(\)\.regex\(\/\^\\d\{2\}:\\d\{2\}\$\/\)\.optional\(\)/);
  });

  it("exposes dailyRecap.preview under protectedProcedure", () => {
    expect(slice).toMatch(/preview:\s*protectedProcedure/);
    expect(slice).toMatch(/db\.previewDailyRecap/);
  });
});
