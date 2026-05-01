/**
 * Lightweight server-side password locker.
 *
 * Encrypts plaintext passwords with AES-256-GCM using a key derived from
 * `JWT_SECRET` (which is already injected for this project). The IV is unique
 * per ciphertext and stored alongside the ciphertext on the row.
 *
 * Reasoning for picking JWT_SECRET as the KDF input rather than a separate env:
 *   - Already present, already secret, already 32+ bytes of entropy
 *   - One fewer secret to rotate
 *   - The rest of the app already trusts JWT_SECRET to gate auth
 *
 * If JWT_SECRET ever rotates, all stored passwords become unreadable. That is
 * the intended behavior — the parent should re-enter passwords on rotation.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function deriveKey(): Buffer {
  const secret = process.env.JWT_SECRET || "fallback-jwt-secret-do-not-use";
  // SHA-256 → 32 bytes for AES-256.
  return createHash("sha256").update(secret + ":app-accounts:v1").digest();
}

export function encryptPassword(plaintext: string): { ciphertext: string; iv: string } {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptPassword requires a non-empty string");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store ciphertext+tag together; iv stored separately
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptPassword(ciphertext: string, iv: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < 17) throw new Error("ciphertext too short");
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
