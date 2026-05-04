import { describe, it, expect } from "vitest";
import { parseTime12h, formatTime12h } from "../client/src/lib/time12h";

describe("parseTime12h", () => {
  it("parses 12-hour AM/PM forms", () => {
    expect(parseTime12h("9:00 AM")).toBe("09:00");
    expect(parseTime12h("9:00am")).toBe("09:00");
    expect(parseTime12h("9 AM")).toBe("09:00");
    expect(parseTime12h("9am")).toBe("09:00");
    expect(parseTime12h("1:30 PM")).toBe("13:30");
    expect(parseTime12h("12:00 AM")).toBe("00:00");
    expect(parseTime12h("12:00 PM")).toBe("12:00");
    expect(parseTime12h("12:15 PM")).toBe("12:15");
  });

  it("parses bare 24-hour HH:MM", () => {
    expect(parseTime12h("13:00")).toBe("13:00");
    expect(parseTime12h("9:00")).toBe("09:00");
    expect(parseTime12h("00:00")).toBe("00:00");
    expect(parseTime12h("23:59")).toBe("23:59");
  });

  it("rejects garbage", () => {
    expect(parseTime12h("")).toBeNull();
    expect(parseTime12h("not a time")).toBeNull();
    expect(parseTime12h("9:99 AM")).toBeNull();
    expect(parseTime12h("13:00 PM")).toBeNull();
    expect(parseTime12h("0 PM")).toBeNull();
    expect(parseTime12h("25:00")).toBeNull();
  });
});

describe("formatTime12h", () => {
  it("formats 24-hour HH:MM as 12-hour AM/PM", () => {
    expect(formatTime12h("09:00")).toBe("9:00 AM");
    expect(formatTime12h("13:30")).toBe("1:30 PM");
    expect(formatTime12h("00:00")).toBe("12:00 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
    expect(formatTime12h("23:59")).toBe("11:59 PM");
  });

  it("returns em-dash for null/empty/invalid", () => {
    expect(formatTime12h(null)).toBe("—");
    expect(formatTime12h(undefined)).toBe("—");
    expect(formatTime12h("")).toBe("—");
    expect(formatTime12h("nope")).toBe("—");
    expect(formatTime12h("99:99")).toBe("—");
  });

  it("round-trips parse + format", () => {
    const inputs = ["9:00 AM", "1:30 PM", "12:00 AM", "12:00 PM", "11:59 PM"];
    for (const i of inputs) {
      const canon = parseTime12h(i)!;
      expect(formatTime12h(canon)).toBe(i);
    }
  });
});
