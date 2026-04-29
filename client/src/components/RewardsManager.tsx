import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, Save, X, Coins } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "cash", label: "Cash" },
  { value: "digital", label: "Digital" },
  { value: "toy", label: "Toy" },
  { value: "experience", label: "Experience" },
  { value: "screen_time", label: "Screen time" },
  { value: "treat", label: "Treat" },
  { value: "custom", label: "Custom" },
] as const;

type DraftPrize = {
  id?: number;
  title: string;
  emoji: string;
  description: string;
  coinCost: number;
  category: typeof CATEGORIES[number]["value"];
  active: boolean;
};

const EMPTY: DraftPrize = {
  title: "",
  emoji: "⭐",
  description: "",
  coinCost: 50,
  category: "experience",
  active: true,
};

export function RewardsManager() {
  const utils = trpc.useUtils();
  const { data: prizes = [], isLoading } = trpc.rewards.listPrizes.useQuery({ activeOnly: false });

  const [editing, setEditing] = useState<DraftPrize | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DraftPrize>(EMPTY);

  const createMut = trpc.rewards.createPrize.useMutation({
    onSuccess: () => {
      utils.rewards.listPrizes.invalidate();
      toast.success("Prize added");
      setAdding(false);
      setDraft(EMPTY);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.rewards.updatePrize.useMutation({
    onSuccess: () => {
      utils.rewards.listPrizes.invalidate();
      toast.success("Saved");
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.rewards.deletePrize.useMutation({
    onSuccess: () => {
      utils.rewards.listPrizes.invalidate();
      toast.success("Removed");
    },
    onError: (e) => toast.error(e.message),
  });

  function startEdit(p: any) {
    setEditing({
      id: p.id,
      title: p.title,
      emoji: p.emoji,
      description: p.description ?? "",
      coinCost: p.coinCost,
      category: p.category,
      active: p.active,
    });
  }

  function saveEdit() {
    if (!editing?.id) return;
    updateMut.mutate({
      id: editing.id,
      title: editing.title,
      emoji: editing.emoji,
      description: editing.description || null,
      coinCost: editing.coinCost,
      category: editing.category,
      active: editing.active,
    });
  }

  function saveNew() {
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    createMut.mutate({
      title: draft.title,
      emoji: draft.emoji || "⭐",
      description: draft.description || null,
      coinCost: draft.coinCost,
      category: draft.category,
      active: draft.active,
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Reward tiers (Mom-editable)</CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => { setAdding(true); setDraft(EMPTY); }}>
            <Plus className="h-4 w-4 mr-1" /> Add prize
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <PrizeForm
            draft={draft}
            setDraft={setDraft}
            onSave={saveNew}
            onCancel={() => { setAdding(false); setDraft(EMPTY); }}
            saving={createMut.isPending}
          />
        )}

        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {!isLoading && prizes.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No prizes yet. Click <em>Add prize</em> above to start the rewards catalog.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {prizes.map((p: any) =>
            editing?.id === p.id ? (
              <div key={p.id} className="sm:col-span-2">
                <PrizeForm
                  draft={editing!}
                  setDraft={(d) => setEditing(d)}
                  onSave={saveEdit}
                  onCancel={() => setEditing(null)}
                  saving={updateMut.isPending}
                />
              </div>
            ) : (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${p.active ? "" : "opacity-60"}`}
              >
                <div className="text-2xl shrink-0">{p.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="inline-flex items-center gap-0.5">
                      <Coins className="h-3 w-3" /> {p.coinCost}
                    </span>
                    <span>·</span>
                    <span>{CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}</span>
                    {!p.active && <><span>·</span><span className="italic">hidden</span></>}
                  </div>
                  {p.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Remove "${p.title}"?`)) deleteMut.mutate({ id: p.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PrizeForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: DraftPrize;
  setDraft: (d: DraftPrize) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
      <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr_120px] gap-2">
        <div>
          <Label className="text-xs">Emoji</Label>
          <Input
            value={draft.emoji}
            maxLength={4}
            onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
            className="text-2xl text-center"
          />
        </div>
        <div>
          <Label className="text-xs">Title</Label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="e.g. 15 minutes Roblox"
          />
        </div>
        <div>
          <Label className="text-xs">Coin cost</Label>
          <Input
            type="number"
            min={0}
            value={draft.coinCost}
            onChange={(e) => setDraft({ ...draft, coinCost: parseInt(e.target.value || "0", 10) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
        <div>
          <Label className="text-xs">Description (optional)</Label>
          <Input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Tier · Category · Approval needed"
          />
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <Select
            value={draft.category}
            onValueChange={(v) => setDraft({ ...draft, category: v as DraftPrize["category"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Show in Rewards catalog
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
