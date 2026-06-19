import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Star, CalendarPlus, Lightbulb, MapPin, Zap, Printer } from "lucide-react";
import { toast } from "sonner";

/* ----------------------------- constants ----------------------------- */

type Kind =
  | "module"
  | "day_trip"
  | "reward"
  | "craft"
  | "brain_break"
  | "infrastructure"
  | "general";
type Status = "idea" | "want_to_do" | "done";

const KIND_META: Record<Kind, { label: string; emoji: string }> = {
  module: { label: "Modules", emoji: "📦" },
  day_trip: { label: "Day Trips", emoji: "🚗" },
  reward: { label: "Rewards", emoji: "🎁" },
  craft: { label: "Crafts", emoji: "🎨" },
  brain_break: { label: "Brain Breaks", emoji: "🤸" },
  infrastructure: { label: "Workspace", emoji: "🧰" },
  general: { label: "General", emoji: "✨" },
};

const STATUS_META: Record<Status, { label: string; className: string }> = {
  idea: {
    label: "Idea",
    className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  },
  want_to_do: {
    label: "Want to do",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  done: {
    label: "Done",
    className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  },
};

const KIND_ORDER: Kind[] = [
  "module",
  "day_trip",
  "reward",
  "craft",
  "brain_break",
  "infrastructure",
  "general",
];

/* ------------------------------- page -------------------------------- */

function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

export default function IdeaLibrary() {
  const [kind, setKind] = useState<Kind | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const filterInput = useMemo(
    () => ({
      kind: kind === "all" ? undefined : kind,
      wishlistStatus: status === "all" ? undefined : status,
      favoritesOnly: favoritesOnly ? true : undefined,
    }),
    [kind, status, favoritesOnly],
  );

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.adventures.listFiltered.useQuery(filterInput);

  const toggleFav = trpc.adventures.toggleFavorite.useMutation({
    onSuccess: () => utils.adventures.listFiltered.invalidate(),
  });
  const setStatusMut = trpc.adventures.setStatus.useMutation({
    onSuccess: () => utils.adventures.listFiltered.invalidate(),
  });
  const addToDay = trpc.adventures.addToDay.useMutation();

  const list = (data ?? []) as any[];

  return (
    <div className="container py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-400/20 shrink-0">
          <Lightbulb className="w-6 h-6 text-amber-500" />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-3xl chalk-white leading-tight">Idea Library</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            A bank of adventures, modules, day trips, rewards, crafts, brain breaks, and
            workspace upgrades. Favorite the ones you love, move them through the wishlist,
            and drop any idea straight onto a day's agenda.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-background shrink-0"
          onClick={() => {
            const sp = new URLSearchParams();
            if (kind !== "all") sp.set("kind", kind);
            if (favoritesOnly) sp.set("favorites", "1");
            const qs = sp.toString();
            window.open(`/print/idea-book${qs ? `?${qs}` : ""}`, "_blank");
          }}
        >
          <Printer className="w-4 h-4 mr-1.5" />
          Print Idea Book
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <FilterRow label="Type">
          <Chip active={kind === "all"} onClick={() => setKind("all")}>
            All
          </Chip>
          {KIND_ORDER.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              <span className="mr-1">{KIND_META[k].emoji}</span>
              {KIND_META[k].label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Status">
          <Chip active={status === "all"} onClick={() => setStatus("all")}>
            All
          </Chip>
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {STATUS_META[s].label}
            </Chip>
          ))}
          <Chip active={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)}>
            <Star className="w-3.5 h-3.5 mr-1 inline" />
            Favorites
          </Chip>
        </FilterRow>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No ideas match these filters yet. Try clearing a filter.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            {list.length} idea{list.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a) => (
              <IdeaCard
                key={a.id}
                a={a}
                onToggleFav={() => toggleFav.mutate({ id: a.id })}
                onSetStatus={(s) => setStatusMut.mutate({ id: a.id, wishlistStatus: s })}
                onAddToDay={async (date, durationMin) => {
                  try {
                    await addToDay.mutateAsync({ adventureId: a.id, date, durationMin });
                    toast.success(`Added "${a.title}" to ${date}`);
                  } catch (e: any) {
                    toast.error(e?.message ?? "Could not add to that day");
                    throw e;
                  }
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ pieces ------------------------------- */

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-14 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm rounded-full px-3 py-1 border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-transparent text-foreground border-border hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function IdeaCard({
  a,
  onToggleFav,
  onSetStatus,
  onAddToDay,
}: {
  a: any;
  onToggleFav: () => void;
  onSetStatus: (s: Status) => void;
  onAddToDay: (date: string, durationMin?: number) => Promise<void>;
}) {
  const kind = (a.kind ?? "general") as Kind;
  const status = (a.wishlistStatus ?? "idea") as Status;
  const km = KIND_META[kind] ?? KIND_META.general;
  const sm = STATUS_META[status] ?? STATUS_META.idea;

  return (
    <Card className="classroom-card flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{a.emoji || km.emoji}</span>
            <CardTitle className="text-base leading-snug">{a.title}</CardTitle>
          </div>
          <button
            type="button"
            aria-label={a.isFavorite ? "Remove favorite" : "Add favorite"}
            onClick={onToggleFav}
            className="shrink-0 p-1 -m-1 rounded hover:bg-muted"
          >
            <Star
              className={`w-5 h-5 ${
                a.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
              }`}
            />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <Badge variant="outline" className="text-[11px]">
            {km.emoji} {km.label}
          </Badge>
          <Badge variant="outline" className={`text-[11px] ${sm.className}`}>
            {sm.label}
          </Badge>
          {a.category && (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              {a.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 pt-0">
        <p className="text-sm text-muted-foreground line-clamp-3">{a.description}</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {a.setting && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {a.setting}
            </span>
          )}
          {a.energyLevel && (
            <span className="inline-flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {a.energyLevel} energy
            </span>
          )}
          {a.minDurationMin != null && (
            <span>
              {a.minDurationMin}
              {a.maxDurationMin && a.maxDurationMin !== a.minDurationMin
                ? `–${a.maxDurationMin}`
                : ""}{" "}
              min
            </span>
          )}
        </div>

        {/* Status pipeline */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSetStatus(s)}
              className={`text-[11px] rounded-full px-2 py-0.5 border transition-colors ${
                status === s
                  ? STATUS_META[s].className
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>

        <div className="mt-auto pt-1">
          <AddToDayDialog title={a.title} defaultDuration={a.minDurationMin ?? 30} onAdd={onAddToDay} />
        </div>
      </CardContent>
    </Card>
  );
}

function AddToDayDialog({
  title,
  defaultDuration,
  onAdd,
}: {
  title: string;
  defaultDuration: number;
  onAdd: (date: string, durationMin?: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState(String(defaultDuration));
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const dur = Number(duration);
      await onAdd(date, Number.isFinite(dur) && dur > 0 ? dur : undefined);
      setOpen(false);
    } catch {
      /* toast handled upstream */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full bg-background">
          <CalendarPlus className="w-4 h-4 mr-1.5" />
          Add to a day
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to a day</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Drops <span className="font-medium text-foreground">{title}</span> onto the chosen
          day's agenda as an adventure block.
        </p>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Date</span>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Duration (minutes)</span>
            <Input
              type="number"
              min={5}
              max={240}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="mt-1"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" className="bg-background" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !date}>
            {busy ? "Adding…" : "Add to day"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
