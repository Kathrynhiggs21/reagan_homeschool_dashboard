import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("IXL router wiring", () => {
  const routers = read("server/routers.ts");

  it("registers an ixl router with the expected procedures", () => {
    expect(routers).toMatch(/ixl:\s*router\(\{/);
    expect(routers).toMatch(/diagnosticLink:\s*publicProcedure/);
    expect(routers).toMatch(/strandOptions:\s*protectedProcedure/);
    expect(routers).toMatch(/report:\s*protectedProcedure/);
    expect(routers).toMatch(/record:\s*protectedProcedure/);
    expect(routers).toMatch(/remove:\s*protectedProcedure/);
  });

  it("record/list/remove are login-gated (protected), NOT public — Reagan has no login", () => {
    // The IXL block must not expose record/list/remove as publicProcedure.
    const ixlBlock = routers.slice(routers.indexOf("ixl: router({"));
    const head = ixlBlock.slice(0, 1600);
    expect(head).not.toMatch(/list:\s*publicProcedure/);
    expect(head).not.toMatch(/record:\s*publicProcedure/);
    expect(head).not.toMatch(/remove:\s*publicProcedure/);
  });
});

describe("IXL data plumbing", () => {
  it("db.ts exposes the IXL helpers", () => {
    const db = read("server/db.ts");
    expect(db).toMatch(/upsertIxlDiagnosticLevel/);
    expect(db).toMatch(/listIxlDiagnosticLevels/);
    expect(db).toMatch(/ixlDiagnosticReport/);
  });

  it("schema defines the ixlDiagnosticLevels table and the ixl_diagnostic source kind", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toMatch(/ixlDiagnosticLevels/);
    expect(schema).toMatch(/ixl_diagnostic/);
  });
});

describe("AI agenda answer-context includes IXL levels", () => {
  const answer = read("server/_lib/agendaAnswer.ts");
  it("assembles ixlLevels from the IXL report", () => {
    expect(answer).toMatch(/ixlLevels/);
    expect(answer).toMatch(/ixlDiagnosticReport/);
  });
  it("labels IXL as an authoritative grade-level read in the prompt blob", () => {
    expect(answer).toMatch(/IXL REAL-TIME DIAGNOSTIC LEVELS/);
  });
  it("never fabricates when no levels recorded", () => {
    expect(answer).toMatch(/no IXL Diagnostic levels recorded yet/i);
  });
});

describe("Placement UI: calm, non-testing IXL framing", () => {
  const page = read("client/src/pages/Placement.tsx");

  it("uses the verified IXL diagnostic link via the trpc procedure", () => {
    expect(page).toMatch(/ixl\.diagnosticLink/);
  });

  it("frames IXL as an adventure/exploration, not a test", () => {
    // Must contain encouraging, non-test language somewhere in the IXL surface.
    expect(page).toMatch(/adventure|explore|warm-up|see what you|show what you/i);
  });

  it("the adult IXL levels view exists and reads the report", () => {
    expect(page).toMatch(/IxlLevelsView/);
    expect(page).toMatch(/ixl\.report/);
  });
});

describe("diagnosticLink prefers the signed-in QuickStart URL", () => {
  const routers = read("server/routers.ts");
  it("wires the signed-in helper with a public fallback + signedIn flag", () => {
    expect(routers).toMatch(/ixlSignedInDiagnosticUrl\(\)/);
    expect(routers).toMatch(/diagnosticUrl:\s*signedIn\s*\?\?\s*IXL_DIAGNOSTIC_URL/);
    expect(routers).toMatch(/publicDiagnosticUrl:\s*IXL_DIAGNOSTIC_URL/);
    expect(routers).toMatch(/signedIn:\s*signedIn\s*!=\s*null/);
  });
  it("the helper reads the QuickStart secret", () => {
    const lib = read("server/_lib/ixlDiagnostic.ts");
    expect(lib).toMatch(/export function ixlSignedInDiagnosticUrl/);
    expect(lib).toMatch(/IXL_QUICKSTART_URL/);
  });
});

describe("IXL Diagnostic is a first-class, discoverable adult destination", () => {
  it("has a standalone light-glass page wired to the IXL procedures", () => {
    const page = read("client/src/pages/IxlDiagnostic.tsx");
    expect(page).toMatch(/ixl\.diagnosticLink/);
    expect(page).toMatch(/ixl\.report/);
    expect(page).toMatch(/ixl\.record/);
    expect(page).toMatch(/glass-panel/);
    expect(page).not.toMatch(/bg-neutral-900/);
    expect(page).toMatch(/signedIn/);
  });
  it("registers a gated /ixl route in App.tsx", () => {
    const app = read("client/src/App.tsx");
    expect(app).toMatch(/import IxlDiagnostic from "\.\/pages\/IxlDiagnostic"/);
    expect(app).toMatch(/path="\/ixl"[\s\S]{0,80}<AdultGate><IxlDiagnostic \/><\/AdultGate>/);
  });
  it("adds an IXL Diagnostic entry to the sidebar adult section", () => {
    const nav = read("client/src/components/SideNav.tsx");
    expect(nav).toMatch(/to:\s*"\/ixl"/);
    expect(nav).toMatch(/label:\s*"IXL Diagnostic"/);
  });
  it("gives /ixl its own page accent", () => {
    const theme = read("client/src/components/PageTheme.tsx");
    expect(theme).toMatch(/"\/ixl":\s*\{\s*key:\s*"ixl"/);
  });
});
