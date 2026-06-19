/**
 * Kiwi Character Engine (2026-06-17, Katy request)
 * =================================================
 * Kiwi is Reagan's parakeet bestie — FEMALE (she/her). She reacts to what's
 * actually happening on a given day: holidays, vacations, friend-bird visits,
 * and Reagan's real calendar events (soccer -> jersey, doctor -> lab coat,
 * etc.). She has a sarcastic, joke-y tween voice (sus / slay / lowkey / no cap
 * / it's giving / bestie / fr) tuned for an 11-year-old girl, and a big bank of
 * funny idle bits. She loves what Reagan loves: animals/pets most of all, plus
 * Minecraft, Roblox, hula hoop, her phone, and Reagan's favorite TV show.
 *
 * This module is PURE and DETERMINISTIC: given the same date + context it
 * returns the same outfit + lines, so Kiwi never flickers her costume on every
 * render. It is shared between client (visuals) and server (greetings/email).
 *
 * Nothing here touches the DOM, network, or Date.now() — callers pass an ISO
 * date string and a context object. That keeps it trivially unit-testable.
 */

/* ----------------------------- Types ------------------------------------- */

export type KiwiCostume =
  | "none"          // everyday — no costume
  | "jersey"        // soccer practice / game
  | "labcoat"       // doctor / dentist / checkup
  | "cast"          // injury / cast / hurt
  | "swim"          // swim / pool / goggles
  | "partyhat"      // birthday
  | "vacation"      // travel / trip / vacation — sunglasses + suitcase
  | "showfan"       // Reagan's favorite TV show — themed tee + fan banner
  | "minecraft"     // Minecraft day / reward
  | "roblox"        // Roblox day / reward
  | "hoop"          // hula hoop
  | "cleaning"      // tidy / chores / clean up
  // Holidays
  | "santa"         // Christmas
  | "witch"         // Halloween
  | "bunny"         // Easter
  | "leprechaun"    // St. Patrick's
  | "pilgrim"       // Thanksgiving
  | "firework"      // July 4th / New Year
  | "heart"         // Valentine's
  | "turkey-day"    // alias kept for clarity (uses pilgrim visuals)
  ;

export interface KiwiDayCharacter {
  /** ISO date this character was resolved for (YYYY-MM-DD). */
  date: string;
  /** Chosen costume id (drives the CSS overlay on the sprite). */
  costume: KiwiCostume;
  /** Short human label for the costume (tooltip / aria). */
  costumeLabel: string;
  /** A friend bird is visiting today (Lychee / Blue / Daffy / Honk), or null. */
  guestBird: "lychee" | "blue" | "daffy" | "honk" | null;
  /** Today's headline funny line in Kiwi's voice (deterministic per day). */
  funnyLine: string;
  /** A short idle bubble line (rotates through the bank). */
  idleLine: string;
  /** Why this costume was picked — for debugging / adult tooltip. */
  reason:
    | "calendar-event"
    | "holiday"
    | "vacation"
    | "reagan-love"
    | "everyday";
  /** True when Reagan is on a break/vacation today. */
  onVacation: boolean;
}

export interface KiwiContext {
  /** Event titles happening today (from appointments / calendar). */
  eventTitles?: string[];
  /** True if today is a declared vacation / break day. */
  onVacation?: boolean;
  /** True if a friend bird is explicitly visiting (e.g. a "bird visit" event). */
  birdVisit?: boolean;
  /** Editable label for Reagan's favorite show (default below). */
  favoriteShowLabel?: string;
  /** Reagan's first name for personalized lines. */
  studentName?: string;
}

/* --------------------- Editable favorite-show label ----------------------- */
/**
 * Katy can change this in one spot. Default kept generic so it's correct
 * whether the show is CBS "Tracker" or anything else.
 */
export const DEFAULT_FAVORITE_SHOW = "Tracker"; // Katy: edit this one line to change Reagan's favorite show

/* ------------------------ Costume keyword mapping ------------------------- */
/**
 * Ordered list: the FIRST matching rule wins, so put the most specific /
 * highest-priority keywords first. Injury beats doctor; doctor beats generic.
 * Katy can edit these arrays freely.
 */
export interface CostumeRule {
  costume: KiwiCostume;
  label: string;
  keywords: string[];
}

