/**
 * 2026-06-16 — Per-subject / per-topic "open in the real app" deep links.
 *
 * Katy's hard requirements (confirmed 2026-06-16):
 *  - Tapping a block must land Reagan on the SPECIFIC activity/skill page,
 *    NOT a homepage, NOT her profile, NOT a general grade-5 topic list.
 *  - She is already signed in on the device; links must just open the skill.
 *  - She has ACTIVE paid logins for: IXL (Families: Math, Language Arts,
 *    Science, Social Studies), Khan Academy, Prodigy (math), and
 *    Education.com (signed in via Google spear.cpt@gmail.com).
 *
 * Strategy: a topic->specific IXL grade-5 skill map (primary), with Khan /
 * Prodigy(math) / Education.com as alternates, and the in-app generated
 * worksheet as the always-available no-login fallback.
 *
 * IXL skill URLs verified to follow the pattern:
 *   https://www.ixl.com/math/grade-5/<skill-slug>
 *   https://www.ixl.com/ela|science|social-studies/grade-5
 */

export type AppId = "khan" | "ixl" | "prodigy" | "education";

export type AppOption = { label: string; url: string; app: AppId };

export type SubjectAppTarget = AppOption & {
  alts?: AppOption[];
  alt?: AppOption; // back-compat for older UI
};

type Bucket = "math" | "ela" | "reading" | "science" | "social" | "writing" | "generic";

function norm(s?: string | null): string {
  return (s ?? "").toLowerCase();
}

function bucketFor(subjectSlug?: string | null, title?: string | null, topicHint?: string | null): Bucket {
  const s = norm(subjectSlug);
  const t = `${norm(title)} ${norm(topicHint)}`;

  // 1) An explicit, unambiguous subject slug ALWAYS wins over keyword matching
  //    on the title/topic. This prevents "metric" (a math keyword) on a science
  //    block from routing to math, or a social-studies block whose title mentions
  //    a "map" or "community" from routing to ELA/social ambiguously.
  if (/\bsocial[-_\s]?studies\b|\bsocial\b|\bhistory\b|\bgeography\b|\bcivics\b/.test(s)) return "social";
  if (/\bscience\b|\bspectrum\b/.test(s)) return "science";
  if (/\bwriting\b|\bcompose\b/.test(s)) return "writing";
  if (/\breading\b|\bread[-_\s]?aloud\b|\bnovel\b/.test(s)) return "reading";
  if (/\bela\b|language[-_\s]?arts|\blanguage\b|\bgrammar\b|\bvocab/.test(s)) return "ela";
  if (/\bmath\b|mathematics/.test(s)) return "math";

  // 2) No decisive slug — fall through to keyword matching on slug+title+topic.
  const hit = (re: RegExp) => re.test(s) || re.test(t);
  if (hit(/\bmath|measure|convert|conversion|metric|volume|fraction|decimal|geometry|multipl|divi|number\b/)) return "math";
  if (hit(/\bscience|spectrum|earth|planet|matter|energy|ecosystem|cells?|weather|water\s*cycle\b/)) return "science";
  if (hit(/\bhaiku|poetry|poem|writing|write|essay|compose|narrative\b/)) return "writing";
  if (hit(/\bread\s*aloud|reading|tuck|michael|novel|chapter|story\b/)) return "reading";
  if (hit(/\bela|language|grammar|180\s*days|vocab|spelling|sentence\b/)) return "ela";
  if (hit(/\bsocial|history|geography|civics|community|map\b/)) return "social";
  return "generic";
}

/**
 * Topic -> SPECIFIC IXL grade-5 skill slug. Matched against title+topicHint.
 * Order matters (first match wins). Falls back to the subject's grade-5 area.
 */
