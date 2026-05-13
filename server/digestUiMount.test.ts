import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const CARD = readFileSync(join(ROOT, "client/src/components/WeeklyDigestCard.tsx"), "utf-8");
const ANALYTICS = readFileSync(join(ROOT, "client/src/pages/Analytics.tsx"), "utf-8");

describe("Push 71 — Sunday Digest UI surfaces Grandma + HTML preview", () => {
  it("subline mentions both Mom (spear.cpt) and Grandma (marcy.spear)", () => {
    expect(CARD).toContain("spear.cpt@gmail.com");
    expect(CARD).toContain("marcy.spear@gmail.com");
  });

  it("wires the digest.previewHtml tRPC procedure", () => {
    expect(CARD).toContain("trpc.digest.previewHtml.useQuery");
  });

  it("only fetches the HTML preview when the drawer is open (enabled: showPreview)", () => {
    expect(CARD).toMatch(/enabled:\s*showPreview/);
  });

  it("renders the HTML in a sandboxed iframe (not raw dangerouslySetInnerHTML)", () => {
    expect(CARD).toContain("<iframe");
    expect(CARD).toContain("srcDoc={previewHtml.data.html}");
    expect(CARD).not.toContain("dangerouslySetInnerHTML");
  });

  it("shows the recipient list (Mom + Grandma) returned by the server", () => {
    expect(CARD).toContain("previewHtml.data.recipients.join");
  });

  it("WeeklyDigestCard is mounted on Analytics", () => {
    expect(ANALYTICS).toContain("import WeeklyDigestCard");
    expect(ANALYTICS).toContain("<WeeklyDigestCard />");
  });

  it("preview toggle button exists for testability", () => {
    expect(CARD).toContain('data-testid="digest-preview-toggle"');
  });
});
