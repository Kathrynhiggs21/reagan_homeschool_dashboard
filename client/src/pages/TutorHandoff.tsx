import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useKiwi } from "@/contexts/KiwiContext";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Link } from "wouter";
import { subjectTint, tintCardStyle, tintInkStyle } from "@/lib/subjectColors";

function TutorQuickPick() {
  const { data: tutors = [] } = trpc.tutors.list.useQuery({ activeOnly: true });
  if (!tutors.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="text-xs opacity-60 self-center mr-1">Quick briefings:</span>
      {tutors.map((t: any) => (
        <Link key={t.id} href={`/tutor/${t.id}`} className="text-xs px-2 py-0.5 rounded-full border border-border/40 hover:bg-accent">
          {t.name}
        </Link>
      ))}
    </div>
  );
}

function SendDigestButton() {
  const send = trpc.notifications.sendTodayDigest.useMutation();
  return (
    <Button size="sm" disabled={send.isPending} onClick={() => {
      send.mutate(undefined as any, {
        onSuccess: (r: any) => toast.success(r.ok ? `Dispatch sent (${r.recipients} family recipients)` : "Sent locally"),
        onError: (e: any) => toast.error(e.message || "Could not send"),
      });
    }}>{send.isPending ? "Sending…" : "📧 Send dispatch"}</Button>
  );
}

export default function TutorHandoff() {
  const profile = trpc.profile.get.useQuery();
  const today = trpc.plans.today.useQuery();
  const struggles = trpc.struggles.list.useQuery({});
  const completeM = trpc.blocks.complete.useMutation();
  const utils = trpc.useUtils();
  const { adultPresent, setAdultPresent } = useKiwi();

  const blocks = today.data?.blocks ?? [];
  const data = profile.data;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Tutor / Adult Handoff</h1>
          <p className="text-muted-foreground text-sm mt-1">Everything you need to support Reagan today.</p>
          <TutorQuickPick />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Adult present mode</span>
          <Switch checked={adultPresent} onCheckedChange={setAdultPresent} />
        </div>
      </header>

      {/* Trauma-aware rules — high-contrast card so tutors can actually read them */}
      <Card
        className="p-5"
        style={{
          background: "#fff8f0",
          border: "2px solid #f59e0b",
          color: "#3b2a00",
          boxShadow: "0 4px 0 rgba(0,0,0,0.15)",
        }}
      >
        <div className="font-display text-lg font-bold mb-3" style={{ color: "#9a3412" }}>⚠️ Please read every session — Trauma-aware rules</div>
        <ol className="text-[15px] leading-relaxed space-y-2 list-decimal list-inside" style={{ color: "#1f1b16" }}>
          <li><strong>Never mention timing.</strong> No timers, no “X minutes left,” no “hurry.”</li>
          <li><strong>Never imply she’s behind or not smart.</strong> She IS smart. Prove it — don’t say it.</li>
          <li><strong>Never make her feel watched.</strong> Sit beside, not across.</li>
          <li><strong>Reassure she’s not in trouble.</strong> Say it out loud, often.</li>
          <li><strong>Catch her doing well 5× more than you correct anything.</strong></li>
          <li><strong>If she shuts down, do not push.</strong> Switch to animal care, art, or sit-spot.</li>
          <li><strong>Use her title: “The Animal Kiwier.”</strong> Believe in her out loud.</li>
        </ol>
      </Card>

      <Card className="cozy-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-semibold">Today's Plan ({blocks.length} blocks)</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-card">🗄️ Print packet</Button>
            <SendDigestButton />
          </div>
        </div>
        <div className="space-y-2">
          {blocks.map((b: any) => {
            const tint = subjectTint(b.subjectSlug);
            return (
            <div key={b.id} className="p-3 rounded-xl border border-border flex items-start gap-3" style={tintCardStyle(b.subjectSlug)}>
              <span className="text-xl">{b.emoji || tint.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold" style={tintInkStyle(b.subjectSlug)}>{b.title}</div>
                <div className="text-xs opacity-80" style={tintInkStyle(b.subjectSlug)}>{tint.label} · est {b.estimatedMinutes || 30}m · {b.status}</div>
                {b.description && <p className="text-sm mt-1">{b.description}</p>}
              </div>
              {b.status !== "complete" && (
                <Button size="sm" onClick={() => completeM.mutate({ id: b.id }, { onSuccess: () => utils.plans.today.invalidate() })}>✓ Mark done</Button>
              )}
            </div>
            );
          })}
          {blocks.length === 0 && <div className="text-sm text-muted-foreground italic">No plan yet for today.</div>}
        </div>
      </Card>

      {/* Accommodations + triggers moved to the BOTTOM so the plan is front-and-center */}
      {data?.accommodations && (
        <Card className="cozy-card p-4">
          <div className="font-display font-semibold mb-2">Accommodations</div>
          <ul className="text-sm space-y-1 list-disc list-inside">
            {(data.accommodations as string[]).map((a: string) => <li key={a}>{a}</li>)}
          </ul>
        </Card>
      )}

      {data?.triggers && (
        <Card className="cozy-card p-4" style={{ background: "rgba(251,191,36,0.06)" }}>
          <div className="font-display font-semibold mb-2">Known triggers to avoid</div>
          <div className="flex flex-wrap gap-1.5">
            {(data.triggers as string[]).map((t: string) => (
              <Badge
                key={t}
                className="border"
                style={{ background: "#fef3c7", color: "#78350f", borderColor: "#fcd34d" }}
              >
                {t}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card className="cozy-card p-4">
        <div className="font-display font-semibold mb-3">Recent struggles (last 7)</div>
        <div className="space-y-2">
          {(struggles.data ?? []).slice(0, 7).map((s: any) => (
            <div key={s.id} className="text-sm flex items-start gap-2">
              <span className={`w-2 h-2 rounded-full mt-2 ${s.intensity === "red" ? "bg-rose-500" : "bg-amber-400"}`} />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">{new Date(s.loggedAt).toLocaleDateString()} · {s.subjectSlug}</div>
                {s.description && <div>{s.description}</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
