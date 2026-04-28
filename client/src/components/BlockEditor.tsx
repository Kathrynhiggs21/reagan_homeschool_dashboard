/**
 * BlockEditor — adult-only modal for creating or editing a scheduleBlock.
 * Usage:
 *   <BlockEditor open={o} onOpenChange={setO} planId={planId} block={existing} />
 * If `block` is undefined it becomes a "create" form, otherwise it edits in place.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type BlockType =
  | "morning_warmup" | "math" | "adventure" | "read_aloud"
  | "choice" | "catch_up" | "appointment" | "custom";

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: "morning_warmup", label: "Morning Warmup" },
  { value: "math",           label: "Math" },
  { value: "adventure",      label: "Adventure" },
  { value: "read_aloud",     label: "Read Aloud" },
  { value: "choice",         label: "Choice / Interest" },
  { value: "catch_up",       label: "Catch Up" },
  { value: "appointment",    label: "Appointment" },
  { value: "custom",         label: "Custom" },
];

export interface ExistingBlock {
  id: number;
  title?: string | null;
  description?: string | null;
  blockType?: string | null;
  durationMin?: number | null;
  startTime?: string | null;
  sortOrder?: number | null;
  subjectId?: number | null;
}

export interface BlockEditorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planId?: number;
  block?: ExistingBlock; // when present, edit mode
  onSaved?: () => void;
}

export default function BlockEditor({ open, onOpenChange, planId, block, onSaved }: BlockEditorProps) {
  const utils = trpc.useUtils();
  const createM = trpc.blocks.create.useMutation();
  const updateM = trpc.blocks.update.useMutation();
  const deleteM = trpc.blocks.delete.useMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [blockType, setBlockType] = useState<BlockType>("custom");
  const [durationMin, setDurationMin] = useState(30);
  const [startTime, setStartTime] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (open) {
      setTitle(block?.title || "");
      setDescription(block?.description || "");
      setBlockType((block?.blockType as BlockType) || "custom");
      setDurationMin(block?.durationMin ?? 30);
      setStartTime(block?.startTime || "");
      setSortOrder(block?.sortOrder ?? 0);
    }
  }, [open, block?.id]);

  const isEdit = !!block?.id;

  async function save() {
    if (!title.trim()) { toast.error("Title is required."); return; }
    try {
      if (isEdit && block) {
        await updateM.mutateAsync({
          id: block.id,
          title,
          description: description || undefined,
          durationMin,
          sortOrder,
        });
        toast.success("Block updated.");
      } else {
        if (!planId) { toast.error("Missing plan."); return; }
        await createM.mutateAsync({
          planId,
          blockType,
          title,
          description: description || undefined,
          durationMin,
          startTime: startTime || undefined,
          sortOrder,
        });
        toast.success("Block added.");
      }
      utils.plans.today.invalidate();
      utils.plans.byDate.invalidate();
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || "Save failed.");
    }
  }

  async function del() {
    if (!block?.id) return;
    if (!confirm("Delete this block?")) return;
    try {
      await deleteM.mutateAsync({ id: block.id });
      toast.success("Deleted.");
      utils.plans.today.invalidate();
      utils.plans.byDate.invalidate();
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit block" : "Add block"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Math: fractions practice" />
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={blockType} onValueChange={(v) => setBlockType(v as BlockType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Duration (min)</Label>
              <Input type="number" min={5} max={180} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value) || 30)} />
            </div>
            <div className="space-y-1">
              <Label>Start time</Label>
              <Input placeholder="8:30" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sort order</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={del}>Delete</Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{isEdit ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
