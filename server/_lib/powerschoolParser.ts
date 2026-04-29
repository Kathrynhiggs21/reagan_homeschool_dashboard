/**
 * PowerSchool parser
 * ---------------------------------------------------------------
 * PowerSchool's parent portal supports two common "export" paths Mom would realistically use:
 *
 *   1. The **Grades and Attendance** page → she can copy the visible table and paste.
 *      Rows look like: Course name | Teacher | Q1..Q4/Exam/Final letter grades + percent
 *
 *   2. The **Assignment list** (teacher gradebook → "Class Grades" subpage) → pasted as a
 *      tab or pipe-separated block. Columns look like: Due | Category | Assignment | Score | Grade | %
 *
 * We accept either, plus a few freeform shapes we've seen teachers email. We're liberal:
 * we sniff a handful of cues ("Q1", "Due Date", "Assignment") to decide which parser to
 * run, and we return the structured rows along with an unparsed-lines list so the UI can
 * surface "here's what we couldn't read, want to fix it?" to Mom.
 *
 * No network calls, no DB writes — pure functions. Callers (tRPC procedure) own persistence.
 */

export type ParsedGrade = {
  term: string;
  course: string;
  teacher?: string;
  letter?: string;
  percent?: string;
  comments?: string;
};

export type ParsedAssignment = {
  course: string;
  category?: string;
  title: string;
  dueDate?: string;
  assignedDate?: string;
  score?: string;
  pointsPossible?: string;
  status?: string;
  teacherComment?: string;
};

export type PowerSchoolParseResult = {
  kind: "grades" | "assignments" | "mixed" | "unknown";
  grades: ParsedGrade[];
  assignments: ParsedAssignment[];
  unparsedLines: string[];
  notes: string[];
};

/** Liberally split a raw paste into clean non-empty lines. */
function toLines(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);
}

/** Split a row into cells using the most common delimiter we see in the input. */
function splitRow(line: string): string[] {
  // Prefer tabs (classic copy-paste from HTML tables)
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  // Then pipes (email report style)
  if (line.includes("|")) return line.split("|").map((c) => c.trim());
  // Then 2+ spaces (HTML text paste)
  if (/ {2,}/.test(line)) return line.split(/ {2,}/).map((c) => c.trim());
  // Fall back to comma — last because assignments often contain commas
  return line.split(",").map((c) => c.trim());
}

const GRADE_HEADER_HINTS = ["Q1", "Q2", "Q3", "Q4", "S1", "S2", "E1", "E2", "Final", "Exam"];
const ASSIGNMENT_HEADER_HINTS = [
  "Due Date",
  "Assigned",
  "Assignment",
  "Category",
  "Score",
  "Points",
];

function detectKind(lines: string[]): "grades" | "assignments" | "mixed" | "unknown" {
  const joined = lines.join(" | ").toLowerCase();
  const hasGradeHeader = GRADE_HEADER_HINTS.some((h) =>
    joined.includes(h.toLowerCase()),
  );
  const hasAssignmentHeader = ASSIGNMENT_HEADER_HINTS.some((h) =>
    joined.includes(h.toLowerCase()),
  );
  if (hasAssignmentHeader && hasGradeHeader) return "mixed";
  if (hasAssignmentHeader) return "assignments";
  if (hasGradeHeader) return "grades";
  return "unknown";
}

const PERCENT_RE = /^\d{1,3}(\.\d+)?\s*%?$/;
const LETTER_RE = /^[A-F][+-]?$/;
const DATE_RE = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;

function parseGradeRow(cells: string[]): ParsedGrade[] {
  // Classic shape: Course | Teacher | Q1 | Q2 | Q3 | Q4 | E1 | Final
  // Or: Course | Teacher | Current grade | Current % | comments
  if (cells.length < 3) return [];
  const course = cells[0];
  const teacher = cells[1];
  const rest = cells.slice(2);
  const grades: ParsedGrade[] = [];
  const TERMS = ["Q1", "Q2", "Q3", "Q4", "E1", "E2", "S1", "S2", "Y1"];
  rest.forEach((v, idx) => {
    if (!v) return;
    const term = TERMS[idx] || `slot${idx + 1}`;
    if (LETTER_RE.test(v)) {
      grades.push({ term, course, teacher, letter: v });
    } else if (PERCENT_RE.test(v)) {
      grades.push({ term, course, teacher, percent: v });
    } else if (/^[A-F][+-]?\s+\d{1,3}/.test(v)) {
      const [letter, ...pctParts] = v.split(/\s+/);
      grades.push({ term, course, teacher, letter, percent: pctParts.join(" ") });
    }
  });
  return grades;
}

