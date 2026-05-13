import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  roleForEmail,
  capabilitiesFor,
  describeUser,
} from "./_lib/permissions";

describe("Push 79 — Tutor identity roster (Madison / Sophie / Keith)", () => {
  it("all three placeholder emails resolve to 'tutor' role", () => {
    expect(roleForEmail("madison@tbd.local")).toBe("tutor");
    expect(roleForEmail("sophie@tbd.local")).toBe("tutor");
    expect(roleForEmail("keith@tbd.local")).toBe("tutor");
  });

  it("resetTutorRoster seeds Madison/Sophie/Keith with matching emails", () => {
    const src = readFileSync(
      join(process.cwd(), "server/db.ts"),
      "utf-8",
    );
    expect(src).toMatch(/Madison.*madison@tbd\.local/s);
    expect(src).toMatch(/Sophie.*sophie@tbd\.local/s);
    expect(src).toMatch(/Keith.*keith@tbd\.local/s);
  });

  it("tutors have Editor-tier capabilities (same surface as Grandma)", () => {
    const tutor = capabilitiesFor("tutor");
    const editor = capabilitiesFor("editor");
    expect(tutor).toEqual(editor);
    // The Editor-tier surface is non-empty and non-destructive:
    expect(tutor.canEditSchedule).toBe(true);
    expect(tutor.canUseAdultTools).toBe(true);
    expect(tutor.canManageBilling).toBe(false);
    expect(tutor.canCompleteAsStudent).toBe(false);
  });

  it("Reagan (student) NEVER gets canEditSchedule, regardless of any future tutor identity confusion", () => {
    const reagan = describeUser("reaganhiggs910@gmail.com");
    expect(reagan.role).toBe("student");
    expect(reagan.capabilities.canEditSchedule).toBe(false);
    expect(reagan.capabilities.canManageBilling).toBe(false);
  });

  it("Mom (parent) is the only role with canManageBilling", () => {
    expect(capabilitiesFor("parent").canManageBilling).toBe(true);
    expect(capabilitiesFor("editor").canManageBilling).toBe(false);
    expect(capabilitiesFor("tutor").canManageBilling).toBe(false);
    expect(capabilitiesFor("student").canManageBilling).toBe(false);
    expect(capabilitiesFor("viewer").canManageBilling).toBe(false);
  });

  it("Dad (blakehiggs@hotmail.com) also resolves to parent", () => {
    expect(roleForEmail("blakehiggs@hotmail.com")).toBe("parent");
  });

  it("Grandma Marcy resolves to editor", () => {
    expect(roleForEmail("marcy.spear@gmail.com")).toBe("editor");
  });

  it("unknown emails default to viewer with read-only capabilities", () => {
    expect(roleForEmail("random@example.com")).toBe("viewer");
    const caps = capabilitiesFor("viewer");
    expect(caps.canRead).toBe(true);
    expect(caps.canEditSchedule).toBe(false);
    expect(caps.canCompleteAsStudent).toBe(false);
  });

  it("null/undefined email is a viewer, not a crash", () => {
    expect(roleForEmail(null)).toBe("viewer");
    expect(roleForEmail(undefined)).toBe("viewer");
    expect(roleForEmail("")).toBe("viewer");
  });
});
