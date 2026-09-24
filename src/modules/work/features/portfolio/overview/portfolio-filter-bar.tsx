"use client";

import { useTranslations } from "next-intl";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { SavedFilterControls } from "@/components/ui/saved-filter-controls";
import type { FilterCriteria } from "@/server/services/saved-filter";
import { MultiSelectFilter, type MultiSelectSection } from "@/components/ui/multi-select-filter";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";
import { STAGE_SHORT_KEYS } from "@/components/detail/initiative-labels";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import { EPIC_CLASS_KEYS } from "@/modules/work/domain/pb-submission";
import {
  savePortfolioFilterAction,
  deletePortfolioFilterAction,
} from "@/modules/work/features/portfolio/actions/saved-filter";
import type { SavedPortfolioFilterDTO } from "@/modules/work/server/services/saved-portfolio-filter";

/** Epic-Status, die als Filter angeboten werden (Lifecycle-relevante Teilmenge). */
const STATUS_OPTIONS = ["draft", "in_progress", "blocked", "completed", "cancelled"] as const;

interface Props {
  valueStreams: { id: string; name: string }[];
  owners: { id: string; label: string }[];
  savedFilters: SavedPortfolioFilterDTO[];
  /**
   * Practice `artEpics`. Ohne sie gibt es keine ART-Epics — dann bliebe die
   * Facette eine leere Unterscheidung und wird gar nicht erst angeboten.
   */
  showClassFacet?: boolean;
}

/**
 * Filterleiste der Portfolio-Übersicht: Wertstrom · Stage Gate · Status · Owner
 * · Epic-Klasse (Mehrfachauswahl, CSV im URL-State). Die Klasse verhält sich für
 * die Leserin wie die übrigen, verwirft aber nichts: die nicht gewählte Klasse
 * wird je Solution zusammengefasst ausgewiesen. Rechts die gespeicherten Filter des
 * Nutzers (anwenden / speichern / löschen); einer kann als Standard markiert
 * werden und wird beim Öffnen automatisch angewandt (Server, page.tsx).
 */
export function PortfolioFilterBar({
  valueStreams,
  owners,
  savedFilters,
  showClassFacet = false,
}: Props) {
  const t = useTranslations();
  const { params, push } = useUrlState();

  const readSet = (key: string): Set<string> =>
    new Set((params.get(key) ?? "").split(",").filter(Boolean));
  const writeSet = (key: string, set: Set<string>): void =>
    push({ [key]: set.size ? [...set].join(",") : null, f: null });

  const handlers = (key: string, set: Set<string>) => ({
    onToggle: (v: string) => {
      const next = new Set(set);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      writeSet(key, next);
    },
    onToggleSection: (values: string[], on: boolean) => {
      const next = new Set(set);
      for (const v of values) {
        if (on) next.add(v);
        else next.delete(v);
      }
      writeSet(key, next);
    },
    onClear: () => push({ [key]: null, f: null }),
  });

  const vsSel = readSet("vs");
  const gateSel = readSet("gate");
  const statusSel = readSet("status");
  const ownerSel = readSet("owner");
  const clsSel = readSet("cls");
  const anyActive = vsSel.size + gateSel.size + statusSel.size + ownerSel.size + clsSel.size > 0;

  const vsSections: MultiSelectSection[] = [
    { options: valueStreams.map((v) => ({ value: v.id, label: v.name })) },
  ];
  const gateSections: MultiSelectSection[] = [
    {
      options: STAGE_GATES.map((g) => ({
        value: g,
        label: `${g} · ${t(STAGE_SHORT_KEYS[g] ?? g)}`,
      })),
    },
  ];
  const statusSections: MultiSelectSection[] = [
    { options: STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s })) },
  ];
  const ownerSections: MultiSelectSection[] = [
    { options: owners.map((o) => ({ value: o.id, label: o.label })) },
  ];
  // Zwei Werte, nicht drei: ein Epic ohne freigegebenen Business Case ist noch
  // nicht eingeordnet und zählt zur Portfolio-Seite.
  const clsSections: MultiSelectSection[] = [
    {
      options: (["portfolio", "art"] as const).map((c) => ({
        value: c,
        label: t(EPIC_CLASS_KEYS[c] ?? c),
      })),
    },
  ];

  const csv = (arr: string[] | undefined) => (arr && arr.length ? arr.join(",") : null);
  /** Der Marker `f` wird geräumt — ein angewandter Filter ist kein „zurückgesetzt". */
  function applySaved(c: FilterCriteria) {
    push({
      vs: csv(c.vs),
      gate: csv(c.gate),
      status: csv(c.status),
      owner: csv(c.owner),
      cls: csv(c.cls),
      f: null,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2.5 shadow-card">
      <MultiSelectFilter
        label={t("work.overview.wertstrom")}
        sections={vsSections}
        selected={vsSel}
        {...handlers("vs", vsSel)}
      />
      <MultiSelectFilter
        label={t("work.overview.stageGate")}
        sections={gateSections}
        selected={gateSel}
        {...handlers("gate", gateSel)}
      />
      <MultiSelectFilter
        label={t("work.overview.status")}
        sections={statusSections}
        selected={statusSel}
        {...handlers("status", statusSel)}
      />
      <MultiSelectFilter
        label={t("work.overview.owner")}
        sections={ownerSections}
        selected={ownerSel}
        {...handlers("owner", ownerSel)}
      />
      {showClassFacet && (
        <MultiSelectFilter
          label={t("work.overview.epicKlasse")}
          sections={clsSections}
          selected={clsSel}
          {...handlers("cls", clsSel)}
        />
      )}

      {anyActive && (
        <button
          type="button"
          onClick={() =>
            push({ vs: null, gate: null, status: null, owner: null, cls: null, f: "0" })
          }
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          {t("work.overview.zuruecksetzen")}
        </button>
      )}

      {/* Auswahlliste, Chips und Speichern-Formular stehen seit dem Auslösen
          in `components/ui/saved-filter-controls.tsx` — dieselbe Bedienung
          benutzt jetzt auch die Ziele-Leiste. Was hier bleibt, ist das, was
          dieser Fläche gehört: ihre fünf Facetten und wie sie in die URL
          geschrieben werden. */}
      <SavedFilterControls
        filters={savedFilters}
        criteria={{
          vs: [...vsSel],
          gate: [...gateSel],
          status: [...statusSel],
          owner: [...ownerSel],
          cls: [...clsSel],
        }}
        anyActive={anyActive}
        onApply={applySaved}
        saveAction={savePortfolioFilterAction}
        deleteAction={deletePortfolioFilterAction}
      />
    </div>
  );
}
