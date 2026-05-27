/**
 * server/mailer.test.ts
 *
 * Validates the Gmail SMTP credentials by calling verifySmtpConnection().
 * This test MUST pass before the nightly agenda email is considered fixed.
 *
 * Run: pnpm test --reporter=verbose mailer.test.ts
 */

import { describe, it, expect } from "vitest";
import { verifySmtpConnection, sendEmail } from "./_core/mailer";

describe("Gmail SMTP credentials", () => {
  it("GMAIL_SMTP_USER and GMAIL_APP_PASSWORD are set in env", () => {
    expect(process.env.GMAIL_SMTP_USER).toBeTruthy();
    expect(process.env.GMAIL_APP_PASSWORD).toBeTruthy();
  });

  it("SMTP transport can connect to Gmail (verifySmtpConnection)", async () => {
    const result = await verifySmtpConnection();
    if (!result.ok) {
      console.error("[mailer.test] SMTP verify failed:", result.error);
    }
    expect(result.ok).toBe(true);
  }, 20_000); // 20s timeout for network call

  it("sendEmail returns { ok: false, skipped: true } when creds are missing", async () => {
    // Temporarily unset env to test the graceful skip path
    const savedUser = process.env.GMAIL_SMTP_USER;
    const savedPass = process.env.GMAIL_APP_PASSWORD;
    delete process.env.GMAIL_SMTP_USER;
    delete process.env.GMAIL_APP_PASSWORD;

    const result = await sendEmail({
      to: "test@example.com",
      subject: "test",
      html: "<p>test</p>",
    });

    // Restore
    process.env.GMAIL_SMTP_USER = savedUser;
    process.env.GMAIL_APP_PASSWORD = savedPass;

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
  });
});
