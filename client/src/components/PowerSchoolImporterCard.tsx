import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/**
 * PowerSchoolImporterCard
 * ----------------------
 * Parent-only card for pasting or uploading PowerSchool exports from the Indian Hill
 * parent portal and ingesting them into the dashboard's grades/assignments tables.
 *
 * This is the offline path Mom can use immediately, independently of the automated
 * scraper (which needs a one-time Google sign-in to unlock the session cookie).
 */
export function PowerSchoolImporterCard() {
  const utils = trpc.useUtils();
  const recentImports = trpc.powerschool.listImports.useQuery({ limit: 10 });
  const recentGrades = trpc.powerschool.listGrades.useQuery({ limit: 50 });
  const recentAssignments = trpc.powerschool.listAssignments.useQuery({ limit: 50 });
  const [raw, setRaw] = useState("");
  const importMut = trpc.powerschool.importPaste.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Imported ${res.grades} grade rows + ${res.assignments} assignments`,
      );
      setRaw("");
      utils.powerschool.listImports.invalidate();
      utils.powerschool.listGrades.invalidate();
      utils.powerschool.listAssignments.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Import failed"),
  });

  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setRaw(text);
  }

  return (
    <Card className="border-amber-300/40">
      <CardHeader>
        <CardTitle className="text-amber-300">
          PowerSchool import (Indian Hill)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Paste grades/assignments directly from the Indian Hill parent portal, or
          drop in a CSV the teacher emailed you. We'll parse and save everything
          to Analytics.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={onFile}
            className="text-xs"
          />
          <span className="text-xs text-muted-foreground">
            …or paste below:
          </span>
        </div>
        <Textarea
          rows={8}
          placeholder={`Course\tTeacher\tQ1\tQ2\tQ3\tQ4\tFinal\nMath 5\tPeterson\tA\t88%\tB+\tA-\t91%`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="font-mono text-xs"
        />
        <div className="flex gap-2 items-center">
          <Button
            disabled={!raw.trim() || importMut.isPending}
            onClick={() =>
              importMut.mutate({ raw: raw.trim(), source: "paste" })
            }
          >
            {importMut.isPending ? "Importing…" : "Import"}
          </Button>
          {importMut.data ? (
            <span className="text-xs text-green-400">
              Kind: {importMut.data.kind} · Unparsed lines:{" "}
              {importMut.data.unparsed.length}
            </span>
          ) : null}
        </div>

        <Divider label="Recent imports" />
        {recentImports.data && recentImports.data.length > 0 ? (
          <div className="text-xs space-y-1">
            {recentImports.data.slice(0, 5).map((r) => (
              <div key={r.id} className="flex justify-between">
                <span>
                  #{r.id} · {r.source} · {r.parsedCount} rows
                </span>
                <span className="text-muted-foreground">
                  {new Date(r.importedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No imports yet.</p>
        )}

        <Divider label="Recent grades" />
        {recentGrades.data && recentGrades.data.length > 0 ? (
          <div className="text-xs grid grid-cols-2 gap-1">
            {recentGrades.data.slice(0, 10).map((g) => (
              <div key={g.id}>
                <span className="font-semibold">{g.course}</span>
                <span className="text-muted-foreground ml-2">{g.term}</span>
                <span className="ml-2">
                  {g.letter ?? ""} {g.percent ?? ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No grades yet.</p>
        )}

        <Divider label="Recent assignments" />
        {recentAssignments.data && recentAssignments.data.length > 0 ? (
          <div className="text-xs space-y-1">
            {recentAssignments.data.slice(0, 10).map((a) => (
              <div key={a.id} className="flex justify-between">
                <span>
                  <span className="font-semibold">{a.course}</span> · {a.title}
                </span>
                <span className="text-muted-foreground">
                  {a.dueDate ?? ""} {a.score ?? ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No assignments yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
