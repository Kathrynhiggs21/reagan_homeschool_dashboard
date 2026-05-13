import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Push 73 (2026-05-13) — Mom-side toggle for the "From yesterday" queue.
 *
 * Reads + writes `catchUp.maxQueueSize` via prefs. Range 0–10, default 3.
 * Setting it to 0 hides the Today card entirely.
 */
export default function CatchUpQueueSettingsCard() {
  const q = trpc.prefs.get.useQuery({ key: "catchUp.maxQueueSize" });
  const utils = trpc.useUtils();
  const setPref = trpc.prefs.set.useMutation({
    onSuccess: () => {
      void utils.prefs.get.invalidate();
      void utils.curriculum.nextDayQueue.invalidate();
    },
  });

  const [cap, setCap] = useState<number>(3);

  useEffect(() => {
    if (q.data !== undefined) {
      const raw = (q.data as string | null) ?? "3";
      const n = parseInt(raw, 10);
      setCap(Number.isFinite(n) ? Math.max(0, Math.min(n, 10)) : 3);
    }
  }, [q.data]);

  const save = async (next: number) => {
    await setPref.mutateAsync({
      key: "catchUp.maxQueueSize",
      value: String(next),
    });
    toast.success(
      next === 0
        ? "Hidden — Reagan won't see the From yesterday card."
        : `Up to ${next} nudge${next === 1 ? "" : "s"} per day.`,
    );
  };

  const resetDefault = async () => {
    setCap(3);
    await save(3);
  };

  return (
    <Card data-testid="catchup-queue-settings-card">
      <CardHeader>
        <CardTitle className="text-base">"From yesterday" catch-up nudges</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          How many missed topics from yesterday Reagan sees on Today as a calm
          "pick up where you left off" card. Set to <strong>0</strong> to hide it
          completely.
        </p>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Max nudges per day: <span className="text-foreground">{cap}</span>
          </Label>
          <div className="flex items-center gap-3">
            <Slider
              data-testid="catchup-cap-slider"
              value={[cap]}
              min={0}
              max={10}
              step={1}
              onValueChange={(v) => setCap(v[0] ?? 0)}
              onValueCommit={(v) => save(v[0] ?? 0)}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={resetDefault}
              aria-label="Reset to default"
            >
              <Undo2 className="w-3.5 h-3.5 mr-1" /> Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