export const COSTUME_RULES: CostumeRule[] = [
  { costume: "cast",     label: "Kiwi has a little cast (get well soon!)", keywords: ["cast", "injury", "injured", "hurt", "broken", "sprain", "stitches", "x-ray", "xray", "urgent care", "er visit"] },
  { costume: "labcoat",  label: "Doctor Kiwi, reporting for duty",        keywords: ["doctor", "dr.", "dentist", "ortho", "checkup", "check-up", "physical", "appointment", "appt", "vaccine", "shot", "clinic", "pediatric"] },
  { costume: "swim",     label: "Kiwi's got her goggles on",              keywords: ["swim", "pool", "dive", "lifeguard", "water park", "splash"] },
  { costume: "jersey",   label: "Kiwi suited up for soccer",              keywords: ["soccer", "practice", "game", "match", "scrimmage", "tournament", "team", "coach"] },
  { costume: "hoop",     label: "Kiwi's hula hooping (sort of)",          keywords: ["hula", "hoop"] },
  { costume: "minecraft",label: "Kiwi went full Minecraft",               keywords: ["minecraft", "creeper", "redstone"] },
  { costume: "roblox",   label: "Kiwi's in Roblox mode",                  keywords: ["roblox"] },
  { costume: "showfan",  label: "Kiwi is the #1 fan",                     keywords: ["tracker", "show", "tv night", "premiere", "episode", "finale", "binge"] },
  { costume: "cleaning", label: "Kiwi's tidying up (mostly making a mess)",keywords: ["clean", "tidy", "chores", "laundry", "organize", "declutter"] },
  { costume: "partyhat", label: "Party Kiwi!",                            keywords: ["birthday", "bday", "party", "celebrate", "celebration"] },
  { costume: "vacation", label: "Vacation Kiwi (do not disturb)",         keywords: ["vacation", "trip", "travel", "flight", "airport", "beach", "cabin", "disney", "road trip", "hotel"] },
];

/* ---------------------------- Holiday rules ------------------------------- */
/**
 * Fixed-date and a couple of computed holidays. Returns a costume + label, or
 * null if the date isn't a known holiday. Month is 1-12, day is 1-31.
 */
export function resolveHoliday(month: number, day: number): { costume: KiwiCostume; label: string } | null {
  // Fixed-date holidays
  if (month === 12 && day >= 20 && day <= 26) return { costume: "santa", label: "Santa Kiwi, ho ho ho" };
  if (month === 12 && day === 31) return { costume: "firework", label: "New Year Kiwi!" };
  if (month === 1 && day === 1) return { costume: "firework", label: "Happy New Year from Kiwi" };
  if (month === 2 && day === 14) return { costume: "heart", label: "Valentine Kiwi (be mine, bestie)" };
  if (month === 3 && day === 17) return { costume: "leprechaun", label: "Lucky Kiwi" };
  if (month === 7 && day === 4) return { costume: "firework", label: "Star-Spangled Kiwi" };
  if (month === 10 && day >= 28 && day <= 31) return { costume: "witch", label: "Spooky Witch Kiwi" };
  return null;
}

/* ----------------------------- Content bank ------------------------------- */
/**
 * Kiwi's voice: sarcastic, joke-y, kind. Tween slang sprinkled in. NEVER mean
 * to Reagan — she roasts homework, Mondays, and herself, not Reagan. Aimed at
 * an 11-year-old girl. Animals/pets are her #1 love.
 */

// Everyday idle one-liners (the big general bank).
export const KIWI_IDLE_LINES: string[] = [
  "lowkey just vibing on this card, don't mind me.",
  "this homework? sus. but you got it, bestie.",
  "I'd help but I have tiny wings and zero thumbs. tragic.",
  "ok that answer was kinda slay, not gonna lie.",
  "me, a bird, judging your handwriting? respectfully, yes.",
  "brb pretending I understand fractions.",
  "it's giving 'main character does her homework.' iconic.",
  "no cap, you're smarter than you think.",
  "I napped for 0.4 seconds and missed everything. recap?",
  "fun fact: I have a bird brain and I STILL believe in you.",
  "if I had a coin for every smart thing you did... wait, you DO get coins. lucky.",
  "she's focused. she's grinding. she's literally that girl.",
  "I just preened for ten minutes. self-care, bestie.",
  "I tried to read your screen but I got distracted by a crumb.",
  "lowkey this is the most productive perch I've ever sat on.",
  "you + this assignment = a love-hate situationship. relatable.",
  "I believe in you more than I believe in my own flying skills, fr.",
  "ok genius hours, let's gooo.",
  "I'm not saying you're crushing it, but you're crushing it.",
  "I'd give you a high-five but, you know. wings.",
];

// The (in)famous bird bit. Tasteful, silly, never gross.
export const KIWI_POOP_LINES: string[] = [
  "oop— I pooped. it's a bird thing, don't make it weird.",
  "breaking news: local parakeet poops, more at never.",
  "I'd say excuse me but honestly? worth it.",
  "that's not on your worksheet, that's mine. my bad.",
  "every 15 minutes, baby. it's called being a bird.",
];

