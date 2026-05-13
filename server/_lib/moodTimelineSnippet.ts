/**
 * Push 102 (2026-05-13) — Mood timeline click-to-snippet contract.
 *
 * When Mom or Grandma taps an hour bar in the MoodTimelineStrip, they
 * should see the transcript snippet Kiwi heard. Reagan herself must
 * NEVER see her own raw transcript (privacy + trauma-safe house rules).
 *
 * This pure helper resolves a (mood row, viewer) into a "snippet view"
 * descriptor with:
 *   - allowed: whether the snippet is visible to this viewer
 *   - reason: human readable explanation if hidden
 *   - snippet: the transcript text (only present when allowed)
 *
 * No DB, no I/O.
 */

export type Viewer = "mom" | "grandma" | "tutor" | "kid";

export interface MoodTimelineSnippetInput {
  /** Kiwi's transcript chunk for this hour, if any. */
  transcriptSnippet?: string | null;
  /** Whether Kiwi confirmed Reagan's voice was present. */
  reaganVoicePresent?: boolean;
  /** Adult-only flag set when the chunk was flagged as private. */
  privateFlagged?: boolean;
  viewer: Viewer;
}

export type SnippetView =
  | { allowed: true; snippet: string }
  | {
      allowed: false;
      reason:
        | "no-snippet"
        | "kid-not-allowed"
        | "tutor-needs-voice"
        | "privacy-flagged";
    };

export function resolveMoodTimelineSnippet(
  input: MoodTimelineSnippetInput,
): SnippetView {
  const trimmed = (input.transcriptSnippet ?? "").trim();

  // House rule: Reagan never sees her own raw transcript.
  if (input.viewer === "kid") {
    return { allowed: false, reason: "kid-not-allowed" };
  }

  if (input.privateFlagged) {
    return { allowed: false, reason: "privacy-flagged" };
  }

  if (!trimmed) {
    return { allowed: false, reason: "no-snippet" };
  }

  // Tutors only see snippets when Reagan's voice was confirmed —
  // otherwise it could be a private family conversation that Kiwi
  // overheard.
  if (input.viewer === "tutor" && !input.reaganVoicePresent) {
    return { allowed: false, reason: "tutor-needs-voice" };
  }

  return { allowed: true, snippet: trimmed };
}
