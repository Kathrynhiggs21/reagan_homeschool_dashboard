import { describe, it, expect } from "vitest";
import {
  buildWeeklyAdultDigest,
  __FOR_TEST__,
  type DigestInput,
  type AdultOptIn,
} from "./_lib/weeklyAdultDigest";

const NOW = "2026-05-10T20:00:00Z";

function baseInput(over: Partial<DigestInput> = {}): DigestInput {
  return {
    appUsage: [
      { appKey: "khan", appName: "Khan Academy Kids", minutes: 45, isoDate: "2026-05-04" },
      { appKey: "khan", appName: "Khan Academy Kids", minutes: 30, isoDate: "2026-05-06" },
      { appKey: "ixl", appName: "IXL", minutes: 60, isoDate: "2026-05-07" },
    ],
    moods: [
      { isoDate: "2026-05-04", label: "okay" },
      { isoDate: "2026-05-06", label: "joyful" },
      { isoDate: "2026-05-08", label: "bright" },
    ],
    booksFinished: [
      { title: "Frog and Toad", isoDate: "2026-05-05" },
      { title: "Ada Twist", isoDate: "2026-05-09" },
    ],
    vault: null,
    nowIso: NOW,
    adults: [
      { role: "mom", email: "spear.cpt@gmail.com", optedIn: true },
      { role: "grandma", email: "marcy.spear@gmail.com", optedIn: true },
    ],
    ...over,
  };
}

