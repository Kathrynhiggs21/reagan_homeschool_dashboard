/**
 * Push 94 (2026-05-13) — Weekly digest recipient toggle.
 *
 * Mom is permanent: she is the recipient of record and cannot be removed.
 * Grandma is on-by-default but Mom can mute her for a specific week (e.g.
 * Grandma is on vacation and asked Mom to pause Sunday emails).
 *
 * This module is the pure decision layer used by both the Sunday digest
 * send queue and the WeeklyDigestCard preview banner so they always
 * agree.
 *
 * No DB, no I/O.
 */
import type { SundayDigestRecipient } from "./sundayDigestSendQueue";

export interface DigestRecipientsInput {
  /** When false → Grandma is excluded from this week's send. */
  grandmaEnabled: boolean;
  /** Optional extras (e.g. Dad). Appended after the base set. */
  extras?: SundayDigestRecipient[];
}

export interface DigestRecipientsResolution {
  recipients: SundayDigestRecipient[];
  /** Human label for the WeeklyDigestCard footer. */
  summary: string;
  grandmaIncluded: boolean;
}

const MOM: SundayDigestRecipient = {
  email: "reaganhiggs910@gmail.com",
  displayName: "Mom (Reagan)",
  role: "mom",
};

const GRANDMA: SundayDigestRecipient = {
  email: "marcy.spear@gmail.com",
  displayName: "Grandma Marcy",
  role: "grandma",
};

/**
 * Resolve the digest recipient list given Mom's toggle decision.
 * Mom is permanent; Grandma is included unless explicitly disabled.
 */
export function resolveDigestRecipients(
  input: DigestRecipientsInput,
): DigestRecipientsResolution {
  const list: SundayDigestRecipient[] = [MOM];
  if (input.grandmaEnabled) list.push(GRANDMA);

  const extras = input.extras ?? [];
  // De-dup by email (case-insensitive) preserving order.
  const seen = new Set<string>(list.map((r) => r.email.trim().toLowerCase()));
  for (const e of extras) {
    const k = e.email.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      list.push(e);
    }
  }

  const names = list.map((r) => r.displayName).join(" + ");
  return {
    recipients: list,
    summary: `Sending to: ${names}`,
    grandmaIncluded: input.grandmaEnabled,
  };
}

/**
 * Convenience: should the WeeklyDigestCard surface the "Grandma muted for
 * this week" warning banner?
 */
export function grandmaMuteBanner(
  input: DigestRecipientsInput,
): { show: true; message: string } | { show: false } {
  if (!input.grandmaEnabled) {
    return {
      show: true,
      message:
        "Grandma is muted for this Sunday's digest. Toggle her back on before send if she wants the email.",
    };
  }
  return { show: false };
}
