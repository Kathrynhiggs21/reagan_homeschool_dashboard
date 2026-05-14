/**
 * Push 163 (2026-05-14) — Deterministic worksheet grader.
 *
 * Reagan owns rules to live by:
 *   "Adult analytics must be 100% real — no seeded/demo/fake events."
 *   "Assignments fully operable + printable."
 *
 * Goal: when a worksheet has *typed* answers (Reagan typed "12" or "noun" or
 * "purple"), grade it WITHOUT any LLM — fully deterministic, fully testable,
 * fast, free, and never wrong because of a hallucination. The vision-graded
 * pipeline (camera-photo + LLM) is still the right tool for handwritten work;
 * this helper is for the typed path.
 *
 * Item kinds supported:
 *   - "fill-in"        : free text, normalized + accept-list
 *   - "multiple-choice": one-of choices, case-insensitive
 *   - "number"         : numeric, optional unit, optional tolerance
 *   - "boolean"        : true/false / yes/no
 *
 * Pure: no DB, no LLM, no clock dependency.
 */

export type WorksheetItemKind =
  | "fill-in"
  | "multiple-choice"
  | "number"
  | "boolean";

interface BaseItem {
  itemId: string;
  prompt: string;
  pointsMax?: number; // defaults to 1
}

export interface FillInItem extends BaseItem {
  kind: "fill-in";
  /** Canonical answer; comparison is normalized (lowercase, trimmed, collapsed
   *  whitespace, strip trailing punctuation). Optional accept-list adds
   *  alternates ("colour" alongside "color"). */
  expected: string;
  accept?: ReadonlyArray<string>;
}

export interface MultipleChoiceItem extends BaseItem {
  kind: "multiple-choice";
  /** Canonical correct choice. Comparison is case-insensitive and trims. */
  expected: string;
  /** Optional list of valid choices for sanity (helps catch typos in the
   *  question template). If provided, `expected` MUST be one of them. */
  choices?: ReadonlyArray<string>;
}

export interface NumberItem extends BaseItem {
  kind: "number";
  expected: number;
  /** Allowed +/- tolerance. Defaults to 0 (exact). */
  tolerance?: number;
  /** Optional unit Reagan must include for full credit ("cm", "kg"). */
  unit?: string;
  /** If true, half credit when number right but unit missing. Defaults true. */
  partialCreditForMissingUnit?: boolean;
}

export interface BooleanItem extends BaseItem {
  kind: "boolean";
  expected: boolean;
}

export type WorksheetItem =
  | FillInItem
  | MultipleChoiceItem
  | NumberItem
  | BooleanItem;

export interface ReaganAnswer {
  itemId: string;
  /** Raw typed answer string from Reagan; we normalize per item kind. */
  raw: string;
}

export interface GradedItemResult {
  itemId: string;
  prompt: string;
  kind: WorksheetItemKind;
  rawAnswer: string;
  expectedAnswer: string;
  pointsEarned: number;
  pointsMax: number;
  /** "right", "close", "wrong", "blank", "ungradable" */
  status: "right" | "close" | "wrong" | "blank" | "ungradable";
  /** Plain-English line for Mom + Reagan ("Right!" / "So close — you said 'colour', the answer key has 'color'"). */
  explanation: string;
}

export interface DeterministicGradeResult {
  totalPointsEarned: number;
  totalPointsMax: number;
  /** 0..100. */
  scorePct: number;
  /** Per-item breakdown, in the same order as `items`. */
  items: GradedItemResult[];
  /** Plain-English summary line for the kid summary email. */
  kidLine: string;
}

const NORMALIZE_PUNCT_RE = /[.,;:!?]+$/g;
const COLLAPSE_WS_RE = /\s+/g;

function normalizeText(s: string): string {
  return String(s ?? "").trim().toLowerCase().replace(NORMALIZE_PUNCT_RE, "").replace(COLLAPSE_WS_RE, " ");
}

