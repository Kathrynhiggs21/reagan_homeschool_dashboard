/**
 * Practice for Coins — curated extra-credit drill library.
 *
 * Each drill is a short (5–15 min) self-directed activity with a direct,
 * one-click URL into Khan Academy / IXL / BrainPOP / etc. Reagan can earn
 * Kiwi Coins for completing them OUTSIDE school hours (mornings, evenings,
 * weekends) so they stay a treat instead of replacing scheduled work.
 *
 * This file is data-only + tiny pure helpers, so it can be imported by both
 * the tRPC router and the vitests without pulling in DB/LLM clients.
 */
export type PracticeSubject = "math" | "ela" | "science" | "social" | "spelling";

export interface PracticeDrill {
  /** Stable slug used as the ledger reason key + URL fragment. */
  slug: string;
  title: string;
  subject: PracticeSubject;
  /** Human-readable topic label (e.g. "Long division", "Order of operations"). */
  topic: string;
  /** Direct one-click URL — opens in a new tab. */
  url: string;
  /** Provider name, just for the chip badge in the UI. */
  provider: "Khan Academy" | "IXL" | "BrainPOP" | "Vocabulary.com" | "Blooket" | "SpellingCity" | "ABCya" | "Coolmath";
  /** ~How long it takes (minutes). Used for sorting + cap-aware messaging. */
  minutes: number;
  /** Coins paid out on completion (kid taps "I finished it!" after the timer). */
  coins: number;
  /** One-line "what you'll do" hint for the card. */
  blurb: string;
  /** Tag list for search/filter. */
  tags?: string[];
}

