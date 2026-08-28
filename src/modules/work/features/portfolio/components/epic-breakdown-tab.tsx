"use client";

import { useActionState, useMemo, useState } from "react";
import { PackageOpen } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { updateFeatureAction } from "@/modules/work/features/feature/actions/feature";
import {
  FeaturesListView,
  toFeatureStatus,
} from "@/modules/work/features/feature/components/features-table";
import {
  tierFor,
  type FeatureOverviewRow,
  type FeaturesOverviewModel,
} from "@/modules/work/server/views/features-overview";
import type { FeatureStatus } from "@/server/views/features-list";
import { CreateFeatureDialog } from "@/modules/work/features/feature/components/create-feature-dialog";
import { DeleteFeatureButton } from "@/modules/work/features/feature/components/delete-feature-button";
import { FeaturePiSelect } from "@/modules/work/features/feature/components/feature-pi-select";
import { FeatureStatusSelect } from "@/modules/work/features/feature/components/feature-status-select";
import { SectionSignoffBanner, type SectionSignoff } from "./section-signoff-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// ADR-0013-Ausnahme (bewusst, dokumentiert): dies ist der EINZIGE Work→Drumbeat-
// „Aufwärts"-Import und bewusst ein `next/dynamic`-CLIENT-Chunk — kein Server-/
// Build-Zyklus, nur eine Bundle-Grenze. Die saubere Inversion (Render-Prop-Slot,
// vom `src/app`-Client-Wrapper injiziert) ist bekannt, aber die Props werden hier
// tab-intern abgeleitet (Feature-Mapping, Realtime-`savedPositions`), also ist der
// Umbau ein eigener, UI-zu-verifizierender Schritt. Bis dahin bleibt dies die eine
// sanktionierte Ausnahme.
/** Lazy-import den Netzplan, damit der List-Modus die ~130 KB ReactFlow
 *  + dagre nicht ins Initial-Bundle zieht. */
const BreakdownNetworkView = dynamic(
  () =>
    import("@/modules/drumbeat/features/cockpit/components/breakdown-network-view").then(
      (m) => m.BreakdownNetworkView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
        Lade Netzplan…
      </div>
    ),
  },
);

type BreakdownView = "list" | "graph";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 20] as const;

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Pi {
  id: string;
  name: string;
}

export interface BreakdownFeature {
  id: string;
  title: string;
  status: string;
  description: string;
  artId: string;
  artName: string;
  piId: string | null;
  /** Anzeigename des PI — die Tabelle zeigt ihn, ohne dafür nachzuladen. */
  piName: string | null;
  /** Grundlage der Sortierung „Neueste/Älteste zuerst". */
  createdAtMs: number;
  acceptanceCriteria: string[];
  wsjf: { bv: number; tc: number; rr: number; js: number; computed: number };
  /** SAFe Capacity-Guardrail (Roadmap-G2) — surfacet im Netzplan-Node. */
  featureType: string | null;
}

interface Props {
  epicId: string;
  /**
   * Welche Fläche der Reiter rendert: `list` = Feature-Liste (Reiter
   * „Deliverables"), `graph` = Netzplan (Reiter „Dependencies"). Kommt vom
   * aktiven Tab der Epic-Seite — kein interner Umschalter mehr.
   */
  view: BreakdownView;
  /** Tenant-Id — fuer den Netzplan-Realtime-Channel (Roadmap-P8). */
  tenantId: string;
  epicTitle: string;
  canEdit: boolean;
  features: BreakdownFeature[];
  /** PI options keyed by ART — a child Feature's PI picker only lists its ART's PIs. */
  pisByArt: Record<string, Pi[]>;
  /** Sign-off state for the Breakdown section (omit to hide the banner). */
  signoff?: SectionSignoff;
  /** Feature-Feature-Dependencies fuer die Netzplan-Ansicht. Cross-
   *  Epic-Endpunkte tragen Ghost-Info (Roadmap-P6). */
  dependencies: ReadonlyArray<{
    id: string;
    fromId: string;
    toId: string;
    type: string;
    from?: { id: string; title: string; parent: { id: string; title: string } | null } | null;
    to?: { id: string; title: string; parent: { id: string; title: string } | null } | null;
  }>;
  /** Wenn `true`, sind Drag-Handles am Netzplan aktiv — User kann neue
   *  Dependencies per Drag-Connect anlegen. Per-Edge-Auth checkt der
   *  Server-Action nochmal. */
  canLinkDependency: boolean;
  /** Persistierte Netzplan-Positionen (Roadmap-P5). Knoten ohne Eintrag
   *  fallen auf dagre-Auto-Layout zurueck. */
  breakdownLayoutPositions: Record<string, { x: number; y: number }>;
  /** Flat distinkte PI-Liste sortiert nach startDate, fuer den
   *  Netzplan-PI-Mode (Roadmap-P9). */
  breakdownPis: ReadonlyArray<{ id: string; name: string; startDate: string }>;
  /** `practices.wsjf` — blendet die WSJF-Spalte aus, wie in der Features-Übersicht. */
  showWsjf: boolean;
  /** `feature.delivery.set` — ohne das Recht bleibt der Status reiner Text. */
  canSetDelivery: boolean;
}

