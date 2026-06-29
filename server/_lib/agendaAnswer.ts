/**
 * agendaAnswer.ts — General-purpose conversational answers for the AI Agenda
 * chat.
 *
 * The Agenda Editor chat used to ONLY emit schedule-edit ops. Anything that
 * wasn't an edit ("how is she doing in fractions?", "what did Reagan work on
 * last week?", "suggest a calm bird-themed afternoon", general homeschool /
 * parenting questions) fell through to an empty diff and a confusing "nothing
 * needed to change" reply.
 *
 * This module adds a real ANSWER mode:
 *   - `isLikelyQuestion()` — cheap heuristic the planner uses as a hint.
 *   - `gatherAnswerContext()` — pulls a compact, defensively-fetched snapshot
 *     of everything the assistant might reasonably need to answer a question
 *     about Reagan (profile, today's plan, mastery, weak topics, recent
 *     grades, recent mood, the adventure idea library).
 *   - `generateAgendaAnswer()` — asks the LLM for a warm, concrete, no-fluff
 *     reply grounded in that context.
 *
 * Design notes:
 *   - Every DB read is wrapped so a missing table / empty result NEVER throws.
 *     A question must always get an answer, even on a fresh DB.
 *   - The LLM is given a hard token cap + timeout so the chat never hangs.
 *   - The voice matches Mom's preference: direct, supportive, zero jargon,
 *     no "healer"-style lofty language.
 */
import { invokeLLM } from "../_core/llm";
import type { AgendaPlanContext } from "./agendaEditor";

/* ----------------------------------------------------------------------- */
/* Heuristics                                                              */
/* ----------------------------------------------------------------------- */

/**
 * Cheap, deterministic check: does this message look like a question or a
 * general request for information/ideas rather than a schedule edit?
 *
 * This is only a HINT. The LLM ultimately decides edit-vs-answer; this keeps
 * the deterministic fallback honest and lets tests assert routing without a
 * network call.
 */
export function isLikelyQuestion(message: string): boolean {
  const m = (message || "").trim().toLowerCase();
  if (!m) return false;

  // Ends with a question mark → almost always a question.
  if (m.endsWith("?")) return true;

  // Common question/answer-seeking openers.
  const questionOpeners = [
    "how ", "what ", "why ", "when ", "where ", "who ", "which ",
    "is she", "is reagan", "does she", "did she", "has she", "should i",
    "should we", "can you tell", "tell me", "explain", "summarize",
    "summarise", "how's", "hows", "how is", "how are", "how did",
    "what's", "whats", "what is", "what are", "what did", "what should",
    "any ideas", "give me ideas", "ideas for", "suggest", "recommend",
    "do you think", "i wonder", "remind me", "catch me up", "fill me in",
  ];
  if (questionOpeners.some((q) => m.startsWith(q) || m.includes(" " + q))) {
    // Guard: some edit phrasings start with "what" etc. but contain a clear
    // edit verb. If a strong edit verb is present, let the edit path handle it.
    if (!hasStrongEditVerb(m)) return true;
  }

  // "tell me a joke", "what's a fun fact" etc. — pure chit-chat is an answer.
  const chitChat = ["joke", "fun fact", "riddle", "story about", "tell reagan"];
  if (chitChat.some((c) => m.includes(c)) && !hasStrongEditVerb(m)) return true;

  return false;
}

/** Strong edit verbs that mean "change the schedule", not "answer me". */
function hasStrongEditVerb(m: string): boolean {
  const verbs = [
    "add ", "insert ", "remove ", "delete ", "drop ", "cancel ",
    "move ", "shift ", "swap ", "reschedule ", "push ", "shorten ",
    "lengthen ", "extend ", "trim ", "start at ", "begin at ",
    "make it ", "set ", "change the ", "reorder ", "rearrange ",
    "build me a", "rebuild", "make a worksheet", "make her a",
    "give her a worksheet", "queue ", "review fractions", "schedule ",
  ];
  return verbs.some((v) => m.includes(v));
}

/* ----------------------------------------------------------------------- */
/* Context assembly                                                        */
/* ----------------------------------------------------------------------- */

export type AnswerContext = {
  profileLine: string;
  todayLine: string;
  todayBlocks: string;
  skillProgress: string;
  weakTopics: string;
  recentGrades: string;
  recentMood: string;
  adventures: string;
};

