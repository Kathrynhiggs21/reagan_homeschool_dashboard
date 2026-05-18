/**
 * v2.39 (2026-05-18) — Top-level Drive README generator.
 *
 * Closes the open todo at todo.md line 116:
 *   "Top-level README.md describing the structure for any human browsing
 *    Drive directly."
 *
 * The README documents:
 *   - The 9 canonical top-level Hub subfolders the dashboard syncs into
 *   - The fully-resolved subfolder map (Daily Operations / Day Logs / ...)
 *   - The two house rules (no numbered folders, instructional-doc auto-update)
 *   - The trash policy
 *   - Pointers to dashboard URLs Mom + Grandma might want
 *
 * Pure build (no DB writes, no I/O); the caller enqueues into drivePushQueue.
 */

export type DriveReadmeInput = {
  /** ISO date the README was last regenerated. */
  generatedAtISO: string;
  /** The 9 Hub roots, keyed by canonical name. */
  hubFolders: Array<{
    name: string;
    appSettingKey: string; // e.g. "drive.folder.dailyOperations"
    subfolders: string[];
  }>;
  /** Optional: the live dashboard URL so the README can link back. */
  dashboardUrl?: string;
};

/**
 * Canonical Hub structure as documented in todo.md lines 87-115.
 * Order is intentional: Daily Operations first (most active), then
 * Assignments, Curriculum, Progress, Adventures, Admin, Printables,
 * Inbox, Todo (most static last).
 */
export const CANONICAL_DRIVE_HUBS: DriveReadmeInput["hubFolders"] = [
  {
    name: "Daily Operations",
    appSettingKey: "drive.folder.dailyOperations",
    subfolders: [
      "Day Logs",
      "Daily Agenda PDFs",
      "Recap Replies",
    ],
  },
  {
    name: "Assignments and Work",
    appSettingKey: "drive.folder.assignmentsAndWork",
    subfolders: [
      "Worksheets to Do",
      "Submitted Work",
      "Photos of Work",
    ],
  },
  {
    name: "Curriculum and Standards",
    appSettingKey: "drive.folder.curriculumAndStandards",
    subfolders: [
      "Topics Covered",
      "Coverage Snapshots",
      "Standards Library",
    ],
  },
  {
    name: "Progress and Reports",
    appSettingKey: "drive.folder.progressAndReports",
    subfolders: [
      "Weekly Digests",
      "Term Summaries",
      "Behavior + Mood Timeline",
      "Absences and Sick Days",
      "Analytics CSV Exports",
    ],
  },
  {
    name: "Adventures and Enrichment",
    appSettingKey: "drive.folder.adventuresAndEnrichment",
    subfolders: [
      "Adventures Library",
      "Field Trip Photos",
      "Reading Journal (Bookshelf log)",
    ],
  },
  {
    name: "Admin and Homeschool Records",
    appSettingKey: "drive.folder.adminAndHomeschoolRecords",
    subfolders: [
      "IEP Snapshots",
      "504 Plans",
      "Tutor Agreements",
      "Annual Notice of Intent",
      "PowerSchool Snapshot",
    ],
  },
  {
    name: "Printables and Resources",
    appSettingKey: "drive.folder.printablesAndResources",
    subfolders: [
      "Coloring Pages",
      "Reward Charts",
      "Master Worksheet Library",
      "Reagan's Books (cover scans + page refs)",
    ],
  },
  {
    name: "Inbox (Unsorted)",
    appSettingKey: "drive.folder.inbox",
    subfolders: [
      "Drop new things here",
    ],
  },
  {
    name: "Todo",
    appSettingKey: "drive.folder.todo",
    subfolders: [
      "Mom Todos",
      "Grandma Todos",
      "Tutor Todos",
    ],
  },
];

/**
 * Build the Drive root README markdown. Pure; callers can compare for
 * idempotency.
 */
