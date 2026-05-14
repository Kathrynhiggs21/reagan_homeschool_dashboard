/**
 * Push 146 (2026-05-14) — Google Classroom subject ↔ courseId map.
 *
 * Educator: spear.cpt@gmail.com (Mom). One Course per canonical subject.
 * The dashboard remains source of truth; Classroom is a one-way mirror
 * for record-keeping (Option A confirmed by Mom 2026-05-14).
 *
 * Pure helper — no DB / no IO. Reads/writes a `Map`-shaped binding the
 * caller is expected to persist (in `app_settings['classroom.course.<subj>']`
 * or table `classroom_course_links`).
 */

export const CLASSROOM_SUBJECTS = [
  "math",
  "ela",
  "science",
  "social-studies",
  "specials",
] as const;
export type ClassroomSubject = (typeof CLASSROOM_SUBJECTS)[number];

export const CLASSROOM_OWNER_EMAIL = "spear.cpt@gmail.com";
/** Reagan's student account on the Classroom side. */
export const CLASSROOM_STUDENT_EMAIL = "reaganhiggs910@gmail.com";
/** Hard-blocked — historical school account, never read or write. */
export const CLASSROOM_BLOCKED_EMAILS: readonly string[] = [
  "reagan.higgs33@ihsd.us",
];

export function isCanonicalClassroomSubject(
  s: string | null | undefined,
): s is ClassroomSubject {
  return (
    typeof s === "string" &&
    (CLASSROOM_SUBJECTS as readonly string[]).includes(s)
  );
}

export interface ClassroomCourseDefaults {
  /** Course display name in Classroom. */
  name: string;
  section: string;
  room: string;
  description: string;
}

const COURSE_DEFAULTS: Record<ClassroomSubject, ClassroomCourseDefaults> = {
  math: {
    name: "Reagan — Math (5th)",
    section: "Homeschool 2025–2026",
    room: "Home",
    description:
      "Mirror of Reagan's homeschool dashboard math blocks. Assignments are created on the dashboard (single source of truth) and pushed here for record-keeping.",
  },
  ela: {
    name: "Reagan — ELA (5th)",
    section: "Homeschool 2025–2026",
    room: "Home",
    description:
      "Mirror of Reagan's homeschool dashboard ELA blocks (reading, writing, vocabulary, grammar).",
  },
  science: {
    name: "Reagan — Science (5th)",
    section: "Homeschool 2025–2026",
    room: "Home",
    description:
      "Mirror of Reagan's homeschool dashboard science blocks (Spectrum Science 5 + flashlight demos + nature studies).",
  },
  "social-studies": {
    name: "Reagan — Social Studies (5th)",
    section: "Homeschool 2025–2026",
    room: "Home",
    description:
      "Mirror of Reagan's homeschool dashboard social-studies blocks (US history / geography / civics).",
  },
  specials: {
    name: "Reagan — Specials & Adventures (5th)",
    section: "Homeschool 2025–2026",
    room: "Home",
    description:
      "Mirror of Reagan's homeschool dashboard specials, art, and Adventure-of-the-Day blocks.",
  },
};

export function getCourseDefaults(
  subject: ClassroomSubject,
): ClassroomCourseDefaults {
  return COURSE_DEFAULTS[subject];
}

export interface SubjectCourseBinding {
  subject: ClassroomSubject;
  courseId: string;
  ownerEmail: string;
}

/**
 * Validate + normalize a list of bindings. Drops anything pointing at a
 * blocked email or at an unknown subject. Last-write-wins per subject so
 * callers can pass a fresh batch and let the helper de-dup.
 */
export function normalizeBindings(
  raw: ReadonlyArray<{
    subject?: string | null;
    courseId?: string | null;
    ownerEmail?: string | null;
  }>,
): SubjectCourseBinding[] {
  const out = new Map<ClassroomSubject, SubjectCourseBinding>();
  for (const b of raw ?? []) {
    if (!b) continue;
    const subj = (b.subject ?? "").toString().toLowerCase().trim();
    const courseId = (b.courseId ?? "").toString().trim();
    const owner = (b.ownerEmail ?? "").toString().toLowerCase().trim();
    if (!isCanonicalClassroomSubject(subj)) continue;
    if (!courseId) continue;
    if (!owner) continue;
    if (CLASSROOM_BLOCKED_EMAILS.includes(owner)) continue;
    out.set(subj, { subject: subj, courseId, ownerEmail: owner });
  }
  return Array.from(out.values()).sort((a, b) =>
    a.subject.localeCompare(b.subject),
  );
}

/** Returns the subjects that still need a Course bound. */
export function findUnboundSubjects(
  bindings: ReadonlyArray<SubjectCourseBinding>,
): ClassroomSubject[] {
  const have = new Set(bindings.map((b) => b.subject));
  return CLASSROOM_SUBJECTS.filter((s) => !have.has(s));
}

/** Lookup helper used by the planner. Returns null when unbound. */
export function resolveCourseId(
  bindings: ReadonlyArray<SubjectCourseBinding>,
  subject: ClassroomSubject,
): string | null {
  const hit = bindings.find((b) => b.subject === subject);
  return hit ? hit.courseId : null;
}
