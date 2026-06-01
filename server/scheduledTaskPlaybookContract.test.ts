import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * v3.28 (2026-06-01) — Lock the v2 (JWT + tRPC) scheduled-task playbook contract.
 *
 * The playbook at references/scheduled-task-playbook.md is the source-of-truth
 * prompt for the Manus AGENT cron that sends Reagan's nightly agenda email and
 * mirrors files into the Google Drive Hub.
 *
 * In v2 (2026-05-27 onwards, locked in v3.25/v3.26) the agent stopped using
 * `/api/scheduled/*` (those endpoints require a CRON_SECRET that the platform
 * does not inject into agent-cron sessions) and now uses the public tRPC
 * routes with a long-lived JWT cookie that Mom generated from her own
 * browser session.
 *
 * This file reads the playbook as plain text and asserts that the
 * load-bearing v2 contract claims still match. It does NOT spin up the
 * server.
 */

const ROOT = "/home/ubuntu/reagan_homeschool_dashboard";
const PLAYBOOK = join(ROOT, "references", "scheduled-task-playbook.md");

function readPlaybook(): string {
  expect(existsSync(PLAYBOOK)).toBe(true);
  return readFileSync(PLAYBOOK, "utf8");
}

describe("scheduled-task playbook v2 (JWT + tRPC) contract", () => {
  it("playbook file exists at the expected path", () => {
    expect(existsSync(PLAYBOOK)).toBe(true);
  });

  it("declares it is the v2 playbook (JWT + tRPC)", () => {
    const t = readPlaybook();
    expect(t).toMatch(/v2.*JWT.*tRPC|JWT.*tRPC/i);
  });

  it("references both Job A and Job B by name", () => {
    const t = readPlaybook();
    expect(t).toMatch(/JOB A.*NIGHTLY AGENDA EMAIL|Job A — Nightly agenda email/i);
    expect(t).toMatch(/JOB B.*DRIVE HUB MIRROR|Job B — (Continuous )?Drive Hub mirror/i);
  });

  it("documents the JWT app_session_id cookie auth mechanism", () => {
    const t = readPlaybook();
    expect(t).toContain("app_session_id");
    expect(t).toMatch(/JWT/);
    // Cookie must be passed via -b flag in curl examples
    expect(t).toMatch(/-b\s+["']app_session_id=/);
  });

  it("expires the JWT at a documented future date", () => {
    const t = readPlaybook();
    // The current cookie expires April 2027; this test pins that we keep
    // the documentation honest about expiry rather than letting it silently
    // become a dead token.
    expect(t).toMatch(/[Ee]xpire/);
    expect(t).toMatch(/202[6-9]|20[3-9]\d/);
  });

  it("warns NOT to use /api/scheduled/* (CRON_SECRET unavailable)", () => {
    const t = readPlaybook();
    expect(t).toMatch(/\/api\/scheduled\/\*/);
    expect(t).toMatch(/CRON_SECRET|broken|do not use|Do NOT use/i);
  });

  it("uses /api/trpc/* routes for all dashboard calls", () => {
    const t = readPlaybook();
    expect(t).toContain("/api/trpc/");
  });

  it("Job A fetches via agendaEditor.snapshot tRPC route", () => {
    const t = readPlaybook();
    expect(t).toContain("agendaEditor.snapshot");
  });

  it("Job A skips the email on Sunday and handles Friday/Saturday rollover", () => {
    const t = readPlaybook();
    expect(t).toMatch(/Friday/);
    expect(t).toMatch(/Saturday/);
    expect(t).toMatch(/Sunday/);
    expect(t).toMatch(/SKIP|skip/);
  });

  it("Job A sends to Mom's two emails (spear.cpt + marcy.spear)", () => {
    const t = readPlaybook();
    expect(t).toContain("spear.cpt@gmail.com");
    expect(t).toContain("marcy.spear@gmail.com");
  });

  it("Job A handles empty-blocks fallback with a notice email", () => {
    const t = readPlaybook();
    expect(t).toMatch(/blocks array is empty|empty blocks/i);
    expect(t).toMatch(/notice|No plan yet/i);
  });

  it("Job B documents the Hub root folder ID", () => {
    const t = readPlaybook();
    expect(t).toContain("1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r");
  });

  it("Job B documents the target folder map (at least 6 named folders)", () => {
    const t = readPlaybook();
    const expected = [
      "Finished Work",
      "Worksheets",
      "Apps & Tools",
      "Daily Schedule",
      "Printables",
      "Journal",
      "Notebook",
      "Bookshelf",
      "Adventures",
      "Curriculum Checklist",
    ];
    const hit = expected.filter((p) => t.includes(p));
    expect(hit.length).toBeGreaterThanOrEqual(6);
  });

  it("Job B uses submissions.list, notebookAttachments.list, printables.today routes", () => {
    const t = readPlaybook();
    expect(t).toContain("submissions.list");
    expect(t).toContain("notebookAttachments.list");
    expect(t).toContain("printables.today");
  });

  it("Job B documents the daily snapshot folder pattern", () => {
    const t = readPlaybook();
    expect(t).toMatch(/Snapshots\//);
    expect(t).toMatch(/snapshot\.json/);
  });

  it("Job B prunes old snapshots (retention policy)", () => {
    const t = readPlaybook();
    expect(t).toMatch(/[Pp]rune|retention|last \d+ days/);
  });

  it("documents that Drive ops use the gws CLI", () => {
    const t = readPlaybook();
    expect(t).toMatch(/gws CLI|gws/);
  });

  it("documents the spear.cpt@gmail.com Drive identity for the gws CLI", () => {
    const t = readPlaybook();
    expect(t).toContain("spear.cpt@gmail.com");
  });

  it("uses the published manus.space base URL for tRPC calls", () => {
    const t = readPlaybook();
    expect(t).toMatch(/reaganschool\.manus\.space|reagandash[^.]*\.manus\.space/);
  });

  it("includes a SKIP CONDITIONS section so the agent doesn't email on weekends", () => {
    const t = readPlaybook();
    expect(t).toMatch(/SKIP CONDITIONS|skip condition/i);
  });

  it("documents how to refresh the JWT if it stops working", () => {
    const t = readPlaybook();
    expect(t).toMatch(/JWT|cookie/i);
    expect(t).toMatch(/dev tools|browser|generate a new|extract/i);
  });
});
