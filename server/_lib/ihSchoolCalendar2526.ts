/**
 * Indian Hill Exempted Village School District — 2025-2026 calendar.
 *
 * Source: official PDF "INDIAN HILL SCHOOL CALENDAR 2025-2026 (Updated June 25)"
 * https://www.indianhillschools.org/MenuItem/25-26DistrictMasterCalendar%20(UpdatedJune25).pdf
 *
 * Pulled 2026-05-17 to seed the `schoolCalendar` table so the forward
 * planner can stop scheduling on real off-days. Each row represents a
 * day Indian Hill is *not* in regular session for K-12 students. PD
 * Days, Conference Days, Flex Days, and Holidays all set isOff=true
 * because Reagan, as a homeschool student, treats any day Indian Hill
 * is closed as a "no peer school day" for joint-activity planning.
 *
 * Pure data; no DB calls. The seeder in `server/_lib/ihSchoolCalendarSeed.ts`
 * imports this and inserts via Drizzle.
 */

export type IHCalendarRow = {
  date: string;       // "YYYY-MM-DD"
  isOff: boolean;     // true for every row in this dataset
  label: string;      // human-readable label from the official PDF
  source: "Indian Hill 2025-26";
};

const SOURCE = "Indian Hill 2025-26" as const;

/** Helper to keep the dataset compact + readable below. */
function off(date: string, label: string): IHCalendarRow {
  return { date, isOff: true, label, source: SOURCE };
}

/**
 * Off-days for the 2025-2026 school year. Order: chronological.
 * Every date here is one Indian Hill is closed for K-12 students.
 */
export const IH_2025_26_OFF_DAYS: IHCalendarRow[] = [
  // ---- August 2025 ----
  off("2025-08-07", "Flex Day (No Report/School)"),
  off("2025-08-08", "Staff Development/Work Day"),
  off("2025-08-11", "Staff Development/Work Day"),
  off("2025-08-12", "Staff Development/Work Day (Students K-2 by appt only Aug 12-13)"),
  // Aug 13 = first day for grades 3-12 → in session
  // Aug 14 = K-2 by appointment only → treat as off for joint planning
  off("2025-08-14", "K-2 by appointment only (no full session)"),
  // Aug 15 = K-2 first day → in session

  // ---- September 2025 ----
  off("2025-09-01", "Labor Day (No School)"),

  // ---- October 2025 ----
  // Oct 9 = Quarter 1 Ends (still in session)
  off("2025-10-10", "Staff Development Day (No School)"),
  off("2025-10-13", "Indigenous Peoples Day (No School)"),
  off("2025-10-14", "Conference Day (No School for Students)"),
  // Oct 23 = Evening Conferences → still in session that day

  // ---- November 2025 ----
  // Nov 7 = Trimester 1 Ends (K-2) (still in session)
  off("2025-11-24", "Flex Day (No Report / No School)"),
  off("2025-11-25", "Flex Day (No Report / No School)"),
  off("2025-11-26", "Thanksgiving Break (No School)"),
  off("2025-11-27", "Thanksgiving Break (No School)"),
  off("2025-11-28", "Thanksgiving Break (No School)"),

  // ---- December 2025 ----
  // Dec 19 = Quarter 2 / Semester 1 Ends (still in session)
  off("2025-12-22", "Winter Break"),
  off("2025-12-23", "Winter Break"),
  off("2025-12-24", "Winter Break"),
  off("2025-12-25", "Winter Break"),
  off("2025-12-26", "Winter Break"),
  off("2025-12-29", "Winter Break"),
  off("2025-12-30", "Winter Break"),
  off("2025-12-31", "Winter Break"),

  // ---- January 2026 ----
  off("2026-01-01", "Winter Break"),
  off("2026-01-02", "Winter Break"),
  off("2026-01-05", "Staff Development Day (No School)"),
  // Jan 6 = School Resumes → in session
  off("2026-01-19", "Martin Luther King Jr. Day (No School)"),

  // ---- February 2026 ----
  off("2026-02-13", "Staff Development Day (No School)"),
  off("2026-02-16", "Presidents' Day (No School)"),
  // Feb 26 = Trimester 2 Ends (K-2) + K-5 Evening Conferences (still in session)
  off("2026-02-27", "Conference Day (K-5 Only)"),

  // ---- March 2026 ----
  // Mar 13 = Quarter 3 Ends (still in session)
  off("2026-03-30", "Spring Break (No School)"),
  off("2026-03-31", "Spring Break (No School)"),

  // ---- April 2026 ----
  off("2026-04-01", "Spring Break (No School)"),
  off("2026-04-02", "Spring Break (No School)"),
  off("2026-04-03", "Spring Break (No School)"),
  off("2026-04-06", "Spring Break (No School)"),
  // Apr 7 = School Resumes → in session

  // ---- May 2026 ----
  // May 21 = Last Day for Students (still in session that day)
  // May 22 = Last Day for Staff (no students)
  off("2026-05-22", "Last Day for Staff (no students)"),
];

/**
 * Pure helper: returns the dataset filtered to a [from, to] inclusive
 * window. Both bounds are "YYYY-MM-DD" strings; lexicographic
 * comparison is correct for this format.
 */
export function filterIH2526Window(
  rows: IHCalendarRow[],
  fromYmd?: string,
  toYmd?: string,
): IHCalendarRow[] {
  return rows.filter((r) => {
    if (fromYmd && r.date < fromYmd) return false;
    if (toYmd && r.date > toYmd) return false;
    return true;
  });
}
