/**
 * Push 109 (2026-05-13) — Grandma-aware Sunday digest body composer.
 *
 * Pure helper that turns a week-summary snapshot into the digest's
 * subject + greeting + ordered section list, audience-aware. The same
 * snapshot powers Mom's copy and Grandma's copy, but the section
 * ordering and the close-line shift:
 *
 *   - Mom: subjects-first (math/ela/science) → mood snapshot → IEP
 *     coverage → off-plan captures → "what's queued for Monday"
 *   - Grandma: greeting-first ("Hi Grandma — here's Reagan's week"),
 *     then mood snapshot → big wins → IEP coverage → off-plan captures.
 *     Grandma does not see Monday's plan (operational, not viewer-facing).
 *
 * House rule: Grandma always gets the digest unless explicitly muted in
 * the Push 94 toggle. The composer doesn't decide whether to send — it
 * just shapes the body for whichever audience the caller picked.
 *
 * Pure, no DB, no I/O.
 */
import { isGrandmaEmail } from "./grandmaAudience";

export type DigestAudience = "mom" | "grandma" | "tutor" | "viewer";

export interface DigestSnapshot {
  weekStartIso: string;
  weekEndIso: string;
  /** Per-subject hours covered. */
  subjectHours: Record<string, number>;
  moodSummary: {
    /** 0..1 share of the week classified Green. */
    greenShare: number;
    yellowShare: number;
    redShare: number;
    /** Optional one-line human read. */
    headline?: string;
  };
  iepCoverageNote: string | null;
  offPlanCaptures: string[];
  /** Optional preview of next-week priorities (Mom-only). */
  mondayPreview?: string;
}

export type DigestSection =
  | { kind: "greeting"; text: string }
  | { kind: "moodSnapshot"; greenShare: number; yellowShare: number; redShare: number; headline?: string }
  | { kind: "subjectHours"; subjectHours: Record<string, number> }
  | { kind: "iepCoverage"; note: string }
  | { kind: "offPlanCaptures"; captures: string[] }
  | { kind: "mondayPreview"; preview: string }
  | { kind: "close"; text: string };

export interface DigestBody {
  audience: DigestAudience;
  subject: string;
  sections: DigestSection[];
}

export function audienceFromEmail(email: string | null | undefined): DigestAudience {
  if (isGrandmaEmail(email)) return "grandma";
  const lower = (email ?? "").trim().toLowerCase();
  if (lower === "spear.cpt@gmail.com" || lower === "blakehiggs@hotmail.com") return "mom";
  if (lower.endsWith("@tbd.local")) return "tutor";
  return "viewer";
}

function fmtRange(snap: DigestSnapshot): string {
  // Slice off the "T..." for cleanliness; the cron always passes Z-suffixed dates.
  const a = snap.weekStartIso.slice(0, 10);
  const b = snap.weekEndIso.slice(0, 10);
  return `${a} → ${b}`;
}

export function composeSundayDigestBody(input: {
  audience: DigestAudience;
  snapshot: DigestSnapshot;
}): DigestBody {
  const { audience, snapshot } = input;
  const sections: DigestSection[] = [];

  if (audience === "grandma") {
    sections.push({
      kind: "greeting",
      text: "Hi Grandma — here's Reagan's week.",
    });
  }

  // Mood comes early for Grandma (she cares about how Reagan is doing
  // before she cares about hours-by-subject); for Mom it goes after
  // subject hours so she can scan academics first.
  const moodSection: DigestSection = {
    kind: "moodSnapshot",
    greenShare: snapshot.moodSummary.greenShare,
    yellowShare: snapshot.moodSummary.yellowShare,
    redShare: snapshot.moodSummary.redShare,
    headline: snapshot.moodSummary.headline,
  };
  const subjectSection: DigestSection = {
    kind: "subjectHours",
    subjectHours: snapshot.subjectHours,
  };

  if (audience === "grandma") {
    sections.push(moodSection);
    sections.push(subjectSection);
  } else {
    sections.push(subjectSection);
    sections.push(moodSection);
  }

  if (snapshot.iepCoverageNote) {
    sections.push({ kind: "iepCoverage", note: snapshot.iepCoverageNote });
  }
  if (snapshot.offPlanCaptures.length > 0) {
    sections.push({
      kind: "offPlanCaptures",
      captures: snapshot.offPlanCaptures,
    });
  }
  // Monday preview: Mom-only operational detail; not for Grandma/tutor/viewer.
  if (audience === "mom" && snapshot.mondayPreview) {
    sections.push({ kind: "mondayPreview", preview: snapshot.mondayPreview });
  }

  // Close line is audience-specific.
  let closeText: string;
  if (audience === "grandma") {
    closeText =
      "Same paper trail Mom uses for IEP meetings — reply if anything looks off.";
  } else if (audience === "mom") {
    closeText = "Open the dashboard to drill into any subject.";
  } else if (audience === "tutor") {
    closeText = "Use this read to plan your next session with Reagan.";
  } else {
    closeText = "Read-only view — talk to Mom for anything you'd like changed.";
  }
  sections.push({ kind: "close", text: closeText });

  // Subject line is audience-aware too.
  let subject: string;
  if (audience === "grandma") {
    subject = `Reagan's week with Mom — ${fmtRange(snapshot)}`;
  } else if (audience === "mom") {
    subject = `Weekly digest — ${fmtRange(snapshot)}`;
  } else if (audience === "tutor") {
    subject = `Tutor weekly read — Reagan ${fmtRange(snapshot)}`;
  } else {
    subject = `Reagan's homeschool week — ${fmtRange(snapshot)}`;
  }

  return { audience, subject, sections };
}
