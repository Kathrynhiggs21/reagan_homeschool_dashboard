import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * ParentFlagsBanner — appears on parent Analytics when adaptation engine v2
 * detects stacked struggle signals (e.g. 3 "Hard" rounds in a row on the same
 * skill). Reagan never sees this. Acknowledge to dismiss.
 */
export default function ParentFlagsBanner() {
  const flags = trpc.parentFlags.list.useQuery({ unacknowledgedOnly: true });
  const utils = trpc.useUtils();
  const ack = trpc.parentFlags.ack.useMutation({
    onSuccess: () => {
      toast.success("Got it — flag dismissed.");
      utils.parentFlags.list.invalidate();
    },
  });
  const items = (flags.data as any[]) || [];
  if (flags.isLoading || items.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-orange-500 bg-orange-50 mb-4">
      <div className="p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="font-semibold text-orange-900">
            🛎 Parent attention ({items.length})
          </div>
          <div className="text-xs text-orange-700">Reagan does not see this</div>
        </div>
        <div className="space-y-2">
          {items.map((f: any) => (
            <div key={f.id} className="flex items-start gap-3 bg-white border border-orange-200 rounded-md p-3">
              <div className="flex-1">
                <div className="font-medium text-orange-900 text-sm">{f.title}</div>
                {f.body && <div className="text-xs text-orange-800 mt-1">{f.body}</div>}
                <div className="text-[11px] text-orange-700 mt-1 flex gap-2">
                  <span className="uppercase font-semibold">{f.severity}</span>
                  {f.subjectSlug && <span>· {f.subjectSlug}</span>}
                  <span>· {new Date(f.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="bg-white text-orange-700 border-orange-300"
                disabled={ack.isPending}
                onClick={() => ack.mutate({ id: f.id })}>
                Acknowledge
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
