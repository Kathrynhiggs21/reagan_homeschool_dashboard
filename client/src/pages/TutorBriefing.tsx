import { useParams, Link } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function TutorBriefing() {
  const params = useParams<{ id: string }>();
  const tutorId = Number(params.id);
  const utils = trpc.useUtils();

  const { data: tutor, isLoading } = trpc.tutors.get.useQuery({ id: tutorId }, { enabled: Number.isFinite(tutorId) });
  const { data: priority = [] } = trpc.tutors.priority.useQuery({ tutorId, limit: 5 }, { enabled: Number.isFinite(tutorId) });
  const { data: recent = [] } = trpc.tutors.recentSessions.useQuery({ tutorId, limit: 8 }, { enabled: Number.isFinite(tutorId) });

  const [notes, setNotes] = useState("");
  const [pickedSkills, setPickedSkills] = useState<Record<number, "strong" | "gettingIt" | "needsMore">>({});

  const recordSession = trpc.tutors.recordSession.useMutation({
    onSuccess: () => {
      toast.success("Session saved. Adaptation engine updated.");
      setNotes("");
      setPickedSkills({});
      utils.tutors.recentSessions.invalidate({ tutorId });
      utils.tutors.priority.invalidate({ tutorId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="container py-10">Loading…</div>;
  if (!tutor) {
    return (
      <div className="container py-10 max-w-2xl">
        <Card className="p-6">
          <p className="mb-3">Tutor not found.</p>
          <Link href="/settings"><Button>Add a tutor</Button></Link>
        </Card>
      </div>
    );
  }

  function toggleSkill(id: number, outcome: "strong" | "gettingIt" | "needsMore") {
    setPickedSkills((p) => {
      if (p[id] === outcome) {
        const { [id]: _, ...rest } = p;
        return rest;
      }
      return { ...p, [id]: outcome };
    });
  }

  function submitSession() {
    const skills = Object.entries(pickedSkills).map(([id, outcome]) => ({
      skillLadderId: Number(id), outcome: outcome as "strong" | "gettingIt" | "needsMore",
    }));
    recordSession.mutate({ tutorId, sessionNotes: notes || undefined, skills, status: "completed" });
  }

  return (
    <div className="container py-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/tutor" className="text-xs opacity-60 hover:underline">← Tutor handoff (general)</Link>
          <h1 className="text-3xl font-display font-bold">{tutor.name}</h1>
          <p className="text-sm opacity-70">{tutor.role || "Tutor"} · {tutor.subjects || "All subjects"}</p>
        </div>
        {tutor.email && <a href={`mailto:${tutor.email}`} className="text-sm underline opacity-70">{tutor.email}</a>}
      </div>

      <Card
        className="p-5"
        style={{ background: "rgba(251,191,36,0.10)", border: "1.5px solid rgba(251,191,36,0.45)" }}
      >
        <h2 className="font-display font-bold text-base mb-2">🎯 Focus this session</h2>
        <p className="text-xs opacity-70 mb-3">
          Lowest-mastery skills in {tutor.subjects || "Reagan's curriculum"}. Tap how each one went after working it.
        </p>
        {priority.length === 0 ? (
          <p className="text-sm opacity-70">
            No priority skills queued. Set this tutor's <code>subjects</code> in Settings (e.g. "math,ela") so the ladder can match.
          </p>
        ) : (
          <ul className="space-y-3">
            {priority.map((s: any) => (
              <li key={s.id} className="flex flex-col gap-2 p-3 rounded-lg bg-white/60 dark:bg-black/20">
                <div>
                  <div className="font-semibold text-sm">{s.kidFriendly || s.title}</div>
                  <div className="text-xs opacity-60">
                    {String(s.subjectSlug || "").toUpperCase()} · Level {s.level ?? 0} · Confidence {s.confidence ?? 0}%
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm"
                    variant={pickedSkills[s.id] === "strong" ? "default" : "outline"}
                    onClick={() => toggleSkill(s.id, "strong")}
                    className={pickedSkills[s.id] === "strong" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  >🌟 Got it</Button>
                  <Button size="sm"
                    variant={pickedSkills[s.id] === "gettingIt" ? "default" : "outline"}
                    onClick={() => toggleSkill(s.id, "gettingIt")}
                    className={pickedSkills[s.id] === "gettingIt" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                  >🌿 Getting it</Button>
                  <Button size="sm"
                    variant={pickedSkills[s.id] === "needsMore" ? "default" : "outline"}
                    onClick={() => toggleSkill(s.id, "needsMore")}
                    className={pickedSkills[s.id] === "needsMore" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                  >🌱 Needs more</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-display font-bold text-base mb-2">📝 Session notes</h2>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Quick notes — what worked, what to try next, anything Reagan said. Saved to her record + automatically feeds the adaptation engine."
        />
        <div className="flex justify-end mt-3">
          <Button onClick={submitSession} disabled={recordSession.isPending}>
            {recordSession.isPending ? "Saving…" : "Save session"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display font-bold text-base mb-3">📚 Recent sessions</h2>
        {recent.length === 0 ? (
          <p className="text-sm opacity-70">
            No sessions yet. They'll appear here automatically when tutor emails come in (the daily Gmail sync auto-routes "@conger" / "tutor" emails to the right tutor).
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((s: any) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                <div>
                  <div className="text-sm font-medium">{new Date(s.scheduledAt).toLocaleDateString()} · {s.durationMin} min</div>
                  {s.focus && <div className="text-xs opacity-60">{s.focus}</div>}
                  {s.sessionNotes && <div className="text-xs mt-1 opacity-80">{s.sessionNotes.slice(0, 200)}{s.sessionNotes.length > 200 ? "…" : ""}</div>}
                </div>
                <Badge variant="outline" className="text-xs">{s.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
