/**
 * One-off Drive resync for stuck drive_push_queue rows.
 *
 * Root cause: the recurring drive-push-drain job authenticates as the Google
 * Calendar SERVICE ACCOUNT (reused for Drive). A bare service account has no
 * Drive storage quota, so every binary upload — and most inline uploads — into
 * Katy's personal "My Drive" hub fail with HTTP 403
 * "Service Accounts do not have storage quota."
 *
 * This script drains the residual failed/pending rows using the `gws` CLI,
 * which is authenticated as the real Drive owner (spear.cpt@gmail.com) and
 * therefore HAS quota. For each row it resolves the canonical destination
 * folder, dedupes by name, uploads (inline text or S3 bytes), and marks the
 * queue row `pushed` with the real driveFileId.
 *
 * Safe to re-run: name-based dedupe means already-present files are marked
 * `skipped` (dedupe_hit) rather than duplicated.
 */
import mysql from "mysql2/promise";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DRY = process.argv.includes("--dry");

// target_folder -> { parentFolderKey, subfolderName }
// parentFolderKey is the appSettings `drive.folder.<slug>` key suffix.
const TARGET_TO_PARENT = {
  reagan: "inboxUnsorted",
  reagan_ihes: "printablesAndResources",
  reagan_tutor: "adminAndHomeschoolRecords",
  reagan_artwork: "assignmentsAndWork",
  reagan_assignments: "assignmentsAndWork",
  finished_work: "assignmentsAndWork",
  daily_schedule: "dailyOperations",
  worksheets: "assignmentsAndWork",
  printables: "printablesAndResources",
  report_cards: "progressAndReports",
  journal: "adventuresAndEnrichment",
  analytics: "progressAndReports",
  adult_notes: "adminAndHomeschoolRecords",
  kiwi_coins: "progressAndReports",
  tutor: "adminAndHomeschoolRecords",
  apps_tools: "progressAndReports",
  bookshelf: "adventuresAndEnrichment",
  adventures: "adventuresAndEnrichment",
  practice: "assignmentsAndWork",
  notebook: "adminAndHomeschoolRecords",
  curriculum_checklist: "curriculumAndStandards",
  day_log: "dailyOperations",
  recap_reply: "dailyOperations",
  topics_covered: "curriculumAndStandards",
  agenda_pdf: "dailyOperations",
  future_worksheets: "printablesAndResources",
};
const PARENT_NAMES = {
  adminAndHomeschoolRecords: "Admin and Homeschool Records",
  adventuresAndEnrichment: "Adventures and Enrichment",
  assignmentsAndWork: "Assignments and Work",
  curriculumAndStandards: "Curriculum and Standards",
  dailyOperations: "Daily Operations",
  inboxUnsorted: "Inbox (Unsorted)",
  printablesAndResources: "Printables and Resources",
  progressAndReports: "Progress and Reports",
  todo: "Todo",
};
const TARGET_TO_SUBFOLDER = {
  reagan: "",
  reagan_ihes: "Printables",
  reagan_tutor: "Tutor Handoffs",
  reagan_artwork: "Finished Work",
  reagan_assignments: "Assignments",
  finished_work: "Finished Work",
  daily_schedule: "Daily Schedule",
  worksheets: "Worksheets (Daily Packets)",
  printables: "Printables",
  report_cards: "Report Cards",
  journal: "Journal",
  analytics: "Analytics",
  adult_notes: "Adult Notes",
  kiwi_coins: "Kiwi Coins",
  tutor: "Tutor",
  apps_tools: "Apps & Tools",
  bookshelf: "Bookshelf",
  adventures: "Adventures",
  practice: "Practice for Coins",
  notebook: "Notebook",
  curriculum_checklist: "Curriculum Checklist (Weekly)",
  day_log: "Day Logs",
  recap_reply: "Recap Replies",
  topics_covered: "Topics Covered",
  agenda_pdf: "Daily Agenda PDFs",
  future_worksheets: "Future Worksheets",
};
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, "_");

