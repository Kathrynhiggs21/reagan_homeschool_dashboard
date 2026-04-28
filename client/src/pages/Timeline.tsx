import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { toast } from "sonner";

const EVENT_TYPES = ["completion","milestone","creation","field_trip","reflection","adventure"] as const;

function EventForm({ open, onOpenChange, event, onSaved }: any) {
  const utils = trpc.useUtils();
  const add = trpc.timeline.add.useMutation();
  const upd = trpc.timeline.update.useMutation();
  const isEdit = !!event;
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [date, setDate] = useState((event?.eventDate || event?.date || new Date().toISOString()).slice(0, 10));
  const [eventType, setEventType] = useState<string>(event?.eventType || "milestone");

  async function save() {
    if (!title.trim()) return toast.error("Enter a title.");
    try {
      if (isEdit) {
        await upd.mutateAsync({ id: event.id, title, description, date, eventType: eventType as any });
        toast.success("Event updated.");
      } else {
        await add.mutateAsync({ title, description, date, eventType: eventType as any });
        toast.success("Event added.");
      }
      utils.timeline.list.invalidate();
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit event" : "Add timeline event"}</DialogTitle></DialogHeader>
        <div className="space-y-2 pt-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="bg-transparent" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={add.isPending || upd.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Timeline() {
  const { unlocked } = useAdultLock();
  const utils = trpc.useUtils();
  const events = trpc.timeline.list.useQuery();
  const del = trpc.timeline.delete.useMutation({ onSuccess: () => utils.timeline.list.invalidate() });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  return (
    <div className="space-y-6">
      <header className="chalkboard">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-4xl chalk-white">My Timeline ✨</h1>
            <p className="text-muted-foreground text-sm mt-1">Look how much you've grown.</p>
          </div>
          {unlocked && (
            <Button size="sm" onClick={() => setAdding(true)}>+ Add event</Button>
          )}
        </div>
      </header>
      <div className="space-y-3">
        {(events.data ?? []).map((e: any) => (
          <Card key={e.id} className="cozy-card p-4 flex gap-3 group">
            <span className="text-2xl">{e.emoji || "⭐"}</span>
            <div className="flex-1">
              <div className="font-display font-semibold">{e.title}</div>
              {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
              <div className="text-xs text-muted-foreground mt-1">{new Date(e.eventDate || e.createdAt).toLocaleDateString()}</div>
            </div>
            {unlocked && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 self-start">
                <Button size="sm" variant="outline" className="bg-transparent" onClick={() => setEditing(e)}>✎</Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent text-destructive"
                  onClick={async () => { if (confirm(`Delete "${e.title}"?`)) { await del.mutateAsync({ id: e.id }); toast.success("Event deleted"); } }}
                >🗑</Button>
              </div>
            )}
          </Card>
        ))}
        {events.data?.length === 0 && (
          <Card className="cozy-card p-6 text-center text-muted-foreground">
            <div className="text-4xl mb-2">✨</div>
            <p className="font-hand text-lg">Your story starts here.</p>
          </Card>
        )}
      </div>
      {adding && <EventForm open={adding} onOpenChange={(o: boolean) => setAdding(o)} onSaved={() => setAdding(false)} />}
      {editing && <EventForm open={!!editing} onOpenChange={(o: boolean) => !o && setEditing(null)} event={editing} onSaved={() => setEditing(null)} />}
    </div>
  );
}
