"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import {
  setFeaturePiAction,
  setFeatureDeliveryStatusAction,
} from "@/modules/work/features/feature/actions/feature";
import {
  setFeaturePi,
  setFeatureDeliveryStatus,
} from "@/modules/work/features/feature/lib/feature-actions-client";
import type {
  CockpitFeature,
  CockpitPiSlot,
  FeatureStatus,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import {
  buildBoardMatrix,
  normalizePiKey,
  type BoardMatrix,
} from "@/modules/drumbeat/domain/board-matrix";
import { FEATURE_STATUS_LABELS } from "@/modules/drumbeat/domain/status";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { FeatureCard } from "./feature-card";

interface OptimisticPatch {
  id: string;
  piId?: string | null;
  status?: FeatureStatus;
}

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
  // Lane-Tint spiegelt den kanonischen Status-Hue (wie FEATURE_STATUS_DOT / Badges).
  { value: "approved", label: FEATURE_STATUS_LABELS.approved, color: "bg-indigo-50" },
  { value: "in_progress", label: FEATURE_STATUS_LABELS.in_progress, color: "bg-amber-50" },
  { value: "blocked", label: FEATURE_STATUS_LABELS.blocked, color: "bg-red-50" },
  { value: "completed", label: FEATURE_STATUS_LABELS.completed, color: "bg-emerald-50" },
];

const HIGHLIGHT_DROP = ["ring-2", "ring-primary/60"];

