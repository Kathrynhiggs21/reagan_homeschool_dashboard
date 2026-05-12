/**
 * Reagan's "What Works vs What Doesn't Work" matrix — codified from the
 * canonical "Reagan Higgs - What Works vs What Doesn't Work (Master Guide)"
 * (gdoc id `1mDhViuDv5g24nZj9o93-Wjymu33kBCII_ZsCMMRHq6w`, also preserved
 * as `.docx` in `/Reagan Health/`).
 *
 * Used by:
 *   - The AI Agenda Editor as adaptive recommendations injected into the
 *     prompt every time Mom or Grandma says "she's anxious today" or
 *     "shorten everything"
 *   - The adult-side script tooltips that show on hovering a Yellow / Red
 *     mood log entry
 *   - Vitest fixtures for the agenda generator (so the model has consistent
 *     guidance across regenerations)
 */

export type WhatWorksSituation =
  | "morning_arrival"
  | "writing_tasks"
  | "anxiety_rising"
  | "during_crisis"
  | "mistakes_made"
  | "testing";

export interface WhatWorksRow {
  situation: WhatWorksSituation;
  /** Display label for adult cards. */
  label: string;
  /** What does NOT work (anti-patterns to avoid). */
  doesNotWork: string[];
  /** What DOES work (proven strategies). */
  doesWork: string[];
}

export const WHAT_WORKS_MATRIX: ReadonlyArray<WhatWorksRow> = [
  {
    situation: "morning_arrival",
    label: "Morning Arrival",
    doesNotWork: ['Rushing', '"Hurry up"', "Comparing to others"],
    doesWork: ["Extra time", "Calm greeting", "Preview day"],
  },
  {
    situation: "writing_tasks",
    label: "Writing Tasks",
    doesNotWork: ['"Just try"', "Timed work", "Peer sharing"],
    doesWork: ["Verbal first", "Scribe support", "Celebrate attempts"],
  },
  {
    situation: "anxiety_rising",
    label: "Anxiety Rising (Yellow Zone)",
    doesNotWork: ['"You\'re fine"', "Ignoring signs", "Pushing through"],
    doesWork: ["Early intervention", "Breaks", "Modify immediately"],
  },
  {
    situation: "during_crisis",
    label: "During Crisis (Red Zone)",
    doesNotWork: ['"Calm down"', "Reasoning", "Leaving alone"],
    doesWork: ["Presence", "Safety words", "Contact parent"],
  },
  {
    situation: "mistakes_made",
    label: "Mistakes Made",
    doesNotWork: ["Public correction", '"You knew this"'],
    doesWork: ["Private support", "Normalize errors", "Growth mindset"],
  },
  {
    situation: "testing",
    label: "Testing",
    doesNotWork: ["Surprise assessments", "Time limits"],
    doesWork: ["Advance notice", "Separate space", "Unlimited time"],
  },
];

export function getWhatWorksRow(situation: WhatWorksSituation): WhatWorksRow {
  const row = WHAT_WORKS_MATRIX.find(r => r.situation === situation);
  if (!row) throw new Error(`Unknown situation: ${situation}`);
  return row;
}

/**
 * Render the matrix as a compact AI-Agenda-Editor system message addendum.
 * Called from the agenda generator prompt path so every regeneration has
 * the same guidance baked in.
 */
export function whatWorksPromptAddendum(): string {
  const lines: string[] = [
    "REAGAN-SPECIFIC GUIDANCE (from the IEP-aligned 'What Works' Master Guide):",
  ];
  for (const row of WHAT_WORKS_MATRIX) {
    lines.push(`- ${row.label}:`);
    lines.push(`    AVOID: ${row.doesNotWork.join("; ")}`);
    lines.push(`    DO: ${row.doesWork.join("; ")}`);
  }
  return lines.join("\n");
}