// Pet / animal bits (Reagan's #1 love).
export const KIWI_PET_LINES: string[] = [
  "ok but if you finish this, we can talk about puppies for an HOUR.",
  "animals > everything. except maybe snacks. it's close.",
  "I'm basically a tiny dinosaur with a great personality. respect it.",
  "did you know otters hold hands so they don't float away? I'm emotional.",
  "I'd adopt every animal at the shelter if I had hands. and a house. and money.",
  "fun bird fact: I could talk about animals forever. forever, bestie.",
];

// Minecraft / Roblox / phone / hula hoop bits.
export const KIWI_GAMER_LINES: string[] = [
  "finish this and it's giving 'earned Minecraft time,' fr.",
  "I tried to mine diamonds with my beak. it did not go well.",
  "Roblox later? say less. but homework first, bestie.",
  "I'd build you a castle in Minecraft but a creeper keeps following me. sus.",
  "you've been on your phone for— jk jk, I'm not your mom. (I'm a bird.)",
  "I just learned to hula hoop. I have no waist. it was a disaster. slay anyway.",
];

// Costume-specific reaction lines, keyed by costume id. Picked when she's
// wearing that costume so the line matches the look.
export const KIWI_COSTUME_LINES: Partial<Record<KiwiCostume, string[]>> = {
  jersey: [
    "soccer day! I'm goalie. the goal is, uh, that crumb over there.",
    "I did one (1) push-up and called it training. athlete behavior.",
    "GOOOAL— oh wait that was just me falling off the branch.",
  ],
  labcoat: [
    "Doctor Kiwi says: drink water and stop biting your pencil.",
    "diagnosis: you're gonna be totally fine, bestie. that'll be 3 coins.",
    "I went to bird med school. it was one worm and a nap.",
  ],
  cast: [
    "I have a tiny cast in solidarity. we heal together, bestie.",
    "rest up! I'll do all your flying for you. (I won't, I'm lazy.)",
    "ouch energy today. be gentle with yourself, fr.",
  ],
  swim: [
    "pool day! parakeets can't really swim but the goggles are a SERVE.",
    "cannonball!! ...from the edge of this card. tiny splash.",
    "I'm basically a lifeguard. of this desk. you're safe.",
  ],
  partyhat: [
    "HAPPY BIRTHDAY!! I made a cake. it's a sunflower seed. enjoy.",
    "it's giving birthday queen. blow out the candles, bestie!",
    "party hat ON. emotional support bird ACTIVATED.",
  ],
  vacation: [
    "vacation mode: I packed three sunflower seeds and a tiny attitude.",
    "no homework on vacay, that's the law. (I made it up. it's the law.)",
    "she's on a trip and she's THRIVING. iconic.",
  ],
  showfan: [
    "it's show night and I am the #1 fan, no cap.",
    "I made a banner. I cannot read. it just says good things, trust.",
    "main character energy, just like your fave on the show.",
  ],
  minecraft: [
    "blocky mode: ON. do not let the creeper near my nest.",
    "I crafted a pickaxe out of a twig. it broke. classic.",
    "diamonds are cool but have you tried... snacks.",
  ],
  roblox: [
    "Roblox Kiwi has entered the game. oof.",
    "I'd give you Robux but I'm a bird with no job, bestie.",
    "avatar's drippy, homework's done? that's the dream.",
  ],
  hoop: [
    "hula hoop update: I have no waist and I'm still trying. slay.",
    "round and round and— ok I'm dizzy. worth it though.",
    "you JUST started hooping and you're already better than me, fr.",
  ],
  cleaning: [
    "I'm 'cleaning.' (I moved one twig and got tired.)",
    "tidy desk, tidy bird brain. or something. who said that. me.",
    "I organized your pencils by vibes. you're welcome.",
  ],
  santa: ["ho ho ho, it's giving holiday. did you finish your list AND your homework?", "Santa Kiwi is watching. mostly for snacks."],
  witch: ["spooky season! the only scary thing here is this word problem.", "boo! ...did I get you? no? worth a shot."],
  bunny: ["hoppy spring! I hid a coin somewhere. (I forgot where. classic.)", "bunny ears ON. cuteness levels: maximum."],
  leprechaun: ["luck o' the bird to ya! finish strong, bestie.", "I'm wearing green so nobody pinches me. smart, right?"],
  pilgrim: ["thankful for YOU and also for snacks. mostly you. and snacks.", "gobble gobble, get that work done first though."],
  firework: ["BOOM! that's the sound of you about to crush this.", "fireworks energy today. let's light it UP (safely)."],
  heart: ["happy Valentine's, bestie. you're my favorite human, fr.", "I made you a card. it's a leaf. it's from the heart."],
};

// Friend-bird visit lines.
export const KIWI_VISIT_LINES: string[] = [
  "my friend flew in to say hi! we're judging your homework together now.",
  "guest bird alert! be cool, be cool.",
  "the flock's here. it's giving reunion. anyway, do your math.",
];

