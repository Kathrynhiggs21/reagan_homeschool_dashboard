import { describe, it, expect } from "vitest";
import {
  rollupListeningMoodTimeline,
  type ListeningChunk,
} from "./_lib/listeningMoodTimelineRollup";

const c = (
  hour: number,
  mood: string,
  tags: string[] = [],
  reaganVoicePresent = true,
): ListeningChunk => ({
  atISO: `2026-05-15T${String(hour).padStart(2, "0")}:30:00.000Z`,
  reaganVoicePresent,
  moodEstimate: mood,
  behaviorTags: tags,
});

describe("Push 173 — listening mood timeline rollup", () => {
  it("always returns 24 hours", () => {
    const cells = rollupListeningMoodTimeline({
      dateISO: "2026-05-15",
      chunks: [],
    });
    expect(cells).toHaveLength(24);
    expect(cells.every((x) => x.empty)).toBe(true);
    expect(cells.every((x) => x.kidLine === null)).toBe(true);
  });

  it("rolls up dominant mood per hour", () => {
    const cells = rollupListeningMoodTimeline({
      dateISO: "2026-05-15",
      chunks: [
        c(9, "calm"),
        c(9, "calm"),
        c(9, "engaged"),
        c(10, "frustrated"),
      ],
    });
    expect(cells[9].dominantMood).toBe("calm");
    expect(cells[9].chunkCount).toBe(3);
    expect(cells[10].dominantMood).toBe("frustrated");
  });

  it("excludes chunks where Reagan's voice is not present", () => {
    const cells = rollupListeningMoodTimeline({
      dateISO: "2026-05-15",
      chunks: [
        c(11, "calm", [], false),
        c(11, "calm", [], false),
        c(11, "engaged", [], true),
      ],
    });
    expect(cells[11].chunkCount).toBe(1);
    expect(cells[11].dominantMood).toBe("engaged");
  });

  it("drops mood values outside the kid-safe enum without crashing", () => {
    const cells = rollupListeningMoodTimeline({
      dateISO: "2026-05-15",
      chunks: [
        c(13, "anxious"),
        c(13, "depressed"),
        c(13, "calm"),
      ],
    });
    expect(cells[13].chunkCount).toBe(1);
    expect(cells[13].dominantMood).toBe("calm");
  });

  it("rolls up top 3 behavior tags by frequency", () => {
    const cells = rollupListeningMoodTimeline({
      dateISO: "2026-05-15",
      chunks: [
        c(14, "engaged", ["focused", "asking-questions"]),
        c(14, "engaged", ["focused"]),
        c(14, "engaged", ["focused", "off-topic"]),
        c(14, "engaged", ["distracted"]),
      ],
    });
    // 'focused' is most frequent. 'distracted' wins the secondary slot
    // because it appears in the most-recent chunk (recency tiebreak).
    expect(cells[14].topBehaviorTags[0]).toBe("focused");
    expect(cells[14].topBehaviorTags).toContain("distracted");
    expect(cells[14].topBehaviorTags).toHaveLength(3);
  });

  it("ignores chunks from other days", () => {
    const cells = rollupListeningMoodTimeline({
      dateISO: "2026-05-15",
      chunks: [
        { ...c(9, "calm"), atISO: "2026-05-14T09:30:00.000Z" },
        c(9, "engaged"),
      ],
    });
    expect(cells[9].chunkCount).toBe(1);
    expect(cells[9].dominantMood).toBe("engaged");
  });

  it("kid line is Reagan-readable (no adult names, no clinical words)", () => {
    const cells = rollupListeningMoodTimeline({
      dateISO: "2026-05-15",
      chunks: [c(9, "frustrated"), c(10, "tired"), c(11, "silly")],
    });
    for (const cell of cells) {
      if (!cell.kidLine) continue;
      expect(cell.kidLine.toLowerCase()).not.toMatch(
        /mom|grandma|adhd|autism|trauma|anxious|depress/,
      );
    }
    // At least one kid line in the day uses 'You' (Reagan-readable framing).
    const anyYou = cells.some((c) => c.kidLine && /\b[Yy]ou\b/.test(c.kidLine));
    expect(anyYou).toBe(true);
  });

  it("empty hours are emitted with empty=true so UI can hide them", () => {
    const cells = rollupListeningMoodTimeline({
      dateISO: "2026-05-15",
      chunks: [c(9, "calm")],
    });
    expect(cells[8].empty).toBe(true);
    expect(cells[9].empty).toBe(false);
    expect(cells[10].empty).toBe(true);
  });

  it("is deterministic — same input ⇒ same output", () => {
    const input = {
      dateISO: "2026-05-15",
      chunks: [c(9, "calm", ["focused"]), c(9, "engaged")],
    };
    const a = rollupListeningMoodTimeline(input);
    const b = rollupListeningMoodTimeline(input);
    expect(a).toEqual(b);
  });

  it("ignores invalid timestamp rows without crashing", () => {
    const cells = rollupListeningMoodTimeline({
      dateISO: "2026-05-15",
      chunks: [
        { ...c(9, "calm"), atISO: "not-a-timestamp" },
        c(9, "engaged"),
      ],
    });
    expect(cells[9].chunkCount).toBe(1);
    expect(cells[9].dominantMood).toBe("engaged");
  });
});
