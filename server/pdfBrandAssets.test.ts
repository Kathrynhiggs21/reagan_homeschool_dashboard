import { describe, it, expect } from "vitest";
import PDFDocument from "pdfkit";
import { assetPath, loadKiwiLogo, registerBrandFonts } from "./_lib/pdfBrand";

/**
 * Guard test for the branded-PDF regression where the emailed nightly agenda
 * degraded to plain Times/Helvetica because the bundled brand assets
 * (Fredoka/Nunito TTFs + kiwi_logo.png) failed to resolve in the deployed
 * runtime (cwd not guaranteed to be the repo root; bundle lives at dist/).
 *
 * The fix: pdfBrand's ASSET_CANDIDATES checks bundle-local + walked-up dirs,
 * and the build copies server/_assets -> dist/_assets. If these assertions
 * fail, the colored template will silently fall back to plain fonts again.
 */
describe("PDF brand assets resolve (anti-regression)", () => {
  const REQUIRED_FONTS = [
    "Fredoka-SemiBold.ttf",
    "Fredoka-Medium.ttf",
    "Nunito-Regular.ttf",
    "Nunito-Bold.ttf",
    "Nunito-ExtraBold.ttf",
  ];

  it("resolves every required brand font file", () => {
    for (const f of REQUIRED_FONTS) {
      const p = assetPath(f);
      expect(p, `brand font missing: ${f}`).toBeTruthy();
    }
  });

  it("loads the Kiwi logo bytes for the banner", () => {
    const logo = loadKiwiLogo();
    expect(logo, "kiwi_logo.png did not resolve").toBeTruthy();
    expect((logo as Buffer).length).toBeGreaterThan(1000);
  });

  it("registerBrandFonts reports ok:true and returns brand font names (not the plain fallback)", () => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const fonts = registerBrandFonts(doc);
    expect(fonts.ok).toBe(true);
    // When ok, names are the registered brand fonts, NOT Times/Helvetica.
    expect(fonts.title).toBe("Fredoka-SemiBold");
    expect(fonts.display).toBe("Fredoka-Medium");
    expect(fonts.h).toBe("Nunito-ExtraBold");
    expect(fonts.body).toBe("Nunito");
    expect(fonts.bodyB).toBe("Nunito-Bold");
    expect(fonts.title).not.toMatch(/Times|Helvetica/);
  });
});
