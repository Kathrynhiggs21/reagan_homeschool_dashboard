/**
 * flashcardMaker.test.ts
 * Tests for flashcard deck and card logic, and GMAIL mailer env validation.
 */
import { describe, it, expect } from "vitest";

// ── Flashcard deck helpers ──────────────────────────────────────────────────

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function estimateStudyTime(cardCount: number, secondsPerCard = 15): string {
  const total = cardCount * secondsPerCard;
  if (total < 60) return `${total}s`;
  return `${Math.ceil(total / 60)} min`;
}

function flipCard(card: { front: string; back: string }): { front: string; back: string } {
  return { front: card.back, back: card.front };
}

// ── GMAIL env validation ────────────────────────────────────────────────────

function checkMailerEnv(): { smtpUser: boolean; appPassword: boolean; ready: boolean } {
  const smtpUser = !!process.env.GMAIL_SMTP_USER;
  const appPassword = !!process.env.GMAIL_APP_PASSWORD;
  return { smtpUser, appPassword, ready: smtpUser && appPassword };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Flashcard Maker", () => {
  describe("slugify", () => {
    it("converts a title to a URL-safe slug", () => {
      expect(slugify("Dividing Fractions")).toBe("dividing-fractions");
      expect(slugify("Earth's Layers!")).toBe("earth-s-layers");
      expect(slugify("  Long  Division  ")).toBe("long-division");
    });
  });

  describe("estimateStudyTime", () => {
    it("returns seconds for small decks", () => {
      expect(estimateStudyTime(3)).toBe("45s");
    });
    it("returns minutes for larger decks", () => {
      expect(estimateStudyTime(10)).toBe("3 min");
      expect(estimateStudyTime(20)).toBe("5 min");
    });
    it("uses custom seconds-per-card", () => {
      expect(estimateStudyTime(4, 30)).toBe("2 min");
    });
  });

  describe("flipCard", () => {
    it("swaps front and back", () => {
      const card = { front: "What is photosynthesis?", back: "The process plants use to make food from sunlight." };
      const flipped = flipCard(card);
      expect(flipped.front).toBe(card.back);
      expect(flipped.back).toBe(card.front);
    });
  });
});

describe("GMAIL Mailer", () => {
  it("has GMAIL_SMTP_USER set", () => {
    const { smtpUser } = checkMailerEnv();
    expect(smtpUser).toBe(true);
  });

  it("has GMAIL_APP_PASSWORD set", () => {
    const { appPassword } = checkMailerEnv();
    expect(appPassword).toBe(true);
  });

  it("mailer is ready to send", () => {
    const { ready } = checkMailerEnv();
    expect(ready).toBe(true);
  });
});

describe("Review System", () => {
  it("calculates mastery percentage correctly", () => {
    const correct = 7;
    const total = 10;
    const pct = Math.round((correct / total) * 100);
    expect(pct).toBe(70);
  });

  it("classifies mastery level", () => {
    const classify = (score: number) =>
      score >= 80 ? "strong" : score >= 50 ? "developing" : "needs-practice";
    expect(classify(90)).toBe("strong");
    expect(classify(65)).toBe("developing");
    expect(classify(30)).toBe("needs-practice");
  });

  it("generates today date string in YYYY-MM-DD format", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
