import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

export default function Apps() {
  const apps = trpc.appLinks.list.useQuery();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Apps & Tools 🎨</h1>
        <p className="text-muted-foreground text-sm mt-1">Quick links to the apps you use.</p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {apps.data?.map((a: any) => (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
            <Card className="cozy-card p-4 hover:scale-[1.02] transition-transform">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{a.emoji || "✨"}</span>
                <div>
                  <div className="font-display font-semibold">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.category}</div>
                </div>
              </div>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
