import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * v2.35 (2026-05-18) — Settings AI helper contract.
 *
 * Reconciliation lock for the open todo "Settings page AI assistant
 * (chat that toggles theme, quiet hours, tutor swap, …)" — the surface
 * was actually shipped in client/src/components/SettingsAIHelperCard.tsx
 * + server/_lib/settingsAI.ts + the settingsAI router on routers.ts,
 * and is mounted at the top of the Settings page. This file makes that
 * coverage explicit so a future refactor that drops one of the four
 * required toggle classes (theme / quiet hours / tutor / notifications)
 * trips red.
 */

const ROOT = process.cwd();
const CARD = readFileSync(
  join(ROOT, "client/src/components/SettingsAIHelperCard.tsx"),
  "utf-8",
);
const SETTINGS_PAGE = readFileSync(
  join(ROOT, "client/src/pages/Settings.tsx"),
  "utf-8",
);
const ROUTERS = readFileSync(join(ROOT, "server/routers.ts"), "utf-8");

describe("v2.35 — Settings AI helper card contract", () => {
  it("card mounts the chat textarea + Preview/Apply flow", () => {
    expect(CARD).toContain("export default function SettingsAIHelperCard");
    expect(CARD).toContain("<Textarea");
    expect(CARD).toMatch(/Preview change|Preview/);
    expect(CARD).toMatch(/Apply/);
  });

  it("card calls trpc.settingsAI.preview AND trpc.settingsAI.commit", () => {
    expect(CARD).toContain("trpc.settingsAI.preview.useMutation");
    expect(CARD).toContain("trpc.settingsAI.commit.useMutation");
  });

  it("card renders the four required op kinds: prefs.set, tutor.upsert, ask, reagan.note", () => {
    expect(CARD).toContain('op.kind === "prefs.set"');
    expect(CARD).toContain('op.kind === "tutor.upsert"');
    expect(CARD).toContain('op.kind === "ask"');
    expect(CARD).toContain('op.kind === "reagan.note"');
  });

  it("card sample chips cover theme, Kiwi voice, quiet-hours / mute, tutor add, tutor remove, and 8pm digest", () => {
    expect(CARD).toMatch(/theme.*cream|cream.*theme/i);
    expect(CARD).toMatch(/Kiwi voice/i);
    expect(CARD).toMatch(/Mute Kiwi/i); // quiet/mute toggle
    expect(CARD).toMatch(/Add Grandma/i); // tutor swap (add)
    expect(CARD).toMatch(/inactive.*tutor|stopped tutoring|Mark.*inactive/i); // tutor remove
    expect(CARD).toMatch(/8 PM.*digest|nightly digest|nightly email/i);
  });

  it("card is mounted at the top of the Settings page", () => {
    expect(SETTINGS_PAGE).toContain('import SettingsAIHelperCard from "@/components/SettingsAIHelperCard"');
    expect(SETTINGS_PAGE).toContain("<SettingsAIHelperCard />");
  });

  it("settingsAI router exposes snapshot + preview + commit, all protectedProcedure", () => {
    expect(ROUTERS).toMatch(/settingsAI:\s*router\(\{/);
    // Find the settingsAI block to scope the gate checks.
    const start = ROUTERS.indexOf("settingsAI: router({");
    const end = ROUTERS.indexOf("library: router(", start);
    const block = ROUTERS.slice(start, end > start ? end : start + 4000);
    expect(block).toContain("snapshot: protectedProcedure");
    expect(block).toContain("preview: protectedProcedure");
    expect(block).toContain("commit: protectedProcedure");
  });

  it("settingsAI snapshot/preview surface the four toggle classes for the AI: theme, kiwi voice, quiet hours, notifications", () => {
    const start = ROUTERS.indexOf("settingsAI: router({");
    const end = ROUTERS.indexOf("library: router(", start);
    const block = ROUTERS.slice(start, end > start ? end : start + 4000);
    expect(block).toContain('"ui.theme"');
    expect(block).toContain('"kiwi.voice"');
    expect(block).toContain('"quietHours.start"');
    expect(block).toContain('"quietHours.end"');
    expect(block).toContain('"notifications.evening8pm"');
  });

  it("settingsAI commit writes prefs via setAppSetting and tutors via upsertTutor with a logAudit row", () => {
    const start = ROUTERS.indexOf("settingsAI: router({");
    const end = ROUTERS.indexOf("library: router(", start);
    const block = ROUTERS.slice(start, end > start ? end : start + 4000);
    expect(block).toContain("db.setAppSetting(op.key");
    expect(block).toContain("db.upsertTutor(");
    expect(block).toContain("db.logAudit(");
    expect(block).toMatch(/Settings AI:/);
  });
});
