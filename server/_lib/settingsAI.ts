/**
 * Settings AI Helper — interprets a freeform adult instruction in the
 * Adult Settings page and emits a structured "patch" the page can apply.
 *
 * Why a separate lib (instead of just calling invokeLLM inline in the router):
 *   - the schema of allowed ops is small and stable (prefs.set, tutor.upsert,
 *     reagan.update, theme switch) so we keep it here and force the LLM to a
 *     strict JSON schema,
 *   - the front end can show the patch as a preview-card with one-tap Apply
 *     before the change actually fires.
 *
 * Note: the *application* of these ops is handled in the router (which calls
 * the existing prefs/tutors/reagan mutations). This lib stays pure so it's
 * trivially testable.
 */
import { invokeLLM } from "../_core/llm";

export type SettingsAIOp =
  | { kind: "prefs.set"; key: string; value: string | null; reason?: string }
  | { kind: "tutor.upsert"; id?: number; name: string; role?: string; subjects?: string; active?: boolean; notes?: string; reason?: string }
  | { kind: "reagan.note"; text: string }     // free-form adult note (no DB write)
  | { kind: "ask"; question: string };        // model needs clarification

export type SettingsAIPlan = {
  summary: string;
  ops: SettingsAIOp[];
  warnings: string[];
};

export type SettingsAIContext = {
  reagan: { name: string; gradeLevel: string | null } | null;
  tutors: Array<{ id: number; name: string; role: string | null; subjects: string | null; active: boolean }>;
  prefs: Record<string, string | null>;          // current snapshot of common prefs (theme, kiwi voice, quiet hours, etc.)
  voicePresets: string[];                        // enumerable list of supported Kiwi voices
  themes: string[];                              // enumerable list of supported themes
};

/** Allowlist of pref keys the AI is permitted to touch. */
export const SETTINGS_AI_PREFS_ALLOW = [
  "ui.theme",
  "kiwi.voice",
  "kiwi.silent",
  "kiwi.cartoonVoice",
  "kiwi.wakeWord",
  "quietHours.start",
  "quietHours.end",
  "roblox.allowed",
  "notifications.evening8pm",
] as const;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One short sentence of what will change." },
    ops: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["prefs.set", "tutor.upsert", "reagan.note", "ask"] },
          key: { type: "string" },
          value: { type: ["string", "null"] },
          id: { type: "number" },
          name: { type: "string" },
          role: { type: "string" },
          subjects: { type: "string" },
          active: { type: "boolean" },
          notes: { type: "string" },
          text: { type: "string" },
          question: { type: "string" },
          reason: { type: "string" },
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "ops", "warnings"],
  additionalProperties: false,
};

export function validateSettingsAIPlan(raw: unknown, ctx: SettingsAIContext): SettingsAIPlan {
  const plan = raw as SettingsAIPlan;
  const out: SettingsAIPlan = { summary: plan?.summary ?? "", ops: [], warnings: [] };
  if (Array.isArray(plan?.warnings)) out.warnings.push(...plan.warnings.filter(w => typeof w === "string"));

  for (const op of plan?.ops ?? []) {
    if (!op || typeof op !== "object") continue;
    if (op.kind === "prefs.set") {
      if (!SETTINGS_AI_PREFS_ALLOW.includes(op.key as any)) {
        out.warnings.push(`Skipped pref "${op.key}" — not in allowlist.`);
        continue;
      }
      if (op.key === "ui.theme" && op.value && !ctx.themes.includes(op.value)) {
        out.warnings.push(`Theme "${op.value}" not recognized; skipped.`);
        continue;
      }
      if (op.key === "kiwi.voice" && op.value && !ctx.voicePresets.includes(op.value)) {
        out.warnings.push(`Voice "${op.value}" not recognized; skipped.`);
        continue;
      }
      out.ops.push({ kind: "prefs.set", key: op.key, value: op.value ?? null, reason: op.reason });
    } else if (op.kind === "tutor.upsert") {
      if (!op.name || typeof op.name !== "string") continue;
      out.ops.push({
        kind: "tutor.upsert",
        id: typeof op.id === "number" ? op.id : undefined,
        name: op.name.trim(),
        role: typeof op.role === "string" ? op.role : undefined,
        subjects: typeof op.subjects === "string" ? op.subjects : undefined,
        active: typeof op.active === "boolean" ? op.active : undefined,
        notes: typeof op.notes === "string" ? op.notes : undefined,
        reason: op.reason,
      });
    } else if (op.kind === "reagan.note") {
      if (typeof op.text === "string" && op.text.trim()) {
        out.ops.push({ kind: "reagan.note", text: op.text.trim() });
      }
    } else if (op.kind === "ask") {
      if (typeof op.question === "string" && op.question.trim()) {
        out.ops.push({ kind: "ask", question: op.question.trim() });
      }
    }
  }
  return out;
}

export async function generateSettingsAIPlan(
  ctx: SettingsAIContext,
  instruction: string,
): Promise<SettingsAIPlan> {
  const tutorList = ctx.tutors.map(t => `${t.id}: ${t.name}${t.role ? " (" + t.role + ")" : ""}${t.active ? "" : " [inactive]"}`).join("; ");
  const prefsBlock = Object.entries(ctx.prefs)
    .map(([k, v]) => `  ${k} = ${v === null ? "(unset)" : JSON.stringify(v)}`)
    .join("\n");
  const system = [
    "You are the Settings assistant for an adult-side homeschool dashboard.",
    "Read the adult's natural-language request, then emit a concise EditPlan that uses ONLY the allowed ops.",
    "",
    "Allowed ops:",
    "  prefs.set     — change one allowlisted preference (key, value)",
    "  tutor.upsert  — add a new tutor (no id) or update an existing one (with id)",
    "  reagan.note   — record an adult observation/note that the page should display in a card",
    "  ask           — when the request is ambiguous and you need clarification before changing anything",
    "",
    `Allowed pref keys: ${SETTINGS_AI_PREFS_ALLOW.join(", ")}`,
    `Allowed themes: ${ctx.themes.join(", ")}`,
    `Allowed Kiwi voices: ${ctx.voicePresets.join(", ")}`,
    "",
    "Current state:",
    `  Reagan: ${ctx.reagan ? ctx.reagan.name + (ctx.reagan.gradeLevel ? " (" + ctx.reagan.gradeLevel + ")" : "") : "(unknown)"}`,
    `  Tutors: ${tutorList || "(none)"}`,
    "  Prefs:",
    prefsBlock || "    (none)",
    "",
    "Rules:",
    "  - Be conservative. If the user says something destructive ('delete all tutors'), use ask:",
    "  - Never invent settings keys. If unsure, use ask:",
    "  - Keep summary < 120 chars.",
    "  - Use empty ops list when the request is purely informational; explain in summary.",
  ].join("\n");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: instruction },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "settings_ai_plan", strict: true, schema: RESPONSE_SCHEMA },
    },
  });

  const text = (response as any)?.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown = {};
  try { parsed = typeof text === "string" ? JSON.parse(text) : text; } catch { parsed = {}; }
  return validateSettingsAIPlan(parsed, ctx);
}
