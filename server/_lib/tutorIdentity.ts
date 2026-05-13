/**
 * Push 93 (2026-05-13) — Tutor identity helpers.
 *
 * Canonical roster of three: Madison, Sophie, Keith. All other "tutors"
 * are legacy and should be inactive after Push 79.
 *
 * Pure module: no DB. Higher-level callers (e.g. tutorSignInCard procedure)
 * use these helpers to validate inputs and to map names → placeholder
 * emails recognized by `permissions.roleForEmail`.
 */

export type CanonicalTutorName = "Madison" | "Sophie" | "Keith";

export const CANONICAL_TUTORS: ReadonlyArray<{
  name: CanonicalTutorName;
  email: string;
  placeholderDomain: string;
}> = [
  { name: "Madison", email: "madison@tbd.local", placeholderDomain: "tbd.local" },
  { name: "Sophie",  email: "sophie@tbd.local",  placeholderDomain: "tbd.local" },
  { name: "Keith",   email: "keith@tbd.local",   placeholderDomain: "tbd.local" },
];

const NAME_SET = new Set<string>(CANONICAL_TUTORS.map((t) => t.name));

export function isCanonicalTutorName(name: unknown): name is CanonicalTutorName {
  return typeof name === "string" && NAME_SET.has(name);
}

export function canonicalTutorEmail(name: CanonicalTutorName): string {
  const found = CANONICAL_TUTORS.find((t) => t.name === name);
  if (!found) throw new Error(`canonicalTutorEmail: unknown name "${name}"`);
  return found.email;
}

export function listCanonicalTutorNames(): CanonicalTutorName[] {
  return CANONICAL_TUTORS.map((t) => t.name);
}

/**
 * Dual sign-in policy: a tutor session counts as "confirmed" only when
 * BOTH the tutor and a family-admin (Mom or Grandma) have signed in for
 * that day. This is the rule the kid-facing Today page enforces before
 * the "Tutor's here" pill turns green.
 */
export type DualSignInStatus = {
  ok: boolean;
  reason:
    | "confirmed"
    | "needs-tutor"
    | "needs-family-admin"
    | "needs-both"
    | "tutor-not-on-roster";
};

export function evaluateDualSignIn(input: {
  tutorName: string | null | undefined;
  tutorSignedInAtMs: number | null | undefined;
  familyAdminSignedInAtMs: number | null | undefined;
  nowMs?: number;
}): DualSignInStatus {
  if (input.tutorName && !isCanonicalTutorName(input.tutorName)) {
    return { ok: false, reason: "tutor-not-on-roster" };
  }
  const tutor = !!input.tutorSignedInAtMs && input.tutorSignedInAtMs > 0;
  const adult = !!input.familyAdminSignedInAtMs && input.familyAdminSignedInAtMs > 0;
  if (!tutor && !adult) return { ok: false, reason: "needs-both" };
  if (!tutor) return { ok: false, reason: "needs-tutor" };
  if (!adult) return { ok: false, reason: "needs-family-admin" };
  return { ok: true, reason: "confirmed" };
}
