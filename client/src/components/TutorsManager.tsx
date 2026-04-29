import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Tutor = {
  id: number; name: string; role?: string | null; email?: string | null;
  phone?: string | null; subjects?: string | null; bio?: string | null;
  active?: boolean | null; notes?: string | null; avatarUrl?: string | null;
};

const EMPTY: Partial<Tutor> = { name: "", role: "", email: "", subjects: "", notes: "", active: true };

export default function TutorsManager() {
  const utils = trpc.useUtils();
  const { data: tutors = [], isLoading } = trpc.tutors.list.useQuery({ activeOnly: false });
  const [editing, setEditing] = useState<Partial<Tutor> | null>(null);

  const upsert = trpc.tutors.upsert.useMutation({
    onSuccess: () => {
      toast.success(editing?.id ? "Tutor updated" : "Tutor added");
      setEditing(null);
      utils.tutors.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetRoster = trpc.tutors.resetRoster.useMutation({
    onSuccess: (res) => {
      toast.success(`Roster reset — ${res.roster.join(", ")}`);
      utils.tutors.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function save() {
    if (!editing?.name?.trim()) { toast.error("Name required"); return; }
    upsert.mutate({
      id: editing.id,
      name: editing.name.trim(),
      role: editing.role || undefined,
      email: editing.email || undefined,
      phone: editing.phone || undefined,
      subjects: editing.subjects || undefined,
      bio: editing.bio || undefined,
      notes: editing.notes || undefined,
      avatarUrl: editing.avatarUrl || undefined,
      active: editing.active ?? true,
    });
  }

  return (
    <Card className="cozy-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-display text-lg font-bold">👩‍🏫 Tutors</div>
          <p className="text-xs opacity-70">Each tutor gets a private briefing page with priority skills + outcome buttons.</p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={resetRoster.isPending}
              onClick={() => {
                if (window.confirm("Reset tutor roster to Mike, Sophie, and College tutor? Other tutors will be marked inactive (history preserved).")) {
                  resetRoster.mutate();
                }
              }}
            >
              {resetRoster.isPending ? "Resetting…" : "Reset roster"}
            </Button>
            <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>+ Add tutor</Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm opacity-70">Loading…</p>}

      {!editing && (
        <ul className="space-y-2">
          {tutors.map((t: any) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{t.name} {!t.active && <span className="text-xs opacity-50">(inactive)</span>}</div>
                <div className="text-xs opacity-60 truncate">{t.role || "Tutor"} · {t.subjects || "All subjects"}{t.email ? ` · ${t.email}` : ""}</div>
              </div>
              <div className="flex gap-2">
                <Link href={`/tutor/${t.id}`}><Button size="sm" variant="outline">Briefing</Button></Link>
                <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Edit</Button>
              </div>
            </li>
          ))}
          {tutors.length === 0 && <li className="text-sm opacity-70 italic">No tutors yet. Add Marisa, AJ, or anyone else who works with Reagan.</li>}
        </ul>
      )}

      {editing && (
        <div className="space-y-3 mt-2">
          <Input placeholder="Name (e.g. Marisa Conger)" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <Input placeholder="Role (e.g. Reading tutor — Mama Bear)" value={editing.role || ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
          <Input placeholder="Email" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
          <Input placeholder="Subjects (comma-separated, e.g. ela, math)" value={editing.subjects || ""} onChange={(e) => setEditing({ ...editing, subjects: e.target.value })} />
          <Textarea placeholder="Notes / preferences" rows={3} value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          <div className="flex justify-between items-center pt-1">
            <label className="text-xs flex items-center gap-2 opacity-70">
              <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              Active
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
