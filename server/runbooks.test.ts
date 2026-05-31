/**
 * runbooks.test.ts — v3.19 (2026-05-30)
 *
 * Locks the runbooks registry contract: the 2 user-action runbooks
 * authored at the end of v3.18 (Resend custom domain + SKILL.md
 * 6th-grade update) must be discoverable by slug, must list in a
 * stable order, must carry non-empty bodies, and must keep enough
 * substance that a future maintainer can actually execute them.
 */
import { describe, expect, it } from "vitest";
import {
  getRunbookBySlug,
  listRunbooks,
  listRunbookSummaries,
} from "./_lib/runbooks";

describe("runbooks registry", () => {
  it("ships at least the 3 user-action runbooks (v3.18 pair + v3.20 Drive OAuth)", () => {
    const all = listRunbooks();
    expect(all.length).toBeGreaterThanOrEqual(3);
    const slugs = all.map((r) => r.slug);
    expect(slugs).toContain("resend-custom-domain");
    expect(slugs).toContain("skill-md-sixth-grade-update");
    expect(slugs).toContain("google-drive-oauth-setup");
  });

  it("returns entries sorted by (category, title) for stable UI ordering", () => {
    const all = listRunbooks();
    for (let i = 1; i < all.length; i += 1) {
      const prev = all[i - 1];
      const curr = all[i];
      if (prev.category === curr.category) {
        expect(prev.title.localeCompare(curr.title)).toBeLessThanOrEqual(0);
      } else {
        expect(prev.category.localeCompare(curr.category)).toBeLessThan(0);
      }
    }
  });

  it("every runbook has slug, title, body, oneLineSummary, and estimatedMinutes", () => {
    for (const rb of listRunbooks()) {
      expect(rb.slug).toMatch(/^[a-z0-9-]+$/);
      expect(rb.title.length).toBeGreaterThan(10);
      expect(rb.oneLineSummary.length).toBeGreaterThan(15);
      expect(rb.estimatedMinutes).toBeGreaterThan(0);
      expect(rb.estimatedMinutes).toBeLessThanOrEqual(180);
      expect(rb.body.length).toBeGreaterThan(500);
      expect(rb.lastUpdatedISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every runbook body starts with a top-level Markdown heading", () => {
    for (const rb of listRunbooks()) {
      expect(rb.body.trimStart().startsWith("# ")).toBe(true);
    }
  });

  it("every runbook body has a `## Steps for the user` section", () => {
    for (const rb of listRunbooks()) {
      expect(rb.body).toContain("## Steps for the user");
    }
  });

  it("getRunbookBySlug returns the right doc for an exact match", () => {
    const resend = getRunbookBySlug("resend-custom-domain");
    expect(resend).not.toBeNull();
    expect(resend?.category).toBe("email");
    expect(resend?.body).toContain("resend.com/domains");
    expect(resend?.body).toContain("MAIL_ALLOWED_RECIPIENTS");
  });

  it("getRunbookBySlug returns null for unknown slug", () => {
    expect(getRunbookBySlug("does-not-exist")).toBeNull();
  });

  it("getRunbookBySlug is case-sensitive (does not accept Resend-Custom-Domain)", () => {
    expect(getRunbookBySlug("Resend-Custom-Domain")).toBeNull();
    expect(getRunbookBySlug("RESEND-CUSTOM-DOMAIN")).toBeNull();
  });

  it("getRunbookBySlug rejects empty / whitespace / non-string inputs", () => {
    expect(getRunbookBySlug("")).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getRunbookBySlug(null as any)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getRunbookBySlug(undefined as any)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getRunbookBySlug(42 as any)).toBeNull();
  });

  it("listRunbookSummaries strips the body to keep list payload small", () => {
    const summaries = listRunbookSummaries();
    for (const s of summaries) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((s as any).body).toBeUndefined();
      expect(s.slug.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
    }
    expect(summaries.length).toBe(listRunbooks().length);
  });

  it("Resend runbook surfaces the key user actions", () => {
    const resend = getRunbookBySlug("resend-custom-domain");
    expect(resend).not.toBeNull();
    // Must tell user where to verify
    expect(resend?.body).toMatch(/resend\.com\/domains/);
    // Must tell user about DNS records
    expect(resend?.body).toMatch(/SPF|DKIM/);
    // Must tell user about the env var to clear
    expect(resend?.body).toContain("MAIL_ALLOWED_RECIPIENTS");
    // Must call out the SMTP fallback as the safety net
    expect(resend?.body).toMatch(/SMTP fallback|fallback/i);
    // Must reference Grandma's address (otherwise reader has no idea who is blocked)
    expect(resend?.body).toContain("marcy.spear@gmail.com");
  });

  it("SKILL.md runbook surfaces the key user actions", () => {
    const skill = getRunbookBySlug("skill-md-sixth-grade-update");
    expect(skill).not.toBeNull();
    // Must tell user where the file lives
    expect(skill?.body).toContain("reagan-homeschool-grading");
    expect(skill?.body).toContain("SKILL.md");
    // Must include the drafted 6th-grade rubric section
    expect(skill?.body).toContain("6th Grade Adjustments");
    expect(skill?.body).toMatch(/Ratios.*proportions/i);
    expect(skill?.body).toMatch(/Algebraic thinking/i);
    // Must reference the Ohio standards cross-ref doc
    expect(skill?.body).toContain("ohio-standards-full-reference");
  });

  it("uses unique slugs (no duplicate registration)", () => {
    const all = listRunbooks();
    const slugs = all.map((r) => r.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("uses canonical lowercase-kebab slugs", () => {
    for (const rb of listRunbooks()) {
      expect(rb.slug).toBe(rb.slug.toLowerCase());
      expect(rb.slug).not.toMatch(/\s/);
      expect(rb.slug).not.toMatch(/_/);
    }
  });

  it("Google Drive OAuth runbook surfaces the key user actions (v3.20)", () => {
    const drive = getRunbookBySlug("google-drive-oauth-setup");
    expect(drive).not.toBeNull();
    expect(drive?.category).toBe("drive");
    // Must name both supported credential paths.
    expect(drive?.body).toContain("GOOGLE_DRIVE_OAUTH_TOKEN");
    expect(drive?.body).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");
    // Must reference the credential-gated worker so the user can verify success.
    expect(drive?.body).toContain("drivePushWorker");
    // Must walk the user through Cloud Console + OAuth playground.
    expect(drive?.body).toMatch(/console\.cloud\.google\.com/);
    expect(drive?.body).toMatch(/oauthplayground/);
    // Must reference rollback / safety.
    expect(drive?.body).toMatch(/Rollback|skipped_no_credentials/);
  });
});