function isBlank(s: string): boolean {
  return normalizeText(s).length === 0;
}

function parseNumberAndUnit(raw: string): { num: number | null; unit: string | null } {
  const cleaned = String(raw ?? "").trim().toLowerCase();
  if (cleaned.length === 0) return { num: null, unit: null };
  // Allow "$12.50", "12 cm", "12cm", "1,234", "-3.14", "12 °c"
  const stripped = cleaned.replace(/^\$+/, "").replace(/,/g, "");
  const m = stripped.match(/^(-?\d+(?:\.\d+)?)\s*([a-z°%]*)$/i);
  if (!m) return { num: null, unit: null };
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return { num: null, unit: null };
  const unit = m[2] ? m[2].toLowerCase() : null;
  return { num, unit };
}

function parseBoolean(raw: string): boolean | null {
  const n = normalizeText(raw);
  if (["true", "yes", "y", "t", "1"].includes(n)) return true;
  if (["false", "no", "n", "f", "0"].includes(n)) return false;
  return null;
}

function gradeFillIn(item: FillInItem, ans: ReaganAnswer): GradedItemResult {
  const max = item.pointsMax ?? 1;
  const norm = normalizeText(ans.raw);
  if (norm.length === 0) {
    return baseResult(item, ans, max, 0, "blank", "Left blank.");
  }
  const expected = normalizeText(item.expected);
  const accepts = (item.accept ?? []).map(normalizeText);
  const all = [expected, ...accepts];
  if (all.includes(norm)) {
    return baseResult(item, ans, max, max, "right", "Right!");
  }
  // close-call: differ by 1 letter or by trailing 's' / 'es'
  for (const cand of all) {
    if (cand.length > 0 && (cand === norm + "s" || cand === norm + "es" || norm === cand + "s" || norm === cand + "es")) {
      return baseResult(item, ans, max, max * 0.5, "close", `So close — you said "${ans.raw}", the answer key has "${item.expected}".`);
    }
  }
  return baseResult(item, ans, max, 0, "wrong", `Not quite — the answer is "${item.expected}".`);
}

function gradeMultipleChoice(item: MultipleChoiceItem, ans: ReaganAnswer): GradedItemResult {
  const max = item.pointsMax ?? 1;
  if (item.choices && !item.choices.map(normalizeText).includes(normalizeText(item.expected))) {
    return baseResult(item, ans, max, 0, "ungradable", "Question template error — expected answer is not in the choice list.");
  }
  const norm = normalizeText(ans.raw);
  if (norm.length === 0) return baseResult(item, ans, max, 0, "blank", "Left blank.");
  if (norm === normalizeText(item.expected)) return baseResult(item, ans, max, max, "right", "Right!");
  return baseResult(item, ans, max, 0, "wrong", `Not quite — the answer is "${item.expected}".`);
}

function gradeNumber(item: NumberItem, ans: ReaganAnswer): GradedItemResult {
  const max = item.pointsMax ?? 1;
  const { num, unit } = parseNumberAndUnit(ans.raw);
  if (num === null) {
    if (isBlank(ans.raw)) return baseResult(item, ans, max, 0, "blank", "Left blank.");
    return baseResult(item, ans, max, 0, "wrong", `Not quite — the answer is ${formatExpectedNumber(item)}.`);
  }
  const tol = Math.max(0, item.tolerance ?? 0);
  const numOk = Math.abs(num - item.expected) <= tol;
  const unitNeeded = !!item.unit;
  const expectedUnit = unitNeeded ? item.unit!.toLowerCase() : null;
  const unitOk = !unitNeeded || (unit !== null && unit === expectedUnit);

  if (numOk && unitOk) return baseResult(item, ans, max, max, "right", "Right!");
  if (numOk && unitNeeded && !unitOk) {
    const half = item.partialCreditForMissingUnit ?? true;
    if (half) {
      return baseResult(item, ans, max, max * 0.5, "close",
        `Number is right — don't forget the unit (${expectedUnit}).`);
    }
    return baseResult(item, ans, max, 0, "wrong", `Number is right but the unit must be ${expectedUnit}.`);
  }
  if (!numOk && tol > 0 && Math.abs(num - item.expected) <= tol * 2) {
    return baseResult(item, ans, max, max * 0.5, "close",
      `So close — the answer is ${formatExpectedNumber(item)}.`);
  }
  return baseResult(item, ans, max, 0, "wrong", `Not quite — the answer is ${formatExpectedNumber(item)}.`);
}