function parseAssignmentRow(cells: string[], courseFallback: string): ParsedAssignment | null {
  // Accept variations but expect: Due | Category | Title | Score | Grade | %
  if (cells.length < 2) return null;
  const dateCell = cells.find((c) => DATE_RE.test(c));
  const percentCell = cells.find((c) => PERCENT_RE.test(c) && c.includes("%"));
  const letterCell = cells.find((c) => LETTER_RE.test(c));
  const scoreCell = cells.find((c) => /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(c));
  // Title is the longest cell that isn't one of the recognized scalars
  const skip = new Set([dateCell, percentCell, letterCell, scoreCell].filter(Boolean));
  const titleCandidate = cells
    .filter((c) => c && !skip.has(c))
    .sort((a, b) => b.length - a.length)[0];
  if (!titleCandidate) return null;
  const out: ParsedAssignment = {
    course: courseFallback,
    title: titleCandidate,
  };
  if (dateCell) out.dueDate = dateCell;
  if (percentCell) out.score = percentCell;
  if (letterCell) out.score = out.score ? `${out.score} (${letterCell})` : letterCell;
  if (scoreCell) out.pointsPossible = scoreCell.split("/")[1]?.trim();
  return out;
}

export function parsePowerSchoolPaste(raw: string): PowerSchoolParseResult {
  const lines = toLines(raw);
  const notes: string[] = [];
  const unparsedLines: string[] = [];
  const grades: ParsedGrade[] = [];
  const assignments: ParsedAssignment[] = [];

  if (lines.length === 0) {
    return { kind: "unknown", grades, assignments, unparsedLines, notes: ["Empty paste"] };
  }
  const kind = detectKind(lines);
  notes.push(`Detected kind: ${kind}`);

  // Track the "current course context" for assignment-style exports where one course
  // header precedes a block of assignment rows.
  let currentCourse = "Unknown course";

  const HEADER_WORDS = new Set([
    "course",
    "class",
    "assignment",
    "due date",
    "assigned",
    "category",
    "score",
    "grade",
    "teacher",
    "points",
    "final",
    "exam",
    "q1",
    "q2",
    "q3",
    "q4",
    "s1",
    "s2",
    "e1",
    "e2",
    "y1",
    "percent",
    "%",
  ]);
  for (const line of lines) {
    const cells = splitRow(line);
    // Skip column-header rows (all cells are classic header words)
    if (
      cells.length > 1 &&
      cells.every((c) => HEADER_WORDS.has(c.toLowerCase().trim()))
    ) {
      continue;
    }
    if (
      cells.length === 1 &&
      /^(course|class|assignment|due date|category|score|grade)\s*$/i.test(
        line.trim(),
      )
    ) {
      continue;
    }
    if (cells.length === 1) {
      // Probably a course header (e.g. "Math 5 — Mrs. Peterson")
      currentCourse = cells[0];
      continue;
    }
    if (kind === "grades" || kind === "mixed") {
      const g = parseGradeRow(cells);
      if (g.length > 0) {
        grades.push(...g);
        continue;
      }
    }
    if (kind === "assignments" || kind === "mixed") {
      const a = parseAssignmentRow(cells, currentCourse);
      if (a) {
        assignments.push(a);
        continue;
      }
    }
    unparsedLines.push(line);
  }

  if (grades.length === 0 && assignments.length === 0) {
    notes.push("Could not recognize any rows. Check the paste formatting.");
  }
  return { kind, grades, assignments, unparsedLines, notes };
}

/** Convenience: CSV-specific entry that runs the same parser — CSV is just a shape. */
export function parsePowerSchoolCsv(raw: string): PowerSchoolParseResult {
  return parsePowerSchoolPaste(raw);
}
