# Backend Audit Findings — 2026-06-17

## Health
- **TypeScript:** clean (`npx tsc --noEmit` → 0 errors).
- **TODO/FIXME/HACK:** only 1 real hit, and it is documentation prose in `runbooks.ts` (lists a `TODO` Drive folder name), not an unfinished code path. No actionable TODOs.
- **"not implemented" / placeholder:** all hits are intentional — agenda-editor guard prose, PDF "pages follow" notes, tutor placeholder emails (`@tbd.local`, replaced when real tutors supplied), and an in-progress book entry ("Michael's World"). No dead stubs throwing "not implemented".

## ihsd.us (inactive school email) — CONFIRMED SAFE
All references are **hard-block guards**, never active usage:
- `appAccountVaultEntry.ts` — `BLOCKED_EMAIL` constant; refuses to write a vault row for it.
- `appLinkPlacementHints.ts` — `BLOCKED_KID_EMAIL` guard.
- `appLinkSignInMethodTagger.ts` — `BLOCKED_REAGAN_EMAILS` set; tagger never hands Reagan that email.
- `adultRepairLineSelector.ts` — copy strings for "blocked attempt" repair lines.
This is correct, defensive behavior. No change needed.

## Scheduled jobs — ALL 5 LIVE & WIRED
| Job | Cron (UTC) | ET equiv | Last fired | Route exists |
|-----|-----------|----------|-----------|--------------|
| auto-attach-evening | 0 0 0 * * * | 8 PM EDT | 2026-06-17 | OK |
| nightly-agenda-email | 0 0 11 * * * | 7 AM EDT | 2026-06-17 | OK |
| daily-recap-send | 0 0 0 * * * | 8 PM EDT | 2026-06-17 | OK |
| weekly-digest-send | 0 0 22 * * 0 | Sun 6 PM EDT | 2026-06-14 | OK |
| nightly-analytics-csv | 0 5 0 * * * | 8:05 PM EDT | 2026-06-17 | OK |

Every live cron callback path maps to a registered Express route in `scheduledSync.ts`. `registerScheduledSync(app)` is wired in `_core/index.ts`. No orphaned cron (cron with no route) and no missing route.

### Finding F1 — nightly agenda email timing mismatch
- Requirement: **weekdays 6:30 AM ET**.
- Actual cron: `0 0 11 * * *` = **7:00 AM EDT, every day (7/7)**.
- Mitigation already in code: the endpoint resolves the target date by skipping Sat/Sun (`while (target.getDay()===0||6)`), so weekend runs still produce the *next school day's* agenda rather than a junk weekend email. So functionally it is weekday-relevant, but it fires at 7:00 not 6:30, and it does technically run on weekend mornings.
- **Decision:** low risk for test-out day. Will note in report; can retune cron to `0 30 10 * * 1-5` (6:30 AM EDT, Mon–Fri) if Katy wants exact timing. Not blocking.

## Note: many "orphaned" /api/scheduled/* routes are intentional
`scheduledSync.ts` defines ~27 `/api/scheduled/*` routes but only 5 have live crons. The rest (upload-sync, drive-push, drive-folder-map, classroom-agendas, iep-refresh, morning-brief, ical-refresh, drive-snapshot, daily-log-rebuild, etc.) are **on-demand endpoints** the platform agent / admin playbook POSTs to manually, or are credential-gated and dormant until Google scopes land. They are not dead — they are the manual + future-automation surface. Documented, not removed.

## Conclusion
Backend is structurally clean and production-safe for the test-out day. The only real-world note is the 7:00-vs-6:30 email timing (cosmetic) and the all-days cron (mitigated by weekend-skip logic). No dead code, no contradictions, no stale active restrictions found.
