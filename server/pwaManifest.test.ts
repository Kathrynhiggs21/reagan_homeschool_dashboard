import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = join(__dirname, "..", "client", "public");

describe("PWA manifest", () => {
  const manifest = JSON.parse(
    readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8")
  );

  it("has the required installability fields", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toMatch(/^#/);
    expect(manifest.theme_color).toMatch(/^#/);
  });

  it("declares a 192 and a 512 any-purpose icon plus a maskable icon", () => {
    const icons = manifest.icons as Array<{
      sizes: string;
      purpose?: string;
    }>;
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(icons.some((i) => (i.purpose ?? "").includes("maskable"))).toBe(true);
  });

  it("points every icon at a /manus-storage url (no local heavy assets in repo)", () => {
    for (const icon of manifest.icons as Array<{ src: string }>) {
      expect(icon.src.startsWith("/manus-storage/")).toBe(true);
    }
  });
});

describe("service worker safety", () => {
  const sw = readFileSync(join(PUBLIC, "sw.js"), "utf8");

  it("never caches API, tRPC, or signed storage routes", () => {
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('url.pathname.startsWith("/manus-storage/")');
    expect(sw).toContain('url.pathname.includes("/trpc")');
  });

  it("only handles GET requests", () => {
    expect(sw).toContain('req.method !== "GET"');
  });

  it("uses a versioned cache name so old caches can be purged on activate", () => {
    expect(sw).toMatch(/const CACHE\s*=\s*"[^"]+v\d+"/);
  });
});
