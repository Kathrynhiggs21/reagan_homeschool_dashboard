/**
 * Push 156 (2026-05-14) — vitest contract for the Reagan Request Button parser.
 */
import { describe, it, expect } from "vitest";
import { parseReaganRequest } from "./_lib/reaganRequestParser";

const NOW = "2026-05-14T09:30:00Z";

describe("Push 156 — parseReaganRequest", () => {
  it("classifies a schedule change and requires both approvers", () => {
    const row = parseReaganRequest("Can we skip math today?", NOW);
    expect(row.kind).toBe("schedule_change");
    expect(row.needsBothApprovers).toBe(true);
    expect(row.urgency).toBe("today");
    expect(row.displayLabel).toContain("Reagan asks to change the day");
    expect(row.notificationBody).toContain("both Mom + Grandma");
    expect(row.detail?.subjectHint).toBe("math");
  });

  it("classifies 'shorter day please' as a schedule change", () => {
    const row = parseReaganRequest("shorter day please", NOW);
    expect(row.kind).toBe("schedule_change");
    expect(row.needsBothApprovers).toBe(true);
  });

  it("classifies an assignment request with subject hint", () => {
    const row = parseReaganRequest(
      "I want a worksheet about whales please",
      NOW,
    );
    expect(row.kind).toBe("assignment_request");
    expect(row.needsBothApprovers).toBe(false);
    expect(row.detail?.topicHint?.toLowerCase()).toContain("whales");
  });

  it("classifies an adventure idea (bird watching)", () => {
    const row = parseReaganRequest("Let's go bird watching today!", NOW);
    expect(row.kind).toBe("adventure_idea");
    expect(row.urgency).toBe("today");
    expect(row.needsBothApprovers).toBe(false);
    expect(row.displayLabel).toContain("adventure idea");
  });

  it("classifies a snack request as urgent (now)", () => {
    const row = parseReaganRequest("I'm hungry", NOW);
    expect(row.kind).toBe("snack_or_break");
    expect(row.urgency).toBe("now");
    expect(row.needsBothApprovers).toBe(false);
  });

  it("classifies a Kiwi basic tweak as self-applyable", () => {
    const row = parseReaganRequest(
      "Kiwi, start a 10-minute timer please",
      NOW,
    );
    expect(row.kind).toBe("kiwi_basic_tweak");
    expect(row.kiwiCanSelfApply).toBe(true);
    expect(row.needsBothApprovers).toBe(false);
  });

  it("falls through to general_message for non-categorized text", () => {
    const row = parseReaganRequest("I love you Mom", NOW);
    expect(row.kind).toBe("general_message");
    expect(row.urgency).toBe("whenever");
    expect(row.needsBothApprovers).toBe(false);
    expect(row.kiwiCanSelfApply).toBe(false);
    expect(row.displayLabel).toContain("Reagan sent a message");
  });

  it("extracts a duration hint when Reagan asks for a length", () => {
    const row = parseReaganRequest(
      "I want extra reading for 20 minutes please",
      NOW,
    );
    // "extra reading" routes to assignment_request (the keywords match
    // assignment first), and detail captures the minute count.
    expect(row.kind).toBe("assignment_request");
    expect(row.detail?.minutesHint).toBe(20);
  });

  it("preserves rawText verbatim on the row", () => {
    const raw = "  Can I have a break?  ";
    const row = parseReaganRequest(raw, NOW);
    expect(row.rawText).toBe("Can I have a break?");
    expect(row.createdAtISO).toBe(NOW);
  });

  it("rejects empty input", () => {
    expect(() => parseReaganRequest("   ", NOW)).toThrow(/empty/);
  });

  it("rejects bad ISO timestamp", () => {
    expect(() => parseReaganRequest("hi", "yesterday")).toThrow(/ISO-8601/);
  });

  it("notification body is at most ~120 chars (phone-friendly)", () => {
    const row = parseReaganRequest("Can we skip math and reading today", NOW);
    expect(row.notificationBody.length).toBeLessThanOrEqual(160);
  });

  it("displayLabel never exposes jargon like 'kind' or 'enum'", () => {
    const samples = [
      "I want a math worksheet about fractions",
      "let's swim today",
      "cancel science",
    ];
    for (const s of samples) {
      const row = parseReaganRequest(s, NOW);
      expect(row.displayLabel.toLowerCase()).not.toMatch(/\b(kind|enum|payload|mutation)\b/);
    }
  });

  it("'no math today' is detected as a schedule change", () => {
    const row = parseReaganRequest("no math today please", NOW);
    expect(row.kind).toBe("schedule_change");
    expect(row.needsBothApprovers).toBe(true);
  });

  it("'I need to use the bathroom' is now-urgent snack_or_break", () => {
    const row = parseReaganRequest("I need to use the bathroom", NOW);
    expect(row.kind).toBe("snack_or_break");
    expect(row.urgency).toBe("now");
  });
});
