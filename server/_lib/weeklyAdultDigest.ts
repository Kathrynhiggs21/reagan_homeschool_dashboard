/**
 * Wave-15 / Push 196 — weeklyAdultDigest
 *
 * PURE deterministic helper. Builds the Sunday-evening adult digest
 * (Mom + optionally Grandma). Never punitive. Effort > outcome.
 */

export type MoodLabel = "rough" | "okay" | "bright" | "joyful";

export interface AppUsageSample {
  appKey: string;
  appName: string;
  minutes: number;
  isoDate: string;
}

export interface MoodSample {
  isoDate: string;
  label: MoodLabel;
}

export interface BookFinishedEvent {
  title: string;
  isoDate: string;
}

export interface VaultStatusSample {
  overdueCount: number;
  dueSoonCount: number;
  isoTimestamp: string;
}

export interface AdultOptIn {
  role: "mom" | "grandma";
  email: string;
  optedIn: boolean;
}

export interface DigestInput {
  appUsage: AppUsageSample[];
  moods: MoodSample[];
  booksFinished: BookFinishedEvent[];
  vault: VaultStatusSample | null;
  nowIso: string;
  adults: AdultOptIn[];
}

export interface DigestParagraph {
  role: "mom" | "grandma";
  email: string;
  headline: string;
  highlights: string[];
  gentleAsk: string | null;
  notifyPayload: {
    category: "weekly_digest";
    title: string;
    content: string;
  };
}

export interface DigestResult {
  weekStartIso: string;
  weekEndIso: string;
  paragraphs: DigestParagraph[];
  skippedAdults: { role: "mom" | "grandma"; email: string; reason: string }[];
}

const MOOD_RANK: Record<MoodLabel, number> = {
  rough: 1,
  okay: 2,
  bright: 3,
  joyful: 4,
};

function inWindow(iso: string, startMs: number, endMs: number): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t >= startMs && t <= endMs;
}

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
  return `${dow} ${mon} ${d.getUTCDate()}`;
}

export function buildWeeklyAdultDigest(input: DigestInput): DigestResult {
  const nowMs = Date.parse(input.nowIso);
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const startMs = safeNowMs - 7 * 24 * 60 * 60 * 1000;
  const weekStartIso = new Date(startMs).toISOString();
  const weekEndIso = new Date(safeNowMs).toISOString();

  const usage = input.appUsage.filter((s) => inWindow(s.isoDate, startMs, safeNowMs));
  const moods = input.moods.filter((s) => inWindow(s.isoDate, startMs, safeNowMs));
  const books = input.booksFinished.filter((b) => inWindow(b.isoDate, startMs, safeNowMs));

  let topApp: { name: string; minutes: number } | null = null;
  if (usage.length > 0) {
    const totals = new Map<string, { name: string; minutes: number }>();
    for (const s of usage) {
      const existing = totals.get(s.appKey);
      if (existing) existing.minutes += s.minutes;
      else totals.set(s.appKey, { name: s.appName, minutes: s.minutes });
    }
    const ranked = Array.from(totals.values()).sort((a, b) => {
      if (b.minutes !== a.minutes) return b.minutes - a.minutes;
      return a.name.localeCompare(b.name);
    });
    topApp = ranked[0] ?? null;
  }

  let brightest: { isoDate: string; label: MoodLabel } | null = null;
  if (moods.length > 0) {
    brightest = [...moods].sort((a, b) => {
      if (MOOD_RANK[b.label] !== MOOD_RANK[a.label]) {
        return MOOD_RANK[b.label] - MOOD_RANK[a.label];
      }
      return a.isoDate.localeCompare(b.isoDate);
    })[0];
  }

  const booksCount = books.length;
  const isEmptyWeek = usage.length === 0 && moods.length === 0 && booksCount === 0;

  const vault = input.vault;
  const hasVaultAsk = !!vault && (vault.overdueCount > 0 || vault.dueSoonCount > 0);
  const gentleAsk = hasVaultAsk
    ? `When you have a minute this week: ${
        vault!.overdueCount > 0
          ? `${vault!.overdueCount} login${vault!.overdueCount === 1 ? "" : "s"} ${
              vault!.overdueCount === 1 ? "is" : "are"
            } past rotation`
          : `${vault!.dueSoonCount} login${vault!.dueSoonCount === 1 ? "" : "s"} ${
              vault!.dueSoonCount === 1 ? "is" : "are"
            } due for a fresh password soon`
      } — no rush, just a heads-up.`
    : null;

  const paragraphs: DigestParagraph[] = [];
  const skipped: DigestResult["skippedAdults"] = [];

  for (const adult of input.adults) {
    if (!adult.optedIn) {
      skipped.push({ role: adult.role, email: adult.email, reason: "not opted in" });
      continue;
    }

    const headline = isEmptyWeek
      ? `Hi ${adult.role === "mom" ? "Mom" : "Grandma"} — quiet week, just checking in.`
      : `Reagan had a strong week, ${adult.role === "mom" ? "Mom" : "Grandma"}.`;

    const highlights: string[] = [];
    highlights.push(
      topApp
        ? `Spent the most time on ${topApp.name} (${Math.round(topApp.minutes)} min).`
        : `No app time logged this week — that's okay.`,
    );
    highlights.push(
      brightest
        ? `Brightest day was ${formatDate(brightest.isoDate)} (${brightest.label}).`
        : `No mood notes this week.`,
    );
    highlights.push(
      booksCount > 0
        ? `Finished ${booksCount} book${booksCount === 1 ? "" : "s"}.`
        : `No books finished this week — reading time still counts.`,
    );

    const content = [
      headline,
      "",
      ...highlights.map((h) => `• ${h}`),
      gentleAsk ? "" : null,
      gentleAsk ? gentleAsk : null,
    ]
      .filter((line) => line !== null)
      .join("\n");

    paragraphs.push({
      role: adult.role,
      email: adult.email,
      headline,
      highlights,
      gentleAsk,
      notifyPayload: {
        category: "weekly_digest",
        title: `Reagan's week — ${formatDate(weekEndIso.slice(0, 10))}`,
        content,
      },
    });
  }

  return { weekStartIso, weekEndIso, paragraphs, skippedAdults: skipped };
}

export const __FOR_TEST__ = { MOOD_RANK, formatDate, inWindow };
