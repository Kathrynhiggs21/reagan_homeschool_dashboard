/**
 * Push 125 (2026-05-13) — Reagan request box "open without mic" contract.
 *
 * Mom's rule, captured in project memory:
 *   "The 'request box' should open without requiring microphone activation
 *    or verbal prompts."
 *
 * Multiple surfaces can open the request box: the bottom-left "Make a
 * request" button, the Today page tap-target, the Slay Charge ⚡ "ask
 * about this" button, and Kiwi's contextual nudge. Each one carries a
 * different `trigger`. We do NOT want the box to silently grab the mic
 * the moment it opens — even if the device has mic permission, the open
 * flow must be tap/keyboard only and any voice path must be opt-in.
 *
 * This pure helper centralizes the "is this a clean no-mic open?"
 * decision so every entry-point agrees, and so the kid-app can render
 * the correct presets without a round-trip.
 *
 * No DB, no I/O. Inputs in, decision out.
 */
import {
  REAGAN_REQUEST_PRESETS,
  type ReaganRequestPreset,
  type ReaganRequestKind,
} from "./reaganRequestPresets";

/** Where the open call came from. */
export type RequestBoxTrigger =
  | "kid-fab-button"        // bottom-left "Make a request"
  | "today-tap-target"      // tap on Today's request strip
  | "slay-charge-ask"       // Slay Charge ⚡ "ask about this"
  | "kiwi-nudge"            // Kiwi suggested the kid open it
  | "settings-preview"      // adult-side preview of the kid card
  | "deeplink"              // ?openRequest=1 in URL
  | "unknown";

export type RequestBoxDenyReason =
  | "mic-required-trigger-not-allowed"
  | "kid-disabled-input"
  | "blank-trigger";

export interface RequestBoxOpenInput {
  trigger: RequestBoxTrigger;
  /**
   * If the kid has explicitly disabled tap-typing (e.g., motor-needs day
   * accommodation toggled in Settings), the box still opens but only
   * with the preset buttons — no free text field. Defaults to false.
   */
  kidTapInputDisabled?: boolean;
  /**
   * If the trigger arrived from a code path that *did* attempt to open
   * the mic before this helper ran, the helper rejects the open so we
   * never normalize a mic-required path. Defaults to false.
   */
  micWasAlreadyArmed?: boolean;
  /**
   * Optional pre-selected preset (e.g. Slay Charge ⚡ deep-links into
   * "assignment" with its own seed text).
   */
  preselectKind?: ReaganRequestKind;
}

export type RequestBoxOpenDecision =
  | {
      open: true;
      micArmed: false;
      // Render config the kid surface uses literally.
      surface: {
        showFreeText: boolean;
        showPresets: true;
        presets: ReadonlyArray<ReaganRequestPreset>;
        preselected: ReaganRequestPreset | null;
        // The bottom-left "🎙️ talk instead" button is shown only when
        // the trigger came from a non-Kiwi entry-point AND tap input is
        // enabled, so the kid can opt INTO voice if she wants.
        showOptInVoiceButton: boolean;
      };
    }
  | { open: false; reason: RequestBoxDenyReason };

const NO_MIC_TRIGGERS = new Set<RequestBoxTrigger>([
  "kid-fab-button",
  "today-tap-target",
  "slay-charge-ask",
  "kiwi-nudge",
  "settings-preview",
  "deeplink",
]);

export function decideRequestBoxOpen(
  input: RequestBoxOpenInput,
): RequestBoxOpenDecision {
  if (!input.trigger || (input.trigger as string).length === 0) {
    return { open: false, reason: "blank-trigger" };
  }

  if (input.micWasAlreadyArmed === true) {
    // Caller's mic-first path is the bug we exist to prevent.
    return { open: false, reason: "mic-required-trigger-not-allowed" };
  }

  if (!NO_MIC_TRIGGERS.has(input.trigger)) {
    return { open: false, reason: "mic-required-trigger-not-allowed" };
  }

  const tapDisabled = input.kidTapInputDisabled === true;
  const showFreeText = !tapDisabled;

  // Only block the open path entirely if BOTH tap and voice are off,
  // which would be a misconfiguration — render the presets-only surface
  // instead so the kid still has a way to send.
  // (Returning open=false here would silently strand her.)

  const preselected = input.preselectKind
    ? REAGAN_REQUEST_PRESETS.find((p) => p.kind === input.preselectKind) ?? null
    : null;

  const showOptInVoiceButton =
    !tapDisabled && input.trigger !== "kiwi-nudge";
  // We don't want Kiwi (whose own nudge is voice-adjacent) to also push
  // a "🎙️ talk instead" button — too easy to mistake as a mandatory mic.

  return {
    open: true,
    micArmed: false,
    surface: {
      showFreeText,
      showPresets: true,
      presets: REAGAN_REQUEST_PRESETS,
      preselected,
      showOptInVoiceButton,
    },
  };
}
