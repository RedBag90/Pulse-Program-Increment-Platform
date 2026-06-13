"use client";

import { useRef, useState, useTransition } from "react";
import { setFeaturePiAction, setFeatureDeliveryStatusAction } from "@/features/art/actions/feature";
import type {
  CockpitFeature,
  CockpitPiSlot,
  FeatureStatus,
} from "@/server/views/umsetzung-cockpit-view";
import { FeatureCard } from "./feature-card";

/**
 * Delivery-Board — 5 PI-Spalten × 4 Status-Lanes
 * (Bereit · In Umsetzung · Blockiert · Fertig). Drag horizontal terminiert
 * (PI-Wechsel), Drag vertikal aendert den Status. Beides gleichzeitig
 * (Diagonal-Drag) feuert beide Actions hintereinander.
 *
 * Optimistische Updates: die Karte springt sofort in das Ziel-Cell, der
 * Server-Roundtrip laeuft im Hintergrund; bei Fehler springt sie zurueck
 * und ein Toast zeigt die Begruendung.
 *
 * Cards ohne Drag-Permission sind nicht draggable — Drag-Affordances
 * sind aus, Cursor bleibt Pointer (Click oeffnet Slide-Over, P5).
 */
interface Props {
  pis: CockpitPiSlot[];
  features: CockpitFeature[];
  /** ART-Id wird fuer setFeaturePiAction gebraucht (Permission-Scope). */
  artId: string;
  canUpdate: boolean;
  canSetDelivery: boolean;
}

interface LaneDef {
  value: FeatureStatus;
  label: string;
  color: string;
}

const LANES: ReadonlyArray<LaneDef> = [
  { value: "approved", label: "Bereit", color: "bg-slate-50" },
  { value: "in_progress", label: "In Umsetzung", color: "bg-sky-50" },
  { value: "blocked", label: "Blockiert", color: "bg-amber-50" },
  { value: "completed", label: "Fertig", color: "bg-emerald-50" },
];

const HIGHLIGHT_DROP = ["ring-2", "ring-primary/60"];

export function CockpitBoard({ pis, features, artId, canUpdate, canSetDelivery }: Props) {
  const draggingId = useRef<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Optimistische Patches — pro Feature-Id ein Override fuer piId/status.
  const [optimistic, setOptimistic] = useState<
    Record<string, { piId?: string | null; status?: FeatureStatus }>
  >({});

  // Wende die Optimistik an, ohne die Server-Liste zu mutieren.
  const view = features.map((f) => {
    const o = optimistic[f.id];
    if (!o) return f;
    return {
      ...f,
      ...(o.piId !== undefined ? { piId: o.piId } : {}),
      ...(o.status !== undefined ? { status: o.status } : {}),
    };
  });

  function applyOptimistic(id: string, patch: { piId?: string | null; status?: FeatureStatus }) {
    setOptimistic((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function dropOnCell(targetPiId: string, targetStatus: FeatureStatus) {
    const id = draggingId.current;
    draggingId.current = null;
    if (!id) return;
    const feature = features.find((f) => f.id === id);
    if (!feature) return;

    const movePi = feature.piId !== targetPiId;
    const moveStatus = feature.status !== targetStatus;
    if (!movePi && !moveStatus) return;

    // Permission-Gate clientseitig — der eigentliche Check sitzt
    // serverseitig in den Actions, dies ist nur die Affordance.
    if (movePi && !canUpdate) return;
    if (moveStatus && !canSetDelivery) return;

    applyOptimistic(id, {
      ...(movePi ? { piId: targetPiId } : {}),
      ...(moveStatus ? { status: targetStatus } : {}),
    });

    startTransition(async () => {
      try {
        if (movePi) {
          const fd = new FormData();
          fd.append("featureIds", id);
          fd.set("piId", targetPiId);
          fd.set("artId", artId);
          const res = await setFeaturePiAction({}, fd);
          if (res.error) throw new Error(res.error);
        }
        if (moveStatus) {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("to", targetStatus);
          const res = await setFeatureDeliveryStatusAction({}, fd);
          if (res.error) throw new Error(res.error);
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
        // Rollback Optimistik
        setOptimistic((prev) => {
          const { [id]: _drop, ...rest } = prev;
          return rest;
        });
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Grid: 1 Label-Spalte links + N PI-Spalten. Status-Lanes sind
          die Zeilen. */}
      <div
        className="grid gap-2 overflow-x-auto pb-2"
        style={{
          gridTemplateColumns: `minmax(120px, 0.6fr) repeat(${pis.length}, minmax(180px, 1fr))`,
        }}
      >
        {/* Header-Zeile: leeres Eck + PI-Namen */}
        <div />
        {pis.map((p) => (
          <div
            key={p.id}
            className={`rounded-md border px-2 py-1 text-xs font-medium ${
              p.isCurrent ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span>{p.name}</span>
              <span className="text-[10px] text-muted-foreground">{p.featureCount}</span>
            </div>
          </div>
        ))}

        {/* Status-Lanes als Zeilen */}
        {LANES.map((lane) => (
          <LaneRow
            key={lane.value}
            lane={lane}
            pis={pis}
            view={view}
            canDrag={canUpdate || canSetDelivery}
            onDrop={dropOnCell}
            draggingId={draggingId}
          />
        ))}
      </div>
    </div>
  );
}

function LaneRow({
  lane,
  pis,
  view,
  canDrag,
  onDrop,
  draggingId,
}: {
  lane: LaneDef;
  pis: CockpitPiSlot[];
  view: CockpitFeature[];
  canDrag: boolean;
  onDrop: (piId: string, status: FeatureStatus) => void;
  draggingId: React.RefObject<string | null>;
}) {
  return (
    <>
      <div className="flex items-center pr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {lane.label}
      </div>
      {pis.map((p) => {
        const cell = view.filter((f) => f.piId === p.id && f.status === lane.value);
        return (
          <div
            key={`${p.id}:${lane.value}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add(...HIGHLIGHT_DROP);
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove(...HIGHLIGHT_DROP)}
            onDrop={(e) => {
              e.currentTarget.classList.remove(...HIGHLIGHT_DROP);
              onDrop(p.id, lane.value);
            }}
            className={`min-h-20 space-y-1.5 rounded-md p-1.5 transition-shadow ${lane.color}`}
          >
            {cell.length === 0 ? (
              <div className="grid h-16 place-items-center rounded border border-dashed border-border/40">
                <span className="text-[10px] text-muted-foreground/50">leer</span>
              </div>
            ) : (
              cell.map((f) => (
                <FeatureCard key={f.id} feature={f} canDrag={canDrag} draggingId={draggingId} />
              ))
            )}
          </div>
        );
      })}
    </>
  );
}
