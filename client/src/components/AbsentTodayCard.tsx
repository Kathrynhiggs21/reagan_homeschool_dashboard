/**
 * AbsentTodayCard — adult-only quick toggle to mark today an "absent" day.
 *
 * - Mark Absent: writes pref `absence:YYYY-MM-DD = "1"`.
 * - Today reads the pref to gate coin awards & show a banner.
 * - Shows last 14 days of absences for quick correction.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function todayKey() {
  return `absence:${new Date().toISOString().slice(0, 10)}`;
}

export default function AbsentTodayCard() {
  const utils = trpc.useUtils();
  const today = trpc.prefs.get.useQuery({ key: todayKey() });
  const recent = trpc.prefs.list.useQuery({ prefix: "absence:" });
  const setM = trpc.prefs.set.useMutation({
    onSuccess: () => {
      utils.prefs.get.invalidate();
      utils.prefs.list.invalidate();
    },
  });

  const [busy, setBusy] = useState(false);

  const isAbsent = today.data === "1";

  async function toggle() {
    setBusy(true);
    try {
      await setM.mutateAsync({ key: todayKey(), value: isAbsent ? null : "1" });
      toast.success(isAbsent ? "Today's absence cleared." : "Today marked absent. No coins will be awarded.");
    } finally {
      setBusy(false);
    }
  }

  async function clearOne(key: string) {
    await setM.mutateAsync({ key, value: null });
    toast.success("Absence cleared.");
  }

  const list = ((recent.data as any[]) || [])
    .filter((r) => (r?.value ?? null) === "1")
    .map((r) => String(r?.key ?? "").replace(/^absence:/, ""))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse()
    .slice(0, 14);

  return (
    <Card className="p-4 rounded-2xl">
      <div className="flex items-center justify-between mb-2">
        <div className="font-extrabold text-lg">🏠 Absent today?</div>
        <Button
          onClick={toggle}
          disabled={busy}
          className={
            isAbsent
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : "bg-rose-600 hover:bg-rose-500 text-white"
          }
        >
          {isAbsent ? "Clear absence (back to school)" : "Mark today absent"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Marking absent halts new coin awards for the day and tags any pending Library items as
        “absent” so they don’t look ignored.
      </p>
      {list.length > 0 && (
        <div className="text-xs">
          <div className="font-semibold mb-1">Recent absences</div>
          <div className="flex flex-wrap gap-1">
            {list.map((d) => (
              <button
                key={d}
                onClick={() => clearOne(`absence:${d}`)}
                title="Click to clear"
                className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100"
              >
                {d} ✕
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
