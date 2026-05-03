/**
 * Activity Options — weighted ideas surfaced under "This Week" so adults +
 * Reagan can pick a fresh activity that matches her interests, the weather,
 * the time-of-day, and the season. Pure, no DB / network — easy to test.
 *
 * Output: at most 10 ideas, sorted by score descending, ties broken by
 * insertion order. Each idea carries its score + the chips that earned the
 * score so the UI can show "why this idea right now".
 */

export interface ActivityCandidate {
  id: string;
  title: string;
  emoji: string;
  /** Subject slug used by the dashboard's color system. */
  subject: "math" | "science" | "social" | "ela" | "specials" | "other";
  minutes: number;
  /** Tags this candidate cares about. The picker scores against the context. */
  interests?: string[];
  /** "outdoor" | "indoor" — used by weather scoring. */
  setting?: "outdoor" | "indoor" | "either";
  /** Seasons in which this candidate makes sense. Empty = any. */
  seasons?: Array<"spring" | "summer" | "fall" | "winter">;
  /** "morning" | "afternoon" | "evening" — used by time-of-day scoring. */
  timeOfDay?: "morning" | "afternoon" | "evening" | "any";
  /** Description shown under the title. */
  why: string;
}

export interface ActivityContext {
  /** Reagan's interests, e.g. ["birds", "creek", "roblox"]. Lowercased ok. */
  interests: string[];
  /** Outdoor temp in F, or null if unknown. */
  tempF: number | null;
  /** "rain" | "snow" | "clear" | "clouds" | null */
  weather: string | null;
  /** Date used to derive season + weekday + part-of-day. */
  now: Date;
}

export interface ScoredActivity extends ActivityCandidate {
  score: number;
  reasons: string[];
}

export function seasonOf(d: Date): "spring" | "summer" | "fall" | "winter" {
  const m = d.getMonth(); // 0=Jan
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}

export function partOfDay(d: Date): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/**
 * Curated starter pool — meant to be supplemented later by adult-added rows
 * stored in the DB. Each idea declares the dimensions it cares about so the
 * scorer can be tweaked without touching the data.
 */
export const ACTIVITY_POOL: ActivityCandidate[] = [
  {
    id: "creek-bug-hunt",
    title: "Creek bug hunt",
    emoji: "🪲",
    subject: "science",
    minutes: 30,
    interests: ["creek", "bugs", "nature", "outdoors"],
    setting: "outdoor",
    seasons: ["spring", "summer", "fall"],
    timeOfDay: "afternoon",
    why: "Flip 5 rocks. Sketch what you find.",
  },
  {
    id: "bird-window-count",
    title: "Window bird count",
    emoji: "🐦",
    subject: "science",
    minutes: 15,
    interests: ["birds", "animals", "nature"],
    setting: "indoor",
    timeOfDay: "morning",
    why: "10 minutes at the window. Tally each kind you see.",
  },
  {
    id: "budgie-trick",
    title: "Teach Mango a new trick",
    emoji: "🦜",
    subject: "specials",
    minutes: 20,
    interests: ["budgie", "birds", "animals", "mango"],
    setting: "indoor",
    timeOfDay: "any",
    why: "Pick one cue. Reward 5 good tries.",
  },
  {
    id: "kitchen-fractions",
    title: "Kitchen fractions",
    emoji: "🥧",
    subject: "math",
    minutes: 25,
    interests: ["cooking", "baking"],
    setting: "indoor",
    timeOfDay: "afternoon",
    why: "Halve a recipe. Write the new amounts.",
  },
  {
    id: "nature-journal",
    title: "Nature journal page",
    emoji: "📔",
    subject: "ela",
    minutes: 20,
    interests: ["nature", "art", "drawing"],
    setting: "either",
    seasons: ["spring", "summer", "fall"],
    timeOfDay: "any",
    why: "One sketch + 3 sentences about what changed today.",
  },
  {
    id: "bike-distance",
    title: "Measure a bike loop",
    emoji: "🚲",
    subject: "math",
    minutes: 30,
    interests: ["bike", "outdoors", "movement"],
    setting: "outdoor",
    seasons: ["spring", "summer", "fall"],
    timeOfDay: "afternoon",
    why: "Pick a loop. Estimate, then measure with a step counter.",
  },
  {
    id: "rainy-fort-read",
    title: "Build a fort & read",
    emoji: "🏕️",
    subject: "ela",
    minutes: 30,
    interests: ["reading", "books", "cozy"],
    setting: "indoor",
    timeOfDay: "afternoon",
    why: "Cushion fort + a chapter you choose.",
  },
  {
    id: "snow-track-id",
    title: "Track ID in the snow",
    emoji: "❄️",
    subject: "science",
    minutes: 25,
    interests: ["nature", "animals", "snow"],
    setting: "outdoor",
    seasons: ["winter"],
    timeOfDay: "morning",
    why: "Find 3 prints. Photograph + identify.",
  },
  {
    id: "map-walk",
    title: "Map our walk",
    emoji: "🗺️",
    subject: "social",
    minutes: 25,
    interests: ["maps", "outdoors", "geography"],
    setting: "outdoor",
    seasons: ["spring", "summer", "fall"],
    timeOfDay: "afternoon",
    why: "Walk the block. Draw the route on graph paper.",
  },
  {
    id: "roblox-build-budget",
    title: "Roblox build with a budget",
    emoji: "🟦",
    subject: "math",
    minutes: 30,
    interests: ["roblox", "games", "building"],
    setting: "indoor",
    timeOfDay: "evening",
    why: "Build something using exactly 100 parts. Count as you go.",
  },
  {
    id: "library-quest",
    title: "Library quest",
    emoji: "📚",
    subject: "ela",
    minutes: 45,
    interests: ["books", "reading", "library"],
    setting: "indoor",
    timeOfDay: "afternoon",
    why: "Find one book on something you wonder about right now.",
  },
  {
    id: "cloud-watch",
    title: "Cloud watching + name them",
    emoji: "☁️",
    subject: "science",
    minutes: 15,
    interests: ["sky", "weather", "outdoors"],
    setting: "outdoor",
    seasons: ["spring", "summer", "fall"],
    timeOfDay: "afternoon",
    why: "Lay on the grass. Name 3 cloud types you see.",
  },
  {
    id: "podcast-and-walk",
    title: "Podcast + walk",
    emoji: "🎧",
    subject: "social",
    minutes: 25,
    interests: ["audio", "movement", "outdoors"],
    setting: "outdoor",
    timeOfDay: "afternoon",
    why: "Pick a But Why? episode. Walk while you listen.",
  },
  {
    id: "crystals-grow",
    title: "Grow sugar crystals",
    emoji: "💎",
    subject: "science",
    minutes: 20,
    interests: ["crystals", "experiments", "science"],
    setting: "indoor",
    timeOfDay: "evening",
    why: "Start a jar tonight. Check it every day this week.",
  },
];

