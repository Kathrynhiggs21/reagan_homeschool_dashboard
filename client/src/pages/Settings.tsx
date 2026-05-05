import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAdultLock } from "@/contexts/AdultLockContext";
import RewardsManagerCard from "@/components/RewardsManagerCard";
import TutorsManager from "@/components/TutorsManager";
import CalendarSyncCard from "@/components/CalendarSyncCard";
import AppointmentsCardLite from "@/components/AppointmentsCardLite";
import SettingsAIHelperCard from "@/components/SettingsAIHelperCard";
import { useKiwi } from "@/contexts/KiwiContext";
import { Slider } from "@/components/ui/slider";

/**
 * Settings — slim version (locked May 4 2026).
 *
 * Five tabs, one short card per concern, no duplication, anyone can use cold:
 *   People        — Reagan basics + tutor list (name + day + time)
 *   Prizes        — the ~10 prize tiles + add prize
 *   Requests      — Reagan's pending requests, approve/decline
 *   Calendar      — Mom's iCal URL + recurring appointments + IH calendar toggle
 *   Notifications — recipient emails + 8 PM agenda toggle
 */
export default function Settings() {
  return (
    <div className="container max-w-4xl py-6 space-y-4">
      <header>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Everything that controls how the dashboard runs.
        </p>
      </header>

      <SettingsAIHelperCard />

      <Tabs defaultValue="people" className="w-full">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="prizes">Prizes</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="notifications">Email</TabsTrigger>
          <TabsTrigger value="kiwi">Kiwi &amp; UI</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-4">
          <ReaganBasicsCard />
          <TutorsManager />
          <AdultPasscodeCard />
          <KiwiListeningCard />
          <CartoonVoiceCard />
        </TabsContent>

        <TabsContent value="prizes">
          <RewardsManagerCard />
        </TabsContent>

        <TabsContent value="requests">
          <RequestsInboxCard />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <IcalFeedsCard />
          <CalendarSyncCard />
          <AppointmentsCardLite />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsCard />
        </TabsContent>

        <TabsContent value="kiwi" className="space-y-4">
          <KiwiPersonalityCard />
          <DashboardObjectsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------------- Cards --------------------------------- */

/** 2026-05-05: Kiwi personality — sliders for animation amount, talking, funny. */
function KiwiPersonalityCard() {
  const k = useKiwi();
  const Row = ({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: any) => void }) => (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-[11px] text-muted-foreground">{["Off","Calm","Soft","Normal","Lively"][value]}</span>
      </div>
      <Slider value={[value]} min={0} max={4} step={1} onValueChange={(v) => onChange(v[0] ?? 0)} />
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Kiwi personality</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Row label="Animation amount" hint="How often Kiwi flutters, hops, or flies." value={k.animationLevel ?? 3} onChange={k.setAnimationLevel} />
        <Row label="Talking amount" hint="How chatty Kiwi is when not directly asked." value={k.talkLevel ?? 3} onChange={k.setTalkLevel} />
        <Row label="Funny" hint="How playful Kiwi's tone is." value={k.funnyLevel ?? 3} onChange={k.setFunnyLevel} />
      </CardContent>
    </Card>
  );
}

/** 2026-05-05: per-object visibility toggles for dashboard helpers. */
function DashboardObjectsCard() {
  const k = useKiwi();
  const Row = ({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <Label className="text-sm">{label}</Label>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Dashboard helpers</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Row label="Show bird sprites in sidebar" hint="My Flock row under the navigation. Off by default." value={!!k.showSidebarFlock} onChange={k.setShowSidebarFlock} />
        <Row label="Show Kiwi perch (bottom-right)" hint="The cartoon Kiwi that lives on every page." value={k.showKiwiPerch !== false} onChange={k.setShowKiwiPerch} />
        <Row label="Show Quick-Add button" hint="The +Quick Add button for adults at the bottom." value={k.showQuickAddFab !== false} onChange={k.setShowQuickAddFab} />
        <Row label="Show Notebook drawer pill" hint="The mid-right edge handle that opens the Notebook." value={k.showNotebookDrawer !== false} onChange={k.setShowNotebookDrawer} />
      </CardContent>
    </Card>
  );
}


function ReaganBasicsCard() {
  const profile = trpc.profile.get.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Saved.");
      utils.profile.get.invalidate();
    },
  });

  const [name, setName] = useState("Reagan");
  const [grade, setGrade] = useState("5th Grade");
  const [iep, setIep] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.studentName || "Reagan");
    setGrade(profile.data.gradeLevel || "5th Grade");
    setIep(((profile.data as any).iepNote || "") as string);
  }, [profile.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reagan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Grade</Label>
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>IEP note (one line)</Label>
          <Input
            value={iep}
            onChange={(e) => setIep(e.target.value)}
            placeholder="e.g. Math goals, 504 accommodations…"
          />
        </div>
        <Button
          onClick={() =>
            update.mutate({
              studentName: name,
              gradeLevel: grade,
              iepNote: iep,
            } as any)
          }
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function AdultPasscodeCard() {
  const { setPasscode } = useAdultLock();
  const [next, setNext] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adult passcode</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2 items-end">
        <div className="flex-1">
          <Label>Change passcode (default 3918)</Label>
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="New passcode"
          />
        </div>
        <Button
          onClick={() => {
            if (next.trim().length < 4) {
              toast.error("At least 4 digits.");
              return;
            }
            setPasscode(next.trim());
            setNext("");
            toast.success("Passcode updated.");
          }}
        >
          Update
        </Button>
      </CardContent>
    </Card>
  );
}