export const PRACTICE_LIBRARY: PracticeDrill[] = [
  // ── Math ─────────────────────────────────────────────────────────────────
  {
    slug: "khan-multi-digit-mult",
    title: "Multi-digit multiplication",
    subject: "math",
    topic: "Multiplication",
    url: "https://www.khanacademy.org/math/cc-fifth-grade-math/imp-multi-digit-multiplication-and-division-2",
    provider: "Khan Academy",
    minutes: 10,
    coins: 3,
    blurb: "Practice 4–6 multi-digit problems with worked examples.",
    tags: ["math", "multiplication"],
  },
  {
    slug: "khan-long-division",
    title: "Long division warm-up",
    subject: "math",
    topic: "Division",
    // 2026-06-29 — the deep `/e/division_2` exercise slug renders Khan's
    // in-app "this content isn't here" shell (HTTP 200 but no exercise).
    // Pointed at the stable division unit root, which always loads.
    url: "https://www.khanacademy.org/math/cc-fifth-grade-math/imp-multi-digit-multiplication-and-division-2",
    provider: "Khan Academy",
    minutes: 10,
    coins: 3,
    blurb: "Walk through 4–5 long-division problems step by step.",
    tags: ["math", "division"],
  },
  {
    slug: "khan-order-of-operations",
    title: "Order of operations (PEMDAS)",
    subject: "math",
    topic: "Order of operations",
    url: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-arithmetic-operations/cc-5th-order-of-operations/e/order_of_operations_2",
    provider: "Khan Academy",
    minutes: 8,
    coins: 2,
    blurb: "5 mixed PEMDAS problems with parentheses + exponents.",
    tags: ["math", "pemdas"],
  },
  {
    slug: "khan-fractions-add",
    title: "Add & subtract fractions",
    subject: "math",
    topic: "Fractions",
    url: "https://www.khanacademy.org/math/cc-fifth-grade-math/imp-fractions-2",
    provider: "Khan Academy",
    minutes: 12,
    coins: 4,
    blurb: "Find common denominators on real-world fractions.",
    tags: ["math", "fractions"],
  },
  {
    slug: "ixl-decimals-place",
    title: "Decimal place value",
    subject: "math",
    topic: "Decimals",
    url: "https://www.ixl.com/math/grade-5/place-values-in-decimal-numbers",
    provider: "IXL",
    minutes: 8,
    coins: 2,
    blurb: "Identify tenths, hundredths, thousandths.",
    tags: ["math", "decimals"],
  },
  {
    slug: "coolmath-times-tables",
    title: "Times-tables sprint",
    subject: "math",
    topic: "Multiplication facts",
    url: "https://www.coolmathgames.com/",
    provider: "Coolmath",
    minutes: 5,
    coins: 2,
    blurb: "Beat-the-clock fact practice — silly and fast.",
    tags: ["math", "facts"],
  },
  {
    slug: "blooket-math-mix",
    title: "Blooket math mix",
    subject: "math",
    topic: "Mixed review",
    url: "https://dashboard.blooket.com/sets",
    provider: "Blooket",
    minutes: 10,
    coins: 3,
    blurb: "Pick any 5th-grade math set and play one round.",
    tags: ["math", "review", "game"],
  },

  // ── ELA ──────────────────────────────────────────────────────────────────
  {
    slug: "vocabcom-5",
    title: "Vocabulary.com — 5 words",
    subject: "ela",
    topic: "Vocabulary",
    url: "https://www.vocabulary.com/lists",
    provider: "Vocabulary.com",
    minutes: 7,
    coins: 2,
    blurb: "Earn 5 word checkmarks on a 5th-grade list.",
    tags: ["ela", "vocab"],
  },
  {
    slug: "khan-reading-main-idea",
    title: "Main-idea practice",
    subject: "ela",
    topic: "Reading comprehension",
    // 2026-06-29 — the hashed `x96f...:...-stories` sub-path is unstable after
    // Khan's ELA reorg. Pointed at the stable 5th-grade reading+vocab course
    // root (confirmed 200, renders content).
    url: "https://www.khanacademy.org/ela/cc-5th-reading-vocab",
    provider: "Khan Academy",
    minutes: 12,
    coins: 4,
    blurb: "Read a short passage, pick the best summary.",
    tags: ["ela", "reading"],
  },
  {
    slug: "ixl-grammar-clauses",
    title: "Clauses & sentence types",
    subject: "ela",
    topic: "Grammar",
    url: "https://www.ixl.com/ela/grade-5/identify-dependent-and-independent-clauses",
    provider: "IXL",
    minutes: 8,
    coins: 2,
    blurb: "Spot independent vs. dependent clauses.",
    tags: ["ela", "grammar"],
  },
  {
    slug: "ixl-figurative-language",
    title: "Figurative language",
    subject: "ela",
    topic: "Figurative language",
    url: "https://www.ixl.com/ela/grade-5/identify-similes-and-metaphors",
    provider: "IXL",
    minutes: 8,
    coins: 2,
    blurb: "Similes, metaphors, idioms — find them in sentences.",
    tags: ["ela", "writing"],
  },

  // ── Spelling ─────────────────────────────────────────────────────────────
  {
    slug: "spellingcity-grade5",
    title: "SpellingCity — Grade 5 list",
    subject: "spelling",
    topic: "Weekly spelling",
    url: "https://www.spellingcity.com/",
    provider: "SpellingCity",
    minutes: 8,
    coins: 3,
    blurb: "Play one round of HangMouse or Audio Word Match.",
    tags: ["spelling"],
  },
  {
    slug: "abcya-spelling-bee",
    title: "ABCya Spelling Bee",
    subject: "spelling",
    topic: "Spelling bee practice",
    url: "https://www.abcya.com/games/spelling_bee",
    provider: "ABCya",
    minutes: 10,
    coins: 3,
    blurb: "Type words you hear — keep your streak alive.",
    tags: ["spelling", "audio"],
  },
  {
    slug: "vocabcom-spelling",
    title: "Vocabulary.com Spell-it",
    subject: "spelling",
    topic: "Word patterns",
    url: "https://www.vocabulary.com/lists",
    provider: "Vocabulary.com",
    minutes: 7,
    coins: 2,
    blurb: "Use Spell-it mode on the 5th-grade word list.",
    tags: ["spelling", "vocab"],
  },

  // ── Science ──────────────────────────────────────────────────────────────
  {
    slug: "brainpop-ecosystems",
    title: "BrainPOP — Ecosystems",
    subject: "science",
    topic: "Ecosystems",
    url: "https://www.brainpop.com/topic/ecosystems/",
    provider: "BrainPOP",
    minutes: 12,
    coins: 4,
    blurb: "Watch the short video, take the easy quiz.",
    tags: ["science", "biology"],
  },
  {
    slug: "brainpop-water-cycle",
    title: "BrainPOP — Water cycle",
    subject: "science",
    topic: "Earth science",
    url: "https://www.brainpop.com/topic/water-cycle/",
    provider: "BrainPOP",
    minutes: 10,
    coins: 3,
    blurb: "Refresher video + 10-question quiz.",
    tags: ["science", "earth"],
  },
  {
    slug: "khan-states-of-matter",
    title: "States of matter",
    subject: "science",
    topic: "Physical science",
    url: "https://www.khanacademy.org/science/middle-school-physics/x11e4ee3527c4d2a4:matter/x11e4ee3527c4d2a4:states-of-matter/v/states-of-matter-basic",
    provider: "Khan Academy",
    minutes: 10,
    coins: 3,
    blurb: "Solid, liquid, gas, plasma — quick practice set.",
    tags: ["science", "physics"],
  },

  // ── Social Studies ───────────────────────────────────────────────────────
  {
    slug: "brainpop-us-states",
    title: "BrainPOP — Map of the US",
    subject: "social",
    topic: "US Geography",
    url: "https://www.brainpop.com/socialstudies/ushistory/",
    provider: "BrainPOP",
    minutes: 10,
    coins: 3,
    blurb: "Refresher on regions + state capitals quiz.",
    tags: ["social", "geography"],
  },
  {
    slug: "khan-us-history-13",
    title: "13 colonies overview",
    subject: "social",
    topic: "US History",
    url: "https://www.khanacademy.org/humanities/us-history/colonial-america",
    provider: "Khan Academy",
    minutes: 12,
    coins: 4,
    blurb: "Read the intro, answer 4–5 short questions.",
    tags: ["social", "history"],
  },
  {
    slug: "ixl-social-econ",
    title: "Goods, services, & needs",
    subject: "social",
    topic: "Economics",
    url: "https://www.ixl.com/social-studies/grade-5/identify-goods-and-services",
    provider: "IXL",
    minutes: 7,
    coins: 2,
    blurb: "Sort everyday items into goods vs. services.",
    tags: ["social", "economics"],
  },
];

