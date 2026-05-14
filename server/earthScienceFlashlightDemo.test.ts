import { describe, expect, it } from "vitest";
import {
  buildFlashlightDemoCard,
  findFlashlightDemoForTopicLabel,
  listFlashlightDemoTopics,
} from "./_lib/earthScienceFlashlightDemo";

describe("Push 144 — Earth-science flashlight-demo activity card", () => {
  it("rejects missing topic", () => {
    const r = buildFlashlightDemoCard("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("missing-topic");
    const r2 = buildFlashlightDemoCard(null);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.rejectReason).toBe("missing-topic");
  });

  it("rejects unknown topic", () => {
    const r = buildFlashlightDemoCard("photosynthesis");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("unknown-topic");
  });

  it("returns a complete card for earth-rotation-day-night", () => {
    const r = buildFlashlightDemoCard("earth-rotation-day-night");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.title).toMatch(/Day & Night/);
      expect(r.card.estMinutes).toBeGreaterThan(0);
      expect(r.card.supplies.length).toBeGreaterThan(0);
      expect(r.card.steps.length).toBeGreaterThan(2);
      expect(r.card.coloringReminder).toBe(true);
      expect(r.card.subject).toBe("science");
    }
  });

  it("returns earth-tilt-seasons with tilt + seasons keywords", () => {
    const r = buildFlashlightDemoCard("earth-tilt-seasons");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.matchKeywords).toEqual(
        expect.arrayContaining(["tilt", "seasons"]),
      );
    }
  });

  it("solar-system-orbits flagged preferOutdoorDark", () => {
    const r = buildFlashlightDemoCard("solar-system-orbits");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.preferOutdoorDark).toBe(true);
  });

  it("findFlashlightDemoForTopicLabel matches whole-word 'rotation'", () => {
    const r = findFlashlightDemoForTopicLabel("Earth's rotation and time zones");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.topic).toBe("earth-rotation-day-night");
  });

  it("findFlashlightDemoForTopicLabel matches multi-word 'day and night'", () => {
    const r = findFlashlightDemoForTopicLabel("Day and Night cycle");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.topic).toBe("earth-rotation-day-night");
  });

  it("findFlashlightDemoForTopicLabel matches 'seasons'", () => {
    const r = findFlashlightDemoForTopicLabel("Why do we have seasons?");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.topic).toBe("earth-tilt-seasons");
  });

  it("findFlashlightDemoForTopicLabel matches 'moon phases'", () => {
    const r = findFlashlightDemoForTopicLabel("Moon phases this month");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.topic).toBe("moon-phases");
  });

  it("findFlashlightDemoForTopicLabel does NOT match substring inside another word", () => {
    // 'rotation' inside 'rotational-symmetry-math-topic' should still match
    // because 'rotation' is followed by '-' (a non-alpha boundary).
    // But 'tiltedflowers' should NOT match 'tilt'.
    const r = findFlashlightDemoForTopicLabel("tiltedflowers in the wind");
    expect(r.ok).toBe(false);
  });

  it("findFlashlightDemoForTopicLabel rejects empty / blank input", () => {
    const r = findFlashlightDemoForTopicLabel("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("missing-topic");
  });

  it("findFlashlightDemoForTopicLabel returns unknown-topic when nothing matches", () => {
    const r = findFlashlightDemoForTopicLabel("photosynthesis lab");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("unknown-topic");
  });

  it("listFlashlightDemoTopics returns all 4 canonical demos", () => {
    const all = listFlashlightDemoTopics();
    expect(all).toEqual(
      expect.arrayContaining([
        "earth-rotation-day-night",
        "earth-tilt-seasons",
        "moon-phases",
        "solar-system-orbits",
      ]),
    );
    expect(all.length).toBe(4);
  });
});
