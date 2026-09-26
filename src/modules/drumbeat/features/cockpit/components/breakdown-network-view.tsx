"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, LayoutGrid, Network, Pencil, Plus } from "lucide-react";
import { toPng } from "html-to-image";
import {
  ReactFlow,
  Background,
  Controls,
  EdgeLabelRenderer,
  MiniMap,
  Panel,
  Position,
  addEdge,
  getNodesBounds,
  getSmoothStepPath,
  getViewportForBounds,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { detectCycle } from "@/modules/core/kernel/domain/dependency-graph";
import {
  FEATURE_TYPES,
  FEATURE_TYPE_KEYS,
  isFeatureType,
  type FeatureType,
} from "@/modules/work/domain/portfolio-guardrails";
import { formatWsjf } from "@/modules/core/kernel/domain/wsjf";
import {
  FEATURE_TYPE_BADGE,
  FEATURE_TYPE_MINIMAP,
  normalizeFeatureType,
} from "@/modules/drumbeat/features/lib/feature-type-tokens";
import { CreateFeatureDialog } from "@/modules/work/features/feature/components/create-feature-dialog";
import {
  linkDependencyAction,
  unlinkDependencyAction,
  relinkDependencyAction,
  changeDependencyTypeAction,
} from "@/modules/drumbeat/features/dependencies/actions/dependency";
import {
  linkDependency,
  unlinkDependency,
  relinkDependency,
  changeDependencyType,
} from "@/modules/drumbeat/features/dependencies/lib/dependency-actions-client";
import { updateFeatureAction } from "@/modules/work/features/feature/actions/feature";
import { saveBreakdownLayoutAction } from "@/modules/work/features/portfolio/actions/breakdown-layout";
import { useBreakdownRealtime } from "@/modules/work/features/portfolio/hooks/use-breakdown-realtime";

import {
  BracketTargetRow,
  EdgePathContext,
  HandleRow,
  useEdgePaths,
  useFocusDimming,
  useLiveHandles,
} from "@/modules/drumbeat/features/cockpit/components/network-shared";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { clearBreakdownLayoutAction } from "@/modules/work/features/portfolio/actions/breakdown-layout";
import { mergeOptimisticEdges } from "@/modules/drumbeat/features/cockpit/lib/optimistic-edges";
import { WsjfScoreDialog } from "@/modules/work/features/feature/components/wsjf-score-dialog";
import {
  quickAddFeatureWithDependencyAction,
  insertFeatureBetweenAction,
} from "@/modules/work/features/portfolio/actions/breakdown-network";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EdgeTypePopover } from "@/modules/drumbeat/features/dependencies/components/edge-type-popover";
import {
  buildBreakdownGraph,
  type BreakdownGhostNode,
  type BreakdownGraphNode,
  type DependencyEdgeType,
} from "@/modules/drumbeat/server/views/breakdown-network-view";
import {
  EDGE_COLOR,
  STATUS_DOT_BREAKDOWN as STATUS_DOT,
} from "@/modules/drumbeat/features/cockpit/components/graph-palette";
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  EDGE_LABEL,
  edgeStyle,
  layoutGraph,
  layoutByPi,
  type LayoutCtx,
  type FeatureNodeData,
  type InsertableEdgeData,
} from "@/modules/drumbeat/features/cockpit/components/breakdown-layout";

interface Props {
  epicId: string;
  /** Tenant-Id — fuer den Realtime-Channel (Roadmap-P8). */
  tenantId: string;
  /** Epic-Titel — wird in der Empty-State-CTA als Parent-Epic-Label genutzt. */
  epicTitle: string;
  /** Wertstrom des Epics — begrenzt die ART-Auswahl beim Anlegen eines Features. */
  epicValueStreamId: string | null;
  features: ReadonlyArray<{
    id: string;
    title: string;
    status: string;
    artId: string;
    artName: string;
    featureType: string | null;
    wsjfComputed: number | null;
    wsjfBusinessValue: number | null;
    wsjfTimeCriticality: number | null;
    wsjfRiskReduction: number | null;
    wsjfJobSize: number | null;
    /** PI-Zuordnung. null = Backlog. Treibt den PI-Mode-Layout (P9). */
    piId: string | null;
  }>;
  /** Distinkte PIs aus dem Scope dieses Epics, sortiert nach startDate
   *  aufsteigend. Treibt die Spalten im PI-Bahnen-Mode (Roadmap-P9). */
  pis: ReadonlyArray<{ id: string; name: string; startDate: string }>;
  dependencies: ReadonlyArray<{
    id: string;
    fromId: string;
    toId: string;
    type: string;
    from?: { id: string; title: string; parent: { id: string; title: string } | null } | null;
    to?: { id: string; title: string; parent: { id: string; title: string } | null } | null;
  }>;
  canLinkDependency: boolean;
  /** Wenn `true`, sind die Plus-Buttons am Node + Edge sichtbar (N3). */
  canCreateFeature: boolean;
  /** Persistierte Node-Positionen (Roadmap-P5). Knoten ohne Eintrag
   *  fallen auf dagre-Auto-Layout zurueck. */
  savedPositions?: Record<string, { x: number; y: number }>;
}

const TIER_BADGE: Record<BreakdownGraphNode["wsjfTier"], string> = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
  unscored: "bg-muted text-muted-foreground",
};

type QuickAddSubmit = (input: { title: string; featureType: FeatureType }) => void;
type QuickEditSubmit = (input: { title: string; featureType: FeatureType | "" }) => void;

type EdgeTypeChange = (next: DependencyEdgeType) => void;

