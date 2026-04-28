/**
 * NeedsWork — adult-only hierarchical "Needs Work" tree.
 * Organized by Subject -> Sub-subject -> Skill -> Sub-skill (arbitrary nesting).
 * Each item shows date added, and when completed, gets struck through + date completed.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface NWRow {
  id: number;
  parentId: number | null;
  subjectSlug: string | null;
  title: string;
  note: string | null;
  origin: string;
  sortOrder: number;
  dateAdded: string | Date;
  dateCompleted: string | Date | null;
}

const COMMON_SUBJECTS = ["math", "ela", "reading", "writing", "science", "ss", "art", "music", "pe", "life_skills"];

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NeedsWork() {
  const list = trpc.needsWork.list.useQuery();
  const createM = trpc.needsWork.create.useMutation();
  const updateM = trpc.needsWork.update.useMutation();
  const completeM = trpc.needsWork.complete.useMutation();
  const reopenM = trpc.needsWork.reopen.useMutation();
  const deleteM = trpc.needsWork.delete.useMutation();
  const reparentM = trpc.needsWork.reparent.useMutation();
  const utils = trpc.useUtils();

  const [addDialog, setAddDialog] = useState<{ open: boolean; parent?: NWRow | null }>({ open: false });
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");

  // Build tree
  const byParent = useMemo(() => {
    const map = new Map<number | null, NWRow[]>();
    for (const r of (list.data as NWRow[] | undefined) ?? []) {
      const p = r.parentId ?? null;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(r);
    }
    const arrs = Array.from(map.values());
    for (const arr of arrs) {
      arr.sort((a: NWRow, b: NWRow) => (a.sortOrder - b.sortOrder) || a.id - b.id);
    }
    return map;
  }, [list.data]);

  function openAdd(parent?: NWRow | null) {
    setAddDialog({ open: true, parent: parent ?? null });
    setTitle("");
    setSubject(parent?.subjectSlug || "");
    setNote("");
  }

  async function saveNew() {
    if (!title.trim()) { toast.error("Title is required."); return; }
    await createM.mutateAsync({
      parentId: addDialog.parent?.id ?? null,
      title,
      subjectSlug: subject || undefined,
      note: note || undefined,
      origin: "manual",
    });
    utils.needsWork.list.invalidate();
    setAddDialog({ open: false });
    toast.success("Added.");
  }

  async function toggleComplete(r: NWRow) {
    if (r.dateCompleted) {
      await reopenM.mutateAsync({ id: r.id });
    } else {
      await completeM.mutateAsync({ id: r.id });
    }
    utils.needsWork.list.invalidate();
  }

  async function remove(r: NWRow) {
    if (!confirm(`Delete "${r.title}" and all its sub-items?`)) return;
    await deleteM.mutateAsync({ id: r.id });
    utils.needsWork.list.invalidate();
  }

  async function rename(r: NWRow) {
    const name = prompt("Rename to:", r.title);
    if (!name || name === r.title) return;
    await updateM.mutateAsync({ id: r.id, title: name });
    utils.needsWork.list.invalidate();
  }

  async function moveSibling(r: NWRow, dir: -1 | 1) {
    const siblings = byParent.get(r.parentId ?? null) ?? [];
    const idx = siblings.findIndex((x) => x.id === r.id);
    const swapWith = siblings[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      updateM.mutateAsync({ id: r.id, sortOrder: swapWith.sortOrder }),
      updateM.mutateAsync({ id: swapWith.id, sortOrder: r.sortOrder }),
    ]);
    utils.needsWork.list.invalidate();
  }

  async function reparent(r: NWRow) {
    const all = (list.data as NWRow[] | undefined) ?? [];
    // Build candidate parents (exclude self + any descendant)
    const descendants = new Set<number>([r.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const x of all) {
        if (x.parentId && descendants.has(x.parentId) && !descendants.has(x.id)) {
          descendants.add(x.id);
          grew = true;
        }
      }
    }
    const candidates = all.filter((x) => !descendants.has(x.id));
    const choices = ["(top level)", ...candidates.map((x) => `${x.id}: ${x.title}`)].join("\n");
    const pick = prompt(`Move "${r.title}" under which parent?\n\n${choices}\n\nType id (or blank for top-level):`);
    if (pick === null) return;
    const parentId = pick.trim() === "" ? null : Number(pick.trim());
    if (parentId !== null && Number.isNaN(parentId)) { toast.error("Invalid id"); return; }
    await reparentM.mutateAsync({ id: r.id, parentId });
    utils.needsWork.list.invalidate();
  }

  function exportPrintable() {
    const all = (list.data as NWRow[] | undefined) ?? [];
    const lines: string[] = ["Reagan — Needs Work (printable)", new Date().toLocaleDateString(), ""];
    function walk(parentId: number | null, depth: number) {
      const rows = byParent.get(parentId) ?? [];
      for (const r of rows) {
        const prefix = "  ".repeat(depth) + (r.dateCompleted ? "[x] " : "[ ] ");
        const subj = r.subjectSlug ? ` (${r.subjectSlug})` : "";
        const dates = r.dateCompleted ? `  — added ${fmt(r.dateAdded)}, done ${fmt(r.dateCompleted)}` : `  — added ${fmt(r.dateAdded)}`;
        lines.push(prefix + r.title + subj + dates);
        walk(r.id, depth + 1);
      }
    }
    walk(null, 0);
    void all;
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `needs-work-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function Branch({ parentId, depth = 0 }: { parentId: number | null; depth?: number }) {
    const rows = byParent.get(parentId) ?? [];
    if (rows.length === 0 && parentId !== null) return null;
    return (
      <ul className="space-y-1">
        {rows.map((r) => {
          const done = !!r.dateCompleted;
          return (
            <li key={r.id} style={{ paddingLeft: depth * 18 }}>
              <div className="flex items-center gap-2 group py-1">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggleComplete(r)}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
                <div className={`flex-1 text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
                  <span className="font-medium">{r.title}</span>
                  {r.subjectSlug && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-white/10 border border-border">
                      {r.subjectSlug}
                    </span>
                  )}
                  {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                </div>
                <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                  Added {fmt(r.dateAdded)}
                  {done && <> · Done {fmt(r.dateCompleted)}</>}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => moveSibling(r, -1)}>↑</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => moveSibling(r, 1)}>↓</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => reparent(r)}>⇋ move</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => openAdd(r)}>+ child</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => rename(r)}>✎</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive" onClick={() => remove(r)}>🗑</Button>
                </div>
              </div>
              <Branch parentId={r.id} depth={depth + 1} />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <header className="chalkboard">
        <div className="font-chalk-hand text-xl chalk-yellow">Adult-only workspace</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1 chalk-white">Needs Work</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Anything she's still working on — organized by subject and skill. Auto-added when mastery drops, manually addable here, and crossed out when done.
        </p>
      </header>

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {(list.data as NWRow[] | undefined)?.length ?? 0} item{(list.data as NWRow[] | undefined)?.length === 1 ? "" : "s"}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="bg-transparent" onClick={exportPrintable}>🖨 Export for tutor</Button>
          <Button size="sm" onClick={() => openAdd(null)}>+ Top-level item</Button>
        </div>
      </div>

      <Card className="classroom-card p-5">
        {list.isLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
        {!list.isLoading && (byParent.get(null)?.length ?? 0) === 0 && (
          <div className="text-sm text-muted-foreground">
            No items yet. Add a top-level subject like "Math" or "Reading", then add sub-items under it.
          </div>
        )}
        <Branch parentId={null} />
      </Card>

      {/* Add dialog */}
      <Dialog open={addDialog.open} onOpenChange={(v) => setAddDialog((s) => ({ ...s, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addDialog.parent ? `Add under "${addDialog.parent.title}"` : "Add top-level item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fractions with unlike denominators" />
            </div>
            <div className="space-y-1">
              <Label>Subject (optional)</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(none)</SelectItem>
                  {COMMON_SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Note (optional)</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog({ open: false })}>Cancel</Button>
            <Button onClick={saveNew}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
