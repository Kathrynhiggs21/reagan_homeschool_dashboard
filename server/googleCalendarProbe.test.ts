import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { probeCalendarConnection } from "./_lib/googleCalendarSync";

/**
 * Tests for the live write-access probe that powers the Settings
 * "Connect Google Calendar" panel. We use a BARE OAuth token so the auth
 * resolver returns immediately (no token-mint network call), then stub
 * fetch to simulate Calendar API responses for list (read) + insert
 * (write) + delete (cleanup).
 */

const ORIGINAL_ENV = { ...process.env };

function setBareToken() {
  // Bare token => resolver returns it directly, no network mint.
  // Must be long enough (>=60 chars, no whitespace) to pass the resolver's
  // plausibility check (isPlausibleBareOAuthToken), which guards against
  // short placeholder tokens shadowing a real credential.
  process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = "ya29.fake-access-token-" + "A".repeat(80);
  delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
}

function clearCreds() {
  delete process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
  delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("probeCalendarConnection", () => {
  it("reports no_credentials when nothing is configured", async () => {
    clearCreds();
    const fetchImpl = (async () => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;
    const res = await probeCalendarConnection({ fetchImpl });
    expect(res.status).toBe("no_credentials");
    expect(res.writeProbeStatus).toBeNull();
  });

  it("reports writable when list + insert + delete all succeed", async () => {
    setBareToken();
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      calls.push(`${method} ${String(url).includes("/events?") ? "LIST" : method === "POST" ? "INSERT" : method === "DELETE" ? "DELETE" : "OTHER"}`);
      if (String(url).includes("/events?")) return jsonResponse(200, { items: [] });
      if (method === "POST") return jsonResponse(200, { id: "evt-probe-123" });
      if (method === "DELETE") return new Response(null, { status: 204 });
      return jsonResponse(200, {});
    }) as unknown as typeof fetch;

    const res = await probeCalendarConnection({ fetchImpl });
    expect(res.status).toBe("writable");
    expect(res.writeProbeStatus).toBe(200);
    // It must clean up the throwaway event.
    expect(calls.some((c) => c.includes("DELETE"))).toBe(true);
  });

  it("reports read_only when insert returns 403", async () => {
    setBareToken();
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      if (String(url).includes("/events?")) return jsonResponse(200, { items: [] });
      if (method === "POST") {
        return jsonResponse(403, { error: { message: "You need to have writer access to this calendar." } });
      }
      return jsonResponse(200, {});
    }) as unknown as typeof fetch;

    const res = await probeCalendarConnection({ fetchImpl });
    expect(res.status).toBe("read_only");
    expect(res.writeProbeStatus).toBe(403);
    expect(res.message.toLowerCase()).toContain("make changes to events");
  });

  it("reports calendar_unreachable when list (read) fails", async () => {
    setBareToken();
    const fetchImpl = (async (url: string) => {
      if (String(url).includes("/events?")) {
        return jsonResponse(404, { error: { message: "Not Found" } });
      }
      return jsonResponse(200, {});
    }) as unknown as typeof fetch;

    const res = await probeCalendarConnection({ fetchImpl });
    expect(res.status).toBe("calendar_unreachable");
  });

  it("surfaces the service-account email to share with when SA JSON is set", async () => {
    clearCreds();
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "school-calendar-api@reagans-daily-sparkle.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----\\n",
    });
    // Token mint will be attempted; fail it so we exercise the unreachable
    // branch but still confirm shareWithEmail is populated.
    const fetchImpl = (async () => jsonResponse(400, { error: "invalid_grant" })) as unknown as typeof fetch;
    const res = await probeCalendarConnection({ fetchImpl });
    expect(res.shareWithEmail).toBe(
      "school-calendar-api@reagans-daily-sparkle.iam.gserviceaccount.com",
    );
  });
});