function gws(args) {
  const out = execFileSync("gws", args, { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  return out;
}
function gwsJson(args) {
  return JSON.parse(gws([...args, "--format", "json"]));
}

const folderChildCache = new Map();
function listFolderChildren(parentId) {
  if (folderChildCache.has(parentId)) return folderChildCache.get(parentId);
  const q = `'${parentId}' in parents and trashed=false`;
  const data = gwsJson([
    "drive", "files", "list",
    "--params", JSON.stringify({ q, fields: "files(id,name,mimeType)", pageSize: 1000 }),
  ]);
  const files = data.files || [];
  folderChildCache.set(parentId, files);
  return files;
}
function findChildFolder(parentId, name) {
  const files = listFolderChildren(parentId);
  const m = files.find((f) => f.mimeType === "application/vnd.google-apps.folder" && f.name.trim().toLowerCase() === name.trim().toLowerCase());
  return m ? m.id : null;
}
function ensureChildFolder(parentId, name) {
  const found = findChildFolder(parentId, name);
  if (found) return found;
  const created = gwsJson([
    "drive", "files", "create",
    "--json", JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
    "--params", JSON.stringify({ fields: "id" }),
  ]);
  folderChildCache.delete(parentId);
  return created.id;
}
function findChildFile(parentId, name) {
  const files = listFolderChildren(parentId);
  const m = files.find((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());
  return m ? m.id : null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  const c = await mysql.createConnection(url + (url.includes("?") ? "&" : "?") + 'ssl={"rejectUnauthorized":false}');

  // canonical parent folder ids
  const [pf] = await c.query("SELECT `key`,`value` FROM appSettings WHERE `key` LIKE 'drive.folder.%'");
  const parentId = {};
  for (const r of pf) parentId[r.key.replace("drive.folder.", "")] = String(r.value).trim();

  const [rows] = await c.query(
    "SELECT id,target_folder,target_subpath,file_name,mime_type,file_key,file_url,content_text FROM drive_push_queue WHERE status IN ('failed','pending') ORDER BY created_at"
  );
  console.log(`Resyncing ${rows.length} stuck rows via gws (user OAuth)...\n`);

  let pushed = 0, skipped = 0, failed = 0;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resync-"));

  for (const row of rows) {
    const target = row.target_folder || "reagan";
    const parentSlug = TARGET_TO_PARENT[target] || "inboxUnsorted";
    const pid = parentId[parentSlug];
    const fileName = (row.file_name || "").trim();
    try {
      if (!pid) throw new Error(`no parent folder id for slug ${parentSlug}`);
      if (!fileName) throw new Error("missing file_name");

      // resolve destination
      let destId = pid;
      const sub = (TARGET_TO_SUBFOLDER[target] || "").trim();
      if (sub) destId = ensureChildFolder(destId, sub);
      const subpath = (row.target_subpath || "").trim();
      if (subpath) {
        for (const seg of subpath.split("/").map((s) => s.trim()).filter(Boolean)) {
          destId = ensureChildFolder(destId, seg);
        }
      }

      // dedupe by name
      const existing = findChildFile(destId, fileName);
      if (existing) {
        if (!DRY) await c.query(
          "UPDATE drive_push_queue SET status='skipped', drive_file_id=?, error_message='dedupe_hit (resync)', pushed_at=NOW() WHERE id=?",
          [existing, row.id]
        );
        console.log(`  SKIP  #${row.id} ${fileName} (already in Drive)`);
        skipped++;
        continue;
      }

      // materialize bytes
      const text = row.content_text != null && String(row.content_text).length > 0 ? String(row.content_text) : null;
      const localPath = path.join(tmpDir, `f_${row.id}_${fileName.replace(/[^A-Za-z0-9._-]+/g, "_")}`);
      let mime = (row.mime_type || "").trim();
      if (text != null) {
        fs.writeFileSync(localPath, text, "utf-8");
        if (!mime) mime = "text/markdown";
      } else {
        // fetch S3 bytes via a Forge-presigned GET url
        let fetchUrl = (row.file_url || "").trim();
        const key = (row.file_key || "").trim();
        // Guard against corrupt/truncated keys (observed: literal "k").
        if (key && key.length <= 2) {
          throw new Error(`unrecoverable: corrupt fileKey "${key}" — bytes were never stored; nothing to resync`);
        }
        if (key) {
          const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/$/, "");
          const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || "";
          const presign = new URL("v1/storage/presign/get", forgeUrl + "/");
          presign.searchParams.set("path", key);
          const resp = await fetch(presign, { headers: { Authorization: `Bearer ${forgeKey}` } }).catch(() => null);
          if (resp && resp.ok) {
            const j = await resp.json().catch(() => null);
            if (j && j.url) fetchUrl = j.url;
          }
        }
        if (!fetchUrl || (!fetchUrl.startsWith("http://") && !fetchUrl.startsWith("https://"))) {
          throw new Error(`no fetchable URL (key=${key}, url=${row.file_url})`);
        }
        const r = await fetch(fetchUrl);
        if (!r.ok) throw new Error(`byte fetch ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        fs.writeFileSync(localPath, buf);
        if (!mime) mime = "application/octet-stream";
      }

      if (DRY) {
        console.log(`  DRY   #${row.id} -> folder ${destId} | ${fileName} (${mime})`);
        pushed++;
        continue;
      }

      // upload via gws (multipart media); copy into cwd so gws path check passes
      const cwdCopy = path.join(process.cwd(), `__resync_${row.id}`);
      fs.copyFileSync(localPath, cwdCopy);
      let created;
      try {
        created = gwsJson([
          "drive", "files", "create",
          "--json", JSON.stringify({ name: fileName, parents: [destId] }),
          "--upload", `__resync_${row.id}`,
          "--upload-content-type", mime,
          "--params", JSON.stringify({ fields: "id" }),
        ]);
      } finally {
        fs.rmSync(cwdCopy, { force: true });
      }
      if (!created || !created.id) throw new Error("gws create returned no id");
      folderChildCache.delete(destId);
      await c.query(
        "UPDATE drive_push_queue SET status='pushed', drive_file_id=?, error_message=NULL, pushed_at=NOW() WHERE id=?",
        [created.id, row.id]
      );
      console.log(`  PUSH  #${row.id} ${fileName} -> ${created.id}`);
      pushed++;
    } catch (e) {
      failed++;
      console.log(`  FAIL  #${row.id} ${fileName} :: ${(e && e.message) || e}`);
      if (!DRY) await c.query(
        "UPDATE drive_push_queue SET status='failed', error_message=? WHERE id=?",
        [String((e && e.message) || e).slice(0, 500), row.id]
      );
    }
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\nDone. pushed=${pushed} skipped=${skipped} failed=${failed}`);
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
