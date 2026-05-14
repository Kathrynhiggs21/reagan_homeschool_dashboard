/**
 * Push 155 (2026-05-14) — "Good Morning, Reagan!" daily greeter.
 *
 * Mom's preference (locked-in knowledge):
 *
 *   "The user prefers a daily start-up that is engaging and mood-setting,
 *    rather than traditional 'warm-up' assignments. This could include a
 *    joke, a funny video, or other lighthearted content. The feature
 *    should be named something that evokes a 'good morning happy
 *    message' feeling."
 *
 * So this helper deliberately picks ONE of {joke, fun-fact, riddle,
 * silly-thought, kind-thought} for the day — never a worksheet, never
 * "today's warm-up question", never "let's review yesterday". The pick
 * is deterministic per ISO date + Reagan-name seed so refresh on the
 * same morning shows the same greeting (no slot-machine rerolls).
 *
 * Pure: no DB, no LLM, no clock. Caller passes `dateISO` and gets back
 * a kid-readable string + a tiny metadata block the UI can use to swap
 * the icon (joke = star, fun-fact = sparkles, riddle = magnifier, etc.).
 *
 * Trauma-safe rules honored:
 *   - No timers ("you have 2 minutes to answer").
 *   - No tests ("did you get it right?").
 *   - No "this is a warm-up" framing.
 *   - No greeting that calls out a hard day ("yesterday was rough, but...").
 *   - No comparison ("better than your last try").
 *   - No exclamation-spam — at most one ! per greeting.
 *
 * Future hook: a richer LLM-generated set can be plugged in via
 * `customPool` without changing call sites; deterministic pick logic
 * stays the same.
 */

export type GoodMorningKind =
  | "joke"
  | "fun_fact"
  | "riddle"
  | "silly_thought"
  | "kind_thought";

export interface GoodMorningGreeting {
  kind: GoodMorningKind;
  /** Ready-to-render kid-readable string, "Good morning, Reagan! ..." */
  greeting: string;
  /** The standalone payload (joke text / fun fact / etc.) without the greeting prefix. */
  payload: string;
  /** Optional payoff for jokes + riddles. UI can hide behind a "Tap to see" pill. */
  payoff?: string;
  /** Stable icon hint the UI maps to an emoji / lottie / etc. */
  iconHint:
    | "star"
    | "sparkles"
    | "magnifier"
    | "rainbow"
    | "heart";
  /** Hex tone the UI can use as the card accent (matches kid theme palette). */
  accent: "yellow" | "teal" | "pink" | "purple" | "green";
}

interface PoolEntry {
  kind: GoodMorningKind;
  text: string;
  payoff?: string;
}

