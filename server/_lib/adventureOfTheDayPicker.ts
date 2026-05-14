/**
 * Push 145 (2026-05-14) — Adventure of the Day deterministic picker.
 *
 * Project rule: Reagan's day is centered on a daily Adventure block. The
 * Adventure Library is weighted toward birds, animals, plants, water,
 * swimming, and outdoors (5th-grade level, fun + interactive).
 *
 * This pure helper picks tomorrow's (or today's) Adventure deterministically
 * by date (so a refresh never changes the kid's adventure), with optional
 * rerollIndex (Mom can spin a different option from settings). It also
 * weights the registry so birds/animals/plants/water/swim/outdoor categories
 * are 4× more likely than fallback "indoor-craft" / "history-quick" entries.
 *
 * No DB / no I/O. Registry is the single source of truth.
 */

export type AdventureCategory =
  | "birds"
  | "animals"
  | "plants"
  | "water"
  | "swim"
  | "outdoor"
  | "indoor-craft"
  | "history-quick";

export const PREFERRED_ADVENTURE_CATEGORIES: ReadonlyArray<AdventureCategory> = [
  "birds",
  "animals",
  "plants",
  "water",
  "swim",
  "outdoor",
];

export interface AdventureEntry {
  id: string;
  title: string;
  category: AdventureCategory;
  estMinutes: number;
  isOutdoor: boolean;
  /** Optional supplies (kept short — kid-facing). */
  supplies: string[];
  /** Short kid-facing blurb (≤140 chars). */
  blurb: string;
  /** Skill tie-ins so the topic dashboard can attach coverage. */
  topicTags: string[];
}

export const ADVENTURE_REGISTRY: ReadonlyArray<AdventureEntry> = [
  // BIRDS (preferred)
  {
    id: "birds-merlin-sit",
    title: "Merlin Bird-ID Sit Spot",
    category: "birds",
    estMinutes: 25,
    isOutdoor: true,
    supplies: ["Merlin app", "notebook"],
    blurb:
      "Pick a backyard spot. Sit 10 min. Log every bird Merlin hears. Sketch one.",
    topicTags: ["birds", "ecosystems", "observation"],
  },
  {
    id: "birds-feeder-watch",
    title: "Feeder-Watch Tally",
    category: "birds",
    estMinutes: 20,
    isOutdoor: true,
    supplies: ["bird feeder", "tally sheet"],
    blurb: "Tally each species that visits in 15 minutes. Bar-graph the result.",
    topicTags: ["birds", "data", "graphing"],
  },
  // ANIMALS
  {
    id: "animals-track-id",
    title: "Animal Track Hunt",
    category: "animals",
    estMinutes: 30,
    isOutdoor: true,
    supplies: ["camera", "ruler"],
    blurb: "Walk the yard or trail. Photograph 3 tracks. Measure & try to ID.",
    topicTags: ["animals", "tracking", "measurement"],
  },
  {
    id: "animals-inat-quest",
    title: "iNaturalist Mini-Quest",
    category: "animals",
    estMinutes: 30,
    isOutdoor: true,
    supplies: ["iNaturalist app"],
    blurb: "Find + log 5 living things outside. At least 1 must be an insect.",
    topicTags: ["animals", "biodiversity"],
  },
  // PLANTS
  {
    id: "plants-leaf-press",
    title: "Leaf Press & Label",
    category: "plants",
    estMinutes: 25,
    isOutdoor: true,
    supplies: ["3 leaves", "heavy book", "labels"],
    blurb: "Collect 3 different leaves, press, label species + where you found it.",
    topicTags: ["plants", "classification"],
  },
  {
    id: "plants-flower-parts",
    title: "Flower Dissection",
    category: "plants",
    estMinutes: 20,
    isOutdoor: false,
    supplies: ["1 flower", "tweezers", "tape"],
    blurb: "Take a flower apart. Tape petals/stamens/pistil to paper. Label parts.",
    topicTags: ["plants", "anatomy"],
  },
  // WATER
  {
    id: "water-rain-gauge",
    title: "Rain-Gauge Build",
    category: "water",
    estMinutes: 30,
    isOutdoor: true,
    supplies: ["clear bottle", "ruler", "tape"],
    blurb: "Build a simple gauge. Measure & log rainfall for the next 3 days.",
    topicTags: ["water", "weather", "measurement"],
  },
  {
    id: "water-density-stack",
    title: "Density Stack",
    category: "water",
    estMinutes: 25,
    isOutdoor: false,
    supplies: ["honey", "soap", "water", "oil", "tall glass"],
    blurb: "Layer liquids by density. Predict the order before you pour.",
    topicTags: ["water", "density", "chemistry"],
  },
  // SWIM
  {
    id: "swim-laps-breath",
    title: "Pool Laps + Breath Count",
    category: "swim",
    estMinutes: 35,
    isOutdoor: true,
    supplies: ["pool", "goggles"],
    blurb: "Swim 4 laps. Count strokes per breath. Try to lower the count by 1.",
    topicTags: ["swim", "fitness", "data"],
  },
  // OUTDOOR (general)
  {
    id: "outdoor-nature-journal",
    title: "Nature-Journal Page",
    category: "outdoor",
    estMinutes: 25,
    isOutdoor: true,
    supplies: ["notebook", "colored pencils"],
    blurb: "Pick a spot outside. Sketch + write 3 senses + 1 question.",
    topicTags: ["outdoor", "observation", "writing"],
  },
  // INDOOR FALLBACKS (lower weight)
  {
    id: "indoor-planet-color",
    title: "Color the 8 Planets",
    category: "indoor-craft",
    estMinutes: 20,
    isOutdoor: false,
    supplies: ["printable", "colored pencils"],
    blurb: "Color the 8 planets in size order. Label largest → smallest.",
    topicTags: ["solar system", "art"],
  },
  {
    id: "history-state-fact",
    title: "5 State-Fact Find",
    category: "history-quick",
    estMinutes: 15,
    isOutdoor: false,
    supplies: ["book or browser"],
    blurb: "Pick a state. Write 5 facts (capital, bird, flower, year, one wild fact).",
    topicTags: ["geography", "research"],
  },
];