function gradeBoolean(item: BooleanItem, ans: ReaganAnswer): GradedItemResult {
  const max = item.pointsMax ?? 1;
  const parsed = parseBoolean(ans.raw);
  if (parsed === null) {
    if (isBlank(ans.raw)) return baseResult(item, ans, max, 0, "blank", "Left blank.");
    return baseResult(item, ans, max, 0, "wrong", `Not quite — the answer is ${item.expected ? "yes" : "no"}.`);
  }
  if (parsed === item.expected) return baseResult(item, ans, max, max, "right", "Right!");
  return baseResult(item, ans, max, 0, "wrong", `Not quite — the answer is ${item.expected ? "yes" : "no"}.`);
}

function formatExpectedNumber(item: NumberItem): string {
  const n = String(item.expected);
  if (item.unit) return `${n} ${item.unit}`;
  return n;
}

function baseResult(
  item: WorksheetItem,
  ans: ReaganAnswer,
  pointsMax: number,
  pointsEarned: number,
  status: GradedItemResult["status"],
  explanation: string,
): GradedItemResult {
  return {
    itemId: item.itemId,
    prompt: item.prompt,
    kind: item.kind,
    rawAnswer: ans.raw,
    expectedAnswer: String((item as any).expected),
    pointsEarned,
    pointsMax,
    status,
    explanation,
  };
}

function buildKidLine(scorePct: number, total: number, max: number): string {
  if (max === 0) return "Nothing was graded.";
  if (scorePct >= 90) return `You got ${total} of ${max}. Great job!`;
  if (scorePct >= 75) return `You got ${total} of ${max}. Good work!`;
  if (scorePct >= 60) return `You got ${total} of ${max}. We'll go over the tricky ones together.`;
  return `You got ${total} of ${max}. Let's slow down and try a few more together.`;
}

export function gradeWorksheet(
  items: ReadonlyArray<WorksheetItem>,
  answers: ReadonlyArray<ReaganAnswer>,
): DeterministicGradeResult {
  if (!Array.isArray(items)) throw new Error("gradeWorksheet: items must be an array");
  if (!Array.isArray(answers)) throw new Error("gradeWorksheet: answers must be an array");
  const ansById = new Map(answers.map((a) => [a.itemId, a]));
  const results: GradedItemResult[] = [];
  for (const item of items) {
    const ans = ansById.get(item.itemId) ?? { itemId: item.itemId, raw: "" };
    let r: GradedItemResult;
    switch (item.kind) {
      case "fill-in": r = gradeFillIn(item, ans); break;
      case "multiple-choice": r = gradeMultipleChoice(item, ans); break;
      case "number": r = gradeNumber(item, ans); break;
      case "boolean": r = gradeBoolean(item, ans); break;
      default:
        r = baseResult(item as WorksheetItem, ans, (item as WorksheetItem).pointsMax ?? 1, 0, "ungradable", "Unsupported item kind.");
    }
    results.push(r);
  }
  const totalPointsMax = results.reduce((s, r) => s + r.pointsMax, 0);
  const totalPointsEarned = results.reduce((s, r) => s + r.pointsEarned, 0);
  const scorePct = totalPointsMax === 0 ? 0 : Math.round((totalPointsEarned * 100) / totalPointsMax);
  const kidLine = buildKidLine(scorePct, totalPointsEarned, totalPointsMax);
  return { totalPointsEarned, totalPointsMax, scorePct, items: results, kidLine };
}
