"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { updateFeatureAction } from "@/features/art/actions/feature";
import { CreateFeatureDialog } from "@/features/art/components/create-feature-dialog";
import { DeleteFeatureButton } from "@/features/art/components/delete-feature-button";
import { FeaturePiSelect } from "@/features/art/components/feature-pi-select";
import { SectionSignoffBanner, type SectionSignoff } from "./section-signoff-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** Lazy-import den Netzplan, damit der List-Modus die ~130 KB ReactFlow
 *  + dagre nicht ins Initial-Bundle zieht. */
const BreakdownNetworkView = dynamic(
  () => import("./breakdown-network-view").then((m) => m.BreakdownNetworkView),
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

function parseBreakdownView(raw: string | null): BreakdownView {
  return raw === "graph" ? "graph" : "list";
}

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
  acceptanceCriteria: string[];
  wsjf: { bv: number; tc: number; rr: number; js: number; computed: number };
  /** SAFe Capacity-Guardrail (Roadmap-G2) — surfacet im Netzplan-Node. */
  featureType: string | null;
}

interface Props {
  epicId: string;
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
}

function FeatureRow({
  feature,
  canEdit,
  pis,
}: {
  feature: BreakdownFeature;
  canEdit: boolean;
  pis: Pi[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, action, isPending] = useActionState(updateFeatureAction, {});

  const wsjfFields = [
    { name: "wsjfBusinessValue", label: "Business Value", value: feature.wsjf.bv },
    { name: "wsjfTimeCriticality", label: "Time Criticality", value: feature.wsjf.tc },
    { name: "wsjfRiskReduction", label: "Risk Reduction", value: feature.wsjf.rr },
    { name: "wsjfJobSize", label: "Job Size", value: feature.wsjf.js },
  ];

  return (
    <div className="rounded border">
      <div className="flex items-center gap-3 p-3">
        <Link
          href={`/feature/${feature.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline"
        >
          {feature.title}
        </Link>
        <span className="shrink-0 text-xs text-muted-foreground">{feature.artName}</span>
        <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs">{feature.status}</span>
        <span className="shrink-0 text-xs text-muted-foreground">WSJF {feature.wsjf.computed}</span>
        {canEdit && (
          <>
            <FeaturePiSelect
              featureId={feature.id}
              artId={feature.artId}
              currentPiId={feature.piId}
              pis={pis}
            />
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 text-xs text-primary hover:underline"
            >
              {expanded ? "Schließen" : "Bearbeiten"}
            </button>
            <DeleteFeatureButton id={feature.id} artId={feature.artId} title={feature.title} />
          </>
        )}
      </div>

      {canEdit && expanded && (
        <form action={action} className="space-y-4 border-t p-4">
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
      )}
    </div>
  );
}

/**
 * Breakdown tab — manages the Features attached to an Epic in place: create,
 * inline-edit content + WSJF, assign a PI, and remove, without leaving the page.
 */
export function EpicBreakdownTab({
  epicId,
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
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parseBreakdownView(searchParams.get("breakdownView"));

  const setView = (next: BreakdownView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "list") params.delete("breakdownView");
    else params.set("breakdownView", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Breakdown</h2>
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Breakdown-Ansicht"
            className="inline-flex overflow-hidden rounded-md border bg-card text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
              className={`px-2.5 py-1 transition-colors ${
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Liste
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "graph"}
              onClick={() => setView("graph")}
              className={`px-2.5 py-1 transition-colors ${
                view === "graph"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Netzplan
            </button>
          </div>
          {canEdit && (
            <CreateFeatureDialog epics={[{ id: epicId, title: epicTitle }]} context={{ epicId }} />
          )}
        </div>
      </div>

      {signoff && <SectionSignoffBanner epicId={epicId} section="breakdown" {...signoff} />}

      <p className="text-xs text-muted-foreground">
        Die QS einzelner Features (durch den RTE) ist unabhängig von der Epic-Freigabe: hier nimmst
        du den <span className="font-medium">Breakdown als Ganzes</span> für die Freigabe ab.
      </p>

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
        <p className="text-sm text-muted-foreground">Noch keine Features in diesem Epic.</p>
      ) : (
        <div className="space-y-2">
          {features.map((f) => (
            <FeatureRow key={f.id} feature={f} canEdit={canEdit} pis={pisByArt[f.artId] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}
