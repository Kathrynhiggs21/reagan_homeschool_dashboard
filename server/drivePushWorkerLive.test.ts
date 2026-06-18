/**
 * Live Drive push worker tests.
 *
 * These exercise the real drain logic (folder resolution → name dedupe →
 * inline/binary upload → exactly-one result) without any network, by
 * injecting a fake DriveClient and a fake WorkerDeps. The credential gate is
 * satisfied with a dummy OAuth token; no real credential is ever used.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  runDrivePushWorker,
  runDrivePushOnce,
  type WorkerDeps,
} from "./_lib/drivePushWorker";
import type { DriveClient, DriveChild } from "./_lib/driveClient";

/* ---------- Fakes ---------- */

function makeFakeDrive(opts?: {
  existingByParent?: Record<string, DriveChild[]>;
}) {
  const folders: Record<string, DriveChild[]> = opts?.existingByParent ?? {};
  const created: Array<{ parentId: string; name: string; id: string }> = [];
  const uploaded: Array<{ parentId: string; name: string; mimeType: string; isText: boolean; bytes?: number }> = [];
  let nextId = 1;

  const drive: DriveClient = {
    async listChildren(parentId, o) {
      const all = folders[parentId] ?? [];
      return o?.foldersOnly
        ? all.filter((c) => c.mimeType === "application/vnd.google-apps.folder")
        : all;
    },
    async createFolder(parentId, name) {
      const id = `folder-${nextId++}`;
      created.push({ parentId, name, id });
      (folders[parentId] ??= []).push({ id, name, mimeType: "application/vnd.google-apps.folder" });
      return id;
    },
    async uploadFile(args) {
      const id = `file-${nextId++}`;
      uploaded.push({
        parentId: args.parentId,
        name: args.name,
        mimeType: args.mimeType,
        isText: args.contentText != null,
        bytes: args.contentBytes?.length,
      });
      (folders[args.parentId] ??= []).push({ id, name: args.name, mimeType: args.mimeType });
      return { id };
    },
  };

  return { drive, folders, created, uploaded };
}

function makeFakeDeps(rows: any[], overrides?: Partial<WorkerDeps>) {
  const results: Array<{ id: number; status: string; driveFileId?: string | null; errorMessage?: string | null }> = [];
  const persisted: Record<string, string | null> = {};
  const deps: WorkerDeps = {
    listPendingDrivePushes: async (limit) => rows.slice(0, limit) as any,
    markDrivePushResult: async (args) => {
      results.push(args);
      return undefined;
    },
    getCanonicalParentForRoutable: async (target) => {
      const map: Record<string, { slug: string; folderId: string | null }> = {
        day_log: { slug: "dailyOperations", folderId: "PARENT_DAILY" },
        agenda_pdf: { slug: "dailyOperations", folderId: "PARENT_DAILY" },
        reagan: { slug: "inboxUnsorted", folderId: "PARENT_INBOX" },
        worksheets: { slug: "assignmentsAndWork", folderId: "PARENT_ASSIGN" },
      };
      return (map[target] ?? { slug: "inboxUnsorted", folderId: "PARENT_INBOX" }) as any;
    },
    getCanonicalSubfolderId: async (_parent, sub) => {
      // Day Logs is pre-resolved; everything else must be discovered/created.
      if (sub === "Day Logs") return "SUB_DAYLOGS";
      return null;
    },
    setAppSetting: async (k, v) => {
      persisted[k] = v;
    },
    CANONICAL_PARENT_NAMES: {
      dailyOperations: "Daily Operations",
      inboxUnsorted: "Inbox (Unsorted)",
      assignmentsAndWork: "Assignments and Work",
    },
    DRIVE_FOLDER_NAMES: {
      day_log: "Day Logs",
      agenda_pdf: "Daily Agenda PDFs",
      reagan: "", // catch-all → parent root
      worksheets: "Worksheets (Daily Packets)",
    },
    ...overrides,
  };
  return { deps, results, persisted };
}

/* ---------- Credential env management ---------- */

const savedToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
const savedSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

