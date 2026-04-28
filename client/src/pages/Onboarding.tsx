import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * First-Day Setup
 *
 * Lightweight onboarding run by Mom on the first session with Reagan.
 * 5 quick steps, each skippable:
 *   1. Welcome
 *   2. Name + grade
 *   3. Pick a photo (optional — adult uploads or pastes URL)
 *   4. Pick a helper personality (companion name + avatar)
 *   5. Pick interests (chips) — seeds recommendations
 *
 * When the last step saves, we flip learnerProfile.onboardingCompleted = true
 * (stored via profile.update) and navigate to /today.
 *
 * Kid never sees this flow unless re-triggered from My Setup.
 */

const HELPER_PRESETS = [
  { name: "Kiwi", avatar: "⭐", blurb: "Gentle, curious, kind." },
  { name: "Sprig",   avatar: "🌱", blurb: "Outdoorsy, nature-first." },
  { name: "Nova",    avatar: "✨", blurb: "Bright, playful, encouraging." },
  { name: "Milo",    avatar: "🦊", blurb: "Clever, friendly, a little silly." },
];

const INTEREST_CHOICES = [
  "animals", "birds", "ducklings", "parakeets", "rescue", "helping",
  "art", "makeup", "style", "music", "reading", "writing",
  "spiritual", "astronomy", "outdoors", "cooking", "baking",
  "science", "math", "puzzles", "games",
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const profile = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.data?.studentName || "Reagan");
  const [grade, setGrade] = useState(profile.data?.gradeLevel || "5th Grade");
  const [photoUrl, setPhotoUrl] = useState(profile.data?.photoUrl || "");
  const [helperName, setHelperName] = useState(profile.data?.companionName || "Kiwi");
  const [helperAvatar, setHelperAvatar] = useState(profile.data?.companionAvatar || "⭐");
  const [interests, setInterests] = useState<string[]>(profile.data?.interests || []);

  function toggleInterest(i: string) {
    setInterests((arr) => (arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i]));
  }

  async function finish() {
    try {
      await updateProfile.mutateAsync({
        studentName: name,
        gradeLevel: grade,
        interests,
        photoUrl: photoUrl || undefined,
        companionName: helperName,
        companionAvatar: helperAvatar,
        onboardingCompleted: true,
      });
      toast.success("All set — welcome!");
      navigate("/today");
    } catch {
      toast.error("Couldn't save. Try again.");
    }
  }

  async function skipAll() {
    try {
      await updateProfile.mutateAsync({ onboardingCompleted: true });
    } catch {}
    navigate("/today");
  }

  const total = 5;
  const go = (n: number) => setStep(Math.max(0, Math.min(total - 1, n)));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <div className="font-chalk-hand text-xl leading-none chalk-yellow">First day setup</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1 chalk-white">Let's get Reagan's space ready</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Five quick steps. Mom can change any of this later in <b>Settings → My Setup</b>.
        </p>
      </div>

      <div className="flex gap-1 mb-4">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-neutral-300"}`}
          />
        ))}
      </div>

      <Card className="classroom-card p-6 space-y-5">
        {step === 0 && (
          <div>
            <h2 className="font-display text-xl font-semibold">Welcome.</h2>
            <p className="mt-2 text-sm text-neutral-700 leading-relaxed">
              This is Reagan's home classroom. It is a calm place built for <em>her</em>:
              routines she can predict, work she can finish, and tools that cheer her on.
              You're the only adult with the passcode — everything private is already hidden from her view.
            </p>
            <p className="mt-3 text-sm text-neutral-700 leading-relaxed">
              In the next few steps we'll personalize the space. It takes about two minutes.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">What should we call her?</h2>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Grade</label>
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2"
                placeholder="5th Grade"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">A photo for her nameplate (optional)</h2>
            <p className="text-sm text-neutral-600">
              Paste a photo URL for now — we'll add upload from iPad in a later round.
            </p>
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2"
              placeholder="https://..."
            />
            {photoUrl && (
              <div className="flex items-center gap-3 pt-2">
                <img src={photoUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-neutral-200" />
                <div className="text-sm text-neutral-700">Preview</div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Pick a helper</h2>
            <p className="text-sm text-neutral-600">
              The helper is the friendly voice Reagan can tap on any page for jokes, ideas, or a boost.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {HELPER_PRESETS.map((h) => {
                const active = h.name === helperName;
                return (
                  <button
                    key={h.name}
                    onClick={() => {
                      setHelperName(h.name);
                      setHelperAvatar(h.avatar);
                    }}
                    className={`text-left rounded-lg border p-4 transition ${
                      active ? "border-accent bg-accent/10" : "border-neutral-200 bg-white hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{h.avatar}</span>
                      <span className="font-display font-semibold">{h.name}</span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">{h.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">What lights her up?</h2>
            <p className="text-sm text-neutral-600">Tap anything that sounds like Reagan. We'll use these to suggest adventures.</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_CHOICES.map((i) => (
                <button
                  key={i}
                  onClick={() => toggleInterest(i)}
                  className={`px-3 py-1 rounded-full text-sm border transition ${
                    interests.includes(i)
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-white border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? skipAll() : go(step - 1))}
          >
            {step === 0 ? "Skip for now" : "Back"}
          </Button>

          {step < total - 1 ? (
            <Button onClick={() => go(step + 1)}>Next</Button>
          ) : (
            <Button onClick={finish} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving…" : "Finish setup"}
            </Button>
          )}
        </div>
      </Card>

      {/* Debug summary so mom can see what's about to save */}
      <div className="mt-4 text-xs text-neutral-500">
        Saving: <b>{name}</b>, {grade}
        {helperName && <> · helper {helperAvatar} {helperName}</>}
        {interests.length > 0 && <> · {interests.length} interests</>}
        {photoUrl && <> · photo set</>}
      </div>
    </div>
  );
}
