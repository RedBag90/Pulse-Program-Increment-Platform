/**
 * Features-Overview page-model — cross-Value-Stream / cross-ART. Liefert
 * dieselben Funnel-Statuus + WSJF-Tier-Klassifikation wie das per-ART
 * `buildFeaturesListModel`, ergänzt aber jeden Row um ART + Value Stream
 * (für die zwei zusätzlichen Filter-Facetten) und reicht
 * VS-/ART-Optionen weiter, die das Filter-Bar braucht.
 *
 * Bewusst entkoppelt vom per-ART-Model gehalten: die Zeilen-Shape ist
 * eine eigene `FeatureOverviewRow`, nicht die `FeatureListRow`. So
 * können beide Pages unabhängig wachsen, ohne dass Brüche der
 * Spalten-Reihenfolge die jeweils andere brechen.
 */

import { FEATURE_STATUSES, type FeatureStatus, type WsjfTier } from "@/server/views/features-list";
import { wsjfBand } from "@/domain/schemas/initiative";

export interface FeatureOverviewRow {
  id: string;
  title: string;
  status: string;
  epic: { id: string; title: string } | null;
  pi: { id: string; name: string } | null;
  art: { id: string; name: string };
  valueStream: { id: string; name: string } | null;
  wsjfComputed: number | null;
  wsjfTier: WsjfTier;
  wsjfBusinessValue: number | null;
  wsjfTimeCriticality: number | null;
  wsjfRiskReduction: number | null;
  wsjfJobSize: number | null;
  acceptanceCriteriaCount: number;
  isBlocked: boolean;
  createdAtMs: number;
  /** SAFe-Guardrails (Roadmap-G3): Feature/Enabler. */
  featureType: string | null;
}

export interface ValueStreamOption {
  id: string;
  name: string;
}

export interface ArtOption {
  id: string;
  name: string;
  valueStreamId: string | null;
}

export interface EpicOptionLite {
  id: string;
  title: string;
}

export interface PiOptionLite {
  id: string;
  name: string;
  status: string;
}

export interface FeaturesOverviewModel {
  rows: FeatureOverviewRow[];
  funnelCounts: Record<FeatureStatus, number>;
  valueStreamOptions: ValueStreamOption[];
  artOptions: ArtOption[];
  epicOptions: EpicOptionLite[];
  piOptions: PiOptionLite[];
  showWsjf: boolean;
}

interface FeatureInput {
  id: string;
  title: string;
  status: string;
  piId: string | null;
  artId: string | null;
  parent: { id: string; title: string } | null;
  pi: { id: string; name: string } | null;
  wsjfBusinessValue: number | null;
  wsjfTimeCriticality: number | null;
  wsjfRiskReduction: number | null;
  wsjfJobSize: number | null;
  wsjfComputed: number | null;
  acceptanceCriteria: string[];
  createdAt: Date;
  featureType: string | null;
}

interface ArtInput {
  id: string;
  name: string;
  valueStreamId: string | null;
}

interface ValueStreamInput {
  id: string;
  name: string;
}

interface PiInput {
  id: string;
  name: string;
  status: string;
}

/** Auch vom Deliverables-Reiter genutzt, damit beide Listen dieselben Schwellen
 *  verwenden. Teilt die ≥ 5 / ≥ 2 / `"none"`-Konfiguration mit `features-list`
 *  über das gemeinsame LOW-Primitiv `wsjfBand` (`@/domain/schemas/initiative`). */
export function tierFor(wsjfComputed: number | null): WsjfTier {
  return wsjfBand(wsjfComputed, { high: 5, medium: 2, missingLabel: "none" });
}

export function buildFeaturesOverviewModel(input: {
  features: readonly FeatureInput[];
  arts: readonly ArtInput[];
  valueStreams: readonly ValueStreamInput[];
  /** All Epics in the tenant — filtered to only those parenting features in scope. */
  epics: readonly { id: string; title: string }[];
  pis: readonly PiInput[];
  blockedFeatureIds: ReadonlySet<string>;
  showWsjf: boolean;
}): FeaturesOverviewModel {
  const { features, arts, valueStreams, epics, pis, blockedFeatureIds, showWsjf } = input;

  const artById = new Map(arts.map((a) => [a.id, a] as const));
  const vsById = new Map(valueStreams.map((v) => [v.id, v] as const));

  const rows: FeatureOverviewRow[] = features.map((f) => {
    const art = f.artId ? artById.get(f.artId) : undefined;
    const vs = art?.valueStreamId ? vsById.get(art.valueStreamId) : undefined;
    return {
      id: f.id,
      title: f.title,
      status: f.status,
      epic: f.parent,
      pi: f.pi,
      art: art ? { id: art.id, name: art.name } : { id: "", name: "—" },
      valueStream: vs ? { id: vs.id, name: vs.name } : null,
      wsjfComputed: f.wsjfComputed,
      wsjfTier: tierFor(f.wsjfComputed),
      wsjfBusinessValue: f.wsjfBusinessValue,
      wsjfTimeCriticality: f.wsjfTimeCriticality,
      wsjfRiskReduction: f.wsjfRiskReduction,
      wsjfJobSize: f.wsjfJobSize,
      acceptanceCriteriaCount: f.acceptanceCriteria.length,
      isBlocked: blockedFeatureIds.has(f.id),
      createdAtMs: f.createdAt.getTime(),
      featureType: f.featureType,
    };
  });

  // Funnel-Counts: jeder Status bekommt einen Slot.
  const funnelCounts = Object.fromEntries(FEATURE_STATUSES.map((s) => [s, 0])) as Record<
    FeatureStatus,
    number
  >;
  for (const r of rows) {
    if (funnelCounts[r.status as FeatureStatus] != null) {
      funnelCounts[r.status as FeatureStatus] += 1;
    }
  }

  // VS- und ART-Optionen: nur die, die im Scope tatsächlich Features tragen
  // (Dropdown bleibt kurz).
  const usedArtIds = new Set(rows.map((r) => r.art.id).filter(Boolean));
  const usedVsIds = new Set(rows.map((r) => r.valueStream?.id).filter((id): id is string => !!id));
  const artOptions = arts
    .filter((a) => usedArtIds.has(a.id))
    .map((a) => ({ id: a.id, name: a.name, valueStreamId: a.valueStreamId }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const valueStreamOptions = valueStreams
    .filter((v) => usedVsIds.has(v.id))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const usedEpicIds = new Set(rows.map((r) => r.epic?.id).filter(Boolean));
  const epicOptions = epics
    .filter((e) => usedEpicIds.has(e.id))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));

  const piOptions = pis.map((p) => ({ id: p.id, name: p.name, status: p.status }));

  return {
    rows,
    funnelCounts,
    valueStreamOptions,
    artOptions,
    epicOptions,
    piOptions,
    showWsjf,
  };
}
