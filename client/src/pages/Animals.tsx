import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

export default function Animals() {
  const list = trpc.animals.list.useQuery();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">My Animals 🦜</h1>
        <p className="text-muted-foreground text-sm mt-1">Your crew. The world is better because you take care of them.</p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(list.data ?? []).map((a: any) => (
          <Card key={a.id} className="cozy-card p-4">
            <div className="text-3xl">{a.emoji || "🐾"}</div>
            <div className="font-display font-semibold mt-2">{a.name}</div>
            <div className="text-xs text-muted-foreground">{a.species}</div>
            {a.notes && <p className="text-sm mt-2">{a.notes}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
