/**
 * In-memory mock of the subset of `server/db.ts` that
 * `_lib/autoGradeRunner.ts` calls. Test-only.
 */
let _subs: any[] = [];
let _keys: Map<number, any> = new Map();
export const __recordedGrades: any[] = [];
export const __masteryWrites: any[] = [];

export function __reset(): void {
  _subs = [];
  _keys = new Map();
  __recordedGrades.length = 0;
  __masteryWrites.length = 0;
}
export function __seedSubmission(s: any): void {
  _subs.push({ submissionType: "text", contentText: "", ...s });
}
export function __seedAnswerKey(blockId: number, key: any): void {
  _keys.set(blockId, key);
}

export async function listAssignmentSubmissions(_limit: number): Promise<any[]> {
  return _subs.slice();
}
export async function getAnswerKeyForBlock(blockId: number): Promise<any | null> {
  return _keys.get(blockId) ?? null;
}
export async function recordAutoGrade(patch: any): Promise<void> {
  __recordedGrades.push(patch);
}
export async function applyGradeToMastery(patch: any): Promise<void> {
  __masteryWrites.push(patch);
}
