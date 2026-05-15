/**
 * Wave-15 / Push 245 — kiwiVoicePolicyVersion
 *
 * Pure deterministic declarative version manifest of every active
 * Kiwi voice / guard push from the kiddy-creepy rewrite onward.
 * The adult review page shows this on its policy tab so Mom and
 * Grandma can verify which guards are running and trace any
 * change in Kiwi's behavior to a specific push number.
 *
 * Adult-tone copy rules enforced in vitests:
 *  - No exclamation marks
 *  - No forbidden voice words in any descriptions
 *  - Adult-readable single-sentence descriptions
 *
 * The manifest is intentionally hard-coded (not derived). The
 * source of truth for "what guards exist" is the helper files;
 * this is the source of truth for "what's claimed to exist", so a
 * diff between this list and the actual procedure surface flags
 * any drift between code and policy documentation.
 */

export type KiwiVoicePolicyStage =
  | "pre_gen"
  | "post_gen_text"
  | "post_gen_tts"
  | "audit"
  | "review";

export interface KiwiVoicePolicyEntry {
  pushId: number;
  stage: KiwiVoicePolicyStage;
  procedure: string | null; // null for pure helpers not wired
  description: string;
}

/**
 * Active manifest. Update this when a push lands so the policy
 * tab stays accurate.
 */
const ENTRIES: KiwiVoicePolicyEntry[] = [
  {
    pushId: 218,
    stage: "pre_gen",
    procedure: "today.kiwiVoiceSettings",
    description:
      "Resolves the system-prompt fragment, sentence cap, forbidden words and identity phrase for the active voice profile.",
  },
  {
    pushId: 224,
    stage: "post_gen_tts",
    procedure: "today.kiwiReadAloudPacing",
    description:
      "Returns rate, pitch and pause-after-period values for the Read speaker button, capped per profile.",
  },
  {
    pushId: 226,
    stage: "post_gen_tts",
    procedure: "today.kiwiTtsVoiceChoose",
    description:
      "Picks the installed browser voice from the device list, blocking kids and cartoon novelty voices.",
  },
  {
    pushId: 216,
    stage: "post_gen_text",
    procedure: "today.kiwiToneDriftCheck",
    description:
      "Scores the candidate reply for drift across four buckets and returns a safe fallback when flagged.",
  },
  {
    pushId: 228,
    stage: "post_gen_text",
    procedure: "today.kiwiNicknameGuard",
    description:
      "Redacts pet-name forms of address in vocative position while leaving the rest of the reply intact.",
  },
  {
    pushId: 220,
    stage: "post_gen_text",
    procedure: "today.kiwiResponseLengthCap",
    description:
      "Trims long replies at sentence boundaries with no padding and no mid-word cuts.",
  },
  {
    pushId: 230,
    stage: "post_gen_text",
    procedure: "today.kiwiFullPostGenPipeline",
    description:
      "Runs the post-gen sequence in order: drift check, nickname guard, length cap.",
  },
  {
    pushId: 237,
    stage: "pre_gen",
    procedure: "today.kiwiVoiceProfileResolve",
    description:
      "Routes the current panel to one of three voice profiles with a rationale string for the audit log.",
  },
  {
    pushId: 239,
    stage: "pre_gen",
    procedure: "today.kiwiPreGenBundle",
    description:
      "One-call pre-LLM bundle packing the profile resolution, voice settings and TTS pacing.",
  },
  {
    pushId: 232,
    stage: "audit",
    procedure: "today.kiwiVoiceAuditEntryBuild",
    description:
      "Builds the audit row from the pipeline result with severity and action list.",
  },
  {
    pushId: 234,
    stage: "audit",
    procedure: null,
    description:
      "Persists audit rows in the kiwiVoiceAuditEntries table with severity, actions JSON and source panel.",
  },
  {
    pushId: 236,
    stage: "audit",
    procedure: "today.kiwiVoiceAuditPersist",
    description:
      "One-call mutation that runs the pipeline, builds the row and writes it to storage.",
  },
  {
    pushId: 241,
    stage: "review",
    procedure: "today.kiwiFullRoundTripDryRun",
    description:
      "Adult dev tool: replays the full exchange on a pasted candidate without persisting anything.",
  },
  {
    pushId: 243,
    stage: "review",
    procedure: "today.kiwiVoiceAuditWeeklySummary",
    description:
      "Compact rollup of severity totals, action counts, top redacted nicknames and last major samples.",
  },
];

const STAGE_ORDER: KiwiVoicePolicyStage[] = [
  "pre_gen",
  "post_gen_text",
  "post_gen_tts",
  "audit",
  "review",
];

export interface KiwiVoicePolicyManifest {
  manifestVersion: string;
  entriesByStage: Record<KiwiVoicePolicyStage, KiwiVoicePolicyEntry[]>;
  entriesByPushId: KiwiVoicePolicyEntry[];
  totalActive: number;
  stages: KiwiVoicePolicyStage[];
}

/** A stable string version cut from the highest pushId in the manifest. */
function computeManifestVersion(entries: KiwiVoicePolicyEntry[]): string {
  if (entries.length === 0) return "v0";
  const maxPush = entries.reduce(
    (acc, e) => (e.pushId > acc ? e.pushId : acc),
    -Infinity,
  );
  return `v${maxPush}`;
}

export function getKiwiVoicePolicyManifest(): KiwiVoicePolicyManifest {
  // Make a fresh copy so callers can't mutate the source-of-truth.
  const entries = ENTRIES.map((e) => ({ ...e }));
  const entriesByStage: Record<KiwiVoicePolicyStage, KiwiVoicePolicyEntry[]> = {
    pre_gen: [],
    post_gen_text: [],
    post_gen_tts: [],
    audit: [],
    review: [],
  };
  for (const e of entries) {
    entriesByStage[e.stage].push(e);
  }
  // Sort each stage by pushId ascending so display is stable.
  for (const stage of STAGE_ORDER) {
    entriesByStage[stage].sort((a, b) => a.pushId - b.pushId);
  }
  const entriesByPushId = [...entries].sort((a, b) => a.pushId - b.pushId);
  return {
    manifestVersion: computeManifestVersion(entries),
    entriesByStage,
    entriesByPushId,
    totalActive: entries.length,
    stages: [...STAGE_ORDER],
  };
}
