export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // v2.92 (2026-05-27) — shared bearer secret used by Heartbeat / AGENT cron
  // callbacks to /api/scheduled/* endpoints. Bypasses the deployment-edge
  // cookie gate that has been silently 403'ing the nightly agenda email
  // since May 4. Never sent to the client. Server-side only.
  scheduledBearer: process.env.SCHEDULED_BEARER ?? "",
};