function RequestsInboxCard() {
  // The studentRequests router may not be wired yet; render gracefully.
  const list = (trpc as any).studentRequests?.listPending?.useQuery
    ? (trpc as any).studentRequests.listPending.useQuery()
    : { data: [], isLoading: false };
  const utils = trpc.useUtils();
  const decide = (trpc as any).studentRequests?.decide?.useMutation
    ? (trpc as any).studentRequests.decide.useMutation({
        onSuccess: () => {
          toast.success("Done.");
          (utils as any).studentRequests?.listPending?.invalidate?.();
        },
      })
    : { mutate: (_: any) => toast.info("Requests inbox coming online.") };

  const items: Array<{ id: number; kind: string; payload: string; createdAt: number }> = list.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reagan's requests</CardTitle>
      </CardHeader>
      <CardContent>
        {list.isLoading ? (
          <div className="text-muted-foreground text-sm py-6 text-center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-muted-foreground text-sm py-6 text-center">
            No requests right now.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="mb-1 capitalize">
                    {r.kind.replace(/_/g, " ")}
                  </Badge>
                  <div className="text-sm">{r.payload}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    onClick={() => (decide as any).mutate({ id: r.id, decision: "approved" })}
                  >
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => (decide as any).mutate({ id: r.id, decision: "declined" })}
                  >
                    No
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsCard() {
  const recipients = (trpc as any).recipients?.list?.useQuery?.() ?? { data: [] };
  const utils = trpc.useUtils();
  const add = (trpc as any).recipients?.add?.useMutation?.({
    onSuccess: () => (utils as any).recipients?.list?.invalidate?.(),
  });
  const remove = (trpc as any).recipients?.remove?.useMutation?.({
    onSuccess: () => (utils as any).recipients?.list?.invalidate?.(),
  });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // Settings kv toggle for nightly email
  const sendNightlyKey = "notifications.sendNightlyAgenda";
  const sendNightly = (trpc as any).appSettings?.get?.useQuery?.({ key: sendNightlyKey }) ?? {
    data: { value: "true" },
  };
  const setSetting = (trpc as any).appSettings?.set?.useMutation?.({
    onSuccess: () =>
      (utils as any).appSettings?.get?.invalidate?.({ key: sendNightlyKey }),
  });
  const nightlyOn = (sendNightly.data?.value ?? "true") !== "false";

  const list: Array<{ id: number; name: string | null; email: string }> = recipients.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email & agenda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border rounded-lg p-3">
          <div>
            <div className="font-medium text-sm">Send nightly agenda email at 8 PM</div>
            <div className="text-xs text-muted-foreground">
              PDF agenda for the next school day. Resends if the plan changes before school starts.
            </div>
          </div>
          <Switch
            checked={nightlyOn}
            onCheckedChange={(v) =>
              (setSetting as any)?.mutate?.({ key: sendNightlyKey, value: v ? "true" : "false" })
            }
          />
        </div>

        <div>
          <Label>Recipients</Label>
          <div className="space-y-1 mt-1">
            {list.length === 0 ? (
              <div className="text-xs text-muted-foreground">No one yet.</div>
            ) : (
              list.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border rounded-lg px-3 py-2"
                >
                  <div className="text-sm">
                    {r.name ? (
                      <span className="font-medium mr-2">{r.name}</span>
                    ) : null}
                    <span className="text-muted-foreground">{r.email}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (remove as any)?.mutate?.({ id: r.id })}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-40"
            />
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!email.includes("@")) {
                  toast.error("Add a real email.");
                  return;
                }
                (add as any)?.mutate?.({ name: name || null, email });
                setEmail("");
                setName("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


/* --------------------------------- iCal feed manager ---------------------- */

function IcalFeedsCard() {
  const utils = trpc.useUtils();
  const feedsQ = trpc.icalFeeds.list.useQuery();
  const add = trpc.icalFeeds.add.useMutation({
    onSuccess: () => { utils.icalFeeds.list.invalidate(); toast.success("Calendar added"); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.icalFeeds.update.useMutation({
    onSuccess: () => utils.icalFeeds.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.icalFeeds.delete.useMutation({
    onSuccess: () => { utils.icalFeeds.list.invalidate(); toast.success("Removed"); },
    onError: (e) => toast.error(e.message),
  });
  const refresh = trpc.icalFeeds.refresh.useMutation({
    onSuccess: (r) => { utils.icalFeeds.list.invalidate(); utils.icalFeeds.eventsBetween.invalidate(); toast.success(`Pulled ${r.count} events`); },
    onError: (e) => toast.error(e.message),
  });
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState("#0a66c2");
  const feeds: any[] = feedsQ.data || [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar subscriptions (iCal)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Paste a public iCal URL (Indian Hill, soccer, scouts, family) and the events
          will show up next to school blocks on Reagan&apos;s Schedule. Read-only mirror;
          refreshed nightly + on demand.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Soccer" />
          </div>
          <div>
            <Label className="text-xs">.ics URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label className="text-xs">Color</Label>
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 p-1 h-9" />
          </div>
          <Button
            disabled={!label.trim() || !url.trim() || add.isPending}
            onClick={() => {
              add.mutate({ label: label.trim(), url: url.trim(), color }, {
                onSuccess: () => { setLabel(""); setUrl(""); setColor("#0a66c2"); },
              });
            }}
          >
            Add
          </Button>
        </div>

        {feeds.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No calendars yet.</div>
        ) : (
          <ul className="space-y-2">
            {feeds.map((f) => (
              <li key={f.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: f.color || "#0a66c2" }} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{f.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{f.url}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {f.lastSyncStatus === "ok"
                      ? `${f.eventsCached} events · last synced ${f.lastSyncedAt ? new Date(f.lastSyncedAt).toLocaleString() : ""}`
                      : f.lastSyncStatus === "failed"
                        ? <span className="text-red-600">Sync failed: {f.lastSyncError}</span>
                        : "Not synced yet"}
                  </div>
                </div>
                <Switch
                  checked={!!f.enabled}
                  onCheckedChange={(v) => update.mutate({ id: f.id, patch: { enabled: v } })}
                />
                <Button size="sm" variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate({ id: f.id })}>
                  Refresh
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (confirm("Remove this calendar?")) del.mutate({ id: f.id }); }}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}


/* ============================================================================
 * KiwiListeningCard — Mom-only consent + chunk length for Phase 13 quiet
 * listening. The toggle persists to localStorage; KiwiQuietListener checks
 * `kiwiListenConsent === "1"` before calling getUserMedia, so by default
 * nothing ever asks Reagan for mic permission. Mom can also peek at today's
 * Mom-only daily sheet so she knows the pipeline is producing data without
 * exposing transcripts to Reagan.
 * ========================================================================== */
function KiwiListeningCard() {
  const initial = (() => {
    try { return localStorage.getItem("kiwiListenConsent") === "1"; } catch { return false; }
  })();
  const initialChunk = (() => {
    try { return parseInt(localStorage.getItem("kiwiListenChunkSec") || "", 10) || 600; } catch { return 600; }
  })();
  const [enabled, setEnabledState] = useState<boolean>(initial);
  const [chunkSec, setChunkSecState] = useState<number>(initialChunk);
  function setEnabled(b: boolean) {
    setEnabledState(b);
    try { localStorage.setItem("kiwiListenConsent", b ? "1" : "0"); } catch {}
    if (b) toast.success("Quiet-listening on. Reagan won't see anything; only the Mom-only daily sheet collects data.");
    else toast.message("Quiet-listening off. The mic is now idle.");
  }
  function setChunkSec(n: number) {
    setChunkSecState(n);
    try { localStorage.setItem("kiwiListenChunkSec", String(n)); } catch {}
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const sheet = trpc.listening.daySheet.useQuery({ date: todayStr }, { enabled });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiwi quiet listening (Mom-only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          When on, Kiwi captures short audio chunks during the school-day
          window (Mon–Fri, 8:30 AM – 3:00 PM) and the server keeps only a
          structured summary — never the raw transcript. Reagan's dashboard
          never shows any of it.
        </p>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="font-medium">Allow quiet listening</div>
            <div className="text-xs text-muted-foreground">First time enabling it, Reagan's browser will prompt for the mic once.</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Allow quiet listening" />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="font-medium">Chunk length</div>
            <div className="text-xs text-muted-foreground">How often a summary is written. Longer = fewer LLM calls.</div>
          </div>
          <select
            className="border rounded px-2 py-1 bg-background"
            value={chunkSec}
            onChange={(e) => setChunkSec(parseInt(e.target.value, 10))}
          >
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={900}>15 minutes</option>
          </select>
        </div>
        {enabled && (
          <div className="rounded-md border p-3 space-y-1">
            <div className="font-medium">Today's Mom-only sheet</div>
            {sheet.isLoading ? (
              <div className="text-xs text-muted-foreground">Loading…</div>
            ) : sheet.data ? (
              <div className="text-xs text-muted-foreground">
                {sheet.data.samples} samples · {sheet.data.minutesOnTask} min on task ·
                avg comfort {sheet.data.avgComfort ?? "—"} ·
                avg difficulty {sheet.data.avgDifficulty ?? "—"} ·
                top subject {Object.keys(sheet.data.subjectCounts || {})[0] ?? "—"}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No data yet today.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


/* ============================================================================
 * CartoonVoiceCard — Phase 14 Mom-only toggle.
 *
 * When ON we set localStorage["kiwiCartoonVoice"] = "1", which makes the
 * speakAs() helper fetch a Gemini-TTS WAV instead of using the OS voice.
 * Includes a "Test voice" button per companion so Mom can sample each one
 * before turning it on day-to-day.
 * ========================================================================== */
function CartoonVoiceCard() {
  const initial = (() => {
    try { return localStorage.getItem("kiwiCartoonVoice") === "1"; } catch { return false; }
  })();
  const [enabled, setEnabledState] = useState<boolean>(initial);
  function setEnabled(b: boolean) {
    setEnabledState(b);
    try { localStorage.setItem("kiwiCartoonVoice", b ? "1" : "0"); } catch {}
    if (b) toast.success("Cartoon voice on. Kiwi & friends will sound like real little birds.");
    else toast.message("Cartoon voice off. Falls back to your device's built-in voice.");
  }
  const voice = trpc.kiwi.voice.useMutation();
  function test(companionId: "kiwi" | "blue" | "daffy" | "honk", line: string) {
    voice.mutate(
      { companionId, text: line },
      {
        onSuccess: (res) => {
          try {
            const bytes = Uint8Array.from(atob(res.audioBase64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: res.mime || "audio/wav" });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => URL.revokeObjectURL(url);
            audio.play().catch(() => toast.error("Couldn't play sample"));
          } catch {
            toast.error("Couldn't decode sample");
          }
        },
        onError: (e) => toast.error(`Voice failed: ${e.message}`),
      }
    );
  }
  const samples: Array<{ id: "kiwi" | "blue" | "daffy" | "honk"; label: string; line: string }> = [
    { id: "kiwi",  label: "Kiwi (parakeet)",  line: "Hi Reagan! Ready for math? You've got this." },
    { id: "blue",  label: "Blue (sidekick)",  line: "Take a breath. We can do one little step at a time." },
    { id: "daffy", label: "Daffy (duckling)", line: "Quack-quack! Snack time? Let's go!" },
    { id: "honk",  label: "Honk (gosling)",   line: "Big honk! Great job sticking with it today." },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cartoon voice for Kiwi & friends</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Uses a real text-to-speech voice instead of your device's default.
          Sounds much more like a tiny bird. Falls back automatically if the
          internet hiccups.
        </p>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="font-medium">Use cartoon voice</div>
            <div className="text-xs text-muted-foreground">Off by default so first launch never makes noise unexpectedly.</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Use cartoon voice" />
        </div>
        <div className="rounded-md border p-3 space-y-2">
          <div className="font-medium">Test each voice</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {samples.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                className="bg-background justify-start"
                onClick={() => test(s.id, s.line)}
                disabled={voice.isPending}
              >
                {voice.isPending ? "…" : "▶"} &nbsp; {s.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