export function CockpitBoard({ pis, features, artId, canUpdate, canSetDelivery }: Props) {
  const draggingId = useRef<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Optimistic-Layer via React 19. Patches greifen waehrend der Transition;
  // schlaegt der Server-Call fehl, faellt React automatisch auf `features`
  // zurueck — kein manueller Rollback noetig.
  const [view, addOptimisticPatch] = useOptimistic<CockpitFeature[], OptimisticPatch>(
    features,
    (current, patch) =>
      current.map((f) =>
        f.id === patch.id
          ? {
              ...f,
              ...(patch.piId !== undefined ? { piId: patch.piId } : {}),
              ...(patch.status !== undefined ? { status: patch.status } : {}),
            }
          : f,
      ),
  );

  // PI × Status-Lane-Matrix — synthetische Backlog-Spalte, `null ↔ ""`-
  // Normalisierung und Zell-Bucketing gehoeren dem reinen `buildBoardMatrix`.
  // Muss clientseitig neu gerechnet werden, weil `view` optimistisch mutiert.
  const matrix = buildBoardMatrix(view, pis, LANES);
  const columns = matrix.columns;

  // Ausstehender Drop, der nach Blockiert/Verworfen führt und auf einen
  // Pflicht-Grund wartet (Governance-Gate, konsistent zum Feature-Detail).
  const [blockPrompt, setBlockPrompt] = useState<{
    id: string;
    targetPiId: string;
    movePi: boolean;
    targetStatus: FeatureStatus;
  } | null>(null);
  const [reason, setReason] = useState("");

  function performDrop(
    ctx: {
      id: string;
      targetPiId: string;
      movePi: boolean;
      moveStatus: boolean;
      targetStatus: FeatureStatus;
    },
    reason?: string,
  ) {
    startTransition(async () => {
      // Optimistic-Patch innerhalb der Transition — React reverted automatisch,
      // wenn der Server-Roundtrip fehlschlaegt oder die Liste sich aendert.
      addOptimisticPatch({
        id: ctx.id,
        ...(ctx.movePi ? { piId: ctx.targetPiId } : {}),
        ...(ctx.moveStatus ? { status: ctx.targetStatus } : {}),
      });

      try {
        if (ctx.movePi) {
          const res = await setFeaturePi(setFeaturePiAction, {
            featureIds: [ctx.id],
            piId: ctx.targetPiId,
            artId,
          });
          if (res.error) throw new Error(res.error);
        }
        if (ctx.moveStatus) {
          const res = await setFeatureDeliveryStatus(setFeatureDeliveryStatusAction, {
            id: ctx.id,
            to: ctx.targetStatus,
            ...(reason ? { reason } : {}),
          });
          if (res.error) throw new Error(res.error);
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
      }
    });
  }

  function dropOnCell(targetPiId: string, targetStatus: FeatureStatus) {
    const id = draggingId.current;
    draggingId.current = null;
    if (!id) return;
    const feature = features.find((f) => f.id === id);
    if (!feature) return;

    // Normalisiere `null` ↔ "" damit Backlog-Spalte als Drop-Ziel erkannt wird.
    const currentPiKey = normalizePiKey(feature.piId);
    const movePi = currentPiKey !== targetPiId;
    const moveStatus = feature.status !== targetStatus;
    if (!movePi && !moveStatus) return;

    // Permission-Gate clientseitig — der eigentliche Check sitzt
    // serverseitig in den Actions, dies ist nur die Affordance.
    if (movePi && !canUpdate) return;
    if (moveStatus && !canSetDelivery) return;

    // Governance-Gate: Wechsel nach Blockiert/Verworfen braucht einen Grund —
    // dieselbe Regel wie im Detail. Statt sofort zu committen, öffnet der Drop
    // den Grund-Dialog; erst nach Bestätigung läuft die Transition.
    if (moveStatus && (targetStatus === "blocked" || targetStatus === "cancelled")) {
      setReason("");
      setBlockPrompt({ id, targetPiId, movePi, targetStatus });
      return;
    }

    performDrop({ id, targetPiId, movePi, moveStatus, targetStatus });
  }

  // Tastatur-Alternative zum Drag: einachsiger Move (PI ODER Status) aus dem
  // Karten-Menü. Geht durch dasselbe Governance-Gate (Grund-Dialog bei
  // Blockiert/Verworfen) und dieselbe optimistische Transition wie der Drop.
  function moveFeature(id: string, target: { targetPiId?: string; targetStatus?: FeatureStatus }) {
    const feature = features.find((f) => f.id === id);
    if (!feature) return;
    const movePi =
      target.targetPiId !== undefined && normalizePiKey(feature.piId) !== target.targetPiId;
    const moveStatus = target.targetStatus !== undefined && feature.status !== target.targetStatus;
    if (!movePi && !moveStatus) return;
    if (movePi && !canUpdate) return;
    if (moveStatus && !canSetDelivery) return;

    const targetPiId = target.targetPiId ?? normalizePiKey(feature.piId);
    const targetStatus = target.targetStatus ?? feature.status;

    if (moveStatus && (targetStatus === "blocked" || targetStatus === "cancelled")) {
      setReason("");
      setBlockPrompt({ id, targetPiId, movePi, targetStatus });
      return;
    }
    performDrop({ id, targetPiId, movePi, moveStatus, targetStatus });
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Grid: 1 Label-Spalte + Backlog-Spalte + N PI-Spalten. Status-Lanes
          sind die Zeilen. */}
      <div
        className="grid gap-2 overflow-x-auto pb-2"
        style={{
          gridTemplateColumns: `minmax(120px, 0.6fr) repeat(${columns.length}, minmax(180px, 1fr))`,
        }}
      >
        {/* Header-Zeile: leeres Eck + Spalten-Namen */}
        <div />
        {columns.map((p) => {
          const isBacklog = p.id === "";
          return (
            <div
              key={p.id || "__backlog__"}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                isBacklog
                  ? "border-dashed border-border bg-muted/30 text-muted-foreground"
                  : p.isCurrent
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span>{p.name}</span>
                <span className="text-[10px] text-muted-foreground">{p.featureCount}</span>
              </div>
            </div>
          );
        })}

        {/* Status-Lanes als Zeilen */}
        {LANES.map((lane) => (
          <LaneRow
            key={lane.value}
            lane={lane}
            pis={columns}
            matrix={matrix}
            canDrag={canUpdate || canSetDelivery}
            onDrop={dropOnCell}
            onMove={moveFeature}
            draggingId={draggingId}
          />
        ))}
      </div>

      <Dialog
        open={blockPrompt != null}
        onOpenChange={(o) => {
          if (!o) setBlockPrompt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grund erforderlich</DialogTitle>
            <DialogDescription>
              Ein Wechsel nach „{blockPrompt ? FEATURE_STATUS_LABELS[blockPrompt.targetStatus] : ""}
              " braucht einen Grund — wie im Feature-Detail.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Warum wird das Feature blockiert bzw. verworfen?"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBlockPrompt(null)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={reason.trim() === ""}
              onClick={() => {
                if (!blockPrompt) return;
                performDrop({ ...blockPrompt, moveStatus: true }, reason.trim());
                setBlockPrompt(null);
              }}
            >
              {blockPrompt?.targetStatus === "cancelled" ? "Verwerfen" : "Blockieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LaneRow({
  lane,
  pis,
  matrix,
  canDrag,
  onDrop,
  onMove,
  draggingId,
}: {
  lane: LaneDef;
  pis: CockpitPiSlot[];
  matrix: BoardMatrix;
  canDrag: boolean;
  onDrop: (piId: string, status: FeatureStatus) => void;
  onMove: (id: string, target: { targetPiId?: string; targetStatus?: FeatureStatus }) => void;
  draggingId: React.RefObject<string | null>;
}) {
  return (
    <>
      <div className="flex items-center pr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {lane.label}
      </div>
      {pis.map((p) => {
        const cell = matrix.cell(p.id, lane.value);
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
                <div key={f.id} className="group/card relative">
                  <FeatureCard feature={f} canDrag={canDrag} draggingId={draggingId} />
                  {canDrag && (
                    <FeatureMoveMenu feature={f} pis={pis} lanes={LANES} onMove={onMove} />
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}
    </>
  );
}

/**
 * Tastatur-/Maus-Menü auf der Karte — die a11y-Alternative zum Drag. „In PI"
 * terminiert, „Status setzen" ändert den Delivery-Status; beides läuft durch
 * `onMove` (dasselbe Governance-Gate wie der Drop). Sichtbar bei Hover/Fokus.
 */
function FeatureMoveMenu({
  feature,
  pis,
  lanes,
  onMove,
}: {
  feature: CockpitFeature;
  pis: CockpitPiSlot[];
  lanes: ReadonlyArray<LaneDef>;
  onMove: (id: string, target: { targetPiId?: string; targetStatus?: FeatureStatus }) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${feature.title} verschieben`}
        className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/card:opacity-100"
      >
        <MoreVertical className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Verschieben</div>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>In PI</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {pis.map((p) => (
              <DropdownMenuItem
                key={p.id || "__backlog__"}
                onClick={() => onMove(feature.id, { targetPiId: p.id })}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Status setzen</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {lanes.map((l) => (
              <DropdownMenuItem
                key={l.value}
                onClick={() => onMove(feature.id, { targetStatus: l.value })}
              >
                {l.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
