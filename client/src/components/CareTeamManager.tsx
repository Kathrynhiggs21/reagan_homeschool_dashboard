import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Contact = { name: string; role: string; phone?: string; email?: string };

/**
 * Adult-editable Care Team card. Mom can fill in phones, emails, add/remove
 * contacts. Persists to learnerProfile.contacts via profile.update.
 */
export default function CareTeamManager() {
  const profileQ = trpc.profile.get.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.profile.update.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      toast.success("Care Team updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const [rows, setRows] = useState<Contact[]>([]);

  useEffect(() => {
    const c = (profileQ.data as any)?.contacts;
    if (Array.isArray(c)) setRows(c);
  }, [profileQ.data]);

  function setRow(i: number, patch: Partial<Contact>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { name: "", role: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }
  function save() {
    const cleaned = rows
      .filter((r) => (r.name?.trim() || "") && (r.role?.trim() || ""))
      .map((r) => ({
        name: r.name.trim(),
        role: r.role.trim(),
        phone: r.phone?.trim() || undefined,
        email: r.email?.trim() || undefined,
      }));
    update.mutate({ contacts: cleaned });
  }

  return (
    <Card className="cozy-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display font-semibold">Care Team</h2>
          <div className="text-[11px] text-muted-foreground">
            Who supports Reagan. Fill in phones, emails, add teacher / specialist / allergies contact.
            Visible on the Tutor Handoff page only (never shown to Reagan).
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={addRow}>
          + Add contact
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm italic text-muted-foreground">No contacts yet. Click “+ Add contact”.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center p-2 rounded-md border bg-white/40"
            >
              <Input
                placeholder="Name"
                value={r.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
              />
              <Input
                placeholder="Role (e.g. Therapist, Teacher)"
                value={r.role}
                onChange={(e) => setRow(i, { role: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={r.phone ?? ""}
                onChange={(e) => setRow(i, { phone: e.target.value })}
              />
              <Input
                placeholder="Email"
                value={r.email ?? ""}
                onChange={(e) => setRow(i, { email: e.target.value })}
              />
              <Button size="sm" variant="ghost" onClick={() => removeRow(i)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save Care Team"}
        </Button>
      </div>
    </Card>
  );
}