// Vacation-day lines (when Reagan's on break).
export const KIWI_VACATION_DAY_LINES: string[] = [
  "no school today?? we LOVE to see it. go be a kid, bestie.",
  "day off! I'm officially in nap mode. don't @ me.",
  "break day energy. touch some grass for me (I can't, I'm inside).",
];

/* ------------------------- Deterministic picker --------------------------- */
/**
 * Tiny stable string hash → non-negative int. Used to pick a line/costume
 * deterministically from the date so it's stable all day but varies day to day.
 */
export function stableHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T | undefined {
  if (!arr.length) return undefined;
  return arr[seed % arr.length];
}

/** Parse "YYYY-MM-DD" → {month, day} (1-based). Returns null if malformed. */
function parseMonthDay(iso: string): { month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
}

/** Match the first costume rule whose keyword appears in any event title. */
export function matchEventCostume(eventTitles: string[]): CostumeRule | null {
  const hay = eventTitles.map((t) => (t || "").toLowerCase());
  for (const rule of COSTUME_RULES) {
    for (const kw of rule.keywords) {
      if (hay.some((t) => t.includes(kw))) return rule;
    }
  }
  return null;
}

/**
 * Resolve Kiwi's full character for a given ISO date + context.
 * Priority: calendar event > holiday > vacation > everyday.
 * (Injury/doctor live inside the event rules and are ordered first.)
 */
export function resolveKiwiDayCharacter(
  isoDate: string,
  ctx: KiwiContext = {},
): KiwiDayCharacter {
  const seed = stableHash(isoDate);
  const md = parseMonthDay(isoDate);
  const events = ctx.eventTitles ?? [];
  const showLabel = ctx.favoriteShowLabel || DEFAULT_FAVORITE_SHOW;

  let costume: KiwiCostume = "none";
  let costumeLabel = "Everyday Kiwi";
  let reason: KiwiDayCharacter["reason"] = "everyday";

  // 1) Calendar event keywords (highest priority — it's what's really happening)
  const eventRule = matchEventCostume(events);
  if (eventRule) {
    costume = eventRule.costume;
    costumeLabel = eventRule.label;
    reason = "calendar-event";
  } else if (md) {
    // 2) Holiday
    const hol = resolveHoliday(md.month, md.day);
    if (hol) {
      costume = hol.costume;
      costumeLabel = hol.label;
      reason = "holiday";
    } else if (ctx.onVacation) {
      // 3) Vacation
      costume = "vacation";
      costumeLabel = "Vacation Kiwi (do not disturb)";
      reason = "vacation";
    }
  } else if (ctx.onVacation) {
    costume = "vacation";
    costumeLabel = "Vacation Kiwi (do not disturb)";
    reason = "vacation";
  }

  // Guest bird: explicit event flag, or a small deterministic chance otherwise.
  let guestBird: KiwiDayCharacter["guestBird"] = null;
  if (ctx.birdVisit || events.some((t) => /\bbird\b|flock|visit from|friend/i.test(t || ""))) {
    // Lychee (Kiwi's best friend) shows up most often; the others are rarer.
    const friends: Array<"lychee" | "blue" | "daffy" | "honk"> = ["lychee", "lychee", "lychee", "blue", "daffy", "honk"];
    guestBird = friends[seed % friends.length]!;
  }

  // Pick the headline funny line. Prefer a costume-matched line; else fall back
  // to the general bank (occasionally a pet/gamer/poop bit for spice).
  let funnyLine: string;
  const costumeLines = KIWI_COSTUME_LINES[costume];
  if (reason === "vacation") {
    funnyLine = pick(KIWI_VACATION_DAY_LINES, seed) ?? KIWI_IDLE_LINES[0]!;
  } else if (guestBird) {
    funnyLine = pick(KIWI_VISIT_LINES, seed) ?? KIWI_IDLE_LINES[0]!;
  } else if (costumeLines && costumeLines.length) {
    funnyLine = pick(costumeLines, seed)!;
  } else {
    // Mix the general bank with occasional themed bits, deterministically.
    const bucket = seed % 10;
    if (bucket === 0) funnyLine = pick(KIWI_POOP_LINES, seed)!;
    else if (bucket <= 3) funnyLine = pick(KIWI_PET_LINES, seed)!;
    else if (bucket <= 5) funnyLine = pick(KIWI_GAMER_LINES, seed)!;
    else funnyLine = pick(KIWI_IDLE_LINES, seed)!;
  }
  if (costume === "showfan") {
    funnyLine = funnyLine.replace(/the show/gi, showLabel);
  }

  // Idle line uses a different seed offset so it isn't identical to funnyLine.
  const idleLine = pick(KIWI_IDLE_LINES, seed + 7) ?? KIWI_IDLE_LINES[0]!;

  return {
    date: isoDate,
    costume,
    costumeLabel,
    guestBird,
    funnyLine,
    idleLine,
    reason,
    onVacation: !!ctx.onVacation,
  };
}

