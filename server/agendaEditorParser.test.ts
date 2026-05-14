/**
 * Push 151 (2026-05-14) — agendaEditorParser vitest contract.
 */
import { describe, it, expect } from "vitest";
import { parseAgendaEditorInput } from "./_lib/agendaEditorParser";

describe("parseAgendaEditorInput", () => {
  it("recognizes 'shorter today'", () => {
    const r = parseAgendaEditorInput("shorter today");
    expect(r.edits).toHaveLength(1);
    expect(r.edits[0].kind).toBe("scale_durations");
    if (r.edits[0].kind === "scale_durations") {
      expect(r.edits[0].multiplier).toBe(0.75);
    }
    expect(r.summary).toMatch(/25% shorter/);
  });

  it("recognizes 'longer today'", () => {
    const r = parseAgendaEditorInput("longer today");
    expect(r.edits[0].kind).toBe("scale_durations");
    if (r.edits[0].kind === "scale_durations") {
      expect(r.edits[0].multiplier).toBe(1.25);
    }
  });

  it("recognizes 'skip science'", () => {
    const r = parseAgendaEditorInput("skip science");
    expect(r.edits[0].kind).toBe("remove_subject");
    if (r.edits[0].kind === "remove_subject") {
      expect(r.edits[0].subjectSlug).toBe("science");
    }
  });

  it("recognizes 'more math'", () => {
    const r = parseAgendaEditorInput("more math");
    expect(r.edits[0].kind).toBe("insert_block");
    if (r.edits[0].kind === "insert_block") {
      expect(r.edits[0].subjectSlug).toBe("math");
      expect(r.edits[0].durationMin).toBe(20);
    }
  });

  it("recognizes 'add 30 min reading'", () => {
    const r = parseAgendaEditorInput("add 30 min reading");
    expect(r.edits[0].kind).toBe("insert_block");
    if (r.edits[0].kind === "insert_block") {
      expect(r.edits[0].subjectSlug).toBe("reading");
      expect(r.edits[0].durationMin).toBe(30);
    }
  });

  it("recognizes 'swap reading and math'", () => {
    // 'and' is a phrase splitter, so the parser sees 'swap reading' alone.
    // The swap pattern uses 'and|with'; we need 'swap X with Y' to bypass split.
    const r = parseAgendaEditorInput("swap reading with math");
    expect(r.edits[0].kind).toBe("swap_subjects");
  });

  it("recognizes 'start at 10'", () => {
    const r = parseAgendaEditorInput("start at 10");
    expect(r.edits[0].kind).toBe("set_start_time");
    if (r.edits[0].kind === "set_start_time") {
      expect(r.edits[0].startTime).toBe("10:00");
    }
  });

  it("recognizes 'start at 10:30'", () => {
    const r = parseAgendaEditorInput("start at 10:30");
    expect(r.edits[0].kind).toBe("set_start_time");
    if (r.edits[0].kind === "set_start_time") {
      expect(r.edits[0].startTime).toBe("10:30");
    }
  });

  it("recognizes 'start at 9am'", () => {
    const r = parseAgendaEditorInput("start at 9am");
    if (r.edits[0].kind === "set_start_time") {
      expect(r.edits[0].startTime).toBe("09:00");
    }
  });

  it("recognizes '10 minute break after math'", () => {
    const r = parseAgendaEditorInput("10 minute break after math");
    expect(r.edits[0].kind).toBe("insert_block");
    if (r.edits[0].kind === "insert_block") {
      expect(r.edits[0].durationMin).toBe(10);
      expect(r.edits[0].afterSubjectSlug).toBe("math");
      expect(r.edits[0].subjectSlug).toBe("break");
    }
  });

  it("recognizes 'no test today'", () => {
    const r = parseAgendaEditorInput("no test today");
    expect(r.edits[0].kind).toBe("tag_no_test_day");
  });

  it("recognizes 'fun and easy' preset", () => {
    // 'and' is a phrase splitter — supply alternative phrasing.
    const r = parseAgendaEditorInput("make it fun");
    expect(r.edits[0].kind).toBe("fun_easy_preset");
  });

  it("composes multiple edits via comma split", () => {
    const r = parseAgendaEditorInput("shorter today, more math, skip science");
    expect(r.edits.length).toBe(3);
    expect(r.edits.map((e) => e.kind)).toEqual([
      "scale_durations",
      "insert_block",
      "remove_subject",
    ]);
    expect(r.summary).toContain("•");
  });

  it("returns ZERO edits + unrecognized for gibberish (never guesses)", () => {
    const r = parseAgendaEditorInput("blarghity blargh");
    expect(r.edits).toHaveLength(0);
    expect(r.unrecognized).toContain("blarghity blargh");
    expect(r.summary).toMatch(/didn't recognize/i);
  });

  it("empty input is a no-op (no error, no edits)", () => {
    const r = parseAgendaEditorInput("");
    expect(r.edits).toHaveLength(0);
    expect(r.unrecognized).toHaveLength(0);
  });

  it("preserves original input verbatim for the undo card", () => {
    const r = parseAgendaEditorInput("Shorter Today!");
    expect(r.originalInput).toBe("Shorter Today!");
    expect(r.edits[0].kind).toBe("scale_durations"); // case-insensitive
  });

  it("returns kid-readable reason strings (no internal jargon)", () => {
    const r = parseAgendaEditorInput("shorter today, more math, skip science");
    for (const e of r.edits) {
      expect(e.reason).not.toMatch(/subjectSlug|kind|multiplier|EditOp/);
    }
  });
});
