/**
 * Push 80 (2026-05-13) — Adventure-block printable doc on the agenda PDF.
 *
 * Locks the structural invariants Mom relies on at print time:
 *   1. buildAdventureBlock emits a safety chip as the FIRST instruction.
 *   2. The PDF renderer pulls that safety chip out into its own "Safety:"
 *      callout (so it doesn't blend into the numbered steps).
 *   3. The summary page surfaces the outdoor/indoor hint as a sub-line
 *      under the adventure chip.
 *   4. The supplies list always renders on the addendum page when present.
 *   5. Indoor recipes never claim "Outside OK"; the safety chip honors
 *      `outdoorOk: false` overrides.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildAdventureBlock } from "./_lib/blockGenerators";

const PDF_SRC = readFileSync(
  join(process.cwd(), "server/_lib/agendaPdf.ts"),
  "utf-8",
);

describe("Push 80 — Adventure printable doc on agenda PDF", () => {
  it("buildAdventureBlock puts the safety chip as the first instruction", () => {
    const out = buildAdventureBlock({ theme: "nature-scavenger" });
    expect(out.kind).toBe("adventure");
    expect(out.instructions.length).toBeGreaterThan(1);
    const first = out.instructions[0];
    expect(first).toMatch(/^(🌳|🏠|⚠️)/);
  });

  it("emits supply list on adventure payload", () => {
    const out = buildAdventureBlock({ theme: "nature-scavenger" });
    expect(out.operable.supplyList).toBeDefined();
    expect(out.operable.supplyList!.length).toBeGreaterThan(0);
  });

  it("outdoor recipe with outdoorOk:false flips to indoor-only warning", () => {
    const out = buildAdventureBlock({ theme: "bird-watching", outdoorOk: false });
    expect(out.instructions[0]).toMatch(/⚠️ Indoor-only/);
  });

  it("outdoor recipe with outdoorOk:true keeps outside-allowed chip", () => {
    const out = buildAdventureBlock({ theme: "bird-watching", outdoorOk: true });
    expect(out.instructions[0]).toMatch(/🌳 Outside OK/);
  });

  it("indoor recipe always renders the indoor chip", () => {
    const out = buildAdventureBlock({ theme: "art-from-trash" });
    expect(out.instructions[0]).toMatch(/🏠 Indoor activity/);
  });

  it("PDF renderer pulls the safety chip into its own Safety callout for adventure blocks", () => {
    expect(PDF_SRC).toMatch(/G\.kind === "adventure".*Safety:/s);
  });

  it("PDF renderer keeps the supplies section on adventure addendum pages", () => {
    // v3.28 (2026-06-01): the section heading was renamed from "Supplies"
    // to "What You Need" to match the kid-readable copy in other sections.
    expect(PDF_SRC).toMatch(/G\.operable\.supplyList.*What You Need/s);
  });

  it("PDF renderer surfaces outdoor/indoor hint via instructions[0] for adventure blocks", () => {
    // v3.28 (2026-06-01): the summary-line hint is now pulled directly from
    // instructions[0] (the safety chip emoji line). The `kind === "adventure"`
    // branching happens via the local alias `G = b.generated`, so the regex
    // is updated to match the current variable form.
    expect(PDF_SRC).toMatch(/G\.kind === "adventure".*G\.instructions\[0\]/s);
  });

  it("adventure printable line contains the duration + supplies preview", () => {
    const out = buildAdventureBlock({ theme: "nature-scavenger", durationMin: 25 });
    expect(out.printable).toMatch(/🌟/);
    expect(out.printable).toMatch(/25 min/);
    expect(out.printable).toMatch(/supplies:/);
  });

  it("duration is clamped at >= 10 min so the chip never claims a 0-min adventure", () => {
    const out = buildAdventureBlock({ theme: "nature-scavenger", durationMin: 0 });
    expect(out.printable).toMatch(/10 min/);
  });
});
