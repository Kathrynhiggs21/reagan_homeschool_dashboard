/**
 * Reagan's Color-Coded Warning Zones — codified from the canonical
 * "Reagan Higgs - Color-Coded Warning Zones & Intervention Guide" (gdoc id
 * `1rNNqD_K7Uc6k_mZhqYAuDFlURZl8X83EEwun-OceD0s`, also preserved as PDF
 * `1olN5NlDQ3cHq_5SJ7wwOmnWjSsJpQ_sw` in `/Reagan Health/`).
 *
 * Single source of truth for:
 *   - Adult-side warning-zones reference card
 *   - The weights behind `wellnessScore.anxietyScore` (server/db.ts:902-913)
 *   - The Crisis Decision Tree adult-side card
 *   - The script tooltips Mom/Grandma see on a Yellow / Red mood log
 *
 * Adapted lightly for homeschool context (the doc was written for a school
 * teacher audience): "classroom" wording is preserved as-is for fidelity to
 * the IEP, but the dashboard renders "school space" interchangeably so the
 * tutor and Mom see homeschool-correct copy.
 */

export type WarningZone = "green" | "yellow" | "red" | "black";

export interface ZoneSignals {
  /** Stable canonical key, never localize / reword. */
  zone: WarningZone;
  /** Display label for adult cards. */
  label: string;
  /** Internal-state range from the doc (3-4/10, 5-7/10, 8-10/10). */
  internalState: { anxietyMin: number; anxietyMax: number; description: string };
  /** Observable signals adults will see. Bullet phrasing preserved verbatim
   *  so Mom/Grandma reading the doc and reading the dashboard see the same
   *  language. */
  observableSignals: string[];
  /** "Your Response" — what to DO in this zone. */
  response: string[];
  /** "DO NOT" — what to avoid. Anti-patterns that escalate Reagan. */
  avoid: string[];
  /** Numeric weight this zone contributes to anxietyScore when a single
   *  observation is logged for the day. */
  anxietyScoreWeight: number;
}

export const WARNING_ZONES: ReadonlyArray<ZoneSignals> = [
  {
    zone: "green",
    label: "🟢 Green — Managing",
    internalState: { anxietyMin: 3, anxietyMax: 4, description: "Anxiety present but manageable. Can access coping strategies." },
    observableSignals: [
      "Participating in class discussions (even if quiet)",
      "Completing work independently",
      "Making eye contact occasionally",
      "Sitting with peers / family at lunch",
      "Asking clarifying questions (rare but possible)",
      "Smiling or showing positive emotions",
      "Arriving to class on time",
      "Engaging with preferred activities (math, art)",
    ],
    response: [
      "Continue current accommodations",
      "Offer quiet praise privately",
      "Check in casually: 'How's it going?'",
      "Maintain predictable routines",
      'Document this as a "good day" for tracking',
    ],
    avoid: [
      'Reduce supports because she seems "fine"',
      "Call attention publicly to her success",
      "Make sudden changes to routine",
    ],
    anxietyScoreWeight: 0,
  },
  {
    zone: "yellow",
    label: "🟡 Yellow — Anxiety Rising",
    internalState: { anxietyMin: 5, anxietyMax: 7, description: "Beginning thought spirals, physical symptoms starting (stomach pain), fighting to stay present." },
    observableSignals: [
      "Excessive bathroom requests (2+ in an hour)",
      "Repeatedly checking clock",
      "Not starting work after 5+ minutes",
      "Fidgeting intensely (picking skin, tapping)",
      "Staring blankly at paper",
      'Saying "I don\'t know" to everything',
      "Shoulders hunched, body curled inward",
      "Erasing work repeatedly",
      "Whispering or mouthing words but not speaking",
    ],
    response: [
      "Approach privately within 2 minutes",
      'Use code phrase: "Let\'s take a brain break"',
      "Offer 2 choices",
      "Reduce academic demands immediately (cut assignment by 50% or scribe)",
      "Provide sensory support (fidget tool, movement break, allow standing)",
    ],
    avoid: [
      'Say "You\'re fine, just try"',
      'Leave her alone to "work through it"',
      "Add time pressure",
      "Compare to other students",
    ],
    anxietyScoreWeight: 15,
  },
  {
    zone: "red",
    label: "🔴 Red — Crisis Mode",
    internalState: { anxietyMin: 8, anxietyMax: 10, description: "Panic attack active or imminent. Cannot access logical thinking. Fight/flight/freeze activated." },
    observableSignals: [
      "Complete shutdown (not responding to name)",
      "Tears or on verge of tears",
      "Hands shaking",
      'Saying "I can\'t" repeatedly',
      "Head down on desk",
      "Rocking or repetitive movements",
      "Attempting to leave room",
      "Hyperventilating or breathing changes",
      'Saying "I\'m stupid" or self-harm statements',
      "Complete freeze response",
    ],
    response: [
      "Get to her eye level (crouch down)",
      'Say: "You\'re safe. I\'m here. We\'re going to help."',
      "Remove all academic materials from view",
      'Direct gently: "Let\'s go get some air"',
      "Take to a quiet space",
      "Contact support (counselor → nurse → Mom)",
    ],
    avoid: [
      "Try to reason or logic with her",
      "Ask her to explain what's wrong",
      "Leave her alone",
      'Send her to office as "discipline"',
      "Touch without permission",
    ],
    anxietyScoreWeight: 30,
  },
  {
    zone: "black",
    label: "⚫ Black — Emergency Protocol",
    internalState: { anxietyMin: 10, anxietyMax: 10, description: "Immediate safety concern." },
    observableSignals: [
      "Statements about wanting to die",
      "Self-harm behaviors (scratching, hitting self)",
      "Complete dissociation (unresponsive)",
      "Attempting to run from building",
      "Aggressive behavior (very rare for Reagan)",
      "Sustained hyperventilation (3+ minutes)",
    ],
    response: [
      "Stay with Reagan — Never leave alone",
      "Call crisis team immediately",
      "Contact Mom (Katy): 513-926-5808",
      "911 if imminent danger",
      "Document everything immediately after",
    ],
    avoid: [
      "Leave Reagan alone",
      "Delay calling for help",
    ],
    anxietyScoreWeight: 60,
  },
];

