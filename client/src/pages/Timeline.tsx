import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

export default function Timeline() {
  const events = trpc.timeline.list.useQuery();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">My Timeline ✨</h1>
        <p className="text-muted-foreground text-sm mt-1">Look how much you've grown.</p>
      </header>
      <div className="space-y-3">
        {(events.data ?? []).map((e: any) => (
          <Card key={e.id} className="cozy-card p-4 flex gap-3">
            <span className="text-2xl">{e.emoji || "🪶"}</span>
            <div className="flex-1">
              <div className="font-display font-semibold">{e.title}</div>
              {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
              <div className="text-xs text-muted-foreground mt-1">{new Date(e.eventDate || e.createdAt).toLocaleDateString()}</div>
            </div>
          </Card>
        ))}
        {events.data?.length === 0 && (
          <Card className="cozy-card p-6 text-center text-muted-foreground">
            <div className="text-4xl mb-2">✨</div>
            <p className="font-hand text-lg">Your story starts here.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