export function buildDriveReadme(input: DriveReadmeInput): string {
  const lines: string[] = [];
  lines.push("# Reagan's Homeschool Drive — Folder Map");
  lines.push("");
  lines.push(
    `_Last regenerated: ${input.generatedAtISO} by the Reagan dashboard._`,
  );
  lines.push("");
  lines.push(
    "This folder is the canonical home for every file the dashboard mirrors out of Reagan's homeschool system. Mom + Grandma + tutors can browse it directly without opening the dashboard. The structure below is generated from the dashboard's `app_settings` so it always matches the live wiring.",
  );
  lines.push("");

  if (input.dashboardUrl) {
    lines.push(`**Dashboard:** ${input.dashboardUrl}`);
    lines.push("");
  }

  lines.push("## House rules");
  lines.push("");
  lines.push(
    "- **Never number folders.** Use plain, descriptive names only. Existing setup-packet PDFs (`00_README_…`, `01_Academic_Snapshot_…`) are kept as-is for historical reference, but no new numbered names are introduced anywhere.",
  );
  lines.push(
    "- **Instructional / how-to docs auto-update.** Any doc titled \"How to use…\", \"Tutor Handoff\", \"Grandma Guide\", \"Homeschool Hub README\", \"Onboarding\", \"Quick Start\", etc. is rewritten in place whenever the dashboard touches it — stale references (defunct emails, old folder paths, removed features) are corrected and missing newer features (recap email, Day Logs, mood timeline, Mom + Grandma always-edit, Slice 4.5 surfaces) are added. If both `.docx` and `.md` exist for the same doc, the `.docx` wins and the `.md` is trashed.",
  );
  lines.push(
    "- **Trash policy.** TRASH (not permanent-delete) any file that is clearly old (`_old`, `_v1`, `_backup`, `_copy`, drafts pre-2025), pure duplicate where canonical exists, references defunct accounts, has no homeschool relevance, is empty-test, or is AI scratch. Trash empty folders after moves. All trashes are recoverable for 30 days from Drive Trash.",
  );
  lines.push("");

  lines.push("## Folder map");
  lines.push("");
  for (const hub of input.hubFolders) {
    lines.push(`### ${hub.name}`);
    lines.push("");
    if (hub.subfolders.length === 0) {
      lines.push("_(no canonical subfolders yet)_");
    } else {
      for (const sub of hub.subfolders) {
        lines.push(`- ${hub.name} / ${sub}`);
      }
    }
    lines.push("");
  }

  lines.push("## Where common files land");
  lines.push("");
  lines.push("| File | Drive path |");
  lines.push("|---|---|");
  lines.push(
    "| Daily activity log | Daily Operations / Day Logs / {YYYY-MM} / {date} - Day Log.md |",
  );
  lines.push(
    "| Daily agenda PDF | Daily Operations / Daily Agenda PDFs / {YYYY-MM} / {date} - Agenda.pdf |",
  );
  lines.push(
    "| Grandma recap reply | Daily Operations / Recap Replies / {YYYY-MM} / {date} - {sender} - Recap.md |",
  );
  lines.push(
    "| Off-plan topic capture | Curriculum and Standards / Topics Covered / {YYYY-MM} / {date} - {subject} - {topic}.md |",
  );
  lines.push(
    "| Weekly digest | Progress and Reports / Weekly Digests / {YYYY-MM} / |",
  );
  lines.push(
    "| Submitted assignment | Assignments and Work / Submitted Work / {YYYY-MM} / |",
  );
  lines.push("");

  lines.push("## A note on syncing");
  lines.push("");
  lines.push(
    "All writes flow through `drivePushQueue` in the dashboard. When the dashboard saves a row (mom quick-entry, recap-reply parse, off-plan topic capture, block status flip), it enqueues a Drive push fire-and-forget; a scheduled worker drains the queue and writes the file into the right folder above. Two-way sync (Drive → dashboard) is on the Slice 4.5 roadmap.",
  );
  lines.push("");

  lines.push("## How to add a new top-level folder");
  lines.push("");
  lines.push(
    "Add the canonical name + subfolders to `server/_lib/driveReadme.ts` (`CANONICAL_DRIVE_HUBS`), persist the new folder ID under `app_settings['drive.folder.<key>']`, and rerun the README regeneration. The dashboard will pick it up automatically.",
  );
  lines.push("");

  return lines.join("\n");
}

