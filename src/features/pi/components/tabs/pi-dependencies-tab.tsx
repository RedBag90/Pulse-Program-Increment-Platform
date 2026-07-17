import { Suspense } from "react";
import { DependencyGraph } from "@/features/pi/components/dependency-graph";
import { DependenciesListShell } from "@/features/dependencies/components/dependencies-list-shell";

interface Node {
  id: string;
  title: string;
  status: string;
  inPi: boolean;
}

interface Edge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
}

interface Props {
  piName: string;
  orphanCount: number;
  nodes: Node[];
  edges: Edge[];
  model: Parameters<typeof DependenciesListShell>[0]["model"];
  artId: string;
  canEdit: boolean;
}

/**
 * Dependencies-Tab — gleicher Inhalt wie heute `/pi/[piId]/dependencies/page.tsx`.
 */
export function PiDependenciesTab({
  piName,
  orphanCount,
  nodes,
  edges,
  model,
  artId,
  canEdit,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Abhängigkeiten — {piName}
        </h2>
        {orphanCount > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {orphanCount} Feature
            {orphanCount === 1 ? "" : "s"} im PI ohne Abhängigkeit.
          </p>
        )}
      </div>

      {nodes.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium hover:bg-muted/30">
            Graph anzeigen
          </summary>
          <div className="border-t p-4">
            <DependencyGraph nodes={nodes} edges={edges} />
          </div>
        </details>
      )}

      <Suspense fallback={null}>
        <DependenciesListShell model={model} artId={artId} canEdit={canEdit} />
      </Suspense>
    </div>
  );
}
