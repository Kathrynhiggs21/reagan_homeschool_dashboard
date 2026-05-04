import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Slim appointments editor for Settings → Calendar tab.
 * Just shows the current recurring appointments as one row each + an "Add" form.
 * Replaces the much longer AppointmentsCard that had its own jump-nav inside it.
 */
export default function AppointmentsCardLite() {
  const list = (trpc as any).appointments?.list?.useQuery?.() ?? { data: [], isLoading: false };
  const utils = trpc.useUtils();
  const add = (trpc as any).appointments?.add?.useMutation?.({
    onSuccess: () => (utils as any).appointments?.list?.invalidate?.(),
  });
  const remove = (trpc as any).appointments?.remove?.useMutation?.({
    onSuccess: () => (utils as any).appointments?.list?.invalidate?.(),
  });

  const [title, setTitle] = useState("");
  const [day, setDay] = useState("Wed");
  const [time, setTime] = useState("10:00");

  const items: Array<{ id: number; title: string; dayOfWeek: string; timeOfDay: string }> =
    list.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurring appointments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No recurring appointments yet.</div>
        ) : (
          items.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border rounded-lg px-3 py-2"
            >
              <div className="text-sm">
                <span className="font-medium">{a.title}</span>
                <span className="text-muted-foreground ml-2">
                  {a.dayOfWeek} · {a.timeOfDay}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => (remove as any)?.mutate?.({ id: a.id })}
              >
                Remove
              </Button>
            </div>
          ))
        )}

        <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
          <div>
            <Label>Title</Label>
            <Input
              placeholder="e.g. Therapy with Ali"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label>Day</Label>
            <select
              className="h-9 border rounded-md px-2 text-sm bg-background"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Time</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-28"
            />
          </div>
          <Button
            onClick={() => {
              if (!title.trim()) {
                toast.error("Add a title.");
                return;
              }
              (add as any)?.mutate?.({ title, dayOfWeek: day, timeOfDay: time });
              setTitle("");
            }}
          >
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
