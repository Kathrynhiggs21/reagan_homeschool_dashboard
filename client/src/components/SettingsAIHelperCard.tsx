import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const SAMPLES = [
  "Switch the theme to cream homeschool",
  "Set Kiwi voice to Aoede",
  "Mute Kiwi for the rest of the morning",
  "Hide the Roblox tile",
  "Add Grandma as a tutor for science on Mondays",
  "Mark Hira as inactive — she stopped tutoring",
  "Turn off the 8 PM nightly digest email",
];

/**
 * SettingsAIHelperCard — top-of-Settings chat surface that lets the adult
 * say what they want changed in plain English, previews the patch, then
 * applies on tap. Backed by trpc.settingsAI.{preview,commit}.
 */
export default function SettingsAIHelperCard() {
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<any | null>(null);
  const utils = trpc.useUtils();
  const preview = trpc.settingsAI.preview.useMutation({
    onSuccess: (p) => setPlan(p),
    onError: (e) => toast.error(e.message ?? "AI preview failed"),
  });
  const commit = trpc.settingsAI.commit.useMutation({
    onSuccess: (out) => {
      toast.success(`Applied (${out.setPrefs} pref · ${out.upsertedTutors} tutor)`);
      setPlan(null);
      setInstruction("");
      utils.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Apply failed"),
  });

  function send() {
    const t = instruction.trim();
    if (!t) return;
    setPlan(null);
    preview.mutate({ instruction: t });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>🪄</span> Just tell the AI what to change
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Theme, Kiwi voice, tutor list, quiet hours, notifications — say it in plain English.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={2}
          placeholder='e.g. "Switch theme to cream and add Grandma as a science tutor"'
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          {SAMPLES.map(s => (
            <button
              key={s}
              onClick={() => setInstruction(s)}
              className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-accent transition"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={send} disabled={preview.isPending || !instruction.trim()}>
            {preview.isPending ? "Thinking…" : "Preview change"}
          </Button>
        </div>

        {plan && (
          <div className="rounded-md border bg-card p-3 space-y-2">
            <div className="text-sm font-medium">{plan.summary || "Proposed change"}</div>
            {plan.warnings?.length > 0 && (
              <ul className="text-[11px] text-amber-700 dark:text-amber-400 list-disc pl-4">
                {plan.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
              </ul>
            )}
            {plan.ops?.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {plan.ops.map((op: any, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">{op.kind}</Badge>
                    <span className="text-muted-foreground">
                      {op.kind === "prefs.set" && <>{op.key} = <code>{String(op.value)}</code></>}
                      {op.kind === "tutor.upsert" && <>{op.id ? `update #${op.id} ` : "add "}<b>{op.name}</b>{op.role ? ` (${op.role})` : ""}{typeof op.active === "boolean" ? (op.active ? " · active" : " · inactive") : ""}</>}
                      {op.kind === "ask" && <>❓ {op.question}</>}
                      {op.kind === "reagan.note" && <>📝 {op.text}</>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground">No changes proposed.</div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setPlan(null)}>Discard</Button>
              <Button
                size="sm"
                onClick={() => commit.mutate({ summary: plan.summary ?? "", ops: plan.ops ?? [] })}
                disabled={commit.isPending || !(plan.ops?.some((o: any) => o.kind !== "ask"))}
              >
                {commit.isPending ? "Applying…" : "Apply"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