interface BreakdownInteractionCtx {
  onAddSuccessor: (predecessorId: string, predecessorArtId: string) => QuickAddSubmit;
  onEditFeature: (featureId: string, featureArtId: string) => QuickEditSubmit;
  onInsertOnEdge: (
    fromId: string,
    toId: string,
    edgeType: DependencyEdgeType,
    sourceArtId: string,
  ) => QuickAddSubmit;
  onChangeEdgeType: (
    fromId: string,
    toId: string,
    currentType: DependencyEdgeType,
    sourceArtId: string,
  ) => EdgeTypeChange;
  onDeleteEdge: (
    fromId: string,
    toId: string,
    edgeType: DependencyEdgeType,
    sourceArtId: string,
  ) => () => void;
}

const BreakdownInteractionContext = createContext<BreakdownInteractionCtx | null>(null);

/**
 * **Eine Stelle besitzt die Geometrie.**
 *
 * Für Leitungsbrücken muss jemand *alle* Linien kennen — eine Kante allein
 * kann nicht wissen, ob sie eine andere kreuzt. Bisher rechnete jede ihre
 * eigene und keine wusste von den anderen.
 *
 * Hier liegt die fertige Linie je Kante. Wer nichts findet, zeichnet seine
 * eigene: die Brücken sind eine Zugabe, keine Voraussetzung.
 */

function useBreakdownInteraction(): BreakdownInteractionCtx {
  const ctx = useContext(BreakdownInteractionContext);
  if (!ctx) throw new Error("BreakdownInteractionContext nicht verfuegbar");
  return ctx;
}

function QuickAddForm({
  defaultTitle,
  onSubmit,
  onClose,
  busy,
}: {
  defaultTitle?: string;
  onSubmit: (input: { title: string; featureType: FeatureType }) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const t = useTranslations();
  const [title, setTitle] = useState(defaultTitle ?? "");
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
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          {t("drumbeat.ui.abbrechen")}
        </Button>
        <Button type="submit" size="sm" disabled={busy || title.trim().length === 0}>
          {busy ? t("drumbeat.ui.anlegenLaeuft") : t("drumbeat.ui.anlegen")}
        </Button>
      </div>
    </form>
  );
}

function QuickAddPopover({
  children,
  onSubmit,
  busy,
}: {
  children: ReactNode;
  onSubmit: QuickAddSubmit;
  busy: boolean;
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
          busy={busy}
        />
      </PopoverContent>
    </Popover>
  );
}

