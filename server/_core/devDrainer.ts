/**
 * Dev-only drainer-token mint (v3.23, 2026-05-31)
 * ================================================
 *
 * Exposes `POST /api/dev/mint-drainer-token` only when the server is
 * running in NODE_ENV=development. The endpoint:
 *
 *   - Refuses anything that didn't come from a localhost/loopback peer.
 *   - Mints a fresh drainer token signed with the live `JWT_SECRET` of
 *     the running server.
 *   - Returns `{ token, expiresAtISO }` as JSON.
 *
 * Why localhost-only:
 *   The token has admin-equivalent scope for the connector procs, so
 *   exposing the mint to anyone but the same machine would be a footgun.
 *   In production this entire registration is a no-op.
 *
 * Why bother:
 *   The first-ever drain run needs a token before any admin browser
 *   session exists in the sandbox. This endpoint gets us bootstrapped
 *   without a Cloud Console / OAuth dance.
 */

import type express from "express";
import { mintDrainerToken } from "../_lib/drainerToken";

function isLoopback(remote: string | undefined): boolean {
  if (!remote) return false;
  // express stores peer addr in `req.ip`; with IPv6 the loopback can be
  // either `::1` (pure IPv6) or `::ffff:127.0.0.1` (IPv4-mapped).
  return (
    remote === "127.0.0.1" ||
    remote === "::1" ||
    remote === "::ffff:127.0.0.1" ||
    remote.startsWith("127.")
  );
}

export function registerDevDrainer(app: express.Express): void {
  if (process.env.NODE_ENV !== "development") return;
  app.post("/api/dev/mint-drainer-token", (req, res) => {
    const peer = (req.ip || req.socket?.remoteAddress || "").toString();
    if (!isLoopback(peer)) {
      res.status(403).json({ error: "dev-mint: localhost only", peer });
      return;
    }
    try {
      const sub =
        (typeof req.body === "object" && req.body && typeof req.body.sub === "string"
          ? req.body.sub
          : null) ||
        process.env.OWNER_OPEN_ID ||
        "dev-owner";
      const ttlRaw =
        typeof req.body === "object" && req.body && typeof req.body.ttlSeconds === "number"
          ? req.body.ttlSeconds
          : 15 * 60;
      const token = mintDrainerToken(sub, { ttlSeconds: ttlRaw });
      const expiresAtISO = new Date(Date.now() + ttlRaw * 1000).toISOString();
      res.json({ token, expiresAtISO, sub, hint: "dev-only" });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
  // eslint-disable-next-line no-console
  console.log("[devDrainer] POST /api/dev/mint-drainer-token (localhost only)");
}