// Curated, kid-safe, age-appropriate (5th grade) pool. ~20 of each kind
// so the deterministic pick has 100+ slots to rotate through. Anything
// referencing tests, grades, comparisons, or pressure is rejected.
const DEFAULT_POOL: PoolEntry[] = [
  // Jokes
  { kind: "joke", text: "Why did the math book look sad?", payoff: "It had too many problems." },
  { kind: "joke", text: "What do you call a fish wearing a crown?", payoff: "Your royal Hi-ness." },
  { kind: "joke", text: "Why do bees have sticky hair?", payoff: "Because they use a honeycomb." },
  { kind: "joke", text: "What's a cat's favorite color?", payoff: "Purr-ple." },
  { kind: "joke", text: "Why did the scarecrow win an award?", payoff: "Because he was outstanding in his field." },
  { kind: "joke", text: "What did one ocean say to the other?", payoff: "Nothing — they just waved." },
  { kind: "joke", text: "Why don't eggs tell jokes?", payoff: "They'd crack each other up." },
  { kind: "joke", text: "What did the zero say to the eight?", payoff: "Nice belt." },
  { kind: "joke", text: "Why did the cookie cry?", payoff: "Because its mom was a wafer so long." },
  { kind: "joke", text: "What kind of music do planets like?", payoff: "Nep-tunes." },
  { kind: "joke", text: "What did the left eye say to the right eye?", payoff: "Between you and me, something smells." },
  { kind: "joke", text: "Why did the pencil sit down?", payoff: "It was tired of being on point." },
  { kind: "joke", text: "What do you call cheese that isn't yours?", payoff: "Nacho cheese." },
  { kind: "joke", text: "Why did the bicycle fall over?", payoff: "It was two-tired." },
  { kind: "joke", text: "What's an astronaut's favorite key on the keyboard?", payoff: "The space bar." },
  { kind: "joke", text: "Why was the broom late?", payoff: "It over-swept." },
  { kind: "joke", text: "What did the grape do when it got stepped on?", payoff: "It let out a little wine." },
  { kind: "joke", text: "Why did the banana go to the doctor?", payoff: "It wasn't peeling well." },
  { kind: "joke", text: "What do you call a sleeping bull?", payoff: "A bulldozer." },
  { kind: "joke", text: "Why did the kid bring a ladder to school?", payoff: "Because it was high school." },

  // Fun facts (kid-safe, real, no scary content)
  { kind: "fun_fact", text: "Octopuses have three hearts and blue blood." },
  { kind: "fun_fact", text: "A group of flamingos is called a flamboyance." },
  { kind: "fun_fact", text: "Honey never spoils — jars 3,000 years old are still good." },
  { kind: "fun_fact", text: "Sharks existed before trees did." },
  { kind: "fun_fact", text: "A cloud can weigh more than a million pounds, but still floats." },
  { kind: "fun_fact", text: "Bananas are berries, but strawberries are not." },
  { kind: "fun_fact", text: "Sea otters hold hands when they sleep so they don't drift apart." },
  { kind: "fun_fact", text: "There are more trees on Earth than stars in our galaxy." },
  { kind: "fun_fact", text: "A snail can sleep for three years." },
  { kind: "fun_fact", text: "Cows have best friends and get sad when apart." },
  { kind: "fun_fact", text: "Butterflies taste with their feet." },
  { kind: "fun_fact", text: "Wombat poop is shaped like little cubes." },
  { kind: "fun_fact", text: "An octopus can squeeze through any hole bigger than its beak." },
  { kind: "fun_fact", text: "The shortest war in history lasted only 38 minutes." },
  { kind: "fun_fact", text: "A jiffy is a real unit of time — 1/100th of a second." },
  { kind: "fun_fact", text: "Hummingbirds are the only birds that can fly backwards." },
  { kind: "fun_fact", text: "Bees can recognize human faces." },
  { kind: "fun_fact", text: "There's a type of jellyfish that may be biologically immortal." },
  { kind: "fun_fact", text: "Your nose can remember 50,000 different smells." },
  { kind: "fun_fact", text: "Penguins propose with a pebble." },

  // Riddles
  { kind: "riddle", text: "I have keys but open no locks. I have space but no room. What am I?", payoff: "A keyboard." },
  { kind: "riddle", text: "What has hands but cannot clap?", payoff: "A clock." },
  { kind: "riddle", text: "What gets wetter the more it dries?", payoff: "A towel." },
  { kind: "riddle", text: "What has a head and a tail but no body?", payoff: "A coin." },
  { kind: "riddle", text: "What can travel around the world while staying in a corner?", payoff: "A stamp." },
  { kind: "riddle", text: "What goes up but never comes down?", payoff: "Your age." },
  { kind: "riddle", text: "I have cities, but no houses. I have mountains, but no trees. What am I?", payoff: "A map." },
  { kind: "riddle", text: "What has many teeth but cannot bite?", payoff: "A comb." },
  { kind: "riddle", text: "The more you take, the more you leave behind. What are they?", payoff: "Footsteps." },
  { kind: "riddle", text: "What has one eye but cannot see?", payoff: "A needle." },

  // Silly thoughts (no joke payoff, just fun)
  { kind: "silly_thought", text: "If cats could text, they'd just send 'meow' 47 times in a row." },
  { kind: "silly_thought", text: "Imagine if hiccups were the sound of your stomach laughing at your snack." },
  { kind: "silly_thought", text: "Penguins waddle like they're carrying invisible groceries." },
  { kind: "silly_thought", text: "A turtle is basically a snake that built a tiny house and moved in." },
  { kind: "silly_thought", text: "The first person who looked at a cow and said 'I'll drink whatever comes out of that' was very brave." },
  { kind: "silly_thought", text: "If trees could talk, they'd probably just whisper 'photosynthesis' all day." },
  { kind: "silly_thought", text: "Pigeons walking look like they're nodding to a song only they can hear." },
  { kind: "silly_thought", text: "A whale sneeze is probably the loudest 'bless you' moment on Earth." },
  { kind: "silly_thought", text: "Ducks always look like they have somewhere extremely important to be." },
  { kind: "silly_thought", text: "If you could pet a cloud, it would probably feel like cold cotton candy." },

  // Kind thoughts (mood-setting; never about Reagan-as-subject — generic)
  { kind: "kind_thought", text: "Today gets to be a fresh page. You don't have to fill the whole thing." },
  { kind: "kind_thought", text: "Smart isn't always loud. Sometimes it's just curious." },
  { kind: "kind_thought", text: "Being kind to your past self is part of being smart." },
  { kind: "kind_thought", text: "Hard days end. Easy days come back. Both are real." },
  { kind: "kind_thought", text: "Slow learners and fast learners both end up at 'learner.'" },
  { kind: "kind_thought", text: "You don't have to be in a great mood to start. You just have to start." },
  { kind: "kind_thought", text: "Mistakes are how brains practice. They're supposed to happen." },
  { kind: "kind_thought", text: "Helping someone laugh is its own kind of smart." },
  { kind: "kind_thought", text: "The best part of being you is no one else gets to do it." },
  { kind: "kind_thought", text: "It's okay to take a break. Then it's okay to try again." },
];

