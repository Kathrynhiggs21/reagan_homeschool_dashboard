/**
 * Push 131 (2026-05-13) — Printable daily-schedule bundle contract.
 */
import { describe, it, expect } from "vitest";
import {
  planPrintableDailyBundle,
  buildSubmitDeeplink,
  type PlannedBlockForPrintable,
} from "./_lib/printableDailyBundle";

const SUBMIT_BASE = "https://reaganschool.manus.space";

const SLAY_CHARGE: PlannedBlockForPrintable = {
  blockId: "blk_slay",
  startHHmm: "08:00",
  durationMin: 5,
  title: "Slay Charge ⚡",
  subject: null,
  type: "morning_vibe",
  worksheetPdfKey: null,
  answerKeyPdfKey: null,
  lessonPdfKey: null,
};

const MATH: PlannedBlockForPrintable = {
  blockId: "blk_math",
  startHHmm: "09:00",
  durationMin: 35,
  title: "Math — Fractions Practice",
  subject: "math",
  type: "lesson",
  worksheetPdfKey: "lib/math-fractions-ws.pdf",
  answerKeyPdfKey: "lib/math-fractions-ak.pdf",
  lessonPdfKey: "lib/math-fractions-lesson.pdf",
};

const READING: PlannedBlockForPrintable = {
  blockId: "blk_read",
  startHHmm: "10:30",
  durationMin: 25,
  title: "Reading — Tuck Everlasting pg 22",
  subject: "ela",
  type: "lesson",
  worksheetPdfKey: null,
  answerKeyPdfKey: null,
  lessonPdfKey: "lib/tuck-pg22-lesson.pdf",
};

