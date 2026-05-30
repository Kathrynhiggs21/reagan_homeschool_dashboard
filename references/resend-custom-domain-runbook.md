# Resend Custom Domain Verification — Runbook

**Why this matters:** Resend's free tier on the shared `onboarding@resend.dev`
domain only accepts the address that owns the API key (today: `spear.cpt@gmail.com`).
Until a custom domain is verified, `marcy.spear@gmail.com` (Grandma Marcy) cannot
receive the nightly agenda email through Resend. The Gmail SMTP fallback covers
her today, but verifying a domain is the right long-term fix and removes the
fallback dependency.

## What's already in place

- `server/_core/mailer.ts` reads `MAIL_ALLOWED_RECIPIENTS` from env. Today this
  is set to `spear.cpt@gmail.com` (single allow-list entry) so Resend never
  attempts to deliver to Grandma directly.
- `server/_core/mailer.ts` already has a Gmail SMTP fallback transport that
  picks up any recipient Resend's allow-list filter dropped, using
  `GMAIL_SMTP_USER` + `GMAIL_APP_PASSWORD`. So Grandma still gets the email,
  just via SMTP not Resend.
- 4 vitest scenarios in `server/mailerResend.test.ts` lock the dual-path
  behavior: Resend-only path, allow-list dropped → SMTP fallback, both paths
  fail → returns the right error envelope.

## Steps for the user

1. Pick a domain you own (or buy one). The cheapest path is to use the
   existing `scribblesbymarcy.com` if Marcy is OK with sending Reagan's school
   email through that domain; otherwise buy a cheap `.com` like
   `reaganhomeschool.com` at any registrar.
2. Go to `https://resend.com/domains` and click **Add Domain**.
3. Resend will give you a set of DNS records to add (1 SPF TXT, 1 DKIM CNAME or
   TXT, optionally 1 DMARC TXT). Add each one at your DNS provider.
4. Wait 10-30 minutes (sometimes faster) and click **Verify** in Resend.
5. Once verified, in this project's settings panel, update:
   - `MAIL_FROM` = `Reagan's School Dashboard <agenda@your-verified-domain.com>`
   - `MAIL_ALLOWED_RECIPIENTS` = (delete this env var entirely so the allow-list
     is empty and every recipient goes through Resend)
6. Send a test email from the **Mail Diagnostics** card in the adult Settings
   page (or call `trpc.mail.testSend` from a tRPC client). You should see
   both `spear.cpt@gmail.com` and `marcy.spear@gmail.com` in the success
   recipients list, with `path: "resend"` (not `"smtp_fallback"`).
7. Mark the todo item as `[x]`.

## Rollback

If Resend has trouble with the custom domain, keep `MAIL_ALLOWED_RECIPIENTS`
populated and rely on the SMTP fallback — no code change needed. The
fallback was specifically designed for this scenario.

---
_Last updated: 2026-05-30_
