import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWhisper } from "@/contexts/WhisperContext";
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
  const ctx = useWhisper();
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
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Photo URL</label>
          <Input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1"
          />
          {photoUrl && (
            <div className="flex items-center gap-3 mt-2">
              <img src={photoUrl} alt="" className="w-12 h-12 rounded-full object-cover border border-neutral-200" />
              <span className="text-xs text-neutral-500">preview</span>
            </div>
          )}
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
          <div className="text-sm font-medium mb-2">Listening mode</div>
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

      {/* ============================ RECIPIENTS ============================ */}
      <Card className="classroom-card p-5">
        <div className="font-display font-semibold text-lg mb-3">Notification Recipients</div>
        <div className="space-y-2">
          {(recipients.data ?? []).map((r: any) => (
            <div
              key={r.id}
              className="text-sm flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-200"
            >
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-neutral-500">
                  {r.email} · {r.role}
                </div>
              </div>
            </div>
          ))}
          {(recipients.data ?? []).length === 0 && (
            <div className="text-sm text-neutral-500">No recipients yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
