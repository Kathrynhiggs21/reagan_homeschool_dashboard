/**
 * Pure helper for the sidebar summer-break countdown.
 * Target date: June 5 of the current school year (last day of school for
 * Indian Hill ES is typically the first week of June).
 */
export function daysUntilSummerBreak(today: Date, breakMonth = 5, breakDay = 5): number {
  const year = today.getMonth() < breakMonth + 1 ? today.getFullYear() : today.getFullYear() + 1;
  // breakMonth is 0-indexed when passed to Date(); adjust if caller passed 1-indexed
  // Convention: breakMonth=5 means June (Date constructor 0-indexed).
  const target = new Date(year, breakMonth, breakDay);
  const ms = target.getTime() - today.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