const PREFERRED_WEIGHT = 4;
const FALLBACK_WEIGHT = 1;

function entryWeight(entry: AdventureEntry): number {
  return (PREFERRED_ADVENTURE_CATEGORIES as readonly string[]).includes(
    entry.category,
  )
    ? PREFERRED_WEIGHT
    : FALLBACK_WEIGHT;
}

function hashStringToInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type AdventurePickInput = {
  /** YYYY-MM-DD; pick is deterministic per day. */
  dateIso: string;
  /** Mom's reroll counter; increments on each spin. */
  rerollIndex?: number | null;
  /** Optional pre-filter: only return entries from these categories. */
  onlyCategories?: AdventureCategory[] | null;
  /** Optional skip set (e.g. recently picked ids to avoid). */
  excludeIds?: string[] | null;
};

export type AdventurePickResult =
  | { ok: true; pick: AdventureEntry; pool: number; weightedPool: number }
  | { ok: false; rejectReason: "bad-date" | "empty-pool" };

export function pickAdventureOfTheDay(
  input: AdventurePickInput,
): AdventurePickResult {
  if (
    !input ||
    typeof input.dateIso !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dateIso)
  ) {
    return { ok: false, rejectReason: "bad-date" };
  }

  const exclude = new Set(
    (Array.isArray(input.excludeIds) ? input.excludeIds : []).filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    ),
  );
  const onlyCats = Array.isArray(input.onlyCategories)
    ? new Set(input.onlyCategories)
    : null;

  const pool = ADVENTURE_REGISTRY.filter(
    (e) =>
      !exclude.has(e.id) && (!onlyCats || onlyCats.has(e.category)),
  );
  if (pool.length === 0) {
    return { ok: false, rejectReason: "empty-pool" };
  }

  // Build a weighted bag where preferred-category entries appear 4× and
  // fallback entries appear 1×. Then index deterministically by hash.
  const bag: AdventureEntry[] = [];
  for (const e of pool) {
    const w = entryWeight(e);
    for (let i = 0; i < w; i++) bag.push(e);
  }

  const rawReroll =
    typeof input.rerollIndex === "number" && Number.isFinite(input.rerollIndex)
      ? input.rerollIndex
      : 0;
  const reroll = Math.max(0, Math.floor(rawReroll));
  const seed = hashStringToInt(`${input.dateIso}#${reroll}`);
  const idx = seed % bag.length;
  return {
    ok: true,
    pick: bag[idx],
    pool: pool.length,
    weightedPool: bag.length,
  };
}
