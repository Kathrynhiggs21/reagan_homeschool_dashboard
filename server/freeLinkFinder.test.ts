import { describe, it, expect } from "vitest";
import { findFreeLinks } from "./freeLinkFinder";

describe("findFreeLinks", () => {
  it("returns Khan + IXL + Education.com printable for a math topic", () => {
    const links = findFreeLinks({ subjectSlug: "math", topicName: "fractions" });
    const sources = links.map((l) => l.source);
    expect(sources).toContain("Khan Academy");
    expect(sources).toContain("IXL");
    expect(sources).toContain("Education.com");
    expect(links.every((l) => l.url.startsWith("https://"))).toBe(true);
  });

  it("uses ReadWorks instead of IXL for an ELA reading topic", () => {
    const links = findFreeLinks({ subjectSlug: "ela", topicName: "main idea" });
    const sources = links.map((l) => l.source);
    expect(sources).toContain("ReadWorks");
    expect(sources).not.toContain("IXL");
  });

  it("returns Smithsonian + outdoor link for a science topic", () => {
    const links = findFreeLinks({ subjectSlug: "science", topicName: "weather" });
    const sources = links.map((l) => l.source);
    expect(sources).toContain("Smithsonian Learning Lab");
    expect(sources).toContain("Outdoor Classroom Day");
  });

  it("URL-encodes the topic name (handles spaces + apostrophes)", () => {
    const links = findFreeLinks({ subjectSlug: "math", topicName: "Bob's pizza fractions" });
    expect(links[0].url).toContain("Bob");
    expect(links[0].url).toContain("pizza");
    expect(links[0].url).not.toContain(" ");
  });

  it("dedupes by url even if the same kind shows up twice", () => {
    const links = findFreeLinks({ subjectSlug: "math", topicName: "x" });
    const urls = links.map((l) => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
