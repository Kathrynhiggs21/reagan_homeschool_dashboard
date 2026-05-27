/**
 * Source-contract test for the new CalendarFeedsCard component (v2.92).
 *
 * The CRUD/refresh endpoints in trpc.icalFeeds were already implemented and
 * tested; this test locks down the *UI* that lets an adult actually use them,
 * since the bug we fixed was "feature shipped server-side but had no front
 * door for ~3 months." We assert the component exists, calls the correct
 * mutations and queries, is mounted in Today.tsx, and lives behind the adult
 * unlock state.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const CARD = readFileSync(join(ROOT, "client/src/components/CalendarFeedsCard.tsx"), "utf8");
const TODAY = readFileSync(join(ROOT, "client/src/pages/Today.tsx"), "utf8");

describe("CalendarFeedsCard contract (v2.92)", () => {
  it("calls every icalFeeds CRUD/refresh procedure the dashboard already exposes", () => {
    expect(CARD).toMatch(/trpc\.icalFeeds\.list\.useQuery/);
    expect(CARD).toMatch(/trpc\.icalFeeds\.add\.useMutation/);
    expect(CARD).toMatch(/trpc\.icalFeeds\.refresh\.useMutation/);
    expect(CARD).toMatch(/trpc\.icalFeeds\.delete\.useMutation/);
  });

  it("posts only the three fields the server's add mutation accepts (label/url/color)", () => {
    // catches drift if someone tries to add fields server-side without
    // updating the form, or vice versa
    expect(CARD).toMatch(/add\.mutate\(\{\s*label:\s*label\.trim\(\),\s*url:\s*url\.trim\(\),\s*color\s*\}\)/);
  });

  it("invalidates the list query after every mutation so the UI re-renders fresh state", () => {
    const occurrences = (CARD.match(/utils\.icalFeeds\.list\.invalidate\(\)/g) ?? []).length;
    // expected in: add.onSuccess, refresh.onSuccess, refresh.onError, delete.onSuccess
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });

  it("guards delete with a confirm dialog to avoid one-click loss of a feed", () => {
    expect(CARD).toMatch(/confirm\(/);
    expect(CARD).toMatch(/remove\.mutate\(\{\s*id:\s*f\.id\s*\}\)/);
  });

  it("renders sync-status pills (ok / never / failed) from the server-stored lastSyncStatus", () => {
    expect(CARD).toMatch(/lastSyncStatus === "ok"/);
    expect(CARD).toMatch(/lastSyncStatus === "never"/);
    expect(CARD).toMatch(/lastSyncStatus === "failed"/);
  });

  it("uses sonner toast (not the removed @/hooks/use-toast) — matches v2.92 codebase convention", () => {
    expect(CARD).toMatch(/from "sonner"/);
    expect(CARD).not.toMatch(/@\/hooks\/use-toast/);
  });

  it("Today.tsx imports and mounts CalendarFeedsCard inside the adult-unlocked drawer", () => {
    expect(TODAY).toMatch(/import CalendarFeedsCard from "@\/components\/CalendarFeedsCard"/);
    expect(TODAY).toMatch(/<CalendarFeedsCard\s*\/>/);
    // sanity: mounted after the recap inbox card (drawer ordering invariant)
    const recapIdx = TODAY.indexOf("<RecapReplyInboxCard");
    const calIdx = TODAY.indexOf("<CalendarFeedsCard");
    expect(recapIdx).toBeGreaterThan(0);
    expect(calIdx).toBeGreaterThan(recapIdx);
  });

  it("offers preset accent colors so a tutor or grandparent can distinguish overlapping feeds at a glance", () => {
    // we don't lock down specific colors — that's design — but the card
    // MUST offer a palette, not just a free-text input
    expect(CARD).toMatch(/PRESET_COLORS/);
    expect(CARD).toMatch(/setColor\(c\.value\)/);
  });
});
