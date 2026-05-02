import { describe, it, expect } from "vitest";
import { roleForEmail, capabilitiesFor, describeUser } from "./_lib/permissions";

describe("home-team permissions matrix", () => {
  it("classifies known emails to the right role", () => {
    expect(roleForEmail("spear.cpt@gmail.com")).toBe("parent");
    expect(roleForEmail("reaganhiggs910@gmail.com")).toBe("student");
    expect(roleForEmail("marcy.spear@gmail.com")).toBe("editor");
    expect(roleForEmail("madison@tbd.local")).toBe("tutor");
    expect(roleForEmail("sophie@tbd.local")).toBe("tutor");
    expect(roleForEmail("keith@tbd.local")).toBe("tutor");
    expect(roleForEmail("random@example.com")).toBe("viewer");
    expect(roleForEmail(null)).toBe("viewer");
    expect(roleForEmail("")).toBe("viewer");
  });

  it("is case-insensitive", () => {
    expect(roleForEmail("SPEAR.CPT@gmail.com")).toBe("parent");
    expect(roleForEmail("ReaganHiggs910@Gmail.Com")).toBe("student");
  });

  it("parent has every capability", () => {
    const c = capabilitiesFor("parent");
    expect(c.canRead).toBe(true);
    expect(c.canEditSchedule).toBe(true);
    expect(c.canUseAdultTools).toBe(true);
    expect(c.canManageBilling).toBe(true);
    expect(c.canCompleteAsStudent).toBe(false);
  });

  it("editor + tutor get edit rights but NOT billing", () => {
    for (const role of ["editor", "tutor"] as const) {
      const c = capabilitiesFor(role);
      expect(c.canEditSchedule, `${role} can edit`).toBe(true);
      expect(c.canUseAdultTools, `${role} adult tools`).toBe(true);
      expect(c.canManageBilling, `${role} billing blocked`).toBe(false);
      expect(c.canCompleteAsStudent, `${role} cannot complete as student`).toBe(false);
    }
  });

  it("student can complete blocks but not edit schedule", () => {
    const c = capabilitiesFor("student");
    expect(c.canCompleteAsStudent).toBe(true);
    expect(c.canEditSchedule).toBe(false);
    expect(c.canUseAdultTools).toBe(false);
    expect(c.canManageBilling).toBe(false);
  });

  it("viewer is read-only", () => {
    const c = capabilitiesFor("viewer");
    expect(c.canRead).toBe(true);
    expect(c.canEditSchedule).toBe(false);
    expect(c.canCompleteAsStudent).toBe(false);
    expect(c.canManageBilling).toBe(false);
  });

  it("describeUser bundles email + role + capabilities", () => {
    const d = describeUser("marcy.spear@gmail.com");
    expect(d.email).toBe("marcy.spear@gmail.com");
    expect(d.role).toBe("editor");
    expect(d.capabilities.canEditSchedule).toBe(true);
  });
});