beforeEach(() => {
  process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.test-token";
  delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
});
afterEach(() => {
  if (savedToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedToken;
  else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  if (savedSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedSa;
  else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  vi.restoreAllMocks();
});

/* ---------- Tests ---------- */

describe("live worker — inline content (day log)", () => {
  it("uploads markdown into the pre-resolved Day Logs subfolder and marks pushed", async () => {
    const row = {
      id: 1,
      fileName: "2026-06-18 - Day Log.md",
      targetFolder: "day_log",
      targetSubpath: "",
      contentText: "# Day Log\nReagan had a great day.",
      mimeType: "text/markdown",
    };
    const { drive, uploaded } = makeFakeDrive();
    const { deps, results } = makeFakeDeps([row]);

    const summary = await runDrivePushWorker({ driveClient: drive, deps });

    expect(summary.status).toBe("drained");
    expect(summary.pushed).toBe(1);
    expect(summary.failed).toBe(0);
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].parentId).toBe("SUB_DAYLOGS");
    expect(uploaded[0].isText).toBe(true);
    expect(results[0]).toMatchObject({ id: 1, status: "pushed" });
    expect(results[0].driveFileId).toBeTruthy();
  });
});

describe("live worker — name-based dedupe", () => {
  it("skips a row whose filename already exists in the destination folder", async () => {
    const row = {
      id: 2,
      fileName: "2026-06-18 - Day Log.md",
      targetFolder: "day_log",
      targetSubpath: "",
      contentText: "dupe",
    };
    const { drive, uploaded } = makeFakeDrive({
      existingByParent: {
        SUB_DAYLOGS: [
          { id: "pre-existing", name: "2026-06-18 - Day Log.md", mimeType: "text/markdown" },
        ],
      },
    });
    const { deps, results } = makeFakeDeps([row]);

    const summary = await runDrivePushWorker({ driveClient: drive, deps });

    expect(summary.skipped).toBe(1);
    expect(summary.pushed).toBe(0);
    expect(uploaded).toHaveLength(0);
    expect(results[0]).toMatchObject({ id: 2, status: "skipped", errorMessage: "dedupe_hit" });
    expect(results[0].driveFileId).toBe("pre-existing");
  });
});

describe("live worker — binary content (agenda PDF)", () => {
  it("fetches bytes via injected fetchBytes, creates the subfolder, and persists its id", async () => {
    const row = {
      id: 3,
      fileName: "2026-06-18 - Reagan - Agenda.pdf",
      targetFolder: "agenda_pdf",
      targetSubpath: "",
      fileKey: "agendas/2026-06-18.pdf",
      fileUrl: "https://example.com/x.pdf",
      mimeType: "application/pdf",
      contentText: null,
    };
    const { drive, uploaded, created } = makeFakeDrive();
    const { deps, results, persisted } = makeFakeDeps([row]);
    const fetchBytes = vi.fn(async () => new Uint8Array([1, 2, 3, 4]));

    const summary = await runDrivePushWorker({ driveClient: drive, deps, fetchBytes });

    expect(summary.pushed).toBe(1);
    expect(fetchBytes).toHaveBeenCalledOnce();
    // "Daily Agenda PDFs" had no persisted id → worker created it under PARENT_DAILY.
    expect(created.some((c) => c.parentId === "PARENT_DAILY" && c.name === "Daily Agenda PDFs")).toBe(true);
    expect(uploaded[0].isText).toBe(false);
    expect(uploaded[0].bytes).toBe(4);
    expect(uploaded[0].mimeType).toBe("application/pdf");
    // The newly-created subfolder id was persisted back to app_settings.
    expect(persisted["drive.folderMap.Daily_Operations.Daily_Agenda_PDFs"]).toBeTruthy();
    expect(results[0]).toMatchObject({ id: 3, status: "pushed" });
  });
});

describe("live worker — catch-all target lands in the parent root", () => {
  it("uploads directly under the Inbox parent when the target has no named subfolder", async () => {
    const row = {
      id: 4,
      fileName: "loose-upload.png",
      targetFolder: "reagan",
      targetSubpath: "",
      fileKey: "x/loose.png",
      fileUrl: "https://example.com/loose.png",
      mimeType: "image/png",
      contentText: null,
    };
    const { drive, uploaded } = makeFakeDrive();
    const { deps } = makeFakeDeps([row]);
    const summary = await runDrivePushWorker({
      driveClient: drive,
      deps,
      fetchBytes: async () => new Uint8Array([9, 9]),
    });
    expect(summary.pushed).toBe(1);
    expect(uploaded[0].parentId).toBe("PARENT_INBOX");
  });
});

