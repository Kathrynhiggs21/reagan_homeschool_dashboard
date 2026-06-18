/**
 * Tests for the credential-gated Drive folder dedupe job.
 *
 * These pin three things:
 *   1. The 9 pinned Hub root names — anything else is fair game.
 *   2. The credential-gated `runDriveFolderDedupeJob()` no-ops cleanly.
 *   3. The hash dedupe lookup defensively rejects bad inputs.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PINNED_HUB_ROOT_NAMES,
  isPinnedHubRoot,
  runDriveFolderDedupeJob,
  findHashDuplicate,
} from "./_lib/driveFolderDedupeJob";

describe("PINNED_HUB_ROOT_NAMES", () => {
  it("locks the 9 canonical Hub roots", () => {
    expect(PINNED_HUB_ROOT_NAMES.length).toBe(9);
    // Spot-check a few — these names must match what's actually in
    // Mom's Drive root or the live job will accidentally trash them.
    expect(PINNED_HUB_ROOT_NAMES).toContain("Daily Operations");
    expect(PINNED_HUB_ROOT_NAMES).toContain("Curriculum and Resources");
    expect(PINNED_HUB_ROOT_NAMES).toContain("Curriculum and Standards");
    expect(PINNED_HUB_ROOT_NAMES).toContain("Reagan IHES");
    expect(PINNED_HUB_ROOT_NAMES).toContain("Reagan Tutor");
    expect(PINNED_HUB_ROOT_NAMES).toContain("Reagan Artwork");
    expect(PINNED_HUB_ROOT_NAMES).toContain("Reagan Assignments");
    expect(PINNED_HUB_ROOT_NAMES).toContain("Finished Work");
    expect(PINNED_HUB_ROOT_NAMES).toContain("Adult Notes");
  });

  it("has unique names", () => {
    const set = new Set<string>(PINNED_HUB_ROOT_NAMES);
    expect(set.size).toBe(PINNED_HUB_ROOT_NAMES.length);
  });
});

describe("isPinnedHubRoot", () => {
  it("returns true for every pinned Hub root", () => {
    for (const name of PINNED_HUB_ROOT_NAMES) {
      expect(isPinnedHubRoot(name)).toBe(true);
    }
  });

  it("returns true even with surrounding whitespace (folks copy-paste)", () => {
    expect(isPinnedHubRoot("  Daily Operations  ")).toBe(true);
  });

  it("returns false for arbitrary names", () => {
    expect(isPinnedHubRoot("Random Folder")).toBe(false);
    expect(isPinnedHubRoot("daily operations")).toBe(false); // case-sensitive
    expect(isPinnedHubRoot("daily_operations")).toBe(false);
  });

  it("returns false for empty / nullish input", () => {
    expect(isPinnedHubRoot("")).toBe(false);
    expect(isPinnedHubRoot(null as any)).toBe(false);
    expect(isPinnedHubRoot(undefined as any)).toBe(false);
  });
});

describe("runDriveFolderDedupeJob", () => {
  const savedToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  const savedSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  const savedCalSa = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
  const savedCalTok = process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;

  beforeEach(() => {
    delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
  });

  afterEach(() => {
    if (savedToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedToken;
    else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    if (savedSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedSa;
    else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
    if (savedCalSa !== undefined) process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = savedCalSa;
    else delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
    if (savedCalTok !== undefined) process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = savedCalTok;
    else delete process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
  });

  it("short-circuits with skipped_no_credentials when no creds — zero side effects", async () => {
    const r = await runDriveFolderDedupeJob();
    expect(r.status).toBe("skipped_no_credentials");
    expect(r.emptyFoldersTrashed).toBe(0);
    expect(r.duplicateFoldersMerged).toBe(0);
    expect(r.childFilesMoved).toBe(0);
    expect(r.errorCount).toBe(0);
    expect(r.reason).toMatch(/No Drive credentials/i);
  });

  it("never throws when called with no creds (safe for nightly heartbeat)", async () => {
    await expect(runDriveFolderDedupeJob()).resolves.toBeDefined();
  });
});

describe("findHashDuplicate", () => {
  const savedToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  const savedSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  const savedCalSa = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
  const savedCalTok = process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;

  beforeEach(() => {
    delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
  });

  afterEach(() => {
    if (savedToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedToken;
    else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    if (savedSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedSa;
    else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
    if (savedCalSa !== undefined) process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = savedCalSa;
    else delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
    if (savedCalTok !== undefined) process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = savedCalTok;
    else delete process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
  });

  const validHash = "a".repeat(64); // 64 lowercase hex chars

  it("returns null without creds (credential gate)", async () => {
    const r = await findHashDuplicate("parent-id", validHash);
    expect(r).toBeNull();
  });

  it("returns null with empty parentId or hash (caller bug, fall through to upload)", async () => {
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.fake";
    expect(await findHashDuplicate("", validHash)).toBeNull();
    expect(await findHashDuplicate("parent", "")).toBeNull();
  });

  it("returns null with non-SHA-256 hash (defensive guard)", async () => {
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.fake";
    expect(await findHashDuplicate("parent", "too-short")).toBeNull();
    expect(await findHashDuplicate("parent", "g".repeat(64))).toBeNull(); // non-hex
    expect(await findHashDuplicate("parent", "a".repeat(63))).toBeNull(); // 63 chars
    expect(await findHashDuplicate("parent", "a".repeat(65))).toBeNull(); // 65 chars
  });
});
