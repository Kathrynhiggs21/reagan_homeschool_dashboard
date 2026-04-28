import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useState } from "react";

const CATS = ["all", "rescue", "outdoors", "art", "service", "wonder", "maker", "kitchen"];

export default function Adventures() {
  const [cat, setCat] = useState("all");
  const advs = trpc.adventures.list.useQuery();
  const fav = trpc.adventures.toggleFavorite.useMutation();
  const utils = trpc.useUtils();

  const list = (advs.data ?? []).filter((a: any) => cat === "all" || a.category === cat);

  return (
    <div className="space-y-6">
      <header className="chalkboard">
        <h1 className="font-chalk text-5xl leading-tight">Adventure Library</h1>
        <p className="font-chalk text-xl opacity-90 mt-1">Real-world things to do — weighted toward animals, creeks, art, and helping people you love.</p>
      </header>

      <div className="flex gap-2 flex-wrap">
        {CATS.map(c => (
          <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} className="rounded-full capitalize bg-card" onClick={() => setCat(c)}>{c}</Button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((a: any) => (
          <Card key={a.id} className="cozy-card p-4">
            <div className="flex justify-between items-start">
              <span className="text-2xl">{a.emoji || "🪶"}</span>
              <button onClick={() => fav.mutate({ id: a.id }, { onSuccess: () => utils.adventures.list.invalidate() })}>
                <Star className={`w-4 h-4 ${a.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              </button>
            </div>
            <h3 className="font-display font-semibold mt-2">{a.title}</h3>
            {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3">{a.category}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