describe("Push 131 — planPrintableDailyBundle", () => {
  it("excludes Slay Charge ⚡ (morning_vibe) from the printable bundle", () => {
    const out = planPrintableDailyBundle({
      dateIso: "2026-05-13",
      blocks: [SLAY_CHARGE, MATH, READING],
      tutorOfDayName: "Madison",
      audienceTier: "adult",
      submitBaseUrl: SUBMIT_BASE,
    });
    expect(out.kind).toBe("ready");
    if (out.kind === "ready") {
      const blockPageIds = out.sections
        .filter((s) => s.kind === "block-page")
        .map((s) => s.blockId);
      expect(blockPageIds).not.toContain("blk_slay");
    }
  });

  it("orders blocks by start time and prefixes with cover + schedule overview", () => {
    const out = planPrintableDailyBundle({
      dateIso: "2026-05-13",
      blocks: [READING, MATH], // intentionally out of order
      tutorOfDayName: "Madison",
      audienceTier: "adult",
      submitBaseUrl: SUBMIT_BASE,
    });
    if (out.kind === "ready") {
      const kinds = out.sections.map((s) => s.kind);
      expect(kinds[0]).toBe("cover");
      expect(kinds[1]).toBe("schedule-overview");
      const blockPages = out.sections.filter((s) => s.kind === "block-page");
      expect(blockPages[0]?.blockId).toBe("blk_math");
      expect(blockPages[1]?.blockId).toBe("blk_read");
    }
  });

  it("emits worksheet section + submit-photo deeplink when worksheetPdfKey present", () => {
    const out = planPrintableDailyBundle({
      dateIso: "2026-05-13",
      blocks: [MATH],
      tutorOfDayName: null,
      audienceTier: "adult",
      submitBaseUrl: SUBMIT_BASE,
    });
    if (out.kind === "ready") {
      const ws = out.sections.find((s) => s.kind === "worksheet");
      expect(ws?.blockId).toBe("blk_math");
      expect(ws?.submitDeeplink).toBe(
        `${SUBMIT_BASE}/api/scheduled/worksheet-photo-submit?blockId=blk_math&date=2026-05-13`,
      );
    }
  });

  it("emits answer-key section ONLY for adult audience", () => {
    const adult = planPrintableDailyBundle({
      dateIso: "2026-05-13",
      blocks: [MATH],
      tutorOfDayName: null,
      audienceTier: "adult",
      submitBaseUrl: SUBMIT_BASE,
    });
    const kid = planPrintableDailyBundle({
      dateIso: "2026-05-13",
      blocks: [MATH],
      tutorOfDayName: null,
      audienceTier: "kid",
      submitBaseUrl: SUBMIT_BASE,
    });
    if (adult.kind === "ready") {
      expect(adult.sections.some((s) => s.kind === "answer-key-adult")).toBe(true);
    }
    if (kid.kind === "ready") {
      expect(kid.sections.some((s) => s.kind === "answer-key-adult")).toBe(false);
    }
  });

  it("appends a submit-instructions tail section", () => {
    const out = planPrintableDailyBundle({
      dateIso: "2026-05-13",
      blocks: [MATH],
      tutorOfDayName: null,
      audienceTier: "adult",
      submitBaseUrl: SUBMIT_BASE,
    });
    if (out.kind === "ready") {
      expect(out.sections[out.sections.length - 1]?.kind).toBe(
        "submit-instructions",
      );
    }
  });

  it("includes tutor-of-day name on the cover when provided", () => {
    const out = planPrintableDailyBundle({
      dateIso: "2026-05-13",
      blocks: [MATH],
      tutorOfDayName: "Sophie",
      audienceTier: "adult",
      submitBaseUrl: SUBMIT_BASE,
    });
    if (out.kind === "ready") {
      expect(out.sections[0]?.title).toContain("with Sophie");
    }
  });

  it("blocks on bad date / no printable blocks / non-https submit base", () => {
    expect(
      planPrintableDailyBundle({
        dateIso: "2026/05/13",
        blocks: [MATH],
        tutorOfDayName: null,
        audienceTier: "adult",
        submitBaseUrl: SUBMIT_BASE,
      }).kind,
    ).toBe("blocked");
    expect(
      planPrintableDailyBundle({
        dateIso: "2026-05-13",
        blocks: [SLAY_CHARGE], // only morning_vibe → nothing printable
        tutorOfDayName: null,
        audienceTier: "adult",
        submitBaseUrl: SUBMIT_BASE,
      }).kind,
    ).toBe("blocked");
    expect(
      planPrintableDailyBundle({
        dateIso: "2026-05-13",
        blocks: [MATH],
        tutorOfDayName: null,
        audienceTier: "adult",
        submitBaseUrl: "http://insecure.example.com",
      }).kind,
    ).toBe("blocked");
    expect(
      planPrintableDailyBundle({
        dateIso: "2026-05-13",
        blocks: [MATH],
        tutorOfDayName: null,
        audienceTier: "adult",
        submitBaseUrl: "",
      }).kind,
    ).toBe("blocked");
  });

  it("buildSubmitDeeplink trims trailing slash on base url", () => {
    expect(
      buildSubmitDeeplink("https://x.example/", "blk_math", "2026-05-13"),
    ).toBe(
      "https://x.example/api/scheduled/worksheet-photo-submit?blockId=blk_math&date=2026-05-13",
    );
    expect(
      buildSubmitDeeplink("https://x.example", "blk_math", "2026-05-13"),
    ).toBe(
      "https://x.example/api/scheduled/worksheet-photo-submit?blockId=blk_math&date=2026-05-13",
    );
  });

  it("footer line marks adult copy distinctly", () => {
    const adult = planPrintableDailyBundle({
      dateIso: "2026-05-13",
      blocks: [MATH],
      tutorOfDayName: null,
      audienceTier: "adult",
      submitBaseUrl: SUBMIT_BASE,
    });
    const kid = planPrintableDailyBundle({
      dateIso: "2026-05-13",
      blocks: [MATH],
      tutorOfDayName: null,
      audienceTier: "kid",
      submitBaseUrl: SUBMIT_BASE,
    });
    if (adult.kind === "ready") expect(adult.footerLine).toContain("(adult copy)");
    if (kid.kind === "ready") expect(kid.footerLine).not.toContain("(adult copy)");
  });
});
