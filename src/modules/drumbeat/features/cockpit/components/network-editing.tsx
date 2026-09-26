"use client";

import { useTranslations } from "next-intl";
import { createContext, memo, useContext, useState, type ReactNode } from "react";
import { Download, Plus } from "lucide-react";
import { toPng } from "html-to-image";
import {
  EdgeLabelRenderer,
  MarkerType,
  getNodesBounds,
  getSmoothStepPath,
  getViewportForBounds,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { toast } from "sonner";
import {
  FEATURE_TYPES,
  FEATURE_TYPE_KEYS,
  type FeatureType,
} from "@/modules/work/domain/portfolio-guardrails";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  EDGE_LABEL,
  EdgeTypePopover,
} from "@/modules/drumbeat/features/dependencies/components/edge-type-popover";
import type { DependencyEdgeType } from "@/modules/drumbeat/features/dependencies/lib/dependency-actions-client";
import { useEdgePath } from "@/modules/drumbeat/features/cockpit/components/network-shared";
import { EDGE_COLOR } from "@/modules/drumbeat/features/cockpit/components/graph-palette";

/**
 * **Das Bearbeiten im Netzplan** — die Stücke, die bis September 2026 nur der
 * Epic-Netzplan hatte (`breakdown-network-view.tsx`): Folge-Feature am
 * Knoten, Feature zwischen zwei Knoten, Typwechsel und Löschen am Kantenlabel,
 * PNG-Export. Jetzt tragen beide Netzpläne sie, über `DependencyNetwork`.
 */

export type QuickAddInput = { title: string; featureType: FeatureType };

/**
 * Die Rückrufe an einer Stelle, identitätsstabil — Knoten und Kanten lesen
 * sie per Context statt aus `data`, damit `memo` greift.
 */
export interface NetworkEditing {
  onAddSuccessor: (featureId: string, input: QuickAddInput) => void;
  onInsertOnEdge: (depId: string, input: QuickAddInput) => void;
  onChangeEdgeType: (depId: string, next: DependencyEdgeType) => void;
  onDeleteEdge: (depId: string) => void;
}

export const NetworkEditingContext = createContext<NetworkEditing | null>(null);

/** Was eine Kante über sich weiss — in `edge.data`. */
export interface DependencyEdgeData extends Record<string, unknown> {
  type: DependencyEdgeType;
  /** Läuft gegen die Zeit (nur in der Zeitachse) — rot und beschriftet. */
  backwards: boolean;
  /** `dependency.link` und eine gespeicherte Kante (keine `tmp-`). */
  canChangeType: boolean;
  /** `feature.create`, beide Enden im Bild, die Quelle hängt an einem Epic. */
  canInsert: boolean;
  bracketDepth?: number;
}

/**
 * **Wie eine Kante aussieht** — eine Stelle für das Layout und für die
 * optimistische Änderung des Typs.
 */
export function edgeVisual(type: DependencyEdgeType, backwards: boolean) {
  const farbe = backwards ? "var(--destructive)" : EDGE_COLOR[type];
  return {
    animated: type === "blocks",
    style: {
      stroke: farbe,
      strokeWidth: backwards ? 2.5 : 1.5,
      strokeDasharray: type === "relates_to" ? "4 4" : undefined,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color: farbe },
  };
}

function QuickAddForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (input: QuickAddInput) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [title, setTitle] = useState("");
  const [featureType, setFeatureType] = useState<FeatureType>("feature");

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim().length === 0) return;
        onSubmit({ title: title.trim(), featureType });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="quick-add-title" className="text-xs">
          {t("drumbeat.ui.titel")}
        </Label>
        <Input
          id="quick-add-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          maxLength={200}
          placeholder={t("drumbeat.ui.zBAuthRefresh")}
          className="h-8"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="quick-add-type" className="text-xs">
          {t("drumbeat.ui.typ")}
        </Label>
        <select
          id="quick-add-type"
          value={featureType}
          onChange={(e) => setFeatureType(e.target.value as FeatureType)}
          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          {FEATURE_TYPES.map((wert) => (
            <option key={wert} value={wert}>
              {t(FEATURE_TYPE_KEYS[wert] ?? wert)}
            </option>
          ))}
        </select>
      </div>
      <p className="text-label text-muted-foreground">{t("drumbeat.ui.wsjfWirdAufVorbelegt")}</p>
      <div className="flex justify-end gap-1.5 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("drumbeat.ui.abbrechen")}
        </Button>
        <Button type="submit" size="sm" disabled={title.trim().length === 0}>
          {t("drumbeat.ui.anlegen")}
        </Button>
      </div>
    </form>
  );
}

