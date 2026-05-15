import { describe, it, expect } from "vitest";
import {
  computeVaultRotationDue,
  __FOR_TEST__,
  type AppAccountVaultEntry,
} from "./_lib/vaultRotationDue";

function row(over: Partial<AppAccountVaultEntry> = {}): AppAccountVaultEntry {
  return {
    appKey: "khan",
    appName: "Khan Academy",
    signInMethod: "google_sso",
    ownerRole: "mom",
    ownerEmail: "spear.cpt@gmail.com",
    secretCiphertext: "enc(p)",
    rotateDays: 90,
    visibleToReagan: false,
    kidSafeLabel: "Khan Academy",
    createdAtIso: "2026-02-01T00:00:00Z",
    adultNote: "Khan Academy — Mom's account (google sso).",
    ...over,
  };
}

const NOW = "2026-05-14T20:00:00Z";

describe("Push 188 — vaultRotationDue", () => {
  it("returns empty buckets + null headline when given no rows", () => {
    const r = computeVaultRotationDue({ rows: [], nowIso: NOW });
    expect(r.overdue).toHaveLength(0);
    expect(r.dueSoon).toHaveLength(0);
    expect(r.healthy).toHaveLength(0);
    expect(r.adultHeadline).toBeNull();
    expect(r.considered).toBe(0);
  });

  it("skips rotateDays===null rows entirely (Reagan / class_code rows)", () => {
    const r = computeVaultRotationDue({
      rows: [row({ rotateDays: null, ownerRole: "reagan", visibleToReagan: true })],
      nowIso: NOW,
    });
    expect(r.considered).toBe(0);
  });

  it("skips visibleToReagan rows even when rotateDays is set", () => {
    const r = computeVaultRotationDue({
      rows: [row({ visibleToReagan: true, rotateDays: 90, ownerRole: "reagan" })],
      nowIso: NOW,
    });
    expect(r.considered).toBe(0);
  });

  it("skips rows pinned to the blocked IHSD email (defense in depth)", () => {
    const r = computeVaultRotationDue({
      rows: [row({ ownerEmail: "reagan.higgs33@ihsd.us" })],
      nowIso: NOW,
    });
    expect(r.considered).toBe(0);
  });

  it("buckets an overdue Mom google_sso row correctly", () => {
    const r = computeVaultRotationDue({
      rows: [row({ createdAtIso: "2026-01-01T00:00:00Z" })],
      nowIso: NOW,
    });
    expect(r.overdue).toHaveLength(1);
    expect(r.overdue[0].daysUntilRotation).toBeLessThan(0);
    expect(r.dueSoon).toHaveLength(0);
    expect(r.healthy).toHaveLength(0);
    expect(r.adultHeadline).toContain("overdue");
  });

  it("buckets a dueSoon row (within 7 days)", () => {
    const r = computeVaultRotationDue({
      rows: [row({ createdAtIso: "2026-02-14T00:00:00Z" })],
      nowIso: NOW,
    });
    expect(r.dueSoon).toHaveLength(1);
    expect(r.overdue).toHaveLength(0);
    expect(r.dueSoon[0].daysUntilRotation).toBeGreaterThanOrEqual(0);
    expect(r.dueSoon[0].daysUntilRotation).toBeLessThanOrEqual(7);
    expect(r.adultHeadline).toContain("week");
  });

  it("buckets a healthy row (>7 days until rotation)", () => {
    const r = computeVaultRotationDue({
      rows: [row({ createdAtIso: "2026-05-01T00:00:00Z" })],
      nowIso: NOW,
    });
    expect(r.healthy).toHaveLength(1);
    expect(r.overdue).toHaveLength(0);
    expect(r.dueSoon).toHaveLength(0);
    expect(r.adultHeadline).toBeNull();
  });

  it("sorts each bucket by daysUntilRotation asc, then appKey asc", () => {
    const r = computeVaultRotationDue({
      rows: [
        row({ appKey: "ixl", appName: "IXL", createdAtIso: "2026-02-18T00:00:00Z" }),
        row({ appKey: "khan", createdAtIso: "2026-02-14T00:00:00Z" }),
        row({ appKey: "edpuzzle", appName: "Edpuzzle", createdAtIso: "2026-02-14T00:00:00Z" }),
      ],
      nowIso: NOW,
    });
    expect(r.dueSoon.map((x) => x.appKey)).toEqual(["edpuzzle", "khan", "ixl"]);
  });

  it("plural-safe headline: '1 login' vs '3 logins'", () => {
    expect(__FOR_TEST__.pluralLogins(1)).toBe("1 login");
    expect(__FOR_TEST__.pluralLogins(3)).toBe("3 logins");
    expect(__FOR_TEST__.pluralLogins(0)).toBe("0 logins");
  });

  it("headline omits the dueSoon half when zero", () => {
    expect(__FOR_TEST__.buildHeadline(2, 0)).toContain("overdue");
    expect(__FOR_TEST__.buildHeadline(2, 0)).not.toContain("week");
  });

  it("headline omits the overdue half when zero", () => {
    expect(__FOR_TEST__.buildHeadline(0, 2)).toContain("week");
    expect(__FOR_TEST__.buildHeadline(0, 2)).not.toContain("overdue");
  });

  it("headline returns null when both halves are zero", () => {
    expect(__FOR_TEST__.buildHeadline(0, 0)).toBeNull();
  });

  it("invalid nowIso returns empty result deterministically", () => {
    const r = computeVaultRotationDue({
      rows: [row()],
      nowIso: "not-a-date",
    });
    expect(r.considered).toBe(0);
    expect(r.adultHeadline).toBeNull();
  });

  it("invalid createdAtIso skips the row (does not throw)", () => {
    const r = computeVaultRotationDue({
      rows: [row({ createdAtIso: "garbage" }), row({ appKey: "ixl", appName: "IXL" })],
      nowIso: NOW,
    });
    expect(r.considered).toBe(1);
  });

  it("non-positive rotateDays skips the row", () => {
    const r = computeVaultRotationDue({
      rows: [row({ rotateDays: 0 }), row({ rotateDays: -10 })],
      nowIso: NOW,
    });
    expect(r.considered).toBe(0);
  });

  it("adultLabel is friendly + role-prefixed", () => {
    const r = computeVaultRotationDue({
      rows: [row({ ownerRole: "grandma", appName: "Edpuzzle", appKey: "edpuzzle" })],
      nowIso: NOW,
    });
    const item = [...r.overdue, ...r.dueSoon, ...r.healthy][0];
    expect(item.adultLabel).toBe("Grandma's Edpuzzle login");
  });

  it("nextRotationDueIso is exactly createdAtIso + rotateDays*86_400_000", () => {
    const r = computeVaultRotationDue({
      rows: [row({ createdAtIso: "2026-01-01T00:00:00Z", rotateDays: 90 })],
      nowIso: NOW,
    });
    const item = r.overdue[0];
    expect(item.nextRotationDueIso).toBe("2026-04-01T00:00:00.000Z");
  });

  it("does not surface anything for kid-managed rows even if explicitly allowed", () => {
    const r = computeVaultRotationDue({
      rows: [
        row({
          ownerRole: "reagan",
          visibleToReagan: true,
          rotateDays: null,
          ownerEmail: "reaganhiggs910@gmail.com",
        }),
      ],
      nowIso: NOW,
    });
    expect(r.overdue).toHaveLength(0);
    expect(r.dueSoon).toHaveLength(0);
    expect(r.healthy).toHaveLength(0);
  });

  it("considered counts rows actually evaluated (post-skip)", () => {
    const r = computeVaultRotationDue({
      rows: [
        row({ appKey: "a", createdAtIso: "2026-01-01T00:00:00Z" }),
        row({ appKey: "b", rotateDays: null }),
        row({ appKey: "c", visibleToReagan: true }),
        row({ appKey: "d", ownerEmail: "reagan.higgs33@ihsd.us" }),
      ],
      nowIso: NOW,
    });
    expect(r.considered).toBe(1);
  });

  it("roleWord covers all roles", () => {
    expect(__FOR_TEST__.roleWord("reagan")).toBe("Reagan");
    expect(__FOR_TEST__.roleWord("mom")).toBe("Mom");
    expect(__FOR_TEST__.roleWord("grandma")).toBe("Grandma");
    expect(__FOR_TEST__.roleWord("dad")).toBe("Dad");
    expect(__FOR_TEST__.roleWord("none")).toBe("Shared");
  });
});
