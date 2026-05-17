/**
 * classroomDrivePathPlanner
 *
 * Pure (no I/O, no DB, no fetch) helper that owns the canonical Drive
 * folder layout for the Classroom integration. Mom's structure:
 *
 *     Reagan School Hub /
 *       Classes /
 *         {Class Name} /
 *           To Do /
 *           In Progress /
 *           Turned In /
 *           Graded /
 *
 * Two consumers will share this:
 *   1. The classroom-sync endpoint (later) which provisions subfolders
 *      when a new course shows up.
 *   2. The drive-push enqueue helper (next push) which knows where to
 *      MOVE a file when an assignment changes lifecycle status.
 *
 * The planner is intentionally pure so it can run in vitest without a
 * Drive API key, and so the same code can be reused by an external
 * worker that consumes drivePushQueue rows.
 */

export type ClassroomLifecycle = "to_do" | "in_progress" | "turned_in" | "graded";

/** Canonical English label for each lifecycle state, used as the Drive subfolder name. */
export const LIFECYCLE_FOLDER_NAME: Record<ClassroomLifecycle, string> = {
  to_do: "To Do",
  in_progress: "In Progress",
  turned_in: "Turned In",
  graded: "Graded",
};

/** Stable display order for UI columns + Drive folder enumeration. */
export const LIFECYCLE_ORDER: ClassroomLifecycle[] = ["to_do", "in_progress", "turned_in", "graded"];

/**
 * Sanitize a course name into something safe-ish for a Drive folder.
 * Drive itself accepts almost anything, but we trim, collapse whitespace,
 * strip slashes (so no accidental subfolder injection), and cap at 80 chars.
 * Returns null if nothing usable remains (caller should refuse to plan).
 */
export function sanitizeClassFolderName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.normalize("NFC").replace(/[\\/]+/g, "-").replace(/[\u0000-\u001F]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length === 0) return null;
  if (s.length > 80) s = s.slice(0, 80).trim();
  return s.length === 0 ? null : s;
}

export type ClassFolderPlan = {
  classFolderName: string;
  /** Path segments under the Hub root, e.g. ["Classes", "Math 5", "To Do"]. */
  pathSegments: string[];
  /** Joined POSIX-style path for logging / drivePushQueue.targetSubpath. */
  fullPath: string;
};

/**
 * Plan the path for one (course, lifecycleStatus) pair.
 *
 * @returns null if the course name sanitizes to empty.
 */
export function planClassroomDrivePath(
  courseName: string | null | undefined,
  status: ClassroomLifecycle,
): ClassFolderPlan | null {
  const safe = sanitizeClassFolderName(courseName);
  if (!safe) return null;
  const subfolder = LIFECYCLE_FOLDER_NAME[status];
  const segments = ["Classes", safe, subfolder];
  return {
    classFolderName: safe,
    pathSegments: segments,
    fullPath: segments.join("/"),
  };
}

/** Plan all four lifecycle subfolders for a course (used at provision time). */
export function planAllLifecycleSubfolders(
  courseName: string | null | undefined,
): ClassFolderPlan[] | null {
  const safe = sanitizeClassFolderName(courseName);
  if (!safe) return null;
  return LIFECYCLE_ORDER.map((status) => {
    const segments = ["Classes", safe, LIFECYCLE_FOLDER_NAME[status]];
    return {
      classFolderName: safe,
      pathSegments: segments,
      fullPath: segments.join("/"),
    };
  });
}

/**
 * Plan a MOVE: where the file lives now and where it should live after a
 * lifecycle transition. Both endpoints share the same class folder and
 * differ only in the lifecycle subfolder. Returns null if either status
 * is unknown or the course name is empty.
 *
 * Idempotent: if from === to, `fromPath === toPath` and the caller can
 * skip the move.
 */
export function planClassroomDriveMove(
  courseName: string | null | undefined,
  fromStatus: ClassroomLifecycle,
  toStatus: ClassroomLifecycle,
): { from: ClassFolderPlan; to: ClassFolderPlan; isNoop: boolean } | null {
  const from = planClassroomDrivePath(courseName, fromStatus);
  const to = planClassroomDrivePath(courseName, toStatus);
  if (!from || !to) return null;
  return { from, to, isNoop: from.fullPath === to.fullPath };
}
