/**
 * Tiny CSV parser tuned for the academic-records uploader.
 *
 * The user is most likely to paste a CSV exported from PowerSchool, Canvas,
 * Google Classroom gradebook, or a spreadsheet. We accept any subset of these
 * column names (case-insensitive, flexible header matching) and normalize them
 * to the academicRecords shape that academics.bulkUpsert expects.
 *
 * Supported headers (any of the synonyms work):
 *   title         | assignment | name
 *   subject       | subjectSlug
 *   course        | courseName | class
 *   term          | quarter    | semester
 *   year          | schoolYear
 *   grade (year)  | gradeLevel
 *   teacher
 *   score         | grade      | letter
 *   percent       | percentage | %
 *   dueDate       | due        | date
 *   summary       | notes      | comment
 *
 * No external CSV dep — handles quoted fields with embedded commas + escaped
 * double-quotes (RFC 4180 minus multi-line quoted fields).
 */

export type ParsedAcademicRow = {
  source: "manual";
  kind: "grade" | "assignment" | "note";
  title: string;
  subjectSlug?: string;
  courseName?: string;
  term?: string;
  schoolYear?: string;
  grade?: string;
  teacher?: string;
  scoreText?: string;
  scorePercent?: number;
  dueAt?: string;
  summary?: string;
};

const HEADER_ALIASES: Record<string, keyof ParsedAcademicRow | "skip"> = {
  title: "title", assignment: "title", name: "title", task: "title",
  subject: "subjectSlug", subjectslug: "subjectSlug",
  course: "courseName", coursename: "courseName", class: "courseName",
  term: "term", quarter: "term", semester: "term",
  year: "schoolYear", schoolyear: "schoolYear", "school year": "schoolYear",
  gradelevel: "grade", "grade level": "grade",
  teacher: "teacher", instructor: "teacher",
  score: "scoreText", letter: "scoreText", lettergrade: "scoreText",
  percent: "scorePercent", percentage: "scorePercent", "%": "scorePercent",
  duedate: "dueAt", due: "dueAt", date: "dueAt", "due date": "dueAt",
  summary: "summary", notes: "summary", note: "summary", comment: "summary",
  // "grade" alone is overloaded; default to scoreText since most exports use it for letter/score.
  grade: "scoreText",
};

function normaliseHeader(h: string): keyof ParsedAcademicRow | "skip" {
  const k = h.trim().toLowerCase();
  return HEADER_ALIASES[k] ?? "skip";
}

/** Parse one CSV line into raw cell strings (handles quotes + escaped quotes). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { buf += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { buf += c; }
    } else {
      if (c === '"') { inQ = true; }
      else if (c === ",") { out.push(buf); buf = ""; }
      else { buf += c; }
    }
  }
  out.push(buf);
  return out.map((s) => s.trim());
}

/** Parse a multi-line CSV string into normalized academic rows. */
export function parseAcademicsCsv(csv: string): ParsedAcademicRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normaliseHeader);
  const rows: ParsedAcademicRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length === 0) continue;
    const row: any = { source: "manual", kind: "grade", title: "" };
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (h === "skip") continue;
      const v = cells[c]?.trim();
      if (!v) continue;
      if (h === "scorePercent") {
        const n = Number(v.replace(/%/g, ""));
        if (!Number.isNaN(n)) row.scorePercent = n;
      } else {
        row[h] = v;
      }
    }
    if (!row.title) continue; // skip rows with no title
    rows.push(row);
  }
  return rows;
}