function QuickAddPopover({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: (input: QuickAddInput) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent side="bottom" align="center" className="w-80">
        <QuickAddForm
          onSubmit={(input) => {
            onSubmit(input);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

const PLUS_KNOPF =
  "nodrag nopan flex size-5 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground";

/** „+" rechts am Knoten — ein Folge-Feature, das von diesem blockiert wird. */
export function NodeAddPlusButton({ featureId }: { featureId: string }) {
  const t = useTranslations();
  const editing = useContext(NetworkEditingContext);
  if (!editing) return null;
  return (
    <div className="absolute -right-7 top-1/2 -translate-y-1/2">
      <QuickAddPopover onSubmit={(input) => editing.onAddSuccessor(featureId, input)}>
        <button
          type="button"
          aria-label={t("drumbeat.ui.folgeFeatureAnlegen")}
          className={PLUS_KNOPF}
        >
          <Plus className="size-3" />
        </button>
      </QuickAddPopover>
    </div>
  );
}

/**
 * **Die Kante des Netzplans** — die Brücken und die rote „rückwärts"-Kante
 * der Umsetzung, dazu das Label des Epic-Netzplans: beim Überfahren der Typ
 * (anklickbar: wechseln oder löschen) und „+" für ein Feature dazwischen.
 *
 * Die Pfadrechnung ist dieselbe wie in `useEdgePaths`; findet die Kante dort
 * keine Fassung mit Brücken, zeichnet sie ihre eigene.
 */
export const DependencyEdge = memo(function DependencyEdge(props: EdgeProps) {
  const t = useTranslations();
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const data = props.data as DependencyEdgeData | undefined;
  const type = data?.type ?? "blocks";
  const [eigener, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    offset: 32,
    borderRadius: 16,
  });
  const d = useEdgePath(id) ?? eigener;
  const editing = useContext(NetworkEditingContext);
  const [hovered, setHovered] = useState(false);
  const zeigen = hovered || props.selected === true;
  const canChangeType = editing != null && data?.canChangeType === true;
  const canInsert = editing != null && data?.canInsert === true;

  return (
    <>
      <path
        id={id}
        d={d}
        style={props.style}
        className="react-flow__edge-path"
        {...(props.markerEnd != null ? { markerEnd: props.markerEnd } : {})}
        fill="none"
      />
      {/* Unsichtbare Trefferfläche: das Überfahren gilt der Linie, nicht ihrem Rahmen. */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        style={{ cursor: "pointer", pointerEvents: "stroke" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute flex items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: zeigen ? "all" : "none",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {data?.backwards && !zeigen && (
            <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-label font-medium text-destructive">
              {t("drumbeat.ui.rueckwaerts")}
            </span>
          )}
          {zeigen &&
            (canChangeType ? (
              <EdgeTypePopover
                currentType={type}
                onChange={(next) => editing.onChangeEdgeType(id, next)}
                onDelete={() => editing.onDeleteEdge(id)}
              >
                <button
                  type="button"
                  aria-label={t("drumbeat.ui.abhaengigkeitstypAendern")}
                  className="rounded-sm bg-card px-1 text-label transition-colors hover:bg-muted"
                  style={{ color: EDGE_COLOR[type] }}
                >
                  {t(EDGE_LABEL[type])}
                </button>
              </EdgeTypePopover>
            ) : (
              <span
                className="rounded-sm bg-card px-1 text-label"
                style={{ color: EDGE_COLOR[type] }}
              >
                {t(EDGE_LABEL[type])}
              </span>
            ))}
          {zeigen && canInsert && (
            <QuickAddPopover onSubmit={(input) => editing.onInsertOnEdge(id, input)}>
              <button
                type="button"
                aria-label={t("drumbeat.ui.featureZwischenfuegen")}
                className={PLUS_KNOPF}
              >
                <Plus className="size-3" />
              </button>
            </QuickAddPopover>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

/**
 * **Der Netzplan als PNG** — die ganze Leinwand in 1600 × 900, unabhängig von
 * Verschiebung und Zoom. Braucht `useReactFlow`, sitzt also **in** `<ReactFlow>`
 * (als `<Panel>`).
 */
export function ExportButton({ name }: { name: string }) {
  const t = useTranslations();
  const { getNodes } = useReactFlow();
  const onExport = async () => {
    const nodes = getNodes();
    const viewportEl = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (nodes.length === 0 || !viewportEl) {
      toast.error(t("drumbeat.ui.exportFehlgeschlagen"));
      return;
    }
    const WIDTH = 1600;
    const HEIGHT = 900;
    const vp = getViewportForBounds(getNodesBounds(nodes), WIDTH, HEIGHT, 0.1, 2, 0.1);
    try {
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
        width: WIDTH,
        height: HEIGHT,
        pixelRatio: 2,
        style: {
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        },
      });
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      const link = document.createElement("a");
      link.download = `netzplan-${slug || "export"}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error(t("drumbeat.ui.exportFehlgeschlagen"));
    }
  };

  return (
    <button
      type="button"
      onClick={onExport}
      title={t("drumbeat.ui.netzplanAlsPngExportieren")}
      aria-label={t("drumbeat.ui.netzplanExportieren")}
      className="flex items-center gap-1 rounded-md bg-card px-2 py-1 text-meta shadow-card transition hover:bg-muted"
    >
      <Download className="size-3.5" />
      <span>{t("drumbeat.ui.exportPng")}</span>
    </button>
  );
}