/* ============================================================================
   Enqueue helper — fire-and-forget; uses lazy imports to dodge circular deps.
   ========================================================================== */

export type EnqueueDriveRootReadmeResult = {
  ok: boolean;
  alreadyQueued: boolean;
  bytes: number;
  reason?: string;
};

const README_FILENAME = "README.md";
const README_TARGET_FOLDER = "reagan" as const; // Drive root
const README_TARGET_SUBPATH: string | null = null; // root, no subpath

/**
 * Builds the README markdown using the live `CANONICAL_DRIVE_HUBS` constant
 * + an injected `generatedAtISO` (so tests are deterministic) + an optional
 * dashboard URL. Pure-ish: only reads the constant; no DB.
 */
export function buildDriveReadmeFromCanonical(
  generatedAtISO: string,
  dashboardUrl?: string,
): string {
  return buildDriveReadme({
    generatedAtISO,
    hubFolders: CANONICAL_DRIVE_HUBS,
    dashboardUrl,
  });
}

/**
 * Enqueue a fresh Drive root README into `drivePushQueue`. Idempotent on
 * exact contentText match: if a pending row already carries this exact
 * markdown, we no-op. Fire-and-forget — never throws.
 */
export async function enqueueDriveRootReadme(opts?: {
  generatedAtISO?: string;
  dashboardUrl?: string;
}): Promise<EnqueueDriveRootReadmeResult> {
  try {
    // Lazy imports to dodge circular deps (db.ts ↔ _lib/* ↔ schema).
    const [{ getDb }, schemaMod, drizzle] = await Promise.all([
      import("../db"),
      import("../../drizzle/schema"),
      import("drizzle-orm"),
    ]);
    const drivePushQueue = (schemaMod as any).drivePushQueue;
    const { and, eq } = drizzle as any;

    const generatedAtISO =
      opts?.generatedAtISO ?? new Date().toISOString().slice(0, 10);
    const md = buildDriveReadmeFromCanonical(generatedAtISO, opts?.dashboardUrl);
    const bytes = new TextEncoder().encode(md).length;
    const db = getDb();

    let alreadyQueued = false;
    try {
      const existing: any[] = await db
        .select()
        .from(drivePushQueue)
        .where(
          and(
            eq(drivePushQueue.targetFolder as any, README_TARGET_FOLDER as any),
            eq(drivePushQueue.fileName as any, README_FILENAME as any),
            eq(drivePushQueue.status as any, "pending" as any),
          ),
        );
      if (existing.some((row: any) => row?.contentText === md)) {
        alreadyQueued = true;
      }
    } catch (e) {
      // best-effort dedupe; fall through to insert
      console.warn(
        "[enqueueDriveRootReadme] dedupe lookup failed",
        (e as any)?.message ?? e,
      );
    }

    if (!alreadyQueued) {
      try {
        await db.insert(drivePushQueue).values({
          targetFolder: README_TARGET_FOLDER as any,
          targetSubpath: README_TARGET_SUBPATH,
          fileName: README_FILENAME,
          mimeType: "text/markdown",
          contentText: md,
          status: "pending" as any,
        } as any);
      } catch (eq) {
        console.warn(
          "[enqueueDriveRootReadme] enqueue failed",
          (eq as any)?.message ?? eq,
        );
        return { ok: false, alreadyQueued: false, bytes, reason: "insert-failed" };
      }
    }

    return { ok: true, alreadyQueued, bytes };
  } catch (e: any) {
    console.warn("[enqueueDriveRootReadme] failed", e?.message ?? e);
    return { ok: false, alreadyQueued: false, bytes: 0, reason: "exception" };
  }
}
