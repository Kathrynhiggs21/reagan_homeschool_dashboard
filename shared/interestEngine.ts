/* ============================================================
 * Interest Engine (Katy 2026-06-19)
 * ----------------------------------------------------------------
 * Pure, deterministic, dependency-free logic that turns raw YouTube
 * signals (liked video titles, subscription channel names, playlist
 * titles, Takeout watch-history rows) into a frequency-weighted
 * interest profile for Reagan.
 *
 * Design principles (Katy's "high-precision radar"):
 *  - REAL signal only. Nothing is invented. If no signals come in,
 *    the profile is empty. We never seed/mocked interests.
 *  - The trusted signal is RECURRENCE: "whatever she keeps coming
 *    back to." Weight grows with how many distinct items map to a
 *    topic, and a recurrence bonus rewards topics that show up a lot.
 *  - Kid-safe + school-useful: we only surface a curated set of
 *    wholesome themes. An unmapped video contributes to no topic
 *    rather than inventing a junk category.
 *
 * This file has NO imports so it can be unit-tested in isolation and
 * shared by both client and server.
 * ============================================================ */

export type InterestSourceKind =
  | "liked"
  | "subscription"
  | "playlist"
  | "watch_history"
  | "manual";

/** A single raw signal: the text we can read + where it came from. */
export interface RawSignal {
  /** Video title, channel name, or playlist title. */
  text: string;
  /** Optional channel name (helps disambiguate generic titles). */
  channel?: string;
  source: InterestSourceKind;
}

/** A curated, kid-safe, school-relevant theme. */
export interface ThemeDef {
  topic: string;            // slug, stable id
  label: string;            // human label
  emoji: string;
  /** Lowercase keyword fragments; matched as word-ish substrings. */
  keywords: string[];
  /** Optional wearable item ids this interest can unlock (kiwiWardrobe). */
  unlocks?: string[];
  /** School subjects this interest naturally bridges to. */
  subjects?: string[];
}

/**
 * The curated theme catalog. Tuned for an 11-year-old who loves
 * animals/nature, art, gaming, and crafty/maker content. Add more
 * over time via the bird-behavior Skill — keep them wholesome.
 */