const IXL_MATH_SKILLS: Array<{ re: RegExp; slug: string }> = [
  { re: /metric/, slug: "compare-and-convert-metric-units" },
  { re: /volume.*unit\s*cube|unit\s*cube.*volume/, slug: "volume-of-rectangular-prisms-made-of-unit-cubes" },
  { re: /volume.*compound|compound.*volume/, slug: "volume-of-compound-figures" },
  { re: /\bvolume\b/, slug: "volume-of-rectangular-prisms" },
  { re: /mixed.*(customary|unit)/, slug: "convert-mixed-customary-units" },
  { re: /customary.*length|length.*customary/, slug: "compare-and-convert-customary-units-of-length" },
  { re: /customary.*weight|weight.*customary/, slug: "compare-and-convert-customary-units-of-weight" },
  { re: /customary.*fraction|fraction.*customary/, slug: "convert-customary-units-involving-fractions" },
  { re: /convert|conversion|customary|measure/, slug: "compare-and-convert-customary-units" },
  { re: /add.*fraction|fraction.*add/, slug: "add-fractions-with-unlike-denominators" },
  { re: /\bfraction/, slug: "add-and-subtract-fractions-with-unlike-denominators" },
  { re: /\bdecimal/, slug: "add-and-subtract-decimal-numbers" },
  { re: /multipl/, slug: "multiply-by-2-digit-numbers" },
  { re: /divi/, slug: "division-with-decimal-quotients" },
];

function ixlMathSkill(text: string): string {
  for (const { re, slug } of IXL_MATH_SKILLS) {
    if (re.test(text)) return `https://www.ixl.com/math/grade-5/${slug}`;
  }
  return "https://www.ixl.com/math/grade-5/skills";
}

function ixlUrl(b: Bucket, text: string): string {
  switch (b) {
    case "math": return ixlMathSkill(text);
    case "science":
      // science measurement-ish topics land on a specific units skill area
      if (/metric|measure|unit|mass|volume/.test(text)) return "https://www.ixl.com/science/units-and-measurement";
      return "https://www.ixl.com/science/grade-5";
    case "ela":
    case "reading":
    case "writing":
      return "https://www.ixl.com/ela/grade-5";
    case "social":
      return "https://www.ixl.com/social-studies/grade-5";
    default:
      return "https://www.ixl.com/math/grade-5/skills";
  }
}

const KHAN: Record<Bucket, string> = {
  math: "https://www.khanacademy.org/math/cc-fifth-grade-math",
  science: "https://www.khanacademy.org/science/middle-school-physics",
  ela: "https://www.khanacademy.org/ela/cc-5th-reading-vocab",
  reading: "https://www.khanacademy.org/ela/cc-5th-reading-vocab",
  writing: "https://www.khanacademy.org/ela/cc-5th-reading-vocab",
  social: "https://www.khanacademy.org/humanities/us-history",
  generic: "https://www.khanacademy.org/math/cc-fifth-grade-math",
};

const EDUCATION: Record<Bucket, string> = {
  math: "https://www.education.com/resources/fifth-grade/math/",
  science: "https://www.education.com/resources/fifth-grade/science/",
  ela: "https://www.education.com/resources/fifth-grade/reading-writing/",
  reading: "https://www.education.com/resources/fifth-grade/reading/",
  writing: "https://www.education.com/resources/fifth-grade/writing/",
  social: "https://www.education.com/resources/fifth-grade/social-studies/",
  generic: "https://www.education.com/resources/fifth-grade/",
};

const PRODIGY_MATH = "https://play.prodigygame.com/";

/**
 * Pick the primary app deep link for a block (IXL specific skill) plus the
 * other paid apps as alternates. Math also offers Prodigy.
 */
export function subjectAppLink(input: {
  subjectSlug?: string | null;
  title?: string | null;
  topicHint?: string | null;
}): SubjectAppTarget {
  const b = bucketFor(input.subjectSlug, input.title, input.topicHint);
  const text = `${norm(input.title)} ${norm(input.topicHint)} ${norm(input.subjectSlug)}`;

  const primary: AppOption = { label: "Open in IXL", url: ixlUrl(b, text), app: "ixl" };

  const alts: AppOption[] = [];
  if (b === "math") alts.push({ label: "Play on Prodigy", url: PRODIGY_MATH, app: "prodigy" });
  alts.push({ label: "Open in Khan Academy", url: KHAN[b], app: "khan" });
  alts.push({ label: "Open in Education.com", url: EDUCATION[b], app: "education" });

  return { ...primary, alts, alt: alts[0] };
}
