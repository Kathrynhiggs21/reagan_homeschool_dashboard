/**
 * Push 138 (2026-05-13) — Outdoor / real-world activity tag.
 *
 * Project rule: Reagan's curriculum should make space for fun, interactive
 * assignments that encourage outdoor activity and real-world engagement
 * (e.g. growing crystals, bird-watching). The Schedule + Curriculum Hub
 * surfaces a small badge on those blocks so Mom can see them at a glance,
 * the digest can highlight them, and the AI agenda editor can rebalance
 * toward more of them when she asks for a "more outdoor" day.
 *
 * This helper is the single source of truth for:
 *   - whether a block is outdoor (open-air)
 *   - whether a block is real-world / hands-on (could be indoors, e.g.
 *     baking, building, observing the parakeets)
 *   - what badge label + emoji to render
 *
 * Pure module — no DB, no I/O. Uses the block's title + description +
 * existing labels/tags. Title and description are matched as
 * whole-word, case-insensitive; labels/tags are matched exact.
 */

export type ActivityTagKind =
  | "outdoor"
  | "real-world"
  | "outdoor+real-world"
  | "neither";

export interface ActivityTagDecision {
  kind: ActivityTagKind;
  outdoor: boolean;
  realWorld: boolean;
  badgeLabel: string | null;
  badgeEmoji: string | null;
  matchedKeywords: string[];
}

// Canonical keyword sets. Whole-word, case-insensitive against title +
// description. Keep narrow on purpose — we'd rather miss a real-world
// activity than tag a worksheet as "outdoor" because the description
// happens to contain the word "park".
const OUTDOOR_KEYWORDS = [
  "outside",
  "outdoor",
  "outdoors",
  "outdoor walk",
  "nature walk",
  "hike",
  "hiking",
  "bird watch",
  "bird-watching",
  "birdwatching",
  "bird watching",
  "garden",
  "gardening",
  "park visit",
  "field trip",
  "yard",
  "back yard",
  "backyard",
  "duck pond",
] as const;

const REAL_WORLD_KEYWORDS = [
  "real world",
  "real-world",
  "hands-on",
  "hands on",
  "experiment",
  "build",
  "make",
  "cook",
  "baking",
  "bake",
  "grow crystals",
  "crystal growing",
  "observe",
  "interview",
  "measure",
  "field journal",
  "parakeet",
  "parakeets",
  "duckling",
  "ducklings",
] as const;

const TAG_OUTDOOR = new Set(["outdoor", "open-air", "field"]);
const TAG_REAL_WORLD = new Set([
  "real-world",
  "hands-on",
  "experiment",
  "service",
]);

function lowerOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findWholeWordMatches(haystack: string, needles: readonly string[]): string[] {
  if (haystack.length === 0) return [];
  const hits: string[] = [];
  for (const needle of needles) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeForRegex(needle)}([^a-z0-9]|$)`, "i");
    if (pattern.test(haystack)) hits.push(needle);
  }
  return hits;
}

export function tagActivity(input: {
  title?: string | null;
  description?: string | null;
  labels?: ReadonlyArray<string> | null;
  tags?: ReadonlyArray<string> | null;
}): ActivityTagDecision {
  const haystack = `${lowerOrEmpty(input?.title)} ${lowerOrEmpty(input?.description)}`.trim();

  const outdoorHits = findWholeWordMatches(haystack, OUTDOOR_KEYWORDS);
  const realWorldHits = findWholeWordMatches(haystack, REAL_WORLD_KEYWORDS);

  const allLabels = [
    ...(input?.labels ?? []),
    ...(input?.tags ?? []),
  ]
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  const labelOutdoor = allLabels.some((l) => TAG_OUTDOOR.has(l));
  const labelRealWorld = allLabels.some((l) => TAG_REAL_WORLD.has(l));

  const outdoor = outdoorHits.length > 0 || labelOutdoor;
  const realWorld = realWorldHits.length > 0 || labelRealWorld;

  const matched = Array.from(
    new Set([
      ...outdoorHits,
      ...realWorldHits,
      ...(labelOutdoor ? ["[label:outdoor]"] : []),
      ...(labelRealWorld ? ["[label:real-world]"] : []),
    ]),
  );

  if (outdoor && realWorld) {
    return {
      kind: "outdoor+real-world",
      outdoor: true,
      realWorld: true,
      badgeLabel: "Outdoor + Real-World",
      badgeEmoji: "🌿",
      matchedKeywords: matched,
    };
  }
  if (outdoor) {
    return {
      kind: "outdoor",
      outdoor: true,
      realWorld: false,
      badgeLabel: "Outdoor",
      badgeEmoji: "🌳",
      matchedKeywords: matched,
    };
  }
  if (realWorld) {
    return {
      kind: "real-world",
      outdoor: false,
      realWorld: true,
      badgeLabel: "Real-World",
      badgeEmoji: "🛠️",
      matchedKeywords: matched,
    };
  }
  return {
    kind: "neither",
    outdoor: false,
    realWorld: false,
    badgeLabel: null,
    badgeEmoji: null,
    matchedKeywords: [],
  };
}