export const INTEREST_THEMES: ThemeDef[] = [
  {
    topic: "birds", label: "Birds", emoji: "🐦",
    keywords: ["bird", "budgie", "parakeet", "parrot", "cockatiel", "finch", "aviary", "feather", "kiwi bird", "macaw"],
    unlocks: ["wings_butterfly", "flower_crown"], subjects: ["science"],
  },
  {
    topic: "animals", label: "Animals & Pets", emoji: "🐾",
    keywords: ["animal", "puppy", "dog", "cat", "kitten", "bunny", "rabbit", "hamster", "guinea pig", "pet", "zoo", "wildlife", "rescue", "horse", "pony"],
    unlocks: ["ears_cat"], subjects: ["science"],
  },
  {
    topic: "reptiles", label: "Reptiles & Amphibians", emoji: "🦎",
    keywords: ["reptile", "lizard", "bearded dragon", "gecko", "snake", "turtle", "tortoise", "frog", "amphibian", "axolotl"],
    subjects: ["science"],
  },
  {
    topic: "ocean", label: "Ocean & Sea Life", emoji: "🌊",
    keywords: ["ocean", "sea", "shark", "whale", "dolphin", "fish", "aquarium", "coral", "octopus", "marine", "mermaid"],
    unlocks: ["costume_mermaid"], subjects: ["science"],
  },
  {
    topic: "nature", label: "Nature & Outdoors", emoji: "🌳",
    keywords: ["nature", "forest", "hike", "camping", "creek", "river", "garden", "plant", "bug", "insect", "butterfly", "outdoor", "trail", "rocks", "fossil"],
    subjects: ["science"],
  },
  {
    topic: "space", label: "Space & Astronomy", emoji: "🚀",
    keywords: ["space", "planet", "galaxy", "astronaut", "nasa", "rocket", "star", "solar system", "moon", "mars", "universe"],
    unlocks: ["costume_astronaut"], subjects: ["science"],
  },
  {
    topic: "art", label: "Art & Drawing", emoji: "🎨",
    keywords: ["art", "draw", "drawing", "paint", "doodle", "sketch", "watercolor", "how to draw", "coloring", "illustration", "diy art"],
    unlocks: ["wand_star"], subjects: ["art-music"],
  },
  {
    topic: "crafts", label: "Crafts & Making", emoji: "✂️",
    keywords: ["craft", "diy", "slime", "clay", "origami", "perler", "bead", "friendship bracelet", "make", "maker", "papercraft", "sewing"],
    subjects: ["art-music"],
  },
  {
    topic: "music", label: "Music & Dance", emoji: "🎵",
    keywords: ["music", "song", "sing", "dance", "piano", "guitar", "ukulele", "choir", "lyrics", "cover", "karaoke"],
    unlocks: ["headphones"], subjects: ["art-music"],
  },
  {
    topic: "minecraft", label: "Minecraft", emoji: "⛏️",
    keywords: ["minecraft", "mcpe", "redstone", "creeper", "survival mode", "hardcore minecraft"],
    subjects: ["other"],
  },
  {
    topic: "roblox", label: "Roblox", emoji: "🟥",
    keywords: ["roblox", "bloxburg", "adopt me", "brookhaven", "obby", "roblox tycoon"],
    subjects: ["other"],
  },
  {
    topic: "gaming", label: "Gaming", emoji: "🎮",
    keywords: ["gameplay", "gaming", "let's play", "speedrun", "video game", "nintendo", "switch", "stardew", "animal crossing", "mario"],
    subjects: ["other"],
  },
  {
    topic: "cooking", label: "Cooking & Baking", emoji: "🧁",
    keywords: ["bake", "baking", "cook", "cooking", "recipe", "cupcake", "cookie", "kitchen", "dessert", "candy", "mukbang", "food"],
    unlocks: ["chef_hat"], subjects: ["health-pe"],
  },
  {
    topic: "science_experiments", label: "Science Experiments", emoji: "🧪",
    keywords: ["experiment", "science", "stem", "chemistry", "physics", "volcano", "reaction", "lab", "how it works", "engineering"],
    unlocks: ["costume_robot"], subjects: ["science"],
  },
  {
    topic: "sports", label: "Sports", emoji: "⚽",
    keywords: ["soccer", "football", "basketball", "gymnastics", "skateboard", "sport", "trick shot", "swim", "tennis", "dance team"],
    unlocks: ["jersey", "ball"], subjects: ["health-pe"],
  },
  {
    topic: "reading", label: "Books & Stories", emoji: "📚",
    keywords: ["book", "read aloud", "story time", "chapter", "audiobook", "fairy tale", "novel", "library"],
    subjects: ["ela"],
  },
  {
    topic: "history", label: "History & Culture", emoji: "🏛️",
    keywords: ["history", "ancient", "egypt", "pyramid", "knight", "castle", "dinosaur", "prehistoric", "museum", "explorer", "viking"],
    unlocks: ["costume_dino"], subjects: ["social"],
  },
  {
    topic: "geography", label: "Maps & Geography", emoji: "🗺️",
    keywords: ["geography", "country", "map", "travel", "flag", "world", "city tour", "national park", "states"],
    subjects: ["social"],
  },
  {
    topic: "fashion", label: "Fashion & Style", emoji: "👗",
    keywords: ["fashion", "outfit", "style", "haul", "lookbook", "makeover", "dress up", "thrift", "accessories", "nails"],
    unlocks: ["dress", "claw_clip"], subjects: ["art-music"],
  },
  {
    topic: "magic", label: "Fantasy & Magic", emoji: "🦄",
    keywords: ["unicorn", "fairy", "magic", "wizard", "dragon", "fantasy", "mythical", "enchanted", "princess"],
    unlocks: ["costume_unicorn", "tiara"], subjects: ["ela"],
  },
];