/* ----------------------- Slow ambient "projects" -------------------------- */
/**
 * Kiwi runs slow, multi-step projects over a session (build a nest, do
 * needlework). This returns the project + its current stage given how many
 * "ticks" have elapsed. Pure: the caller owns the tick counter/timer.
 */
export type KiwiProjectKind = "nest" | "needlework" | "reading-tower" | "snack-stack";

export interface KiwiProject {
  kind: KiwiProjectKind;
  /** 0-based stage index. */
  stage: number;
  /** Total stages for this project. */
  totalStages: number;
  /** Bubble line for this stage. */
  line: string;
}

const PROJECT_STAGES: Record<KiwiProjectKind, string[]> = {
  nest: [
    "found a twig. nest construction: day one.",
    "added another twig. it's giving... pile.",
    "ok the nest has a vibe now. cozy.",
    "nest is DONE. zero notes. masterpiece.",
  ],
  needlework: [
    "starting a tiny scarf. for who? unclear. me, probably.",
    "stitch, stitch... I dropped a stitch. dropped my dignity too.",
    "almost done with the scarf. it's lumpy. it's loved.",
    "scarf complete! it's two inches long. fits a worm, maybe.",
  ],
  "reading-tower": [
    "stacking my books. tower height: one book.",
    "the book tower grows. I cannot read but I respect the look.",
    "tower's getting tall. structural integrity: questionable.",
    "behold: the book tower. it's giving library bird.",
  ],
  "snack-stack": [
    "collecting snacks. for science. (the science of being hungry.)",
    "snack pile growing. I'm a responsible snack manager.",
    "the snack stack is majestic. do NOT touch it.",
    "snack stack complete. I ate it immediately. no regrets.",
  ],
};

export function kiwiProjectForTick(kind: KiwiProjectKind, tick: number): KiwiProject {
  const stages = PROJECT_STAGES[kind];
  const total = stages.length;
  const stage = Math.max(0, Math.min(total - 1, tick));
  return { kind, stage, totalStages: total, line: stages[stage]! };
}

export const ALL_PROJECT_KINDS: KiwiProjectKind[] = ["nest", "needlework", "reading-tower", "snack-stack"];

/* =========================================================================
 * TIME-AWARE VARIETY ENGINE (2026-06-19, Katy)
 * =========================================================================
 * The original resolver keyed everything off the date alone, so Kiwi wore the
 * SAME look + said the same headline line all day ("sunglasses all day" bug).
 *
 * resolveKiwiMoment() wraps the daily resolver and adds a *time-of-day* layer:
 *   - When the day has a real costume (calendar event / holiday / vacation),
 *     that costume PERSISTS all day — it's what's actually happening.
 *   - On ordinary "none" days, Kiwi rotates a light mood + tiny accessory +
 *     fresh idle line for each of 6 day-segments, so she visibly changes every
 *     couple of hours without ever locking into one gimmick.
 *
 * Everything stays PURE + DETERMINISTIC: same (isoDateTime, ctx) → same moment.
 * Callers pass a full ISO datetime (or a {hour} override for tests).
 */

export type KiwiSegment =
  | "dawn"      // 05:00–07:59  sleepy, coffee-ish, slow start
  | "morning"   // 08:00–10:59  school energy, ready to grind
  | "midday"    // 11:00–13:59  snack brain, mid-focus
  | "afternoon" // 14:00–16:59  winding down, a little goofy
  | "evening"   // 17:00–19:59  relaxed, cozy
  | "night";    // 20:00–04:59  sleepy, low-key

export const KIWI_SEGMENTS: KiwiSegment[] = [
  "dawn", "morning", "midday", "afternoon", "evening", "night",
];

