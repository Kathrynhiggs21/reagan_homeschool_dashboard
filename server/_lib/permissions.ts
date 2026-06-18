/**
 * permissions.ts
 *
 * Single source of truth for the home-team role hierarchy + capability matrix.
 *
 * Roles (highest \u2192 lowest):
 *   parent  — Mom (spear.cpt@gmail.com) + Dad (blakehiggs@hotmail.com).
 *             Full control inc. billing & secrets.
 *   editor  — Grandma Marcy (marcy.spear@gmail.com). All schedule + assignment
 *             edits, can mark done, upload files, leave notes. NO billing/secrets.
 *   tutor   — Madison / Sophie / Keith. Same edit rights as editor.
 *   student — Reagan (reaganhiggs910@gmail.com). Can complete blocks, log mood,
 *             upload her own work, talk to Kiwi.
 *   viewer  \u2014 anyone else who has a read-only invite link.
 */

export type HomeRole = "parent" | "editor" | "tutor" | "student" | "viewer";

const PARENT_EMAILS = new Set<string>([
  "spear.cpt@gmail.com",   // Mom
  "blakehiggs@hotmail.com", // Dad (Hotmail)
  "higgsblake@gmail.com",   // Dad (Gmail — the account he signs in with)
]);
const STUDENT_EMAIL = "reaganhiggs910@gmail.com";
const EDITOR_EMAILS = new Set<string>([
  "marcy.spear@gmail.com",
]);
// Tutor placeholder emails (will be replaced when user supplies real ones).
const TUTOR_EMAILS = new Set<string>([
  "madison@tbd.local",
  "sophie@tbd.local",
  "keith@tbd.local",
]);

export function roleForEmail(email: string | null | undefined): HomeRole {
  if (!email) return "viewer";
  const e = email.trim().toLowerCase();
  if (PARENT_EMAILS.has(e)) return "parent";
  if (e === STUDENT_EMAIL) return "student";
  if (EDITOR_EMAILS.has(e)) return "editor";
  if (TUTOR_EMAILS.has(e)) return "tutor";
  return "viewer";
}

export interface Capabilities {
  /** view today's plan, schedule, curriculum read-only */
  canRead: boolean;
  /** edit schedule blocks, add/remove assignments, mark done, upload work, leave notes */
  canEditSchedule: boolean;
  /** access AI generators, app accounts vault, settings except billing */
  canUseAdultTools: boolean;
  /** manage other users (invite/remove tutors), edit billing, rotate secrets */
  canManageBilling: boolean;
  /** complete a block as the student (counts toward Reagan's points) */
  canCompleteAsStudent: boolean;
}

export function capabilitiesFor(role: HomeRole): Capabilities {
  switch (role) {
    case "parent":
      return { canRead: true, canEditSchedule: true, canUseAdultTools: true, canManageBilling: true, canCompleteAsStudent: false };
    case "editor":
      return { canRead: true, canEditSchedule: true, canUseAdultTools: true, canManageBilling: false, canCompleteAsStudent: false };
    case "tutor":
      return { canRead: true, canEditSchedule: true, canUseAdultTools: true, canManageBilling: false, canCompleteAsStudent: false };
    case "student":
      return { canRead: true, canEditSchedule: false, canUseAdultTools: false, canManageBilling: false, canCompleteAsStudent: true };
    case "viewer":
    default:
      return { canRead: true, canEditSchedule: false, canUseAdultTools: false, canManageBilling: false, canCompleteAsStudent: false };
  }
}

/** Convenience: full role + capabilities packet. */
export function describeUser(email: string | null | undefined) {
  const role = roleForEmail(email);
  return { email: email || null, role, capabilities: capabilitiesFor(role) };
}
