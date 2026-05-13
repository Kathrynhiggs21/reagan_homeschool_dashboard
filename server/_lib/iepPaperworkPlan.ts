/**
 * Push 101 (2026-05-13) — IEP-paperwork PDF render-plan helper.
 *
 * Combines mood timeline + actuals coverage + Grandma share footer into
 * a single serializable planSpec the eventual PDF renderer consumes.
 * Pure module — deterministic, no DB. Mom can change wording in ONE
 * place and the entire IEP packet stays in sync.
 *
 * Why a plan-spec instead of "just render": Mom needs to preview the
 * exact contents before sharing with the district, Grandma, or the
 * tutoring agency. The renderer is downstream; this is the contract.
 */
import {
  bucketMoodRows,
  grandmaShareFooter,
  type MoodLogPdfRow,
} from "./moodLogPdfLabels";

export interface IepPlanInput {
  dateISO: string;
  /** Human-friendly date label, e.g. "May 13, 2026". */
  dateLabel: string;
  kidName?: string;
  /** Audience changes the visibility of certain sections. */
  audience: "iep-meeting" | "grandma-share" | "tutor-handoff";
  moodRows: MoodLogPdfRow[];
  coverage: {
    subject: string;
    plannedPct: number;
    effectivePct: number;
    offPlan?: boolean;
  }[];
  /** Behavior tags rolled up for the day. */
  behaviorTagsRollup?: { tag: string; count: number }[];
  /** Whether any Reagan-voice verified entries exist today. */
  hasReaganVoiceVerified?: boolean;
}

export interface IepPlanSection {
  id:
    | "header"
    | "mood-timeline"
    | "coverage"
    | "behavior-tags"
    | "voice-provenance-note"
    | "footer";
  title: string;
  visible: boolean;
  payload?: unknown;
}

export interface IepPlanSpec {
  dateISO: string;
  dateLabel: string;
  audience: IepPlanInput["audience"];
  kidName: string;
  sections: IepPlanSection[];
  /** Footer text — already audience-tailored. */
  footer: string;
}

export function buildIepPaperworkPlan(input: IepPlanInput): IepPlanSpec {
  const kidName = (input.kidName ?? "Reagan").trim() || "Reagan";
  const bucketed = bucketMoodRows(input.moodRows ?? []);
  const hasMood = bucketed.some((b) => b.rows.length > 0);
  const hasCoverage = (input.coverage ?? []).length > 0;
  const tags = input.behaviorTagsRollup ?? [];

  // Audience rules
  // - iep-meeting: ALL sections visible, full clinical voice. Footer = clinical.
  // - grandma-share: hide voice-provenance-note (too much detail); friendly footer with don't-repost.
  // - tutor-handoff: hide footer share warning (tutor is bound by agreement);
  //   show voice provenance only if hasReaganVoiceVerified.
  const audience = input.audience;

  const sections: IepPlanSection[] = [
    {
      id: "header",
      title: `${kidName} · Behavior + Mood Timeline · ${input.dateLabel}`,
      visible: true,
    },
    {
      id: "mood-timeline",
      title: "Mood timeline",
      visible: hasMood, // "Don't show if no info" house rule
      payload: bucketed,
    },
    {
      id: "coverage",
      title: "Subject coverage (planned vs effective)",
      visible: hasCoverage,
      payload: input.coverage,
    },
    {
      id: "behavior-tags",
      title: "Behavior tags rolled up",
      visible: tags.length > 0,
      payload: tags,
    },
    {
      id: "voice-provenance-note",
      title: "Voice-confirmed entries",
      visible:
        audience === "iep-meeting" ||
        (audience === "tutor-handoff" && !!input.hasReaganVoiceVerified),
      payload: {
        hasReaganVoiceVerified: !!input.hasReaganVoiceVerified,
        note:
          "Entries marked with the mic+Reagan badge were verified by Kiwi listening — Reagan's voice was audibly present and the content was classified as school work.",
      },
    },
    {
      id: "footer",
      title: "Footer",
      visible: true,
    },
  ];

  let footer = "";
  if (audience === "grandma-share") {
    footer = grandmaShareFooter({ dateLabel: input.dateLabel, kidName });
  } else if (audience === "iep-meeting") {
    footer = [
      `${kidName} · ${input.dateLabel}`,
      `Source-of-record paper trail. Generated from Reagan's Homeschool Dashboard.`,
    ].join("\n");
  } else {
    // tutor-handoff
    footer = [
      `${kidName} · ${input.dateLabel}`,
      `Tutor handoff snapshot — please confirm receipt and ask Mom before sharing.`,
    ].join("\n");
  }

  // Materialize footer into the section payload so the renderer doesn't
  // need a separate field.
  sections[sections.length - 1].payload = footer;

  return {
    dateISO: input.dateISO,
    dateLabel: input.dateLabel,
    audience,
    kidName,
    sections,
    footer,
  };
}

/** Convenience: which section ids will actually render given input. */
export function visibleIepSections(plan: IepPlanSpec): IepPlanSection["id"][] {
  return plan.sections.filter((s) => s.visible).map((s) => s.id);
}
