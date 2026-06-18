/**
 * driveClient — token resolution + REST request shaping (no network).
 *
 * These tests pin the credential-resolution branch order and verify the
 * client issues correctly-shaped Drive REST calls by stubbing global fetch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveAccessToken, makeRealDriveClient, FOLDER_MIME } from "./_lib/driveClient";

const savedToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
const savedSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

beforeEach(() => {
  delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
});
afterEach(() => {
  if (savedToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedToken;
  else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  if (savedSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedSa;
  else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  vi.restoreAllMocks();
});

describe("resolveAccessToken", () => {
  it("returns the OAuth token verbatim when GOOGLE_DRIVE_OAUTH_TOKEN is set", async () => {
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.live-token";
    await expect(resolveAccessToken()).resolves.toBe("ya29.live-token");
  });

  it("throws when no credential is configured", async () => {
    await expect(resolveAccessToken()).rejects.toThrow(/no Drive credential/i);
  });

  it("throws a clear error when service-account JSON is not parseable", async () => {
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = "not-json{";
    await expect(resolveAccessToken()).rejects.toThrow(/not valid JSON/i);
  });
});

describe("makeRealDriveClient — request shaping", () => {
  it("listChildren issues a folders-only Drive query with the right fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ files: [{ id: "f1", name: "Day Logs", mimeType: FOLDER_MIME }] }), { status: 200 }),
    );
    const client = makeRealDriveClient(async () => "tok");
    const out = await client.listChildren("PARENT", { foldersOnly: true });

    expect(out).toEqual([{ id: "f1", name: "Day Logs", mimeType: FOLDER_MIME, md5Checksum: null }]);
    // URLSearchParams encodes spaces as '+' and ' / : = ' get percent-encoded;
    // assert on the decoded-but-still-plus form the wire actually carries.
    const calledUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(calledUrl).toContain("'PARENT'+in+parents");
    expect(calledUrl).toContain("mimeType='" + FOLDER_MIME + "'");
    expect(calledUrl).toContain("trashed=false");
  });

  it("createFolder POSTs folder metadata and returns the new id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "new-folder" }), { status: 200 }),
    );
    const client = makeRealDriveClient(async () => "tok");
    const id = await client.createFolder("PARENT", "Day Logs");
    expect(id).toBe("new-folder");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ name: "Day Logs", mimeType: FOLDER_MIME, parents: ["PARENT"] });
  });

  it("uploadFile sends multipart/related and returns the new id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "uploaded" }), { status: 200 }),
    );
    const client = makeRealDriveClient(async () => "tok");
    const res = await client.uploadFile({
      parentId: "DEST",
      name: "x.md",
      mimeType: "text/markdown",
      contentText: "# hi",
    });
    expect(res.id).toBe("uploaded");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const ct = (init.headers as Record<string, string>)["Content-Type"];
    expect(ct).toMatch(/^multipart\/related; boundary=/);
  });

  it("surfaces Drive API errors with status + body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("permission denied", { status: 403 }),
    );
    const client = makeRealDriveClient(async () => "tok");
    await expect(client.listChildren("PARENT")).rejects.toThrow(/Drive API 403/);
  });
});