/** Look up a zone block by stable key. Throws if unknown so callers fail loudly. */
export function getWarningZone(zone: WarningZone): ZoneSignals {
  const z = WARNING_ZONES.find(w => w.zone === zone);
  if (!z) throw new Error(`Unknown warning zone: ${zone}`);
  return z;
}

/**
 * Crisis Decision Tree — codified from the canonical
 * "Reagan Higgs - Contact Protocol & Crisis Response Decision Tree.pdf"
 * (id `1g0bQYaE2dPO5H-zt7Wdpij_xtxiUg8n8`, in `/Reagan Health/`).
 *
 * 3-step protocol the adult-side panel renders as a sticky reference card.
 */
export interface CrisisProtocolStep {
  step: number;
  label: string;
  windowSeconds: { min: number; max: number };
  actions: string[];
}

export const CRISIS_PROTOCOL: ReadonlyArray<CrisisProtocolStep> = [
  {
    step: 1,
    label: "Immediate Safety",
    windowSeconds: { min: 0, max: 30 },
    actions: [
      "Get to her eye level (crouch down)",
      "Use calm, slow voice",
      'Say: "You\'re safe. I\'m here. We\'re going to help."',
      "Remove all academic materials from view",
    ],
  },
  {
    step: 2,
    label: "Remove from Situation",
    windowSeconds: { min: 30, max: 60 },
    actions: [
      '"Let\'s go get some air" (don\'t ask, gently direct)',
      "Take to a quiet space (counselor's office, quiet hallway, empty room)",
    ],
  },
  {
    step: 3,
    label: "Contact Support",
    windowSeconds: { min: 60, max: 120 },
    actions: [
      "School counselor / psychologist (first responder)",
      "School nurse (if physical symptoms)",
      "Mom (Katy): 513-926-5808",
    ],
  },
];

/**
 * Compute anxietyScore contribution from a list of observed zones for a day.
 * Replaces the legacy hard-coded `reds * 30 + yellows * 15` math in db.ts.
 * Cap at 100 to keep the dashboard widget bounded.
 */
export function anxietyContributionFromZones(observedZones: WarningZone[]): number {
  const total = observedZones.reduce((sum, z) => sum + getWarningZone(z).anxietyScoreWeight, 0);
  return Math.min(100, total);
}