describe("live worker — structural subpath mkdir-P", () => {
  it("creates each subpath segment under the named subfolder", async () => {
    const row = {
      id: 5,
      fileName: "lab1.pdf",
      targetFolder: "worksheets",
      targetSubpath: "Math/Graded",
      fileKey: "x/lab1.pdf",
      fileUrl: "https://example.com/lab1.pdf",
      mimeType: "application/pdf",
      contentText: null,
    };
    const { drive, created, uploaded } = makeFakeDrive();
    const { deps } = makeFakeDeps([row]);
    const summary = await runDrivePushWorker({
      driveClient: drive,
      deps,
      fetchBytes: async () => new Uint8Array([1]),
    });
    expect(summary.pushed).toBe(1);
    // Worksheets subfolder + Math + Graded all created.
    const names = created.map((c) => c.name);
    expect(names).toContain("Worksheets (Daily Packets)");
    expect(names).toContain("Math");
    expect(names).toContain("Graded");
    // File landed in the deepest folder (Graded).
    const graded = created.find((c) => c.name === "Graded")!;
    expect(uploaded[0].parentId).toBe(graded.id);
  });
});

describe("live worker — folder resolution caching", () => {
  it("resolves the destination subfolder once for a batch of same-target rows", async () => {
    const rows = [1, 2, 3].map((n) => ({
      id: n,
      fileName: `2026-06-1${n} - Day Log.md`,
      targetFolder: "day_log",
      targetSubpath: "",
      contentText: `log ${n}`,
    }));
    const { drive, uploaded } = makeFakeDrive();
    const { deps } = makeFakeDeps(rows);
    const listSpy = vi.spyOn(drive, "listChildren");

    const summary = await runDrivePushWorker({ driveClient: drive, deps });

    expect(summary.pushed).toBe(3);
    expect(uploaded).toHaveLength(3);
    // Day Logs id came from persisted lookup (SUB_DAYLOGS) → no folder list
    // call for resolution; only the 3 per-row dedupe listChildren calls.
    expect(listSpy).toHaveBeenCalledTimes(3);
    for (const u of uploaded) expect(u.parentId).toBe("SUB_DAYLOGS");
  });
});

describe("live worker — error isolation", () => {
  it("marks a failing row failed and continues draining the rest (never throws)", async () => {
    const rows = [
      { id: 10, fileName: "ok.md", targetFolder: "day_log", targetSubpath: "", contentText: "ok" },
      { id: 11, fileName: "boom.pdf", targetFolder: "day_log", targetSubpath: "", fileKey: "k", fileUrl: "https://e/x", contentText: null },
      { id: 12, fileName: "ok2.md", targetFolder: "day_log", targetSubpath: "", contentText: "ok2" },
    ];
    const { drive } = makeFakeDrive();
    const { deps, results } = makeFakeDeps(rows);
    const fetchBytes = vi.fn(async () => { throw new Error("S3 down"); });

    const summary = await runDrivePushWorker({ driveClient: drive, deps, fetchBytes });

    expect(summary.status).toBe("drained_with_errors");
    expect(summary.pushed).toBe(2);
    expect(summary.failed).toBe(1);
    const failed = results.find((r) => r.status === "failed")!;
    expect(failed.id).toBe(11);
    expect(failed.errorMessage).toMatch(/S3 down/);
    // Exactly one result per row.
    expect(results).toHaveLength(3);
  });
});

describe("live worker — refuses 1FAKE persisted ids", () => {
  it("ignores a persisted 1FAKE subfolder id and falls back to list/create", async () => {
    const row = {
      id: 20,
      fileName: "x.md",
      targetFolder: "day_log",
      targetSubpath: "",
      contentText: "x",
    };
    const { drive, created } = makeFakeDrive({
      existingByParent: {
        PARENT_DAILY: [{ id: "REAL_DAYLOGS", name: "Day Logs", mimeType: "application/vnd.google-apps.folder" }],
      },
    });
    const { deps } = makeFakeDeps([row], {
      getCanonicalSubfolderId: async () => "1FAKE_subfolder_123",
    });

    const summary = await runDrivePushWorker({ driveClient: drive, deps });
    expect(summary.pushed).toBe(1);
    // It found the real "Day Logs" via list rather than trusting the FAKE id;
    // no new folder created because the real one already existed.
    expect(created.some((c) => c.name === "Day Logs")).toBe(false);
  });
});

describe("runDrivePushOnce — single-row live drain", () => {
  it("drains one inline row to pushed via injected client", async () => {
    const row: any = {
      id: 99,
      fileName: "single.md",
      targetFolder: "day_log",
      targetSubpath: "",
      contentText: "single",
    };
    const { drive, uploaded } = makeFakeDrive();
    const { deps, results } = makeFakeDeps([row]);
    const r = await runDrivePushOnce(row, { driveClient: drive, deps });
    expect(r.outcome).toBe("pushed");
    expect(uploaded).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 99, status: "pushed" });
  });
});
