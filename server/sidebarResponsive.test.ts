import { describe, it, expect } from "vitest";
import { asideResponsiveClass, showMobileBackdrop } from "@shared/sidebarResponsive";

describe("sidebar responsive classes", () => {
  it("is off-canvas (hidden) on mobile when the drawer is closed", () => {
    const cls = asideResponsiveClass(false, false);
    expect(cls).toContain("-translate-x-full");
    // closed: not slid in on mobile (guard against a stray standalone token)
    expect(cls.split(" ")).not.toContain("translate-x-0");
    // but desktop must still force it visible
    expect(cls).toContain("lg:translate-x-0");
  });

  it("slides in on mobile when the drawer is open", () => {
    const cls = asideResponsiveClass(false, true);
    expect(cls.split(" ")).toContain("translate-x-0");
    expect(cls).not.toContain("-translate-x-full");
  });

  it("is fixed on mobile but sticky on desktop (prevents overlap on phones)", () => {
    const cls = asideResponsiveClass(false, false);
    expect(cls.split(" ")).toContain("fixed");
    expect(cls).toContain("lg:sticky");
  });

  it("keeps the drawer above content on mobile and resets z-index on desktop", () => {
    const cls = asideResponsiveClass(false, true);
    expect(cls).toContain("z-50");
    expect(cls).toContain("lg:z-auto");
  });

  it("uses the full 240px width on mobile and collapses only at lg", () => {
    const expanded = asideResponsiveClass(false, false);
    expect(expanded.split(" ")).toContain("w-60");
    expect(expanded).toContain("lg:w-60");

    const collapsed = asideResponsiveClass(true, false);
    // On mobile the drawer is always full width; collapsing is desktop-only.
    expect(collapsed.split(" ")).toContain("w-60");
    expect(collapsed).toContain("lg:w-16");
    expect(collapsed).not.toContain("lg:w-60");
  });

  it("animates transform on mobile and width on desktop", () => {
    const cls = asideResponsiveClass(true, false);
    expect(cls).toContain("transition-transform");
    expect(cls).toContain("lg:transition-[width]");
  });

  it("renders the backdrop only when the drawer is open", () => {
    expect(showMobileBackdrop(true)).toBe(true);
    expect(showMobileBackdrop(false)).toBe(false);
  });
});
