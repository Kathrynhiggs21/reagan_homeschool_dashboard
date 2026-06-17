# Turning On Google Drive & Classroom Import — Step-by-Step Guide

**For:** Katy
**Date:** June 17, 2026
**Goal:** Let Reagan's dashboard read Google Classroom assignments and save/organize files into Google Drive automatically.

---

## First, the honest status

Two pieces are needed before this works, and only the first one is something you do:

1. **A Google access token** (the part below) — a one-time setup you complete in your Google account so the dashboard is *allowed* to touch Drive/Classroom. This guide walks you through it.
2. **The "live uploader" code** — right now the dashboard has all the planning/organizing logic built and tested, but the final piece that actually *creates folders and uploads files to Drive* is still a placeholder stub (it's intentionally turned off until a token exists). I will finish that after test-out day. **You do not need to do anything for this part** — it's my work, not yours.

So: this guide gets the *permission* ready. Once you've done it and I've flipped the uploader live, Drive import switches on. Calendar sync already works today; this is only for Drive + Classroom.

**You do not need to do any of this before tomorrow's test-out day.** It's a nice-to-have, not a blocker.

---

## The simplest path (OAuth token)

You'll create a Google "app" for yourself and hand the dashboard a token. It sounds technical but it's about 10 minutes of clicking.

### Step 1 — Make a Google Cloud project
- Go to https://console.cloud.google.com/
- Click **New Project**. Name it `reagan-school-hub`. Click **Create**.

### Step 2 — Turn on the Drive API
- In the top search bar, type **Drive API**, open it, click **Enable**.
- (Optional) Also search **Google Classroom API** and **Enable** it if you want assignment import too.

### Step 3 — Set up the consent screen
- Left menu: **APIs & Services → OAuth consent screen**.
- User type: **External** → Create.
- App name: `Reagan School Hub`
- User support email and developer contact: `spear.cpt@gmail.com`
- Under **Scopes**, add: `https://www.googleapis.com/auth/drive` (and, for Classroom, `https://www.googleapis.com/auth/classroom.coursework.me.readonly`).
- Under **Test users**, add `spear.cpt@gmail.com` (and `marcy.spear@gmail.com` if you want Grandma able to grant it too).
- Save.

### Step 4 — Create the credentials
- Left menu: **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
- Application type: **Desktop app**. Name: `Reagan School Hub CLI`. Click **Create**.
- Download the small `client_secret_*.json` file it gives you.

### Step 5 — Get the refresh token
- Go to https://developers.google.com/oauthplayground/
- Click the **gear icon** (top right) → check **Use your own OAuth credentials** → paste the client ID and client secret from Step 4.
- In the scope list on the left, find and select `https://www.googleapis.com/auth/drive` → click **Authorize APIs**.
- Sign in as `spear.cpt@gmail.com` and approve.
- On the next screen click **Exchange authorization code for tokens**.
- Copy the **refresh token** (a long string starting with `1//`).

### Step 6 — Build the token blob
Make a single line of text in exactly this shape (fill in your three values):

```json
{"client_id":"...apps.googleusercontent.com","client_secret":"...","refresh_token":"1//...","type":"authorized_user"}
```

### Step 7 — Paste it into the dashboard
- In the dashboard, open **Settings → Secrets**.
- Add a new secret:
  - **Key:** `GOOGLE_DRIVE_OAUTH_TOKEN`
  - **Value:** the single-line JSON from Step 6.
- Save.

That's it for your part. Tell me once it's in, and I'll flip the live uploader on and verify.

---

## Alternative path (service account) — better for fully-automatic, unattended syncing

If you'd rather not deal with refresh tokens, a "service account" is a robot Google account that never needs re-login:

1. Same Cloud project. Go to **IAM & Admin → Service Accounts → Create Service Account**. Name it `reagan-school-hub-bot`. No role needed.
2. Open it → **Keys → Add Key → JSON** → download the file.
3. In Google Drive, right-click your **"Reagan School Hub"** root folder → **Share** → paste the service account email (ends in `...iam.gserviceaccount.com`) → give it **Editor**. *(This sharing step is essential — without it the robot sees nothing.)*
4. In **Settings → Secrets**, add:
   - **Key:** `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`
   - **Value:** the entire JSON file contents.

---

## How we'll confirm it worked (after I finish the uploader)

- Open **Settings → Automation Health**. Within about a minute the Drive push worker runs; the card flips from `skipped_no_credentials` to `drained` (or shows a clear per-row error if one file failed).
- Open Google Drive and confirm the reference docs land in their folders (Curriculum and Standards, Adventures, etc.).

---

## What to do for tomorrow

Nothing. Calendar sync already works, and the Notebook already saves notes to Drive. Classroom/Drive import is a post-test-out-day enhancement — do this guide whenever it's convenient, then ping me to finish the live wiring.

---

*Prepared by Manus AI. Steps mirror the in-app runbook (`server/_lib/runbooks.ts`) so the dashboard and this guide stay in sync.*
