"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { setFeaturePiAction } from "@/features/art/actions/feature";
import { Lock } from "lucide-react";
import { PiCapacityHeader } from "./pi-capacity-header";
import type { PiCapacityOverlay, FeatureBlockerOverlay } from "@/server/views/pi-planning";

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
  /** Per-PI capacity / demand overlay; missing entries hide the badge for that column. */
  capacity: Record<string, PiCapacityOverlay>;
  /** Per-Feature blocker overlay; missing entries mean "no upstream blockers". */
  blockers: Record<string, FeatureBlockerOverlay>;
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
export function FeaturePlanningBoard({
  artId,
  canEdit,
  features: initial,
  pis,
  capacity,
  blockers,
}: Props) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Non-fatal advisories from setFeaturePi (e.g. Soll-Fenster-Verletzung).
  // Surfaced as a dismissable amber banner so the planner sees the consequence
  // of the drop without being blocked by it.
  const [warnings, setWarnings] = useState<string[]>([]);
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
      setWarnings(res.warnings ?? []);
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {warnings.length > 0 && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <ul className="space-y-0.5 text-xs text-amber-900">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setWarnings([])}
            className="text-xs font-medium text-amber-900 hover:underline"
          >
            Schließen
          </button>
        </div>
      )}

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
                <div className="mb-2 space-y-1 px-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {col.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {colFeatures.length} · Σ WSJF {wsjfSum}
                    </span>
                  </div>
                  {col.piId && (
                    <PiCapacityHeader
                      piId={col.piId}
                      artId={artId}
                      overlay={capacity[col.piId] ?? null}
                      canEdit={canEdit}
                    />
                  )}
                </div>

                <div className="min-h-24 space-y-2 rounded-xl bg-muted/40 p-2">
                  {colFeatures.map((feature) => {
                    const blocker = blockers[feature.id];
                    return (
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
                        className={`space-y-2 rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
                          blocker?.violates
                            ? "border-amber-300 ring-1 ring-amber-300"
                            : "border-border"
                        } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
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
                        {blocker && (blocker.violates || feature.piId === null) && (
                          <BlockerChip
                            violates={blocker.violates}
                            earliestPiName={blocker.earliestPiName}
                            earliestStart={blocker.earliestStart}
                            scheduledBlockerTitles={blocker.scheduledBlockerTitles}
                            unscheduledBlockerTitles={blocker.unscheduledBlockerTitles}
                          />
                        )}
                      </div>
                    );
                  })}
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

/**
 * Per-Feature inline chip: violation flag (amber, with earliest-PI hint) for a
 * Feature whose current PI starts before its upstream blockers end, or — for
 * Backlog cards — a hint indicating where the Feature could earliest land.
 */
function BlockerChip({
  violates,
  earliestPiName,
  earliestStart,
  scheduledBlockerTitles,
  unscheduledBlockerTitles,
}: {
  violates: boolean;
  earliestPiName: string | null;
  earliestStart: Date | null;
  scheduledBlockerTitles: string[];
  unscheduledBlockerTitles: string[];
}) {
  const hint = [
    ...scheduledBlockerTitles.map((t) => `wegen ${t}`),
    ...unscheduledBlockerTitles.map((t) => `${t} (noch ungeplant)`),
  ].join(" · ");
  const label = earliestPiName
    ? `Frühestens ${earliestPiName}`
    : earliestStart
      ? `Frühestens ${earliestStart.toISOString().slice(0, 10)}`
      : "Blocker noch ungeplant";
  return (
    <div
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
        violates
          ? "border border-amber-300 bg-amber-50 text-amber-900"
          : "bg-muted text-muted-foreground"
      }`}
      title={hint}
    >
      <Lock className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}