const THEME_BY_TOPIC: Record<string, ThemeDef> = Object.fromEntries(
  INTEREST_THEMES.map((t) => [t.topic, t]),
);

export function getTheme(topic: string): ThemeDef | undefined {
  return THEME_BY_TOPIC[topic];
}

/** Normalize a string for matching: lowercase, collapse whitespace. */
function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Match a single signal's text+channel against the theme catalog.
 * Returns the set of matched topics (a video can hit several themes,
 * e.g. "How to draw a parrot" → art + birds). Deduped per signal so a
 * single video can only count ONCE toward a given topic's hit count.
 */
export function topicsForSignal(sig: RawSignal): string[] {
  const hay = norm(sig.text) + " " + norm(sig.channel || "");
  if (!hay.trim()) return [];
  const hits = new Set<string>();
  for (const theme of INTEREST_THEMES) {
    for (const kw of theme.keywords) {
      if (hay.includes(kw)) { hits.add(theme.topic); break; }
    }
  }
  return Array.from(hits);
}

/** Per-source base weight. Subscriptions + likes are deliberate acts. */
const SOURCE_WEIGHT: Record<InterestSourceKind, number> = {
  subscription: 5,   // following a channel = strong, durable signal
  liked: 4,          // a deliberate thumbs-up
  playlist: 3,       // curated into a list
  watch_history: 1,  // a single view is the weakest signal
  manual: 6,         // an adult explicitly added it
};

export interface InterestTally {
  topic: string;
  label: string;
  emoji: string;
  /** Frequency-weighted score. */
  weight: number;
  /** Number of distinct signals that mapped to this topic. */
  hits: number;
  /** Up to a handful of example titles/channels. */
  samples: string[];
  /** Wearable ids this interest can unlock. */
  unlocks: string[];
  subjects: string[];
}

/**
 * Aggregate raw signals into a ranked interest profile.
 *
 * Weighting:
 *   topicWeight = Σ(sourceWeight per matching signal)
 *               + recurrenceBonus(hits)
 * recurrenceBonus rewards "keeps coming back to it": +2 per hit beyond
 * the first, capped, so a topic seen 8 times clearly outranks one seen
 * once even if the one-off came from a heavier source.
 */
export function buildInterestProfile(signals: RawSignal[]): InterestTally[] {
  const tally = new Map<string, InterestTally>();

  for (const sig of signals) {
    const topics = topicsForSignal(sig);
    for (const topic of topics) {
      const theme = THEME_BY_TOPIC[topic];
      if (!theme) continue;
      let entry = tally.get(topic);
      if (!entry) {
        entry = {
          topic, label: theme.label, emoji: theme.emoji,
          weight: 0, hits: 0, samples: [],
          unlocks: theme.unlocks ? [...theme.unlocks] : [],
          subjects: theme.subjects ? [...theme.subjects] : [],
        };
        tally.set(topic, entry);
      }
      entry.hits += 1;
      entry.weight += SOURCE_WEIGHT[sig.source] ?? 1;
      const sample = (sig.text || sig.channel || "").trim();
      if (sample && entry.samples.length < 6 && !entry.samples.includes(sample)) {
        entry.samples.push(sample);
      }
    }
  }

  // Recurrence bonus: the heart of "whatever she keeps coming back to".
  for (const entry of Array.from(tally.values())) {
    const extra = Math.max(0, entry.hits - 1);
    entry.weight += Math.min(extra * 2, 40); // cap so one topic can't run away
  }

  return Array.from(tally.values()).sort((a, b) =>
    b.weight - a.weight || b.hits - a.hits || a.label.localeCompare(b.label),
  );
}

/**
 * Merge freshly-tallied signals into an existing stored profile (the
 * accumulation step the DB layer persists). Existing weight/hits are
 * preserved and added to, so interest grows OVER TIME across syncs.
 */
export interface StoredInterest {
  topic: string;
  label: string;
  weight: number;
  hits: number;
  samples: string[];
}

