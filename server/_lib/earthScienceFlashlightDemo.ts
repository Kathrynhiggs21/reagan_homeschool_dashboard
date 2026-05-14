/**
 * Push 144 (2026-05-14) — Earth-science flashlight-demo activity cards.
 *
 * Project rule: for Earth-science topics about rotation, tilt, and seasons,
 * surface a physical-demonstration activity (flashlight + globe/orange) and
 * remind Reagan to color the planets when relevant.
 *
 * Pure helper: given a topic key, returns a printable activity-card render
 * plan (title, supplies, steps, notes, coloring reminder, outdoor flag,
 * matchedTopic). Returns rejectReason when no flashlight demo applies.
 *
 * No DB / no I/O. Single source of truth for the demo card so the agenda
 * generator, Adventure-of-the-Day picker, and the printable bundle all
 * render the same content.
 */

export type FlashlightDemoTopic =
  | "earth-rotation-day-night"
  | "earth-tilt-seasons"
  | "moon-phases"
  | "solar-system-orbits";

export type FlashlightDemoRejectReason =
  | "unknown-topic"
  | "missing-topic";

export interface FlashlightDemoCard {
  topic: FlashlightDemoTopic;
  title: string;
  estMinutes: number;
  supplies: string[];
  steps: string[];
  notes: string[];
  /** Whether to remind Reagan to color the planets/diagram afterward. */
  coloringReminder: boolean;
  /** True when the demo is best done outside (or near a dark window). */
  preferOutdoorDark: boolean;
  /** Subject label for routing. Always "science" for now. */
  subject: "science";
  /** A whole-word search hint the agenda generator uses to attach demos. */
  matchKeywords: string[];
}

const DEMO_REGISTRY: Record<FlashlightDemoTopic, FlashlightDemoCard> = {
  "earth-rotation-day-night": {
    topic: "earth-rotation-day-night",
    title: "Flashlight Demo: Day & Night",
    estMinutes: 15,
    supplies: ["1 flashlight", "1 globe (or orange + toothpick)"],
    steps: [
      "Stand the globe so North is up. Mark your city with a sticky-tab.",
      "Turn the room lights low. Hold the flashlight ~2 feet away as the Sun.",
      "Slowly spin the globe west→east. Watch your city pass through day → sunset → night → sunrise.",
      "Pause when your city is at sunset. What part of the globe is in noon? In midnight?",
    ],
    notes: [
      "One full spin = 24 hours.",
      "The Sun isn't moving — *we* are spinning past it.",
    ],
    coloringReminder: true,
    preferOutdoorDark: false,
    subject: "science",
    matchKeywords: ["rotation", "day and night", "day-night", "spin"],
  },
  "earth-tilt-seasons": {
    topic: "earth-tilt-seasons",
    title: "Flashlight Demo: Earth's Tilt & Seasons",
    estMinutes: 20,
    supplies: ["1 flashlight", "1 globe (tilted ~23.5°)", "Tape on the floor"],
    steps: [
      "Tape four floor marks: June, September, December, March around a center spot (the Sun).",
      "Hold the tilted globe with North always pointed the same direction (toward a fixed wall).",
      "Carry the globe slowly between marks. At each stop, shine the flashlight from the center.",
      "Notice: when North tilts toward the Sun → northern summer; tilts away → northern winter.",
    ],
    notes: [
      "The tilt does NOT change. It only *points* the same way as Earth orbits.",
      "Equinoxes = neither hemisphere tilted toward the Sun.",
    ],
    coloringReminder: true,
    preferOutdoorDark: false,
    subject: "science",
    matchKeywords: ["tilt", "seasons", "axial", "equinox", "solstice"],
  },
  "moon-phases": {
    topic: "moon-phases",
    title: "Flashlight Demo: Moon Phases",
    estMinutes: 15,
    supplies: ["1 flashlight (Sun)", "1 small ball (Moon)", "Your head = Earth"],
    steps: [
      "Have someone hold the flashlight steady across the room.",
      "Hold the ball at arm's length. Slowly turn in a circle, ball facing you.",
      "Watch the lit part of the ball: full → gibbous → quarter → crescent → new → repeat.",
    ],
    notes: ["The Moon doesn't change shape — only the lit part you can see does."],
    coloringReminder: true,
    preferOutdoorDark: false,
    subject: "science",
    matchKeywords: ["moon", "phases", "lunar"],
  },
  "solar-system-orbits": {
    topic: "solar-system-orbits",
    title: "Flashlight Demo: Solar-System Orbits (Outdoor)",
    estMinutes: 25,
    supplies: ["1 flashlight (or sidewalk chalk + sun)", "8 small objects for planets"],
    steps: [
      "On the driveway, mark the Sun in the center.",
      "Walk out and place an object for each planet at its scaled distance.",
      "Walk Earth around the Sun once = 1 year. Walk Mars while you do — Mars takes ~2 of your laps.",
    ],
    notes: ["Outer planets travel WAY slower in their orbits."],
    coloringReminder: true,
    preferOutdoorDark: true,
    subject: "science",
    matchKeywords: ["solar system", "orbit", "planets"],
  },
};

export type BuildFlashlightDemoResult =
  | { ok: true; card: FlashlightDemoCard }
  | { ok: false; rejectReason: FlashlightDemoRejectReason; message: string };

export function buildFlashlightDemoCard(
  topic: FlashlightDemoTopic | string | null | undefined,
): BuildFlashlightDemoResult {
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return {
      ok: false,
      rejectReason: "missing-topic",
      message: "Topic key required.",
    };
  }
  const key = topic.trim() as FlashlightDemoTopic;
  const card = DEMO_REGISTRY[key];
  if (!card) {
    return {
      ok: false,
      rejectReason: "unknown-topic",
      message: `No flashlight demo registered for "${topic}".`,
    };
  }
  return { ok: true, card };
}

/**
 * Whole-word match against a free-form science topic label. Returns the
 * best-matching card (first-match wins by registry order). Used by the
 * agenda generator to attach a physical demo when it sees rotation /
 * tilt / seasons / moon / orbit phrasing in a topic line.
 */
export function findFlashlightDemoForTopicLabel(
  topicLabel: string | null | undefined,
): BuildFlashlightDemoResult {
  if (!topicLabel || typeof topicLabel !== "string" || !topicLabel.trim()) {
    return {
      ok: false,
      rejectReason: "missing-topic",
      message: "Topic label required.",
    };
  }
  const lower = topicLabel.toLowerCase();
  for (const card of Object.values(DEMO_REGISTRY)) {
    for (const kw of card.matchKeywords) {
      // Whole-word / phrase boundary: surrounded by non-alphanumerics or string ends.
      const pattern = new RegExp(
        `(^|[^a-z0-9])${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}([^a-z0-9]|$)`,
        "i",
      );
      if (pattern.test(lower)) return { ok: true, card };
    }
  }
  return {
    ok: false,
    rejectReason: "unknown-topic",
    message: `No flashlight demo matched "${topicLabel}".`,
  };
}

export function listFlashlightDemoTopics(): FlashlightDemoTopic[] {
  return Object.keys(DEMO_REGISTRY) as FlashlightDemoTopic[];
}