const ICON_FOR: Record<GoodMorningKind, GoodMorningGreeting["iconHint"]> = {
  joke: "star",
  fun_fact: "sparkles",
  riddle: "magnifier",
  silly_thought: "rainbow",
  kind_thought: "heart",
};

const ACCENT_FOR: Record<GoodMorningKind, GoodMorningGreeting["accent"]> = {
  joke: "yellow",
  fun_fact: "teal",
  riddle: "purple",
  silly_thought: "pink",
  kind_thought: "green",
};

function hashSeed(input: string): number {
  // Simple, deterministic FNV-1a 32-bit hash so the pick is stable across
  // server restarts. Not cryptographic — picking a daily greeting.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PickGoodMorningOptions {
  /** Override the default pool — useful for tests or future LLM-curated sets. */
  customPool?: PoolEntry[];
  /** Force a specific kind for the day (Mom override). Falls back if pool empty. */
  forceKind?: GoodMorningKind;
  /** Override the kid name in the greeting prefix. */
  kidName?: string;
}

/**
 * Pick the day's greeting. Pure, deterministic, no side effects.
 *
 * Throws on a bad date string so the cron handler / route never falls
 * back to a "Good morning, undefined" rendering.
 */
export function pickGoodMorningGreeting(
  dateISO: string,
  options: PickGoodMorningOptions = {},
): GoodMorningGreeting {
  if (typeof dateISO !== "string" || !ISO_DATE_RE.test(dateISO)) {
    throw new Error(
      `pickGoodMorningGreeting: dateISO must be YYYY-MM-DD, got ${JSON.stringify(dateISO)}`,
    );
  }

  const pool = (options.customPool ?? DEFAULT_POOL).filter((p) =>
    options.forceKind ? p.kind === options.forceKind : true,
  );
  if (pool.length === 0) {
    // Pool was filtered to empty by an exotic forceKind override or an
    // empty customPool — fall back to a soft kind_thought so the route
    // never errors and Reagan still gets a kid-readable greeting.
    return buildGreeting(
      {
        kind: "kind_thought",
        text: "Today gets to be its own day. That's enough.",
      },
      options.kidName ?? "Reagan",
    );
  }

  const seedKey = `${dateISO}|${(options.kidName ?? "Reagan").toLowerCase()}`;
  const idx = hashSeed(seedKey) % pool.length;
  return buildGreeting(pool[idx], options.kidName ?? "Reagan");
}

function buildGreeting(entry: PoolEntry, kidName: string): GoodMorningGreeting {
  const safeName = kidName.trim().replace(/\s+/g, " ").slice(0, 40) || "Reagan";
  // Single ! greeting opener — we don't append another one even if the
  // payload ends with one, to honor the "at most one !" rule for tone.
  const greetingPrefix = `Good morning, ${safeName}!`;
  const greeting = entry.payoff
    ? `${greetingPrefix} ${entry.text}`
    : `${greetingPrefix} ${entry.text}`;

  return {
    kind: entry.kind,
    greeting,
    payload: entry.text,
    payoff: entry.payoff,
    iconHint: ICON_FOR[entry.kind],
    accent: ACCENT_FOR[entry.kind],
  };
}

// Re-exports kept tiny for the test file.
export const __INTERNAL_DEFAULT_POOL_SIZE = DEFAULT_POOL.length;
