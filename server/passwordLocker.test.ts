import { describe, it, expect } from "vitest";
import { encryptPassword, decryptPassword } from "./passwordLocker";

describe("password locker", () => {
  it("round-trips a password", () => {
    const { ciphertext, iv } = encryptPassword("Goose214$");
    expect(ciphertext).toBeTruthy();
    expect(iv).toBeTruthy();
    expect(decryptPassword(ciphertext, iv)).toBe("Goose214$");
  });

  it("never produces the same ciphertext twice for the same input", () => {
    const a = encryptPassword("hello");
    const b = encryptPassword("hello");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it("rejects tampered ciphertext", () => {
    const { ciphertext, iv } = encryptPassword("secret");
    // flip a byte in the middle
    const buf = Buffer.from(ciphertext, "base64");
    buf[Math.floor(buf.length / 2)] ^= 0x55;
    const tampered = buf.toString("base64");
    expect(() => decryptPassword(tampered, iv)).toThrow();
  });

  it("rejects empty plaintext", () => {
    expect(() => encryptPassword("")).toThrow();
  });
});
