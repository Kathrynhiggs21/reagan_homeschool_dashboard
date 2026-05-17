/**
 * Canonical 7-subject taxonomy lock (DONE 2026-05-17).
 *
 * Mom set the master subject list for Classroom + Drive + assignment records:
 *   1. Social Studies
 *   2. Science
 *   3. Reading and Language Arts (ELA)
 *   4. Math
 *   5. Health and PE       (catalog-only, isCorePlanning=false)
 *   6. Art and Music       (catalog-only, isCorePlanning=false)
 *   7. Other               (catalog-only, isCorePlanning=false)
 *
 * Catalog-only means: available for assignment categorization, but does NOT
 * drive the daily schedule and does NOT trigger "did you do everything?"
 * nudges. Only the 4 core planning subjects do.
 *
 * This test guards against:
 *   - Regression of the old 'specials' slug back into pickers
 *   - Re-ordering by accident (sortOrder is the canonical order)
 *   - Renaming ELA back to a short form
 *   - Forgetting the isCorePlanning flag on new optional subjects
 */
import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("canonical 7-subject taxonomy", () => {
  it("listSubjects returns the 7 canonical subjects in the right order with the right names", async () => {
    const all = await db.listSubjects();
    // Filter out the deprecated row(s) which we keep around purely for FK
    // history. They live with sortOrder >= 999 so they sort to the bottom
    // and are easy to filter out of pickers.
    const visible = (all as any[]).filter((s) => s.sortOrder < 999);

    const expected = [
      { sortOrder: 1, slug: "social",    name: "Social Studies",                       isCorePlanning: true  },
      { sortOrder: 2, slug: "science",   name: "Science",                              isCorePlanning: true  },
      { sortOrder: 3, slug: "ela",       name: "Reading and Language Arts (ELA)",      isCorePlanning: true  },
      { sortOrder: 4, slug: "math",      name: "Math",                                 isCorePlanning: true  },
      { sortOrder: 5, slug: "health-pe", name: "Health and PE",                        isCorePlanning: false },
      { sortOrder: 6, slug: "art-music", name: "Art and Music",                        isCorePlanning: false },
      { sortOrder: 7, slug: "other",     name: "Other",                                isCorePlanning: false },
    ];

    expect(visible.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      const want = expected[i];
      const got = visible[i];
      expect(got.sortOrder, `row ${i} sortOrder`).toBe(want.sortOrder);
      expect(got.slug, `row ${i} slug`).toBe(want.slug);
      expect(got.name, `row ${i} name`).toBe(want.name);
      // MySQL returns 0/1 for boolean columns through some drivers; allow both
      // truthy/falsey forms but assert the boolean meaning.
      expect(Boolean(got.isCorePlanning), `row ${i} isCorePlanning`).toBe(want.isCorePlanning);
    }
  });

  it("the 4 core planning subjects are exactly: social, science, ela, math", async () => {
    const all = await db.listSubjects();
    const core = (all as any[])
      .filter((s) => Boolean(s.isCorePlanning))
      .map((s) => s.slug)
      .sort();
    expect(core).toEqual(["ela", "math", "science", "social"]);
  });

  it("the 3 optional subjects are exactly: health-pe, art-music, other", async () => {
    const all = await db.listSubjects();
    const optional = (all as any[])
      .filter((s) => !Boolean(s.isCorePlanning) && s.sortOrder < 999)
      .map((s) => s.slug)
      .sort();
    expect(optional).toEqual(["art-music", "health-pe", "other"]);
  });

  it("the legacy 'specials' slug is NOT visible in the canonical taxonomy", async () => {
    const all = await db.listSubjects();
    const visibleSlugs = (all as any[])
      .filter((s) => s.sortOrder < 999)
      .map((s) => s.slug);
    expect(visibleSlugs).not.toContain("specials");
    expect(visibleSlugs).not.toContain("_deprecated_specials");
  });
});
