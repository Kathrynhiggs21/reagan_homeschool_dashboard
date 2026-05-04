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
  calm: "bg-emerald-100 text-emerald-900 border-emerald-200",
  okay: "bg-sky-100 text-sky-900 border-sky-200",
  stretched: "bg-amber-100 text-amber-900 border-amber-200",
  overwhelmed: "bg-rose-100 text-rose-900 border-rose-200",
};

/**
 * TutorDayNotesBox — placed at the top of the adult Daily Schedule page.
 * Any adult (Mom or tutor of the day) can jot a free-form note about how
 * the day went. Notes flow back into the AI agenda generator for next day.
 *
 * Props:
 *   - dateStr  YYYY-MM-DD for today
 *   - tutorOfDayName  prefilled author name when a tutor is scheduled today
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

  const items: Array<{
    id: number;
    tutorName: string;
    topicsCovered: string | null;
    comfort: Comfort | null;
    notes: string;
    createdAt: string | Date;
  }> = list.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Today's notes</span>
          <span className="text-xs font-normal text-muted-foreground">
            For tutors + Mom
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing notes for the day */}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((n) => (
              <div key={n.id} className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{n.tutorName}</span>
                    {n.comfort && (
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${comfortColors[n.comfort]}`}
                      >
                        {n.comfort}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (remove as any)?.mutate?.({ id: n.id })}
                  >
                    Remove
                  </Button>
                </div>
                {n.topicsCovered && (
                  <div className="text-xs text-muted-foreground mb-1">
                    <span className="font-medium">Covered:</span> {n.topicsCovered}
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">{n.notes}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add a note */}
        <div className="space-y-2">
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
                className="h-9 border rounded-md px-2 text-sm bg-background w-full"
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
          <div className="flex justify-end">
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
