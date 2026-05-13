/**
 * Push 106 (2026-05-13) — Grandma viewer audience pure helper.
 *
 * Grandma Marcy already has the editor role (permissions.ts) so she can
 * write to schedule + assignments + uploads. But several surfaces need
 * to know "is this the Grandma audience?" without leaking that as the
 * generic "editor" tier — e.g. WeeklyDigestCard, recap email, mood
 * timeline snippet ("Mom + Grandma always see when snippet exists"), and
 * IEP plan footer copy.
 *
 * This module centralizes the predicate so we never grep for her email
 * in 17 places. If the family decides to add another grandparent later,
 * we change ONE list and every Grandma-aware surface picks it up.
 *
 * Pure module — no DB, no I/O.
 */
import { roleForEmail, type HomeRole } from "./permissions";

/** Grandparent emails that get Grandma-specific UI surfaces. */
export const GRANDMA_EMAILS: ReadonlyArray<string> = [
  "marcy.spear@gmail.com",
] as const;

const GRANDMA_SET = new Set<string>(GRANDMA_EMAILS.map((e) => e.toLowerCase()));

export type GrandmaAudience = "grandma" | "not-grandma";

export interface GrandmaAudienceDescriptor {
  audience: GrandmaAudience;
  email: string | null;
  /** Underlying home role (so callers don't need to call permissions twice). */
  homeRole: HomeRole;
  /** True iff Grandma is also a primary recipient of the Sunday digest. */
  isDigestRecipient: boolean;
  /** True iff Grandma should receive the recap email when day-log is empty. */
  isRecapEmailRecipient: boolean;
}

export function isGrandmaEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return GRANDMA_SET.has(email.trim().toLowerCase());
}

export function grandmaAudienceFor(
  email: string | null | undefined,
): GrandmaAudienceDescriptor {
  const normalized = (email ?? "").trim().toLowerCase() || null;
  const grandma = isGrandmaEmail(normalized);
  return {
    audience: grandma ? "grandma" : "not-grandma",
    email: normalized,
    homeRole: roleForEmail(normalized),
    // House rule from Pushes 94/95/97: Grandma is ALWAYS a primary
    // recipient of the Sunday digest by default, and ALWAYS the
    // recap-email recipient when a school day has no logged work.
    isDigestRecipient: grandma,
    isRecapEmailRecipient: grandma,
  };
}

/**
 * Decide whether a given UI surface should render its Grandma-specific
 * copy. Pulled out so a single mental model covers IEP footer copy,
 * recap-email, mood-timeline snippet allow-list, etc.
 */
export function shouldRenderGrandmaCopy(
  email: string | null | undefined,
): boolean {
  return grandmaAudienceFor(email).audience === "grandma";
}