/**
 * Das Inline-Formular, das unter einer aufgeklappten Zeile erscheint. Vorher lag
 * es in der Karten-Komponente; seit die Liste die geteilte Feature-Tabelle nutzt,
 * wird es als `renderExpanded`-Slot hereingereicht.
 */
function FeatureEditForm({ feature }: { feature: BreakdownFeature }) {
  const [state, action, isPending] = useActionState(updateFeatureAction, {});

  const wsjfFields = [
    { name: "wsjfBusinessValue", label: "Business Value", value: feature.wsjf.bv },
    { name: "wsjfTimeCriticality", label: "Time Criticality", value: feature.wsjf.tc },
    { name: "wsjfRiskReduction", label: "Risk Reduction", value: feature.wsjf.rr },
    { name: "wsjfJobSize", label: "Job Size", value: feature.wsjf.js },
  ];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={feature.id} />
      <input type="hidden" name="artId" value={feature.artId} />

      <div className="space-y-1.5">
        <Label htmlFor={`title-${feature.id}`}>Titel</Label>
        <Input id={`title-${feature.id}`} name="title" defaultValue={feature.title} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`desc-${feature.id}`}>Beschreibung</Label>
        <Textarea
          id={`desc-${feature.id}`}
          name="description"
          defaultValue={feature.description}
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`ac-${feature.id}`}>Akzeptanzkriterien</Label>
        <Textarea
          id={`ac-${feature.id}`}
          name="acceptanceCriteria"
          defaultValue={feature.acceptanceCriteria.join("\n")}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">Ein Kriterium pro Zeile</p>
      </div>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {wsjfFields.map((f) => (
          <div key={f.name} className="space-y-1">
            <Label htmlFor={`${f.name}-${feature.id}`}>{f.label}</Label>
            <select
              id={`${f.name}-${feature.id}`}
              name={f.name}
              defaultValue={f.value}
              className={SELECT_CLASS}
            >
              {FIBONACCI.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-600">
          Gespeichert.
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Speichert…" : "Änderungen speichern"}
      </Button>
    </form>
  );
}

/**
 * Breakdown tab — manages the Features attached to an Epic in place: create,
 * inline-edit content + WSJF, assign a PI, and remove, without leaving the page.
 */
export function EpicBreakdownTab({
  epicId,
  view,
  tenantId,
  epicTitle,
  canEdit,
  features,
  pisByArt,
  signoff,
  dependencies,
  canLinkDependency,
  breakdownLayoutPositions,
  breakdownPis,
  showWsjf,
  canSetDelivery,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openSlideOver = (featureId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("featureId", featureId);
    router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
  };

  /**
   * `BreakdownFeature` → das Zeilenmodell der Features-Übersicht. Epic und
   * Wertstrom bleiben leer: beide Spalten sind hier ausgeblendet, weil sie in
   * jeder Zeile denselben Wert trügen.
   *
   * `isBlocked` stammt aus den ohnehin geladenen Dependency-Kanten. Ohne
   * freigeschaltetes Drumbeat ist diese Liste leer — dann zeigt die Tabelle
   * keinen Blocker-Marker. Das ist konsistent zum Rest des Reiters (auch der
   * PI-Picker bleibt dort leer) und kein Fehler.
   */
  const listModel: FeaturesOverviewModel = useMemo(() => {
    const blocked = new Set(dependencies.filter((d) => d.type === "blocks").map((d) => d.toId));
    const rows: FeatureOverviewRow[] = features.map((f) => {
      const wsjf = f.wsjf.computed > 0 ? f.wsjf.computed : null;
      return {
        id: f.id,
        title: f.title,
        status: f.status,
        epic: null,
        pi: f.piId ? { id: f.piId, name: f.piName ?? "—" } : null,
        art: { id: f.artId, name: f.artName },
        valueStream: null,
        wsjfComputed: wsjf,
        wsjfTier: tierFor(wsjf),
        wsjfBusinessValue: f.wsjf.bv > 0 ? f.wsjf.bv : null,
        wsjfTimeCriticality: f.wsjf.tc > 0 ? f.wsjf.tc : null,
        wsjfRiskReduction: f.wsjf.rr > 0 ? f.wsjf.rr : null,
        wsjfJobSize: f.wsjf.js > 0 ? f.wsjf.js : null,
        acceptanceCriteriaCount: f.acceptanceCriteria.length,
        isBlocked: blocked.has(f.id),
        createdAtMs: f.createdAtMs,
        featureType: f.featureType,
      };
    });

    const funnelCounts = { draft: 0, approved: 0, in_progress: 0, completed: 0 } as Record<
      FeatureStatus,
      number
    >;
    for (const r of rows) {
      const key = toFeatureStatus(r.status);
      if (key) funnelCounts[key] += 1;
    }

    const artOptions = [...new Map(rows.map((r) => [r.art.id, r.art])).values()]
      .filter((a) => a.id !== "")
      .map((a) => ({ ...a, valueStreamId: "" }));
    // `PiOptionLite` verlangt einen Status; im Reiter dient die Liste nur als
    // Filter-Auswahl, deshalb ein neutraler Platzhalter.
    const piOptions = [
      ...new Map(
        rows.filter((r) => r.pi).map((r) => [r.pi!.id, { ...r.pi!, status: "" }]),
      ).values(),
    ];

    return {
      rows,
      funnelCounts,
      valueStreamOptions: [],
      artOptions,
      epicOptions: [],
      piOptions,
      showWsjf,
    };
  }, [features, dependencies, showWsjf]);

  const byId = useMemo(() => new Map(features.map((f) => [f.id, f])), [features]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-medium">
          {view === "graph" ? "Dependencies" : "Deliverables"}
        </h2>
        {canEdit && view === "list" && (
          <CreateFeatureDialog epics={[{ id: epicId, title: epicTitle }]} context={{ epicId }} />
        )}
      </div>

      {view === "list" && signoff && (
        <SectionSignoffBanner epicId={epicId} section="breakdown" {...signoff} />
      )}

      {view === "list" ? (
        <p className="text-xs text-muted-foreground">
          Die QS einzelner Features (durch den RTE) ist unabhängig von der Epic-Freigabe: hier
          nimmst du die <span className="font-medium">Deliverables als Ganzes</span> für die
          Freigabe ab.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Der Netzplan zeigt die Features dieses Epics und ihre Abhängigkeiten.
          {canLinkDependency
            ? " Ziehe von einem Knoten zum anderen, um eine neue Abhängigkeit anzulegen."
            : ""}
        </p>
      )}

      {view === "graph" ? (
        <BreakdownNetworkView
          epicId={epicId}
          tenantId={tenantId}
          epicTitle={epicTitle}
          features={features.map((f) => ({
            id: f.id,
            title: f.title,
            status: f.status,
            artId: f.artId,
            artName: f.artName,
            featureType: f.featureType,
            wsjfComputed: f.wsjf.computed > 0 ? f.wsjf.computed : null,
            wsjfBusinessValue: f.wsjf.bv > 0 ? f.wsjf.bv : null,
            wsjfTimeCriticality: f.wsjf.tc > 0 ? f.wsjf.tc : null,
            wsjfRiskReduction: f.wsjf.rr > 0 ? f.wsjf.rr : null,
            wsjfJobSize: f.wsjf.js > 0 ? f.wsjf.js : null,
            piId: f.piId,
          }))}
          pis={breakdownPis}
          dependencies={dependencies}
          canLinkDependency={canLinkDependency}
          canCreateFeature={canEdit}
          savedPositions={breakdownLayoutPositions}
        />
      ) : features.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card/50 px-4 py-10 text-center">
          <PackageOpen className="size-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Noch keine Deliverables in diesem Epic.</p>
        </div>
      ) : (
        <FeaturesListView
          model={listModel}
          columns={["pi", "status", "wsjf", "ak"]}
          paramPrefix="dl."
          onOpen={(row) => openSlideOver(row.id)}
          showTotals={false}
          emptyLabel="Keine Deliverables im aktuellen Filter."
          {...(canSetDelivery
            ? {
                renderStatus: (row: FeatureOverviewRow) => (
                  <FeatureStatusSelect featureId={row.id} status={row.status} label={row.title} />
                ),
              }
            : {})}
          {...(canEdit
            ? {
                renderActions: (row: FeatureOverviewRow) => {
                  const f = byId.get(row.id);
                  if (!f) return null;
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <FeaturePiSelect
                        featureId={f.id}
                        artId={f.artId}
                        currentPiId={f.piId}
                        pis={pisByArt[f.artId] ?? []}
                      />
                      <button
                        type="button"
                        onClick={() => setExpandedId((v) => (v === f.id ? null : f.id))}
                        className="shrink-0 text-xs text-primary hover:underline"
                      >
                        {expandedId === f.id ? "Schließen" : "Bearbeiten"}
                      </button>
                      <DeleteFeatureButton id={f.id} artId={f.artId} title={f.title} />
                    </div>
                  );
                },
                renderExpanded: (row: FeatureOverviewRow) => {
                  const f = byId.get(row.id);
                  return f && expandedId === f.id ? <FeatureEditForm feature={f} /> : null;
                },
              }
            : {})}
        />
      )}
    </div>
  );
}