function QuickEditPopover({ node }: { node: FeatureNodeData }) {
  const t = useTranslations();
  const ctx = useBreakdownInteraction();
  const onSubmit = useMemo(
    () => ctx.onEditFeature(node.id, node.artId),
    [ctx, node.id, node.artId],
  );
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [featureType, setFeatureType] = useState<FeatureType | "">(
    normalizeFeatureType(node.featureType),
  );

  // sync state, wenn der Server-Refresh neue Werte liefert
  useEffect(() => {
    if (!open) {
      setTitle(node.title);
      setFeatureType(normalizeFeatureType(node.featureType));
    }
  }, [open, node.title, node.featureType]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t("drumbeat.ui.featureBearbeiten")}
            className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition hover:bg-primary hover:text-primary-foreground group-hover:opacity-100"
          >
            <Pencil className="size-3" />
          </button>
        }
      />
      {/*
        `w-80`, nicht `w-64`: drei Knöpfe („WSJF verfeinern" · „Abbrechen" ·
        „Speichern") passten auf Deutsch nicht in 236 px, und die Zeile brach
        nicht um — der letzte Knopf ragte rechts aus dem Kasten.
      */}
      <PopoverContent side="bottom" align="end" className="w-80">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = title.trim();
            if (next.length === 0) return;
            onSubmit({ title: next, featureType });
            setOpen(false);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={`edit-title-${node.id}`} className="text-xs">
              {t("drumbeat.ui.titel")}
            </Label>
            <Input
              id={`edit-title-${node.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              // `focus()` setzt die Marke ans **Ende** — bei 200 Zeichen zeigt
              // das Feld dann nur den Schluss („…Standort A — Pilot"). Wer
              // bearbeitet, will vorn anfangen.
              onFocus={(e) => {
                e.currentTarget.setSelectionRange(0, 0);
                e.currentTarget.scrollLeft = 0;
              }}
              required
              maxLength={200}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`edit-type-${node.id}`} className="text-xs">
              {t("drumbeat.ui.typ")}
            </Label>
            <select
              id={`edit-type-${node.id}`}
              value={featureType}
              onChange={(e) => setFeatureType(e.target.value as FeatureType | "")}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{t("drumbeat.ui.ungesetzt")}</option>
              {FEATURE_TYPES.map((wert) => (
                <option key={wert} value={wert}>
                  {t(FEATURE_TYPE_KEYS[wert] ?? wert)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <WsjfScoreDialog
              featureId={node.id}
              artId={node.artId}
              current={node.wsjf}
              renderTrigger={({ onClick }) => (
                <Button type="button" variant="outline" size="sm" onClick={onClick}>
                  {t("drumbeat.ui.wsjfVerfeinern")}
                </Button>
              )}
            />
            <div className="ml-auto flex gap-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {t("drumbeat.ui.abbrechen")}
              </Button>
              <Button type="submit" size="sm">
                {t("drumbeat.ui.speichern")}
              </Button>
            </div>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

const FeatureNode = memo(function FeatureNode({ data }: NodeProps) {
  const t = useTranslations();
  const node = data as unknown as FeatureNodeData;
  const type = normalizeFeatureType(node.featureType);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openSlideOver = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("featureId", node.id);
    router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
  };
  return (
    // Feste Box: `NODE_HEIGHT` ist keine Schätzung mehr, sondern die Höhe, die
    // dieser Knoten einnimmt. Siehe den Docblock der Konstante.
    <div className="group relative" style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}>
      <HandleRow type="target" position={Position.Left} connectable={node.connectable} visible />
      <button
        type="button"
        onClick={openSlideOver}
        className="flex h-full w-full flex-col rounded-lg bg-card p-3 text-left text-xs no-underline shadow-card transition-colors hover:bg-muted/40"
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className={`size-2 shrink-0 rounded-full ${STATUS_DOT[node.status] ?? "bg-muted-foreground/40"}`}
            aria-hidden
          />
          <span className="line-clamp-2 flex-1 text-xs font-medium leading-tight text-foreground">
            {node.title}
          </span>
        </div>
        <div className="mt-auto flex items-center gap-1.5 text-label">
          <span className={`rounded-full px-1.5 py-0.5 ${FEATURE_TYPE_BADGE[type]}`}>
            {type === "" ? t("drumbeat.ui.ohneTyp") : t(FEATURE_TYPE_KEYS[type] ?? type)}
          </span>
          <span className={`rounded-full px-1.5 py-0.5 ${TIER_BADGE[node.wsjfTier]}`}>
            {t("drumbeat.ui.wsjfWert", { score: formatWsjf(node.wsjfComputed) })}
          </span>
          <span className="ml-auto truncate text-muted-foreground">{node.artName}</span>
        </div>
      </button>
      <HandleRow type="source" position={Position.Right} connectable={node.connectable} visible />
      <BracketTargetRow />
      {node.showPlus && <NodeAddPlusButton node={node} />}
      {node.showEdit && <QuickEditPopover node={node} />}
    </div>
  );
});

function NodeAddPlusButton({ node }: { node: FeatureNodeData }) {
  const t = useTranslations();
  const ctx = useBreakdownInteraction();
  const onAdd = useMemo(() => ctx.onAddSuccessor(node.id, node.artId), [ctx, node.id, node.artId]);
  return (
    <div className="absolute -right-7 top-1/2 -translate-y-1/2">
      <QuickAddPopover onSubmit={onAdd} busy={false}>
        <button
          type="button"
          aria-label={t("drumbeat.ui.folgeFeatureAnlegen")}
          className="flex size-5 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground"
        >
          <Plus className="size-3" />
        </button>
      </QuickAddPopover>
    </div>
  );
}

const InsertableEdge = memo(function InsertableEdge(props: EdgeProps) {
  const t = useTranslations();
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    label,
    markerEnd,
    style,
    selected,
  } = props;
  const edgeData = data as unknown as InsertableEdgeData | undefined;
  const type = edgeData?.type ?? "blocks";
  const sourceArtId = edgeData?.sourceArtId ?? "";
  const canChangeType = edgeData?.canChangeType ?? false;
  const canInsert = edgeData?.canInsert ?? false;
  const [eigenerPfad, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    // offset 32 + borderRadius 16: leitet die linien staerker um den
    // node herum statt direkt durch nachbarn durch.
    offset: 32,
    borderRadius: 16,
  });
  // Die Fassung mit Brücken, falls es eine gibt — sonst die eigene.
  const edgePath = useContext(EdgePathContext).get(id) ?? eigenerPfad;
  const [hovered, setHovered] = useState(false);
  const showDecoration = hovered || selected || false;

  // Callbacks aus Context — nur konstruieren wenn benoetigt.
  const ctx = useContext(BreakdownInteractionContext);
  const onChangeType = useMemo(() => {
    if (!ctx || !canChangeType) return undefined;
    return ctx.onChangeEdgeType(source, target, type, sourceArtId);
  }, [ctx, canChangeType, source, target, type, sourceArtId]);
  const onDeleteEdge = useMemo(() => {
    if (!ctx || !canChangeType) return undefined;
    return ctx.onDeleteEdge(source, target, type, sourceArtId);
  }, [ctx, canChangeType, source, target, type, sourceArtId]);
  const onInsert = useMemo(() => {
    if (!ctx || !canInsert) return undefined;
    return ctx.onInsertOnEdge(source, target, type, sourceArtId);
  }, [ctx, canInsert, source, target, type, sourceArtId]);

  return (
    <>
      <path
        id={id}
        d={edgePath}
        style={style}
        className="react-flow__edge-path"
        markerEnd={markerEnd}
        fill="none"
      />
      {/* Transparente hit-area: pointerEvents auf "stroke" beschraenkt
       *  das hover-target auf die linie selbst (statt der bounding-box). */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        style={{ cursor: "pointer", pointerEvents: "stroke" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          className={`absolute flex items-center gap-1 transition-opacity ${
            showDecoration ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: showDecoration ? "all" : "none",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {label &&
            (onChangeType ? (
              <EdgeTypePopover currentType={type} onChange={onChangeType} onDelete={onDeleteEdge}>
                <button
                  type="button"
                  aria-label={t("drumbeat.ui.abhaengigkeitstypAendern")}
                  className="rounded-sm bg-card px-1 text-label transition-colors hover:bg-muted"
                  style={{ color: EDGE_COLOR[type] }}
                >
                  {label}
                </button>
              </EdgeTypePopover>
            ) : (
              <span
                className="rounded-sm bg-card px-1 text-label"
                style={{ color: EDGE_COLOR[type] }}
              >
                {label}
              </span>
            ))}
          {edgeData?.showPlus && onInsert && (
            <QuickAddPopover onSubmit={onInsert} busy={false}>
              <button
                type="button"
                aria-label={t("drumbeat.ui.featureZwischenfuegen")}
                className="flex size-5 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground"
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

type GhostNodeData = BreakdownGhostNode;

const GhostNode = memo(function GhostNode({ data }: NodeProps) {
  const t = useTranslations();
  const node = data as unknown as GhostNodeData;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openSlideOver = () => {
    const next = new URLSearchParams(searchParams.toString());
    // Die Geister-Id traegt seit A4 die Rolle (`ghost:predecessor:…`); die
    // Detailflaeche will die echte Initiative.
    next.set("featureId", node.initiativeId);
    router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
  };
  return (
    <div className="relative" style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}>
      <HandleRow type="target" position={Position.Left} connectable={false} visible={false} />
      <button
        type="button"
        onClick={openSlideOver}
        className="flex h-full w-full flex-col rounded-lg border border-dashed border-muted-foreground/40 bg-card/60 p-3 text-left text-xs no-underline opacity-70 transition-colors hover:bg-muted/40 hover:opacity-100"
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
          <span className="line-clamp-2 flex-1 text-xs font-medium leading-tight text-muted-foreground">
            {node.title}
          </span>
        </div>
        <div className="mt-auto flex items-center gap-1.5 text-label text-muted-foreground">
          <span className="rounded-full bg-muted px-1.5 py-0.5">
            {node.role === "predecessor"
              ? t("drumbeat.ui.predecessorExtern")
              : t("drumbeat.ui.successorExtern")}
          </span>
          {node.epicTitle && <span className="ml-auto truncate">{node.epicTitle}</span>}
        </div>
      </button>
      <HandleRow type="source" position={Position.Right} connectable={false} visible={false} />
    </div>
  );
});

const PiHeaderNode = memo(function PiHeaderNode({ data }: NodeProps) {
  const node = data as unknown as { label: string };
  return (
    <div
      className="rounded-md bg-muted/60 px-3 py-1 text-center text-meta font-medium uppercase tracking-wider text-muted-foreground"
      style={{ width: NODE_WIDTH }}
    >
      {node.label}
    </div>
  );
});

const NODE_TYPES = { feature: FeatureNode, ghost: GhostNode, "pi-header": PiHeaderNode };
const EDGE_TYPES = { insertable: InsertableEdge };

/**
 * Netzplan-PNG-Export (Roadmap-P7). Snapshot der gesamten Canvas in
 * 1600×900 px mit fit-to-bounds-Viewport — independent von Pan/Zoom-
 * Stand. Nutzt `useReactFlow` (muss daher INNERHALB von `<ReactFlow>`
 * gerendert werden, idealerweise im `<Panel>`).
 */
function ExportButton({ epicTitle }: { epicTitle: string }) {
  const t = useTranslations();
  const { getNodes } = useReactFlow();
  const onExport = async () => {
    const nodes = getNodes();
    if (nodes.length === 0) {
      toast.error("Keine Knoten zum Exportieren");
      return;
    }
    const viewportEl = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!viewportEl) {
      toast.error("Canvas nicht bereit");
      return;
    }
    const PADDING = 0.1;
    const WIDTH = 1600;
    const HEIGHT = 900;
    const bounds = getNodesBounds(nodes);
    const vp = getViewportForBounds(bounds, WIDTH, HEIGHT, 0.25, 2, PADDING);
    try {
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: "#ffffff",
        width: WIDTH,
        height: HEIGHT,
        pixelRatio: 2,
        style: {
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        },
      });
      const slug = epicTitle
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      const link = document.createElement("a");
      link.download = `netzplan-${slug || "epic"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Netzplan exportiert");
    } catch {
      toast.error("Export fehlgeschlagen");
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
export function BreakdownNetworkView({
  epicId,
  tenantId,
  epicTitle,
  epicValueStreamId,
  features,
  pis,
  dependencies,
  canLinkDependency,
  canCreateFeature,
  savedPositions,
}: Props) {
  const { resolvedTheme } = useTheme();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Realtime-Sync (Roadmap-P8): Supabase-Postgres-Changes auf
  // initiatives + dependencies refreshen die Page debounced 300 ms.
  useBreakdownRealtime(tenantId);

  // ----- Filter (Roadmap-P4) -----
  // Volltextsuche + Typ-Facette. URL-state ?breakdownQ=, ?breakdownType=
  // Search-Input ist lokal-debounced (200 ms) damit URL nicht pro Tastenanschlag flackert.
  const urlQuery = searchParams.get("breakdownQ") ?? "";
  const urlType = (() => {
    const t = searchParams.get("breakdownType");
    return isFeatureType(t) ? t : "all";
  })();
  const [queryDraft, setQueryDraft] = useState(urlQuery);
  useEffect(() => setQueryDraft(urlQuery), [urlQuery]);
  useEffect(() => {
    if (queryDraft === urlQuery) return;
    const t = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (queryDraft.trim() === "") params.delete("breakdownQ");
      else params.set("breakdownQ", queryDraft.trim());
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
    }, 200);
    return () => window.clearTimeout(t);
  }, [queryDraft, urlQuery, pathname, router, searchParams]);

  const setUrlType = (next: "all" | FeatureType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("breakdownType");
    else params.set("breakdownType", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  };

  // Layout-Mode (Roadmap-P9): topology = dagre, pi = swimlanes.
  const layoutMode: "topology" | "pi" =
    searchParams.get("breakdownLayout") === "pi" ? "pi" : "topology";
  const setLayoutMode = (next: "topology" | "pi") => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "topology") params.delete("breakdownLayout");
    else params.set("breakdownLayout", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  };

  const hasFilter = urlQuery !== "" || urlType !== "all";
  const matchedIds = useMemo<Set<string> | null>(() => {
    if (!hasFilter) return null;
    const q = urlQuery.toLowerCase().trim();
    const out = new Set<string>();
    for (const f of features) {
      if (urlType !== "all" && f.featureType !== urlType) continue;
      if (q !== "" && !f.title.toLowerCase().includes(q)) continue;
      out.add(f.id);
    }
    return out;
  }, [features, urlQuery, urlType, hasFilter]);

  const clearFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("breakdownQ");
    params.delete("breakdownType");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  };

  const artById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of features) m.set(f.id, f.artId);
    return m;
  }, [features]);

  const model = useMemo(
    () => buildBreakdownGraph({ features, dependencies }),
    [features, dependencies],
  );

  // onAddSuccessor: bauen pro Render eine factory, die fuer einen
  // Predecessor eine Submit-Funktion liefert. Die Submit-Funktion ruft
  // die Server-Action und tut Optimistic + Refresh.
  const onAddSuccessor = useCallback(
    (predecessorId: string, predecessorArtId: string): QuickAddSubmit =>
      (input) => {
        const fd = new FormData();
        fd.set("artId", predecessorArtId);
        fd.set("parentEpicId", epicId);
        fd.set("predecessorId", predecessorId);
        fd.set("title", input.title);
        fd.set("featureType", input.featureType);
        startTransition(async () => {
          const result = await quickAddFeatureWithDependencyAction({}, fd);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Folge-Feature angelegt");
          router.refresh();
        });
      },
    [epicId, router],
  );

  const onEditFeature = useCallback(
    (featureId: string, featureArtId: string): QuickEditSubmit =>
      (input) => {
        const fd = new FormData();
        fd.set("id", featureId);
        fd.set("artId", featureArtId);
        fd.set("title", input.title);
        // Empty string = explicit clear; "feature"/"enabler" set; pass-through.
        fd.set("featureType", input.featureType);
        startTransition(async () => {
          const result = await updateFeatureAction({}, fd);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Feature aktualisiert");
          router.refresh();
        });
      },
    [router],
  );

  const onInsertOnEdge = useCallback(
    (
      fromId: string,
      toId: string,
      edgeType: DependencyEdgeType,
      sourceArtId: string,
    ): QuickAddSubmit =>
      (input) => {
        const fd = new FormData();
        fd.set("artId", sourceArtId);
        fd.set("parentEpicId", epicId);
        fd.set("fromId", fromId);
        fd.set("toId", toId);
        fd.set("edgeType", edgeType);
        fd.set("title", input.title);
        fd.set("featureType", input.featureType);
        startTransition(async () => {
          const result = await insertFeatureBetweenAction({}, fd);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Feature zwischengefügt");
          router.refresh();
        });
      },
    [epicId, router],
  );

  const onChangeEdgeType = useCallback(
    (
      fromId: string,
      toId: string,
      currentType: DependencyEdgeType,
      sourceArtId: string,
    ): EdgeTypeChange =>
      (next) => {
        if (next === currentType) return;
        // Optimistic: lokal sofort den Edge-Style umschreiben.
        setEdges((current) =>
          current.map((edge) => {
            if (edge.source !== fromId || edge.target !== toId) return edge;
            const s = edgeStyle(next);
            const data = edge.data as InsertableEdgeData | undefined;
            return {
              ...edge,
              animated: s.animated,
              style: s.style,
              label: t(EDGE_LABEL[next]),
              markerEnd: s.marker,
              data: {
                ...(data ?? { type: next, showPlus: false }),
                type: next,
              } as unknown as Record<string, unknown>,
            };
          }),
        );
        startTransition(async () => {
          const result = await changeDependencyType(changeDependencyTypeAction, {
            fromId,
            toId,
            fromType: currentType,
            toType: next,
            artId: sourceArtId,
          });
          if (result?.error) {
            toast.error(result.error);
            // Rollback: einfach refresh — der Server-Stand ist die Wahrheit.
            router.refresh();
            return;
          }
          toast.success("Abhängigkeitstyp geändert");
          router.refresh();
        });
      },
    [router],
  );

  // Edge-Delete aus dem Label-Popover. Optimistic remove + unlink-Call.
  const onDeleteEdgeFromPopover = useCallback(
    (fromId: string, toId: string, edgeType: DependencyEdgeType, sourceArtId: string) => () => {
      // Optimistic: edge sofort aus local state filtern.
      setEdges((current) => current.filter((e) => !(e.source === fromId && e.target === toId)));
      startTransition(async () => {
        const result = await unlinkDependency(unlinkDependencyAction, {
          fromId,
          toId,
          type: edgeType,
          artId: sourceArtId,
        });
        if (result?.error) {
          toast.error(result.error);
          // Rollback: refresh holt den server-stand zurueck.
          router.refresh();
          return;
        }
        toast.success("Abhängigkeit gelöscht");
        router.refresh();
      });
    },
    [router],
  );

  // Node-Drag-Persistenz (Roadmap-P5). Pro Knoten debounced 400 ms —
  // mehrere Wiggles werden zu einem save zusammengezogen.
  const dragSaveTimers = useMemo<Map<string, ReturnType<typeof setTimeout>>>(() => new Map(), []);
  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      if (!canCreateFeature) return;
      const existing = dragSaveTimers.get(node.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        dragSaveTimers.delete(node.id);
        const fd = new FormData();
        fd.set("epicId", epicId);
        fd.set(
          "positions",
          JSON.stringify([{ initiativeId: node.id, x: node.position.x, y: node.position.y }]),
        );
        startTransition(async () => {
          const result = await saveBreakdownLayoutAction({}, fd);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
        });
      }, 400);
      dragSaveTimers.set(node.id, timer);
    },
    [canCreateFeature, epicId, dragSaveTimers],
  );

  const baseGraph = useMemo(() => {
    const layoutCtx: LayoutCtx = {
      t,
      canLinkDependency,
      canCreateFeature,
      canEditFeature: canCreateFeature,
    };
    if (layoutMode === "pi") {
      return layoutByPi(model.nodes, model.edges, model.ghostNodes, pis, artById, layoutCtx);
    }
    return layoutGraph(model.nodes, model.edges, model.ghostNodes, artById, {
      ...layoutCtx,
      savedPositions,
    });
  }, [
    layoutMode,
    model.nodes,
    model.edges,
    model.ghostNodes,
    pis,
    artById,
    canLinkDependency,
    canCreateFeature,
    savedPositions,
  ]);

  // Interaction-Context: alle callbacks an einer Stelle, identitaetsstabil
  // via useMemo. Custom-Nodes/Edges lesen sie per useContext und vermeiden
  // so neue Function-Identitaeten in node.data — `React.memo` greift.
  const interactionCtx = useMemo<BreakdownInteractionCtx>(
    () => ({
      onAddSuccessor,
      onEditFeature,
      onInsertOnEdge,
      onChangeEdgeType,
      onDeleteEdge: onDeleteEdgeFromPopover,
    }),
    [onAddSuccessor, onEditFeature, onInsertOnEdge, onChangeEdgeType, onDeleteEdgeFromPopover],
  );

  // Drag-managed nodes via useNodesState — ReactFlow handhabt
  // Drag-Position-Updates intern als transform-only, kein React-re-render
  // pro frame. Sync von baseGraph (nach refresh) ueber useEffect.
  const [nodes, setNodes, onNodesChange] = useNodesState(baseGraph.nodes);
  useEffect(() => setNodes(baseGraph.nodes), [baseGraph.nodes, setNodes]);

  // Controlled-Edges fuer Optimistic Drag-Connect. **Zusammenführen, nicht
  // ersetzen** — siehe `mergeOptimisticEdges`: hier stand ein
  // `setEdges(baseGraph.edges)`, und ein Server-Stand von vor dem Schreiben
  // löschte die eben angelegte Kante wieder weg.
  const [edges, setEdges] = useState<Edge[]>(baseGraph.edges);
  useEffect(() => {
    setEdges((current) => mergeOptimisticEdges(baseGraph.edges, current));
  }, [baseGraph.edges]);

  /**
   * **Ein Kantenende aufnehmen und woanders ablegen.**
   *
   * `edgesReconnectable={false}` stand hier ausdrücklich — ReactFlow bringt die
   * Geste mit, sie war nur nie gewollt. Jetzt ist sie es, an `canLinkDependency`
   * gebunden.
   *
   * **Kein optimistischer Zwischenstand.** `mergeOptimisticEdges` hält nur
   * `tmp-`-Kanten und kennt keinen Grabstein; eine umgehängte Kante bekommt
   * beim Anlegen eine **neue** Id, und ein Server-Stand von vor dem Schreiben
   * brächte die alte zurück — beide Enden gleichzeitig sichtbar. Lieber ein
   * Sprung nach dem Serverlauf als zwei Kanten, von denen eine lügt.
   */
  const onReconnect = useCallback(
    (alteKante: Edge, conn: Connection) => {
      if (!canLinkDependency) return;
      if (!conn.source || !conn.target) return;
      if (conn.source === conn.target) {
        toast.error("Eine Abhängigkeit auf dasselbe Feature ist nicht möglich.");
        return;
      }
      const typ = ((alteKante.data as { type?: DependencyEdgeType } | undefined)?.type ??
        "blocks") as DependencyEdgeType;
      if (
        typ !== "relates_to" &&
        detectCycle(
          conn.source,
          conn.target,
          edges
            .filter((e) => e.id !== alteKante.id)
            .map((e) => ({ fromId: e.source, toId: e.target })),
        )
      ) {
        toast.error("Diese Verbindung würde einen Zyklus erzeugen.");
        return;
      }
      const sourceArtId = artById.get(alteKante.source);
      if (!sourceArtId) {
        toast.error("Source-ART unbekannt — Abhängigkeit nicht umgehängt.");
        return;
      }
      startTransition(async () => {
        const res = await relinkDependency(relinkDependencyAction, {
          fromId: alteKante.source,
          toId: alteKante.target,
          type: typ,
          newFromId: conn.source!,
          newToId: conn.target!,
          artId: sourceArtId,
        });
        if (res?.error) {
          toast.error(res.error);
          router.refresh();
          return;
        }
        toast.success("Abhängigkeit umgehängt", {
          action: {
            label: "Rückgängig",
            onClick: () => {
              startTransition(async () => {
                const zurueck = await relinkDependency(relinkDependencyAction, {
                  fromId: conn.source!,
                  toId: conn.target!,
                  type: typ,
                  newFromId: alteKante.source,
                  newToId: alteKante.target,
                  artId: sourceArtId,
                });
                if (zurueck?.error) toast.error(zurueck.error);
                router.refresh();
              });
            },
          },
        });
        router.refresh();
      });
    },
    [canLinkDependency, edges, artById, router],
  );

  // Filter-Overlay (Roadmap-P4): nicht-gematchte Nodes + Edges, die nicht
  // beide endpunkte gematcht haben, werden auf opacity 0.25 dimmed.
  const displayNodes = useMemo(() => {
    if (!matchedIds) return nodes;
    return nodes.map((n) =>
      matchedIds.has(n.id) ? n : { ...n, style: { ...(n.style ?? {}), opacity: 0.25 } },
    );
  }, [nodes, matchedIds]);
  const displayEdges = useMemo(() => {
    if (!matchedIds) return edges;
    return edges.map((e) => {
      const matchedEdge = matchedIds.has(e.source) && matchedIds.has(e.target);
      if (matchedEdge) return e;
      return { ...e, style: { ...(e.style ?? {}), opacity: 0.25 } };
    });
  }, [edges, matchedIds]);

  /**
   * **Unbeteiligtes abblenden** — oben auf das Filter-Abblenden gelegt. Der
   * überfahrene Knoten und seine Nachbarn bleiben satt, der Rest wird blass.
   */
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Anschlüsse nach der **Live**-Lage — nach dem Ziehen stimmt die Reihenfolge weiter.
  const liveEdges = useLiveHandles(nodes, displayEdges);
  const sicht = useFocusDimming(displayNodes, liveEdges, hoverId);

  /**
   * **Die Linien aller Kanten, einmal berechnet — samt Brücken.**
   *
   * Über die **Live**-Positionen (`nodes`), nicht über das Layout-Ergebnis:
   * sonst stünden die Bögen nach jedem Ziehen falsch.
   *
   * Dass die Endpunkte hier exakt bestimmbar sind, verdankt sich der festen
   * Knotenbox: 220 × `NODE_HEIGHT`, und die Anschlüsse sitzen auf bekannten
   * Bruchteilen der Höhe. Vorher war die Höhe inhaltsabhängig, und jede
   * Rechnung darüber wäre geraten gewesen.
   */
  const edgePaths = useEdgePaths(nodes, liveEdges, { width: NODE_WIDTH, height: NODE_HEIGHT });

  // Connection-Typ steuert, mit welchem Edge-Type neue Drag-Connects
  // angelegt werden. Default `blocks` — der einzige Typ mit Reihenfolge.
  const [connectType, setConnectType] = useState<DependencyEdgeType>("blocks");

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!canLinkDependency) return;
      if (!conn.source || !conn.target) return;
      if (conn.source === conn.target) {
        toast.error("Eine Abhängigkeit auf dasselbe Feature ist nicht möglich.");
        return;
      }
      if (
        connectType !== "relates_to" &&
        detectCycle(
          conn.source,
          conn.target,
          edges.map((e) => ({ fromId: e.source, toId: e.target })),
        )
      ) {
        toast.error("Diese Verbindung würde einen Zyklus erzeugen.");
        return;
      }
      const sourceArtId = artById.get(conn.source);
      if (!sourceArtId) {
        toast.error("Source-ART unbekannt — Abhängigkeit nicht angelegt.");
        return;
      }
      const tmpId = `tmp-${conn.source}-${conn.target}-${Date.now()}`;
      const s = edgeStyle(connectType);
      const tmpEdge: Edge = {
        id: tmpId,
        source: conn.source,
        target: conn.target,
        type: "insertable",
        label: t(EDGE_LABEL[connectType]),
        animated: s.animated,
        style: s.style,
        markerEnd: s.marker,
        data: {
          type: connectType,
          showPlus: false,
        } as unknown as Record<string, unknown>,
      };
      setEdges((current) => addEdge(tmpEdge, current));

      startTransition(async () => {
        const result = await linkDependency(linkDependencyAction, {
          fromId: conn.source,
          toId: conn.target,
          type: connectType,
          artId: sourceArtId,
        });
        if (result?.error) {
          setEdges((current) => current.filter((e) => e.id !== tmpId));
          toast.error(result.error);
          return;
        }
        toast.success("Abhängigkeit angelegt");
        router.refresh();
      });
    },
    [artById, canLinkDependency, connectType, edges, router],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!canLinkDependency) return;
      for (const edge of deleted) {
        if (edge.id.startsWith("tmp-")) continue;
        const sourceArtId = artById.get(edge.source);
        if (!sourceArtId) {
          // Re-Add — ohne ART kein unlink-Call.
          setEdges((current) => addEdge(edge, current));
          toast.error("Source-ART unbekannt — Abhängigkeit nicht gelöscht.");
          continue;
        }
        const data = edge.data as InsertableEdgeData | undefined;
        const type = data?.type ?? "blocks";
        startTransition(async () => {
          const result = await unlinkDependency(unlinkDependencyAction, {
            fromId: edge.source,
            toId: edge.target,
            type,
            artId: sourceArtId,
          });
          if (result?.error) {
            setEdges((current) => addEdge(edge, current));
            toast.error(result.error);
            return;
          }
          toast.success("Abhängigkeit gelöscht");
          router.refresh();
        });
      }
    },
    [artById, canLinkDependency, router],
  );

  if (model.nodes.length === 0) {
    return (
      // Vorher hiess dasselbe hier „Features" und im Deliverables-Reiter
      // „Deliverables" — zwei Namen fuer dieselben Objekte, nebeneinander.
      <EmptyState
        className="h-64"
        icon={<Network className="size-6" />}
        title={t("drumbeat.ui.nochKeineDeliverables")}
        body={t("drumbeat.ui.ohneDeliverablesGibtEs")}
        action={
          canCreateFeature ? (
            <CreateFeatureDialog
              epics={[{ id: epicId, title: epicTitle, valueStreamId: epicValueStreamId }]}
              context={{ epicId }}
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {model.droppedEdgeCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {model.droppedEdgeCount === 1
            ? t("drumbeat.ui.abhaengigkeitUngueltigerTypEins", { count: model.droppedEdgeCount })
            : t("drumbeat.ui.abhaengigkeitenUngueltigerTypMehrere", {
                count: model.droppedEdgeCount,
              })}
        </p>
      )}
      {model.ghostNodes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {model.ghostNodes.length === 1
            ? t("drumbeat.ui.crossEpicEndpunktEins", { count: model.ghostNodes.length })
            : t("drumbeat.ui.crossEpicEndpunkteMehrere", { count: model.ghostNodes.length })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Input
          value={queryDraft}
          onChange={(e) => setQueryDraft(e.target.value)}
          placeholder={t("drumbeat.ui.sucheImTitel")}
          aria-label={t("drumbeat.ui.sucheImNetzplan")}
          className="h-7 w-48 text-xs"
        />
        <ToggleGroup
          ariaLabel={t("drumbeat.ui.typFilter")}
          className="bg-card text-xs"
          value={urlType}
          onChange={setUrlType}
          options={[
            { id: "all", label: "Alle Typen" },
            ...FEATURE_TYPES.map((typ) => ({ id: typ, label: t(FEATURE_TYPE_KEYS[typ] ?? typ) })),
          ]}
        />
        {hasFilter && (
          <>
            <span className="text-muted-foreground">
              {t("drumbeat.ui.netzplanSichtbar", {
                visible: matchedIds?.size ?? 0,
                total: features.length,
              })}
            </span>
            <button type="button" onClick={clearFilter} className="text-primary hover:underline">
              {t("drumbeat.ui.filterZuruecksetzen")}
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">{t("drumbeat.ui.layout")}</span>
          <ToggleGroup
            ariaLabel={t("drumbeat.ui.layoutModus")}
            className="bg-card text-xs"
            value={layoutMode}
            onChange={setLayoutMode}
            options={[
              { id: "topology", label: "Topologie" },
              { id: "pi", label: "PI-Bahnen" },
            ]}
          />
          {/*
            **Nur in der Topologie, und nur wenn es etwas zu verwerfen gibt.**
            Die PI-Bahnen ignorieren gespeicherte Positionen ohnehin; dort
            waere der Knopf ein Versprechen ohne Wirkung.
          */}
          {layoutMode === "topology" &&
            canLinkDependency &&
            Object.keys(savedPositions ?? {}).length > 0 && (
              <ConfirmMutateForm
                action={clearBreakdownLayoutAction}
                fields={{ epicId }}
                label={t("drumbeat.ui.neuAnordnen")}
                pendingLabel="…"
                confirmPrompt={t("drumbeat.ui.neuAnordnenFrage")}
                icon={<LayoutGrid className="mr-1 size-3.5" />}
                size="sm"
              />
            )}
        </div>
      </div>
      {(canLinkDependency || canCreateFeature) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-muted-foreground">
            {canCreateFeature && <>{t("drumbeat.ui.netzplanHinweisPlus")} </>}
            {canLinkDependency && t("drumbeat.ui.netzplanHinweisDragBlockiert")}
          </p>
          {canLinkDependency && (
            <div className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">{t("drumbeat.ui.neueEdge")}</span>
              {/* Der Farbhinweis sass vorher als `style.color` auf dem Knopf
                  und war der Grund fuer den Eigenbau. Als Punkt in der
                  Beschriftung traegt ihn die geteilte Leiste mit. */}
              <ToggleGroup
                ariaLabel={t("drumbeat.ui.connectionTyp")}
                className="bg-card text-xs"
                value={connectType}
                onChange={setConnectType}
                options={(["blocks", "relates_to"] as const).map((typ) => ({
                  id: typ,
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full"
                        style={{ background: EDGE_COLOR[typ] }}
                      />
                      {t(EDGE_LABEL[typ])}
                    </span>
                  ),
                }))}
              />
            </div>
          )}
        </div>
      )}
      {/* Vorher starr `h-[480px]`: auf schmalem Fenster teilten sich die
          Werkzeugzeilen und die Leinwand den Schirm etwa haelftig. */}
      <div className="h-[26rem] rounded-lg bg-muted/30 shadow-card sm:h-[32rem] lg:h-[36rem]">
        <BreakdownInteractionContext.Provider value={interactionCtx}>
          <EdgePathContext.Provider value={edgePaths}>
            <ReactFlow
              nodes={sicht.nodes}
              edges={sicht.edges}
              onNodesChange={onNodesChange}
              onNodeMouseEnter={(_e, n) => setHoverId(n.id.startsWith("pi-header-") ? null : n.id)}
              onNodeMouseLeave={() => setHoverId(null)}
              {...(layoutMode === "topology" ? { onNodeDragStop } : {})}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              nodesDraggable={layoutMode === "topology"}
              edgesFocusable={canLinkDependency}
              edgesReconnectable={canLinkDependency}
              onReconnect={onReconnect}
              deleteKeyCode={canLinkDependency ? ["Backspace", "Delete"] : null}
              onEdgesDelete={onEdgesDelete}
              nodesConnectable={canLinkDependency}
              elementsSelectable
              onConnect={onConnect}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              /**
               * **React Flow bringt seine eigenen Farben mit, und sie sind
               * hell.** `dist/style.css` setzt die Bedienelemente — Zoom-Knöpfe,
               * MiniMap, Kanten — auf weisse Flächen mit dunklen Symbolen; im
               * dunklen Modus verschwand die Navigation damit vor dem
               * Hintergrund. `colorMode` schaltet die eingebauten Variablen um,
               * gespeist aus demselben `next-themes`, dem auch die Toasts
               * folgen (`components/ui/sonner.tsx`).
               */
              colorMode={resolvedTheme === "dark" ? "dark" : "light"}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls showInteractive={false} />
              <Panel position="top-right">
                <ExportButton epicTitle={epicTitle} />
              </Panel>
              <MiniMap
                pannable
                zoomable
                ariaLabel={t("drumbeat.ui.netzplanUebersicht")}
                nodeColor={(n) => {
                  // PI-Header und Ghost-Nodes bekommen ein neutrales grau,
                  // damit die minimap nicht durch headerflaechen "geblockt"
                  // aussieht.
                  // `var(--…)` statt fester Hex-Werte: die Uebersicht folgt damit
                  // dem Thema, statt in beiden hell zu bleiben.
                  if (n.type === "pi-header") return "var(--muted)";
                  if (n.type === "ghost") return "var(--border)";
                  const d = n.data as unknown as FeatureNodeData | undefined;
                  return FEATURE_TYPE_MINIMAP[normalizeFeatureType(d?.featureType ?? null)];
                }}
                nodeStrokeWidth={0}
                maskColor="color-mix(in oklab, var(--background) 92%, transparent)"
              />
            </ReactFlow>
          </EdgePathContext.Provider>
        </BreakdownInteractionContext.Provider>
      </div>
    </div>
  );
}

export default BreakdownNetworkView;
