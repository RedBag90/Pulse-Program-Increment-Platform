"use client";

import { useTranslations } from "next-intl";
import { useActionState, useMemo, useState } from "react";
import { PackageOpen } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { updateFeatureAction } from "@/modules/work/features/feature/actions/feature";
import {
  FeaturesListView,
  toFeatureStatus,
} from "@/modules/work/features/feature/components/features-table";
import { SectionLabel } from "@/components/ui/section-label";
import { EmptyState } from "@/components/ui/empty-state";
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
import { WsjfScoreDialog } from "@/modules/work/features/feature/components/wsjf-score-dialog";
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
    loading: NetzplanLadehinweis,
  },
);

type BreakdownView = "list" | "graph";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 20] as const;

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
  /**
   * **Je Zeile, nicht je Tabelle.** `feature.delete` ist `art`-scoped, und die
   * Features eines Epics koennen in verschiedenen ARTs liegen — ein Flag fuer
   * die ganze Liste waere wieder falsch, nur unauffaelliger.
   *
   * Bis September 2026 hing der Loesch-Knopf hier an `canEdit`, und das ist auf
   * dieser Flaeche `epic.update`: ein **Epic Owner** sah „Loeschen" an jedem
   * Feature seines Epics und bekam nach dem Bestaetigen „Insufficient
   * permissions". Ausser dem Portfolio Manager hat keine Rolle beide Rechte.
   */
  canDelete: boolean;
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
  /** Wertstrom des Epics — begrenzt die ART-Auswahl beim Anlegen eines Features. */
  epicValueStreamId: string | null;
  /**
   * **Das ART des Epics.** Ein neues Feature gehört dorthin, und der Dialog
   * braucht es: ohne die Angabe hält er den ART für eine offene Frage und
   * macht daraus eine Pflichtauswahl.
   *
   * Nicht zu verwechseln mit den `artIds` aus `epic-detail.ts` — das sind die
   * ARTs der **Kind-Features**, also wo die Arbeit heute liegt, nicht wohin
   * eine neue gehört.
   */
  epicArtId: string | null;
  canEdit: boolean;
  features: BreakdownFeature[];
  /** PI options keyed by ART — a child Feature's PI picker only lists its ART's PIs. */
  pisByArt: Record<string, Pi[]>;
  /**
   * Hat das Epic Budget (L3 oder später)? Erst dann lassen sich seine Features
   * einplanen — sonst steht die PI-Spalte als Text statt als Auswahl da.
   *
   * Die **Zeilen** bleiben: dies ist der Reiter des Epics, keine
   * Planungsübersicht. Wer seine Features nicht sieht, kann sie auch nicht
   * schneiden.
   */
  canSchedule: boolean;
  /** Sign-off state for the Breakdown section (omit to hide the banner). */
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
  const t = useTranslations();
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
        <Label htmlFor={`title-${feature.id}`}>{t("work.epic.titel")}</Label>
        <Input id={`title-${feature.id}`} name="title" defaultValue={feature.title} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`desc-${feature.id}`}>{t("work.epic.beschreibung")}</Label>
        <Textarea
          id={`desc-${feature.id}`}
          name="description"
          defaultValue={feature.description}
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`ac-${feature.id}`}>{t("work.epic.akzeptanzkriterien")}</Label>
        <Textarea
          id={`ac-${feature.id}`}
          name="acceptanceCriteria"
          defaultValue={feature.acceptanceCriteria.join("\n")}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">{t("work.epic.einKriteriumProZeile")}</p>
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
        <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          {t("work.epic.gespeichert")}
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
  epicValueStreamId,
  epicArtId,
  canEdit,
  features,
  pisByArt,
  canSchedule,
  dependencies,
  canLinkDependency,
  breakdownLayoutPositions,
  breakdownPis,
  showWsjf,
  canSetDelivery,
}: Props) {
  const t = useTranslations();
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
      {/* Die h2 wiederholte wortgleich das aktive Element der Reiterleiste
          links. Ein SectionLabel benennt die Menge, statt den Namen zu doppeln. */}
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>
          {view === "graph"
            ? "Abhängigkeiten"
            : `Deliverables${features.length > 0 ? ` · ${features.length}` : ""}`}
        </SectionLabel>
        {canEdit && view === "list" && (
          <CreateFeatureDialog
            epics={[{ id: epicId, title: epicTitle, valueStreamId: epicValueStreamId }]}
            context={{ epicId }}
            {...(epicArtId ? { artId: epicArtId } : {})}
            compact
          />
        )}
      </div>

      {view === "list" ? (
        <p className="text-xs text-muted-foreground">
          {t("work.epic.dieQsEinzelnerFeatures")}
          <span className="font-medium">{t("work.epic.deliverablesAlsGanzes")}</span>
          {t("work.epic.werdenMitDemBusiness")}
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
          epicValueStreamId={epicValueStreamId}
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
        <EmptyState
          icon={<PackageOpen className="size-6" />}
          title={t("work.epic.nochKeineDeliverables")}
          body={t("work.epic.deliverablesSindDieFeatures")}
          action={
            canEdit ? (
              <CreateFeatureDialog
                epics={[{ id: epicId, title: epicTitle, valueStreamId: epicValueStreamId }]}
                context={{ epicId }}
                {...(epicArtId ? { artId: epicArtId } : {})}
                compact
              />
            ) : undefined
          }
        />
      ) : (
        <FeaturesListView
          model={listModel}
          columns={["pi", "status", "wsjf", "ak"]}
          paramPrefix="dl."
          onOpen={(row) => openSlideOver(row.id)}
          showTotals={false}
          emptyLabel={t("work.epic.keineDeliverablesImAktuellen")}
          {...(canSetDelivery
            ? {
                renderStatus: (row: FeatureOverviewRow) => (
                  <FeatureStatusSelect featureId={row.id} status={row.status} label={row.title} />
                ),
              }
            : {})}
          {...(canEdit
            ? {
                /**
                 * **Das PI steht jetzt in seiner eigenen Spalte**, nicht
                 * doppelt. Vorher rendete die `pi`-Spalte den Namen als Text
                 * und `renderActions` daneben noch einmal ein Auswahlfeld —
                 * zweimal „Backlog" in derselben Zeile, einmal lesend, einmal
                 * ändernd. Man musste raten, welches gilt.
                 */
                renderPi: (row: FeatureOverviewRow) => {
                  const f = byId.get(row.id);
                  if (!f) return null;
                  return (
                    <FeaturePiSelect
                      featureId={f.id}
                      artId={f.artId}
                      currentPiId={f.piId}
                      pis={pisByArt[f.artId] ?? []}
                      canSchedule={canSchedule}
                    />
                  );
                },
                /**
                 * **Die WSJF-Zahl ist der Auslöser.** Sie war bis September
                 * 2026 nur eine Zahl; wer sie ändern wollte, klappte die ganze
                 * Bearbeitungsfläche der Zeile auf und scrollte an Titel,
                 * Beschreibung und Akzeptanzkriterien vorbei. Derselbe Dialog
                 * wie auf der Feature-Detailseite, nur von hier aus.
                 */
                renderWsjf: (row: FeatureOverviewRow) => {
                  const f = byId.get(row.id);
                  if (!f) return null;
                  return (
                    <WsjfScoreDialog
                      featureId={f.id}
                      artId={f.artId}
                      current={{
                        bv: f.wsjf.bv > 0 ? f.wsjf.bv : null,
                        tc: f.wsjf.tc > 0 ? f.wsjf.tc : null,
                        rr: f.wsjf.rr > 0 ? f.wsjf.rr : null,
                        js: f.wsjf.js > 0 ? f.wsjf.js : null,
                      }}
                      renderTrigger={({ onClick, score }) => (
                        <button
                          type="button"
                          onClick={onClick}
                          // Dieselbe Schriftgrösse wie der Zeilentext daneben:
                          // die Zelle erbt `text-xs tabular-nums` von der
                          // Tabelle, der Knopf darf sie nicht überschreiben.
                          className="tabular-nums text-primary hover:underline"
                          title={t("work.epic.wsjfBearbeiten")}
                        >
                          {score ?? "—"}
                        </button>
                      )}
                    />
                  );
                },
                renderActions: (row: FeatureOverviewRow) => {
                  const f = byId.get(row.id);
                  if (!f) return null;
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId((v) => (v === f.id ? null : f.id))}
                        className="shrink-0 text-xs text-primary hover:underline"
                      >
                        {expandedId === f.id ? "Schließen" : "Bearbeiten"}
                      </button>
                      {f.canDelete && (
                        <DeleteFeatureButton id={f.id} artId={f.artId} title={f.title} />
                      )}
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

/**
 * Eigene Komponente statt einer Pfeilfunktion in `loading`: `useTranslations`
 * ist ein Hook und braucht eine Komponente, keine beliebige Funktion.
 */
function NetzplanLadehinweis() {
  const t = useTranslations();
  return (
    <div className="flex h-[480px] items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
      {t("work.epic.ladeNetzplan")}
    </div>
  );
}
