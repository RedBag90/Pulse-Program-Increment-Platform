"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { setFeaturePiAction } from "@/features/art/actions/feature";

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_review: "bg-blue-400",
  approved: "bg-emerald-400",
  in_progress: "bg-primary",
  blocked: "bg-red-400",
  done: "bg-emerald-500",
  completed: "bg-emerald-500",
  cancelled: "bg-muted-foreground/20",
};

const HIGHLIGHT = ["ring-2", "ring-primary", "ring-inset", "rounded-xl"] as const;

interface PlanningPi {
  id: string;
  name: string;
  status: string;
}

export interface PlanningFeature {
  id: string;
  title: string;
  status: string;
  wsjf: number;
  epicTitle: string | null;
  piId: string | null;
}

interface Props {
  artId: string;
  canEdit: boolean;
  features: PlanningFeature[];
  pis: PlanningPi[];
}

/** Rounds a WSJF sum to one decimal for the column-load badge. */
function roundWsjf(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * PI-Planning board — Backlog and the ART's PIs as side-by-side columns;
 * Feature cards drag between columns to (re)assign their PI. Mirrors the
 * portfolio Kanban board's HTML5 drag + `useOptimistic` pattern.
 */
export function FeaturePlanningBoard({ artId, canEdit, features: initial, pis }: Props) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [features, setOptimistic] = useOptimistic(
    initial,
    (current, { featureId, piId }: { featureId: string; piId: string | null }) =>
      current.map((f) => (f.id === featureId ? { ...f, piId } : f)),
  );

  const draggingId = useRef<string | null>(null);

  const columns: { piId: string | null; name: string; droppable: boolean }[] = [
    { piId: null, name: "Backlog", droppable: canEdit },
    ...pis.map((pi) => ({
      piId: pi.id,
      name: pi.name,
      droppable: canEdit && pi.status !== "completed",
    })),
  ];

  function moveFeature(featureId: string, toPiId: string | null) {
    startTransition(async () => {
      setOptimistic({ featureId, piId: toPiId });
      const res = await setFeaturePiAction([featureId], toPiId, artId);
      setError(res.error ?? null);
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-3 pb-4">
          {columns.map((col) => {
            const colFeatures = features.filter((f) => f.piId === col.piId);
            const wsjfSum = roundWsjf(colFeatures.reduce((s, f) => s + f.wsjf, 0));
            return (
              <div
                key={col.piId ?? "__backlog__"}
                className="w-64 flex-shrink-0"
                onDragOver={(e) => {
                  if (!col.droppable) return;
                  e.preventDefault();
                  e.currentTarget.classList.add(...HIGHLIGHT);
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove(...HIGHLIGHT)}
                onDrop={(e) => {
                  e.currentTarget.classList.remove(...HIGHLIGHT);
                  if (!col.droppable) return;
                  const featureId = draggingId.current;
                  draggingId.current = null;
                  if (!featureId) return;
                  const feature = features.find((f) => f.id === featureId);
                  if (feature && feature.piId !== col.piId) moveFeature(featureId, col.piId);
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {col.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {colFeatures.length} · Σ WSJF {wsjfSum}
                  </span>
                </div>

                <div className="min-h-24 space-y-2 rounded-xl bg-muted/40 p-2">
                  {colFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      draggable={canEdit}
                      onDragStart={(e) => {
                        draggingId.current = feature.id;
                        e.dataTransfer.effectAllowed = "move";
                        e.currentTarget.classList.add("opacity-50");
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.classList.remove("opacity-50");
                        draggingId.current = null;
                      }}
                      className={`space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
                        canEdit ? "cursor-grab active:cursor-grabbing" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                            STATUS_DOT[feature.status] ?? "bg-muted-foreground/40"
                          }`}
                        />
                        <Link
                          href={`/feature/${feature.id}`}
                          className="line-clamp-2 text-xs font-medium leading-snug hover:text-primary"
                        >
                          {feature.title}
                        </Link>
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-3.5">
                        {feature.epicTitle && (
                          <span className="truncate text-[10px] text-muted-foreground">
                            {feature.epicTitle}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-[10px] font-medium text-muted-foreground">
                          WSJF {roundWsjf(feature.wsjf)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {colFeatures.length === 0 && (
                    <div className="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-border/50">
                      <span className="text-[10px] text-muted-foreground/50">Leer</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