/**
 * Score a candidate against the live context.
 * Higher is better. Reasons array explains the score for the UI.
 */
function scoreCandidate(c: ActivityCandidate, ctx: ActivityContext): ScoredActivity {
  let score = 0;
  const reasons: string[] = [];

  // Interest match — strongest signal.
  const lowerInterests = (ctx.interests || []).map((s) => s.toLowerCase().trim());
  const matched = (c.interests || []).filter((t) => lowerInterests.includes(t.toLowerCase()));
  if (matched.length > 0) {
    score += matched.length * 4;
    reasons.push(`matches ${matched.slice(0, 2).join(" + ")}`);
  }

  // Weather + setting.
  const cold = ctx.tempF !== null && ctx.tempF < 40;
  const hot = ctx.tempF !== null && ctx.tempF > 88;
  const wet = ctx.weather === "rain" || ctx.weather === "snow";
  const outdoorOK = !cold && !hot && !wet;

  if (c.setting === "outdoor") {
    if (outdoorOK) {
      score += 3;
      reasons.push("good outside today");
    } else {
      score -= 4;
    }
  } else if (c.setting === "indoor") {
    if (!outdoorOK) {
      score += 2;
      reasons.push("cozy indoor");
    } else {
      score += 0; // neutral
    }
  } else {
    score += 1; // either
  }

  // Season match.
  const s = seasonOf(ctx.now);
  if (c.seasons && c.seasons.length) {
    if (c.seasons.includes(s)) {
      score += 2;
      reasons.push(s);
    } else {
      score -= 2; // out of season
    }
  }

  // Time of day match.
  const p = partOfDay(ctx.now);
  if (c.timeOfDay && c.timeOfDay !== "any") {
    if (c.timeOfDay === p) {
      score += 1;
      reasons.push(p);
    }
  }

  // Slight weekday vs weekend tilt: longer activities preferred on weekend.
  const isWeekend = ctx.now.getDay() === 0 || ctx.now.getDay() === 6;
  if (isWeekend && c.minutes >= 30) {
    score += 1;
    reasons.push("weekend ok");
  }
  if (!isWeekend && c.minutes <= 20) {
    score += 1;
  }

  return { ...c, score, reasons };
}

export function pickActivityOptions(
  ctx: ActivityContext,
  pool: ActivityCandidate[] = ACTIVITY_POOL,
  limit = 10,
): ScoredActivity[] {
  const scored = pool.map((c) => scoreCandidate(c, ctx));
  // Stable sort: rely on Array#sort being stable in modern JS engines.
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, Math.min(limit, 10)));
}
