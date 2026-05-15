import { describe, it, expect } from "vitest";
import { auditKiwiSessionSize } from "./_lib/kiwiSessionSizeAuditor";
import { makeKiwiChatSessionState } from "./_lib/kiwiChatSessionState";

describe("kiwiSessionSizeAuditor — diagnostic for adult review page", () => {
  it("empty state → 0 panels, 0 live, small byte count, 'ok'", () => {
    const r = auditKiwiSessionSize(makeKiwiChatSessionState());
    expect(r.totalPanels).toBe(0);
    expect(r.livePanels).toBe(0);
    expect(r.encodedByteCount).toBeGreaterThan(0);
    expect(r.encodedByteCount).toBeLessThan(2048);
    expect(r.recommendation).toBe("ok");
  });

  it("counts unique panels across streak + rotation + lastEvent", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    s.streak.lastEventAtUtcMs.kiwi = 1;
    s.rotation.counterByPanel.bookshelf = 1;
    const r = auditKiwiSessionSize(s);
    expect(r.totalPanels).toBe(3);
  });

  it("live panels: streak>0 OR rotation>0", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.streak.streakByPanel.kiwi = 0;
    s.rotation.counterByPanel.kiwi = 3;
    s.streak.lastEventAtUtcMs.bookshelf = 1779000000000; // ts only, not live
    const r = auditKiwiSessionSize(s);
    expect(r.totalPanels).toBe(3);
    expect(r.livePanels).toBe(2);
  });

  it("recommendation 'ok' when small", () => {
    const r = auditKiwiSessionSize(makeKiwiChatSessionState());
    expect(r.recommendation).toBe("ok");
  });

  it("recommendation 'consider_trim' at ≥ 2KB", () => {
    const s = makeKiwiChatSessionState();
    for (let i = 0; i < 50; i++) {
      s.streak.streakByPanel[`panel_${i}_long_label_to_pad_bytes`] = i;
      s.streak.lastEventAtUtcMs[`panel_${i}_long_label_to_pad_bytes`] =
        1779000000000;
      s.rotation.counterByPanel[`panel_${i}_long_label_to_pad_bytes`] = i;
    }
    const r = auditKiwiSessionSize(s);
    expect(r.encodedByteCount).toBeGreaterThanOrEqual(2048);
    expect(r.recommendation === "consider_trim" || r.recommendation === "trim_now").toBe(true);
  });

  it("recommendation 'trim_now' at ≥ 8KB", () => {
    const s = makeKiwiChatSessionState();
    for (let i = 0; i < 250; i++) {
      s.streak.streakByPanel[`panel_${i}_long_padding_token_for_bytes`] = i;
      s.streak.lastEventAtUtcMs[`panel_${i}_long_padding_token_for_bytes`] =
        1779000000000;
      s.rotation.counterByPanel[`panel_${i}_long_padding_token_for_bytes`] = i;
    }
    const r = auditKiwiSessionSize(s);
    expect(r.encodedByteCount).toBeGreaterThanOrEqual(8192);
    expect(r.recommendation).toBe("trim_now");
  });

  it("custom thresholds respected", () => {
    const r = auditKiwiSessionSize(makeKiwiChatSessionState(), {
      considerTrimBytes: 10,
      trimNowBytes: 20,
    });
    expect(r.recommendation).toBe("trim_now");
  });

  it("custom trimNowBytes below considerTrimBytes is rejected (falls back to default)", () => {
    const r = auditKiwiSessionSize(makeKiwiChatSessionState(), {
      considerTrimBytes: 1000000,
      trimNowBytes: 10, // invalid: below considerAt → default 8192
    });
    // small payload, considerAt above payload, trimNowAt = default 8192 also above
    expect(r.recommendation).toBe("ok");
  });

  it("null/undefined state → empty audit", () => {
    expect(auditKiwiSessionSize(null).totalPanels).toBe(0);
    expect(auditKiwiSessionSize(undefined).livePanels).toBe(0);
  });

  it("byte count is utf-8 aware (multi-byte panel name)", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel["café"] = 1; // 2-byte é
    s.streak.lastEventAtUtcMs["café"] = 1779000000000;
    const r = auditKiwiSessionSize(s);
    expect(r.encodedByteCount).toBeGreaterThan(20);
  });

  it("input state not mutated", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    const snap = JSON.stringify(s);
    auditKiwiSessionSize(s);
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("is deterministic — same input → same output", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    expect(auditKiwiSessionSize(s)).toEqual(auditKiwiSessionSize(s));
  });

  it("totalPanels === 0 ⇒ livePanels === 0", () => {
    const r = auditKiwiSessionSize(makeKiwiChatSessionState());
    expect(r.totalPanels).toBe(0);
    expect(r.livePanels).toBe(0);
  });
});
