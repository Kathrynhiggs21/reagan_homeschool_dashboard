/**
 * Source-level guard: the IEP Ref tab is registered in Settings, the
 * IepReferencePanel imports the correct tRPC procedures, and uses no
 * hard-coded strings that would drift from the canonical libs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

describe("Settings page exposes IEP Ref tab + IepReferencePanel wires to tRPC", () => {
  const settings = readFileSync(resolve(ROOT, "client/src/pages/Settings.tsx"), "utf8");
  const panel = readFileSync(resolve(ROOT, "client/src/components/IepReferencePanel.tsx"), "utf8");

  it("Settings.tsx imports IepReferencePanel", () => {
    expect(settings).toContain('from "@/components/IepReferencePanel"');
  });

  it("Settings.tsx registers the iep TabsTrigger and TabsContent", () => {
    expect(settings).toContain('value="iep"');
    expect(settings).toMatch(/<TabsTrigger value="iep"/);
    expect(settings).toMatch(/<TabsContent value="iep"/);
  });

  it("IepReferencePanel calls all three tRPC procedures", () => {
    expect(panel).toContain("trpc.iep.warningZones.useQuery");
    expect(panel).toContain("trpc.iep.crisisProtocol.useQuery");
    expect(panel).toContain("trpc.iep.whatWorksMatrix.useQuery");
  });

  it("IepReferencePanel does NOT inline hard-coded zone signals (must come from API)", () => {
    // If someone copies the WARNING_ZONES content into the JSX, this test fails.
    expect(panel).not.toContain("Excessive bathroom requests");
    expect(panel).not.toContain('"You\'re fine, just try"');
  });

  it("IepReferencePanel renders explicit Loading / Error / Empty states", () => {
    expect(panel).toMatch(/PanelLoading/);
    expect(panel).toMatch(/PanelError/);
    expect(panel).toMatch(/PanelEmpty/);
    expect(panel).toMatch(/isLoading/);
    expect(panel).toMatch(/\.error/);
  });
});