/** Map an hour (0-23) to a day-segment. */
export function getTimeSegment(hour: number): KiwiSegment {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "midday";
  if (h >= 14 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}

/** Pull the hour out of an ISO datetime string ("...THH:..."), else null. */
export function hourFromIso(iso: string): number | null {
  const m = /T(\d{2}):/.exec(iso);
  if (!m) return null;
  return parseInt(m[1], 10);
}

/**
 * Light, swappable "moods" Kiwi cycles through on ordinary days. These never
 * override a real costume — they're tiny accessories/vibes that keep her fresh.
 */
export type KiwiMood =
  | "cozy"      // blanket / sweater vibe
  | "sleepy"    // droopy eyes, yawning
  | "hyper"     // wide-eyed, bouncy
  | "snacky"    // crumb on beak, snack obsessed
  | "focused"   // tiny reading glasses
  | "silly"     // upside-down, goofing
  | "chill";    // headphones, vibing

export interface KiwiMoodInfo {
  mood: KiwiMood;
  /** Short human label (tooltip / aria). */
  label: string;
  /** A tiny accessory hint the sprite layer can use (emoji-ish key). */
  accessory: "blanket" | "zzz" | "spark" | "crumb" | "glasses" | "none" | "headphones";
}

export const KIWI_MOODS: Record<KiwiMood, KiwiMoodInfo> = {
  cozy:    { mood: "cozy",    label: "Cozy Kiwi",    accessory: "blanket" },
  sleepy:  { mood: "sleepy",  label: "Sleepy Kiwi",  accessory: "zzz" },
  hyper:   { mood: "hyper",   label: "Hyper Kiwi",   accessory: "spark" },
  snacky:  { mood: "snacky",  label: "Snacky Kiwi",  accessory: "crumb" },
  focused: { mood: "focused", label: "Focused Kiwi", accessory: "glasses" },
  silly:   { mood: "silly",   label: "Silly Kiwi",   accessory: "none" },
  chill:   { mood: "chill",   label: "Chill Kiwi",   accessory: "headphones" },
};

/**
 * Which moods are "in season" for each segment. The first is the most likely
 * default; the rest add day-to-day variety (seeded by date+segment).
 */
const SEGMENT_MOODS: Record<KiwiSegment, KiwiMood[]> = {
  dawn:      ["sleepy", "cozy", "snacky"],
  morning:   ["hyper", "focused", "chill"],
  midday:    ["snacky", "focused", "silly"],
  afternoon: ["silly", "chill", "hyper"],
  evening:   ["chill", "cozy", "snacky"],
  night:     ["sleepy", "cozy", "chill"],
};

/** Per-segment idle line banks — Kiwi's vibe genuinely shifts through the day. */
export const KIWI_SEGMENT_LINES: Record<KiwiSegment, string[]> = {
  dawn: [
    "it's so early my feathers aren't even awake yet. five more minutes?",
    "morning, bestie. I require coffee. I'm a bird. I'll take a seed.",
    "the sun's up and so are we, unfortunately. let's ease into it.",
    "yawn. ok. we're doing this. slowly. gently. like sleepy queens.",
    "dawn patrol: just me, you, and the urge to go back to bed.",
  ],
  morning: [
    "ok GENIUS hours. brain's loading... loading... there it is. let's go.",
    "morning energy is UP. I did three wing flaps. athlete.",
    "fresh day, fresh start, fresh chaos. I'm ready. are you ready?",
    "let's knock out the hard stuff while our brains are still spicy.",
    "she's awake, she's caffeinated (on vibes), she's THAT girl.",
  ],
  midday: [
    "is it snack o'clock? asking for me. it's me. I want a snack.",
    "midday brain is 60% focus, 40% 'what's for lunch.' relatable.",
    "halfway through, bestie. don't fade on me now. snack break soon.",
    "I just thought about a sandwich for ten straight minutes. productive.",
    "we're cooking. metaphorically. I cannot actually cook. no thumbs.",
  ],
  afternoon: [
    "afternoon slump? not on my watch. ok maybe a little on my watch.",
    "we're in the home stretch. silly hour activated. focus... ish.",
    "I tried to do a backflip off the perch. it was an afternoon decision.",
    "winding down energy. almost done. you've basically already won.",
    "it's giving 'tired but trying,' and honestly? iconic of us.",
  ],
  evening: [
    "evening vibes: lights low, snacks high. cozy mode engaged.",
    "school's basically a wrap. let's coast into chill, bestie.",
    "I put on my tiny headphones. don't talk to me, I'm vibing.",
    "you did the thing today. multiple things, even. proud of you, fr.",
    "golden hour and you GLOW. relax those shoulders, queen.",
  ],
  night: [
    "it's late-ish and I'm soft and sleepy. wind it down, bestie.",
    "stars are out, I'm fluffed up, brain's at 12%. cozy o'clock.",
    "nighttime Kiwi is just a little blanket with eyes. goodnight soon.",
    "we did good today. tuck the brain in. I'll guard the snacks.",
    "low-key sleepy but I'd stay up to keep you company. that's love.",
  ],
};

export interface KiwiMoment extends KiwiDayCharacter {
  /** Which 2–3 hr window of the day this moment is for. */
  segment: KiwiSegment;
  /** The light mood layered on top (only varies on "none" / everyday days). */
  mood: KiwiMood;
  /** Mood metadata (label + accessory hint). */
  moodInfo: KiwiMoodInfo;
  /** The hour (0-23) this moment was resolved for. */
  hour: number;
}

/**
 * Resolve Kiwi's *current-moment* character: the daily costume PLUS a
 * time-of-day mood/idle rotation. Pass a full ISO datetime; if it has no time
 * component, you can pass an explicit `hour` to override (handy in tests).
 */
export function resolveKiwiMoment(
  isoDateTime: string,
  ctx: KiwiContext = {},
  hourOverride?: number,
): KiwiMoment {
  const isoDate = isoDateTime.slice(0, 10);
  const hour = hourOverride ?? hourFromIso(isoDateTime) ?? 12;
  const segment = getTimeSegment(hour);

  const base = resolveKiwiDayCharacter(isoDate, ctx);

  // Seed combines date + segment (+ name) so each window of each day is its own
  // stable pick, but it visibly changes across windows and across days.
  const segSeed = stableHash(`${isoDate}|${segment}|${ctx.studentName ?? ""}`);

  // Mood: only layer a rotating mood on ordinary days. On real-costume days the
  // costume is the story; keep mood neutral-ish but still segment-appropriate.
  const seasonal = SEGMENT_MOODS[segment];
  const mood = pick(seasonal, segSeed) ?? seasonal[0]!;
  const moodInfo = KIWI_MOODS[mood];

  // Idle line: on ordinary days rotate the segment bank so it changes through
  // the day; on costume/vacation/guest days keep the daily resolver's line so
  // the look and the words still match.
  let idleLine = base.idleLine;
  let funnyLine = base.funnyLine;
  if (base.reason === "everyday" && !base.guestBird) {
    const segLines = KIWI_SEGMENT_LINES[segment];
    idleLine = pick(segLines, segSeed) ?? base.idleLine;
    // Mix the headline between the segment bank and the general spice banks so
    // even the funnyLine moves through the day.
    const bucket = segSeed % 10;
    if (bucket === 0) funnyLine = pick(KIWI_POOP_LINES, segSeed)!;
    else if (bucket <= 2) funnyLine = pick(KIWI_PET_LINES, segSeed)!;
    else if (bucket <= 4) funnyLine = pick(KIWI_GAMER_LINES, segSeed)!;
    else funnyLine = pick(segLines, segSeed + 3) ?? idleLine;
  }

  return {
    ...base,
    idleLine,
    funnyLine,
    segment,
    mood,
    moodInfo,
    hour,
  };
}

/* =========================================================================
 * SOCIAL WORLD: Lychee (best friend) + the duck trio
 * =========================================================================
 * Lychee is Kiwi's MALE budgie best friend (name rhymes with Kiwi). He drops by
 * OFTEN — several windows a day — and the two do classic best-friend budgie
 * stuff: follow each other around, bicker, preen, and fly off together. A trio
 * of ducks waddles through occasionally (a couple times a week).
 *
 * resolveKiwiSocial() is PURE: given an ISO datetime it deterministically tells
 * the perch WHO (if anyone) is visiting and WHAT they're doing right now.
 */

export type KiwiGuestId = "lychee" | "ducks" | null;
export type KiwiInteractionBeat =
  | "follow"   // Lychee tails Kiwi around the perch
  | "bicker"   // playful squabble
  | "preen"    // grooming each other, sweet
  | "flyoff"   // they zoom off together for a sec
  | "waddle"   // the duck trio waddles through
  | "chatter"  // general happy noise
  | null;

export interface KiwiSocialMoment {
  /** Who's visiting right now (or null for just Kiwi). */
  guestId: KiwiGuestId;
  /** What the visit looks like right now. */
  beat: KiwiInteractionBeat;
  /** A bubble line for the moment, in Kiwi's voice. */
  line: string;
  /** The 2-hour visit window index (0-11 across the day), for stable keys. */
  windowIndex: number;
}

/** Lychee follow-around lines. */
export const LYCHEE_FOLLOW_LINES: string[] = [
  "Lychee's here and he's COPYING me. fly left— he flies left. menace.",
  "my bestie Lychee followed me to your desk. we're a package deal now.",
  "Lychee does everything I do, just slightly worse. king of being mid.",
  "look, it's Lychee! he rhymes with me. we planned that. (we didn't.)",
  "Lychee shadowing me again. that's my guy though. ride or die.",
];

/** Lychee bicker / squabble lines (playful, never mean). */
export const LYCHEE_BICKER_LINES: string[] = [
  "Lychee says I sing flat. Lychee sounds like a squeaky door. anyway.",
  "me and Lychee are 'fighting' over the best perch. it's the same perch.",
  "Lychee stole my sunflower seed. this is WAR. (we'll be fine in a sec.)",
  "Lychee: 'you're dramatic.' me: 'YOU'RE dramatic.' best friends, truly.",
  "lil squabble with Lychee, no biggie. we bicker, we make up, we vibe.",
];

/** Lychee preen / sweet bestie lines. */
export const LYCHEE_PREEN_LINES: string[] = [
  "Lychee's fixing my head feathers. true bestie behavior, fr.",
  "preening sesh with Lychee. this is our version of a spa day.",
  "Lychee got a crumb off my beak. that's friendship. that's love.",
  "me and Lychee just sitting wing-to-wing being besties. soft hours.",
  "Lychee says hi, bestie! (he can't talk. I'm translating. trust me.)",
];

/** Lychee fly-off-together lines. */
export const LYCHEE_FLYOFF_LINES: string[] = [
  "brb!! me and Lychee are doing a victory lap around the room. weee!",
  "Lychee dared me to fly to the ceiling fan. we'll be RIGHT back.",
  "zoom zoom! best-friend flight patrol. back before you finish that line.",
  "Lychee and I gotta bounce for two seconds. bird business. very official.",
];

/** Duck squad visit lines. Reagan's REAL flock: the big black Swedish female
 * (white-speckled chest, greenish back) struts in front like a proud leader,
 * and the two brown mallard "twins" scurry behind her in a tight little cluster,
 * head-bobbing and muttering. One twin is a smidge smaller with smaller eyes.
 * They never split up and they're always low-key chattering, not loud-quacking. */
export const DUCK_VISIT_LINES: string[] = [
  "the duck squad's here! big black Swedish lady up front, two mallard twins scurrying behind. formation: flawless.",
  "here come the ducks, single file. the speckly black one leads, the brown twins shuffle after her muttering. iconic.",
  "THREE ducks waddled in. the boss duck struts, the twins do that fast little low scurry to keep up. respect the hustle.",
  "duck parade! the black Swedish girl bobs her head like she's counting us, twins flutter their tails and chatter. a whole vibe.",
  "the squad's doing their muttery little group walk through your desk. they don't quack loud, they just gossip. relatable.",
  "big speckled leader duck + two brown twins (one's a smidge smaller, tinier eyes, baby of the group). they refuse to be apart.",
  "ducks incoming in a tight cluster. someone stopped, everyone bumped into her, tails went FLUTTER. comedy gold.",
];

/**
 * Resolve who's hanging out with Kiwi right now.
 *
 * Schedule logic (deterministic from date+window):
 *   - The day is split into 12 two-hour windows.
 *   - Lychee visits OFTEN: in most windows there's a strong chance he's around,
 *     cycling through follow / bicker / preen / flyoff beats.
 *   - The duck trio is RARE: only a couple of windows a week, and never at the
 *     same time as a Lychee beat that needs the spotlight.
 */
export function resolveKiwiSocial(
  isoDateTime: string,
  hourOverride?: number,
): KiwiSocialMoment {
  const isoDate = isoDateTime.slice(0, 10);
  const hour = hourOverride ?? hourFromIso(isoDateTime) ?? 12;
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const windowIndex = Math.floor(h / 2); // 0..11

  const seed = stableHash(`${isoDate}|win${windowIndex}`);

  // Ducks: rare. Roughly ~2 windows per week → gate on a 1-in-40 hash slot,
  // combined with day-of seed so it clusters into "duck days".
  const duckSeed = stableHash(`${isoDate}|ducks`);
  const isDuckDay = duckSeed % 4 === 0;            // ~1-2 days/week
  const duckWindow = isDuckDay && seed % 5 === 0;  // a single window on those days

  if (duckWindow) {
    return {
      guestId: "ducks",
      beat: "waddle",
      line: pick(DUCK_VISIT_LINES, seed) ?? DUCK_VISIT_LINES[0]!,
      windowIndex,
    };
  }

  // Lychee: visits OFTEN. Present in ~65% of windows.
  const lycheeHere = seed % 100 < 65;
  if (lycheeHere) {
    const beats: KiwiInteractionBeat[] = ["follow", "bicker", "preen", "flyoff", "chatter"];
    const beat = beats[seed % beats.length]!;
    let bank: string[];
    switch (beat) {
      case "follow":  bank = LYCHEE_FOLLOW_LINES; break;
      case "bicker":  bank = LYCHEE_BICKER_LINES; break;
      case "preen":   bank = LYCHEE_PREEN_LINES; break;
      case "flyoff":  bank = LYCHEE_FLYOFF_LINES; break;
      default:        bank = LYCHEE_FOLLOW_LINES; break;
    }
    return {
      guestId: "lychee",
      beat,
      line: pick(bank, seed + 1) ?? bank[0]!,
      windowIndex,
    };
  }

  return { guestId: null, beat: null, line: "", windowIndex };
}

/** Display metadata for each social guest (names + accent colors). */
export const KIWI_GUEST_META: Record<
  Exclude<KiwiGuestId, null>,
  { name: string; accent: string; kind: "budgie" | "ducks" }
> = {
  lychee: { name: "Lychee", accent: "#3b82f6", kind: "budgie" },
  ducks: { name: "the duck trio", accent: "#f6c343", kind: "ducks" },
};