export function mergeIntoStored(
  existing: StoredInterest[],
  fresh: InterestTally[],
): StoredInterest[] {
  const byTopic = new Map<string, StoredInterest>();
  for (const e of existing) byTopic.set(e.topic, { ...e, samples: [...(e.samples || [])] });

  for (const f of fresh) {
    const cur = byTopic.get(f.topic);
    if (cur) {
      cur.weight += f.weight;
      cur.hits += f.hits;
      for (const s of f.samples) {
        if (cur.samples.length < 8 && !cur.samples.includes(s)) cur.samples.push(s);
      }
    } else {
      byTopic.set(f.topic, {
        topic: f.topic, label: f.label, weight: f.weight, hits: f.hits, samples: [...f.samples],
      });
    }
  }

  return Array.from(byTopic.values()).sort((a, b) =>
    b.weight - a.weight || b.hits - a.hits || a.label.localeCompare(b.label),
  );
}

/** Top-N interest labels for feeding profile.interests / Kiwi chatter. */
export function topInterestLabels(profile: StoredInterest[], n = 6): string[] {
  return profile.slice(0, n).map((p) => p.label);
}

/** Wearable ids unlocked by the top interests (deduped). */
export function unlockedWearables(profile: StoredInterest[], n = 8): string[] {
  const out = new Set<string>();
  for (const p of profile.slice(0, n)) {
    const theme = THEME_BY_TOPIC[p.topic];
    for (const u of theme?.unlocks || []) out.add(u);
  }
  return Array.from(out);
}

/**
 * Parse a Google Takeout watch-history.json into RawSignals.
 * Takeout shape (the "YouTube and YouTube Music > history > watch-history"
 * export) is an array of rows like:
 *   { "title": "Watched How to draw a budgie", "subtitles": [{ "name": "Art Channel" }], ... }
 * Ad rows and removed/private videos are skipped. Tolerant of partial rows.
 */
export function parseTakeoutWatchHistory(json: unknown): RawSignal[] {
  if (!Array.isArray(json)) return [];
  const out: RawSignal[] = [];
  for (const row of json as any[]) {
    if (!row || typeof row !== "object") continue;
    // Skip ads & non-watch activity.
    if (row.details && Array.isArray(row.details) &&
        row.details.some((d: any) => /From Google Ads/i.test(d?.name || ""))) continue;
    let title: string = typeof row.title === "string" ? row.title : "";
    // Strip the leading "Watched " / "Watched a video that has been removed"
    if (/has been removed|watched a video that/i.test(title)) continue;
    title = title.replace(/^Watched\s+/i, "").trim();
    if (!title) continue;
    const channel = Array.isArray(row.subtitles) && row.subtitles[0]?.name
      ? String(row.subtitles[0].name) : undefined;
    out.push({ text: title, channel, source: "watch_history" });
  }
  return out;
}

/* ------------------------------------------------------------
 * Kiwi interest chatter (Katy 2026-06-19)
 * Warm, low-key one-liners where Kiwi name-drops something Reagan
 * keeps coming back to. NEVER school-pushy, never nagging. Tone
 * matches Kiwi's "calm older cousin" voice — no forced slang.
 * Returns null when there's no known interest (so chatter stays
 * silent rather than inventing one).
 * ------------------------------------------------------------ */
const INTEREST_CHATTER_TEMPLATES: string[] = [
  "saw you're big on {label} lately. respect.",
  "you really keep coming back to {label}, huh.",
  "{label} again? okay, i see you.",
  "if it's {label}, i'm in.",
  "your whole {label} thing is kind of awesome.",
  "noticed {label} is your lane right now.",
];

/** Deterministic-enough chatter picker; null when no interest given. */
export function pickInterestChatter(label: string | null | undefined, seed = Math.random()): string | null {
  const clean = (label || "").trim();
  if (!clean) return null;
  const tpl = INTEREST_CHATTER_TEMPLATES[Math.floor(seed * INTEREST_CHATTER_TEMPLATES.length) % INTEREST_CHATTER_TEMPLATES.length];
  return tpl.replace("{label}", clean.toLowerCase());
}
