/**
 * Drive REST client — thin, injectable wrapper over the Google Drive v3 API
 * ========================================================================
 *
 * The live Drive push worker depends on this `DriveClient` interface, never
 * on `googleapis` or `fetch` directly. That keeps `drivePushWorker` 100%
 * unit-testable: tests inject a fake client and assert behavior without ever
 * touching the network.
 *
 * The default implementation (`makeRealDriveClient`) authenticates with
 * `google-auth-library`:
 *   - OAuth token   → an OAuth2 access token in GOOGLE_DRIVE_OAUTH_TOKEN
 *   - service acct  → a service-account JSON blob in
 *                     GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
 *
 * We call the Drive REST endpoints directly with `fetch` (multipart upload)
 * so we don't pull in the heavy full `googleapis` package — only the small
 * `google-auth-library` for token minting.
 */

/** A folder/file as returned by Drive list. */
export type DriveChild = {
  id: string;
  name: string;
  mimeType: string;
  /** Drive's md5 for binary files; absent for Google-native/inline docs. */
  md5Checksum?: string | null;
};

export type DriveUploadResult = { id: string };

/**
 * The minimal Drive surface the worker needs. Implementations must be
 * idempotent-friendly: `createFolder` only creates; callers handle the
 * "find-or-create" dance via `listChildren`.
 */
export interface DriveClient {
  /** List non-trashed children of `parentId` (optionally filtered to folders). */
  listChildren(parentId: string, opts?: { foldersOnly?: boolean }): Promise<DriveChild[]>;
  /** Create a subfolder named `name` under `parentId`, return its id. */
  createFolder(parentId: string, name: string): Promise<string>;
  /** Upload bytes/text as a new file under `parentId`. Returns the new file id. */
  uploadFile(args: {
    parentId: string;
    name: string;
    mimeType: string;
    /** Either inline text or raw bytes — exactly one must be set. */
    contentText?: string;
    contentBytes?: Uint8Array;
  }): Promise<DriveUploadResult>;
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";
export const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * Resolve a bearer access token from whichever credential is configured.
 * Kept separate so it can be unit-tested / swapped.
 */
export async function resolveAccessToken(): Promise<string> {
  const rawToken = (process.env.GOOGLE_DRIVE_OAUTH_TOKEN || "").trim();
  if (rawToken.length > 0) {
    // Treat as a ready-to-use OAuth2 access token. (If a refresh-token flow
    // is ever needed, swap this branch for an OAuth2Client refresh.)
    return rawToken;
  }
  const rawSa = (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "").trim();
  if (rawSa.length === 0) {
    throw new Error("resolveAccessToken: no Drive credential in env");
  }
  let creds: any;
  try {
    creds = JSON.parse(rawSa);
  } catch {
    throw new Error("resolveAccessToken: GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  // Lazy import keeps the module load cheap for the credential-less path.
  const { JWT } = await import("google-auth-library");
  const client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("resolveAccessToken: service-account token mint returned empty");
  return token;
}

/** A small helper: fetch with bearer auth + JSON parse + error surfacing. */
async function driveFetchJson(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<any> {
  const resp = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => resp.statusText);
    throw new Error(`Drive API ${resp.status}: ${body.slice(0, 400)}`);
  }
  return resp.json();
}

/**
 * Build the production Drive client. `tokenProvider` is injectable so tests
 * can avoid `google-auth-library`; defaults to `resolveAccessToken`.
 */
export function makeRealDriveClient(
  tokenProvider: () => Promise<string> = resolveAccessToken,
): DriveClient {
  const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  return {
    async listChildren(parentId, opts) {
      const token = await tokenProvider();
      const clauses = [`'${q(parentId)}' in parents`, "trashed=false"];
      if (opts?.foldersOnly) clauses.push(`mimeType='${FOLDER_MIME}'`);
      const params = new URLSearchParams({
        q: clauses.join(" and "),
        fields: "files(id,name,mimeType,md5Checksum)",
        pageSize: "1000",
      });
      const out: DriveChild[] = [];
      const data = await driveFetchJson(token, `${DRIVE_API}/files?${params.toString()}`);
      for (const f of data.files ?? []) {
        out.push({ id: f.id, name: f.name, mimeType: f.mimeType, md5Checksum: f.md5Checksum ?? null });
      }
      return out;
    },

    async createFolder(parentId, name) {
      const token = await tokenProvider();
      const data = await driveFetchJson(token, `${DRIVE_API}/files?fields=id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
      });
      if (!data.id) throw new Error("createFolder: Drive returned no id");
      return data.id;
    },

    async uploadFile(args) {
      const token = await tokenProvider();
      const bytes =
        args.contentBytes ??
        (args.contentText != null ? new TextEncoder().encode(args.contentText) : null);
      if (!bytes) throw new Error("uploadFile: neither contentText nor contentBytes provided");

      const boundary = `manus-${Math.random().toString(36).slice(2)}`;
      const metadata = JSON.stringify({ name: args.name, parents: [args.parentId] });
      const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${args.mimeType}\r\n\r\n`;
      const tail = `\r\n--${boundary}--`;
      const body = new Uint8Array(
        Buffer.concat([Buffer.from(head, "utf-8"), Buffer.from(bytes), Buffer.from(tail, "utf-8")]),
      );

      const resp = await fetch(DRIVE_UPLOAD, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        throw new Error(`Drive upload ${resp.status}: ${errText.slice(0, 400)}`);
      }
      const data = await resp.json();
      if (!data.id) throw new Error("uploadFile: Drive returned no id");
      return { id: data.id };
    },
  };
}