describe("Push 196 — weeklyAdultDigest", () => {
  it("week window is the last 7 days from nowIso", () => {
    const r = buildWeeklyAdultDigest(baseInput());
    expect(r.weekEndIso).toBe(new Date(NOW).toISOString());
    expect(new Date(r.weekStartIso).getTime()).toBe(
      new Date(NOW).getTime() - 7 * 24 * 60 * 60 * 1000,
    );
  });

  it("emits one paragraph per opted-in adult, in input order", () => {
    const r = buildWeeklyAdultDigest(baseInput());
    expect(r.paragraphs).toHaveLength(2);
    expect(r.paragraphs[0].role).toBe("mom");
    expect(r.paragraphs[1].role).toBe("grandma");
  });

  it("skips adults who didn't opt in", () => {
    const r = buildWeeklyAdultDigest(
      baseInput({
        adults: [
          { role: "mom", email: "spear.cpt@gmail.com", optedIn: true },
          { role: "grandma", email: "marcy.spear@gmail.com", optedIn: false },
        ],
      }),
    );
    expect(r.paragraphs.map((p) => p.role)).toEqual(["mom"]);
    expect(r.skippedAdults).toEqual([
      { role: "grandma", email: "marcy.spear@gmail.com", reason: "not opted in" },
    ]);
  });

  it("most-used app sums minutes across the week", () => {
    const r = buildWeeklyAdultDigest(baseInput());
    expect(r.paragraphs[0].highlights[0]).toContain("Khan Academy Kids");
    expect(r.paragraphs[0].highlights[0]).toContain("75 min");
  });

  it("ties on minutes break alphabetically by app name", () => {
    const r = buildWeeklyAdultDigest(
      baseInput({
        appUsage: [
          { appKey: "ixl", appName: "IXL", minutes: 60, isoDate: "2026-05-07" },
          { appKey: "khan", appName: "Khan Academy Kids", minutes: 60, isoDate: "2026-05-04" },
        ],
      }),
    );
    expect(r.paragraphs[0].highlights[0]).toContain("IXL");
  });

  it("brightest mood day picks joyful over bright over okay over rough", () => {
    const r = buildWeeklyAdultDigest(baseInput());
    expect(r.paragraphs[0].highlights[1]).toContain("joyful");
    expect(r.paragraphs[0].highlights[1]).toContain("Wed May 6");
  });

  it("ties on mood rank break by earliest date", () => {
    const r = buildWeeklyAdultDigest(
      baseInput({
        moods: [
          { isoDate: "2026-05-09", label: "joyful" },
          { isoDate: "2026-05-05", label: "joyful" },
        ],
      }),
    );
    expect(r.paragraphs[0].highlights[1]).toContain("Tue May 5");
  });

  it("books-finished count is correct + handles singular/plural", () => {
    const two = buildWeeklyAdultDigest(baseInput());
    expect(two.paragraphs[0].highlights[2]).toBe("Finished 2 books.");
    const one = buildWeeklyAdultDigest(
      baseInput({ booksFinished: [{ title: "Frog and Toad", isoDate: "2026-05-05" }] }),
    );
    expect(one.paragraphs[0].highlights[2]).toBe("Finished 1 book.");
  });

  it("filters out events outside the 7-day window", () => {
    const r = buildWeeklyAdultDigest(
      baseInput({
        booksFinished: [
          { title: "Old Book", isoDate: "2026-04-01" },
          { title: "Recent Book", isoDate: "2026-05-09" },
        ],
      }),
    );
    expect(r.paragraphs[0].highlights[2]).toBe("Finished 1 book.");
  });

  it("empty week ⇒ cheerful 'just checking in' headline + soft highlights", () => {
    const r = buildWeeklyAdultDigest(
      baseInput({ appUsage: [], moods: [], booksFinished: [] }),
    );
    expect(r.paragraphs[0].headline).toContain("quiet week");
    expect(r.paragraphs[0].headline).toContain("checking in");
    expect(r.paragraphs[0].highlights[0]).toContain("No app time");
    expect(r.paragraphs[0].highlights[1]).toContain("No mood notes");
    expect(r.paragraphs[0].highlights[2]).toContain("reading time still counts");
  });

  it("non-empty week ⇒ 'strong week' headline addressed to the right adult", () => {
    const r = buildWeeklyAdultDigest(baseInput());
    expect(r.paragraphs[0].headline).toBe("Reagan had a strong week, Mom.");
    expect(r.paragraphs[1].headline).toBe("Reagan had a strong week, Grandma.");
  });

  it("vault ask omitted when no rotations are due", () => {
    const r = buildWeeklyAdultDigest(baseInput({ vault: null }));
    expect(r.paragraphs[0].gentleAsk).toBeNull();
  });

  it("vault ask included + uses overdue wording when overdueCount > 0", () => {
    const r = buildWeeklyAdultDigest(
      baseInput({
        vault: { overdueCount: 2, dueSoonCount: 1, isoTimestamp: NOW },
      }),
    );
    expect(r.paragraphs[0].gentleAsk).toContain("2 logins are past rotation");
    expect(r.paragraphs[0].gentleAsk).toContain("no rush");
  });

  it("vault ask uses dueSoon wording when only dueSoonCount > 0", () => {
    const r = buildWeeklyAdultDigest(
      baseInput({
        vault: { overdueCount: 0, dueSoonCount: 1, isoTimestamp: NOW },
      }),
    );
    expect(r.paragraphs[0].gentleAsk).toContain("1 login is due for a fresh password soon");
  });

  it("notifyPayload uses category=weekly_digest + has friendly title", () => {
    const r = buildWeeklyAdultDigest(baseInput());
    expect(r.paragraphs[0].notifyPayload.category).toBe("weekly_digest");
    expect(r.paragraphs[0].notifyPayload.title).toContain("Reagan's week");
    expect(r.paragraphs[0].notifyPayload.content).toContain("strong week");
    expect(r.paragraphs[0].notifyPayload.content).toContain("• Spent the most time");
  });

  it("notifyPayload includes the gentleAsk line only when present", () => {
    const without = buildWeeklyAdultDigest(baseInput()).paragraphs[0].notifyPayload.content;
    expect(without).not.toContain("no rush");

    const withAsk = buildWeeklyAdultDigest(
      baseInput({ vault: { overdueCount: 1, dueSoonCount: 0, isoTimestamp: NOW } }),
    ).paragraphs[0].notifyPayload.content;
    expect(withAsk).toContain("no rush");
  });

  it("MOOD_RANK is the canonical 1..4 ordering", () => {
    expect(__FOR_TEST__.MOOD_RANK).toEqual({ rough: 1, okay: 2, bright: 3, joyful: 4 });
  });

  it("formatDate returns 'Dow Mon DD' for YYYY-MM-DD input", () => {
    expect(__FOR_TEST__.formatDate("2026-05-06")).toBe("Wed May 6");
  });

  it("inWindow respects bounds", () => {
    const start = Date.parse("2026-05-01T00:00:00Z");
    const end = Date.parse("2026-05-08T00:00:00Z");
    expect(__FOR_TEST__.inWindow("2026-05-04", start, end)).toBe(true);
    expect(__FOR_TEST__.inWindow("2026-04-30", start, end)).toBe(false);
    expect(__FOR_TEST__.inWindow("2026-05-09", start, end)).toBe(false);
    expect(__FOR_TEST__.inWindow("not-a-date", start, end)).toBe(false);
  });

  it("deterministic — same input ⇒ identical output", () => {
    const a = buildWeeklyAdultDigest(baseInput());
    const b = buildWeeklyAdultDigest(baseInput());
    expect(a).toEqual(b);
  });

  it("zero adults ⇒ zero paragraphs, no crash", () => {
    const r = buildWeeklyAdultDigest(baseInput({ adults: [] as AdultOptIn[] }));
    expect(r.paragraphs).toEqual([]);
    expect(r.skippedAdults).toEqual([]);
  });
});
