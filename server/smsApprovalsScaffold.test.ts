import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  signSmsApprovalToken,
  verifySmsApprovalToken,
} from "./_lib/smsApprovalSigning";
import {
  shouldQueueApproval,
  planApprovalQueue,
  APPROVAL_RISK_KINDS,
} from "./_lib/approvalQueuePolicy";

const SECRET = "test-secret-only-not-real-key-3456789";

describe("Push 77 — SMS approvals scaffold (signing)", () => {
  it("signs and verifies a valid token", () => {
    const exp = Date.now() + 60_000;
    const token = signSmsApprovalToken(42, exp, SECRET);
    const out = verifySmsApprovalToken(token, SECRET, Date.now());
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.approvalId).toBe(42);
      expect(out.expiresAtMs).toBe(exp);
    }
  });

  it("rejects a token whose approvalId was tampered with", () => {
    const exp = Date.now() + 60_000;
    const token = signSmsApprovalToken(42, exp, SECRET);
    const parts = token.split(".");
    parts[0] = "99";
    const tampered = parts.join(".");
    const out = verifySmsApprovalToken(tampered, SECRET, Date.now());
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("bad-signature");
  });

  it("rejects a token signed with a different secret", () => {
    const exp = Date.now() + 60_000;
    const token = signSmsApprovalToken(42, exp, SECRET);
    const out = verifySmsApprovalToken(
      token,
      "different-secret-also-16chars-min",
      Date.now(),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("bad-signature");
  });

  it("rejects expired tokens", () => {
    const now = 1_700_000_000_000;
    const token = signSmsApprovalToken(7, now + 1000, SECRET);
    const out = verifySmsApprovalToken(token, SECRET, now + 5000);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("expired");
  });

  it("rejects malformed tokens", () => {
    expect(verifySmsApprovalToken("notatoken", SECRET).ok).toBe(false);
    expect(verifySmsApprovalToken("1.2", SECRET).ok).toBe(false);
    expect(verifySmsApprovalToken("a.b.c", SECRET).ok).toBe(false);
  });

  it("refuses to sign with short or empty secrets", () => {
    expect(() => signSmsApprovalToken(1, Date.now() + 1000, "")).toThrow();
    expect(() => signSmsApprovalToken(1, Date.now() + 1000, "short")).toThrow();
  });
});

describe("Push 77 — SMS approvals scaffold (queue policy)", () => {
  it("Mom is NEVER queued, regardless of risk kind", () => {
    for (const k of APPROVAL_RISK_KINDS) {
      const d = shouldQueueApproval("mom", k);
      expect(d.queue).toBe(false);
      if (!d.queue) expect(d.reason).toBe("family-admin-auto-approve");
    }
  });

  it("Grandma is NEVER queued, regardless of risk kind", () => {
    for (const k of APPROVAL_RISK_KINDS) {
      const d = shouldQueueApproval("grandma", k);
      expect(d.queue).toBe(false);
      if (!d.queue) expect(d.reason).toBe("family-admin-auto-approve");
    }
  });

  it("tutors get queued on risky kinds", () => {
    const d = shouldQueueApproval("tutor", "schedule.bulk-delete");
    expect(d.queue).toBe(true);
  });

  it("assistant gets queued on risky kinds (catch-all for AI)", () => {
    const d = shouldQueueApproval("assistant", "curriculum.unmap-topic");
    expect(d.queue).toBe(true);
  });

  it("non-risky kinds do NOT get queued even for tutors", () => {
    const d = shouldQueueApproval("tutor", "block.move-time");
    expect(d.queue).toBe(false);
    if (!d.queue) expect(d.reason).toBe("low-risk-not-queueable");
  });

  it("planApprovalQueue adds a TTL expiry only when queued", () => {
    const queued = planApprovalQueue("tutor", "tutor.add-or-remove", 1000);
    expect(queued.queue).toBe(true);
    if (queued.queue) expect(queued.expiresAtMs).toBeGreaterThan(1000);

    const skipped = planApprovalQueue("mom", "schedule.bulk-delete", 1000);
    expect(skipped.queue).toBe(false);
    expect((skipped as { expiresAtMs?: number }).expiresAtMs).toBeUndefined();
  });
});

describe("Push 77 — reuses existing recipientPushTargets table for phone roster", () => {
  it("schema declares phoneE164 + role + isActive on recipientPushTargets", () => {
    const SCHEMA_SRC = readFileSync(
      join(process.cwd(), "drizzle/schema.ts"),
      "utf-8",
    );
    expect(SCHEMA_SRC).toContain("recipientPushTargets");
    // Look only inside the recipientPushTargets table block.
    const start = SCHEMA_SRC.indexOf("recipientPushTargets = mysqlTable");
    expect(start).toBeGreaterThan(-1);
    const end = SCHEMA_SRC.indexOf("});", start);
    const block = SCHEMA_SRC.slice(start, end);
    expect(block).toContain('phoneE164');
    expect(block).toContain('role');
    expect(block).toContain('isActive');
  });
});
