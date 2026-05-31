/**
 * runbooksDismissals.test.ts — v3.20 (2026-05-31)
 *
 * Locks the per-runbook dismiss + Drive OAuth runbook + Settings header
 * badge contract. Pure unit + source-introspection tests; no DOM library
 * required.
 *
 * Covers:
 *   - `buildRunbookSummariesWithDismissals` pure-function behavior
 *   - `runbookDismissalSettingKey` round-tripping with
 *     `parseRunbookDismissalKey`
 *   - Drive OAuth runbook is registered and has the right shape
 *   - routers.ts wires `runbooks.dismiss` + `runbooks.undismiss` as
 *     adminProcedure mutations backed by `db.setAppSetting`
 *   - routers.ts uses the prefix scan + parser to build the dismissed map
 *   - RunbooksAdminCard.tsx renders Dismiss + Restore + show-dismissed
 *     toggle and the `runbooks-admin-card` anchor id
 *   - Settings.tsx renders the badge only when count > 0 and links to
 *     the anchor via smooth scroll
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRunbookSummariesWithDismissals,
  listRunbooks,
  listRunbookSummaries,
  parseRunbookDismissalKey,
  RUNBOOK_DISMISSAL_KEY_PREFIX,
  runbookDismissalSettingKey,
  type RunbookSummary,
} from "./_lib/runbooks";

const ROOT = join(__dirname, "..");
function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("runbookDismissalSettingKey / parseRunbookDismissalKey", () => {
  it("round-trips a slug through the KV key encoder/decoder", () => {
    const key = runbookDismissalSettingKey("resend-custom-domain");
    expect(key).toBe(`${RUNBOOK_DISMISSAL_KEY_PREFIX}resend-custom-domain`);
    expect(parseRunbookDismissalKey(key)).toBe("resend-custom-domain");
  });

  it("returns null for keys that don't carry the dismissal prefix", () => {
    expect(parseRunbookDismissalKey("foo.bar")).toBeNull();
    expect(parseRunbookDismissalKey("recap.enabled")).toBeNull();
    expect(parseRunbookDismissalKey("")).toBeNull();
  });

  it("returns null for the bare prefix with empty slug", () => {
    expect(parseRunbookDismissalKey(RUNBOOK_DISMISSAL_KEY_PREFIX)).toBeNull();
  });

  it("uses the documented prefix string", () => {
    expect(RUNBOOK_DISMISSAL_KEY_PREFIX).toBe("runbooks.dismissed.");
  });
});

describe("buildRunbookSummariesWithDismissals", () => {
  it("attaches dismissed=false everywhere when the map is empty", () => {
    const out = buildRunbookSummariesWithDismissals({});
    for (const s of out) {
      expect(s.dismissed).toBe(false);
      expect(s.dismissedAtISO).toBeNull();
    }
    expect(out.length).toBe(listRunbooks().length);
  });

  it("marks only the slugs present in the map as dismissed", () => {
    const dismissed: Record<string, string> = {
      "resend-custom-domain": "2026-05-31T12:00:00.000Z",
    };
    const out = buildRunbookSummariesWithDismissals(dismissed);
    const resend = out.find((s) => s.slug === "resend-custom-domain");
    expect(resend?.dismissed).toBe(true);
    expect(resend?.dismissedAtISO).toBe("2026-05-31T12:00:00.000Z");
    const drive = out.find((s) => s.slug === "google-drive-oauth-setup");
    expect(drive?.dismissed).toBe(false);
    expect(drive?.dismissedAtISO).toBeNull();
  });

  it("strips the body so the summary payload stays small", () => {
    const out = buildRunbookSummariesWithDismissals({});
    for (const s of out) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((s as any).body).toBeUndefined();
    }
  });

  it("preserves the same ordering as listRunbooks()", () => {
    const out = buildRunbookSummariesWithDismissals({});
    const allSlugs = listRunbooks().map((r) => r.slug);
    expect(out.map((s) => s.slug)).toEqual(allSlugs);
  });

  it("listRunbookSummaries() defaults every entry to non-dismissed", () => {
    const summaries: RunbookSummary[] = listRunbookSummaries();
    for (const s of summaries) {
      expect(s.dismissed).toBe(false);
      expect(s.dismissedAtISO).toBeNull();
    }
  });
});

describe("routers.ts wires the dismiss / undismiss mutations", () => {
  const routers = readFile("server/routers.ts");

  it("declares `dismiss` as an adminProcedure mutation under runbooks", () => {
    expect(routers).toMatch(/dismiss: adminProcedure[\s\S]*?\.mutation\(/);
  });

  it("declares `undismiss` as an adminProcedure mutation under runbooks", () => {
    expect(routers).toMatch(/undismiss: adminProcedure[\s\S]*?\.mutation\(/);
  });

  it("dismiss persists via db.setAppSetting with the dismissal key helper", () => {
    expect(routers).toMatch(
      /db\.setAppSetting\(\s*runbookDismissalSettingKey\(input\.slug\)/,
    );
  });

  it("undismiss clears by writing null to the same KV key", () => {
    // The mutation should pass `null` to setAppSetting to clear the row.
    expect(routers).toMatch(
      /db\.setAppSetting\(\s*runbookDismissalSettingKey\(input\.slug\),\s*null\s*\)/,
    );
  });

  it("dismiss validates the slug against the registry before writing", () => {
    // The mutation should call getRunbookBySlug + throw NOT_FOUND for unknown slugs.
    const dismissBlock = routers.match(
      /dismiss: adminProcedure[\s\S]*?undismiss:/,
    )?.[0];
    expect(dismissBlock).toBeTruthy();
    expect(dismissBlock).toContain("getRunbookBySlug");
    expect(dismissBlock).toContain('code: "NOT_FOUND"');
  });

  it("list builds the dismissed map from a prefix-scanned appSettings query", () => {
    expect(routers).toContain("RUNBOOK_DISMISSAL_KEY_PREFIX");
    expect(routers).toContain("parseRunbookDismissalKey");
    expect(routers).toMatch(
      /db\.listAppSettings\(RUNBOOK_DISMISSAL_KEY_PREFIX\)/,
    );
    expect(routers).toContain("buildRunbookSummariesWithDismissals");
  });
});

describe("RunbooksAdminCard surfaces dismiss + section anchor", () => {
  const card = readFile("client/src/components/RunbooksAdminCard.tsx");

  it("renders a Dismiss button per active runbook (testid-driven)", () => {
    expect(card).toContain("runbook-dismiss-");
    expect(card).toMatch(/dismissM\?\.mutate\?\.\(\{\s*slug: rb\.slug\s*\}\)/);
  });

  it("renders a Restore button per dismissed runbook", () => {
    expect(card).toContain("runbook-undismiss-");
    expect(card).toMatch(/undismissM\?\.mutate\?\.\(\{\s*slug: rb\.slug\s*\}\)/);
  });

  it('uses an id="runbooks-admin-card" so the Settings header badge can scroll to it', () => {
    expect(card).toContain('id="runbooks-admin-card"');
  });

  it('exposes a "show dismissed" toggle that swaps which list is rendered', () => {
    expect(card).toContain("runbooks-show-dismissed-toggle");
    expect(card).toMatch(/showDismissed \? dismissedRunbooks : activeRunbooks/);
  });

  it("filters by the new dismissed boolean from the list payload", () => {
    expect(card).toMatch(/allRunbooks\.filter\(\(r\) => !r\.dismissed\)/);
    expect(card).toMatch(/allRunbooks\.filter\(\(r\) => r\.dismissed\)/);
  });

  it("invalidates the list query after dismiss / undismiss succeed", () => {
    expect(card).toContain("invalidateList");
    expect(card).toContain("utils?.runbooks?.list?.invalidate");
  });

  it("calls the new tRPC mutations through the optional-chain pattern", () => {
    expect(card).toMatch(/runbooks\?\.dismiss\?\.useMutation/);
    expect(card).toMatch(/runbooks\?\.undismiss\?\.useMutation/);
  });
});

describe("Settings.tsx renders the Runbooks header badge", () => {
  const settings = readFile("client/src/pages/Settings.tsx");

  it("queries the runbooks list at the top of the component", () => {
    expect(settings).toMatch(/runbooks\?\.list\?\.useQuery/);
  });

  it("derives a count of UN-dismissed runbooks (badge text)", () => {
    expect(settings).toMatch(/undismissedRunbookCount/);
    expect(settings).toMatch(/filter\(\s*\(r\) => !r\.dismissed/);
  });

  it("renders the badge only when count > 0", () => {
    expect(settings).toMatch(
      /\{undismissedRunbookCount > 0 && \(/,
    );
  });

  it('uses a data-testid of "settings-runbooks-badge"', () => {
    expect(settings).toContain('data-testid="settings-runbooks-badge"');
  });

  it("scrolls to the runbooks-admin-card anchor on click (smooth)", () => {
    expect(settings).toContain('getElementById("runbooks-admin-card")');
    expect(settings).toMatch(/behavior: "smooth"/);
  });

  it("keeps the RunbooksAdminCard mount outside the 5-tab layout", () => {
    const cardIdx = settings.indexOf("<RunbooksAdminCard");
    const tabsCloseIdx = settings.lastIndexOf("</Tabs>");
    expect(cardIdx).toBeGreaterThan(-1);
    expect(tabsCloseIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(tabsCloseIdx);
  });
});
