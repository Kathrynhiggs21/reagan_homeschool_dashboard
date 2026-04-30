// Curated kid-safe, free, evergreen activity for each schedule subject.
// Used when no daily printable has been picked yet — tapping "Open" still
// lands on a real worksheet/page so Reagan is never stuck staring at nothing.

export type FallbackActivity = {
  title: string;
  description: string;
  source: string;
  sourceUrl: string;
  pdfUrl?: string;
  estMinutes: number;
  coinReward: number;
  emoji: string;
};

const M = {
  math: {
    title: "Khan Academy — 5th Grade Math",
    description:
      "Pick the topic at the top of your ladder (fractions, decimals, or volume). Watch the short video, then try the practice. Stop after 15 minutes.",
    source: "Khan Academy",
    sourceUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math",
    estMinutes: 15,
    coinReward: 5,
    emoji: "🧮",
  } satisfies FallbackActivity,

  ela: {
    title: "ReadWorks — Today's reading passage",
    description:
      "Read the passage all the way through, then answer the questions. Take your time — re-read if you need to.",
    source: "ReadWorks",
    sourceUrl: "https://www.readworks.org/find-content#!q:fifth+grade",
    estMinutes: 20,
    coinReward: 6,
    emoji: "📖",
  } satisfies FallbackActivity,

  reading: {
    title: "Storyline Online — Pick a story",
    description:
      "Choose any story and watch it read aloud. After, tell someone the story in your own words.",
    source: "Storyline Online",
    sourceUrl: "https://storylineonline.net/library/",
    estMinutes: 20,
    coinReward: 5,
    emoji: "📚",
  } satisfies FallbackActivity,

  writing: {
    title: "Daily writing prompt",
    description:
      "Pick the prompt that grabs you and write for 10 minutes. Don't worry about spelling — just write.",
    source: "Education.com",
    sourceUrl: "https://www.education.com/worksheets/fifth-grade/creative-writing/",
    estMinutes: 15,
    coinReward: 5,
    emoji: "✏️",
  } satisfies FallbackActivity,

  science: {
    title: "Mystery Science — Mystery of the Day",
    description:
      "Watch the short mystery, then try the hands-on activity. Bonus: tell Mom what you learned.",
    source: "Mystery Science",
    sourceUrl: "https://mysteryscience.com/mini-lessons",
    estMinutes: 25,
    coinReward: 7,
    emoji: "🔬",
  } satisfies FallbackActivity,

  ss: {
    title: "Smithsonian Learning Lab — Explore",
    description:
      "Pick a collection that looks cool. Read the captions and screenshot 1 thing you want to remember.",
    source: "Smithsonian Learning Lab",
    sourceUrl: "https://learninglab.si.edu/discover",
    estMinutes: 15,
    coinReward: 5,
    emoji: "🌎",
  } satisfies FallbackActivity,

  art: {
    title: "Art for Kids Hub — Today's drawing",
    description:
      "Follow along with the video and draw. When you're done, photograph it for the Proud Wall.",
    source: "Art for Kids Hub",
    sourceUrl: "https://www.artforkidshub.com/how-to-draw/",
    estMinutes: 20,
    coinReward: 5,
    emoji: "🎨",
  } satisfies FallbackActivity,

  music: {
    title: "Chrome Music Lab",
    description:
      "Play with Song Maker for 10 minutes. Try to match the rhythm of a song you like.",
    source: "Chrome Music Lab",
    sourceUrl: "https://musiclab.chromeexperiments.com/",
    estMinutes: 15,
    coinReward: 4,
    emoji: "🎵",
  } satisfies FallbackActivity,

  outdoors: {
    title: "Backyard bird watch",
    description:
      "Sit outside for 10 minutes. Count and try to ID 3 birds. Sketch the one you saw best.",
    source: "Cornell Lab — Bird Academy",
    sourceUrl: "https://academy.allaboutbirds.org/free-bird-id/",
    estMinutes: 20,
    coinReward: 6,
    emoji: "🌳",
  } satisfies FallbackActivity,

  pe: {
    title: "GoNoodle — Brain break / movement",
    description:
      "Pick any 10-minute video and move along. Get your heart up before sit-down work.",
    source: "GoNoodle",
    sourceUrl: "https://app.gonoodle.com/discover",
    estMinutes: 10,
    coinReward: 3,
    emoji: "🏃‍♀️",
  } satisfies FallbackActivity,

  snack: {
    title: "Snack & reset",
    description:
      "Quick snack and water. Stretch tall. Then pick the next activity.",
    source: "Reagan",
    sourceUrl: "",
    estMinutes: 10,
    coinReward: 1,
    emoji: "🍎",
  } satisfies FallbackActivity,

  break: {
    title: "Stretch & breathe",
    description: "Two minutes of stretching, then drink water.",
    source: "Reagan",
    sourceUrl: "",
    estMinutes: 5,
    coinReward: 1,
    emoji: "⏸️",
  } satisfies FallbackActivity,

  wonder: {
    title: "Wonder of the Day",
    description:
      "Open today's Wonder, read it, and try the quiz at the bottom.",
    source: "Wonderopolis",
    sourceUrl: "https://www.wonderopolis.org/wonders",
    estMinutes: 15,
    coinReward: 5,
    emoji: "✨",
  } satisfies FallbackActivity,
};

const ALIASES: Record<string, keyof typeof M> = {
  math: "math",
  arithmetic: "math",
  ela: "ela",
  english: "ela",
  language_arts: "ela",
  reading: "reading",
  writing: "writing",
  science: "science",
  ss: "ss",
  social_studies: "ss",
  history: "ss",
  art: "art",
  music: "music",
  outdoors: "outdoors",
  nature: "outdoors",
  pe: "pe",
  snack: "snack",
  break: "break",
  wonder: "wonder",
};

export function fallbackActivityFor(subjectSlug?: string | null, blockTitle?: string | null): FallbackActivity {
  const slug = (subjectSlug ?? "").toLowerCase().trim();
  if (slug && ALIASES[slug]) return M[ALIASES[slug]];

  // Fallback: sniff from title
  const t = (blockTitle ?? "").toLowerCase();
  if (/math|fraction|decimal|geometry/.test(t)) return M.math;
  if (/read/.test(t)) return M.reading;
  if (/writ/.test(t)) return M.writing;
  if (/ela|grammar|spell/.test(t)) return M.ela;
  if (/scien|nature|bird|animal|plant/.test(t)) return M.science;
  if (/history|geograph|social/.test(t)) return M.ss;
  if (/art|draw|paint/.test(t)) return M.art;
  if (/music|sing|song/.test(t)) return M.music;
  if (/outdoor|recess|outside/.test(t)) return M.outdoors;
  if (/pe|gym|move/.test(t)) return M.pe;
  if (/snack|lunch/.test(t)) return M.snack;
  if (/break|rest|stretch/.test(t)) return M.break;
  return M.wonder;
}