/* ────────────────────── Pure helpers (unit-tested) ────────────────────── */

export const SUBJECT_LABELS: Record<PracticeSubject, string> = {
  math: "Math",
  ela: "ELA / Reading",
  science: "Science",
  social: "Social Studies",
  spelling: "Spelling",
};

export const SUBJECT_EMOJI: Record<PracticeSubject, string> = {
  math: "🧮",
  ela: "📖",
  science: "🔬",
  social: "🌎",
  spelling: "✏️",
};

/** Group drills by subject in a stable order. */
export function groupBySubject(
  library: PracticeDrill[] = PRACTICE_LIBRARY,
): Array<{ subject: PracticeSubject; label: string; emoji: string; topics: Array<{ topic: string; drills: PracticeDrill[] }> }> {
  const order: PracticeSubject[] = ["math", "ela", "spelling", "science", "social"];
  return order
    .map((subject) => {
      const drills = library.filter((d) => d.subject === subject);
      const byTopic = new Map<string, PracticeDrill[]>();
      for (const d of drills) {
        const list = byTopic.get(d.topic) || [];
        list.push(d);
        byTopic.set(d.topic, list);
      }
      const topics = Array.from(byTopic.entries()).map(([topic, ds]) => ({ topic, drills: ds }));
      return {
        subject,
        label: SUBJECT_LABELS[subject],
        emoji: SUBJECT_EMOJI[subject],
        topics,
      };
    })
    .filter((g) => g.topics.length > 0);
}

/** Look up one drill by slug. Returns null when unknown. */
export function findDrill(slug: string): PracticeDrill | null {
  return PRACTICE_LIBRARY.find((d) => d.slug === slug) || null;
}

/**
 * Practice for Coins is OUTSIDE school hours only (so it stays a treat
 * instead of replacing scheduled work). School hours = Mon–Fri 9:00–14:00.
 *
 * Pure function — pass the date in so tests don't depend on real time.
 */
export function isOutsideSchoolHours(now: Date): boolean {
  const day = now.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return true; // weekends always allowed
  const hour = now.getHours();
  // Earned-time window: before 9 AM or 2 PM onwards on weekdays.
  return hour < 9 || hour >= 14;
}

/** Daily coin cap so the hub doesn't replace prizes. */
export const PRACTICE_DAILY_COIN_CAP = 12;

/**
 * Decide how many coins this completion actually pays out, given how many
 * coins have already been earned from practice today + the drill's reward.
 * Returns 0 (with a reason) if the kid hit the cap or it's school hours.
 */
export function computePayout(
  drill: PracticeDrill,
  alreadyEarnedToday: number,
  now: Date,
): { coins: number; capped: boolean; outsideHours: boolean; reason?: string } {
  const outsideHours = isOutsideSchoolHours(now);
  if (!outsideHours) {
    return {
      coins: 0,
      capped: false,
      outsideHours: false,
      reason: "Practice for Coins is open before 9 AM and after 2 PM (and any time on weekends).",
    };
  }
  const remaining = Math.max(0, PRACTICE_DAILY_COIN_CAP - Math.max(0, alreadyEarnedToday));
  if (remaining <= 0) {
    return {
      coins: 0,
      capped: true,
      outsideHours: true,
      reason: `You've already earned today's max of ${PRACTICE_DAILY_COIN_CAP} coins from extra practice. Come back tomorrow!`,
    };
  }
  return {
    coins: Math.min(drill.coins, remaining),
    capped: drill.coins > remaining,
    outsideHours: true,
  };
}
