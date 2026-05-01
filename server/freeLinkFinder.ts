/**
 * freeLinkFinder — for any curriculum topic (subject + topic name) return a small
 * curated set of free, no-login resource suggestions: Khan Academy search,
 * IXL skill search, ReadWorks, Smithsonian Learning Lab, Outdoor Classroom Day.
 *
 * Pure function: easy to unit-test (see freeLinkFinder.test.ts).
 */

export type FreeLink = {
  kind: "video" | "practice" | "printable" | "outdoor" | "reference";
  source: string;
  label: string;
  url: string;
  emoji: string;
};

const KIND_BY_SUBJECT: Record<string, Array<FreeLink["kind"]>> = {
  math:    ["video", "practice", "printable"],
  ela:     ["practice", "printable", "reference"],
  reading: ["practice", "reference"],
  science: ["video", "outdoor", "reference"],
  ss:      ["reference", "video"],
  art:     ["video", "outdoor"],
  pe:      ["outdoor", "video"],
};

function khan(query: string): FreeLink {
  return {
    kind: "video",
    source: "Khan Academy",
    label: `Khan Academy: ${query}`,
    url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(query)}`,
    emoji: "🎬",
  };
}

function ixl(query: string, gradeBand = "5"): FreeLink {
  return {
    kind: "practice",
    source: "IXL",
    label: `IXL practice: ${query}`,
    url: `https://www.ixl.com/search?term=${encodeURIComponent(query)}&grade=${encodeURIComponent(gradeBand)}`,
    emoji: "📝",
  };
}

function readWorks(query: string): FreeLink {
  return {
    kind: "practice",
    source: "ReadWorks",
    label: `ReadWorks passage: ${query}`,
    url: `https://www.readworks.org/find-content#!q:${encodeURIComponent(query)}/g:5/`,
    emoji: "📖",
  };
}

function smithsonian(query: string): FreeLink {
  return {
    kind: "reference",
    source: "Smithsonian Learning Lab",
    label: `Smithsonian: ${query}`,
    url: `https://learninglab.si.edu/search?st=${encodeURIComponent(query)}`,
    emoji: "🏛️",
  };
}

function outdoor(query: string): FreeLink {
  return {
    kind: "outdoor",
    source: "Outdoor Classroom Day",
    label: `Outdoor lesson: ${query}`,
    url: `https://outdoorclassroomday.com/?s=${encodeURIComponent(query)}`,
    emoji: "🌳",
  };
}

function printablePack(query: string): FreeLink {
  return {
    kind: "printable",
    source: "Education.com",
    label: `Printable: ${query}`,
    url: `https://www.education.com/search/?q=${encodeURIComponent(query)}&grade=fifth-grade`,
    emoji: "🧾",
  };
}

/**
 * Return a small, ranked list of free links for a given curriculum topic.
 * `subjectSlug` is required; we fall back to math defaults if unknown.
 */
export function findFreeLinks(input: {
  subjectSlug: string;
  topicName: string;
  gradeBand?: string;
}): FreeLink[] {
  const subj = (input.subjectSlug || "").toLowerCase();
  const topic = (input.topicName || "").trim();
  const grade = input.gradeBand || "5";
  const want = KIND_BY_SUBJECT[subj] || KIND_BY_SUBJECT.math;
  const out: FreeLink[] = [];
  for (const kind of want) {
    if (kind === "video") out.push(khan(topic));
    if (kind === "practice" && (subj === "ela" || subj === "reading")) out.push(readWorks(topic));
    else if (kind === "practice") out.push(ixl(topic, grade));
    if (kind === "printable") out.push(printablePack(topic));
    if (kind === "outdoor") out.push(outdoor(topic));
    if (kind === "reference" && subj === "science") out.push(smithsonian(topic));
    else if (kind === "reference") out.push(smithsonian(topic));
  }
  // De-dup by url (some subjects double-source)
  const seen = new Set<string>();
  return out.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
}
