import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Comfort = "calm" | "okay" | "stretched" | "overwhelmed";

const comfortColors: Record<Comfort, string> = {
  calm: "bg-emerald-200/30 text-emerald-100 border-emerald-300/50",
  okay: "bg-sky-200/30 text-sky-100 border-sky-300/50",
  stretched: "bg-amber-200/30 text-amber-100 border-amber-300/50",
  overwhelmed: "bg-rose-200/30 text-rose-100 border-rose-300/50",
};

/** Three quick-tag buckets — keeps the form fast for a tired adult. */
const SUBJECT_TAGS = [
  "Math", "ELA", "Writing", "Reading", "Science", "Social Studies",
  "Adventure", "Music/Art", "Life Skills",
];
const CONCERN_TAGS = [
  "Focus", "Sensory", "Anxiety", "Tired", "Frustrated",
  "Refused", "Big feelings", "Hyper", "Distracted",
];
const FREQUENT_TAGS = [
  "Reread needed", "Math facts shaky", "Slow start",
  "Great effort", "Big breakthrough", "Outside reset helped",
  "Snack helped", "Body break helped",
];

/**
 * TutorDayNotesBox — placed at the top of the adult Daily Schedule page.
 * Any adult (Mom or tutor of the day) can jot a free-form note about how
 * the day went. Notes flow back into the AI agenda generator for next day,
 * and the tags feed the analytics page (top concerns, frequent patterns).
 *
 * Visual: matches the chalkboard / Notebook page aesthetic — light text on
 * darker translucent surface so labels + placeholders are readable.
 */
export default function TutorDayNotesBox({
  dateStr,
  tutorOfDayName,
}: {
  dateStr: string;
  tutorOfDayName?: string;
}) {
  const utils = trpc.useUtils();
  const list = (trpc as any).tutorDayNotes?.listForDate?.useQuery?.({ dateStr }) ?? {
    data: [],
    isLoading: false,
  };
  const add = (trpc as any).tutorDayNotes?.add?.useMutation?.({
    onSuccess: () => {
      toast.success("Note saved.");
      (utils as any).tutorDayNotes?.listForDate?.invalidate?.({ dateStr });
      setNotes("");
      setTopics("");
      setSelectedTags([]);
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not save note."),
  });
  const remove = (trpc as any).tutorDayNotes?.remove?.useMutation?.({
    onSuccess: () => (utils as any).tutorDayNotes?.listForDate?.invalidate?.({ dateStr }),
  });

  const [author, setAuthor] = useState(tutorOfDayName ?? "");
  const [topics, setTopics] = useState("");
  const [notes, setNotes] = useState("");
  const [comfort, setComfort] = useState<Comfort | "">("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleTag = (t: string) =>
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const items: Array<{
    id: number;
    tutorName: string;
    topicsCovered: string | null;
    comfort: Comfort | null;
    notes: string;
    tags: string[] | null;
    createdAt: string | Date;
  }> = list.data ?? [];

  return (
    <Card className="cozy-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-foreground">Today's notes</span>
          <span className="text-xs font-normal opacity-80">
            For tutors + Mom
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing notes for the day — chalkboard-readable, light text on
            a darker translucent panel so it pops on every theme. */}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((n) => (
              <div
                key={n.id}
                className="rounded-lg p-3 border border-white/15 bg-black/30 text-foreground"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{n.tutorName}</span>
                    {n.comfort && (
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${comfortColors[n.comfort]}`}
                      >
                        {n.comfort}
                      </Badge>
                    )}
                    {(n.tags ?? []).map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-[10px] border-white/25 bg-white/10 text-foreground"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-foreground hover:bg-white/10"
                    onClick={() => (remove as any)?.mutate?.({ id: n.id })}
                  >
                    Remove
                  </Button>
                </div>
                {n.topicsCovered && (
                  <div className="text-xs opacity-90 mb-1">
                    <span className="font-medium">Covered:</span> {n.topicsCovered}
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">{n.notes}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add a note */}
        <div className="space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <div>
              <Label className="text-xs">Your name</Label>
              <Input
                placeholder="e.g. Mom, Marcy, Ali"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">How was Reagan?</Label>
              <select
                className="h-9 border rounded-md px-2 text-sm w-full"
                value={comfort}
                onChange={(e) => setComfort((e.target.value || "") as Comfort | "")}
              >
                <option value="">— pick —</option>
                <option value="calm">Calm</option>
                <option value="okay">Okay</option>
                <option value="stretched">Stretched</option>
                <option value="overwhelmed">Overwhelmed</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Topics covered (one line)</Label>
            <Input
              placeholder="e.g. long division, Tuck Ch. 4, hawk identification"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              placeholder="What worked, what flopped, anything for tomorrow…"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Quick tag chips — three buckets so a tired adult can categorize fast */}
          <TagPicker
            label="Subject"
            options={SUBJECT_TAGS}
            selected={selectedTags}
            onToggle={toggleTag}
            colorClass="hover:bg-emerald-300/20 data-[on=true]:bg-emerald-300/30 data-[on=true]:border-emerald-300/60"
          />
          <TagPicker
            label="Concern"
            options={CONCERN_TAGS}
            selected={selectedTags}
            onToggle={toggleTag}
            colorClass="hover:bg-rose-300/20 data-[on=true]:bg-rose-300/30 data-[on=true]:border-rose-300/60"
          />
          <TagPicker
            label="Frequent on list"
            options={FREQUENT_TAGS}
            selected={selectedTags}
            onToggle={toggleTag}
            colorClass="hover:bg-sky-300/20 data-[on=true]:bg-sky-300/30 data-[on=true]:border-sky-300/60"
          />

          <div className="flex justify-end pt-1">
            <Button
              onClick={() => {
                if (!author.trim()) {
                  toast.error("Add your name first.");
                  return;
                }
                if (!notes.trim()) {
                  toast.error("Write a note.");
                  return;
                }
                (add as any)?.mutate?.({
                  dateStr,
                  tutorName: author.trim(),
                  topicsCovered: topics.trim() || null,
                  comfort: comfort || null,
                  notes: notes.trim(),
                  tags: selectedTags.length ? selectedTags : null,
                });
              }}
            >
              Save note
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TagPicker({
  label,
  options,
  selected,
  onToggle,
  colorClass,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (t: string) => void;
  colorClass: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide opacity-75 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((t) => {
          const on = selected.includes(t);
          return (
            <button
              key={t}
              type="button"
              data-on={on}
              onClick={() => onToggle(t)}
              className={`text-xs px-2 py-1 rounded-full border border-white/25 text-foreground transition ${colorClass}`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
