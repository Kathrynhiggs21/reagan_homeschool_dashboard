/**
 * Push 92 (2026-05-13) — Drive sync path helpers contract.
 *
 * Locks the single source of truth for Drive filenames + folder
 * subpaths. Catches the kind of bug Mom hit before — "month" buckets
 * drifting, topics not getting sanitized, recap replies losing the
 * sender name.
 */
import { describe, it, expect } from "vitest";
import {
  monthBucket,
  safeNameSegment,
  offPlanTopicFile,
  recapReplyFile,
  dayLogFile,
  agendaPdfFile,
  describeOffPlanSync,
  describeDayLogSync,
  describeRecapReplySync,
  describeAgendaPdfSync,
  isValidDateIso,
} from "./_lib/driveSyncPaths";

describe("Push 92 — driveSyncPaths", () => {
  it("monthBucket returns YYYY-MM", () => {
    expect(monthBucket("2026-05-13")).toBe("2026-05");
    expect(monthBucket("2026-01-01")).toBe("2026-01");
    expect(monthBucket("2025-12-31")).toBe("2025-12");
  });

  it("monthBucket throws on bad input", () => {
    expect(() => monthBucket("2026-5-13")).toThrow();
    expect(() => monthBucket("")).toThrow();
    expect(() => monthBucket("nope")).toThrow();
  });

  it("safeNameSegment collapses, trims, caps length", () => {
    expect(safeNameSegment("Hello World")).toBe("Hello_World");
    expect(safeNameSegment("Tuck Everlasting (ch 3)")).toBe("Tuck_Everlasting_ch_3");
    expect(safeNameSegment("____trim____me____")).toBe("trim_me");
    expect(safeNameSegment("a".repeat(200)).length).toBe(80);
    expect(safeNameSegment(null)).toBe("untitled");
    expect(safeNameSegment("")).toBe("untitled");
    expect(safeNameSegment("!!!")).toBe("untitled");
  });

  it("offPlanTopicFile uses '{date} - {subject} - {topic}.md'", () => {
    const name = offPlanTopicFile("2026-05-13", "science", "Water Cycle");
    expect(name).toBe("2026-05-13 - science - Water_Cycle.md");
  });

  it("recapReplyFile uses '{date} - {sender} - Recap.md'", () => {
    const name = recapReplyFile("2026-05-13", "Grandma Marcy");
    expect(name).toBe("2026-05-13 - Grandma_Marcy - Recap.md");
  });

  it("dayLogFile uses '{date} - Day Log.md'", () => {
    expect(dayLogFile("2026-05-13")).toBe("2026-05-13 - Day Log.md");
  });

  it("agendaPdfFile uses '{date} - Agenda.pdf'", () => {
    expect(agendaPdfFile("2026-05-13")).toBe("2026-05-13 - Agenda.pdf");
  });

  it("describeOffPlanSync packs targetFolder + subpath + filename + mime", () => {
    const d = describeOffPlanSync("2026-05-13", "ela", "Vocabulary");
    expect(d).toEqual({
      targetFolder: "topics_covered",
      targetSubpath: "2026-05",
      fileName: "2026-05-13 - ela - Vocabulary.md",
      mimeType: "text/markdown",
    });
  });

  it("describeDayLogSync uses day_log + .md mime", () => {
    const d = describeDayLogSync("2026-05-13");
    expect(d.targetFolder).toBe("day_log");
    expect(d.targetSubpath).toBe("2026-05");
    expect(d.mimeType).toBe("text/markdown");
  });

  it("describeRecapReplySync uses recap_reply target", () => {
    const d = describeRecapReplySync("2026-05-13", "marcy.spear@gmail.com");
    expect(d.targetFolder).toBe("recap_reply");
    expect(d.fileName).toContain("marcy_spear_gmail_com");
  });

  it("describeAgendaPdfSync uses agenda_pdf + pdf mime", () => {
    const d = describeAgendaPdfSync("2026-05-13");
    expect(d.targetFolder).toBe("agenda_pdf");
    expect(d.mimeType).toBe("application/pdf");
  });

  it("isValidDateIso accepts canonical, rejects loose", () => {
    expect(isValidDateIso("2026-05-13")).toBe(true);
    expect(isValidDateIso("2026-5-13")).toBe(false);
    expect(isValidDateIso("2026/05/13")).toBe(false);
  });

  it("file builders throw on bad date", () => {
    expect(() => offPlanTopicFile("nope", "s", "t")).toThrow();
    expect(() => recapReplyFile("nope", "x")).toThrow();
    expect(() => dayLogFile("nope")).toThrow();
    expect(() => agendaPdfFile("nope")).toThrow();
  });
});
