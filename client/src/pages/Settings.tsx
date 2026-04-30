import { Card } from "@/components/ui/card";
import CalendarSyncCard from "@/components/CalendarSyncCard";
import AvatarUploader from "@/components/AvatarUploader";
import ConfidencePrinciplesCard from "@/components/ConfidencePrinciplesCard";
import GamesManager from "@/components/GamesManager";
import TutorsManager from "@/components/TutorsManager";
import { RewardsManager } from "@/components/RewardsManager";
import { PowerSchoolImporterCard } from "@/components/PowerSchoolImporterCard";
import CareTeamManager from "@/components/CareTeamManager";
import PracticePrefsCard from "@/components/PracticePrefsCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useKiwi } from "@/contexts/KiwiContext";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

/**
 * Settings — adult-only. AdultGate has already validated the passcode.
 *
 * Sections:
 *   1. My Setup     — name/grade/photo/interests (profile editor, relaunch onboarding)
 *   2. Companion    — helper name, avatar, voice + listening mode
 *   3. Adult Lock   — change passcode (default 3918)
 *   4. Recipients   — notification contacts
 */
export default function Settings() {
  const ctx = useKiwi();
  const { currentPasscode, setPasscode } = useAdultLock();
  const [, navigate] = useLocation();

  const profile = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Saved.");
      utils.profile.get.invalidate();
    },
  });
  const utils = trpc.useUtils();

  const [studentName, setStudentName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [interestsText, setInterestsText] = useState("");
  const [name, setName] = useState(ctx.companionName);
  const [newPass, setNewPass] = useState("");

  // Sync profile → local form on first load
  useEffect(() => {
    if (!profile.data) return;
    setStudentName(profile.data.studentName || "Reagan");
    setGradeLevel(profile.data.gradeLevel || "5th Grade");
    setPhotoUrl((profile.data as any).photoUrl || "");
    setInterestsText((profile.data.interests || []).join(", "));
  }, [profile.data]);

  const recipients = trpc.recipients.list.useQuery();

  function saveMySetup() {
    const interests = interestsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateProfile.mutate({
      studentName,
      gradeLevel,
      interests,
    } as any);
  }

  function savePasscode() {
    if (newPass.trim().length < 4) {
      toast.error("Passcode must be at least 4 digits.");
      return;
    }
    setPasscode(newPass.trim());
    setNewPass("");
    toast.success("Passcode updated.");
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="font-chalk-hand text-lg leading-none chalk-yellow">Adult-only</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1 chalk-white">Settings</h1>
        <p className="text-sm text-muted-foreground mt-2">Only visible with the adult passcode.</p>
      </header>

      {/* ============================ CONFIDENCE PRINCIPLES ============================ */}
      <ConfidencePrinciplesCard />

      {/* ============================ MY SETUP ============================ */}
      <Card className="classroom-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-display font-semibold text-lg">My Setup</div>
          <Button size="sm" variant="outline" className="bg-transparent" onClick={() => navigate("/welcome")}>
            Re-run first-day setup
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Student name</label>
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Grade level</label>
            <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2 block">Reagan's photo</label>
          <AvatarUploader />
          <p className="text-[11px] text-muted-foreground mt-2">
            Photo is private and only shows on this dashboard. Replaces the "R" placeholder in the corner card.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Interests (comma-separated)
          </label>
          <Input
            value={interestsText}
            onChange={(e) => setInterestsText(e.target.value)}
            placeholder="animals, art, astronomy"
            className="mt-1"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={saveMySetup} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Saving…" : "Save My Setup"}
          </Button>
        </div>
      </Card>

      {/* ============================ COMPANION ============================ */}
      <Card className="classroom-card p-5 space-y-4">
        <div className="font-display font-semibold text-lg">Helper / Companion</div>
        <div>
          <label className="text-sm font-medium">Helper name</label>
          <div className="flex gap-2 mt-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              onClick={() => {
                ctx.setCompanionName(name);
                toast.success(`Now I'm ${name}!`);
              }}
            >
              Save
            </Button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Avatar</label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {["⭐", "🌱", "✨", "🦊", "🌞", "🌈", "🍎", "📚", "🎨"].map((e) => (
              <button
                key={e}
                onClick={() => ctx.setCompanionAvatar(e)}
                className={`text-2xl p-2 rounded-xl border transition ${
                  ctx.companionAvatar === e ? "bg-accent/20 border-accent" : "bg-white"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Adult present mode</div>
            <div className="text-xs text-muted-foreground">Pauses helper when an adult is beside Reagan</div>
          </div>
          <Switch checked={ctx.adultPresent} onCheckedChange={ctx.setAdultPresent} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Voice mode</div>
            <div className="text-xs text-muted-foreground">Helper reads messages aloud</div>
          </div>
          <Switch
            checked={ctx.voiceMode === "voice"}
            onCheckedChange={(b) => ctx.setVoiceMode(b ? "voice" : "text")}
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Listening mode</div>
          <div className="text-xs text-muted-foreground mb-2">
            <strong>Wake word</strong> listens for “Kiwi” or “Hi Kiwi” and opens the chat.
            Requires mic permission in the browser.
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              ["wake", "Wake word"],
              ["tap", "Tap to talk"],
              ["always", "Always on"],
              ["off", "Off"],
            ].map(([m, label]) => (
              <button
                key={m}
                onClick={() => ctx.setMode(m as any)}
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  ctx.mode === m ? "bg-primary text-primary-foreground" : "bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ============================ ADULT LOCK ============================ */}
      <Card className="classroom-card p-5 space-y-3">
        <div className="font-display font-semibold text-lg">Adult Lock</div>
        <p className="text-sm text-neutral-600">
          The passcode unlocks the adult-only areas (Curriculum, Tutor Handoff, Analytics, Knowledge, Settings)
          plus all edit controls. Default is <code className="px-1 rounded bg-neutral-100">3918</code>.
        </p>
        <div className="text-xs text-neutral-500">
          Current passcode: <code className="px-1 rounded bg-neutral-100">{currentPasscode}</code>
        </div>
        <div className="flex gap-2">
          <Input
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="New passcode (min 4)"
            type="password"
          />
          <Button onClick={savePasscode}>Update</Button>
        </div>
      </Card>

      {/* ============================ CALENDAR SYNC ============================ */}
      <CalendarSyncCard />

      {/* ============================ RECIPIENTS ============================ */}
      <RecipientsCard />

      {/* ============================ APPOINTMENTS ============================ */}
      <AppointmentsCard />

      {/* ============================ GAMES & BREAKS ============================ */}
      <PracticePrefsCard />
      <CareTeamManager />
      <RewardsManager />
      <PowerSchoolImporterCard />

      <GamesManager />

      {/* ============================ TUTORS ============================ */}
      <TutorsManager />

      {/* ============================ AUTOMATION EXPLAINER ============================ */}
      <AutomationExplainerCard />

      {/* ============================ AUDIT LOG ============================ */}
      <AuditCard />
    </div>
  );
}

function AutomationExplainerCard() {
  const Item = ({ icon, title, lines }: { icon: string; title: string; lines: string[] }) => (
    <div className="rounded-lg border border-white/10 bg-background/30 p-4 space-y-1">
      <div className="flex items-center gap-2 font-display font-semibold">
        <span className="text-2xl" aria-hidden>{icon}</span>
        <span>{title}</span>
      </div>
      {lines.map((l, i) => <p key={i} className="text-xs text-muted-foreground">{l}</p>)}
    </div>
  );
  return (
    <Card className="classroom-card p-5">
      <h2 className="font-display text-xl mb-1">What runs by itself</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Plain English explainer of the auto-jobs that keep this dashboard alive without you having to remember anything.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <Item
          icon="⏰"
          title="Daily 6:30 AM — Gmail + Drive sync"
          lines={[
            "Pulls new emails from anything @ihsd.us and from Reagan's tutors.",
            "Pulls any new files from your Reagan / Reagan-IHES Drive folders.",
            "Auto-classifies each one and routes to the right tab. You only see exceptions.",
          ]}
        />
        <Item
          icon="📨"
          title="Sundays 7 PM — Weekly digest"
          lines={[
            "Builds her week-in-review (level-ups, tutor sessions, mood arc, what helped).",
            "Emails it to spear.cpt@gmail.com.",
            "Marked sent/failed on the Upload page so you can see it landed.",
          ]}
        />
        <Item
          icon="🧠"
          title="After every practice — Adaptation engine"
          lines={[
            "Watches her self-rating + chips after each Skill Builder block.",
            "If 2+ Hard in a row → rotates teaching mode and blocks the next level-up so it doesn't get harder.",
            "3 Hards on the same skill → raises a parent flag for you on Analytics.",
          ]}
        />
        <Item
          icon="🎮"
          title="During practice — Mood + game break"
          lines={[
            "2+ Hard in 30 minutes triggers a gentle break suggestion (with her chosen game/activity).",
            "2+ Got it! with no Hard triggers an earned-reward suggestion.",
            "You can edit the games/activities list above in Games & Breaks.",
          ]}
        />
      </div>
    </Card>
  );
}

function AuditCard() {
  const list = trpc.audit.list.useQuery({ limit: 50 });
  const fmt = (d: any) => new Date(d).toLocaleString();
  return (
    <Card className="classroom-card p-5">
      <h2 className="font-display text-xl mb-3">Audit log</h2>
      <p className="text-xs text-muted-foreground mb-3">Last 50 adult edits. Helpful for spotting accidental changes.</p>
      <div className="space-y-1 max-h-80 overflow-auto">
        {(list.data ?? []).map((row: any) => (
          <div key={row.id} className="text-xs flex items-start justify-between gap-2 p-2 rounded bg-neutral-50 border border-neutral-200">
            <div>
              <span className="font-mono text-[10px] uppercase text-neutral-500 mr-2">{row.action}</span>
              <span className="font-medium">{row.entityType}</span>
              {row.entityId ? <span className="text-neutral-500"> #{row.entityId}</span> : null}
              {row.summary ? <span className="text-neutral-700"> — {row.summary}</span> : null}
              {row.actorName ? <div className="text-[10px] text-neutral-500">by {row.actorName}</div> : null}
            </div>
            <div className="text-[10px] text-neutral-500 shrink-0">{fmt(row.createdAt)}</div>
          </div>
        ))}
        {(list.data ?? []).length === 0 && <div className="text-sm text-neutral-500">No edits recorded yet.</div>}
      </div>
    </Card>
  );
}

function RecipientsCard() {
  const list = trpc.recipients.list.useQuery();
  const addM = trpc.recipients.add.useMutation();
  const updateM = trpc.recipients.update.useMutation();
  const delM = trpc.recipients.delete.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ email: "", displayName: "", role: "parent" as "parent"|"grandparent"|"tutor"|"other" });
  async function add() {
    if (!form.email) return;
    await addM.mutateAsync({ email: form.email, displayName: form.displayName || undefined, role: form.role });
    setForm({ email: "", displayName: "", role: "parent" });
    utils.recipients.list.invalidate();
  }
  async function rename(r: any) {
    const name = prompt("Display name:", r.displayName || "");
    if (name === null) return;
    await updateM.mutateAsync({ id: r.id, displayName: name });
    utils.recipients.list.invalidate();
  }
  async function remove(r: any) {
    if (!confirm(`Remove ${r.email}?`)) return;
    await delM.mutateAsync({ id: r.id });
    utils.recipients.list.invalidate();
  }
  return (
    <Card className="classroom-card p-5">
      <div className="font-display font-semibold text-lg mb-3">Notification Recipients</div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900" placeholder="email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}/>
        <input className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900" placeholder="display name" value={form.displayName} onChange={(e)=>setForm({...form, displayName:e.target.value})}/>
        <select className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900" value={form.role} onChange={(e)=>setForm({...form, role: e.target.value as any})}>
          <option value="parent">parent</option>
          <option value="grandparent">grandparent</option>
          <option value="tutor">tutor</option>
          <option value="other">other</option>
        </select>
        <button className="text-sm rounded px-3 py-1 bg-primary text-primary-foreground" onClick={add}>+ Add</button>
      </div>
      <div className="space-y-2">
        {(list.data ?? []).map((r: any) => (
          <div key={r.id} className="text-sm flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <div>
              <div className="font-medium">{r.displayName || r.email}</div>
              <div className="text-xs text-neutral-500">{r.email} · {r.role}</div>
            </div>
            <div className="flex gap-2">
              <button className="text-xs underline" onClick={() => rename(r)}>rename</button>
              <button className="text-xs text-destructive underline" onClick={() => remove(r)}>remove</button>
            </div>
          </div>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="text-sm text-neutral-500">No recipients yet.</div>
        )}
      </div>
    </Card>
  );
}

function AppointmentsCard() {
  const list = trpc.appointments.list.useQuery();
  const addM = trpc.appointments.add.useMutation();
  const updateM = trpc.appointments.update.useMutation();
  const delM = trpc.appointments.delete.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ title: "", contactName: "", durationMin: 60, recurrenceRule: "", notes: "" });
  async function add() {
    if (!form.title) return;
    await addM.mutateAsync({ title: form.title, contactName: form.contactName || undefined, durationMin: form.durationMin, recurrenceRule: form.recurrenceRule || undefined, notes: form.notes || undefined });
    setForm({ title: "", contactName: "", durationMin: 60, recurrenceRule: "", notes: "" });
    utils.appointments.list.invalidate();
  }
  async function rename(a: any) {
    const title = prompt("Title:", a.title);
    if (title === null) return;
    await updateM.mutateAsync({ id: a.id, title });
    utils.appointments.list.invalidate();
  }
  async function remove(a: any) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    await delM.mutateAsync({ id: a.id });
    utils.appointments.list.invalidate();
  }
  return (
    <Card className="classroom-card p-5">
      <div className="font-display font-semibold text-lg mb-3">Appointments</div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900" placeholder="title (e.g. OT, therapy)" value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})}/>
        <input className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900" placeholder="contact name" value={form.contactName} onChange={(e)=>setForm({...form, contactName:e.target.value})}/>
        <input className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900 w-20" type="number" placeholder="minutes" value={form.durationMin} onChange={(e)=>setForm({...form, durationMin:Number(e.target.value)||60})}/>
        <input className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900" placeholder="recurrence (e.g. weekly Tue 3pm)" value={form.recurrenceRule} onChange={(e)=>setForm({...form, recurrenceRule:e.target.value})}/>
        <button className="text-sm rounded px-3 py-1 bg-primary text-primary-foreground" onClick={add}>+ Add</button>
      </div>
      <div className="space-y-2">
        {(list.data ?? []).map((a: any) => (
          <div key={a.id} className="text-sm flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <div>
              <div className="font-medium">{a.title}{a.contactName ? ` — ${a.contactName}` : ""}</div>
              <div className="text-xs text-neutral-500">{a.durationMin} min{a.recurrenceRule ? ` · ${a.recurrenceRule}` : ""}</div>
            </div>
            <div className="flex gap-2">
              <button className="text-xs underline" onClick={() => rename(a)}>rename</button>
              <button className="text-xs text-destructive underline" onClick={() => remove(a)}>remove</button>
            </div>
          </div>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="text-sm text-neutral-500">No recurring appointments yet.</div>
        )}
      </div>
    </Card>
  );
}