/** Run a DB read defensively — return [] / null on any failure. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Assemble a compact, model-friendly context blob. `db` is injected so this
 * module stays test-friendly (the tests pass a stub) and avoids a hard import
 * cycle with the very large db.ts.
 */
export async function gatherAnswerContext(
  ctx: AgendaPlanContext,
  db: any,
): Promise<AnswerContext> {
  const profile = await safe<any>(() => db.getProfile?.() ?? null, null);
  const studentName = ctx.studentName || profile?.studentName || "Reagan";
  const grade = ctx.gradeLevel || profile?.gradeLevel || "5th grade";

  const profileLine =
    `${studentName} — ${grade}.` +
    (profile?.notes ? ` Notes: ${String(profile.notes).slice(0, 240)}` : "");

  const todayLine =
    `Today is ${ctx.dayLabel} (${ctx.date}).` +
    (ctx.tutorOfDayLabel ? ` Tutor today: ${ctx.tutorOfDayLabel}.` : "");

  const todayBlocks =
    ctx.blocks.length === 0
      ? "(no blocks scheduled yet today)"
      : ctx.blocks
          .map(
            (b, i) =>
              `${i + 1}. ${b.startTime ?? "(no time)"} (${b.durationMin}m) ` +
              `[${b.blockType}${b.subjectSlug ? "/" + b.subjectSlug : ""}] ` +
              `${b.title}${b.status && b.status !== "not_started" ? ` — ${b.status}` : ""}`,
          )
          .join("\n");

  // Skill progress (mastery per skill). Cap to a readable size.
  const sp = await safe<any[]>(() => db.listSkillsWithProgress?.() ?? [], []);
  const skillProgress =
    sp.length === 0
      ? "(no skill-progress data yet)"
      : sp
          .slice(0, 40)
          .map((r: any) => {
            const name = r.title || r.skillCode || r.name || "skill";
            const subj = r.subjectSlug ? `${r.subjectSlug}: ` : "";
            const score =
              r.masteryScore ?? r.score ?? r.progress ?? r.mastery ?? null;
            return `- ${subj}${name}${score != null ? ` = ${score}%` : ""}`;
          })
          .join("\n");

  const weak = await safe<any[]>(() => db.getAllWeakTopics?.() ?? [], []);
  const weakTopics =
    weak.length === 0
      ? "(no flagged weak topics)"
      : weak
          .slice(0, 15)
          .map(
            (w: any) =>
              `- ${w.subjectSlug ? w.subjectSlug + ": " : ""}${w.topicTitle || w.topicHandle} = ${w.masteryScore}%`,
          )
          .join("\n");

  const grades = await safe<any[]>(() => db.listAllBlockGrades?.(60) ?? [], []);
  const recentGrades =
    grades.length === 0
      ? "(no graded work recorded yet)"
      : grades
          .slice(0, 20)
          .map((g: any) => {
            const when = g.gradedAt
              ? new Date(g.gradedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "";
            return `- ${when ? when + ": " : ""}${g.subjectSlug ? g.subjectSlug + " " : ""}${g.title ?? "work"} = ${g.score}%`;
          })
          .join("\n");

  const mood = await safe<any[]>(() => db.listRecentMood?.(14) ?? [], []);
  const recentMood =
    mood.length === 0
      ? "(no recent mood entries)"
      : mood
          .slice(0, 12)
          .map((mm: any) => {
            const when = mm.loggedAt
              ? new Date(mm.loggedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "";
            const label = mm.mood || mm.zone || mm.label || "mood";
            return `- ${when ? when + ": " : ""}${label}${mm.note ? ` (${String(mm.note).slice(0, 80)})` : ""}`;
          })
          .join("\n");

  const advs = await safe<any[]>(
    () => db.listAdventuresFiltered?.({ favoritesOnly: false }) ?? [],
    [],
  );
  const adventures =
    advs.length === 0
      ? "(no adventure ideas saved yet)"
      : advs
          .slice(0, 30)
          .map((a: any) => {
            const tags = [
              a.kind,
              a.setting,
              a.energyLevel ? a.energyLevel + " energy" : null,
              a.isFavorite ? "★fav" : null,
              a.wishlistStatus,
            ]
              .filter(Boolean)
              .join(", ");
            return `- ${a.title}${tags ? ` [${tags}]` : ""}`;
          })
          .join("\n");

  return {
    profileLine,
    todayLine,
    todayBlocks,
    skillProgress,
    weakTopics,
    recentGrades,
    recentMood,
    adventures,
  };
}

/* ----------------------------------------------------------------------- */
/* Answer generation                                                       */
/* ----------------------------------------------------------------------- */

export const ANSWER_SYSTEM_PROMPT = `You are Kiwi, the friendly, sharp assistant inside Reagan's homeschool dashboard, talking with Reagan's mom (an adult). She asked you a QUESTION or for IDEAS — she is NOT asking you to edit the schedule right now, so DO NOT describe schedule changes as if you made them. Just answer.

Voice:
- Warm, direct, and concrete. No corporate jargon, no lofty "healer/journey/holistic" language, no hype.
- Talk like a knowledgeable friend who knows Reagan well.
- Match her mood: if she sounds stressed or down, lead with empathy ("that's no fun", "I hear you") before the substance.
- Keep it tight: 1–4 short paragraphs, or a short bullet list when listing options/ideas. Never pad.

Grounding:
- You are given a snapshot of Reagan's profile, today's plan, skill mastery, flagged weak topics, recent graded work, recent mood, and the saved adventure-idea library.
- Use SPECIFICS from that data when relevant (name the subject, the mastery %, the recent trend). If the data doesn't cover something, say so plainly and give your best general guidance — never invent numbers, grades, or events that aren't in the context.
- For "how is she doing in X" → cite the mastery %, weak topics, and recent grades for X, then a one-line read on the trend and one concrete next step.
- For "what did she do / work on" questions → summarize from today's blocks and recent graded work; if the window asked about isn't in the data, say what you can see and note the limit.
- For idea/suggestion requests (adventures, activities, a calm afternoon, bird-themed, etc.) → prefer items already in the adventure library when they fit, then add fresh ideas. Favor hands-on, offline, movement-based, multi-activity ideas over "sit in a chair" work, and keep them appropriate for an 11-year-old girl.
- For general homeschool/parenting/teaching questions → answer helpfully and practically.

Return PLAIN TEXT only (no markdown headers, no JSON). Short paragraphs and simple "- " bullets are fine.`;

/**
 * Generate a conversational answer to a non-edit message. Returns a plain
 * string. On timeout/error returns a graceful, honest fallback string.
 */
export async function generateAgendaAnswer(
  ctx: AgendaPlanContext,
  message: string,
  db: any,
  attachment?: { url: string; mimeType: string },
): Promise<string> {
  const c = await gatherAnswerContext(ctx, db);

  const contextBlob = [
    `PROFILE: ${c.profileLine}`,
    `WHEN: ${c.todayLine}`,
    "",
    "TODAY'S PLAN:",
    c.todayBlocks,
    "",
    "SKILL MASTERY:",
    c.skillProgress,
    "",
    "FLAGGED WEAK TOPICS:",
    c.weakTopics,
    "",
    "RECENT GRADED WORK:",
    c.recentGrades,
    "",
    "RECENT MOOD (last 14 days):",
    c.recentMood,
    "",
    "ADVENTURE IDEA LIBRARY:",
    c.adventures,
  ].join("\n");

  const userText = `${contextBlob}\n\n----\nMom asked: ${message}\n\nAnswer her directly.`;

  const userContent: any = attachment
    ? [
        { type: "text", text: userText },
        attachment.mimeType.startsWith("image/")
          ? { type: "image_url", image_url: { url: attachment.url, detail: "high" } }
          : { type: "file_url", file_url: { url: attachment.url, mime_type: attachment.mimeType } },
      ]
    : userText;

  const TIMEOUT_MS = 45_000;
  try {
    const resp: any = await Promise.race([
      invokeLLM({
        messages: [
          { role: "system", content: ANSWER_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 900,
      }),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("LLM_TIMEOUT")), TIMEOUT_MS),
      ),
    ]);
    const content = resp?.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .map((p: any) => (typeof p === "string" ? p : p?.text || ""))
              .join("")
          : "";
    const trimmed = (text || "").trim();
    if (trimmed) return trimmed;
    return "I read your question but didn't have enough to answer well — try giving me a little more detail.";
  } catch (err: any) {
    const isTimeout = String(err?.message || "").includes("LLM_TIMEOUT");
    return isTimeout
      ? "Sorry — that took too long to think through. Ask me again in a moment."
      : "I couldn't reach the assistant just now. Try again in a moment.";
  }
}
