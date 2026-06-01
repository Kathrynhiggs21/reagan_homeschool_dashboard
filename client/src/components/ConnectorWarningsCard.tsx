/**
 * ConnectorWarningsCard (v3.27, 2026-05-31)
 * =========================================
 *
 * Surfaces `drive.connector.warnings.untitledLeak.*` rows from
 * `app_settings` in the admin Settings page. Each row represents one
 * time the v3.26 detector caught a 0-byte "Untitled" Drive file
 * created by the bug class where `gws drive files create` silently
 * dropped the folder body wrapper. The detector stamps these warnings
 * inside `applyConnectorReport`; this card lets you see and dismiss
 * them without dropping into SQL.
 *
 * Admin-only — short-circuits to a stub for non-admin viewers since
 * the backing procedures are `adminProcedure`.
 *
 * Empty state ("No warnings") is the happy path; if the card shows
 * zero rows for weeks at a time that's exactly what we want.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

function fmtISO(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ConnectorWarningsCard() {
  const auth = useAuth?.();
  const isAdmin = (auth as any)?.user?.role === "admin";

  const listQ = (trpc as any).drive?.listConnectorWarnings?.useQuery?.(
    undefined,
    { enabled: !!isAdmin, refetchInterval: 60_000 },
  );

  const utils = (trpc as any).useUtils?.();
  const dismissM = (trpc as any).drive?.clearConnectorWarning?.useMutation?.({
    onSuccess: async () => {
      toast.success("Warning dismissed");
      await utils?.drive?.listConnectorWarnings?.invalidate?.();
    },
    onError: (e: { message?: string }) => {
      toast.error(`Dismiss failed: ${e?.message ?? "unknown error"}`);
    },
  });

  const [dismissingKey, setDismissingKey] = useState<string | null>(null);

  if (!isAdmin) return null;

  const data = listQ?.data;
  const warnings: Array<{
    key: string;
    queueId: number | null;
    driveFileId: string | null;
    driveFileName: string | null;
    targetFolder: string | null;
    status: string | null;
    atISO: string | null;
  }> = data?.warnings ?? [];
  const total: number = data?.total ?? 0;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Drive Connector — Untitled-leak warnings</span>
          {total > 0 ? (
            <Badge variant="destructive" className="ml-1">
              {total}
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-1">
              0
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {listQ?.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading warnings…</p>
        ) : warnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active warnings. The v3.26 Untitled-leak detector hasn't seen any
            0-byte unnamed Drive files created at root since the last drainer
            run. This is the desired steady state.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Queue ID</th>
                  <th className="py-2 pr-3">Drive File</th>
                  <th className="py-2 pr-3">Target folder</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((w) => (
                  <tr key={w.key} className="border-b last:border-0">
                    <td className="py-2 pr-3 align-top">{fmtISO(w.atISO)}</td>
                    <td className="py-2 pr-3 align-top">{w.queueId ?? "—"}</td>
                    <td className="py-2 pr-3 align-top">
                      {w.driveFileId ? (
                        <a
                          className="underline"
                          href={`https://drive.google.com/file/d/${w.driveFileId}/view`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {w.driveFileName ?? "Untitled"}
                        </a>
                      ) : (
                        <span>{w.driveFileName ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 align-top">
                      {w.targetFolder ?? "—"}
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <Badge variant="outline">{w.status ?? "—"}</Badge>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={dismissingKey === w.key || dismissM?.isPending}
                        onClick={() => {
                          setDismissingKey(w.key);
                          dismissM
                            ?.mutateAsync?.({ key: w.key })
                            .finally(() => setDismissingKey(null));
                        }}
                      >
                        Dismiss
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
