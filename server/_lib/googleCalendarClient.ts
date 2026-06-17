/**
 * Minimal Google Calendar v3 REST client (fetch-based, Node-only).
 * ================================================================
 *
 * Why hand-rolled instead of `googleapis`? The Autoscale deploy image is
 * Node-only with a 512 MiB cap and cold-start sensitivity; the full
 * `googleapis` SDK is heavy and pulls a large dependency tree we don't
 * need. We only touch four endpoints (list / insert / patch / delete),
 * so a thin fetch wrapper keeps the bundle small and the behaviour
 * transparent.
 *
 * Auth: accepts a bearer access token. Token acquisition lives in
 * `googleCalendarAuth.ts` so this module stays a pure transport layer
 * (easy to unit-test by stubbing global fetch).
 */

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

export type GCalEventResource = {
  id?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
  reminders?: { useDefault?: boolean; overrides?: Array<{ method: string; minutes: number }> };
  extendedProperties?: { private?: Record<string, string> };
  status?: string;
};

export class GoogleCalendarClient {
  constructor(
    private accessToken: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async req(path: string, init: RequestInit = {}): Promise<any> {
    const res = await this.fetchImpl(`${CAL_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (res.status === 204) return null; // delete returns empty
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const msg =
        (body && body.error && (body.error.message || JSON.stringify(body.error))) ||
        `Google Calendar API ${res.status}`;
      const err = new Error(msg) as Error & { status?: number; body?: unknown };
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  /**
   * List events on a calendar within [timeMin, timeMax). Optionally
   * filter by a private extended property (used for idempotency:
   * privateExtendedProperty="dashboardBlockId=123").
   */
  async listEvents(opts: {
    calendarId: string;
    timeMin: string;
    timeMax: string;
    privateExtendedProperty?: string;
    maxResults?: number;
  }): Promise<GCalEventResource[]> {
    const params = new URLSearchParams({
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
      singleEvents: "true",
      maxResults: String(opts.maxResults ?? 250),
      showDeleted: "false",
    });
    if (opts.privateExtendedProperty) {
      params.append("privateExtendedProperty", opts.privateExtendedProperty);
    }
    const cal = encodeURIComponent(opts.calendarId);
    const body = await this.req(`/calendars/${cal}/events?${params.toString()}`);
    return (body && Array.isArray(body.items) ? body.items : []) as GCalEventResource[];
  }

  async insertEvent(calendarId: string, event: GCalEventResource): Promise<GCalEventResource> {
    const cal = encodeURIComponent(calendarId);
    return (await this.req(`/calendars/${cal}/events`, {
      method: "POST",
      body: JSON.stringify(event),
    })) as GCalEventResource;
  }

  async patchEvent(
    calendarId: string,
    eventId: string,
    event: Partial<GCalEventResource>,
  ): Promise<GCalEventResource> {
    const cal = encodeURIComponent(calendarId);
    const eid = encodeURIComponent(eventId);
    return (await this.req(`/calendars/${cal}/events/${eid}`, {
      method: "PATCH",
      body: JSON.stringify(event),
    })) as GCalEventResource;
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const cal = encodeURIComponent(calendarId);
    const eid = encodeURIComponent(eventId);
    await this.req(`/calendars/${cal}/events/${eid}`, { method: "DELETE" });
  }
}
